import pg from 'pg';

const pool = new pg.Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'postgres',
    password: 'postgres',
    port: 54322,
});

async function run() {
    const result = await pool.query('SELECT action_type, details, actor_user_ref, created_at, item_ref FROM pm_activity_logs ORDER BY created_at DESC LIMIT 15');
    console.log(JSON.stringify(result.rows, null, 2));
    await pool.end();
}

run();
