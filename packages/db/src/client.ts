import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Reminder: wrap the DSN in single quotes in .env — the password contains '$$'.",
  );
}

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
});

export const db = drizzle(pool, { schema, logger: process.env.NODE_ENV !== 'production' });
export { schema };
