import { esClient } from '../config/elasticsearch';
import { logger } from '../config/logger';

export const TENDERS_INDEX = 'licitapp_tenders';
export const TENDERS_ALIAS = 'tenders';

// ─── Index settings ───────────────────────────────────────────────────────────

export const tendersIndexSettings = {
  number_of_shards: 1,
  number_of_replicas: 1,
  // Defer refresh to every 30s while indexing; ES auto-resets to 1s when idle
  refresh_interval: '30s',
  // Enable request cache for filter-only queries (no random scoring)
  'requests.cache.enable': true,
  max_result_window: 50_000,
  analysis: {
    analyzer: {
      spanish_analyzer: {
        type: 'custom',
        tokenizer: 'standard',
        filter: ['lowercase', 'spanish_stop', 'spanish_stemmer', 'asciifolding'],
      },
      // Index-time: edge-ngram for prefix autocomplete
      autocomplete_analyzer: {
        type: 'custom',
        tokenizer: 'edge_ngram_tokenizer',
        filter: ['lowercase', 'asciifolding'],
      },
      // Search-time: standard so "constru" matches "construccion"
      autocomplete_search: {
        type: 'custom',
        tokenizer: 'standard',
        filter: ['lowercase', 'asciifolding'],
      },
    },
    tokenizer: {
      edge_ngram_tokenizer: {
        type: 'edge_ngram',
        min_gram: 2,
        max_gram: 30,            // increased from 20 for longer words
        token_chars: ['letter', 'digit'],
      },
    },
    filter: {
      spanish_stop:    { type: 'stop',    stopwords: '_spanish_' },
      spanish_stemmer: { type: 'stemmer', language: 'light_spanish' },
    },
    normalizer: {
      lowercase: { type: 'custom', filter: ['lowercase', 'asciifolding'] },
    },
  },
};

// ─── Mappings ─────────────────────────────────────────────────────────────────

export const tendersIndexMappings = {
  dynamic: 'strict' as const,
  properties: {
    id:          { type: 'keyword' as const },
    externalId:  { type: 'keyword' as const },
    source:      { type: 'keyword' as const },
    isDuplicate: { type: 'boolean' as const },
    masterId:    { type: 'keyword' as const },

    title: {
      type: 'text' as const,
      analyzer: 'spanish_analyzer',
      fields: {
        keyword:      { type: 'keyword' as const, normalizer: 'lowercase', ignore_above: 512 },
        autocomplete: {
          type: 'text' as const,
          analyzer: 'autocomplete_analyzer',
          search_analyzer: 'autocomplete_search',
        },
      },
    },
    description: {
      type: 'text' as const,
      analyzer: 'spanish_analyzer',
      index_options: 'offsets',   // needed for highlight
    },

    status:     { type: 'keyword' as const },
    category:   { type: 'keyword' as const },
    subcategory:{ type: 'keyword' as const },

    unspscCode:  { type: 'keyword' as const },
    unspscLabel: { type: 'keyword' as const },

    buyer: {
      type: 'object' as const,
      properties: {
        name:   {
          type: 'text' as const,
          analyzer: 'spanish_analyzer',
          fields: { keyword: { type: 'keyword' as const, normalizer: 'lowercase' } },
        },
        rut:    { type: 'keyword' as const },
        region: { type: 'keyword' as const },
        type:   { type: 'keyword' as const },
      },
    },

    budget: {
      type: 'object' as const,
      properties: {
        amount:   { type: 'double' as const },
        currency: { type: 'keyword' as const },
      },
    },

    publishedAt:  { type: 'date' as const },
    openingDate:  { type: 'date' as const },
    closingDate:  { type: 'date' as const },
    awardDate:    { type: 'date' as const },
    syncedAt:     { type: 'date' as const },

    tags:    { type: 'keyword' as const },
    regions: { type: 'keyword' as const },
  },
};

// ─── Index lifecycle ──────────────────────────────────────────────────────────

