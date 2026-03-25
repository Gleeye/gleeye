-- Migration to fix pm_activity_logs schema missing columns
-- Date: 2026-03-25

ALTER TABLE public.pm_activity_logs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.pm_activity_logs ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Backfill metadata from details if details was used
UPDATE public.pm_activity_logs 
SET metadata = details 
WHERE metadata IS NULL AND details IS NOT NULL;
