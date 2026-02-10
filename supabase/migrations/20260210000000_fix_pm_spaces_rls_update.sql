-- Fix RLS for PM Spaces to allow updates (e.g. cloud_links)

-- Ensure RLS is enabled
ALTER TABLE public.pm_spaces ENABLE ROW LEVEL SECURITY;

-- Policy for UPDATE
-- Allows Default PM, Assigned PMs, and Admins to update spaces
CREATE POLICY "Spaces: Update Access" ON public.pm_spaces
    FOR UPDATE USING (
        -- 1. Default PM (Owner)
        auth.uid() = default_pm_user_ref 
        OR
        -- 2. Assigned PM (Secondary)
        EXISTS (
            SELECT 1 FROM public.pm_space_assignees sa
            WHERE sa.pm_space_ref = id
            AND sa.role = 'pm'
            AND (
                sa.user_ref = auth.uid() 
                OR 
                sa.collaborator_ref IN (SELECT id FROM public.collaborators WHERE user_id = auth.uid())
            )
        ) 
        OR
        -- 3. Admins
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy for INSERT
-- Allows authenticated users to create spaces (needed for lazy creation)
CREATE POLICY "Spaces: Create Access" ON public.pm_spaces
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
    );
