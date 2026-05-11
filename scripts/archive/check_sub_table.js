const { Client } = require('pg');
const config = {
    user: 'postgres.whpbetjyhpttinbxcffs',
    host: 'aws-1-eu-west-3.pooler.supabase.com',
    database: 'postgres',
    password: '#1rkB&njQ$Gn5C31BWwf',
    port: 5432,
    ssl: { rejectUnauthorized: false }
};

async function checkSubTable() {
    const client = new Client(config);
    try {
        await client.connect();
        const res = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE  table_schema = 'public'
                AND    table_name   = 'pm_item_subscriptions'
            );
        `);
        console.log("EXISTS:", res.rows[0].exists);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
checkSubTable();
