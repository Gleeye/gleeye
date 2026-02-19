-- Fix Channel Creation RLS and Defaults

-- 1. Set default for created_by in channels
ALTER TABLE public.channels ALTER COLUMN created_by SET DEFAULT auth.uid();

-- 2. Ensure insert policy for channels is correct
DROP POLICY IF EXISTS "Authenticated can create channels" ON public.channels;
CREATE POLICY "insert_channels" ON public.channels
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- 3. Fix channel_members insert policy to allow creators to join their own channels (even private)
DROP POLICY IF EXISTS "Authenticated can join public channels" ON public.channel_members;
CREATE POLICY "insert_channel_members" ON public.channel_members
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = user_id AND
        (
            EXISTS (SELECT 1 FROM public.channels WHERE id = channel_id AND is_private = false) OR
            EXISTS (SELECT 1 FROM public.channels WHERE id = channel_id AND created_by = auth.uid())
        )
    );

-- 4. Conversations also need a default for created_by for consistency
ALTER TABLE public.conversations ALTER COLUMN created_by SET DEFAULT auth.uid();

-- 5. conversation_members policy already allows authenticated to insert for now, 
-- but let's make it a bit more specific if needed.
-- (Leaving it for now as it was already working in DMs)
