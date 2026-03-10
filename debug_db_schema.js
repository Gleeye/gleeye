const { Client } = require('pg');

async function run() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'postgres', password: 'postgres', port: 54322,
    });

    try {
        await client.connect();
        console.log("Connected to local Postgres!");

        console.log("--- SCHEMA OF pm_activity_logs ---");
        const res = await client.query("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'pm_activity_logs';");
        console.log(JSON.stringify(res.rows, null, 2));

        console.log("--- REGISTRY DATA ---");
        const reg = await client.query("SELECT * FROM public.pm_activity_registry WHERE table_name = 'pm_items';");
        console.log(JSON.stringify(reg.rows, null, 2));

    } catch (err) { console.error("Error:", err); } finally { await client.end(); }
}
run();
