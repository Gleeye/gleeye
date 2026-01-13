
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTQzMjcsImV4cCI6MjA4MjkzMDMyN30.cwGACRAp_aLaXKHrSVcZKHz0tX1zvvHb_xGHNHxJxu8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectServiceConfig() {
    console.log("--- CONFIG SERVIZI E COLLABORATORI ---");

    // Get all booking items
    const { data: items } = await supabase.from('booking_items').select('id, name, assignment_logic');

    for (const item of items || []) {
        console.log(`\nServizio: ${item.name} (Logic: ${item.assignment_logic || 'OR'})`);

        // Get linked collaborators
        const { data: links } = await supabase
            .from('booking_item_collaborators')
            .select('collaborator_id, collaborators(id, full_name)')
            .eq('booking_item_id', item.id);

        if (links && links.length > 0) {
            links.forEach(l => {
                console.log(`  - ${l.collaborators?.full_name || 'N/A'} (${l.collaborator_id})`);
            });
        } else {
            console.log("  ❌ NESSUN COLLABORATORE ASSEGNATO A QUESTO SERVIZIO!");
        }
    }
}

inspectServiceConfig();
