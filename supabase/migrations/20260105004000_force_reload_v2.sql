ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS _force_reload text;
ALTER TABLE public.suppliers DROP COLUMN IF EXISTS _force_reload;
NOTIFY pgrst, 'reload config';
