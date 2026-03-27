import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { DeduplicationService } from '../deduplication/DeduplicationService';
import { db } from '../config/database';
import { logger } from '../config/logger';
import { v4 as uuidv4 } from 'uuid';

// ─── Job data ────────────────────────────────────────────────────────────────

export interface DedupJobData {
  type: 'BULK_REDEDUP' | 'SINGLE_TENDER';
  tenderId?: string;
  batchSize?: number;
}

export interface DedupJobResult {
  totalChecked: number;
  newDuplicates: number;
  durationMs: number;
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export const dedupQueue = new Queue<DedupJobData, DedupJobResult>('dedup', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: { count: 20 },
    removeOnFail: { count: 20 },
  },
});

// ─── Worker ──────────────────────────────────────────────────────────────────

export const dedupWorker = new Worker<DedupJobData, DedupJobResult>(
  'dedup',
  async (job: Job<DedupJobData>) => {
    const { type, tenderId, batchSize = 200 } = job.data;
    const dedup = new DeduplicationService();
    const startMs = Date.now();

    if (type === 'SINGLE_TENDER' && tenderId) {
      return await processSingleTender(tenderId, dedup, startMs);
    }

    return await processBulkRededup(dedup, batchSize, job, startMs);
  },
  {
    connection: redisConnection,
    concurrency: 1,   // Intentionally single-concurrency: heavy DB operation
    limiter: { max: 1, duration: 5_000 },
  },
);

// ─── Handlers ────────────────────────────────────────────────────────────────

async function processSingleTender(
  tenderId: string,
  dedup: DeduplicationService,
  startMs: number,
): Promise<DedupJobResult> {
  const row = await db('tenders')
    .select('id', 'external_id', 'source', 'title', 'description', 'buyer', 'budget', 'closing_date', 'category')
    .where({ id: tenderId, is_duplicate: false })
    .first();

  if (!row) {
    return { totalChecked: 0, newDuplicates: 0, durationMs: Date.now() - startMs };
  }

  const matches = await dedup.findDuplicates({
    id: row.id,
    externalId: row.external_id,
    source: row.source,
    title: row.title,
    description: row.description,
    buyer: row.buyer,
    budget: row.budget,
    closingDate: row.closing_date,
    category: row.category,
  } as Parameters<typeof dedup.findDuplicates>[0]);

  if (matches.length > 0) {
    await dedup.recordDuplicateGroup(row.id, matches);
  }

  logger.debug(`[DEDUP WORKER] Single tender ${tenderId}: ${matches.length} duplicates found`);

  return { totalChecked: 1, newDuplicates: matches.length, durationMs: Date.now() - startMs };
}

async function processBulkRededup(
  dedup: DeduplicationService,
  batchSize: number,
  job: Job<DedupJobData>,
  startMs: number,
): Promise<DedupJobResult> {
  const jobDbId = uuidv4();
  logger.info(`[DEDUP WORKER] Starting bulk re-deduplication (batch=${batchSize})`);

  await db('sync_jobs').insert({
    id: jobDbId,
    source: 'CHILECOMPRA',  // synthetic; reuse table for tracking
    type: 'FULL',
    status: 'RUNNING',
    started_at: new Date(),
    created_at: new Date(),
  }).catch(() => null);

  const { totalChecked, newDuplicates } = await dedup.bulkDeduplicate(
    batchSize,
    async (processed, total) => {
      const progress = Math.round((processed / total) * 100);
      await job.updateProgress(progress);
      logger.debug(`[DEDUP WORKER] Bulk progress: ${processed}/${total} (${progress}%)`);
    },
  );

  const result: DedupJobResult = {
    totalChecked,
    newDuplicates,
    durationMs: Date.now() - startMs,
  };

  await db('sync_jobs').where({ id: jobDbId }).update({
    status: 'COMPLETED',
    completed_at: new Date(),
    progress: 100,
    result: JSON.stringify(result),
  }).catch(() => null);

  logger.info(`[DEDUP WORKER] Bulk complete: checked=${totalChecked} newDuplicates=${newDuplicates} duration=${result.durationMs}ms`);

  return result;
}

// ─── Worker events ────────────────────────────────────────────────────────────

dedupWorker.on('completed', (_job, result) => {
  logger.info(
    `[DEDUP WORKER] ✓ checked=${result.totalChecked} newDups=${result.newDuplicates} ${result.durationMs}ms`,
  );
});

dedupWorker.on('failed', (job, err) => {
  logger.error(`[DEDUP WORKER] ✗ Job ${job?.id}: ${err.message}`);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function scheduleBulkRededup(batchSize = 200): Promise<string> {
  const job = await dedupQueue.add(
    `bulk-rededup-${Date.now()}`,
    { type: 'BULK_REDEDUP', batchSize },
    { priority: 1 },
  );
  return job.id ?? 'unknown';
}

export async function scheduleSingleTenderDedup(tenderId: string): Promise<string> {
  const job = await dedupQueue.add(
    `dedup-${tenderId}`,
    { type: 'SINGLE_TENDER', tenderId },
    { priority: 5, jobId: `dedup-${tenderId}`, removeOnComplete: true },
  );
  return job.id ?? 'unknown';
}
