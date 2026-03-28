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

async function checkRegistry() {
    const client = new Client(config);
    try {
        await client.connect();
        const res = await client.query(`
            SELECT id, table_name, template_insert, column_templates, track_columns, is_active 
            FROM public.pm_activity_registry 
            ORDER BY table_name;
        `);
        fs.writeFileSync('registry_dump.json', JSON.stringify(res.rows, null, 2));
        console.log("Registry dump written to registry_dump.json");
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
checkRegistry();
