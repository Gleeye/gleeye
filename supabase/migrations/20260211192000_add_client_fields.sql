-- Migration to add missing fields to the clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS vat_number TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS fiscal_code TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cap TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS pec TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS sdi_code TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS phone TEXT;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
