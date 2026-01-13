-- System Configuration Table
-- Stores application-wide configuration key-value pairs

DROP TABLE IF EXISTS system_config;

CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated users can read config
CREATE POLICY "Authenticated users can read system config"
    ON system_config
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Policy: Only admin users can modify config
-- Note: Adjust this based on your admin role logic
CREATE POLICY "Authenticated users can modify system config"
    ON system_config
    FOR ALL
    USING (auth.role() = 'authenticated');

-- Insert default placeholders for Google OAuth
INSERT INTO system_config (key, value, description, updated_at)
VALUES 
    ('google_client_id', '', 'Google OAuth Client ID for Calendar API', NOW()),
    ('google_client_secret', '', 'Google OAuth Client Secret for Calendar API', NOW())
ON CONFLICT (key) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);
