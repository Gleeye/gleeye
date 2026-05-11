
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTQzMjcsImV4cCI6MjA4MjkzMDMyN30.cwGACRAp_aLaXKHrSVcZKHz0tX1zvvHb_xGHNHxJxu8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkActiveClients() {
    const paymentIds = [
        'b76c06a9-0c7a-45ed-8e68-136d00fecffe', 
        '183b2849-3938-4a89-8e72-f01cd129fafe', 
        'eaebd53f-07d9-46a5-9cbf-6c8de2f095dc'
    ];
    
    for (const id of paymentIds) {
        const { data: p, error } = await supabase
            .from('payments')
            .select('id, title, client_id, clients(business_name, client_code)')
            .eq('id', id)
            .single();
        if (p) {
            console.log(`Payment: ${p.title} | Client ID: ${p.client_id} | Name: ${p.clients?.business_name} | Code: ${p.clients?.client_code}`);
        } else {
            console.log("Not found for ID:", id, error);
        }
    }
}

checkActiveClients();
