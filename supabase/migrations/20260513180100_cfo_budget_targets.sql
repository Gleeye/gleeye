-- CFO: Target mensili per piano economico
CREATE TABLE IF NOT EXISTS public.cfo_budget_targets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    year int NOT NULL,
    month int NOT NULL CHECK (month BETWEEN 1 AND 12),
    target_revenue numeric(12,2),
    notes text,
    created_at timestamptz DEFAULT now(),
    UNIQUE (year, month)
);

ALTER TABLE public.cfo_budget_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cfo_budget_targets_auth" ON public.cfo_budget_targets
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
