-- Migration to add missing fields for the expanded profile
ALTER TABLE public.collaborators 
ADD COLUMN IF NOT EXISTS pec TEXT,
ADD COLUMN IF NOT EXISTS address_cap TEXT,
ADD COLUMN IF NOT EXISTS address_city TEXT,
ADD COLUMN IF NOT EXISTS address_province TEXT,
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;
