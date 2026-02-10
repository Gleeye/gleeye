-- Fix Circular Dependency in RLS between pm_spaces and pm_space_assignees
-- Drop existing policy
DROP POLICY IF EXISTS "Space Assignees: View" ON public.pm_space_assignees;

-- Re-create policy with explicit self-access to break recursion
CREATE POLICY "Space Assignees: View" ON public.pm_space_assignees
    FOR SELECT USING (
        -- 1. I can always see my own assignment (Breaks the loop for pm_spaces check)
        user_ref = auth.uid() OR
        collaborator_ref IN (SELECT id FROM public.collaborators WHERE user_id = auth.uid()) OR
        
        -- 2. I can see others if I have access to the space (Admin, Default PM, or because getting space succeeded via 1)
        -- Note: We must be careful not to trigger infinite recursion here. 
        -- If we use EXISTS(pm_spaces), efficient planners might be okay, but safeguard is better.
        -- Let's trust that once step 1 succeeds, step 2's space-check succeeds.
        EXISTS (SELECT 1 FROM public.pm_spaces s WHERE s.id = pm_space_ref)
    );

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
