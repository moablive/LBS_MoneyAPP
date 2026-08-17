import 'dotenv/config';
import { db, pool } from './src/client';
import { sql } from 'drizzle-orm';

async function run() {
  try {
    const res = await db.execute(sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5`);
    console.log(res);
  } catch (e) {
    console.error(e);
  }
  pool.end();
}
run();
