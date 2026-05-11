-- Aggiunge le colonne mancanti alla tabella clients
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS vat_number TEXT,
ADD COLUMN IF NOT EXISTS fiscal_code TEXT,
ADD COLUMN IF NOT EXISTS sdi_code TEXT,
ADD COLUMN IF NOT EXISTS pec TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Rinominata se necessario (se avevi già dei campi con nomi diversi)
-- Esempio: if "cap" exists but import expects "zip_code"
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'cap') THEN
    ALTER TABLE public.clients RENAME COLUMN cap TO zip_code;
  END IF;
END
$$;
