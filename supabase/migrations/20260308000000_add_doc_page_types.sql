-- Aggiunge il tipo di pagina per supportare le lavagne (whiteboard)
ALTER TABLE public.doc_pages 
ADD COLUMN IF NOT EXISTS page_type TEXT DEFAULT 'document',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Aggiorna i vecchi record (opzionale ma consigliato per consistenza)
UPDATE public.doc_pages SET page_type = 'document' WHERE page_type IS NULL;
UPDATE public.doc_pages SET metadata = '{}' WHERE metadata IS NULL;
