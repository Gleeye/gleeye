
const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk';

async function checkUserAuth() {
    const email = 'mara@gleeye.eu';
    console.log(`Checking auth for ${email}...`);

    try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
            headers: {
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
            }
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`HTTP ${response.status}: ${err}`);
        }

        const data = await response.json();
        const users = data.users || [];
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (user) {
            console.log('\n--- User Found in Auth ---');
            console.log('ID:', user.id);
            console.log('Email:', user.email);
            console.log('Confirmed:', !!user.email_confirmed_at);
            console.log('Last Sign In:', user.last_sign_in_at);
            console.log('Created At:', user.created_at);
        } else {
            console.log('\n--- User NOT FOUND in Auth ---');
            const similar = users.filter(u => u.email.toLowerCase().includes('mara'));
            if (similar.length > 0) {
                console.log('Similar users found:');
                similar.forEach(u => console.log(`- ${u.email} (${u.id})`));
            } else {
                console.log('No similar users found.');
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkUserAuth();
