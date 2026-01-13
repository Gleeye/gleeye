-- Aggiorna la tabella orders per la migrazione
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS order_date DATE,
ADD COLUMN IF NOT EXISTS total_amount NUMERIC,
ADD COLUMN IF NOT EXISTS airtable_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS offer_status TEXT,
ADD COLUMN IF NOT EXISTS price_planned NUMERIC,
ADD COLUMN IF NOT EXISTS price_actual NUMERIC,
ADD COLUMN IF NOT EXISTS cost_planned NUMERIC,
ADD COLUMN IF NOT EXISTS cost_actual NUMERIC,
ADD COLUMN IF NOT EXISTS revenue_planned NUMERIC,
ADD COLUMN IF NOT EXISTS revenue_actual NUMERIC;

-- Assicuriamoci che RLS permetta l'admin
DROP POLICY IF EXISTS "Admin can do everything on orders" ON public.orders;
CREATE POLICY "Admin can do everything on orders" 
ON public.orders FOR ALL 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- Elimina i vecchi dati se necessario (opzionale, ma utile per ripartire puliti)
-- DELETE FROM public.orders;
