-- Create Payments Table
DROP TABLE IF EXISTS public.payments CASCADE;
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT,                  -- 'Descrizione' or 'Name' from CSV
    due_date DATE,               -- 'Data' from CSV
    amount NUMERIC(10, 2),       -- 'Importo' from CSV
    status TEXT,                 -- 'Status' (Done, To-do) or inferred
    payment_type TEXT,           -- 'Tipo Pagamento' (Cliente, Collaboratore, etc.)
    payment_mode TEXT,           -- 'Tipo Modalità' (Anticipo, Rata, Saldo)
    notes TEXT,                  -- 'Note'
    
    -- Foreign Keys
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    collaborator_id UUID REFERENCES public.collaborators(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    passive_invoice_id UUID REFERENCES public.passive_invoices(id) ON DELETE SET NULL,

    res_partner_request TEXT,    -- 'Invita a Fatturare' (legacy text)
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.payments;
CREATE POLICY "Enable read access for all users" ON public.payments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable write access for authenticated users" ON public.payments;
CREATE POLICY "Enable write access for authenticated users" ON public.payments FOR ALL USING (auth.role() = 'authenticated');
