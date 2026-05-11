
const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function checkOrder() {
    await client.connect();

    console.log('--- Checking Order_Collaborators Columns ---');
    const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'order_collaborators';
  `);

    res.rows.forEach(r => console.log(`order_collaborators.${r.column_name}: ${r.data_type}`));

    console.log('--- Checking Payments Columns ---');
    const res2 = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'payments';
  `);

    res2.rows.forEach(r => console.log(`payments.${r.column_name}: ${r.data_type}`));

    await client.end();
}

checkOrder().catch(e => {
    console.error(e);
    process.exit(1);
});
