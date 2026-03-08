import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const configStr = fs.readFileSync('js/modules/config.js', 'utf-8');
const urlMatch = configStr.match(/const SUPABASE_URL = '(.*?)'/);
const keyMatch = configStr.match(/const SUPABASE_KEY = '(.*?)'/);

const supabase = createClient(urlMatch[1], keyMatch[1]);
async function run() {
    const { data, error } = await supabase.rpc('get_triggers_for_table', { t_name: 'pm_items' });
    if (error) {
        // If RPC is missing, let's just use REST via standard info schema maybe? 
        // We can create a temporary function
        console.log("no rpc");
    } else {
        console.log(data);
    }
}
run();
