
-- Insert or Update the Google Calendar configuration key
INSERT INTO system_config (key, value, description, updated_at)
VALUES (
    'google_calendar', 
    '{"client_id": "REPLACE_WITH_YOUR_CLIENT_ID", "client_secret": "REPLACE_WITH_YOUR_SECRET"}', 
    'Google Calendar Integration Configuration',
    NOW()
)
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value
WHERE system_config.value IS NULL OR system_config.value = '' OR system_config.value NOT LIKE '%client_id%';
