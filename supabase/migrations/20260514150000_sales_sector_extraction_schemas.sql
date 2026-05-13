-- Sector extraction schemas: definisce CHE COSA cercare in un sito per ogni settore
-- (n. stelle, camere, servizi, cucina, ecc.). Generato una tantum da AI, riusato per migliaia di prospect.
-- Applicato via MCP il 2026-05-14.

CREATE TABLE IF NOT EXISTS public.sector_extraction_schemas (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sector_id       uuid NOT NULL UNIQUE REFERENCES public.industry_sectors(id) ON DELETE CASCADE,
    fields          jsonb NOT NULL DEFAULT '[]'::jsonb,
    generated_at    timestamptz NOT NULL DEFAULT now(),
    generated_by_model text,
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sector_extraction_schemas_sector ON public.sector_extraction_schemas(sector_id);

ALTER TABLE public.sector_extraction_schemas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sector_extraction_schemas' AND policyname='sector_extraction_schemas_read_auth') THEN
        CREATE POLICY sector_extraction_schemas_read_auth ON public.sector_extraction_schemas FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sector_extraction_schemas' AND policyname='sector_extraction_schemas_write_privileged') THEN
        CREATE POLICY sector_extraction_schemas_write_privileged ON public.sector_extraction_schemas FOR ALL TO authenticated
            USING (public.is_privileged_user(auth.uid())) WITH CHECK (public.is_privileged_user(auth.uid()));
    END IF;
END $$;

DROP TRIGGER IF EXISTS trg_sector_extraction_schemas_updated_at ON public.sector_extraction_schemas;
CREATE TRIGGER trg_sector_extraction_schemas_updated_at BEFORE UPDATE ON public.sector_extraction_schemas
    FOR EACH ROW EXECUTE FUNCTION public.fn_outreach_touch_updated_at();
