ALTER TABLE public.booking_items 
ADD COLUMN IF NOT EXISTS location_type TEXT DEFAULT 'in_person', --Values: 'in_person', 'remote'
ADD COLUMN IF NOT EXISTS payment_required BOOLEAN DEFAULT false;
