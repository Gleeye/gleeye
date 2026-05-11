const { Client } = require('pg');
const connectionString = 'postgresql://postgres:%231rkB%26njQ%24Gn5C31BWwf@db.whpbetjyhpttinbxcffs.supabase.co:5432/postgres';

const client = new Client({ connectionString });

async function main() {
    try {
        await client.connect();
        const res = await client.query('SELECT details, action_type, created_at FROM public.pm_activity_logs ORDER BY created_at DESC LIMIT 5;');
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

main();
