-- Create bank_statements table
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

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Admin can do everything on bank_statements" ON public.bank_statements;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Admin can do everything on bank_statements" 
ON public.bank_statements FOR ALL 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- Storage Bucket (Idempotent)
-- NOTE: storage.buckets might not exist if storage extension not enabled in this context. 
-- Disabling direct bucket creation via SQL for now, relying on Supabase Dashboard or seed.
/*
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank_statements', 'bank_statements', true)
ON CONFLICT (id) DO NOTHING;
*/

-- Storage Policies
-- DO $$ 
-- BEGIN
--     DROP POLICY IF EXISTS "Public Access Bank Statements" ON storage.objects;
--     DROP POLICY IF EXISTS "Admin Upload Bank Statements" ON storage.objects;
-- EXCEPTION
--     WHEN undefined_object THEN null;
-- END $$;
-- 
-- CREATE POLICY "Public Access Bank Statements"
-- ON storage.objects FOR SELECT
-- USING ( bucket_id = 'bank_statements' );
-- 
-- CREATE POLICY "Admin Upload Bank Statements"
-- ON storage.objects FOR INSERT
-- WITH CHECK ( bucket_id = 'bank_statements' AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );
