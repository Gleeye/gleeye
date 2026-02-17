CREATE TABLE IF NOT EXISTS "public"."core_service_department_links" (
    "core_service_id" "uuid" NOT NULL REFERENCES "public"."core_services"("id") ON DELETE CASCADE,
    "department_id" "uuid" NOT NULL REFERENCES "public"."departments"("id") ON DELETE CASCADE,
    PRIMARY KEY ("core_service_id", "department_id")
);

ALTER TABLE "public"."core_service_department_links" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON "public"."core_service_department_links"
AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable write access for authenticated users" ON "public"."core_service_department_links"
AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users" ON "public"."core_service_department_links"
AS PERMISSIVE FOR DELETE TO authenticated USING (true);
