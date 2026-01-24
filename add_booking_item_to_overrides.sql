ALTER TABLE public.availability_overrides 
ADD COLUMN IF NOT EXISTS booking_item_id UUID REFERENCES public.booking_items(id) ON DELETE CASCADE;

-- Also allow service_id to be nullable (already is)
-- But we prefer booking_item_id now.

-- Update existing data if needed (unlikely)

NOTIFY pgrst, 'reload schema';
