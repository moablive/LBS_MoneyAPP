const { Client } = require('pg');
const url = process.env.DATABASE_URL;
(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    const r = await c.query("SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5;");
    console.log("APPLIED_COUNT_RECENT:", r.rows.length);
    r.rows.forEach(row => console.log(row.hash, row.created_at));
  } catch (e) {
    console.log("ERRO:", e.message);
  }
  await c.end();
})();
