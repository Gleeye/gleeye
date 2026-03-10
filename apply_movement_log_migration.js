const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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

        const sql = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20260309122800_track_item_movement.sql'), 'utf-8');

        console.log("Executing migration...");
        await client.query(sql);

        console.log("Reloading PostgREST schema cache...");
        await client.query("NOTIFY pgrst, 'reload_schema';");

        console.log("SQL executed successfully!");
    } catch (err) {
        console.error("Error executing SQL:", err);
    } finally {
        await client.end();
    }
}

run();
