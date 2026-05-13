-- search_keywords: lista keyword AI-suggerite per il sourcing OSM
-- Applicata via MCP il 2026-05-14
ALTER TABLE public.outreach_niches
    ADD COLUMN IF NOT EXISTS search_keywords jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.outreach_niches.search_keywords IS 'Array di keyword AI-suggerite per il sourcing.';
