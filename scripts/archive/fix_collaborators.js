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
            "ALTER TABLE public.collaborators ADD COLUMN IF NOT EXISTS first_name TEXT;",
            "ALTER TABLE public.collaborators ADD COLUMN IF NOT EXISTS last_name TEXT;",
            "ALTER TABLE public.collaborators ADD COLUMN IF NOT EXISTS avatar_url TEXT;",
            "ALTER TABLE public.collaborators ADD COLUMN IF NOT EXISTS pec TEXT;",
            "ALTER TABLE public.collaborators ADD COLUMN IF NOT EXISTS address_cap TEXT;",
            "ALTER TABLE public.collaborators ADD COLUMN IF NOT EXISTS address_city TEXT;",
            "ALTER TABLE public.collaborators ADD COLUMN IF NOT EXISTS address_province TEXT;"
        ];

        for (const query of queries) {
            console.log(`Executing: ${query}`);
            await client.query(query);
        }

        console.log("Collaborators table updated successfully.");

    } catch (err) {
        console.error("Error updating collaborators table:", err);
    } finally {
        await client.end();
    }
}

run();
