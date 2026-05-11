
-- Create order_contacts table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.order_contacts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'Referente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(order_id, contact_id)
);

-- Enable RLS
ALTER TABLE public.order_contacts ENABLE ROW LEVEL SECURITY;

-- Policy (Allow all for now, or match restricted)
CREATE POLICY "Enable all access for authenticated users" ON public.order_contacts FOR ALL USING (auth.role() = 'authenticated');
