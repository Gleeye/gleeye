-- Fix Permissions for Chat Tables

-- Ensure authenticated role has access to the schema and tables
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Ensure RLS is actually enabled (it should be, but let's be sure)
ALTER TABLE IF EXISTS public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.message_attachments ENABLE ROW LEVEL SECURITY;

-- Add some default public channels if none exist
INSERT INTO public.channels (name, is_private, description)
SELECT 'generale', false, 'Canale per discussioni generali'
WHERE NOT EXISTS (SELECT 1 FROM public.channels WHERE name = 'generale');

INSERT INTO public.channels (name, is_private, description)
SELECT 'casuale', false, 'Canale per discussioni off-topic'
WHERE NOT EXISTS (SELECT 1 FROM public.channels WHERE name = 'casuale');
