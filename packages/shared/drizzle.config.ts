import './src/loadEnv';
import { defineConfig } from 'drizzle-kit';

// `drizzle-kit generate` does not actually open a connection; it only needs
// the schema/out paths. So we accept an empty URL here and let the runtime
// client (src/db/client.ts) be the strict gatekeeper.
const url = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL ?? '';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  verbose: true,
});
