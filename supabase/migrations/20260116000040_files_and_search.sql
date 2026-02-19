-- Sprint 6: Files and Search

-- 1. Storage Bucket for Chat Attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "Public read chat attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-attachments');

CREATE POLICY "Authenticated upload chat attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

CREATE POLICY "Authenticated delete own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-attachments' AND owner = auth.uid());

-- 2. Full-Text Search
-- Add generated column for search vector (english config for now, or 'simple')
ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS fts tsvector 
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(body, ''))) STORED;

-- Create GIN index
CREATE INDEX IF NOT EXISTS messages_fts_idx ON public.messages USING GIN (fts);

-- Search Function
CREATE OR REPLACE FUNCTION public.search_messages(
    query_text text,
    limit_val int DEFAULT 50
)
RETURNS TABLE (
    id uuid,
    body text,
    created_at timestamptz,
    author_id uuid,
    channel_id uuid,
    conversation_id uuid,
    rank float4
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.body,
        m.created_at,
        m.author_id,
        m.channel_id,
        m.conversation_id,
        ts_rank(m.fts, websearch_to_tsquery('english', query_text)) as rank
    FROM public.messages m
    WHERE m.fts @@ websearch_to_tsquery('english', query_text)
    AND m.deleted_at IS NULL
    -- RLS is usually bypassed in SECURITY DEFINER functions, 
    -- so we MUST filter manually for security!
    AND (
        (m.channel_id IS NOT NULL AND (
             EXISTS (SELECT 1 FROM public.channels c WHERE c.id = m.channel_id AND c.is_private = false) OR
             EXISTS (SELECT 1 FROM public.channel_members cm WHERE cm.channel_id = m.channel_id AND cm.user_id = auth.uid())
        )) OR
        (m.conversation_id IS NOT NULL AND (
             EXISTS (SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id = m.conversation_id AND cm.user_id = auth.uid())
        ))
    )
    ORDER BY rank DESC, m.created_at DESC
    LIMIT limit_val;
END;
$$;
