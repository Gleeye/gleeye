-- Create collaborator_google_auth table
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

-- Add RLS policies
ALTER TABLE public.collaborator_google_auth ENABLE ROW LEVEL SECURITY;

-- Admin/Service Role can do everything (simplified for this internal table)
DROP POLICY IF EXISTS "Collaborators can view their own google auth" ON public.collaborator_google_auth;
DROP POLICY IF EXISTS "Collaborators can update their own google auth" ON public.collaborator_google_auth;
DROP POLICY IF EXISTS "Collaborators can insert their own google auth" ON public.collaborator_google_auth;
DROP POLICY IF EXISTS "Collaborators can delete their own google auth" ON public.collaborator_google_auth;

CREATE POLICY "Allow all for authenticated users" 
    ON public.collaborator_google_auth FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- Define updated_at handler
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS set_collaborator_google_auth_updated_at ON public.collaborator_google_auth;
CREATE TRIGGER set_collaborator_google_auth_updated_at
    BEFORE UPDATE ON public.collaborator_google_auth
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
