
import { supabase } from './js/modules/config.js';

async function checkConfig() {
    console.log('Checking system_config...');
    const { data, error } = await supabase
        .from('system_config')
        .select('*');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Config Data:', JSON.stringify(data, null, 2));
    }
}

checkConfig();
