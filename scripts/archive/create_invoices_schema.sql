-- Tabella Fatture Attive
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_number TEXT UNIQUE, -- N.
    invoice_date DATE, -- Data Invio
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    title TEXT, -- Titolo Commessa
    amount_tax_excluded NUMERIC(15,2), -- Imponibile
    tax_amount NUMERIC(15,2), -- IVA
    amount_tax_included NUMERIC(15,2), -- Tot Documento
    status TEXT, -- Stato Fattura
    payment_date DATE, -- Data Saldo
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can do everything on invoices" ON public.invoices;
CREATE POLICY "Admin can do everything on invoices" 
ON public.invoices FOR ALL 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- Indici
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON public.invoices(order_id);
