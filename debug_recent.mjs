import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function run() {
    const { data, error } = await supabase.from('pm_activity_logs')
        .select('count')
        .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (error) { console.error(error); return; }
    console.log(`Logs in last 24h: ${data.length || 0}`);

    const { data: latest } = await supabase.from('pm_activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
    console.log('Latest 5:', JSON.stringify(latest, null, 2));
}

run();
