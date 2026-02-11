-- Create Documents Module Tables

-- 1. Document Spaces (Workspace per Project)
CREATE TABLE IF NOT EXISTS public.doc_spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_ref UUID REFERENCES public.pm_spaces(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(space_ref) -- One doc space per PM space
);

-- 2. Document Pages (Hierarchy)
CREATE TABLE IF NOT EXISTS public.doc_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_ref UUID REFERENCES public.doc_spaces(id) ON DELETE CASCADE NOT NULL,
    parent_ref UUID REFERENCES public.doc_pages(id) ON DELETE CASCADE, -- Nullable for root pages
    title TEXT NOT NULL DEFAULT 'Untitled',
    icon TEXT, -- Emoji or URL
    cover_image TEXT,
    order_index FLOAT DEFAULT 0, -- For sorting
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for tree traversal
CREATE INDEX IF NOT EXISTS idx_doc_pages_parent ON public.doc_pages(space_ref, parent_ref);
CREATE INDEX IF NOT EXISTS idx_doc_pages_order ON public.doc_pages(space_ref, order_index);

-- 3. Document Blocks (Content)
CREATE TABLE IF NOT EXISTS public.doc_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_ref UUID REFERENCES public.doc_pages(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL DEFAULT 'paragraph', -- paragraph, heading1, heading2, list, checklist, quote, divider, table, image
    content JSONB DEFAULT '{}', -- Flexible content storage
    order_index FLOAT DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for block retrieval
CREATE INDEX IF NOT EXISTS idx_doc_blocks_page ON public.doc_blocks(page_ref, order_index);

-- Enable RLS
ALTER TABLE public.doc_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_blocks ENABLE ROW LEVEL SECURITY;

-- Permissive RLS for MVP
CREATE POLICY "Docs: Public Access Spaces" ON public.doc_spaces FOR ALL USING (true);
CREATE POLICY "Docs: Public Access Pages" ON public.doc_pages FOR ALL USING (true);
CREATE POLICY "Docs: Public Access Blocks" ON public.doc_blocks FOR ALL USING (true);
