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
        console.log("Connected to Supabase!");

        const queries = [
            "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name TEXT;",
            "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name TEXT;",
            "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;"
        ];

        for (const query of queries) {
            console.log(`Executing: ${query}`);
            await client.query(query);
        }

        console.log("Profiles table updated successfully.");

    } catch (err) {
        console.error("Error updating profiles table:", err);
    } finally {
        await client.end();
    }
}

run();
