-- Migration to add missing fields to collaborators table
ALTER TABLE public.collaborators 
ADD COLUMN IF NOT EXISTS pec TEXT,
ADD COLUMN IF NOT EXISTS address_cap TEXT,
ADD COLUMN IF NOT EXISTS address_city TEXT,
ADD COLUMN IF NOT EXISTS address_province TEXT;
