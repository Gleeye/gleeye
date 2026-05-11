-- Tabella Fornitori
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    vat_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies Fornitori
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can do everything on suppliers" 
ON public.suppliers FOR ALL 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- Tabella Fatture Passive
CREATE TABLE IF NOT EXISTS public.passive_invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_number TEXT,
    issue_date DATE,
    due_date DATE,
    payment_date DATE,
    status TEXT, -- 'Pagato', 'Da Pagare', etc.
    amount_tax_excluded NUMERIC(15,2),
    tax_amount NUMERIC(15,2),
    amount_tax_included NUMERIC(15,2),
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    collaborator_id UUID REFERENCES public.collaborators(id) ON DELETE SET NULL,
    notes TEXT,
    category TEXT,
    related_orders TEXT,
    attachment_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies Fatture Passive
ALTER TABLE public.passive_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can do everything on passive_invoices" 
ON public.passive_invoices FOR ALL 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- Indici
CREATE INDEX IF NOT EXISTS idx_passive_invoices_supplier_id ON public.passive_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_passive_invoices_collaborator_id ON public.passive_invoices(collaborator_id);
