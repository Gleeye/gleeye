ALTER TABLE "public"."core_services" ADD COLUMN IF NOT EXISTS "cloud_links" jsonb DEFAULT '[]'::jsonb;
