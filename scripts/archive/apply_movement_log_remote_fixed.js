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
        console.log("Connecting to Supabase Pooler (whpbetjyhpttinbxcffs - Paris)...");
        await client.connect();
        console.log("Connected! Executing SQL...");

        const sql = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20260309122800_track_item_movement.sql'), 'utf8');
        await client.query(sql);

        console.log("SQL executed successfully!");

        console.log("Reloading PostgREST schema cache...");
        await client.query("NOTIFY pgrst, 'reload_schema';");
        console.log("Schema reloaded!");

    } catch (err) {
        console.error("Error executing SQL on 5432:", err);
        console.log("Trying port 6543...");
        const client2 = new Client({
            user: 'postgres.whpbetjyhpttinbxcffs',
            host: 'aws-1-eu-west-3.pooler.supabase.com',
            database: 'postgres',
            password: '#1rkB&njQ$Gn5C31BWwf',
            port: 6543,
            ssl: { rejectUnauthorized: false }
        });
        try {
            await client2.connect();
            console.log("Connected on 6543! Executing SQL...");
            const sql = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20260309122800_track_item_movement.sql'), 'utf8');
            await client2.query(sql);
            console.log("SQL executed successfully!");

            console.log("Reloading PostgREST schema cache...");
            await client2.query("NOTIFY pgrst, 'reload_schema';");
            console.log("Schema reloaded!");
        } catch (err2) {
            console.error("Error on 6543:", err2);
            process.exit(1);
        } finally {
            try { await client2.end(); } catch (e) { }
        }
    } finally {
        try { await client.end(); } catch (e) { }
    }
}

run();
