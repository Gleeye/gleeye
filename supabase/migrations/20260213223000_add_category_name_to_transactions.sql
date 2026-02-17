-- Add category_name column to bank_transactions table
ALTER TABLE "public"."bank_transactions" 
ADD COLUMN IF NOT EXISTS "category_name" text;

-- Populate existing rows by joining with transaction_categories
UPDATE "public"."bank_transactions" bt
SET "category_name" = tc.name
FROM "public"."transaction_categories" tc
WHERE bt.category_id = tc.id
AND bt.category_name IS NULL;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload config';
