-- Manually inject user credentials and force permissions
INSERT INTO public.system_config (key, value, description, updated_at)
VALUES 
    ('google_client_id', 'YOUR_GOOGLE_CLIENT_ID', 'Google OAuth Client ID', NOW()),
    ('google_client_secret', 'YOUR_GOOGLE_CLIENT_SECRET', 'Google OAuth Client Secret', NOW())
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, updated_at = NOW();

-- Explicitly grant permissions again just in case
GRANT ALL ON TABLE public.system_config TO postgres, anon, authenticated, service_role;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
