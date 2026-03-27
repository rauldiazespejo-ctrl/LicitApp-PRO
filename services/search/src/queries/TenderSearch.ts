import { esClient } from '../config/elasticsearch';
import { TENDERS_ALIAS } from '../indices/TendersIndex';
import { TenderFilter, SearchResult } from '@licitapp/shared';
import { cacheGet, cacheSet, cacheKey, TTL_TEXT, TTL_FILTER, TTL_SUGGEST } from '../cache/SearchCache';

// Fields returned in _source — avoids fetching raw_data and other heavy fields
const SOURCE_INCLUDES = [
  'id', 'externalId', 'source', 'title', 'description', 'status', 'category', 'subcategory',
  'unspscCode', 'unspscLabel', 'buyer', 'budget',
  'publishedAt', 'openingDate', 'closingDate', 'awardDate',
  'tags', 'regions', 'syncedAt',
];

// Pages 1-5 use from/size; deeper pages use search_after for performance
const SEARCH_AFTER_THRESHOLD = 5;
const ES_TIMEOUT = '500ms';

// ─── Main search ──────────────────────────────────────────────────────────────

export async function searchTenders(
  filter: TenderFilter,
  searchAfterValues?: unknown[],
): Promise<SearchResult & { searchAfter?: unknown[] }> {
  const cKey = cacheKey('q', filter);

  // Cache hit — skip ES entirely
  const cached = await cacheGet<SearchResult>(cKey);
  if (cached) return { ...cached, _fromCache: true } as SearchResult & { searchAfter?: unknown[] };

  const {
    search, sources, statuses, categories, regions,
    minBudget, maxBudget,
    publishedAfter, publishedBefore, closingAfter, closingBefore,
    page, limit, sortBy, sortOrder,
  } = filter;

  const mustClauses: unknown[] = [];
  const filterClauses: unknown[] = [
    // Always exclude duplicates
    { term: { isDuplicate: false } },
  ];

  // ── Scoring clause (must) ──────────────────────────────────────────────────
  if (search?.trim()) {
    mustClauses.push({
      multi_match: {
        query: search.trim(),
        fields: ['title^4', 'title.autocomplete^2', 'description^1', 'buyer.name^1.5', 'unspscLabel^1', 'tags^1'],
        type: 'best_fields',
        fuzziness: 'AUTO',
        minimum_should_match: '75%',
        operator: 'or',
      },
    });
  }

  // ── Filter clauses (no scoring, cached by ES) ──────────────────────────────
  if (sources?.length)    filterClauses.push({ terms: { source: sources } });
  if (statuses?.length)   filterClauses.push({ terms: { status: statuses } });
  if (categories?.length) filterClauses.push({ terms: { category: categories } });
  if (regions?.length)    filterClauses.push({ terms: { regions } });

  if (minBudget !== undefined || maxBudget !== undefined) {
    const range: Record<string, number> = {};
    if (minBudget !== undefined) range.gte = minBudget;
    if (maxBudget !== undefined) range.lte = maxBudget;
    filterClauses.push({ range: { 'budget.amount': range } });
  }

  if (publishedAfter || publishedBefore) {
    const range: Record<string, string> = {};
    if (publishedAfter) range.gte = publishedAfter.toISOString();
    if (publishedBefore) range.lte = publishedBefore.toISOString();
    filterClauses.push({ range: { publishedAt: range } });
  }

  if (closingAfter || closingBefore) {
    const range: Record<string, string> = {};
    if (closingAfter) range.gte = closingAfter.toISOString();
    if (closingBefore) range.lte = closingBefore.toISOString();
    filterClauses.push({ range: { closingDate: range } });
  }

  const sortClause = buildSort(sortBy, sortOrder);
  const usePagination = page <= SEARCH_AFTER_THRESHOLD || !searchAfterValues;
  const isFilterOnly = !search?.trim();

  const body: Record<string, unknown> = {
    query: {
      bool: {
        must:   mustClauses.length ? mustClauses : [{ match_all: {} }],
        filter: filterClauses,
      },
    },
    sort: sortClause,
    size: limit,
    _source: { includes: SOURCE_INCLUDES },
    // Limit total count scan to 10k — avoids expensive exact counts on large indices
    track_total_hits: 10_000,
    // Highlight only when there is a text query
    ...(search?.trim() && {
      highlight: {
        fields: {
          title:       { number_of_fragments: 1, fragment_size: 150 },
          description: { number_of_fragments: 2, fragment_size: 200 },
        },
        pre_tags:  ['<mark>'],
        post_tags: ['</mark>'],
      },
    }),
    // Aggregations only on first page (reduces overhead on subsequent pages)
    ...(page === 1 && {
      aggs: {
        sources:      { terms: { field: 'source',   size: 20 } },
        statuses:     { terms: { field: 'status',   size: 10 } },
        categories:   { terms: { field: 'category', size: 20 } },
        regions:      { terms: { field: 'regions',  size: 30 } },
        unspsc:       { terms: { field: 'unspscCode', size: 20 } },
        budget_stats: { stats:  { field: 'budget.amount' } },
        closing_histogram: {
          date_histogram: {
            field: 'closingDate',
            calendar_interval: 'week',
            min_doc_count: 1,
          },
        },
      },
    }),
  };

  // Pagination strategy
  if (usePagination) {
    (body as Record<string, unknown>).from = (page - 1) * limit;
  } else {
    // search_after: O(log n) vs from/size O(n) for deep pages
    (body as Record<string, unknown>).search_after = searchAfterValues;
  }

  const response = await esClient.search({
    index: TENDERS_ALIAS,
    body,
    timeout: ES_TIMEOUT,
    // request_cache=true is effective for filter-only queries (stable score)
    request_cache: isFilterOnly,
  });

  const hits = response.hits.hits.map((hit) => ({
    id: hit._id,
    score: hit._score ?? undefined,
    source: hit._source,
    highlights: hit.highlight as Record<string, string[]> | undefined,
  }));

  const lastHit = response.hits.hits[response.hits.hits.length - 1];
  const nextSearchAfter = lastHit?.sort ?? undefined;

  const result: SearchResult = {
    hits,
    total: typeof response.hits.total === 'number'
      ? response.hits.total
      : (response.hits.total?.value ?? 0),
    took: response.took,
    aggregations: response.aggregations as Record<string, unknown>,
  };

  const ttl = isFilterOnly ? TTL_FILTER : TTL_TEXT;
  await cacheSet(cKey, result, ttl);

  return { ...result, searchAfter: nextSearchAfter };
}

