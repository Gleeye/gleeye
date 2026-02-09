
const { Client } = require('pg');

async function checkUser() {
    const client = new Client({
        host: 'db.whpbetjyhpttinbxcffs.supabase.co',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: '#1rkB&njQ$Gn5C31BWwf',
    });

    try {
        await client.connect();
        console.log('Connected to remote database.');

        const email = 'mara@gleeye.eu';

        // Check auth.users
        const authRes = await client.query('SELECT id, email, confirmed_at, last_sign_in_at FROM auth.users WHERE email = $1', [email]);
        console.log('\n--- Auth Users ---');
        if (authRes.rows.length === 0) {
            console.log(`User ${email} NOT FOUND in auth.users`);
        } else {
            console.log('User found:', authRes.rows[0]);
        }

        // Check public.profiles
        const profileRes = await client.query('SELECT id, full_name, email, role FROM public.profiles WHERE email ILIKE $1 OR full_name ILIKE \'%Mara%\'', [email]);
        console.log('\n--- Public Profiles ---');
        if (profileRes.rows.length === 0) {
            console.log(`No profiles found for ${email} or Mara`);
        } else {
            profileRes.rows.forEach(row => console.log('Profile found:', row));
        }

        // Check for similar emails in auth.users
        const similarAuth = await client.query('SELECT email FROM auth.users WHERE email ILIKE \'%mara%\'');
        console.log('\n--- Similar Emails in Auth ---');
        if (similarAuth.rows.length === 0) {
            console.log('No similar emails found in auth.users');
        } else {
            similarAuth.rows.forEach(row => console.log('Found:', row.email));
        }

    } catch (err) {
        console.error('Error connecting or querying:', err);
    } finally {
        await client.end();
    }
}

checkUser();
