import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function run() {
    const itemId = '434332f8-53cc-43b9-bbd8-be7c15060b6a';

    console.log("Checking comments...");
    const { data: comments } = await supabase.from('pm_item_comments')
        .select('*')
        .eq('pm_item_ref', itemId);
    console.log(`Comments found: ${comments?.length || 0}`);
    if (comments) console.log(JSON.stringify(comments, null, 2));

    console.log("\nChecking assignees...");
    const { data: assignees } = await supabase.from('pm_item_assignees')
        .select('*')
        .eq('pm_item_ref', itemId);
    console.log(`Assignees found: ${assignees?.length || 0}`);
    if (assignees) console.log(JSON.stringify(assignees, null, 2));
}

run();
