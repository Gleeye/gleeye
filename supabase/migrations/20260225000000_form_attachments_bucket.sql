-- Create bucket for contact form attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('form-attachments', 'form-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for public upload and view
CREATE POLICY "Public Upload Admin" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'form-attachments');
CREATE POLICY "Public View Admin" ON storage.objects FOR SELECT USING (bucket_id = 'form-attachments');
