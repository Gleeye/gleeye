-- Add cassa_previdenziale column to passive_invoices
ALTER TABLE "public"."passive_invoices" 
ADD COLUMN IF NOT EXISTS "cassa_previdenziale" numeric DEFAULT 0;

-- Refresh schema cache
NOTIFY pgrst, 'reload config';
