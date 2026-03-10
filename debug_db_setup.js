const { Client } = require('pg');

async function run() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'postgres', password: 'postgres', port: 54322,
    });

    try {
        await client.connect();
        console.log("Connected to local Postgres!");

        console.log("--- TRIGGERS ON pm_items ---");
        const res = await client.query("SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.pm_items'::regclass;");
        console.log(JSON.stringify(res.rows, null, 2));

        console.log("--- LOGS ON pm_activity_logs ---");
        const logs = await client.query("SELECT count(*) FROM public.pm_activity_logs;");
        console.log(logs.rows[0]);

    } catch (err) { console.error("Error:", err); } finally { await client.end(); }
}
run();
