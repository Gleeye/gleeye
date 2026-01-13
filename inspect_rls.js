
const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function inspectRLS() {
    await client.connect();

    console.log('--- Checking RLS Policies ---');
    const res = await client.query(`
    select * from pg_policies where schemaname = 'public' and tablename = 'assignments';
  `);

    res.rows.forEach(r => console.log(`Policy: ${r.policyname} | Perm: ${r.cmd} | Roles: ${r.roles}`));

    await client.end();
}

inspectRLS().catch(e => {
    console.error(e);
    process.exit(1);
});
