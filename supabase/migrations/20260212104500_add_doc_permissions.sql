-- Create Doc Page Permissions Table for Department and Collaborator sharing

CREATE TABLE IF NOT EXISTS public.doc_page_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_ref UUID REFERENCES public.doc_pages(id) ON DELETE CASCADE NOT NULL,
    target_type TEXT NOT NULL, -- 'department' or 'collaborator'
    target_id UUID NOT NULL, -- References departments.id or collaborators.id
    access_level TEXT DEFAULT 'view', -- 'view' or 'edit'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(page_ref, target_type, target_id)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_doc_page_permissions_page ON public.doc_page_permissions(page_ref);

-- Enable RLS
ALTER TABLE public.doc_page_permissions ENABLE ROW LEVEL SECURITY;

-- Permissive RLS for MVP (Matching existing docs RLS)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Docs: Public Access Permissions' AND tablename = 'doc_page_permissions') THEN
        CREATE POLICY "Docs: Public Access Permissions" ON public.doc_page_permissions FOR ALL USING (true);
    END IF;
END $$;
