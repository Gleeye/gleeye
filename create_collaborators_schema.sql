-- Tabella Collaboratori
CREATE TABLE IF NOT EXISTS public.collaborators (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT, -- Lo shorthand (es. SPINE)
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    role TEXT,
    tags TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    vat_number TEXT,
    fiscal_code TEXT,
    address TEXT,
    birth_date DATE,
    birth_place TEXT,
    airtable_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella di join per collegare Collaboratori e Ordini (Relazione Molti-a-Molti)
CREATE TABLE IF NOT EXISTS public.order_collaborators (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    collaborator_id UUID REFERENCES public.collaborators(id) ON DELETE CASCADE,
    role_in_order TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(order_id, collaborator_id)
);

-- RLS Policies
ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can do everything on collaborators" 
ON public.collaborators FOR ALL 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

CREATE POLICY "Admin can do everything on order_collaborators" 
ON public.order_collaborators FOR ALL 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );
