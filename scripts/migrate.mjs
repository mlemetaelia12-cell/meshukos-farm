import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is missing. Copy .env.example to .env and set your Neon connection string.');
  process.exit(1);
}
const migrationsDir = resolve(process.cwd(), 'sql');
const migrationFiles = (await readdir(migrationsDir))
  .filter((name) => /^\d+.*\.sql$/i.test(name))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
if (!migrationFiles.length) throw new Error('No SQL migration files found in ./sql.');
const pool = new Pool({ connectionString, ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined, max: 1, connectionTimeoutMillis: 15000 });
try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const migrationFile of migrationFiles) {
      const ddl = await readFile(resolve(migrationsDir, migrationFile), 'utf8');
      await client.query(ddl);
      console.log(`  ✓ Applied ${migrationFile}`);
    }
    await client.query('COMMIT');
    console.log('✅ Neon schema/migrations applied successfully. Existing livestock records and opening balances are preserved.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
} catch (error) {
  console.error('❌ Database migration failed. The migration transaction was rolled back. Check DATABASE_URL and Neon access.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally { await pool.end(); }
