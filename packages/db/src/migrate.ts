import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client';

async function main() {
  // The first migration file itself runs `CREATE SCHEMA "moneyapp"` — the
  // migrator's bookkeeping table lives in the default `drizzle` schema and
  // is created automatically.
  await migrate(db, { migrationsFolder: './drizzle' });
  await pool.end();
  console.log('Migrations applied.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
