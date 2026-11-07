// Read-only check: compara migrations locais (drizzle/meta/_journal.json) com
// a tabela __drizzle_migrations no banco. NUNCA escreve no banco.
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const dir = process.argv[2];
  const journalPath = path.join(dir, 'drizzle/meta/_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  const localTags = journal.entries.map(e => e.tag);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let appliedTags = [];
  try {
    const res = await client.query(`
      SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id
    `);
    appliedTags = res.rows.map(r => r.hash);
  } catch (e) {
    try {
      const res2 = await client.query(`
        SELECT hash FROM __drizzle_migrations ORDER BY id
      `);
      appliedTags = res2.rows.map(r => r.hash);
    } catch (e2) {
      console.log(JSON.stringify({ error: 'no_migrations_table', detail: e2.message }));
      await client.end();
      return;
    }
  }
  await client.end();

  console.log(JSON.stringify({
    local_count: localTags.length,
    applied_count: appliedTags.length,
    local_tags: localTags,
  }, null, 2));
}

main().catch(e => { console.log(JSON.stringify({ error: e.message })); process.exit(0); });
