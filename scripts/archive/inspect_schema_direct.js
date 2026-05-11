
const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function inspectSchema() {
    await client.connect();

    console.log('--- Checking Collaborators Columns ---');
    const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'collaborators';
  `);

    res.rows.forEach(r => console.log(`collaborators.${r.column_name}: ${r.data_type}`));

    await client.end();
}

inspectSchema().catch(e => {
    console.error(e);
    process.exit(1);
});
