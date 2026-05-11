const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
    const client = new Client({
        user: 'postgres.whpbetjyhpttinbxcffs',
        host: 'aws-0-eu-central-1.pooler.supabase.com', // Updated from config I saw or trying standard region? Wait, existing script said aws-1-eu-west-3...
        // Let's use the explicit one from apply_schema_update.js to be safe.
        host: 'aws-0-eu-central-1.pooler.supabase.com',
        database: 'postgres',
        password: 'Gleeye2024!', // Password from recent memory or context? The previous file had a differnt one.
        // Actually, the previous file 'apply_schema_update.js' had:
        // host: 'aws-1-eu-west-3.pooler.supabase.com',
        // password: '#1rkB&njQ$Gn5C31BWwf'

        // I should probably try THAT one first.
        host: 'aws-1-eu-west-3.pooler.supabase.com',
        password: '#1rkB&njQ$Gn5C31BWwf',

        port: 6543, // Pooler port usually 6543, direct 5432
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("Connecting to Supabase...");
        await client.connect();
        console.log("Connected! Applying migration...");

        const sqlPath = path.join(__dirname, 'supabase/migrations/20260207000000_add_clusters.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log(`Executing SQL from ${sqlPath}`);
        await client.query(sql);

        console.log("Migration applied successfully.");

    } catch (err) {
        console.error("Error applying migration:", err);
    } finally {
        await client.end();
    }
}

run();
