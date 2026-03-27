import knex from 'knex';
import { logger } from './logger';
export const db = knex({ client: 'pg', connection: { host: process.env.POSTGRES_HOST ?? 'localhost', port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10), database: process.env.POSTGRES_DB ?? 'licitapp_chile', user: process.env.POSTGRES_USER ?? 'licitapp_user', password: process.env.POSTGRES_PASSWORD ?? 'changeme' }, pool: { min: 2, max: 10 } });
export async function connectDatabase() { await db.raw('SELECT 1'); logger.info('Notifications DB connected'); }
