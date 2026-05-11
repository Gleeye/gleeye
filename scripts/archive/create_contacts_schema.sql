-- Tabella Contatti (Referenti dai Clienti)
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    role TEXT,
    airtable_id TEXT UNIQUE, -- Record ID Airtable per il referente
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can do everything on contacts" ON public.contacts;
CREATE POLICY "Admin can do everything on contacts" 
ON public.contacts FOR ALL 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_contacts_client_id ON public.contacts(client_id);
