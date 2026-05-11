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
        console.log("Connected to CLOUD Supabase!");

        const queries = [
            'ALTER TABLE "public"."pm_spaces" ADD COLUMN IF NOT EXISTS "variant_name" TEXT;',
            'ALTER TABLE "public"."core_services" ADD COLUMN IF NOT EXISTS "variations" JSONB DEFAULT \'[]\';'
        ];

        for (const q of queries) {
            console.log("Executing:", q);
            try {
                await client.query(q);
            } catch (e) {
                console.warn("Failed:", e.message);
            }
        }

        console.log("SQL executed successfully!");
    } catch (err) {
        console.error("Error executing SQL:", err);
    } finally {
        await client.end();
    }
}

run();
