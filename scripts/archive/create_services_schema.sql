-- Create Services Table
CREATE TABLE IF NOT EXISTS public.services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,          -- Tariffa
    cost NUMERIC,                -- Costo
    price NUMERIC,               -- Prezzo
    margin NUMERIC,              -- Margine
    margin_percent NUMERIC,      -- % Margine
    tags TEXT[],                 -- Tags (Array)
    type TEXT,                   -- Tipo tariffa
    details TEXT,                -- Dettagli Tariffa
    notes TEXT,                  -- Area text
    template_name TEXT,          -- Template Servizi in Vendita
    
    -- Linked fields (Arrays of IDs/Strings)
    linked_service_ids TEXT[],       -- Table 8 (relazione con Registro Servizi Collaboratori)
    linked_collaborator_ids TEXT[],  -- Registro Collaboratori copy (relazione con un'altra tabella)
    
    airtable_id TEXT UNIQUE,     -- For upserts/sync
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view services" 
ON public.services FOR SELECT 
USING ( auth.role() = 'authenticated' );

CREATE POLICY "Admin can do everything on services" 
ON public.services FOR ALL 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );
