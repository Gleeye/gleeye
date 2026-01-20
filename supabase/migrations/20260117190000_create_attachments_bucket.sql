-- Create attachments bucket for passive invoices
INSERT INTO storage.buckets (id, name, public) 
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY IF NOT EXISTS "Public read attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'attachments');

CREATE POLICY IF NOT EXISTS "Authenticated upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'attachments');

CREATE POLICY IF NOT EXISTS "Authenticated delete own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'attachments' AND owner = auth.uid());
