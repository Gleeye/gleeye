-- Migration: Add full_name to profiles and keep it synced with collaborators
-- Description: Ensures chat and other features can display user names easily

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Sync initial names from collaborators
UPDATE public.profiles p
SET full_name = c.full_name
FROM public.collaborators c
WHERE p.id = c.user_id
AND p.full_name IS NULL;

-- Trigger to keep profiles.full_name synced with collaborators.full_name
CREATE OR REPLACE FUNCTION public.sync_profile_name()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_id IS NOT NULL THEN
        UPDATE public.profiles
        SET full_name = NEW.full_name
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_profile_name_trigger ON public.collaborators;
CREATE TRIGGER sync_profile_name_trigger
AFTER INSERT OR UPDATE OF full_name ON public.collaborators
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_name();
