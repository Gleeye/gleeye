-- Add support for is_on_call and multiple services in overrides
ALTER TABLE public.availability_overrides 
ADD COLUMN IF NOT EXISTS is_on_call BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS service_ids UUID[] DEFAULT NULL;

-- Reload schema
NOTIFY pgrst, 'reload schema';