export async function createTendersIndex(): Promise<void> {
  const exists = await esClient.indices.exists({ index: TENDERS_INDEX });

  if (exists) {
    // Non-destructive: only add new fields; existing fields cannot be changed without reindex
    try {
      await esClient.indices.putMapping({
        index: TENDERS_INDEX,
        body: tendersIndexMappings,
      });
      logger.info(`[ES] Mapping updated for ${TENDERS_INDEX}`);
    } catch (err) {
      logger.warn(`[ES] Mapping update skipped (may require reindex): ${(err as Error).message}`);
    }

    // Ensure alias exists
    const aliasExists = await esClient.indices.existsAlias({ name: TENDERS_ALIAS });
    if (!aliasExists) {
      await esClient.indices.putAlias({ index: TENDERS_INDEX, name: TENDERS_ALIAS });
      logger.info(`[ES] Alias ${TENDERS_ALIAS} → ${TENDERS_INDEX} created`);
    }
    return;
  }

  await esClient.indices.create({
    index: TENDERS_INDEX,
    body: {
      settings: tendersIndexSettings,
      mappings: tendersIndexMappings,
      aliases: { [TENDERS_ALIAS]: {} },
    },
  });
  logger.info(`[ES] Index ${TENDERS_INDEX} created with alias ${TENDERS_ALIAS}`);
}

// ─── Bulk indexing ────────────────────────────────────────────────────────────

const BULK_BATCH = 500;

export async function reindexTenders(
  tenders: unknown[],
): Promise<{ indexed: number; errors: number }> {
  if (tenders.length === 0) return { indexed: 0, errors: 0 };

  let indexed = 0;
  let errors = 0;

  for (let i = 0; i < tenders.length; i += BULK_BATCH) {
    const chunk = tenders.slice(i, i + BULK_BATCH);

    const operations = chunk.flatMap((tender: any) => [
      { index: { _index: TENDERS_INDEX, _id: tender.id ?? tender.externalId } },
      normalizeForIndex(tender),
    ]);

    // 'wait_for' is far less disruptive than 'true' (refresh=true blocks the segment merge)
    const response = await esClient.bulk({ body: operations, refresh: 'wait_for' });

    const batchErrors = response.items.filter((item) => item.index?.error).length;
    indexed += chunk.length - batchErrors;
    errors  += batchErrors;
  }

  return { indexed, errors };
}

// Map DB snake_case to camelCase ES doc
function normalizeForIndex(t: Record<string, unknown>): Record<string, unknown> {
  return {
    id:          t.id,
    externalId:  t.external_id  ?? t.externalId,
    source:      t.source,
    isDuplicate: t.is_duplicate ?? t.isDuplicate ?? false,
    masterId:    t.master_id    ?? t.masterId ?? null,
    title:       t.title,
    description: t.description,
    status:      t.status,
    category:    t.category,
    subcategory: t.subcategory ?? null,
    unspscCode:  t.unspsc_code  ?? t.unspscCode ?? null,
    unspscLabel: t.unspsc_label ?? t.unspscLabel ?? null,
    buyer:       typeof t.buyer === 'string' ? JSON.parse(t.buyer as string) : t.buyer,
    budget:      t.budget
      ? (typeof t.budget === 'string' ? JSON.parse(t.budget as string) : t.budget)
      : null,
    publishedAt: t.published_at  ?? t.publishedAt  ?? null,
    openingDate: t.opening_date  ?? t.openingDate  ?? null,
    closingDate: t.closing_date  ?? t.closingDate  ?? null,
    awardDate:   t.award_date    ?? t.awardDate    ?? null,
    syncedAt:    t.synced_at     ?? t.syncedAt     ?? null,
    tags:        typeof t.tags    === 'string' ? JSON.parse(t.tags as string)    : (t.tags    ?? []),
    regions:     typeof t.regions === 'string' ? JSON.parse(t.regions as string) : (t.regions ?? []),
  };
}

export async function deleteTenderFromIndex(id: string): Promise<void> {
  await esClient.delete({ index: TENDERS_INDEX, id }).catch(() => null);
}
