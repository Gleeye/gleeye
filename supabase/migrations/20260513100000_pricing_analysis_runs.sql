-- Migration: pricing_analysis_runs
-- Tabella additive per storico analisi AI pricing. Nessuna modifica a tabelle esistenti.

CREATE TABLE IF NOT EXISTS pricing_analysis_runs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    analysis_type   text NOT NULL CHECK (analysis_type IN ('win_loss','margin','sensitivity','suggestions','lost_deal')),
    status          text NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','error')),
    result_json     jsonb,
    model_used      text,
    tokens_used     int,
    error_message   text,
    created_by      uuid REFERENCES auth.users(id)
);

ALTER TABLE pricing_analysis_runs ENABLE ROW LEVEL SECURITY;

-- Solo utenti privilegiati possono leggere/scrivere
CREATE POLICY "privileged_read_pricing_runs"
    ON pricing_analysis_runs FOR SELECT
    USING (is_privileged_user());

CREATE POLICY "privileged_insert_pricing_runs"
    ON pricing_analysis_runs FOR INSERT
    WITH CHECK (is_privileged_user());

CREATE POLICY "privileged_update_pricing_runs"
    ON pricing_analysis_runs FOR UPDATE
    USING (is_privileged_user());

COMMENT ON TABLE pricing_analysis_runs IS
    'Storico analisi AI Pricing Intelligence. Ogni riga = un run di analisi (win_loss, margin, sensitivity, suggestions, lost_deal).';
