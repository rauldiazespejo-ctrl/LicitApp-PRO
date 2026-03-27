import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { PortalSource, Tender } from '@licitapp/shared';
import { registry } from '../base/ConnectorRegistry';
import { circuitBreaker, CircuitOpenError } from '../base/CircuitBreaker';
import { DeduplicationService, DuplicateMatch } from '../deduplication/DeduplicationService';
import { classifyToUNSPSC } from '../normalization/UnspscMapper';
import { db } from '../config/database';
import { logger } from '../config/logger';
import { v4 as uuidv4 } from 'uuid';
import { redisConnection } from '../config/redis';

// ─── Job data ────────────────────────────────────────────────────────────────

interface SyncJobData {
  source: PortalSource;
  type: 'FULL' | 'INCREMENTAL' | 'SINGLE';
  since?: string;
  externalId?: string;
}

interface SyncResult {
  source: PortalSource;
  success: boolean;
  totalFetched: number;
  newRecords: number;
  updatedRecords: number;
  deduped: number;
  errorCount: number;
  durationMs: number;
  errors: string[];
  syncedAt: Date;
}

// ─── Queues ──────────────────────────────────────────────────────────────────

export const syncQueue = new Queue<SyncJobData>('sync', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export const syncQueueEvents = new QueueEvents('sync', { connection: redisConnection });

// ─── Worker ──────────────────────────────────────────────────────────────────

export const syncWorker = new Worker<SyncJobData, SyncResult>(
  'sync',
  async (job: Job<SyncJobData>) => {
    const { source, type, since, externalId } = job.data;
    const connector = registry.get(source);

    if (circuitBreaker.isOpen(source)) {
      logger.warn(`[SYNC] Circuit OPEN for ${source}, skipping`);
      throw new CircuitOpenError(source, 60);
    }

    const jobDbId = uuidv4();
    await db('sync_jobs').insert({
      id: jobDbId,
      source,
      type,
      status: 'RUNNING',
      started_at: new Date(),
      created_at: new Date(),
    }).catch(() => null);

    logger.info(`[SYNC] Starting ${type} sync for ${source} (job=${job.id})`);

    const errors: string[] = [];
    const startMs = Date.now();

    try {
      let tenders: Tender[] = [];

      if (type === 'SINGLE' && externalId) {
        const t = await circuitBreaker.execute(source, () => connector.fetchTenderById(externalId));
        if (t) tenders = [t];
      } else {
        const sinceDate = since ? new Date(since) : undefined;
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const batch = await circuitBreaker.execute(source, () => connector.fetchTenders(sinceDate, page));
          tenders.push(...batch);
          hasMore = batch.length >= connector.config.batchSize;
          page++;

          // Smooth progress: cap at 90% until upsert completes
          await job.updateProgress(Math.min(90, Math.round((tenders.length / Math.max(tenders.length + 50, 1)) * 90)));
        }
      }

      await job.updateProgress(90);

      const { newRecords, updatedRecords, deduped } = await upsertTendersWithDeduplication(
        tenders,
        source,
        errors,
      );

      await job.updateProgress(100);

      const result: SyncResult = {
        source,
        success: true,
        totalFetched: tenders.length,
        newRecords,
        updatedRecords,
        deduped,
        errorCount: errors.length,
        durationMs: Date.now() - startMs,
        errors: errors.slice(0, 20),
        syncedAt: new Date(),
      };

      await db('sync_jobs').where({ id: jobDbId }).update({
        status: 'COMPLETED',
        completed_at: new Date(),
        progress: 100,
        result: JSON.stringify(result),
      }).catch(() => null);

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await db('sync_jobs').where({ id: jobDbId }).update({
        status: 'FAILED',
        completed_at: new Date(),
        error_message: errorMsg,
      }).catch(() => null);
      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
    limiter: { max: 3, duration: 10_000 },
  },
);

// ─── Worker events ────────────────────────────────────────────────────────────

syncWorker.on('completed', (job, result) => {
  logger.info(
    `[SYNC] ✓ ${result.source}: fetched=${result.totalFetched} new=${result.newRecords} ` +
    `updated=${result.updatedRecords} deduped=${result.deduped} errors=${result.errorCount} ` +
    `duration=${result.durationMs}ms`,
  );
});

syncWorker.on('failed', (job, err) => {
  logger.error(`[SYNC] ✗ Job ${job?.id} (${job?.data.source}): ${err.message}`);
});

syncWorker.on('stalled', (jobId) => {
  logger.warn(`[SYNC] Job ${jobId} stalled — will be retried`);
});

// ─── Upsert with deduplication ────────────────────────────────────────────────

const BATCH_INSERT_SIZE = 50;

async function upsertTendersWithDeduplication(
  tenders: Tender[],
  source: PortalSource,
  errors: string[],
): Promise<{ newRecords: number; updatedRecords: number; deduped: number }> {
  let newRecords = 0;
  let updatedRecords = 0;
  let deduped = 0;

  const dedup = new DeduplicationService();
  const toInsert: object[] = [];

  for (const tender of tenders) {
    try {
      const fingerprint   = DeduplicationService.computeFingerprint(tender);
      const contentHash   = DeduplicationService.computeContentHash(tender);
      const unspsc        = classifyToUNSPSC(tender.title, tender.description, tender.category);

      const existing = await db('tenders')
        .select('id', 'content_hash')
        .where({ external_id: tender.externalId, source: tender.source })
        .first<{ id: string; content_hash: string } | undefined>();

      const record = buildTenderRecord(tender, fingerprint, contentHash, unspsc);

      if (!existing) {
        // Collect for batch insert
        toInsert.push({ ...record, id: tender.id ?? uuidv4(), created_at: new Date() });
        newRecords++;
      } else if (existing.content_hash !== contentHash) {
        await db('tenders').where({ id: existing.id }).update(record);
        updatedRecords++;
      }
    } catch (err) {
      const msg = `Upsert error for ${source}/${tender.externalId}: ${(err as Error).message}`;
      logger.error(`[SYNC] ${msg}`);
      errors.push(msg);
    }
  }

  // Batch insert new records
  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += BATCH_INSERT_SIZE) {
      const chunk = toInsert.slice(i, i + BATCH_INSERT_SIZE);
      await db('tenders').insert(chunk).onConflict(['external_id', 'source']).ignore();
    }
  }

  // Post-insert deduplication pass (only for new records)
  const newIds = (toInsert as Array<{ id: string; external_id: string; source: PortalSource; title: string }>)
    .map((r) => r.id);

  if (newIds.length > 0) {
    const newTenders = tenders.filter((t) => newIds.includes(t.id ?? ''));

    for (const tender of newTenders) {
      try {
        const matches: DuplicateMatch[] = await dedup.findDuplicates(tender);
        if (matches.length > 0) {
          const dbRow = await db('tenders')
            .select('id')
            .where({ external_id: tender.externalId, source: tender.source })
            .first<{ id: string }>();
          if (dbRow) {
            await dedup.recordDuplicateGroup(dbRow.id, matches);
            deduped += matches.length;
          }
        }
      } catch (err) {
        logger.warn(`[DEDUP] Error deduplicating ${tender.externalId}: ${(err as Error).message}`);
      }
    }
  }

  return { newRecords, updatedRecords, deduped };
}

