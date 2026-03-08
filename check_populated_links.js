const { Client } = require('pg');
const config = {
    user: 'postgres.whpbetjyhpttinbxcffs',
    host: 'aws-1-eu-west-3.pooler.supabase.com',
    database: 'postgres',
    password: '#1rkB&njQ$Gn5C31BWwf',
    port: 5432,
    ssl: { rejectUnauthorized: false }
};

async function checkActualData() {
    const client = new Client(config);
    try {
        await client.connect();
        const res = await client.query(`
            SELECT id, cloud_links
            FROM public.pm_items
            WHERE jsonb_array_length(cloud_links) > 0
            LIMIT 2;
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
checkActualData();
