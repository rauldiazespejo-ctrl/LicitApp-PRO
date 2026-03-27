import cron from 'node-cron';
import { PortalSource } from '@licitapp/shared';
import { syncQueue } from '../queue/SyncQueue';
import { dedupQueue } from '../queue/DeduplicationWorker';
import { registry } from '../base/ConnectorRegistry';
import { db } from '../config/database';
import { logger } from '../config/logger';

// Cron expressions per portal — balance load across different hours
const SCHEDULE_MAP: Record<PortalSource, string> = {
  [PortalSource.CHILECOMPRA]:   '*/30 * * * *',     // Every 30 min (high volume)
  [PortalSource.WHEREX]:        '5 * * * *',         // Every hour at :05
  [PortalSource.SAP_ARIBA]:     '15 */2 * * *',      // Every 2 hours at :15
  [PortalSource.SICEP]:         '45 * * * *',        // Every hour at :45
  [PortalSource.COUPA]:         '20 * * * *',        // Every hour at :20
  [PortalSource.PORTAL_MINERO]: '0 */6 * * *',       // Every 6 hours
};

// Overlap factor: fetch slightly more than the sync interval to avoid gaps
const OVERLAP_FACTOR = 1.15;

// ─── Scheduler startup ────────────────────────────────────────────────────────

export async function startScheduler(): Promise<void> {
  const enabledConnectors = registry.getEnabled();

  // 1. Register incremental sync crons per portal
  for (const connector of enabledConnectors) {
    const cronExpr = SCHEDULE_MAP[connector.source];
    if (!cronExpr) continue;

    cron.schedule(cronExpr, async () => {
      try {
        await syncQueue.add(
          `sync-${connector.source}-${Date.now()}`,
          {
            source: connector.source,
            type: 'INCREMENTAL',
            since: new Date(
              Date.now() - connector.config.syncIntervalMinutes * 60 * 1000 * OVERLAP_FACTOR,
            ).toISOString(),
          },
          { priority: connector.source === PortalSource.CHILECOMPRA ? 10 : 5 },
        );
        logger.debug(`[SCHEDULER] Queued incremental sync for ${connector.source}`);
      } catch (err) {
        logger.error(`[SCHEDULER] Failed to queue sync for ${connector.source}: ${err}`);
      }
    });

    logger.info(`[SCHEDULER] ${connector.source} → cron: "${cronExpr}"`);
  }

  // 2. Weekly bulk re-deduplication (Sunday 02:00)
  cron.schedule('0 2 * * 0', async () => {
    logger.info('[SCHEDULER] Queuing weekly bulk re-deduplication');
    await dedupQueue.add(
      `weekly-rededup-${Date.now()}`,
      { type: 'BULK_REDEDUP', batchSize: 300 },
      { priority: 1 },
    ).catch((err) => logger.error('[SCHEDULER] Failed to queue bulk dedup:', err));
  });

  // 3. Initial full sync for portals that have never been synced
  await scheduleInitialFullSyncs(enabledConnectors.map((c) => c.source));
}

// ─── Initial sync check ───────────────────────────────────────────────────────

async function scheduleInitialFullSyncs(sources: PortalSource[]): Promise<void> {
  for (const source of sources) {
    const lastSync = await db('sync_jobs')
      .where({ source, status: 'COMPLETED' })
      .orderBy('completed_at', 'desc')
      .first<{ completed_at: Date } | undefined>();

    if (!lastSync) {
      logger.info(`[SCHEDULER] No completed sync found for ${source} — queuing initial FULL sync`);
      await syncQueue.add(
        `initial-full-${source}`,
        { source, type: 'FULL' },
        { priority: 3, delay: 5_000, jobId: `initial-full-${source}` },
      ).catch(() => null);
    }
  }
}

// ─── Manual triggers ──────────────────────────────────────────────────────────

export async function triggerSync(
  source: PortalSource,
  type: 'FULL' | 'INCREMENTAL' = 'INCREMENTAL',
): Promise<string> {
  const job = await syncQueue.add(
    `manual-${type}-${source}-${Date.now()}`,
    {
      source,
      type,
      since:
        type === 'INCREMENTAL'
          ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          : undefined,
    },
    { priority: 20 },
  );
  logger.info(`[SCHEDULER] Manual ${type} sync queued for ${source}: job=${job.id}`);
  return job.id ?? 'unknown';
}

export async function triggerBulkDedup(batchSize = 200): Promise<string> {
  const job = await dedupQueue.add(
    `manual-rededup-${Date.now()}`,
    { type: 'BULK_REDEDUP', batchSize },
    { priority: 5 },
  );
  logger.info(`[SCHEDULER] Manual bulk dedup queued: job=${job.id}`);
  return job.id ?? 'unknown';
}
