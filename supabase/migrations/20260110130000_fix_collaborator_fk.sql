-- Migration to link booking_item_collaborators to public.collaborators
-- Originally it referenced profiles, but we want to use the existing collaborators table from the HR module.

-- 1. Drop existing FK if it exists (constraint name might vary, so we try standard naming or just drop by column)
ALTER TABLE public.booking_item_collaborators 
DROP CONSTRAINT IF EXISTS service_collaborators_collaborator_id_fkey; -- Try original name
ALTER TABLE public.booking_item_collaborators 
DROP CONSTRAINT IF EXISTS booking_item_collaborators_collaborator_id_fkey; -- Try new likely name

-- 2. Add new FK to public.collaborators
ALTER TABLE public.booking_item_collaborators
ADD CONSTRAINT booking_item_collaborators_collaborator_id_fkey
FOREIGN KEY (collaborator_id)
REFERENCES public.collaborators(id)
ON DELETE CASCADE;

-- 3. Also update booking_assignments just in case it was created with wrong FK
ALTER TABLE public.booking_assignments
DROP CONSTRAINT IF EXISTS booking_assignments_collaborator_id_fkey;

ALTER TABLE public.booking_assignments
ADD CONSTRAINT booking_assignments_collaborator_id_fkey
FOREIGN KEY (collaborator_id)
REFERENCES public.collaborators(id)
ON DELETE CASCADE;

-- 4. Ensure we have logic_type column in booking_items if not already (it should be there from previous migrations, but safe check)
-- ALTER TABLE public.booking_items ADD COLUMN IF NOT EXISTS logic_type service_logic_type DEFAULT 'OR';
-- ALTER TABLE public.booking_items ADD COLUMN IF NOT EXISTS team_size_req INTEGER DEFAULT 1;
