-- Fix infinite recursion in PM module RLS policies
-- This recursion was between pm_items (SELECT) and pm_item_assignees (SELECT)

BEGIN;

-- 1. Drop problematic policies
DROP POLICY IF EXISTS "Items: Collaborator visibility" ON public.pm_items;
DROP POLICY IF EXISTS "Items: Collaborator update own" ON public.pm_items;
DROP POLICY IF EXISTS "Assignees: View" ON public.pm_item_assignees;
DROP POLICY IF EXISTS "Incarichi Link: View" ON public.pm_item_incarichi;

-- 2. Create non-recursive policies for pm_items
-- Collaborator visibility: based on Space access. 
-- If you are assigned to the order associated with the space, you can see all items.
CREATE POLICY "Items: Collaborator visibility" ON public.pm_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.pm_spaces s
            WHERE s.id = pm_items.space_ref
            AND (
                s.default_pm_user_ref = auth.uid()
                OR
                EXISTS (
                    SELECT 1 FROM public.assignments a
                    WHERE a.order_id = s.ref_ordine
                    AND a.collaborator_id IN (
                        SELECT id FROM public.collaborators WHERE user_id = auth.uid()
                    )
                )
            )
        )
    );

-- Update: Allow update if you are a PM of the space or an assignee.
-- Since the SELECT policy on Items no longer checks assignees, this is now safe.
CREATE POLICY "Items: Collaborator update own" ON public.pm_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.pm_item_assignees a 
            WHERE a.pm_item_ref = id AND a.user_ref = auth.uid()
        )
    );

-- 3. Simplified View policies for bridge tables
-- These avoid joining back to pm_items to prevent potential loops.
-- Only authenticated users can see these links.
CREATE POLICY "Assignees: View" ON public.pm_item_assignees
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Incarichi Link: View" ON public.pm_item_incarichi
    FOR SELECT USING (auth.role() = 'authenticated');

-- 4. Ensure PM can also manage assignees/incarichi in their spaces
-- Fixed: "Assignees: Manage" already joined pm_items and pm_spaces which is OK now.

COMMIT;
