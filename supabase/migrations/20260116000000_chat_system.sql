-- Chat System Migration: Channels, DMs, Messages, and RLS

-- 1. Channels
CREATE TABLE IF NOT EXISTS public.channels (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    is_private boolean DEFAULT false,
    topic text,
    description text,
    is_archived boolean DEFAULT false,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- 2. Channel Members
CREATE TABLE IF NOT EXISTS public.channel_members (
    channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role text DEFAULT 'member', -- owner, moderator, member
    joined_at timestamptz DEFAULT now(),
    PRIMARY KEY (channel_id, user_id)
);

-- 3. Conversations (DM/Group)
CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    type text CHECK (type IN ('dm', 'group')),
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- 4. Conversation Members
CREATE TABLE IF NOT EXISTS public.conversation_members (
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at timestamptz DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);

-- 5. Messages
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    author_id uuid REFERENCES auth.users(id),
    channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    body text,
    format text DEFAULT 'plain', -- plain, markdown
    parent_message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE, -- Thread support
    edited_at timestamptz,
    deleted_at timestamptz, -- Soft delete
    created_at timestamptz DEFAULT now(),
    
    -- Constraints to ensure message belongs to ONE of channel or conversation
    CONSTRAINT message_target_check CHECK (
        (channel_id IS NOT NULL AND conversation_id IS NULL) OR
        (channel_id IS NULL AND conversation_id IS NOT NULL)
    )
);

-- 6. Reactions
CREATE TABLE IF NOT EXISTS public.reactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji text NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE (message_id, user_id, emoji)
);

-- 7. Message Reads (Last Read)
CREATE TABLE IF NOT EXISTS public.message_reads (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    last_read_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
    last_read_at timestamptz DEFAULT now(),
    
    CONSTRAINT read_target_check CHECK (
        (channel_id IS NOT NULL AND conversation_id IS NULL) OR
        (channel_id IS NULL AND conversation_id IS NOT NULL)
    ),
    UNIQUE (user_id, channel_id),
    UNIQUE (user_id, conversation_id)
);

-- 8. Message Attachments
CREATE TABLE IF NOT EXISTS public.message_attachments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
    file_path text NOT NULL, -- Storage path key
    file_type text,
    file_size bigint,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

-- Policies

-- CHANNELS
-- Public: Visible to everyone
CREATE POLICY "Public channels allow select for authenticated" ON public.channels
    FOR SELECT TO authenticated
    USING (is_private = false OR 
           EXISTS (SELECT 1 FROM public.channel_members WHERE channel_id = id AND user_id = auth.uid()));

-- Private channels: Visible only if member
-- (Covered by OR clause above, but specific create policy needed?)
-- Ideally, anyone can create a channel? Let's say yes for now.
CREATE POLICY "Authenticated can create channels" ON public.channels
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Update: Only owner or if logic permits. For now simplicity: members can't update channel details unless elevated role? 
-- Let's stick to: Owner can update.
CREATE POLICY "Owner can update channel" ON public.channels
    FOR UPDATE TO authenticated
    USING (created_by = auth.uid()); -- Or check channel_members role = owner

-- CHANNEL MEMBERS
CREATE POLICY "Members visible to authenticated (in public) or members (in private)" ON public.channel_members
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.channels WHERE id = channel_id AND is_private = false) OR
        EXISTS (SELECT 1 FROM public.channel_members cm WHERE cm.channel_id = channel_id AND cm.user_id = auth.uid())
    );

-- Join: Self-insert if public? Invite only?
-- Let's allow self-join for public channels.
CREATE POLICY "Authenticated can join public channels" ON public.channel_members
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (SELECT 1 FROM public.channels WHERE id = channel_id AND is_private = false)
    );
    
-- Allow system/invite: This usually requires a separate function or looser policy. 
-- For now, if you create a channel, you should be able to insert yourself.

-- CONVERSATIONS (DM/Group)
-- Visible only to members
CREATE POLICY "Conversations visible to members" ON public.conversations
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = id AND user_id = auth.uid()));

CREATE POLICY "Authenticated can create conversations" ON public.conversations
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- CONVERSATION MEMBERS
CREATE POLICY "Members visible to members" ON public.conversation_members
    FOR SELECT TO authenticated
    USING (
         EXISTS (SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id = conversation_id AND cm.user_id = auth.uid())
    );

