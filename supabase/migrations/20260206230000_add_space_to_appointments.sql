-- Migration: Add pm_space_id to appointments to support internal projects
-- Created for: Fix missing appointments in internal projects

ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS pm_space_id UUID REFERENCES public.pm_spaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_space ON public.appointments(pm_space_id);
