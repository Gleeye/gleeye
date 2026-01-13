
const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function seedDB() {
    await client.connect();

    console.log('--- Seeding Local DB ---');

    // 1. Insert Client
    const clientRes = await client.query(`
    INSERT INTO clients (business_name, client_code, email)
    VALUES ('Test Client SpA', 'TST001', 'client@test.com')
    RETURNING id;
  `);
    const clientId = clientRes.rows[0].id;
    console.log('Created Client:', clientId);

    // 2. Insert Order (Force UUID to match frontend cache if possible)
    const orderRes = await client.query(`
    INSERT INTO orders (id, order_number, title, client_id, status, created_at)
    VALUES ('b0c11467-2987-452a-ac1a-4be808019f52', '25-0029', 'Sviluppo Gestionale ERP', $1, 'In Lavorazione', NOW())
    RETURNING id;
  `, [clientId]);
    const orderId = orderRes.rows[0].id;
    console.log('Created Order:', orderId);

    // 3. Insert Collaborator (Force ID if known, otherwise just insert)
    // Let's force a likely ID if we knew it, but we don't. 
    // But wait, the previous error log showed the user selected a collaborator with ID: 
    // "0ccd895c-88de-457e-901f-0e423ed1d5eb" (from Step Id: 2135 logs).
    // Let's use THAT ID for Alessio Castellano.
    const collabRes = await client.query(`
    INSERT INTO collaborators (id, full_name, email, role)
    VALUES ('0ccd895c-88de-457e-901f-0e423ed1d5eb', 'Alessio Castellano', 'alessio@gleeye.com', 'Developer')
    RETURNING id;
  `);
    const collabId = collabRes.rows[0].id;
    console.log('Created Collaborator:', collabId);

    await client.end();
}

seedDB().catch(e => {
    console.error(e);
    process.exit(1);
});
