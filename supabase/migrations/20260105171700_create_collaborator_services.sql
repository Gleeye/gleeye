-- Create Collaborator Services Table (Registro Servizi Collaboratori)
CREATE TABLE IF NOT EXISTS public.collaborator_services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,          -- The ID from CSV e.g. "24-0001-1-Aqua"
    
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    collaborator_id UUID REFERENCES public.collaborators(id) ON DELETE SET NULL,
    
    legacy_order_id TEXT,        -- "Ordine" column
    legacy_service_name TEXT,    -- "Servizio" column
    legacy_collaborator_name TEXT, -- "Collaboratori" column
    
    department TEXT,             -- "Reparto" or inferred from service tags
    tariff_type TEXT,            -- "Tipo Tariffa"
    
    -- Quantities
    quantity NUMERIC,            -- Generic "Quantità" if present
    hours NUMERIC,               -- "Ore"
    months NUMERIC,              -- "Mesi"
    spot_quantity NUMERIC,       -- "Quant"
    
    -- Economics
    unit_cost NUMERIC,           -- "Costo base"
    unit_price NUMERIC,          -- "Prezzo base"
    total_cost NUMERIC,          -- "Costo Netto Totale"
    total_price NUMERIC,         -- "Prezzo Totale"
    
    -- Status & Metadata
    status_work TEXT,            -- "Stato Lavori"
    status_offer TEXT,           -- "Stato Offerta"
    notes TEXT,                  -- "Notes" or "Servizio_text"
    
    airtable_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.collaborator_services ENABLE ROW LEVEL SECURITY;

-- Drop existing if any to avoid errors during push if I'm re-running
DROP POLICY IF EXISTS "Authenticated users can view collaborator_services" ON public.collaborator_services;
DROP POLICY IF EXISTS "Admin can do everything on collaborator_services" ON public.collaborator_services;

CREATE POLICY "Authenticated users can view collaborator_services" 
ON public.collaborator_services FOR SELECT 
USING ( auth.role() = 'authenticated' );

CREATE POLICY "Admin can do everything on collaborator_services" 
ON public.collaborator_services FOR ALL 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );
