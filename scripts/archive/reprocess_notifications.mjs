// Script to reprocess queued notifications
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://whpbetjyhpttinbxcffs.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY not set');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function reprocessQueuedNotifications() {
    // 1. Fetch all queued notifications
    const { data: queued, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('email_status', 'queued')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching notifications:', error);
        return;
    }

    console.log(`Found ${queued?.length || 0} queued notifications`);

    if (!queued || queued.length === 0) {
        console.log('No queued notifications to process');
        return;
    }

    // 2. Call Edge Function for each
    for (const notif of queued) {
        console.log(`Processing: ${notif.id} (${notif.type})`);

        try {
            const { data, error: invokeError } = await supabase.functions.invoke('process-notification', {
                body: { record: notif }
            });

            if (invokeError) {
                console.error(`  Error: ${invokeError.message}`);
            } else {
                console.log(`  Success:`, data);
            }
        } catch (e) {
            console.error(`  Exception:`, e.message);
        }
    }

    console.log('Done!');
}

reprocessQueuedNotifications();
