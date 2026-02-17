-- Add recurrence fields to pm_items
ALTER TABLE public.pm_items ADD COLUMN IF NOT EXISTS recurrence_rule JSONB;
ALTER TABLE public.pm_items ADD COLUMN IF NOT EXISTS recurrence_id UUID;

-- Add recurrence fields to appointments
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS recurrence_rule JSONB;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS recurrence_id UUID;
