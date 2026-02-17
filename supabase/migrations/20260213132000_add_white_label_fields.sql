-- Migration: Add White Label Partner fields to collaborators
ALTER TABLE "public"."collaborators" 
ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'individual',
ADD COLUMN IF NOT EXISTS "fiscal_regime" text DEFAULT 'ordinario',
ADD COLUMN IF NOT EXISTS "country" text DEFAULT 'IT',
ADD COLUMN IF NOT EXISTS "default_vat_rate" numeric DEFAULT 22,
ADD COLUMN IF NOT EXISTS "cassa_previdenziale_rate" numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS "withholding_tax_rate" numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS "payment_terms" text;

-- Add a comment to the column for clarity
COMMENT ON COLUMN "public"."collaborators"."type" IS 'individual or white_label';
