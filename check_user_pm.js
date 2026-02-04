
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTQzMjcsImV4cCI6MjA4MjkzMDMyN30.cwGACRAp_aLaXKHrSVcZKHz0tX1zvvHb_xGHNHxJxu8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkUser() {
    // We don't know the exact user ID, but we can check the profile associated with Davide Gentile's email or just listing profiles
    const { data: profiles } = await supabase.from('profiles').select('*');
    console.table(profiles.map(p => ({ id: p.id, email: p.email, role: p.role, tags: p.tags })));
}

checkUser();
