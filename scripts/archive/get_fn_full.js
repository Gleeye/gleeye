const { Client } = require('pg');
const fs = require('fs');
const config = {
    user: 'postgres.whpbetjyhpttinbxcffs',
    host: 'aws-1-eu-west-3.pooler.supabase.com',
    database: 'postgres',
    password: '#1rkB&njQ$Gn5C31BWwf',
    port: 5432,
    ssl: { rejectUnauthorized: false }
};

async function getFunction() {
    const client = new Client(config);
    try {
        await client.connect();
        const res = await client.query(`
            SELECT pg_get_functiondef(oid) 
            FROM pg_proc 
            WHERE proname = 'fn_app_activity_logger';
        `);
        fs.writeFileSync('fn_logger_full.sql', res.rows[0].pg_get_functiondef);
        console.log("Written to fn_logger_full.sql");
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
getFunction();
