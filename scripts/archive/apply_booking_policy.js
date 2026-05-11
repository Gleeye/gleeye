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

        console.log("Applying 'Allow public inserts to bookings' policy...");
        await client.query(`
        -- In case it exists, drop it first to avoid error
        DROP POLICY IF EXISTS "Allow public inserts to bookings" ON public.bookings;
        
        CREATE POLICY "Allow public inserts to bookings"
        ON public.bookings
        FOR INSERT
        TO public
        WITH CHECK (true);
    `);
        console.log("Policy applied successfully.");

    } catch (err) {
        console.error("Error applying policy:", err);
    } finally {
        await client.end();
    }
}

run();
