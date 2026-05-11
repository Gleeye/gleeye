ALTER TABLE "public"."pm_spaces" ADD COLUMN IF NOT EXISTS "ref_sap_service" uuid REFERENCES "public"."core_services"("id") ON DELETE CASCADE;
ALTER TABLE "public"."core_services" ADD COLUMN IF NOT EXISTS "cloud_links" jsonb DEFAULT '[]'::jsonb;
-- Also ensure type column can hold 'sap_service' (it's likely text)
