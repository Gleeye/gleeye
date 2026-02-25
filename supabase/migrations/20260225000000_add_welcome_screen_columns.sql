-- Add welcome screen fields to contact_forms table
ALTER TABLE public.contact_forms
ADD COLUMN IF NOT EXISTS has_welcome_screen BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS welcome_title TEXT,
ADD COLUMN IF NOT EXISTS welcome_description TEXT,
ADD COLUMN IF NOT EXISTS welcome_button_text TEXT;
