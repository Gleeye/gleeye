
// Quick script to create system_config table via Supabase client
import { supabase } from './js/modules/config.js';

async function createSystemConfigTable() {
    console.log('Creating system_config table...');

    const sql = `
        CREATE TABLE IF NOT EXISTS system_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            description TEXT,
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            updated_by UUID REFERENCES auth.users(id)
        );

        ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Authenticated users can read system config" ON system_config;
        CREATE POLICY "Authenticated users can read system config"
            ON system_config
            FOR SELECT
            USING (auth.role() = 'authenticated');

        DROP POLICY IF EXISTS "Admin users can modify system config" ON system_config;
        CREATE POLICY "Admin users can modify system config"
            ON system_config
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'admin'
                )
            );

        INSERT INTO system_config (key, value, description, updated_at)
        VALUES 
            ('google_calendar', '{"client_id": "", "client_secret": ""}', 'Google Calendar Integration Configuration', NOW())
        ON CONFLICT (key) DO NOTHING;
    `;

    try {
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) {
            console.error('Error creating table:', error);
            // Try direct table creation
            const { error: createError } = await supabase
                .from('system_config')
                .select('*')
                .limit(1);

            if (createError && createError.code === '42P01') {
                console.error('Table does not exist. Please run the SQL manually in Supabase Studio.');
                console.log('SQL to run:', sql);
            }
        } else {
            console.log('Table created successfully!', data);
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

// Run it
createSystemConfigTable();
