CREATE OR REPLACE FUNCTION public.has_space_view_access(space_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Check Admin
    IF EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND role = 'admin') THEN RETURN TRUE; END IF;

    -- 2. Check Space Access
    RETURN EXISTS (
        SELECT 1
        FROM pm_spaces s
        LEFT JOIN pm_space_assignees psa ON s.id = psa.pm_space_ref AND (psa.user_ref = user_id OR psa.collaborator_ref IN (SELECT id FROM collaborators WHERE user_id = user_id))
        LEFT JOIN assignments ass ON s.ref_ordine = ass.order_id AND ass.collaborator_id IN (SELECT id FROM collaborators WHERE user_id = user_id)
        WHERE s.id = space_id
        AND (
            s.default_pm_user_ref = user_id
            OR psa.id IS NOT NULL
            OR (s.type = 'commessa' AND ass.id IS NOT NULL)
        )
    );
END;
$$;

-- Apply policies
DROP POLICY IF EXISTS "Spaces: Admin access" ON public.pm_spaces;
DROP POLICY IF EXISTS "Spaces: PM access" ON public.pm_spaces;
DROP POLICY IF EXISTS "Spaces: Collaborator access (assigned to order)" ON public.pm_spaces;
DROP POLICY IF EXISTS "Spaces: Assignee access" ON public.pm_spaces;


DROP POLICY IF EXISTS "Items: Admin access" ON public.pm_items;
DROP POLICY IF EXISTS "Items: Space PM access" ON public.pm_items;
DROP POLICY IF EXISTS "Items: Collaborator visibility" ON public.pm_items;
DROP POLICY IF EXISTS "Items: Space Assignee access" ON public.pm_items;

DROP POLICY IF EXISTS "Space Assignees: View" ON public.pm_space_assignees;
DROP POLICY IF EXISTS "Space Assignees: View Access" ON public.pm_space_assignees;

CREATE POLICY "Spaces: View Access" ON public.pm_spaces FOR SELECT USING (public.has_space_view_access(id, auth.uid()));
CREATE POLICY "Items: View Access" ON public.pm_items FOR SELECT USING (public.has_space_view_access(space_ref, auth.uid()));
CREATE POLICY "Space Assignees: View Access" ON public.pm_space_assignees FOR SELECT USING (public.has_space_view_access(pm_space_ref, auth.uid()));

NOTIFY pgrst, 'reload schema';

