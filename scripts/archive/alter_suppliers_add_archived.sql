ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Update existing to false
UPDATE public.suppliers SET archived = false WHERE archived IS NULL;
