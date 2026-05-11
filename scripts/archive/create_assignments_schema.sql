-- Create assignments table
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_id TEXT UNIQUE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    collaborator_id UUID REFERENCES public.collaborators(id) ON DELETE SET NULL,
    description TEXT,
    status TEXT,
    start_date DATE,
    total_amount NUMERIC(10, 2),
    payment_terms TEXT,
    payment_details TEXT,
    pm_notes TEXT,
    drive_link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users" ON public.assignments
    FOR SELECT USING (true);

CREATE POLICY "Enable write access for authenticated users" ON public.assignments
    FOR ALL USING (auth.role() = 'authenticated');
