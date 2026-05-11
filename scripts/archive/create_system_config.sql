-- Quick SQL to create system_config table
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated users can read system config"
    ON system_config
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Admin users can modify system config"
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
    ('google_client_id', '', 'Google OAuth Client ID for Calendar API', NOW()),
    ('google_client_secret', '', 'Google OAuth Client Secret for Calendar API', NOW())
ON CONFLICT (key) DO NOTHING;
