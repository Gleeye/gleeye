-- update_orders_schema_v3.sql
-- Add missing fields for Order Detail refinement

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.collaborators(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS contract_duration INTEGER;

COMMENT ON COLUMN public.orders.contact_id IS 'Referente dell''ordine (link a contacts)';
COMMENT ON COLUMN public.orders.account_id IS 'Account Gleeye responsabile dell''ordine (link a collaborators)';
COMMENT ON COLUMN public.orders.contract_duration IS 'Durata del contratto in mesi';
