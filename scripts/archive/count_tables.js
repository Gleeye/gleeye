const { Client } = require('pg');

async function run() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'postgres', password: 'postgres', port: 54322,
    });

    try {
        await client.connect();
        const items = await client.query("SELECT count(*) FROM public.pm_items;");
        const spaces = await client.query("SELECT count(*) FROM public.pm_spaces;");
        const orders = await client.query("SELECT count(*) FROM public.orders;");
        console.log("Counts:", { items: items.rows[0].count, spaces: spaces.rows[0].count, orders: orders.rows[0].count });
    } catch (err) { console.error("Error:", err); } finally { await client.end(); }
}
run();
