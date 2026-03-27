import cron from 'node-cron';
import { db } from '../config/database';
import { notificationQueue } from '../NotificationWorker';
import { logger } from '../config/logger';

export function startAlertProcessor(): void {
  cron.schedule('*/5 * * * *', async () => {
    await processNewTenderAlerts();
  });

  cron.schedule('0 8 * * *', async () => {
    await processClosingAlerts(3);
  });

  logger.info('[ALERT PROCESSOR] Scheduled: new tender alerts (*/5min), closing alerts (daily 8am)');
}

async function processNewTenderAlerts(): Promise<void> {
  const alerts = await db('tender_alerts')
    .join('users', 'tender_alerts.user_id', 'users.id')
    .where('tender_alerts.is_active', true)
    .where('users.is_active', true)
    .select(
      'tender_alerts.*',
      'users.email',
      'users.preferences',
    );

  for (const alert of alerts) {
    try {
      const keywords = typeof alert.keywords === 'string' ? JSON.parse(alert.keywords) : alert.keywords;
      const sources = typeof alert.sources === 'string' ? JSON.parse(alert.sources) : alert.sources;
      const regions = typeof alert.regions === 'string' ? JSON.parse(alert.regions) : alert.regions;

      const since = alert.last_triggered_at ?? new Date(Date.now() - 5 * 60 * 1000);

      let query = db('tenders')
        .where('published_at', '>', since)
        .limit(10);

      if (sources?.length) query = query.whereIn('source', sources);
      if (regions?.length) query = query.whereRaw('regions::jsonb ?| array[?]', [regions]);
      if (alert.min_budget) query = query.whereRaw("(budget->>'amount')::numeric >= ?", [alert.min_budget]);
      if (alert.max_budget) query = query.whereRaw("(budget->>'amount')::numeric <= ?", [alert.max_budget]);

      if (keywords?.length) {
        query = query.where((qb) => {
          for (const kw of keywords.slice(0, 5)) {
            qb.orWhereILike('title', `%${kw}%`).orWhereILike('description', `%${kw}%`);
          }
        });
      }

      const matches = await query;

      if (matches.length > 0) {
        await notificationQueue.add(`alert-${alert.id}-${Date.now()}`, {
          type: 'NEW_TENDER',
          userId: alert.user_id,
          tenantId: alert.tenant_id,
          alertId: alert.id,
          payload: { tenders: matches },
        });
        logger.info(`[ALERT] ${matches.length} matches for alert "${alert.name}" (${alert.user_id})`);
      }
    } catch (err) {
      logger.error(`[ALERT] Error processing alert ${alert.id}: ${(err as Error).message}`);
    }
  }
}

async function processClosingAlerts(daysThreshold: number): Promise<void> {
  const future = new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000);
  const now = new Date();

  const closingSoon = await db('tenders')
    .where('closing_date', '>', now)
    .where('closing_date', '<=', future)
    .whereIn('status', ['OPEN', 'PUBLISHED'])
    .select('id', 'title', 'source', 'buyer', 'closing_date')
    .limit(50);

  if (!closingSoon.length) return;

  const users = await db('users')
    .join('tenants', 'users.tenant_id', 'tenants.id')
    .where('users.is_active', true)
    .whereRaw(`users.preferences->>'emailNotifications' = 'true'`)
    .select('users.id', 'users.tenant_id');

  for (const user of users) {
    await notificationQueue.add(`closing-${user.id}-${Date.now()}`, {
      type: 'CLOSING_ALERT',
      userId: user.id,
      tenantId: user.tenant_id,
      payload: {
        tenders: closingSoon.map((t) => ({
          ...t,
          buyer: typeof t.buyer === 'string' ? JSON.parse(t.buyer).name : t.buyer?.name,
        })),
      },
    });
  }

  logger.info(`[CLOSING ALERT] ${closingSoon.length} tenders closing in ${daysThreshold}d, notified ${users.length} users`);
}
