
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTQzMjcsImV4cCI6MjA4MjkzMDMyN30.cwGACRAp_aLaXKHrSVcZKHz0tX1zvvHb_xGHNHxJxu8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkRemoteSchema() {
    console.log("Checking columns in 'orders'...");

    // 1. Check 'status_works'
    try {
        const { error } = await supabase.from('orders').select('status_works').limit(1);
        if (error) console.log("status_works error:", error.message);
        else console.log("status_works column EXISTS.");
    } catch (e) { console.log(e); }

    // 2. Check 'status'
    try {
        const { error } = await supabase.from('orders').select('status').limit(1);
        if (error) console.log("status error:", error.message);
        else console.log("status column EXISTS.");
    } catch (e) { console.log(e); }

    // 3. Check 'price_final' and 'cost_final'
    try {
        const { error } = await supabase.from('orders').select('price_final, cost_final').limit(1);
        if (error) console.log("Economics columns error:", error.message);
        else console.log("price_final and cost_final columns EXIST.");
    } catch (e) { console.log(e); }
}

checkRemoteSchema();
