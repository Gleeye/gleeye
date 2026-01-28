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
        console.log("Connected! Applying schema updates...");

        const queries = [
            "ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS iban TEXT;",
            "ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS bank_name TEXT;",
            "ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS document_id_front_url TEXT;",
            "ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS document_id_back_url TEXT;",
            "ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS document_health_card_url TEXT;"
        ];

        for (const query of queries) {
            console.log(`Executing: ${query}`);
            await client.query(query);
        }

        console.log("All columns added successfully.");

    } catch (err) {
        console.error("Error applying updates:", err);
    } finally {
        await client.end();
    }
}

run();
