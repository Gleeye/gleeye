const { Client } = require('pg');

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
        await client.connect();
        console.log("Connected! Checking system_config...");

        const res = await client.query('SELECT * FROM system_config');
        console.log("Config entries:", res.rows);

        const authRes = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'collaborator_google_auth')");
        console.log("Table collaborator_google_auth exists:", authRes.rows[0].exists);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

run();
