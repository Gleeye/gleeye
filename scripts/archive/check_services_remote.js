
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTQzMjcsImV4cCI6MjA4MjkzMDMyN30.cwGACRAp_aLaXKHrSVcZKHz0tX1zvvHb_xGHNHxJxu8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkServices() {
    console.log("Authenticating...");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'davide@gleeye.eu',
        password: 'password'
    });

    if (authError) {
        console.error("Auth failed:", authError.message);
        return;
    }
    console.log("Authenticated as:", authData.user.email);

    console.log("Checking recent collaborator services...");
    const { data, error } = await supabase
        .from('collaborator_services')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error fetching services:", error);
    } else {
        console.log("Found services:", data.length);
        data.forEach(s => {
            console.log(`- Service ID: ${s.id}`);
            console.log(`  Name: ${s.name}`);
            console.log(`  Order ID: ${s.order_id}`);
            console.log(`  Assignment ID: ${s.assignment_id}`);
            console.log(`  Created At: ${s.created_at}`);
        });
    }
}

checkServices();
