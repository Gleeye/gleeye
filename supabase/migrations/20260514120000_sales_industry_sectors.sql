-- Industry sectors: tassonomia di mercato sopra le nicchie
-- Applicata via MCP il 2026-05-14

CREATE TABLE IF NOT EXISTS public.industry_sectors (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            text NOT NULL UNIQUE,
    name            text NOT NULL,
    description     text,
    icon            text,
    sort_order      int NOT NULL DEFAULT 0,
    is_active       bool NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_industry_sectors_slug ON public.industry_sectors(slug);
CREATE INDEX IF NOT EXISTS idx_industry_sectors_active ON public.industry_sectors(is_active, sort_order);

ALTER TABLE public.industry_sectors ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='industry_sectors' AND policyname='industry_sectors_read_auth') THEN
        CREATE POLICY industry_sectors_read_auth ON public.industry_sectors FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='industry_sectors' AND policyname='industry_sectors_write_privileged') THEN
        CREATE POLICY industry_sectors_write_privileged ON public.industry_sectors FOR ALL TO authenticated
            USING (public.is_privileged_user(auth.uid())) WITH CHECK (public.is_privileged_user(auth.uid()));
    END IF;
END $$;

DROP TRIGGER IF EXISTS trg_industry_sectors_updated_at ON public.industry_sectors;
CREATE TRIGGER trg_industry_sectors_updated_at BEFORE UPDATE ON public.industry_sectors
    FOR EACH ROW EXECUTE FUNCTION public.fn_outreach_touch_updated_at();

INSERT INTO public.industry_sectors (slug, name, description, icon, sort_order) VALUES
    ('hospitality',           'Hospitality',              'Hotel, B&B, agriturismi, case vacanza',                          'hotel',           10),
    ('food_wine',             'Food & Wine',              'Ristoranti, cantine, gelaterie, pasticcerie, food retail',        'restaurant',      20),
    ('beauty_wellness',       'Beauty & Wellness',        'Parrucchieri, estetisti, SPA, centri benessere',                  'spa',             30),
    ('healthcare',            'Healthcare',               'Medici, dentisti, veterinari, farmacie, studi sanitari',          'medical_services', 40),
    ('professional_services', 'Servizi professionali',    'Avvocati, commercialisti, architetti, ingegneri, consulenti',     'business_center', 50),
    ('retail',                'Retail',                   'Negozi fisici, gioiellerie, ottici, librerie',                    'storefront',      60),
    ('tech_software',         'Tech & Software',          'Software house, SaaS, consulenza IT',                             'computer',        70),
    ('automotive',            'Automotive',               'Concessionarie, officine, autonoleggi',                           'directions_car',  80),
    ('nautica',               'Nautica',                  'Cantieri navali, charter, broker, marine',                        'sailing',         90),
    ('cultura_eventi',        'Cultura & Eventi',         'Musei, teatri, gallerie, organizzatori eventi',                   'theater_comedy', 100),
    ('fashion',               'Fashion',                  'Abbigliamento, accessori, brand moda',                            'checkroom',     110),
    ('sport_fitness',         'Sport & Fitness',          'Palestre, yoga, personal trainer, scuole sport',                  'fitness_center',120),
    ('education',             'Education',                'Scuole private, formazione professionale, scuole lingua',          'school',        130),
    ('b2b_manufacturing',     'B2B Manifatturiero',       'PMI manifatturiere, industria, fornitori B2B',                    'precision_manufacturing', 140)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.outreach_niches
    ADD COLUMN IF NOT EXISTS sector_id uuid REFERENCES public.industry_sectors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_niches_sector ON public.outreach_niches(sector_id);

ALTER TABLE public.core_services
    ADD COLUMN IF NOT EXISTS target_sectors jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.core_services.target_sectors IS 'Array di slug industry_sectors. Vuoto = SAP agnostico.';
COMMENT ON COLUMN public.outreach_niches.sector_id IS 'Settore di mercato della nicchia. Usato dall AI per filtrare SAP rilevanti.';
