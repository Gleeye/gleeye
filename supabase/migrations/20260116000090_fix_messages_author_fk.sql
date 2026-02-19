-- Fix message author FK to reference profiles instead of auth.users
-- This allows Supabase PostgREST to resolve the relationship correctly

-- 1. Drop existing FK to auth.users if exists
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_author_id_fkey;

-- 2. Add new FK to profiles table
ALTER TABLE public.messages 
  ADD CONSTRAINT messages_author_id_fkey 
  FOREIGN KEY (author_id) REFERENCES public.profiles(id);
