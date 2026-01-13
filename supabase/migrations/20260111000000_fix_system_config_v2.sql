-- Force fix system_config table
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

-- Public Access for debugging
CREATE POLICY "Public read config" ON system_config FOR SELECT USING (true);
CREATE POLICY "Public write config" ON system_config FOR ALL USING (true);

-- Insert default placeholders
INSERT INTO system_config (key, value, description, updated_at)
VALUES 
    ('google_client_id', '', 'Google OAuth Client ID for Calendar API', NOW()),
    ('google_client_secret', '', 'Google OAuth Client Secret for Calendar API', NOW())
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);
