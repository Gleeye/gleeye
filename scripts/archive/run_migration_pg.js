const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
});

async function run() {
    await client.connect();
    const sql = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20260213132000_add_white_label_fields.sql'), 'utf8');
    try {
        await client.query(sql);
        console.log('Migration completed successfully');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

run();
