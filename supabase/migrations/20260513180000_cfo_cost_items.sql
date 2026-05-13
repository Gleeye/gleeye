-- CFO: Distinta base per servizio SAP
-- cfo_distinta_config: prezzo di vendita per servizio
-- cfo_cost_items: voci di costo (fissi + variabili)

CREATE TABLE IF NOT EXISTS public.cfo_distinta_config (
    service_id uuid PRIMARY KEY REFERENCES public.core_services(id) ON DELETE CASCADE,
    selling_price numeric(12,2),
    notes text,
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cfo_cost_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id uuid NOT NULL REFERENCES public.core_services(id) ON DELETE CASCADE,
    name text NOT NULL,
    cost_type text NOT NULL CHECK (cost_type IN ('fixed', 'variable')),
    amount numeric(12,2) NOT NULL DEFAULT 0,
    unit text,
    notes text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cfo_distinta_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cfo_cost_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cfo_distinta_config_auth" ON public.cfo_distinta_config
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "cfo_cost_items_auth" ON public.cfo_cost_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
