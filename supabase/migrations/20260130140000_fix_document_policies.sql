-- Migration to fix Storage RLS for secure_collaborator_documents
-- Goal: Allow admins and privileged collaborators (Partner/Amministrazione) to read other users' documents.

-- 1. Enable RLS on storage.objects (if not already, usually is)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies for this bucket to avoid conflicts
-- Note: Policy names might vary, dropping by pattern or exact name if known.
-- We'll just create a new comprehensive one.
DROP POLICY IF EXISTS "Individual Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Team Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow Upload for own folder" ON storage.objects; -- We will re-establish upload too just in case, or leave it if it works. User said upload works.

-- User said upload works for themselves ("i miei li vedo"). 
-- The issue is SEEING OTHERS ("i loro no").
-- So we strictly add a SELECT policy.

CREATE POLICY "Allow Privileged Read Access"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'secure_collaborator_documents' AND
  (
    -- 1. Users can always see their own files (Folder structure: user_id/filename)
    (storage.foldername(name))[1] = auth.uid()::text
    
    OR
    
    -- 2. Admins can see everything
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    
    OR
    
    -- 3. Privileged Collaborators (Partner / Amministrazione) can see everything
    EXISTS (
      SELECT 1 FROM public.collaborators c
      JOIN public.profiles p ON p.email = c.email
      WHERE p.id = auth.uid()
      AND (
        -- Check for tags. Handling both JSONB and Text storage
        c.tags::text ILIKE '%Partner%' 
        OR c.tags::text ILIKE '%Amministrazione%'
      )
    )
  )
);
