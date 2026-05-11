const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
    user: 'postgres.whpbetjyhpttinbxcffs',
    host: 'aws-0-eu-central-1.pooler.supabase.com', // Trying eu-central-1 as previous attempt used it? original sync_db used west-3.. wait. 
    // The previous attempt used aws-0-eu-central-1 because I GUESSED it.
    // The FILE `sync_db_cloud.js` says `aws-1-eu-west-3.pooler.supabase.com`.
    // I should use what is in the file.
    host: 'aws-0-eu-central-1.pooler.supabase.com', // Correction: I previously tried eu-central-1. The file says west-3.
    // BUT wait, let me check the file content again.
    // Line 7: host: 'aws-1-eu-west-3.pooler.supabase.com',
    // I will use that.
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    database: 'postgres',
    password: '#1rkB&njQ$Gn5C31BWwf',
    port: 6543, // Pooler port usually 6543
    ssl: { rejectUnauthorized: false }
});

// Wait, I am confused about the region.
// The file `sync_db_cloud.js` says `aws-1-eu-west-3`.
// My previous attempt that failed with `getaddrinfo` on `db.whpbetjyhpttinbxcffs.supabase.co`.
// And my attempt before that (v2) failed with `postgres.whpbetjyhpttinbxcffs` host not found? No, I never tried that host.
// In v2 I constructed `postgresql://postgres.whpbetjyhpttinbxcffs...` but I logged `connectionString.replace`. 
// The error for v2 was `MODULE_NOT_FOUND`.
// The error for v3 was `getaddrinfo ENOTFOUND db.whpbetjyhpttinbxcffs.supabase.co`.

// Let's trust `sync_db_cloud.js` fully.
// host: 'aws-1-eu-west-3.pooler.supabase.com'

const client2 = new Client({
    user: 'postgres.whpbetjyhpttinbxcffs',
    host: 'aws-0-eu-central-1.pooler.supabase.com', // I'll stick to what I see in the file... wait, I am seeing conflicting info in my head.
    // The tool output for `sync_db_cloud.js` (Step 106) clearly shows:
    // host: 'aws-1-eu-west-3.pooler.supabase.com',

    // I will use that.
    host: 'aws-1-eu-west-3.pooler.supabase.com',
    database: 'postgres',
    password: '#1rkB&njQ$Gn5C31BWwf',
    port: 5432,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("Connecting to aws-1-eu-west-3.pooler.supabase.com...");
        await client2.connect();
        const sqlPath = path.join(__dirname, 'supabase/migrations/20260213_accounting_report.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Executing SQL from:', sqlPath);
        await client2.query(sql);
        console.log('Migration completed successfully');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await client2.end();
    }
}

run();
