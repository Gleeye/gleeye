const { Client } = require('pg');
const config = {
    user: 'postgres.whpbetjyhpttinbxcffs',
    host: 'aws-1-eu-west-3.pooler.supabase.com',
    database: 'postgres',
    password: '#1rkB&njQ$Gn5C31BWwf',
    port: 5432,
    ssl: { rejectUnauthorized: false }
};

async function fixReplication() {
    const client = new Client(config);
    try {
        await client.connect();
        await client.query(`
            ALTER PUBLICATION supabase_realtime ADD TABLE pm_activity_logs;
        `);
        console.log("REPLICATION FIXED");
    } catch (err) {
        console.error("FAIL:", err);
    } finally {
        await client.end();
    }
}
fixReplication();
