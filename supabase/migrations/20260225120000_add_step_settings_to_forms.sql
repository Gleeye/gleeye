-- Add step_settings to contact_forms
ALTER TABLE public.contact_forms 
ADD COLUMN IF NOT EXISTS step_settings JSONB 
DEFAULT '{"type": "number", "shape": "circle"}'::jsonb;
