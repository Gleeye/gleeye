
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://127.0.0.1:54321';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function resetPassword() {
    const email = 'davide@gleeye.eu';
    const newPassword = 'password';

    console.log(`Resetting password for ${email}...`);

    // First, list users to check if user exists and get ID
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error('Error listing users:', listError);
        return;
    }

    const user = users.find(u => u.email === email);

    if (user) {
        console.log(`User found (ID: ${user.id}). Updating password...`);
        const { data, error } = await supabase.auth.admin.updateUserById(
            user.id,
            { password: newPassword }
        );

        if (error) {
            console.error('Error updating password:', error);
        } else {
            console.log('Password updated successfully!');
        }
    } else {
        console.log('User not found. Creating user...');
        const { data, error } = await supabase.auth.admin.createUser({
            email: email,
            password: newPassword,
            email_confirm: true
        });

        if (error) {
            console.error('Error creating user:', error);
        } else {
            console.log('User created successfully with password!');
        }
    }
}

resetPassword();
