-- 1. Ensure columns exist
ALTER TABLE public.availability_overrides 
ADD COLUMN IF NOT EXISTS end_date DATE;

-- 2. Rename 'date' to 'start_date' for clarity if needed, 
-- but let's keep 'date' as the primary and add 'end_date' optionally.
-- If end_date is NULL, it's a single day.

-- 3. FORCE PostgREST cache reload
NOTIFY pgrst, 'reload schema';
