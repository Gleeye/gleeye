require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration Object - Avoids URL string parsing issues with special chars in password
const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD, // Config object handles raw password safely
    host: process.env.DB_HOST || `db.${process.env.SUPABASE_PROJECT_REF}.supabase.co`,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'postgres',
    ssl: { rejectUnauthorized: false }
};

console.log('Connecting to Remote Database (Config Object):', dbConfig.host);

const client = new Client(dbConfig);

async function run() {
    try {
        await client.connect();
        const sqlPath = path.join(__dirname, 'supabase/migrations/20260215010000_core_service_departments.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Executing SQL from:', sqlPath);
        await client.query(sql);
        console.log('Migration completed successfully on REMOTE database.');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();
