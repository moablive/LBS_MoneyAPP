const { Client } = require('pg');
const fs = require('fs');
const url = process.env.DATABASE_URL;
(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    const r = await c.query("SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at;");
    console.log("APPLIED_TOTAL:", r.rows.length);
    r.rows.forEach(row => console.log(row.created_at, row.hash.slice(0,16)));
  } catch (e) {
    console.log("ERRO:", e.message);
  }
  await c.end();
})();
