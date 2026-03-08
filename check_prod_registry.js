const { Client } = require('pg');
const config = {
    user: 'postgres.whpbetjyhpttinbxcffs',
    host: 'aws-1-eu-west-3.pooler.supabase.com',
    database: 'postgres',
    password: '#1rkB&njQ$Gn5C31BWwf',
    port: 5432,
    ssl: { rejectUnauthorized: false }
};

async function check() {
    const client = new Client(config);
    try {
        await client.connect();
        const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'pm_activity_registry' AND table_schema = 'public';");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
check();
