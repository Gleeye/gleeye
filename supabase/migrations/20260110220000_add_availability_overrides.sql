-- 4. Create availability_overrides (for specific extra dates)
CREATE TABLE IF NOT EXISTS public.availability_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collaborator_id UUID REFERENCES public.collaborators(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    service_id UUID REFERENCES public.services(id), -- Optional: specific service for this slot
    is_available BOOLEAN DEFAULT TRUE, -- Future proofing, though we use rest_days for unavailable
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.availability_overrides ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
    CREATE POLICY "Users can manage own overrides" ON public.availability_overrides
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

DO $$ BEGIN
    CREATE POLICY "Admins can manage all overrides" ON public.availability_overrides
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

-- Permissions
GRANT ALL ON TABLE public.availability_overrides TO postgres, anon, authenticated, service_role;

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
