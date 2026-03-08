import pg from 'pg';

const pool = new pg.Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'postgres',
    password: 'postgres',
    port: 54322,
});

async function run() {
    const result = await pool.query('SELECT COUNT(*) FROM pm_activity_logs');
    console.log(result.rows);
    await pool.end();
}

run();
