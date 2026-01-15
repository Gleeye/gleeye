-- Migration: Add is_active field to collaborators
-- Date: 2026-01-15

-- Add is_active column with default true
ALTER TABLE public.collaborators 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Update all existing collaborators to be active by default
UPDATE public.collaborators 
SET is_active = TRUE 
WHERE is_active IS NULL;
