
import { supabase } from './modules/config.js?v=157';

const BAD_ORDER_NUMBERS = [
    '23-0075', '23-0076', '24-CVS', '24-0005', '24-0020',
    '24-0022', '24-0023', '24-0024', '24-0025', '24-0006',
    '24-0031', '24-0032', '24-0021', '25-0005', '25-0006',
    '25-0009', '25-0012', '25-0014', '25-0016', '25-0017',
    '25-0018', '25-0019', '25-0020', '25-0021', '25-0023',
    '25-0024', '25-0027', '25-0028'
];

export async function runOneTimeFix() {
    console.log("--- RUNNING ONE-TIME DATA FIX ---");

    // Check if we already ran it this session or persistent?
    // Let's just run it. It's idempotent (setting null to null is fine).

    // console.log("--- RUNNING ONE-TIME DATA FIX ---");
    // Auto-run without confirm as per user request to "fix it"

    // Show toast
    // if (window.showGlobalAlert) window.showGlobalAlert('Correzione dati in corso...', 'info');

    let fixedCount = 0;

    for (const num of BAD_ORDER_NUMBERS) {
        // Find ID first (needed for secure update usually, but can update by numbering if policy allows)
        // Let's rely on filter
        const { error } = await supabase
            .from('orders')
            .update({
                payment_mode: null,
                deposit_percentage: 0,
                balance_percentage: 0,
                installments_count: 0
            })
            .eq('order_number', num);

        if (!error) {
            fixedCount++;
            console.log(`Fixed order ${num}`);
        } else {
            console.error(`Failed to fix ${num}`, error);
        }
    }

    if (fixedCount > 0) {
        if (window.showGlobalAlert) window.showGlobalAlert(`Corretti ${fixedCount} ordini.`, 'success');
        console.log(`Fix completed: ${fixedCount} orders updated.`);
        // Optional: refresh current view if needed
        if (window.location.hash.includes('order-detail')) {
            // trigger reload? simpler to just let user see it on next nav or reload
        }
    }
}

// Expose to window for manual run if needed
window.fixPhantomData = runOneTimeFix;
