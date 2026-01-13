const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const password = encodeURIComponent('#1rkB&njQ$Gn5C31BWwf');
const connectionString = `postgresql://postgres:${password}@db.whpbetjyhpttinbxcffs.supabase.co:5432/postgres`;

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

const schemaFile = 'booking_design/schema.sql';

async function applyMigrations() {
    try {
        await client.connect();
        console.log('Connected to Remote Database.');

        console.log(`Applying ${schemaFile}...`);
        const sql = fs.readFileSync(path.join(__dirname, schemaFile), 'utf8');

        await client.query(sql);
        console.log(`Success: ${schemaFile}`);

        console.log('Schema applied successfully.');
    } catch (err) {
        console.error('Migration Failed:', err);
    } finally {
        await client.end();
    }
}

applyMigrations();
