-- Create transaction categories table
CREATE TABLE IF NOT EXISTS public.transaction_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('entrata', 'uscita', 'altro')),
    parent_id UUID REFERENCES public.transaction_categories(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(name, type)
);

-- Enable RLS for transaction_categories
ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can do everything on transaction_categories" ON public.transaction_categories;
CREATE POLICY "Admin can do everything on transaction_categories" 
ON public.transaction_categories FOR ALL 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );


-- Create bank transactions table
CREATE TABLE IF NOT EXISTS public.bank_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    old_id TEXT UNIQUE, -- e.g., 'MOV-00012024'
    date DATE NOT NULL,
    type TEXT CHECK (type IN ('entrata', 'uscita')),
    amount NUMERIC(15,2) NOT NULL,
    description TEXT,
    
    -- Categorization
    category_id UUID REFERENCES public.transaction_categories(id) ON DELETE SET NULL,
    
    -- Relationships
    active_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    passive_invoice_id UUID REFERENCES public.passive_invoices(id) ON DELETE SET NULL,
    
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    
    -- Text fallbacks / Original data
    counterparty_name TEXT, -- 'Azienda' from CSV
    external_ref_active_invoice TEXT, -- 'Fatture Attive' from CSV
    external_ref_passive_invoice TEXT, -- 'Fatture Passive' from CSV
    
    attachment_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for bank_transactions
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can do everything on bank_transactions" ON public.bank_transactions;
CREATE POLICY "Admin can do everything on bank_transactions" 
ON public.bank_transactions FOR ALL 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bank_trans_date ON public.bank_transactions(date);
CREATE INDEX IF NOT EXISTS idx_bank_trans_category ON public.bank_transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_bank_trans_active_inv ON public.bank_transactions(active_invoice_id);
CREATE INDEX IF NOT EXISTS idx_bank_trans_passive_inv ON public.bank_transactions(passive_invoice_id);
