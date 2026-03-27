import knex from 'knex';
import { config } from './env';
import { logger } from './logger';

export const db = knex({
  client: 'pg',
  connection: config.DATABASE_URL,
  pool: {
    min: 2,
    max: 20,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  },
  acquireConnectionTimeout: 60000,
});

export async function connectDatabase(): Promise<void> {
  await db.raw('SELECT 1');
  logger.info(`Database connected: ${config.DATABASE_URL.split('@')[1]}`);
}

export async function disconnectDatabase(): Promise<void> {
  await db.destroy();
}
