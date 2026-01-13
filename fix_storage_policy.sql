-- Abilita RLS su storage.objects se non è già attivo (di solito lo è)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 1. Policy per PERMETTERE l'UPLOAD (INSERT) nel bucket 'media'
-- Permette a qualsiasi utente autenticato di caricare file nella propria cartella
CREATE POLICY "Utenti possono caricare avatar nella propria cartella"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. Policy per PERMETTERE l'AGGIORNAMENTO (UPDATE) (es. sovrascrivere file)
CREATE POLICY "Utenti possono aggiornare i propri avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'media' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Policy per PERMETTERE la LETTURA (SELECT)
-- Necessario per vedere i file (se il bucket non è impostato come "Public")
CREATE POLICY "Tutti possono vedere gli avatar"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'media');

-- 4. Policy per CANCELLARE (DELETE)
CREATE POLICY "Utenti possono cancellare i propri avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'media' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
