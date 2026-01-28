-- 1. Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public) 
VALUES ('collaborator-documents', 'collaborator-documents', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing restrictive policies on storage.objects for this bucket to avoid conflicts
DROP POLICY IF EXISTS "Collaborator Documents Insert" ON storage.objects;
DROP POLICY IF EXISTS "Collaborator Documents Select" ON storage.objects;
DROP POLICY IF EXISTS "Collaborator Documents Update" ON storage.objects;
DROP POLICY IF EXISTS "Collaborator Documents Delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated select" ON storage.objects;

-- 3. Create permissible policies for storage.objects
-- Allow any authenticated user to upload to this bucket
CREATE POLICY "Allow authenticated upload collaborator-documents" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'collaborator-documents');

-- Allow any authenticated user to view files in this bucket
CREATE POLICY "Allow authenticated select collaborator-documents" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'collaborator-documents');

-- Allow any authenticated user to update files in this bucket
CREATE POLICY "Allow authenticated update collaborator-documents" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'collaborator-documents');

-- Allow any authenticated user to delete files in this bucket
CREATE POLICY "Allow authenticated delete collaborator-documents" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'collaborator-documents');

-- 4. Ensure Collaborators can update their own record in the DB
-- Check if policy exists or create it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'collaborators' 
        AND policyname = 'Collaborators can update own profile'
    ) THEN
        CREATE POLICY "Collaborators can update own profile" ON public.collaborators
        FOR UPDATE TO authenticated
        USING (auth_user_id = auth.uid())
        WITH CHECK (auth_user_id = auth.uid());
    END IF;
END
$$;
