const { Client } = require('pg');

async function run() {
    const client = new Client({
        user: 'postgres',
        host: '127.0.0.1',
        database: 'postgres',
        password: 'postgres',
        port: 54322,
    });

    try {
        await client.connect();
        console.log("Connected to local Postgres!");

        console.log("--- REGISTRY FOR pm_items ---");
        const res = await client.query("SELECT track_columns, column_templates FROM public.pm_activity_registry WHERE table_name = 'pm_items';");
        console.log(JSON.stringify(res.rows[0], null, 2));

        console.log("--- RECENT LOGS ---");
        const logs = await client.query("SELECT action_type, details, created_at FROM public.pm_activity_logs ORDER BY created_at DESC LIMIT 5;");
        console.log(JSON.stringify(logs.rows, null, 2));

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

run();
