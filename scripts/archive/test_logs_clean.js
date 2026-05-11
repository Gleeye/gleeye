import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const configStr = fs.readFileSync('js/modules/config.js', 'utf-8');
const urlMatch = configStr.match(/const SUPABASE_URL = '(.*?)'/);
const keyMatch = configStr.match(/const SUPABASE_KEY = '(.*?)'/);

const supabase = createClient(urlMatch[1], keyMatch[1]);
async function run() {
    const { data, error } = await supabase.rpc('get_table_triggers_custom', { /* need RPC for raw SQL, wait, no custom rpc available */ });
    // Instead of querying pg_trigger, just fetch all from pm_activity_logs recent
    const res = await supabase.from('pm_activity_logs')
        .select('action_type, details, actor_user_ref, space_ref, item_ref, order_ref, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
    console.log(JSON.stringify(res.data || res.error, null, 2));
}
run();
