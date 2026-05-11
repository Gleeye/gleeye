
const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk';

async function listAllUsers() {
    try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
            headers: {
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
            }
        });

        const data = await response.json();
        const users = data.users || [];
        console.log(`Total users found: ${users.length}`);
        users.forEach(u => {
            console.log(`- ${u.email} (${u.id}) [${u.email_confirmed_at ? 'Confirmed' : 'Unconfirmed'}]`);
        });
    } catch (error) {
        console.error('Error:', error.message);
    }
}

listAllUsers();
