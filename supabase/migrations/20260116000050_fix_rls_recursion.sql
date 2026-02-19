-- Fix RLS Recursion and Optimize Policies

-- 1. Helper functions to break recursion (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_member_of_channel(chan_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE channel_id = chan_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_member_of_conversation(conv_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = conv_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Drop problematic policies
DROP POLICY IF EXISTS "Public channels allow select for authenticated" ON public.channels;
DROP POLICY IF EXISTS "Members visible to authenticated (in public) or members (in private)" ON public.channel_members;
DROP POLICY IF EXISTS "Conversations visible to members" ON public.conversations;
DROP POLICY IF EXISTS "Members visible to members" ON public.conversation_members;
DROP POLICY IF EXISTS "Messages visibility" ON public.messages;
DROP POLICY IF EXISTS "Messages insert" ON public.messages;
DROP POLICY IF EXISTS "Reactions select complex" ON public.reactions;
DROP POLICY IF EXISTS "Reactions insert" ON public.reactions;

-- 3. Re-create non-recursive policies

-- CHANNELS
CREATE POLICY "select_channels" ON public.channels
    FOR SELECT TO authenticated
    USING (is_private = false OR public.is_member_of_channel(id));

-- CHANNEL MEMBERS
CREATE POLICY "select_channel_members" ON public.channel_members
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.channels WHERE id = channel_id AND is_private = false) OR
        user_id = auth.uid() OR
        public.is_member_of_channel(channel_id)
    );

-- CONVERSATIONS
CREATE POLICY "select_conversations" ON public.conversations
    FOR SELECT TO authenticated
    USING (public.is_member_of_conversation(id));

-- CONVERSATION MEMBERS
CREATE POLICY "select_conversation_members" ON public.conversation_members
    FOR SELECT TO authenticated
    USING (public.is_member_of_conversation(conversation_id));

-- MESSAGES
CREATE POLICY "select_messages" ON public.messages
    FOR SELECT TO authenticated
    USING (
        (channel_id IS NOT NULL AND (
            EXISTS (SELECT 1 FROM public.channels WHERE id = channel_id AND is_private = false) OR
            public.is_member_of_channel(channel_id)
        )) OR
        (conversation_id IS NOT NULL AND public.is_member_of_conversation(conversation_id))
    );

CREATE POLICY "insert_messages" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (
        author_id = auth.uid() AND
        (
            (channel_id IS NOT NULL AND public.is_member_of_channel(channel_id)) 
            OR
            (conversation_id IS NOT NULL AND public.is_member_of_conversation(conversation_id))
        )
    );

-- REACTIONS
CREATE POLICY "select_reactions" ON public.reactions
    FOR SELECT TO authenticated
    USING (
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

CREATE POLICY "insert_reactions" ON public.reactions
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.messages m
            WHERE m.id = reactions.message_id
            AND (
                (m.channel_id IS NOT NULL AND public.is_member_of_channel(m.channel_id)) 
                OR
                (m.conversation_id IS NOT NULL AND public.is_member_of_conversation(m.conversation_id))
            )
        )
    );
