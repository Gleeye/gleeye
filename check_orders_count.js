
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://127.0.0.1:54321';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkOrders() {
    console.log("Checking Orders Count...");
    const { count, error } = await supabase.from('orders').select('*', { count: 'exact', head: true });

    if (error) console.error("Count Error:", error);
    else console.log("Total Orders in DB:", count);

    // List first 5 orders to see dates/ids
    const { data: sample } = await supabase.from('orders').select('id, created_at, order_number').limit(5);
    console.log("Sample Orders:", sample);

    // Check RLS policies via SQL (needs direct connection or rpc if available, assume none for now, rely on observation)
    // Actually, I can't check pg_policies via supabase-js without an RPC or direct connection.
    // I'll rely on the count. If Count is high (via service role), but I see 1 (via client), it's RLS.
}

checkOrders();
