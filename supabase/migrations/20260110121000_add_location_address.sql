ALTER TABLE public.booking_items 
ADD COLUMN IF NOT EXISTS location_address TEXT;
