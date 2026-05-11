-- Create contact_forms table
CREATE TABLE IF NOT EXISTS "public"."contact_forms" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "primary_color" text DEFAULT '#000000',
    "success_message" text DEFAULT 'Grazie per averci contattato!'
);

ALTER TABLE "public"."contact_forms" OWNER TO "postgres";
ALTER TABLE ONLY "public"."contact_forms" ADD CONSTRAINT "contact_forms_pkey" PRIMARY KEY ("id");

-- Create contact_submissions table
CREATE TABLE IF NOT EXISTS "public"."contact_submissions" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "form_id" uuid NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "data" jsonb NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL
);

ALTER TABLE "public"."contact_submissions" OWNER TO "postgres";
ALTER TABLE ONLY "public"."contact_submissions" ADD CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."contact_submissions" ADD CONSTRAINT "contact_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."contact_forms"("id") ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE "public"."contact_forms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."contact_submissions" ENABLE ROW LEVEL SECURITY;

-- Policies for contact_forms
-- Authenticated users have full access
CREATE POLICY "Enable ALL for authenticated users" ON "public"."contact_forms" FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Public can SELECT active forms
CREATE POLICY "Enable SELECT for public on active forms" ON "public"."contact_forms" FOR SELECT TO public USING (is_active = true);

-- Policies for contact_submissions
-- Authenticated users have full access
CREATE POLICY "Enable ALL for authenticated users on submissions" ON "public"."contact_submissions" FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Public can INSERT into contact_submissions
CREATE POLICY "Enable INSERT for public on submissions" ON "public"."contact_submissions" FOR INSERT TO public WITH CHECK (true);
