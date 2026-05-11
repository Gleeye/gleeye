require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = `postgresql://postgres.${process.env.SUPABASE_PROJECT_REF}:${process.env.DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true`;

console.log('Connecting to:', connectionString.replace(process.env.DB_PASSWORD, '***'));

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        const sqlPath = path.join(__dirname, 'supabase/migrations/20260213_accounting_report.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Executing SQL from:', sqlPath);
        await client.query(sql);
        console.log('Migration completed successfully');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();
