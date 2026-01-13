
import { createClient } from '@supabase/supabase-js';
import { config } from './js/modules/config.js';

const supabase = createClient(config.supabaseUrl, config.supabaseKey);

async function debugOrder() {
    const { data: orders, error } = await supabase
        .from('orders')
        .select(`
            id,
            order_number,
            account_id,
            contact_id,
            account:collaborators!account_id (full_name),
            contacts (full_name)
        `)
        .limit(5);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Orders Sample:", JSON.stringify(orders, null, 2));
    }
}

debugOrder();
