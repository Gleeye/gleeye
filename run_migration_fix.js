const fs = require('fs');
const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres.whpbetjyhpttinbxcffs:%231rkB%26njQ%24Gn5C31BWwf@aws-0-eu-central-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();
        console.log('Connected');
        const sql = fs.readFileSync('supabase/migrations/20260303123000_remove_buggy_accounting_triggers.sql', 'utf8');
        await client.query(sql);
        console.log('Migration fixed applied successfully.');
    } finally {
        await client.end().catch(console.error);
    }
}

main().catch(console.error);
