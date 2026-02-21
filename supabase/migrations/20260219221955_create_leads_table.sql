CREATE TABLE IF NOT EXISTS public.leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_code VARCHAR(50) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    core_service_id UUID REFERENCES public.core_services(id) ON DELETE SET NULL,
    status VARCHAR(100) NOT NULL DEFAULT 'Call di onboarding prenotata',
    macro_status VARCHAR(50) NOT NULL DEFAULT 'in lavorazione' CHECK (macro_status IN ('in lavorazione', 'vinto', 'perso')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add standard updated_at trigger if moddatetime exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'moddatetime') THEN
        CREATE TRIGGER handle_leads_updated_at 
        BEFORE UPDATE ON public.leads
        FOR EACH ROW EXECUTE FUNCTION public.moddatetime('updated_at');
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to perform all operations
CREATE POLICY "Leads are viewable by authenticated users." ON public.leads
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Leads are insertable by authenticated users." ON public.leads
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Leads are updatable by authenticated users." ON public.leads
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Leads are deletable by authenticated users." ON public.leads
    FOR DELETE USING (auth.role() = 'authenticated');
