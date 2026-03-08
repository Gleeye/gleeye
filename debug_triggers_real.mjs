import pg from 'pg';

const pool = new pg.Pool({
    user: 'postgres',
    host: 'db.whpbetjyhpttinbxcffs.supabase.co',
    database: 'postgres',
    password: '#1rkB&njQ$Gn5C31BWwf',
    port: 5432,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    const tables = ['pm_items', 'pm_item_assignees', 'pm_item_comments', 'pm_spaces'];
    for (const table of tables) {
        const res = await pool.query(`
      SELECT tgname, tgenabled, tgtype, tgfoid::regproc
      FROM pg_trigger 
      JOIN pg_class ON pg_class.oid = tgrelid
      WHERE relname = $1
    `, [table]);
        console.log(`\nTriggers for ${table}:`);
        console.table(res.rows);
    }
    await pool.end();
}

run();
