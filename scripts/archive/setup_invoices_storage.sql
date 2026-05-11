-- Create 'invoices' bucket if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Policy for INSERT (Authenticated users can upload invoices)
CREATE POLICY "Users can upload invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoices');

-- Policy for SELECT (Public access for invoices - or authenticated only?)
-- For now making it public for simplicity with shared links, 
-- but ideally should be authenticated. 
-- User asked for "Permanent links", public bucket is easiest for "download url".
CREATE POLICY "Anyone can view invoices"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'invoices');

-- Policy for UPDATE
CREATE POLICY "Users can update invoices"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'invoices');

-- Policy for DELETE
CREATE POLICY "Users can delete invoices"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'invoices');
