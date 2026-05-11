
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTQzMjcsImV4cCI6MjA4MjkzMDMyN30.cwGACRAp_aLaXKHrSVcZKHz0tX1zvvHb_xGHNHxJxu8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectSchema() {
    console.log("Authenticating...");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'davide@gleeye.eu',
        password: 'd4d3493'
    });
    if (authError) {
        console.error("Auth failed:", authError.message);
        return;
    }
    console.log("Authenticated.");

    console.log("Inspecting Remote Schema...\n");
    const tables = ['collaborator_services'];

    for (const table of tables) {
        console.log(`--- Table: ${table} ---`);
        const { data, error } = await supabase.from(table).select('*').limit(1);

        if (error) {
            console.error(`ERROR: ${error.message} (Code: ${error.code})`);
        } else if (data.length === 0) {
            console.log("Table exists but is EMPTY (or RLS hidden). Cannot infer columns.");
        } else {
            console.log("Columns:", Object.keys(data[0]).join(', '));
            // Check specific logic columns
            if (table === 'orders') {
                console.log("  > status_works:", data[0].status_works !== undefined ? 'EXISTS' : 'MISSING');
                console.log("  > price_final:", data[0].price_final !== undefined ? 'EXISTS' : 'MISSING');
            }
            if (table === 'assignments') {
                console.log("  > id type sample:", typeof data[0].id, `(${data[0].id})`);
            }
        }
        console.log("");
    }
}

inspectSchema();
