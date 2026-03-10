-- Create voice_memos bucket for meeting recordings
INSERT INTO storage.buckets (id, name, public) 
VALUES ('voice_memos', 'voice_memos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for voice_memos
CREATE POLICY "Public read voice_memos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'voice_memos');

CREATE POLICY "Authenticated upload voice_memos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'voice_memos');

CREATE POLICY "Authenticated delete own voice_memos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'voice_memos' AND owner = auth.uid());

-- Ensure documents module is ready for reports
-- (Already exists from previous research, but ensuring consistency)
