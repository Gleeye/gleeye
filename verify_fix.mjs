
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTQzMjcsImV4cCI6MjA4MjkzMDMyN30.cwGACRAp_aLaXKHrSVcZKHz0tX1zvvHb_xGHNHxJxu8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifyFix() {
    console.log("Checking Mattia, Gabriele, and Sara...");
    const { data: payments } = await supabase
        .from('payments')
        .select('id, title, status, passive_invoice_id, collaborators(full_name)')
        .limit(1000);

    const names = ['Mattia Montano', 'Gabriele Picone', 'Sara Verterano'];
    const results = payments.filter(p => p.collaborators && names.includes(p.collaborators.full_name));

    console.log(JSON.stringify(results, null, 2));
}

verifyFix();