// ─── Record builder ───────────────────────────────────────────────────────────

function buildTenderRecord(
  tender: Tender,
  fingerprint: string,
  contentHash: string,
  unspsc: ReturnType<typeof classifyToUNSPSC>,
): Record<string, unknown> {
  return {
    external_id:    tender.externalId,
    source:         tender.source,
    title:          tender.title,
    description:    tender.description,
    status:         tender.status,
    category:       tender.category,
    subcategory:    tender.subcategory ?? null,
    buyer:          JSON.stringify(tender.buyer ?? {}),
    budget:         tender.budget ? JSON.stringify(tender.budget) : null,
    published_at:   tender.publishedAt ?? null,
    opening_date:   tender.openingDate ?? null,
    closing_date:   tender.closingDate ?? null,
    award_date:     tender.awardDate ?? null,
    documents:      JSON.stringify(tender.documents ?? []),
    contacts:       JSON.stringify(tender.contacts ?? []),
    requirements:   JSON.stringify(tender.requirements ?? []),
    tags:           JSON.stringify(tender.tags ?? []),
    regions:        JSON.stringify(tender.regions ?? []),
    raw_data:       tender.rawData ? JSON.stringify(tender.rawData) : null,
    fingerprint,
    content_hash:   contentHash,
    unspsc_code:    unspsc.code,
    unspsc_label:   unspsc.label,
    is_duplicate:   false,
    synced_at:      new Date(),
    updated_at:     new Date(),
  };
}
