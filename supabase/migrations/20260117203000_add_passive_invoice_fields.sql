-- Add missing columns to passive_invoices if they don't exist
ALTER TABLE public.passive_invoices 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS service_description TEXT, -- Alias sometimes used
ADD COLUMN IF NOT EXISTS related_orders JSONB, -- Store linked orders as JSON array
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS amount_tax_included NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS amount_tax_excluded NUMERIC(15,2), -- Should match original 'amount'
ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS vat_eligibility TEXT,
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Da Pagare',
ADD COLUMN IF NOT EXISTS payment_date DATE,
ADD COLUMN IF NOT EXISTS category TEXT, -- 'ritenuta', 'forfettario', 'supplier_invoice' etc
ADD COLUMN IF NOT EXISTS ritenuta NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS rivalsa_inps NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS stamp_duty NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS iva_attiva BOOLEAN DEFAULT false;

-- Add RLS policy for public read if not exists (already done for attachments, ensuring table access)
CREATE POLICY "Enable read access for all users" ON "public"."passive_invoices"
AS PERMISSIVE FOR SELECT
TO public
USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON "public"."passive_invoices"
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update for users based on email" ON "public"."passive_invoices"
AS PERMISSIVE FOR UPDATE
TO public
USING (true)
WITH CHECK (true);
