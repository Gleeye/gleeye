require('dotenv').config();
const { Client } = require('pg');

// Config Object
const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST || `db.${process.env.SUPABASE_PROJECT_REF}.supabase.co`,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'postgres',
    ssl: { rejectUnauthorized: false }
};

const client = new Client(dbConfig);

async function run() {
    try {
        await client.connect();

        console.log("Checking core_services...");
        const res1 = await client.query('SELECT id, name, department_id FROM core_services ORDER BY created_at DESC LIMIT 5');
        console.log("Services:", res1.rows);

        console.log("Checking core_service_department_links...");
        const res2 = await client.query('SELECT * FROM core_service_department_links LIMIT 5');
        console.log("Links found:", res2.rows);

        // Joined query simulation
        if (res1.rows.length > 0) {
            const ids = res1.rows.map(r => `'${r.id}'`).join(',');
            console.log("Checking links for specific services:", ids);
            const res3 = await client.query(`SELECT * FROM core_service_department_links WHERE core_service_id IN (${ids})`);
            console.log("Specific Links:", res3.rows);
        }

    } catch (err) {
        console.error("PG Error:", err);
    } finally {
        await client.end();
    }
}

run();
