ALTER TABLE "public"."pm_spaces" ADD COLUMN IF NOT EXISTS "ref_sap_service" uuid REFERENCES "public"."core_services"("id") ON DELETE CASCADE;
