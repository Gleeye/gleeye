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

        const queries = [
            "NOTIFY pgrst, 'reload_schema';"
        ];

        for (const q of queries) {
            console.log("Executing:", q);
            const res = await client.query(q);
            if (res.rows) console.log("Rows:", res.rows);
        }

        console.log("SQL executed successfully!");
    } catch (err) {
        console.error("Error executing SQL:", err);
    } finally {
        await client.end();
    }
}

run();
