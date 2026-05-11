const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
    connectionString: "postgresql://postgres:%231rkB%26njQ%24Gn5C31BWwf@db.whpbetjyhpttinbxcffs.supabase.co:5432/postgres"
});

async function run() {
    try {
        await client.connect();
        console.log('Connected to remote DB');

        const sql = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20260309122800_track_item_movement.sql'), 'utf-8');

        console.log("Executing movement log tracking migration on REMOTE...");
        await client.query(sql);

        console.log("Reloading PostgREST schema cache on REMOTE...");
        await client.query("NOTIFY pgrst, 'reload_schema';");

        console.log('SQL executed successfully on REMOTE');
    } catch (err) {
        console.error('Execution error:', err);
    } finally {
        await client.end();
    }
}

run();
