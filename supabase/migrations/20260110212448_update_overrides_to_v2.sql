-- Add end_date column
ALTER TABLE public.availability_overrides 
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Reload Schema Cache for PostgREST
NOTIFY pgrst, 'reload schema';
