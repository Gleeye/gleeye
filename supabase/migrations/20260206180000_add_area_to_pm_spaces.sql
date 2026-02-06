-- Add 'area' column to pm_spaces for Internal Projects
-- This allows linking an internal project to a company area (e.g., Marketing, HR)

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pm_spaces' AND column_name = 'area') THEN
        ALTER TABLE public.pm_spaces ADD COLUMN area TEXT;
    END IF;
END $$;
