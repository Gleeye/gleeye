import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/davidegentile/Documents/app dev/gleeye erp/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: logs, error } = await supabase.from('pm_activity_logs').select('*').order('created_at', { ascending: false }).limit(10);
    console.log(logs);
    if(error) console.error(error);
}
main();
