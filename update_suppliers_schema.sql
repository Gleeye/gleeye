-- Add website column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'website') THEN
        ALTER TABLE public.suppliers ADD COLUMN website TEXT;
    END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists to avoid conflicts (or create if not exists)
DROP POLICY IF EXISTS "Admin can do everything on suppliers" ON public.suppliers;

CREATE POLICY "Admin can do everything on suppliers" 
ON public.suppliers FOR ALL 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- Grant access to authenticated users to read (optional, depending on requirements, but safe for 'Admin can do everything' encompasses 'admin' role checks)
-- But usually we want permissive read for dropdowns?
-- Let's stick to admin only for now as per previous pattern.
