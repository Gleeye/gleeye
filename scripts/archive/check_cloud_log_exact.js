const { Client } = require('pg');
const config = {
    user: 'postgres.whpbetjyhpttinbxcffs',
    host: 'aws-1-eu-west-3.pooler.supabase.com',
    database: 'postgres',
    password: '#1rkB&njQ$Gn5C31BWwf',
    port: 5432,
    ssl: { rejectUnauthorized: false }
};

async function checkCloudLogDetails() {
    const client = new Client(config);
    try {
        await client.connect();
        const res = await client.query(`
            SELECT id, details->'old' as old_val, details->'new' as new_val
            FROM public.pm_activity_logs 
            WHERE action_type LIKE '%cloud_links%'
            ORDER BY created_at DESC 
            LIMIT 2;
        `);
        for (const row of res.rows) {
            console.log("ID:", row.id);
            console.log("OLD:", typeof row.old_val, row.old_val);
            console.log("NEW:", typeof row.new_val, row.new_val);
            console.log("---");
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
checkCloudLogDetails();
