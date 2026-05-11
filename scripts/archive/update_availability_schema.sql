-- Add service_id to availability_rules
DO $$ BEGIN
    ALTER TABLE public.availability_rules 
    ADD COLUMN service_id UUID REFERENCES public.services(id);
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Create collaborator_rest_days table
CREATE TABLE IF NOT EXISTS public.collaborator_rest_days (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    collaborator_id UUID REFERENCES public.collaborators(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    repeat_annually BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.collaborator_rest_days ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see/edit their own rest days
DO $$ BEGIN
    CREATE POLICY "Users can manage own rest days" ON public.collaborator_rest_days
        FOR ALL
        USING (
            collaborator_id IN (
                SELECT id FROM public.collaborators 
                WHERE email = auth.jwt() ->> 'email'
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Policy: Admins can do everything
DO $$ BEGIN
    CREATE POLICY "Admins can manage all rest days" ON public.collaborator_rest_days
        FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() AND role = 'admin'
            )
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
