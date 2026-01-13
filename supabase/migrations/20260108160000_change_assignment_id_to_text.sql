-- Migration: Change assignments.id from UUID to TEXT

-- 1. Drop FK constraints
ALTER TABLE IF EXISTS public.collaborator_services 
  DROP CONSTRAINT IF EXISTS collaborator_services_assignment_id_fkey;

ALTER TABLE IF EXISTS public.payments 
  DROP CONSTRAINT IF EXISTS payments_assignment_id_fkey;

-- 2. Modify assignments.id
-- We need to convert existing UUIDs to text first if there is data, which is automatic for uuid->text
ALTER TABLE public.assignments ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.assignments ALTER COLUMN id TYPE TEXT;

-- 3. Modify referencing columns
ALTER TABLE public.collaborator_services ALTER COLUMN assignment_id TYPE TEXT;

-- Check if payments table exists before altering
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'assignment_id') THEN
        ALTER TABLE public.payments ALTER COLUMN assignment_id TYPE TEXT;
    END IF;
END $$;

-- 4. Restore constraints
ALTER TABLE public.collaborator_services 
  ADD CONSTRAINT collaborator_services_assignment_id_fkey 
  FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE SET NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'assignment_id') THEN
        ALTER TABLE public.payments 
          ADD CONSTRAINT payments_assignment_id_fkey 
          FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE SET NULL;
    END IF;
END $$;
