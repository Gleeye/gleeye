-- Core Services Module Migration

-- 1. Core Service Areas (e.g. Branding, Digital, etc.)
CREATE TABLE IF NOT EXISTS "public"."core_service_areas" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "name" text NOT NULL CHECK (char_length(name) > 0),
    "created_at" timestamp with time zone DEFAULT now(),
    UNIQUE ("name")
);

-- 2. Core Service Types (Specific types linked to a department)
CREATE TABLE IF NOT EXISTS "public"."core_service_types" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "name" text NOT NULL CHECK (char_length(name) > 0),
    "department_id" uuid REFERENCES "public"."departments"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT now()
);

-- 3. Core Services (The main catalog item)
CREATE TABLE IF NOT EXISTS "public"."core_services" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "name" text NOT NULL CHECK (char_length(name) > 0),
    "department_id" uuid REFERENCES "public"."departments"("id") ON DELETE SET NULL,
    "type_id" uuid REFERENCES "public"."core_service_types"("id") ON DELETE SET NULL,
    "description" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

-- 4. Junction table for Core Services <-> Areas (Many-to-Many)
CREATE TABLE IF NOT EXISTS "public"."core_service_area_links" (
    "core_service_id" uuid REFERENCES "public"."core_services"("id") ON DELETE CASCADE,
    "area_id" uuid REFERENCES "public"."core_service_areas"("id") ON DELETE CASCADE,
    PRIMARY KEY ("core_service_id", "area_id")
);

-- RLS Policies
ALTER TABLE "public"."core_service_areas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."core_service_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."core_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."core_service_area_links" ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Enable read access for all users" ON "public"."core_service_areas" FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for all users" ON "public"."core_service_types" FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for all users" ON "public"."core_services" FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for all users" ON "public"."core_service_area_links" FOR SELECT USING (auth.role() = 'authenticated');

-- Allow insert/update/delete for authenticated users (simplified for now, ideally restricted to admins/pms)
CREATE POLICY "Enable write access for authenticated users" ON "public"."core_service_areas" FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable write access for authenticated users" ON "public"."core_service_types" FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable write access for authenticated users" ON "public"."core_services" FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable write access for authenticated users" ON "public"."core_service_area_links" FOR ALL USING (auth.role() = 'authenticated');

-- Seed initial Areas
INSERT INTO "public"."core_service_areas" ("name") VALUES 
('Branding'),
('Content Creation'),
('Digital'),
('Media Relations')
ON CONFLICT ("name") DO NOTHING;
