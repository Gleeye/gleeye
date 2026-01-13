-- Create order_collaborators table
CREATE TABLE IF NOT EXISTS public.order_collaborators (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    collaborator_id UUID REFERENCES public.collaborators(id) ON DELETE CASCADE,
    role_in_order TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(order_id, collaborator_id)
);

-- Enable RLS for order_collaborators
ALTER TABLE public.order_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access order_collaborators" ON public.order_collaborators;
CREATE POLICY "Public access order_collaborators" ON public.order_collaborators
    FOR ALL USING (true);


-- Create payments table
-- Note: assignments.id is TEXT, so we reference it as TEXT
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    assignment_id TEXT REFERENCES public.assignments(id) ON DELETE CASCADE,
    amount NUMERIC(15,2),
    status TEXT DEFAULT 'pending', -- pending, paid, cancelled
    payment_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access payments" ON public.payments;
CREATE POLICY "Public access payments" ON public.payments
    FOR ALL USING (true);
