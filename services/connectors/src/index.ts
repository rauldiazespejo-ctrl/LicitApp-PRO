import 'express-async-errors';
import express from 'express';
import { registry } from './base/ConnectorRegistry';
import { syncQueue, syncWorker } from './queue/SyncQueue';
import { dedupQueue, dedupWorker, scheduleSingleTenderDedup } from './queue/DeduplicationWorker';
import { startScheduler, triggerSync, triggerBulkDedup } from './scheduler/SyncScheduler';
import { logger } from './config/logger';
import { connectDatabase, db } from './config/database';
import { connectRedis } from './config/redis';
import { circuitBreaker } from './base/CircuitBreaker';
import { PortalSource, TenderFilterSchema } from '@licitapp/shared';

const app = express();
app.use(express.json());

// ─── Health ──────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'connectors',
    timestamp: new Date().toISOString(),
    circuits: circuitBreaker.getAllStatuses(),
  });
});

app.get('/connectors/health', async (_req, res) => {
  const healthResults = await Promise.allSettled(
    registry.getAll().map((c) => c.getHealth()),
  );
  const results = healthResults.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { source: registry.getAll()[i].source, status: 'ERROR', error: (r.reason as Error).message },
  );
  res.json(results);
});

// ─── Sync endpoints ───────────────────────────────────────────────────────────

app.post('/connectors/:source/sync', async (req, res) => {
  const source = req.params.source.toUpperCase() as PortalSource;
  if (!Object.values(PortalSource).includes(source)) {
    res.status(400).json({ error: 'InvalidSource', message: `Source inválido: ${req.params.source}` });
    return;
  }
  const jobId = await triggerSync(source, req.body.type ?? 'INCREMENTAL');
  res.json({ jobId, message: `Sync encolado para ${source}` });
});

app.post('/connectors/:source/sync/full', async (req, res) => {
  const source = req.params.source.toUpperCase() as PortalSource;
  if (!Object.values(PortalSource).includes(source)) {
    res.status(400).json({ error: 'InvalidSource' });
    return;
  }
  const jobId = await triggerSync(source, 'FULL');
  res.json({ jobId, message: `Full sync encolado para ${source}` });
});

app.post('/connectors/:source/circuit/reset', (req, res) => {
  const source = req.params.source.toUpperCase() as PortalSource;
  circuitBreaker.reset(source);
  res.json({ message: `Circuit breaker reset for ${source}` });
});

// ─── Deduplication endpoints ──────────────────────────────────────────────────

app.post('/dedup/run', async (req, res) => {
  const { batchSize = 200 } = req.body;
  const jobId = await triggerBulkDedup(Number(batchSize));
  res.json({ jobId, message: 'Bulk re-deduplication encolada' });
});

app.post('/dedup/tenders/:id', async (req, res) => {
  const { id } = req.params;
  const tender = await db('tenders').where({ id }).first();
  if (!tender) {
    res.status(404).json({ error: 'TenderNotFound' });
    return;
  }
  const jobId = await scheduleSingleTenderDedup(id);
  res.json({ jobId, message: `Deduplicación encolada para licitación ${id}` });
});

app.get('/dedup/stats', async (_req, res) => {
  const [total, marked, pairs] = await Promise.all([
    db('tenders').count('id as cnt').first<{ cnt: string }>(),
    db('tenders').where({ is_duplicate: true }).count('id as cnt').first<{ cnt: string }>(),
    db('tender_duplicates').count('id as cnt').first<{ cnt: string }>(),
  ]);

  res.json({
    totalTenders:      Number(total?.cnt ?? 0),
    duplicatesTenders: Number(marked?.cnt ?? 0),
    duplicatePairs:    Number(pairs?.cnt ?? 0),
    deduplicationRate: total?.cnt
      ? ((Number(marked?.cnt ?? 0) / Number(total.cnt)) * 100).toFixed(2) + '%'
      : '0%',
  });
});

// ─── Job status ───────────────────────────────────────────────────────────────

app.get('/connectors/jobs', async (req, res) => {
  const { page = '1', limit = '20', source, status } = req.query as Record<string, string>;
  const query = db('sync_jobs').orderBy('created_at', 'desc');
  if (source) query.where({ source: source.toUpperCase() });
  if (status) query.where({ status: status.toUpperCase() });

  const [jobs, countRow] = await Promise.all([
    query.clone().limit(Number(limit)).offset((Number(page) - 1) * Number(limit)),
    db('sync_jobs').count('* as count').modify((q) => {
      if (source) q.where({ source: source.toUpperCase() });
      if (status) q.where({ status: status.toUpperCase() });
    }).first<{ count: string }>(),
  ]);

  res.json({
    data: jobs,
    total: Number(countRow?.count ?? 0),
    page: Number(page),
    limit: Number(limit),
  });
});

