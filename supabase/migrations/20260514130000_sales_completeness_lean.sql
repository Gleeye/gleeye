-- Layer 0 completeness + social_links strutturati + DB lean cleanup
-- Applicata via MCP il 2026-05-14

ALTER TABLE public.prospects
    ADD COLUMN IF NOT EXISTS completeness_score int CHECK (completeness_score BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz;

COMMENT ON COLUMN public.prospects.completeness_score IS 'Layer 0: score 0-100 deterministico calcolato dopo scraping. <30=incomplete, 30-60=parziale, >=60=completo.';
COMMENT ON COLUMN public.prospects.social_links IS 'Dizionario URL social estratti durante sourcing.';

CREATE INDEX IF NOT EXISTS idx_prospects_completeness ON public.prospects(completeness_score DESC) WHERE completeness_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_last_enriched ON public.prospects(last_enriched_at DESC) WHERE last_enriched_at IS NOT NULL;

-- DB LEAN CLEANUP: rimuove last_scrape dal jsonb dei prospect esistenti.
UPDATE public.prospects
SET ai_enrichment_data = ai_enrichment_data - 'last_scrape'
WHERE ai_enrichment_data ? 'last_scrape';