// ─── Autocomplete suggestions ──────────────────────────────────────────────────

export async function suggestTenders(query: string, size = 10): Promise<string[]> {
  if (!query || query.length < 2) return [];

  const cKey = cacheKey('sug', { q: query.toLowerCase().trim(), size });
  const cached = await cacheGet<string[]>(cKey);
  if (cached) return cached;

  const response = await esClient.search({
    index: TENDERS_ALIAS,
    body: {
      query: {
        bool: {
          must: [
            {
              match: {
                'title.autocomplete': {
                  query,
                  operator: 'and',
                },
              },
            },
          ],
          filter: [{ term: { isDuplicate: false } }],
        },
      },
      _source: ['title'],
      size,
      sort: [{ _score: { order: 'desc' } }, { publishedAt: { order: 'desc' } }],
      track_total_hits: false,
    },
    timeout: '200ms',
    request_cache: true,
  });

  const suggestions = response.hits.hits
    .map((h: any) => h._source?.title as string)
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);  // deduplicate

  await cacheSet(cKey, suggestions, TTL_SUGGEST);
  return suggestions;
}

// ─── Sort builder ─────────────────────────────────────────────────────────────

function buildSort(sortBy?: string, sortOrder?: string): unknown[] {
  const order = (sortOrder ?? 'desc') as 'asc' | 'desc';
  switch (sortBy) {
    case 'relevance':
      return [{ _score: { order: 'desc' } }, { publishedAt: { order: 'desc', missing: '_last' } }];
    case 'closingDate':
      return [{ closingDate: { order, missing: '_last' } }, { _score: { order: 'desc' } }];
    case 'budget':
      return [{ 'budget.amount': { order, missing: '_last' } }, { _score: { order: 'desc' } }];
    case 'title':
      return [{ 'title.keyword': { order } }];
    case 'publishedAt':
    default:
      return [{ publishedAt: { order, missing: '_last' } }, { _score: { order: 'desc' } }];
  }
}
