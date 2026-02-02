ALTER TABLE public.pm_item_assignees 
ADD COLUMN IF NOT EXISTS collaborator_ref UUID REFERENCES public.collaborators(id) ON DELETE CASCADE;

-- Drop PK first because user_ref is part of it
ALTER TABLE public.pm_item_assignees DROP CONSTRAINT IF EXISTS pm_item_assignees_pkey;

-- Make user_ref nullable since we might assign by collaborator only
ALTER TABLE public.pm_item_assignees 
ALTER COLUMN user_ref DROP NOT NULL;

-- If 'id' doesn't exist (it didn't in original create script), add it?
-- The original script did NOT have an ID, just PK(pm_item_ref, user_ref).
-- Let's add a surrogate key for cleaner handling, or just rely on unique indexes.
-- Adding ID is safer for frontend frameworks usually.
ALTER TABLE public.pm_item_assignees 
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() PRIMARY KEY;

-- Add Unique constraint to prevent double assignment of same collab/user
CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_assignees_dedupe_collab 
ON public.pm_item_assignees(pm_item_ref, collaborator_ref) 
WHERE collaborator_ref IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_assignees_dedupe_user 
ON public.pm_item_assignees(pm_item_ref, user_ref) 
WHERE user_ref IS NOT NULL;

-- Update RLS for Visibility
-- Old: View allowed if item visible.
-- This is fine: "Assignees: View" policy checks EXISTS(item).

-- Update RLS for Manage
-- Only Admin/PM can manage. "Assignees: Manage" policy relies on item ownership. This remains valid.

-- Update Item Visibility Policy to include "I am the assigned Collaborator"
-- We need to update "Items: Collaborator visibility" and "Items: Collaborator update own".
DROP POLICY IF EXISTS "Items: Collaborator visibility" ON public.pm_items;
CREATE POLICY "Items: Collaborator visibility" ON public.pm_items
    FOR SELECT USING (
        -- Directly assigned via User Ref
        EXISTS (
            SELECT 1 FROM public.pm_item_assignees a 
            WHERE a.pm_item_ref = pm_items.id 
            AND a.user_ref = auth.uid()
        )
        OR
        -- Directly assigned via Collaborator Link
        EXISTS (
            SELECT 1 FROM public.pm_item_assignees a
            JOIN public.collaborators c ON c.id = a.collaborator_ref
            WHERE a.pm_item_ref = pm_items.id
            AND c.user_id = auth.uid()
        )
        OR
        -- Linked to their assignment (Legacy/Order lookup)
        EXISTS (
            SELECT 1 FROM public.pm_item_incarichi i
            JOIN public.assignments ass ON i.incarico_ref = ass.id
            JOIN public.collaborators c ON c.id = ass.collaborator_id
            WHERE i.pm_item_ref = pm_items.id
            AND c.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Items: Collaborator update own" ON public.pm_items;
CREATE POLICY "Items: Collaborator update own" ON public.pm_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.pm_item_assignees a 
            WHERE a.pm_item_ref = pm_items.id 
            AND (
                a.user_ref = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.collaborators c 
                    WHERE c.id = a.collaborator_ref 
                    AND c.user_id = auth.uid()
                )
            )
        )
    );
