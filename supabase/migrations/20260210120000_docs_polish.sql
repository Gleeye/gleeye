-- Add visual polish fields to doc_pages
ALTER TABLE public.doc_pages ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE public.doc_pages ADD COLUMN IF NOT EXISTS icon TEXT;

-- We could also add a 'settings' jsonb column for future flexibility
-- ALTER TABLE public.doc_pages ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
