const { Client } = require('pg');
const url = process.env.DATABASE_URL;
(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    const r = await c.query("SELECT count(*) as n FROM drizzle.__drizzle_migrations;");
    console.log("APPLIED_TOTAL:", r.rows[0].n);
  } catch (e) {
    console.log("ERRO:", e.message);
  }
  await c.end();
})();
