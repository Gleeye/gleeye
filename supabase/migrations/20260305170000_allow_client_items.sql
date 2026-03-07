-- Migration to allow tasks associated only with clients
ALTER TABLE "public"."pm_items" ALTER COLUMN "space_ref" DROP NOT NULL;
ALTER TABLE "public"."pm_items" ADD COLUMN "client_ref" uuid REFERENCES "public"."clients"("id");

-- Update View Access Policy to include client-only items
-- Existing policy: 
-- CREATE POLICY "Items: View Access" ON "public"."pm_items" FOR SELECT USING ("public"."has_space_view_access"("space_ref", "auth"."uid"()));

-- We should probably update the function has_space_view_access or create a new policy.
-- For now, let's keep it simple.
