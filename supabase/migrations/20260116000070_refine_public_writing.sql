-- Refine Message/Reaction Policies to allow public access

-- Drop previous ones
DROP POLICY IF EXISTS "insert_messages" ON public.messages;
DROP POLICY IF EXISTS "insert_reactions" ON public.reactions;

-- New Policies: Anyone authenticated can post to PUBLIC channels. 
-- Membership only required for PRIVATE channels and CONVERSATIONS.
CREATE POLICY "insert_messages" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (
        author_id = auth.uid() AND
        (
            (channel_id IS NOT NULL AND (
                EXISTS (SELECT 1 FROM public.channels WHERE id = channel_id AND is_private = false) OR
                public.is_member_of_channel(channel_id)
            )) 
            OR
            (conversation_id IS NOT NULL AND public.is_member_of_conversation(conversation_id))
        )
    );

CREATE POLICY "insert_reactions" ON public.reactions
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.messages m
            WHERE m.id = reactions.message_id
            AND (
                (m.channel_id IS NOT NULL AND (
                   EXISTS (SELECT 1 FROM public.channels WHERE id = m.channel_id AND is_private = false) OR
                   public.is_member_of_channel(m.channel_id)
                )) OR
                (m.conversation_id IS NOT NULL AND public.is_member_of_conversation(m.conversation_id))
            )
        )
    );
