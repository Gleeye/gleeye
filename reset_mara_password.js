
const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk';

async function resetMaraPassword() {
    const email = 'mara@gleeye.eu';
    const userId = '253714e6-997b-4afe-a75f-a055b3eaadf1';
    const newPassword = 'Gleeye2025!';

    console.log(`Resetting password for ${email} (${userId})...`);

    try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                password: newPassword,
                email_confirm: true // Ensure email is confirmed
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`HTTP ${response.status}: ${err}`);
        }

        const data = await response.json();
        console.log('Password successfully reset to:', newPassword);

        // Also ensure is_onboarded is true in profiles
        const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
            method: 'PATCH',
            headers: {
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                is_onboarded: true
            })
        });

        if (profileResponse.ok) {
            console.log('Profile onboarding status verified.');
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

resetMaraPassword();
