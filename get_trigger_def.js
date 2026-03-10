const { Client } = require('pg');

async function run() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'postgres', password: 'postgres', port: 54322,
    });

    try {
        await client.connect();
        const res = await client.query("SELECT routine_definition FROM information_schema.routines WHERE routine_name = 'fn_app_activity_logger';");
        console.log(res.rows[0].routine_definition);
    } catch (err) { console.error("Error:", err); } finally { await client.end(); }
}
run();
