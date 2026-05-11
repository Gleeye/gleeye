
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://127.0.0.1:54321';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function listCollaborators() {
    console.log("Listing all collaborators...");
    const { data, error } = await supabase.from('collaborators').select('id, full_name, email, user_id');

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("Collaborators:");
    data.forEach(c => console.log(`- [${c.id}] ${c.full_name} (Email: ${c.email}, UserID: ${c.user_id})`));
}

listCollaborators();
