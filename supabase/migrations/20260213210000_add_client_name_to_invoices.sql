-- Add client_name column to invoices table
ALTER TABLE "public"."invoices" 
ADD COLUMN IF NOT EXISTS "client_name" text;

-- Optional: Populate existing rows by joining with clients
UPDATE "public"."invoices" i
SET "client_name" = c.business_name
FROM "public"."clients" c
WHERE i.client_id = c.id
AND i.client_name IS NULL;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload config';
