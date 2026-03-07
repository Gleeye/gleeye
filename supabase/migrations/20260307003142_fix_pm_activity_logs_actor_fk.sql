-- Remove old FK pointing to auth.users (if it exists)
ALTER TABLE IF EXISTS public.pm_activity_logs 
  DROP CONSTRAINT IF EXISTS pm_activity_logs_actor_user_ref_fkey;

-- Add new FK pointing to public.profiles
ALTER TABLE public.pm_activity_logs
  ADD CONSTRAINT pm_activity_logs_actor_user_ref_fkey
  FOREIGN KEY (actor_user_ref) REFERENCES public.profiles(id) ON DELETE SET NULL;
