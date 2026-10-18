import { neon } from '@neondatabase/serverless';

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is missing. Add your Neon PostgreSQL connection string to .env.');
  return neon(connectionString);
}
