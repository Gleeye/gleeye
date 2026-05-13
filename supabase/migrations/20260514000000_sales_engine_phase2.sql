-- Sales Engine Phase 2: schema completo
-- 8 nuove tabelle + estensione prospects + trigger funnel/recount + RLS

-- ─── 1. outreach_niches ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.outreach_niches (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    description     text,
    target_sap_id   uuid REFERENCES public.core_services(id) ON DELETE SET NULL,
    criteria        jsonb NOT NULL DEFAULT '{}'::jsonb,
    ikigai_score    int CHECK (ikigai_score BETWEEN 1 AND 5),
    status          text NOT NULL DEFAULT 'researching'
                    CHECK (status IN ('researching','active','paused','exhausted')),
    prospects_count int NOT NULL DEFAULT 0,
    notes           text,
    created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outreach_niches_status ON public.outreach_niches(status);
CREATE INDEX IF NOT EXISTS idx_outreach_niches_target_sap ON public.outreach_niches(target_sap_id);

-- ─── 2. outreach_sequences ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.outreach_sequences (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    niche_id        uuid REFERENCES public.outreach_niches(id) ON DELETE SET NULL,
    target_sap_id   uuid REFERENCES public.core_services(id) ON DELETE SET NULL,
    tone            text DEFAULT 'professionale',
    status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','active','paused','completed')),
    stats           jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outreach_sequences_niche ON public.outreach_sequences(niche_id);
CREATE INDEX IF NOT EXISTS idx_outreach_sequences_status ON public.outreach_sequences(status);

-- ─── 3. outreach_steps ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.outreach_steps (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id          uuid NOT NULL REFERENCES public.outreach_sequences(id) ON DELETE CASCADE,
    step_number          int NOT NULL,
    channel              text NOT NULL DEFAULT 'email'
                         CHECK (channel IN ('email','dm_linkedin','dm_instagram','loom','whatsapp','cold_call')),
    delay_days           int NOT NULL DEFAULT 0,
    step_type            text NOT NULL DEFAULT 'initial'
                         CHECK (step_type IN ('initial','followup_light','followup_value','followup_gif','final_close')),
    subject_template     text,
    body_template        text,
    loom_script_template text,
    is_active            bool NOT NULL DEFAULT true,
    created_at           timestamptz NOT NULL DEFAULT now(),
    UNIQUE (sequence_id, step_number)
);
CREATE INDEX IF NOT EXISTS idx_outreach_steps_sequence ON public.outreach_steps(sequence_id);

-- ─── 4. outreach_sends ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.outreach_sends (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id     uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
    sequence_id     uuid REFERENCES public.outreach_sequences(id) ON DELETE SET NULL,
    step_id         uuid REFERENCES public.outreach_steps(id) ON DELETE SET NULL,
    channel         text NOT NULL,
    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','scheduled','sent','opened','clicked','replied','bounced','unsubscribed','failed')),
    scheduled_for   timestamptz,
    sent_at         timestamptz,
    opened_at       timestamptz,
    clicked_at      timestamptz,
    replied_at      timestamptz,
    bounced_at      timestamptz,
    from_domain     text,
    subject_rendered text,
    body_rendered   text,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outreach_sends_prospect ON public.outreach_sends(prospect_id);
CREATE INDEX IF NOT EXISTS idx_outreach_sends_status ON public.outreach_sends(status);
CREATE INDEX IF NOT EXISTS idx_outreach_sends_scheduled ON public.outreach_sends(scheduled_for) WHERE status IN ('pending','scheduled');
CREATE INDEX IF NOT EXISTS idx_outreach_sends_sent_at ON public.outreach_sends(sent_at DESC);

-- ─── 5. outreach_replies ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.outreach_replies (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id          uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
    send_id              uuid REFERENCES public.outreach_sends(id) ON DELETE SET NULL,
    reply_text           text,
    received_at          timestamptz NOT NULL DEFAULT now(),
    ai_classification    text CHECK (ai_classification IN ('hot','warm','cold','unsubscribe','objection_price','objection_timing','objection_trust','auto_reply','out_of_office','not_interested')),
    ai_confidence        numeric(3,2),
    suggested_action     text,
    processed_at         timestamptz,
    action_taken         text,
    notified_account_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outreach_replies_prospect ON public.outreach_replies(prospect_id);
CREATE INDEX IF NOT EXISTS idx_outreach_replies_classification ON public.outreach_replies(ai_classification);

-- ─── 6. outreach_ab_tests ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.outreach_ab_tests (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id     uuid REFERENCES public.outreach_sequences(id) ON DELETE CASCADE,
    step_id         uuid REFERENCES public.outreach_steps(id) ON DELETE CASCADE,
    variant_name    text NOT NULL,
    test_hypothesis text,
    started_at      timestamptz NOT NULL DEFAULT now(),
    ended_at        timestamptz,
    sample_size     int NOT NULL DEFAULT 0,
    open_rate       numeric(5,2),
    reply_rate      numeric(5,2),
    call_rate       numeric(5,2),
    close_rate      numeric(5,2),
    is_winner       bool DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outreach_ab_tests_sequence ON public.outreach_ab_tests(sequence_id);

-- ─── 7. outreach_domains ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.outreach_domains (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    domain          text NOT NULL UNIQUE,
    from_address    text,
    from_name       text,
    warmup_status   text NOT NULL DEFAULT 'new'
                    CHECK (warmup_status IN ('new','warming','ready','paused','burned')),
    warmup_started_at timestamptz,
    daily_limit     int NOT NULL DEFAULT 30,
    sent_today      int NOT NULL DEFAULT 0,
    last_reset_at   date,
    provider        text DEFAULT 'aws_ses',
    ses_verified    bool DEFAULT false,
    dkim_configured bool DEFAULT false,
    spf_configured  bool DEFAULT false,
    dmarc_configured bool DEFAULT false,
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outreach_domains_status ON public.outreach_domains(warmup_status);

-- ─── 8. prospect_discovery_notes ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prospect_discovery_notes (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id                 uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
    call_date                   date,
    cosa_vende                  text,
    target_clienti              text,
    clienti_attuali             int,
    valore_cliente_annuo        numeric(10,2),
    richieste_mese              int,
    canale_acquisizione_oggi    text,
    tasso_conversione_pct       numeric(5,2),
    processo_acquisizione_oggi  text,
    cosa_provato_in_passato     text,
    pain_principale             text,
    esperienze_negative         text,
    obiettivo_12_mesi           text,
    cosa_cambierebbe_business   text,
    decisori_presenti           bool,
    decisori_mancanti           text,
    soci_o_partner              text,
    pre_call_video_url          text,
    video_watched               bool DEFAULT false,
    video_watch_pct             int,
    video_sent_at               timestamptz,
    note_libere                 text,
    sales_call_scheduled_at     timestamptz,
    created_by                  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_discovery_notes_prospect ON public.prospect_discovery_notes(prospect_id);

-- ─── 9. Estensione prospects ─────────────────────────────────────────────────
ALTER TABLE public.prospects
    ADD COLUMN IF NOT EXISTS niche_id           uuid REFERENCES public.outreach_niches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS funnel_segment     text NOT NULL DEFAULT 'cold'
                              CHECK (funnel_segment IN ('cold','discovery_done','sales_call_done','won','lost')),
    ADD COLUMN IF NOT EXISTS loom_script_url    text,
    ADD COLUMN IF NOT EXISTS loom_video_url     text,
    ADD COLUMN IF NOT EXISTS loom_watch_pct     int,
    ADD COLUMN IF NOT EXISTS oto_formula        text,
    ADD COLUMN IF NOT EXISTS oto_start_date     date,
    ADD COLUMN IF NOT EXISTS mrr_proposed_at    date,
    ADD COLUMN IF NOT EXISTS mrr_converted_at   date,
    ADD COLUMN IF NOT EXISTS last_relaunch_at   timestamptz,
    ADD COLUMN IF NOT EXISTS eur_per_message    numeric(10,2),
    ADD COLUMN IF NOT EXISTS active_sequence_id uuid REFERENCES public.outreach_sequences(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS current_step_number int DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_prospects_niche ON public.prospects(niche_id);
CREATE INDEX IF NOT EXISTS idx_prospects_funnel_segment ON public.prospects(funnel_segment);
CREATE INDEX IF NOT EXISTS idx_prospects_active_sequence ON public.prospects(active_sequence_id) WHERE active_sequence_id IS NOT NULL;

-- ─── 10. Updated_at triggers ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_outreach_touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_outreach_niches_updated_at ON public.outreach_niches;
CREATE TRIGGER trg_outreach_niches_updated_at BEFORE UPDATE ON public.outreach_niches FOR EACH ROW EXECUTE FUNCTION public.fn_outreach_touch_updated_at();
DROP TRIGGER IF EXISTS trg_outreach_sequences_updated_at ON public.outreach_sequences;
CREATE TRIGGER trg_outreach_sequences_updated_at BEFORE UPDATE ON public.outreach_sequences FOR EACH ROW EXECUTE FUNCTION public.fn_outreach_touch_updated_at();
DROP TRIGGER IF EXISTS trg_outreach_domains_updated_at ON public.outreach_domains;
CREATE TRIGGER trg_outreach_domains_updated_at BEFORE UPDATE ON public.outreach_domains FOR EACH ROW EXECUTE FUNCTION public.fn_outreach_touch_updated_at();
DROP TRIGGER IF EXISTS trg_discovery_notes_updated_at ON public.prospect_discovery_notes;
CREATE TRIGGER trg_discovery_notes_updated_at BEFORE UPDATE ON public.prospect_discovery_notes FOR EACH ROW EXECUTE FUNCTION public.fn_outreach_touch_updated_at();

-- ─── 11. RLS + policy ────────────────────────────────────────────────────────
ALTER TABLE public.outreach_niches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_discovery_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='outreach_niches' AND policyname='outreach_niches_privileged') THEN
        CREATE POLICY outreach_niches_privileged ON public.outreach_niches FOR ALL TO authenticated
            USING (public.is_privileged_user(auth.uid())) WITH CHECK (public.is_privileged_user(auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='outreach_sequences' AND policyname='outreach_sequences_privileged') THEN
        CREATE POLICY outreach_sequences_privileged ON public.outreach_sequences FOR ALL TO authenticated
            USING (public.is_privileged_user(auth.uid())) WITH CHECK (public.is_privileged_user(auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='outreach_steps' AND policyname='outreach_steps_privileged') THEN
        CREATE POLICY outreach_steps_privileged ON public.outreach_steps FOR ALL TO authenticated
            USING (public.is_privileged_user(auth.uid())) WITH CHECK (public.is_privileged_user(auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='outreach_sends' AND policyname='outreach_sends_privileged') THEN
        CREATE POLICY outreach_sends_privileged ON public.outreach_sends FOR ALL TO authenticated
            USING (public.is_privileged_user(auth.uid())) WITH CHECK (public.is_privileged_user(auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='outreach_replies' AND policyname='outreach_replies_privileged') THEN
        CREATE POLICY outreach_replies_privileged ON public.outreach_replies FOR ALL TO authenticated
            USING (public.is_privileged_user(auth.uid())) WITH CHECK (public.is_privileged_user(auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='outreach_ab_tests' AND policyname='outreach_ab_tests_privileged') THEN
        CREATE POLICY outreach_ab_tests_privileged ON public.outreach_ab_tests FOR ALL TO authenticated
            USING (public.is_privileged_user(auth.uid())) WITH CHECK (public.is_privileged_user(auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='outreach_domains' AND policyname='outreach_domains_privileged') THEN
        CREATE POLICY outreach_domains_privileged ON public.outreach_domains FOR ALL TO authenticated
            USING (public.is_privileged_user(auth.uid())) WITH CHECK (public.is_privileged_user(auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospect_discovery_notes' AND policyname='discovery_notes_privileged') THEN
        CREATE POLICY discovery_notes_privileged ON public.prospect_discovery_notes FOR ALL TO authenticated
            USING (public.is_privileged_user(auth.uid())) WITH CHECK (public.is_privileged_user(auth.uid()));
    END IF;
END $$;

-- ─── 12. Trigger: prospects_count su niches ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_niche_recount() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.niche_id IS NOT NULL THEN
            UPDATE public.outreach_niches SET prospects_count = prospects_count + 1 WHERE id = NEW.niche_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF COALESCE(OLD.niche_id::text,'') <> COALESCE(NEW.niche_id::text,'') THEN
            IF OLD.niche_id IS NOT NULL THEN
                UPDATE public.outreach_niches SET prospects_count = GREATEST(prospects_count - 1, 0) WHERE id = OLD.niche_id;
            END IF;
            IF NEW.niche_id IS NOT NULL THEN
                UPDATE public.outreach_niches SET prospects_count = prospects_count + 1 WHERE id = NEW.niche_id;
            END IF;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.niche_id IS NOT NULL THEN
            UPDATE public.outreach_niches SET prospects_count = GREATEST(prospects_count - 1, 0) WHERE id = OLD.niche_id;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prospects_niche_count ON public.prospects;
CREATE TRIGGER trg_prospects_niche_count AFTER INSERT OR UPDATE OR DELETE ON public.prospects FOR EACH ROW EXECUTE FUNCTION public.fn_niche_recount();

-- ─── 13. Trigger: discovery → funnel_segment ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_prospect_funnel_from_discovery() RETURNS trigger AS $$
BEGIN
    UPDATE public.prospects SET funnel_segment = 'discovery_done' WHERE id = NEW.prospect_id AND funnel_segment = 'cold';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_discovery_advances_funnel ON public.prospect_discovery_notes;
CREATE TRIGGER trg_discovery_advances_funnel AFTER INSERT ON public.prospect_discovery_notes FOR EACH ROW EXECUTE FUNCTION public.fn_prospect_funnel_from_discovery();
