const { Client } = require('pg');

async function run() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'postgres', password: 'postgres', port: 54322,
    });

    try {
        await client.connect();
        console.log("Connected to local Postgres!");

        console.log("--- TEST UPDATE ---");
        const item = await client.query("SELECT id, title, space_ref FROM public.pm_items LIMIT 1;");
        if (item.rows.length > 0) {
            const id = item.rows[0].id;
            console.log(`Updating item ${id}: ${item.rows[0].title}`);
            // Set session user for auth.uid() simulation if possible, but pg-client doesn't support JWT
            // However, the trigger uses auth.uid(), which is NULL when using pg-client.
            // My triggers usually allow actor_user_ref to be NULL.

            await client.query(`UPDATE public.pm_items SET updated_at = NOW() WHERE id = '${id}';`);
            console.log("Update sent.");

            const logs = await client.query("SELECT * FROM public.pm_activity_logs ORDER BY created_at DESC LIMIT 1;");
            console.log("Newest log:", JSON.stringify(logs.rows[0], null, 2));
        } else {
            console.log("No items found to test.");
        }

    } catch (err) { console.error("Error:", err); } finally { await client.end(); }
}
run();
