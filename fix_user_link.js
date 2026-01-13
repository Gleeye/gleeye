
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://127.0.0.1:54321';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fixUserLink() {
    console.log("Fixing user link...");

    // 1. Get the new Auth User ID
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
        console.error('Error listing users:', listError);
        return;
    }

    const user = users.find(u => u.email === 'davide@gleeye.eu');
    if (!user) {
        console.error('User davide@gleeye.eu not found in Auth!');
        return;
    }
    console.log(`Found Auth User: ${user.id} (${user.email})`);

    // 2. Find the Collaborator record
    // Try matching by email first, then partial name if needed
    let { data: collaborators, error: collError } = await supabase
        .from('collaborators')
        .select('*')
        .ilike('email', 'davide@gleeye.eu');

    if (collError) {
        console.error('Error searching collaborators:', collError);
        return;
    }

    if (!collaborators || collaborators.length === 0) {
        console.log('No collaborator found with exact email. Searching by name "Davide"...');
        const { data: colsByName, error: nameError } = await supabase
            .from('collaborators')
            .select('*')
            .ilike('full_name', '%Davide%');

        if (nameError) {
            console.error('Error searching collaborators by name:', nameError);
            return;
        }
        collaborators = colsByName || [];
    }

    if (collaborators.length === 0) {
        console.error('No collaborator profile found for Davide!');
        return;
    }

    console.log(`Found ${collaborators.length} potential collaborator records.`);

    // Update the first one (most likely candidate)
    const targetCollab = collaborators[0];
    console.log(`Linking Auth User ${user.id} to Collaborator ${targetCollab.id} (${targetCollab.full_name})`);

    const { error: updateError } = await supabase
        .from('collaborators')
        .update({ user_id: user.id, email: user.email }) // Ensure email matches too
        .eq('id', targetCollab.id);

    if (updateError) {
        console.error('Error updating collaborator:', updateError);
    } else {
        console.log('Successfully linked User to Collaborator!');
    }
}

fixUserLink();
