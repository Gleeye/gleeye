
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTQzMjcsImV4cCI6MjA4MjkzMDMyN30.cwGACRAp_aLaXKHrSVcZKHz0tX1zvvHb_xGHNHxJxu8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
    console.log("Fetching a collaborator...");
    const { data: collabs } = await supabase.from('collaborators').select('id').limit(1);
    const collabId = collabs?.[0]?.id;
    console.log("Collaborator ID:", collabId);

    if (!collabId) {
        console.error("No collaborators found.");
        return;
    }

    console.log("Testing complex query...");
    const { data, error } = await supabase
        .from('bookings')
        .select(`
            *,
            booking_items ( name, duration_minutes ),
            booking_assignments!inner ( collaborator_id )
        `)
        .eq('booking_assignments.collaborator_id', collabId)
        .limit(5);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Success! Rows found:", data.length);
        console.log(JSON.stringify(data?.[0], null, 2));
    }
}

test();
