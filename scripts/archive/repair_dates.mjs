
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTQzMjcsImV4cCI6MjA4MjkzMDMyN30.cwGACRAp_aLaXKHrSVcZKHz0tX1zvvHb_xGHNHxJxu8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function repairDates() {
    const orderId = '5dabc420-2a41-4a1b-ad8a-07f5fcc332f3'; // 25-0021
    const { data: payments } = await supabase
        .from('payments')
        .select('id, title, collaborators(full_name)')
        .eq('order_id', orderId);

    console.log(`Processing ${payments.length} payments...`);

    for (const p of payments) {
        let dueDate = null;
        const title = p.title || '';
        const collabName = p.collaborators?.full_name || '';

        // 1. Check for explicit date in title "Uscita D/M"
        const dateMatch = title.match(/Uscita (\d{1,2})\/(\d{1,2})/);
        if (dateMatch) {
            const day = parseInt(dateMatch[1]);
            const month = parseInt(dateMatch[2]);
            const year = (month >= 9) ? 2025 : 2026; 
            dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        } 
        // 2. Check for Paolo's installments
        else if (collabName === 'Paolo Bellini' && title.includes('Gennaio')) {
            dueDate = '2026-01-31';
        } else if (collabName === 'Paolo Bellini' && title.includes('Febbraio')) {
            dueDate = '2026-02-28';
        }

        if (dueDate) {
            console.log(`Updating ${title} (${collabName}) -> ${dueDate}`);
            await supabase.from('payments').update({ due_date: dueDate }).eq('id', p.id);
        }
    }
    console.log("Repair finished.");
}

repairDates();
