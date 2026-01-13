-- 1. Create invoices-orders link table (N:M relationship)
CREATE TABLE IF NOT EXISTS public.invoice_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(invoice_id, order_id)
);

-- 2. Migrate existing order_id relations to the new table
INSERT INTO public.invoice_orders (invoice_id, order_id)
SELECT id, order_id FROM public.invoices WHERE order_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Add fields to invoices
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2), -- e.g. 22.00, 10.00
ADD COLUMN IF NOT EXISTS expenses_client_account BOOLEAN DEFAULT false; -- Spese per conto cliente

-- 4. Create Payments placeholder table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    amount NUMERIC(15,2),
    payment_date DATE,
    description TEXT, -- e.g. "Saldo 25-0029 Top Pulizie"
    method TEXT,
    order_id UUID REFERENCES public.orders(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create Movements placeholder table
CREATE TABLE IF NOT EXISTS public.finance_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    movement_code TEXT UNIQUE, -- e.g. MOV-01262025
    amount NUMERIC(15,2),
    movement_date DATE,
    description TEXT,
    type TEXT, -- 'income', 'expense'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Link tables (invoices to payments/movements N:M)
CREATE TABLE IF NOT EXISTS public.invoice_payments (
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
    PRIMARY KEY (invoice_id, payment_id)
);

CREATE TABLE IF NOT EXISTS public.invoice_movements (
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    movement_id UUID REFERENCES public.finance_movements(id) ON DELETE CASCADE,
    PRIMARY KEY (invoice_id, movement_id)
);

-- RLS
ALTER TABLE public.invoice_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access" ON public.invoice_orders FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Admin full access" ON public.payments FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Admin full access" ON public.finance_movements FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Admin full access" ON public.invoice_payments FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Admin full access" ON public.invoice_movements FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
