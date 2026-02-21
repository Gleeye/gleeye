-- Add link between bookable items and SAP services
ALTER TABLE public.booking_items 
ADD COLUMN IF NOT EXISTS sap_service_id UUID REFERENCES public.core_services(id) ON DELETE SET NULL;

-- Index for better performance
CREATE INDEX IF NOT EXISTS idx_booking_items_sap_service_id ON public.booking_items(sap_service_id);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
