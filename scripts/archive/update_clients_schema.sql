-- Aggiungi campi per la migrazione da Airtable
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS airtable_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS dropbox_folder TEXT,
ADD COLUMN IF NOT EXISTS client_code TEXT;

-- Assicuriamoci che RLS permetta l'inserimento per l'admin (o disabilitiamola temporaneamente per l'import)
DROP POLICY IF EXISTS "Admin can do everything on clients" ON public.clients;
CREATE POLICY "Admin can do everything on clients" 
ON public.clients FOR ALL 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );
