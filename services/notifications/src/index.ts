import express from 'express';
import { notificationQueue } from './NotificationWorker';
import { startAlertProcessor } from './AlertProcessor';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { emailService } from './channels/EmailChannel';
import { logger } from './config/logger';

const app = express();
app.use(express.json());

app.get('/health', async (req, res) => {
  const emailOk = await emailService.verify().catch(() => false);
  res.json({ status: emailOk ? 'healthy' : 'degraded', service: 'notifications', emailReady: emailOk });
});

app.post('/notifications/send', async (req, res) => {
  const job = await notificationQueue.add(`manual-${Date.now()}`, req.body);
  res.json({ jobId: job.id, queued: true });
});

app.get('/notifications/:userId', async (req, res) => {
  const { db } = await import('./config/database');
  const notifications = await db('notifications')
    .where({ user_id: req.params.userId })
    .orderBy('created_at', 'desc')
    .limit(50);
  res.json(notifications);
});

app.patch('/notifications/:id/read', async (req, res) => {
  const { db } = await import('./config/database');
  await db('notifications').where({ id: req.params.id }).update({ read_at: new Date() });
  res.json({ ok: true });
});

async function bootstrap() {
  await connectDatabase();
  await connectRedis();
  startAlertProcessor();

  const PORT = parseInt(process.env.NOTIFICATIONS_PORT ?? '3004', 10);
  app.listen(PORT, () => logger.info(`Notifications service running on port ${PORT}`));
}

bootstrap().catch((err) => { logger.error('Failed to start notifications:', err); process.exit(1); });
