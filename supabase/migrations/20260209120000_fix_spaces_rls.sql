-- Fix RLS for PM Spaces to allow secondary PMs/Assignees to view them
-- User reported that secondary PMs cannot see the cluster/space

-- 1. Update pm_spaces policy
CREATE POLICY "Spaces: Assignee access" ON public.pm_spaces
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.pm_space_assignees a
            WHERE a.pm_space_ref = id
            AND (
                a.user_ref = auth.uid() OR
                a.collaborator_ref IN (SELECT id FROM public.collaborators WHERE user_id = auth.uid())
            )
        )
    );

-- 2. Update pm_items policy (Allow Space Assignees/PMs to view all items in the space)
-- Currently only the Default PM sees everything. We want all Space Assignees to see items in that space.
CREATE POLICY "Items: Space Assignee access" ON public.pm_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.pm_space_assignees a
            WHERE a.pm_space_ref = space_ref
            AND (
                a.user_ref = auth.uid() OR
                a.collaborator_ref IN (SELECT id FROM public.collaborators WHERE user_id = auth.uid())
            )
        )
    );

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
