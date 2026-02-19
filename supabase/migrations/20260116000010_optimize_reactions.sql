-- Optimization: Add channel/conversation context to reactions for easier Realtime and RLS

ALTER TABLE public.reactions 
    ADD COLUMN channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
    ADD COLUMN conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE;

-- Constraint: must have exactly one context (actually, message already has it, 
-- but we denormalize for performance. We should enforce consistency triggers ideally, 
-- but for MVP we rely on application logic to Insert correctly).
-- Let's just enforce that at least one is null? 
-- Or rely on message_id being the truth.
-- We will add a check constraint that it matches message's text? No cross-table CHECK.

-- Drop old policies on reactions that were complex/inefficient
DROP POLICY IF EXISTS "Reactions select complex" ON public.reactions;
DROP POLICY IF EXISTS "Reactions insert" ON public.reactions;
DROP POLICY IF EXISTS "Reactions delete own" ON public.reactions;

-- New Policies
-- Select: Visible if you can see the channel or conversation
CREATE POLICY "Reactions select optimized" ON public.reactions
    FOR SELECT TO authenticated
    USING (
        (channel_id IS NOT NULL AND (
             EXISTS (SELECT 1 FROM public.channels WHERE id = channel_id AND is_private = false) OR
             EXISTS (SELECT 1 FROM public.channel_members WHERE channel_id = reactions.channel_id AND user_id = auth.uid())
        )) OR
        (conversation_id IS NOT NULL AND (
             EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = reactions.conversation_id AND user_id = auth.uid())
        ))
    );

-- Insert: 
CREATE POLICY "Reactions insert optimized" ON public.reactions
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid() AND
        (
             (channel_id IS NOT NULL AND (
                  -- Allow public channel reactions? Yes.
                  EXISTS (SELECT 1 FROM public.channels WHERE id = channel_id AND is_private = false) OR
                  EXISTS (SELECT 1 FROM public.channel_members WHERE channel_id = reactions.channel_id AND user_id = auth.uid())
             )) OR
             (conversation_id IS NOT NULL AND (
                  EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = reactions.conversation_id AND user_id = auth.uid())
             ))
        )
    );

-- Delete own
CREATE POLICY "Reactions delete own" ON public.reactions
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());
