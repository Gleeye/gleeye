-- Fix Infinite Recursion in RLS by using a SECURITY DEFINER function
-- This function bypasses RLS to check permissions, breaking the pm_spaces <-> pm_space_assignees loop.

CREATE OR REPLACE FUNCTION public.has_space_view_access(_space_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_collab_id UUID;
BEGIN
    -- 1. Check Admin
    SELECT (role = 'admin') INTO v_is_admin FROM profiles WHERE id = _user_id;
    IF v_is_admin THEN RETURN TRUE; END IF;

    -- Get Collaborator ID for this user (cached for subsequent checks)
    SELECT id INTO v_collab_id FROM collaborators WHERE user_id = _user_id LIMIT 1;

    -- 2. Check Space Access (Direct PM, Assignee, or Order Assignment)
    -- We query pm_spaces and join related tables.
    -- Since this is SECURITY DEFINER, it bypasses RLS on these tables.
    RETURN EXISTS (
        SELECT 1 
        FROM pm_spaces s
        LEFT JOIN pm_space_assignees psa ON s.id = psa.pm_space_ref
        LEFT JOIN assignments ass ON s.ref_ordine = ass.order_id
        WHERE s.id = _space_id
        AND (
            -- A. Default PM
            s.default_pm_user_ref = _user_id
            OR
            -- B. Space Assignee (User)
            psa.user_ref = _user_id
            OR
            -- C. Space Assignee (Collaborator)
            (v_collab_id IS NOT NULL AND psa.collaborator_ref = v_collab_id)
            OR
            -- D. Order Assignment (for Commesse)
            (s.type = 'commessa' AND v_collab_id IS NOT NULL AND ass.collaborator_id = v_collab_id)
        )
    );
END;
$$;

-- Apply to pm_spaces
DROP POLICY IF EXISTS "Spaces: Admin access" ON public.pm_spaces;
DROP POLICY IF EXISTS "Spaces: PM access" ON public.pm_spaces;
DROP POLICY IF EXISTS "Spaces: Collaborator access (assigned to order)" ON public.pm_spaces;
DROP POLICY IF EXISTS "Spaces: Assignee access" ON public.pm_spaces;

CREATE POLICY "Spaces: View Access" ON public.pm_spaces
    FOR SELECT USING (
        public.has_space_view_access(id, auth.uid())
    );

-- Apply to pm_items
DROP POLICY IF EXISTS "Items: Admin access" ON public.pm_items;
DROP POLICY IF EXISTS "Items: Space PM access" ON public.pm_items;
DROP POLICY IF EXISTS "Items: Collaborator visibility" ON public.pm_items;
DROP POLICY IF EXISTS "Items: Space Assignee access" ON public.pm_items;

CREATE POLICY "Items: View Access" ON public.pm_items
    FOR SELECT USING (
        public.has_space_view_access(space_ref, auth.uid())
    );

-- Also need Update policy for Items? "Items: Collaborator update own" exists.
-- Let's ensure PMs/Assignees can manage items or at least view them.
-- The above is SELECT.
-- Reset PM Items generic "All" policies from previous steps if any.

-- Apply to pm_space_assignees
DROP POLICY IF EXISTS "Space Assignees: View" ON public.pm_space_assignees;

CREATE POLICY "Space Assignees: View Access" ON public.pm_space_assignees
    FOR SELECT USING (
        public.has_space_view_access(pm_space_ref, auth.uid())
    );

-- Force cache reload
NOTIFY pgrst, 'reload schema';
