import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { emailService } from '../channels/EmailChannel';
import { db } from '../config/database';
import { logger } from '../config/logger';
import { v4 as uuidv4 } from 'uuid';

export interface NotificationJobData {
  type: 'NEW_TENDER' | 'CLOSING_ALERT' | 'EMAIL_VERIFICATION' | 'DIGEST' | 'SYNC_ERROR';
  userId?: string;
  tenantId?: string;
  alertId?: string;
  payload: Record<string, unknown>;
}

export const notificationQueue = new Queue<NotificationJobData>('notifications', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
});

export const notificationWorker = new Worker<NotificationJobData>(
  'notifications',
  async (job: Job<NotificationJobData>) => {
    const { type, userId, tenantId, alertId, payload } = job.data;

    logger.debug(`[NOTIFY] Processing ${type} for user ${userId ?? 'system'}`);

    switch (type) {
      case 'NEW_TENDER':
        await handleNewTenderNotification(userId!, tenantId!, alertId!, payload);
        break;
      case 'CLOSING_ALERT':
        await handleClosingAlert(userId!, tenantId!, payload);
        break;
      case 'EMAIL_VERIFICATION':
        await handleEmailVerification(payload);
        break;
      case 'SYNC_ERROR':
        await handleSyncError(payload);
        break;
      case 'DIGEST':
        await handleDigest(userId!, tenantId!, payload);
        break;
    }
  },
  { connection: redisConnection, concurrency: 5 }
);

async function handleNewTenderNotification(
  userId: string,
  tenantId: string,
  alertId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const user = await db('users').where({ id: userId }).select('email', 'name', 'preferences').first();
  if (!user) return;

  const prefs = typeof user.preferences === 'string' ? JSON.parse(user.preferences) : user.preferences;
  if (!prefs?.emailNotifications) return;

  const alert = await db('tender_alerts').where({ id: alertId }).first();
  if (!alert) return;

  const tenders = (payload.tenders as any[]).map((t) => ({
    ...t,
    detailUrl: `${process.env.APP_URL ?? 'http://localhost:5173'}/tenders/${t.id}`,
    budget: t.budget?.amount ? `${t.budget.currency} ${Number(t.budget.amount).toLocaleString('es-CL')}` : null,
    closingDate: t.closingDate ? new Date(t.closingDate).toLocaleDateString('es-CL') : null,
  }));

  await emailService.sendTemplate(
    'newTender',
    user.email,
    `Nueva licitación: "${tenders[0]?.title?.slice(0, 60)}" y ${tenders.length - 1} más`,
    {
      alertName: alert.name,
      tenders,
      unsubscribeUrl: `${process.env.APP_URL ?? 'http://localhost:5173'}/alerts/${alertId}/unsubscribe`,
    }
  );

  await db('tender_alerts').where({ id: alertId }).update({ last_triggered_at: new Date() });

  await db('notifications').insert({
    id: uuidv4(),
    user_id: userId,
    tenant_id: tenantId,
    type: 'NEW_TENDER',
    channel: 'EMAIL',
    title: `Alerta: ${alert.name}`,
    body: `${tenders.length} nueva(s) licitación(es) coinciden con tu alerta`,
    data: JSON.stringify({ alertId, count: tenders.length }),
    sent_at: new Date(),
    created_at: new Date(),
  });
}

async function handleClosingAlert(
  userId: string,
  tenantId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const user = await db('users').where({ id: userId }).select('email', 'name').first();
  if (!user) return;

  const tenders = (payload.tenders as any[]).map((t) => ({
    ...t,
    daysLeft: Math.ceil((new Date(t.closingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  }));

  await emailService.sendTemplate(
    'closingAlert',
    user.email,
    `⚠️ ${tenders.length} licitación(es) cierran en menos de 3 días`,
    { tenders }
  );
}

async function handleEmailVerification(payload: Record<string, unknown>): Promise<void> {
  await emailService.sendTemplate(
    'emailVerification',
    payload.email as string,
    'Verifica tu cuenta en licitapp Chile',
    {
      name: payload.name,
      code: payload.code,
      verifyUrl: `${process.env.APP_URL ?? 'http://localhost:5173'}/verify-email?token=${payload.token}`,
    }
  );
}

async function handleSyncError(payload: Record<string, unknown>): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;

  await emailService.send({
    to: adminEmail,
    subject: `[ALERTA] Error de sincronización: ${payload.source}`,
    html: `<p><strong>Portal:</strong> ${payload.source}</p><p><strong>Error:</strong> ${payload.error}</p><p><strong>Hora:</strong> ${new Date().toLocaleString('es-CL')}</p>`,
  });
}

async function handleDigest(
  userId: string,
  tenantId: string,
  payload: Record<string, unknown>
): Promise<void> {
  logger.info(`[NOTIFY] Digest for user ${userId}: ${(payload.tenders as any[]).length} new tenders`);
}

notificationWorker.on('failed', (job, err) => {
  logger.error(`[NOTIFY] Job ${job?.id} failed: ${err.message}`);
});
