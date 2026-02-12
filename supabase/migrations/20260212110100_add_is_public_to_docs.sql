-- Add is_public column to doc_pages to allow simple toggling of visibility for the whole team
ALTER TABLE public.doc_pages ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
