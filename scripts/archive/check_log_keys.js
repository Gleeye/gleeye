const { Client } = require('pg');
const config = {
    user: 'postgres.whpbetjyhpttinbxcffs',
    host: 'aws-1-eu-west-3.pooler.supabase.com',
    database: 'postgres',
    password: '#1rkB&njQ$Gn5C31BWwf',
    port: 5432,
    ssl: { rejectUnauthorized: false }
};

async function checkCloudLogKeys() {
    const client = new Client(config);
    try {
        await client.connect();
        const res = await client.query(`
            SELECT id, item_ref, space_ref, order_ref
            FROM public.pm_activity_logs 
            WHERE action_type LIKE '%cloud_links%'
            ORDER BY created_at DESC 
            LIMIT 1;
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
checkCloudLogKeys();
