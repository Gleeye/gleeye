
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTQzMjcsImV4cCI6MjA4MjkzMDMyN30.cwGACRAp_aLaXKHrSVcZKHz0tX1zvvHb_xGHNHxJxu8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
    console.log("Checking DB schema...");
    try {
        // Try to select the new column
        const { data, error } = await supabase
            .from('pm_item_assignees')
            .select('collaborator_ref')
            .limit(1);

        if (error) {
            console.error("Column check failed:", error);
            process.exit(1);
        } else {
            console.log("Column 'collaborator_ref' exists!");
            process.exit(0);
        }
    } catch (e) {
        console.error("Exception:", e);
        process.exit(1);
    }
}

check();
