import 'express-async-errors';
import express from 'express';
import { connectElasticsearch } from './config/elasticsearch';
import { connectRedisSearch } from './config/redis';
import { createTendersIndex, reindexTenders, TENDERS_INDEX } from './indices/TendersIndex';
import { searchTenders, suggestTenders } from './queries/TenderSearch';
import { invalidateSearchCache } from './cache/SearchCache';
import { TenderFilterSchema } from '@licitapp/shared';
import { logger } from './config/logger';

const app = express();
app.use(express.json({ limit: '20mb' }));

// ─── Health ──────────────────────────────────────────────────────────────────

app.get('/health', async (_req, res) => {
  res.json({ status: 'healthy', service: 'search', index: TENDERS_INDEX, timestamp: new Date().toISOString() });
});

// ─── Search ───────────────────────────────────────────────────────────────────

app.get('/search', async (req, res) => {
  const parsed = TenderFilterSchema.safeParse({
    ...req.query,
    page:       req.query.page       ? Number(req.query.page)       : 1,
    limit:      req.query.limit      ? Number(req.query.limit)      : 20,
    minBudget:  req.query.minBudget  ? Number(req.query.minBudget)  : undefined,
    maxBudget:  req.query.maxBudget  ? Number(req.query.maxBudget)  : undefined,
    sources:    toArray(req.query.sources),
    statuses:   toArray(req.query.statuses),
    categories: toArray(req.query.categories),
    regions:    toArray(req.query.regions),
  });

  if (!parsed.success) {
    res.status(400).json({ error: 'ValidationError', details: parsed.error.errors });
    return;
  }

  // Optional search_after cursor for deep pagination (pass as ?cursor=base64encoded)
  let searchAfterValues: unknown[] | undefined;
  if (req.query.cursor) {
    try {
      searchAfterValues = JSON.parse(Buffer.from(req.query.cursor as string, 'base64url').toString());
    } catch {
      // ignore invalid cursor
    }
  }

  const result = await searchTenders(parsed.data, searchAfterValues);

  // Encode next cursor for deep pagination
  const nextCursor = result.searchAfter
    ? Buffer.from(JSON.stringify(result.searchAfter)).toString('base64url')
    : undefined;

  res.json({
    data: result.hits.map((h) => ({
      ...h.source,
      _score:      h.score,
      _highlights: h.highlights,
    })),
    total:      result.total,
    page:       parsed.data.page,
    limit:      parsed.data.limit,
    totalPages: Math.ceil(Math.min(result.total, 10_000) / parsed.data.limit),
    took:       result.took,
    nextCursor,
    facets: formatFacets(result.aggregations),
  });
});

// ─── Suggestions ──────────────────────────────────────────────────────────────

app.get('/search/suggestions', async (req, res) => {
  const q    = (req.query.q as string) ?? '';
  const size = req.query.size ? Number(req.query.size) : 10;
  const suggestions = await suggestTenders(q, Math.min(size, 20));
  res.json(suggestions);
});

// ─── Reindex ──────────────────────────────────────────────────────────────────

app.post('/search/reindex', async (req, res) => {
  const { tenders } = req.body;
  if (!Array.isArray(tenders)) {
    res.status(400).json({ error: 'InvalidBody', message: 'Se requiere un array de licitapp' });
    return;
  }

  const [indexResult, invalidated] = await Promise.all([
    reindexTenders(tenders),
    invalidateSearchCache(),
  ]);

  res.json({
    message: 'Reindex completado',
    ...indexResult,
    cacheInvalidated: invalidated,
  });
});

app.delete('/search/cache', async (_req, res) => {
  const deleted = await invalidateSearchCache();
  res.json({ message: 'Caché de búsqueda invalidada', deleted });
});

// ─── Cache stats ──────────────────────────────────────────────────────────────

app.get('/search/cache/stats', async (_req, res) => {
  const { redis } = await import('./config/redis');
  const info = await redis.info('stats').catch(() => '');
  const keyspaceHits   = info.match(/keyspace_hits:(\d+)/)?.[1]   ?? '0';
  const keyspaceMisses = info.match(/keyspace_misses:(\d+)/)?.[1] ?? '0';
  const hits   = Number(keyspaceHits);
  const misses = Number(keyspaceMisses);
  res.json({
    hits,
    misses,
    hitRate: hits + misses > 0 ? ((hits / (hits + misses)) * 100).toFixed(2) + '%' : 'N/A',
  });
});

// ─── Compat route (used by connectors service) ────────────────────────────────

app.get('/tenders/search', async (req, res) => {
  const parsed = TenderFilterSchema.safeParse({
    ...req.query,
    page:  req.query.page  ? Number(req.query.page)  : 1,
    limit: req.query.limit ? Number(req.query.limit) : 20,
  });
  if (!parsed.success) {
    res.status(400).json({ error: 'ValidationError' });
    return;
  }
  const result = await searchTenders(parsed.data);
  res.json({ data: result.hits.map((h) => h.source), total: result.total, page: parsed.data.page, limit: parsed.data.limit });
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('[SEARCH] Unhandled error:', err.message);
  res.status(500).json({ error: 'InternalError', message: err.message });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toArray(val: unknown): string[] | undefined {
  if (!val) return undefined;
  return Array.isArray(val) ? val as string[] : [val as string];
}

function formatFacets(aggs?: Record<string, unknown>) {
  if (!aggs) return {};
  const buckets = (key: string) =>
    (aggs as any)?.[key]?.buckets?.map((b: any) => ({ value: b.key, count: b.doc_count })) ?? [];
  return {
    sources:    buckets('sources'),
    statuses:   buckets('statuses'),
    categories: buckets('categories'),
    regions:    buckets('regions'),
    unspsc:     buckets('unspsc'),
    budgetStats: (aggs as any)?.budget_stats ?? {},
    closingHistogram: (aggs as any)?.closing_histogram?.buckets ?? [],
  };
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap() {
  try {
    await connectElasticsearch();
    await createTendersIndex();
  } catch (err) {
    logger.warn('[SEARCH] Elasticsearch unavailable — search endpoints will return 503:', (err as Error).message);
  }

  try {
    await connectRedisSearch();
  } catch (err) {
    logger.warn('[SEARCH] Redis unavailable — search cache disabled:', (err as Error).message);
  }

  const PORT = parseInt(process.env.SEARCH_PORT ?? '3002', 10);
  app.listen(PORT, () => logger.info(`Search service running on port ${PORT}`));
}

bootstrap().catch((err) => {
  logger.error('Failed to start search service:', err);
  process.exit(1);
});
