-- Migration to allow Partners and Amministrazione users to view all PM activities and items
-- even if they are not explicitly assigned to the order or space.

-- 1. Helper function to identify privileged users (Partners/Amministrazione)
CREATE OR REPLACE FUNCTION public.is_privileged_user(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Returns true if the user is an admin or has privileged tags in their collaborator record
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_uuid AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.collaborators
    WHERE user_id = user_uuid 
    AND (tags ILIKE '%Partner%' OR tags ILIKE '%Amministrazione%')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update pm_activity_logs RLS
-- Add a new policy specifically for privileged users
DROP POLICY IF EXISTS "Activity Logs: Privileged access" ON public.pm_activity_logs;
CREATE POLICY "Activity Logs: Privileged access" ON public.pm_activity_logs
    FOR SELECT USING (public.is_privileged_user(auth.uid()));

-- 3. Update pm_items RLS
-- Add a new policy for privileged users to view and update PM items
DROP POLICY IF EXISTS "Items: Privileged access" ON public.pm_items;
CREATE POLICY "Items: Privileged access" ON public.pm_items
    FOR ALL USING (public.is_privileged_user(auth.uid()));

-- 4. Update pm_spaces RLS
-- Ensure they have full access to spaces as well
DROP POLICY IF EXISTS "Spaces: Privileged access" ON public.pm_spaces;
CREATE POLICY "Spaces: Privileged access" ON public.pm_spaces
    FOR ALL USING (public.is_privileged_user(auth.uid()));

-- 5. Update pm_item_comments RLS
DROP POLICY IF EXISTS "Comments: Privileged access" ON public.pm_item_comments;
CREATE POLICY "Comments: Privileged access" ON public.pm_item_comments
    FOR ALL USING (public.is_privileged_user(auth.uid()));

-- 6. Update pm_item_assignees RLS
DROP POLICY IF EXISTS "Assignees: Privileged access" ON public.pm_item_assignees;
CREATE POLICY "Assignees: Privileged access" ON public.pm_item_assignees
    FOR ALL USING (public.is_privileged_user(auth.uid()));

-- 7. Update pm_item_incarichi RLS
DROP POLICY IF EXISTS "Incarichi Link: Privileged access" ON public.pm_item_incarichi;
CREATE POLICY "Incarichi Link: Privileged access" ON public.pm_item_incarichi
    FOR ALL USING (public.is_privileged_user(auth.uid()));

-- 8. Also check for appointments if relevant
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Appointments: Privileged access" ON public.appointments;
        EXECUTE 'CREATE POLICY "Appointments: Privileged access" ON public.appointments FOR ALL USING (public.is_privileged_user(auth.uid()))';
    END IF;
END $$;
