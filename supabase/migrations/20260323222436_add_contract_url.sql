-- Add contract_url to assignments
ALTER TABLE public.assignments 
ADD COLUMN IF NOT EXISTS contract_url TEXT;

-- Reload schema cache to ensure PostgREST sees the new column immediately
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
