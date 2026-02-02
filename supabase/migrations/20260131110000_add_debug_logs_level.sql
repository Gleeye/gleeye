-- Add level column to debug_logs for filtering errors vs info logs
ALTER TABLE public.debug_logs ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'info';

-- Add index for faster filtering by level
CREATE INDEX IF NOT EXISTS idx_debug_logs_level ON public.debug_logs(level);

-- Add is_resolved column to track acknowledged errors
ALTER TABLE public.debug_logs ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT false;
