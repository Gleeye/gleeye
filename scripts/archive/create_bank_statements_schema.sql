-- Tabella Estratti Conto
CREATE TABLE IF NOT EXISTS public.bank_statements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT, -- MM/YY
    statement_date DATE, -- Data fine mese
    balance NUMERIC(15,2), -- Saldo
    attachment_name TEXT,
    attachment_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can do everything on bank_statements" ON public.bank_statements;
CREATE POLICY "Admin can do everything on bank_statements" 
ON public.bank_statements FOR ALL 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- Storage Bucket (Idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank_statements', 'bank_statements', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'bank_statements' );

CREATE POLICY "Admin Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'bank_statements' AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );
