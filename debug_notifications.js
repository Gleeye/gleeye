
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTQzMjcsImV4cCI6MjA4MjkzMDMyN30.cwGACRAp_aLaXKHrSVcZKHz0tX1zvvHb_xGHNHxJxu8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectLastBookings() {
    console.log("--- ULTIME PRENOTAZIONI ---");
    const { data: bookings } = await supabase
        .from('bookings')
        .select('id, created_at, guest_info')
        .order('created_at', { ascending: false })
        .limit(5);

    for (const b of bookings || []) {
        const { data: assigns } = await supabase
            .from('booking_assignments')
            .select('collaborator_id')
            .eq('booking_id', b.id);

        console.log(`Prenotazione: ${b.id}`);
        console.log(`  - Creata: ${b.created_at}`);
        console.log(`  - Ospite: ${b.guest_info?.first_name} ${b.guest_info?.last_name}`);
        console.log(`  - Assegnazioni trovate: ${assigns?.length || 0}`);
        if (assigns && assigns.length > 0) {
            assigns.forEach(a => console.log(`    - Collaboratore ID: ${a.collaborator_id}`));
        }
        console.log("----------------------------");
    }
}

inspectLastBookings();
