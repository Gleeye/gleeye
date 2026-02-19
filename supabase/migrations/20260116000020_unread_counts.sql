-- Sprint 4: Unread Counts and Read Status Helper

-- Function to get unread counts for all channels/conversations for the current user
-- Returns list of { context_id, count, type }
CREATE OR REPLACE FUNCTION public.get_unread_counts()
RETURNS TABLE (
    context_id uuid,
    count bigint,
    type text, -- 'channel' or 'dm'
    last_read_message_id uuid
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    curr_user_id uuid;
BEGIN
    curr_user_id := auth.uid();

    RETURN QUERY
    -- Channels
    SELECT 
        c.id as context_id,
        (
            SELECT count(*) 
            FROM public.messages m 
            WHERE m.channel_id = c.id 
            AND m.created_at > COALESCE(mr.last_read_at, '1970-01-01')
            AND m.deleted_at IS NULL
        ) as count,
        'channel' as type,
        mr.last_read_message_id
    FROM public.channels c
    LEFT JOIN public.channel_members cm ON c.id = cm.channel_id
    LEFT JOIN public.message_reads mr ON c.id = mr.channel_id AND mr.user_id = curr_user_id
    WHERE (c.is_private = false OR cm.user_id = curr_user_id)
    
    UNION ALL

    -- Conversations (DM/Group)
    SELECT 
        conv.id as context_id,
        (
            SELECT count(*) 
            FROM public.messages m 
            WHERE m.conversation_id = conv.id 
            AND m.created_at > COALESCE(mr.last_read_at, '1970-01-01')
            AND m.deleted_at IS NULL
        ) as count,
        'dm' as type,
        mr.last_read_message_id
    FROM public.conversations conv
    JOIN public.conversation_members cm ON conv.id = cm.conversation_id
    LEFT JOIN public.message_reads mr ON conv.id = mr.conversation_id AND mr.user_id = curr_user_id
    WHERE cm.user_id = curr_user_id;

END;
$$;

-- Function to mark a message (and everything before it) as read
CREATE OR REPLACE FUNCTION public.mark_message_read(
    p_message_id uuid,
    p_channel_id uuid DEFAULT NULL,
    p_conversation_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_created_at timestamptz;
BEGIN
    -- Get message timestamp
    SELECT created_at INTO v_created_at FROM public.messages WHERE id = p_message_id;
    
    IF v_created_at IS NULL THEN
        RAISE EXCEPTION 'Message not found';
    END IF;

    -- Upsert into message_reads
    INSERT INTO public.message_reads (user_id, channel_id, conversation_id, last_read_message_id, last_read_at)
    VALUES (auth.uid(), p_channel_id, p_conversation_id, p_message_id, v_created_at)
    ON CONFLICT (user_id, channel_id) WHERE channel_id IS NOT NULL 
    DO UPDATE SET 
        last_read_message_id = EXCLUDED.last_read_message_id,
        last_read_at = EXCLUDED.last_read_at
        WHERE message_reads.last_read_at < EXCLUDED.last_read_at; -- Only update forward
        
    -- Handle Separate Unique constraints... actually we have 2 unique constraints.
    -- Postgres ON CONFLICT requires specific constraint name or column list.
    -- "unique (user_id, channel_id)" and "unique (user_id, conversation_id)"
    -- We need separate statements or a smarter upsert.
    
    -- Let's retry with separate blocks to be safe.
    IF p_channel_id IS NOT NULL THEN
        INSERT INTO public.message_reads (user_id, channel_id, last_read_message_id, last_read_at)
        VALUES (auth.uid(), p_channel_id, p_message_id, v_created_at)
        ON CONFLICT (user_id, channel_id) 
        DO UPDATE SET 
            last_read_message_id = EXCLUDED.last_read_message_id,
            last_read_at = EXCLUDED.last_read_at
            WHERE message_reads.last_read_at < EXCLUDED.last_read_at;
    ELSIF p_conversation_id IS NOT NULL THEN
        INSERT INTO public.message_reads (user_id, conversation_id, last_read_message_id, last_read_at)
        VALUES (auth.uid(), p_conversation_id, p_message_id, v_created_at)
        ON CONFLICT (user_id, conversation_id)
        DO UPDATE SET 
            last_read_message_id = EXCLUDED.last_read_message_id,
            last_read_at = EXCLUDED.last_read_at
             WHERE message_reads.last_read_at < EXCLUDED.last_read_at;
    END IF;
END;
$$;