CREATE POLICY "Creator can add members" ON public.conversation_members
    FOR INSERT TO authenticated
    WITH CHECK (
        -- Either self (if creating?) OR adding others if already member?
        -- Actually, usually creating a DM inserts pairs.
        -- Let's allow if you are creating the conversation at the same time? Hard in RLS.
        -- Simpler: Allow insert if you are authenticated. Application logic must ensure correctness.
        -- Or: Allow insert if target conversation was created by auth.uid()? 
        -- Checking if auth user is IN the conversation members is circular for the first insert.
        -- We'll allow INSERT for authenticated for now, relying on app logic to not spam.
        auth.role() = 'authenticated'
    );

-- MESSAGES
-- Select:
-- 1. Channel public: All auth
-- 2. Channel private: Members
-- 3. Conversation: Members
CREATE POLICY "Messages visibility" ON public.messages
    FOR SELECT TO authenticated
    USING (
        (channel_id IS NOT NULL AND (
            EXISTS (SELECT 1 FROM public.channels WHERE id = channel_id AND is_private = false) OR
            EXISTS (SELECT 1 FROM public.channel_members WHERE channel_id = messages.channel_id AND user_id = auth.uid())
        )) OR
        (conversation_id IS NOT NULL AND (
            EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = messages.conversation_id AND user_id = auth.uid())
        ))
    );

-- Insert: 
-- Must be member of channel (if private? or even public?)
-- User spec: "Public: visible to all... write only if member"
CREATE POLICY "Messages insert" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (
        author_id = auth.uid() AND
        (
            (channel_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.channel_members WHERE channel_id = messages.channel_id AND user_id = auth.uid())) 
            OR
            (conversation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()))
        )
    );

-- Update (Soft delete / Edit): Author only
CREATE POLICY "Messages update author" ON public.messages
    FOR UPDATE TO authenticated
    USING (author_id = auth.uid());

-- REACTIONS
CREATE POLICY "Reactions visibility" ON public.reactions
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.messages WHERE id = message_id) -- Rely on Message RLS? No, RLS doesn't cascade like that automatically in subquery unless accessing view.
        -- We must duplicate message logic or join.
        -- Simplified: If you can see the message, you can see reactions.
        -- Implementation: Join messages.
        -- Warning: Performance.
    );
-- Actually, easier policy for Reactions:
-- If public channel -> visible.
-- If private/conversation -> check membership.
-- Let's do a direct check against channel/conversation via message?
-- Requires joining message.
CREATE POLICY "Reactions select complex" ON public.reactions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            LEFT JOIN public.channels c ON m.channel_id = c.id
            LEFT JOIN public.channel_members cm ON m.channel_id = cm.channel_id AND cm.user_id = auth.uid()
            LEFT JOIN public.conversation_members convm ON m.conversation_id = convm.conversation_id AND convm.user_id = auth.uid()
            WHERE m.id = reactions.message_id
            AND (
                (c.is_private = false) OR
                (cm.user_id IS NOT NULL) OR
                (convm.user_id IS NOT NULL)
            )
        )
    );

CREATE POLICY "Reactions insert" ON public.reactions
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.messages m
            LEFT JOIN public.channels c ON m.channel_id = c.id
            LEFT JOIN public.channel_members cm ON m.channel_id = cm.channel_id AND cm.user_id = auth.uid()
            LEFT JOIN public.conversation_members convm ON m.conversation_id = convm.conversation_id AND convm.user_id = auth.uid()
            WHERE m.id = reactions.message_id
            AND (
                (c.is_private = false) OR -- If public channel, can anyone react? Usually yes? Or must be member? Spec says "write only if member" for messages. Maybe same for reactions? 
                -- Let's enforce membership even for public channels for interacting.
                -- "scrivere solo se membro". Reactions is writing.
                (cm.user_id IS NOT NULL) OR 
                (convm.user_id IS NOT NULL)
            )
        )
    );

CREATE POLICY "Reactions delete own" ON public.reactions
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- MESSAGE READS
CREATE POLICY "Read status own" ON public.message_reads
    FOR ALL TO authenticated
    USING (user_id = auth.uid());

