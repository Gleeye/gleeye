-- Add cloud_links JSONB column to relevant tables
ALTER TABLE "public"."orders" ADD COLUMN IF NOT EXISTS "cloud_links" JSONB DEFAULT '[]'::JSONB;
ALTER TABLE "public"."pm_spaces" ADD COLUMN IF NOT EXISTS "cloud_links" JSONB DEFAULT '[]'::JSONB;
ALTER TABLE "public"."pm_items" ADD COLUMN IF NOT EXISTS "cloud_links" JSONB DEFAULT '[]'::JSONB;

-- Comment describing the structure
COMMENT ON COLUMN "public"."orders"."cloud_links" IS 'List of external resource links: [{type, url, label}]';
COMMENT ON COLUMN "public"."pm_spaces"."cloud_links" IS 'List of external resource links: [{type, url, label}]';
COMMENT ON COLUMN "public"."pm_items"."cloud_links" IS 'List of external resource links: [{type, url, label}]';
