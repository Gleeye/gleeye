
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://127.0.0.1:54321';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function restoreProfile() {
    console.log("Restoring Profile and Collaborator...");

    // 1. Get Auth User
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const user = users.find(u => u.email === 'davide@gleeye.eu');
    if (!user) { console.error("User not found"); return; }
    console.log(`User ID: ${user.id}`);

    // 2. Upsert Profile (Admin)
    const { error: profError } = await supabase
        .from('profiles')
        .upsert({
            id: user.id,
            email: user.email,
            full_name: 'Davide Gentile',
            role: 'admin',
            is_onboarded: true
        });

    if (profError) console.error("Profile Upsert Error:", profError);
    else console.log("Profile restored (Admin).");

    // 3. Upsert Collaborator
    // Check if exists by email to avoid duplicates if ID mismatch
    const { data: existing } = await supabase.from('collaborators').select('*').eq('email', user.email).single();

    if (existing) {
        console.log("Collaborator exists, updating link...");
        await supabase.from('collaborators').update({ user_id: user.id }).eq('id', existing.id);
    } else {
        console.log("Creating new Collaborator record...");
        await supabase.from('collaborators').insert({
            full_name: 'Davide Gentile',
            email: user.email,
            user_id: user.id,
            role: 'Admin'
        });
    }

    console.log("Done.");
}

restoreProfile();
