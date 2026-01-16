-- Fix availability_rules service_id foreign key
-- The FK currently points to services(id) but should point to booking_items(id)

-- 1. Drop the incorrect foreign key constraint
ALTER TABLE public.availability_rules
DROP CONSTRAINT IF EXISTS availability_rules_service_id_fkey;

-- 2. Add the correct foreign key to booking_items
ALTER TABLE public.availability_rules
ADD CONSTRAINT availability_rules_service_id_fkey
FOREIGN KEY (service_id) REFERENCES public.booking_items(id) ON DELETE SET NULL;

-- Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
