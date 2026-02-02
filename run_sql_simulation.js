const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
    const client = new Client({
        user: 'postgres.whpbetjyhpttinbxcffs',
        host: 'aws-1-eu-west-3.pooler.supabase.com',
        database: 'postgres',
        password: '#1rkB&njQ$Gn5C31BWwf',
        port: 5432,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const sqlPath = path.join(__dirname, 'debug_simulate_trigger.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("Executing simulation SQL...");
        const res = await client.query(sql);
        console.log("Result:", res);

    } catch (err) {
        console.error("Error executing simulation:", err);
    } finally {
        await client.end();
    }
}

run();
