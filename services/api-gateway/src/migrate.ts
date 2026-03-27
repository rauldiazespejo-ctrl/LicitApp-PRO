/**
 * One-time migration: applies database/schema/init.sql if tables don't exist yet.
 * Run as: node --require ts-node/register/transpile-only services/api-gateway/src/migrate.ts
 */
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function migrate() {
  const pool = new Pool({
    host:     process.env.POSTGRES_HOST     || 'localhost',
    port:     parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB       || 'licitapp',
    user:     process.env.POSTGRES_USER     || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    ssl:      process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    const { rows } = await pool.query(
      `SELECT to_regclass('public.tenants') AS exists`
    );

    if (rows[0].exists) {
      console.log('[MIGRATE] Schema already applied, skipping.');
      return;
    }

    console.log('[MIGRATE] Applying init.sql...');
    const sqlPath = path.join(__dirname, '../../../database/schema/init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    await pool.query(sql);
    console.log('[MIGRATE] Schema applied successfully.');
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('[MIGRATE] Failed:', err.message);
  process.exit(1);
});
