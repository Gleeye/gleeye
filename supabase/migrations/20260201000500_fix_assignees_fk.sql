-- Force PostgREST to reload its schema cache
-- This is needed after structural changes to foreign keys/primary keys
NOTIFY pgrst, 'reload schema';

-- Recreate user_ref FK explicitly to ensure it's recognized
-- (The DROP CONSTRAINT might have affected the FK discovery)
-- First check if the FK exists and recreate if needed
DO $$
BEGIN
    -- Add FK for user_ref if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'pm_item_assignees_user_ref_fkey' 
        AND table_name = 'pm_item_assignees'
    ) THEN
        ALTER TABLE public.pm_item_assignees 
        ADD CONSTRAINT pm_item_assignees_user_ref_fkey 
        FOREIGN KEY (user_ref) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add FK for collaborator_ref if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'pm_item_assignees_collaborator_ref_fkey' 
        AND table_name = 'pm_item_assignees'
    ) THEN
        ALTER TABLE public.pm_item_assignees 
        ADD CONSTRAINT pm_item_assignees_collaborator_ref_fkey 
        FOREIGN KEY (collaborator_ref) REFERENCES public.collaborators(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Reload schema cache again after FK changes
NOTIFY pgrst, 'reload schema';
