import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function run() {
    const { data: item } = await supabase.from('pm_items')
        .select('id, title')
        .ilike('title', '%Prestazioni Occasionali%')
        .single();

    if (!item) { console.log("Item not found"); return; }
    console.log(`Found item: ${item.title} (${item.id})`);

    const { data: logs, error } = await supabase.from('pm_activity_logs')
        .select('*')
        .eq('item_ref', item.id)
        .order('created_at', { ascending: false });

    if (error) { console.error(error); return; }
    console.log(`Logs found: ${logs.length}`);
    console.log(JSON.stringify(logs, null, 2));
}

run();
