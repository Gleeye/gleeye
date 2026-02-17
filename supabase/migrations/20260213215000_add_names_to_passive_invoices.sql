-- Add name columns to passive_invoices table
ALTER TABLE "public"."passive_invoices" 
ADD COLUMN IF NOT EXISTS "collaborator_name" text,
ADD COLUMN IF NOT EXISTS "supplier_name" text;

-- Populate existing rows for collaborators
UPDATE "public"."passive_invoices" pi
SET "collaborator_name" = c.full_name
FROM "public"."collaborators" c
WHERE pi.collaborator_id = c.id
AND pi.collaborator_name IS NULL;

-- Populate existing rows for suppliers
UPDATE "public"."passive_invoices" pi
SET "supplier_name" = s.name
FROM "public"."suppliers" s
WHERE pi.supplier_id = s.id
AND pi.supplier_name IS NULL;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload config';