app.get('/connectors/jobs/:id', async (req, res) => {
  const job = await db('sync_jobs').where({ id: req.params.id }).first();
  if (!job) {
    res.status(404).json({ error: 'JobNotFound' });
    return;
  }
  res.json(job);
});

app.get('/queues/status', async (_req, res) => {
  const [syncCounts, dedupCounts] = await Promise.all([
    syncQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
    dedupQueue.getJobCounts('waiting', 'active', 'completed', 'failed'),
  ]);

  res.json({
    sync: syncCounts,
    dedup: dedupCounts,
    circuits: circuitBreaker.getAllStatuses(),
  });
});

// ─── Tenders ──────────────────────────────────────────────────────────────────

app.get('/tenders', async (req, res) => {
  const parsed = TenderFilterSchema.safeParse({
    ...req.query,
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 20,
  });

  if (!parsed.success) {
    res.status(400).json({ error: 'ValidationError', details: parsed.error.errors });
    return;
  }

  const { page, limit, sortBy, sortOrder, sources, statuses, categories } = parsed.data;

  const query = db('tenders').where({ is_duplicate: false });
  if (sources?.length) query.whereIn('source', sources);
  if (statuses?.length) query.whereIn('status', statuses);
  if (categories?.length) query.whereIn('category', categories);

  const [tenders, countRow] = await Promise.all([
    query.clone()
      .select('id', 'external_id', 'source', 'title', 'status', 'category', 'buyer', 'budget',
              'published_at', 'closing_date', 'unspsc_code', 'unspsc_label', 'regions', 'synced_at')
      .orderBy(sortBy ?? 'published_at', sortOrder ?? 'desc')
      .limit(limit)
      .offset((page - 1) * limit),
    query.clone().count('id as count').first<{ count: string }>(),
  ]);

  const total = Number(countRow?.count ?? 0);

  res.json({
    data: tenders,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

app.get('/tenders/stats/summary', async (_req, res) => {
  const [bySourceStatus, unspscTop, duplicationRate] = await Promise.all([
    db('tenders')
      .where({ is_duplicate: false })
      .groupBy('source', 'status')
      .select('source', 'status')
      .count('id as count'),

    db('tenders')
      .where({ is_duplicate: false })
      .whereNotNull('unspsc_code')
      .groupBy('unspsc_code', 'unspsc_label')
      .select('unspsc_code', 'unspsc_label')
      .count('id as count')
      .orderBy('count', 'desc')
      .limit(10),

    db('tenders').count('id as total').first<{ total: string }>().then(async (r) => {
      const duped = await db('tenders').where({ is_duplicate: true }).count('id as cnt').first<{ cnt: string }>();
      const total = Number(r?.total ?? 0);
      const dups  = Number(duped?.cnt ?? 0);
      return { total, duplicates: dups, rate: total ? ((dups / total) * 100).toFixed(2) + '%' : '0%' };
    }),
  ]);

  const bySource = bySourceStatus.reduce<Record<string, number>>((acc, row) => {
    acc[row.source as string] = (acc[row.source as string] ?? 0) + Number(row.count);
    return acc;
  }, {});

  const byStatus = bySourceStatus.reduce<Record<string, number>>((acc, row) => {
    acc[row.status as string] = (acc[row.status as string] ?? 0) + Number(row.count);
    return acc;
  }, {});

  res.json({
    total: duplicationRate.total,
    bySource,
    byStatus,
    unspscTop,
    deduplication: duplicationRate,
  });
});

app.get('/tenders/:id', async (req, res) => {
  const tender = await db('tenders').where({ id: req.params.id }).first()
    ?? await db('tenders').where({ external_id: req.params.id }).first();

  if (!tender) {
    res.status(404).json({ error: 'NotFound', message: 'Licitación no encontrada' });
    return;
  }

  // Include duplicates info if master
  const duplicates = await db('tender_duplicates')
    .where({ master_id: tender.id })
    .join('tenders', 'tenders.id', 'tender_duplicates.duplicate_id')
    .select('tenders.id', 'tenders.external_id', 'tenders.source', 'tenders.title', 'tender_duplicates.similarity');

  res.json({ ...tender, duplicates });
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('[CONNECTORS] Unhandled error:', err);
  res.status(500).json({ error: 'InternalError', message: err.message });
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap() {
  await connectDatabase();
  await connectRedis();
  await startScheduler();

  const PORT = parseInt(process.env.CONNECTORS_PORT ?? '3001', 10);
  app.listen(PORT, () => {
    logger.info(`Connectors service on port ${PORT}`);
  });

  async function shutdown() {
    logger.info('[CONNECTORS] Shutting down gracefully...');
    await Promise.all([
      syncWorker.close(),
      dedupWorker.close(),
      syncQueue.close(),
      dedupQueue.close(),
    ]);
    process.exit(0);
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  logger.error('Failed to start connectors service:', err);
  process.exit(1);
});
