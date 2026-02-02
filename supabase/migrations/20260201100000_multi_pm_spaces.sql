-- Create PM Space Assignees table to allow multiple PMs/Assignees at Space level
CREATE TABLE IF NOT EXISTS public.pm_space_assignees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pm_space_ref UUID REFERENCES public.pm_spaces(id) ON DELETE CASCADE NOT NULL,
    user_ref UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    collaborator_ref UUID REFERENCES public.collaborators(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'pm', -- 'pm' is the default here
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- De-dupe
    UNIQUE(pm_space_ref, user_ref),
    UNIQUE(pm_space_ref, collaborator_ref)
);

-- Enable RLS
ALTER TABLE public.pm_space_assignees ENABLE ROW LEVEL SECURITY;

-- Policies: View allowed if you can see the space
DROP POLICY IF EXISTS "Space Assignees: View" ON public.pm_space_assignees;
CREATE POLICY "Space Assignees: View" ON public.pm_space_assignees
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.pm_spaces s WHERE s.id = pm_space_ref)
    );

-- Manage: Admin or space default PM
DROP POLICY IF EXISTS "Space Assignees: Manage" ON public.pm_space_assignees;
CREATE POLICY "Space Assignees: Manage" ON public.pm_space_assignees
    FOR ALL USING (
        public.is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.pm_spaces s 
            WHERE s.id = pm_space_assignees.pm_space_ref 
            AND s.default_pm_user_ref = auth.uid()
        )
    );

-- Update PM Spaces default_pm logic: 
-- We keep default_pm_user_ref as the "Primary" PM for now to avoid breaking existing logic,
-- but the UI will show all from pm_space_assignees.
