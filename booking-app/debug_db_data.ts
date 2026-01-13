
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTQzMjcsImV4cCI6MjA4MjkzMDMyN30.cwGACRAp_aLaXKHrSVcZKHz0tX1zvvHb_xGHNHxJxu8';

const supabase = createClient(SUPABASE_URL, KEY);

async function fetchData() {
    console.log("--- Fetching Service 'terewt' ---");
    const { data: services, error: sErr } = await supabase
        .from('booking_items')
        .select('*')
        .eq('name', 'terewt');

    if (sErr) console.error(sErr);
    const service = services?.[0];
    console.log("Service:", service);

    console.log("\n--- Fetching Collaborator 'Davide Gentile' ---");
    const { data: collabs, error: cErr } = await supabase
        .from('collaborators')
        .select('*')
        .ilike('last_name', '%Gentile%');

    if (cErr) console.error(cErr);
    const collab = collabs?.find(c => c.first_name === 'Davide');
    console.log("Collaborator:", collab);

    if (collab) {
        console.log(`\n--- Availability Rules (ID: ${collab.id}) ---`);
        const { data: rules, error: rErr } = await supabase
            .from('availability_rules')
            .select('*')
            .eq('collaborator_id', collab.id);

        if (rErr) console.error(rErr);
        console.table(rules);

        console.log(`\n--- Availability Overrides (ID: ${collab.id}) ---`);
        const { data: overrides, error: oErr } = await supabase
            .from('availability_overrides')
            .select('*')
            .eq('collaborator_id', collab.id);

        if (oErr) console.error(oErr);
        console.table(overrides);
    }
}

fetchData();
