-- Optimize RLS policies to prevent unnecessary checks during SELECT
BEGIN;

-- 1. pm_item_assignees
-- Drop "Manage" policy which applies to ALL (including SELECT)
DROP POLICY IF EXISTS "Assignees: Manage" ON public.pm_item_assignees;

-- Recreate "Manage" only for modifications (INSERT, UPDATE, DELETE)
-- This ensures SELECT uses the simpler "Assignees: View" policy
CREATE POLICY "Assignees: Manage" ON public.pm_item_assignees
    FOR INSERT WITH CHECK (
        public.is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.pm_items i 
            JOIN public.pm_spaces s ON s.id = i.space_ref
            WHERE i.id = pm_item_assignees.pm_item_ref
            AND s.default_pm_user_ref = auth.uid()
        )
    );

CREATE POLICY "Assignees: Update" ON public.pm_item_assignees
    FOR UPDATE USING (
        public.is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.pm_items i 
            JOIN public.pm_spaces s ON s.id = i.space_ref
            WHERE i.id = pm_item_assignees.pm_item_ref
            AND s.default_pm_user_ref = auth.uid()
        )
    );

CREATE POLICY "Assignees: Delete" ON public.pm_item_assignees
    FOR DELETE USING (
        public.is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.pm_items i 
            JOIN public.pm_spaces s ON s.id = i.space_ref
            WHERE i.id = pm_item_assignees.pm_item_ref
            AND s.default_pm_user_ref = auth.uid()
        )
    );

-- 2. pm_item_incarichi
-- Drop "Manage" policy
DROP POLICY IF EXISTS "Incarichi Link: Manage" ON public.pm_item_incarichi;

-- Recreate for modifications only
CREATE POLICY "Incarichi Link: Manage Insert" ON public.pm_item_incarichi
    FOR INSERT WITH CHECK (
        public.is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.pm_items i 
            JOIN public.pm_spaces s ON s.id = i.space_ref
            WHERE i.id = pm_item_incarichi.pm_item_ref
            AND s.default_pm_user_ref = auth.uid()
        )
    );

CREATE POLICY "Incarichi Link: Manage Delete" ON public.pm_item_incarichi
    FOR DELETE USING (
        public.is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.pm_items i 
            JOIN public.pm_spaces s ON s.id = i.space_ref
            WHERE i.id = pm_item_incarichi.pm_item_ref
            AND s.default_pm_user_ref = auth.uid()
        )
    );
-- No Update for incarichi link as it is a join table (mostly insert/delete)

COMMIT;
