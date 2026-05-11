import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function run() {
    const { data, error } = await supabase.from('pm_activity_logs')
        .select('id, action_type, details, created_at, item_ref')
        .gte('created_at', '2026-03-08T00:35:00Z')
        .lte('created_at', '2026-03-08T00:45:00Z')
        .order('created_at', { ascending: false });

    if (error) { console.error(error); return; }
    console.log(JSON.stringify(data, null, 2));
}

run();
