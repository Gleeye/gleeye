// apply_assignment_logic_migration.js
// Run this with: node apply_assignment_logic_migration.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://whpbetjyhpttinbxcffs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTQzMjcsImV4cCI6MjA4MjkzMDMyN30.cwGACRAp_aLaXKHrSVcZKHz0tX1zvvHb_xGHNHxJxu8';

const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'public' },
    auth: { persistSession: false }
});

async function applyMigration() {
    console.log("Applying assignment_logic migration...");

    // 1. Add assignment_logic column (text, not enum, for simplicity via RPC)
    //    Since we can't run raw DDL easily, we'll try RPC or just update via table API.
    //    BUT! We need the column to exist first. Let's check if it exists.

    // Supabase JS doesn't allow DDL. User must run the SQL manually via Dashboard.
    console.log("IMPORTANT: Please run the following SQL in Supabase Dashboard > SQL Editor:");
    console.log(`
    -- Add assignment_logic column if not exists
    ALTER TABLE booking_items 
    ADD COLUMN IF NOT EXISTS assignment_logic text DEFAULT 'OR';

    ALTER TABLE booking_items 
    ADD COLUMN IF NOT EXISTS required_team_size integer DEFAULT 1;
    `);

    // 2. Now let's update a specific service to 'AND' for testing
    const { data, error } = await supabase
        .from('booking_items')
        .select('id, name, assignment_logic, required_team_size')
        .order('name');

    if (error) {
        console.error("Error fetching booking_items:", error);
        return;
    }

    console.log("\nCurrent Booking Items:");
    data.forEach(item => {
        console.log(`- ${item.name} (${item.id}): assignment_logic=${item.assignment_logic || 'NULL'}, team_size=${item.required_team_size || 'NULL'}`);
    });

    // 3. Update the first one to AND for testing
    if (data.length > 0) {
        console.log(`\nUpdating "${data[0].name}" to assignment_logic='AND' for testing...`);
        const { error: updateError } = await supabase
            .from('booking_items')
            .update({ assignment_logic: 'AND' })
            .eq('id', data[0].id);

        if (updateError) {
            console.error("Update Error:", updateError);
        } else {
            console.log("Updated successfully! Reload the booking app to test.");
        }
    }
}

applyMigration();
