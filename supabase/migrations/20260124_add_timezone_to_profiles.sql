-- Add timezone column to profiles table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'timezone') THEN
        ALTER TABLE public.profiles ADD COLUMN timezone TEXT DEFAULT 'Europe/Rome';
    END IF;
END $$;
