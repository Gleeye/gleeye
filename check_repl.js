const { Client } = require('pg');
const config = {
    user: 'postgres.whpbetjyhpttinbxcffs',
    host: 'aws-1-eu-west-3.pooler.supabase.com',
    database: 'postgres',
    password: '#1rkB&njQ$Gn5C31BWwf',
    port: 5432,
    ssl: { rejectUnauthorized: false }
};

async function checkReplication() {
    const client = new Client(config);
    try {
        await client.connect();
        const res = await client.query(`
            SELECT pg_class.relname
            FROM pg_class
            JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
            JOIN pg_publication_tables ON pg_publication_tables.schemaname = pg_namespace.nspname AND pg_publication_tables.tablename = pg_class.relname
            WHERE pg_publication_tables.pubname = 'supabase_realtime' AND pg_class.relname = 'pm_activity_logs';
        `);
        console.log("REPLICATION:", res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
checkReplication();
