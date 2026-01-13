-- 1. Create system_config table
CREATE TABLE IF NOT EXISTS public.system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- 2. Enable RLS
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies (Public Access for read/write to avoid blockers)
DROP POLICY IF EXISTS "Public read config" ON public.system_config;
CREATE POLICY "Public read config" ON public.system_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public write config" ON public.system_config;
CREATE POLICY "Public write config" ON public.system_config FOR ALL USING (true);

-- 4. Inject Google Credentials
INSERT INTO public.system_config (key, value, description, updated_at)
VALUES 
    ('google_client_id', 'YOUR_GOOGLE_CLIENT_ID', 'Google OAuth Client ID', NOW()),
    ('google_client_secret', 'YOUR_GOOGLE_CLIENT_SECRET', 'Google OAuth Client Secret', NOW())
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, updated_at = NOW();

-- 5. Force schema reload (might not work in SQL Editor but harmless)
NOTIFY pgrst, 'reload schema';

-- 6. Create collaborator_google_auth table
CREATE TABLE IF NOT EXISTS public.collaborator_google_auth (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collaborator_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    selected_calendars JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(collaborator_id)
);

-- Add RLS (Simplified for debug phase)
ALTER TABLE public.collaborator_google_auth ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access auth" ON public.collaborator_google_auth;
CREATE POLICY "Public access auth" ON public.collaborator_google_auth FOR ALL USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_collaborator_google_auth_updated_at ON public.collaborator_google_auth;
CREATE TRIGGER set_collaborator_google_auth_updated_at
    BEFORE UPDATE ON public.collaborator_google_auth
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
