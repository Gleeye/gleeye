-- Update Suppliers table with fiscal fields
ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS vat_number TEXT,
ADD COLUMN IF NOT EXISTS tax_code TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS province TEXT,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'IT',
ADD COLUMN IF NOT EXISTS fiscal_regime TEXT DEFAULT 'ordinario', -- 'ordinario', 'forfettario', 'minimi'
ADD COLUMN IF NOT EXISTS default_vat_rate NUMERIC(5,2) DEFAULT 22,
ADD COLUMN IF NOT EXISTS cassa_previdenziale_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS withholding_tax_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_terms TEXT,
ADD COLUMN IF NOT EXISTS bank_iban TEXT;

-- Refresh schema cache (Supabase specific trick often needed is simply to notify pgrst or just restart, 
-- but doing a reload of config might help if possible, otherwise just the ALTER helps).
NOTIFY pgrst, 'reload config';
