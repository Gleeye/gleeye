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

        // Check item rules
        // Specifically check 'max_booking_lead_time' (anticipo massimo)
        // and 'min_booking_buffer_minutes' (anticipo minimo?) 

        console.log("--- Checking Booking Item Rules ---");
        const res = await client.query('SELECT * FROM booking_items WHERE id = $1', ['c14cc4bc-727c-446b-b68c-1812c083d37b']);
        console.table(res.rows);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

run();
