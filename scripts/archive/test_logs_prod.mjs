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
    const result = await pool.query(`
    SELECT id, action_type, details, created_at
    FROM pm_activity_logs 
    ORDER BY created_at DESC 
    LIMIT 20
  `);
    console.log(JSON.stringify(result.rows, null, 2));
    await pool.end();
}

run();
