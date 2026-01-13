
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTQzMjcsImV4cCI6MjA4MjkzMDMyN30.cwGACRAp_aLaXKHrSVcZKHz0tX1zvvHb_xGHNHxJxu8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkLinks() {
    const { data: collabs } = await supabase.from('collaborators').select('full_name, email, user_id');
    console.log("Collaborator Linking Status:");
    collabs?.forEach(c => {
        console.log(`- ${c.full_name} (${c.email}): ${c.user_id ? 'LINKED ✅' : 'NOT LINKED ❌'}`);
    });
}

checkLinks();
