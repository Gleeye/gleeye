-- Force create tables if they missed the boat
-- 1. Appointment Types Catalog
CREATE TABLE IF NOT EXISTS public.appointment_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#3b82f6',
    icon TEXT DEFAULT 'event',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed defaults (safe on conflict)
INSERT INTO public.appointment_types (name, color, icon) VALUES
    ('Riunione', '#3b82f6', 'groups'),
    ('Shooting', '#f59e0b', 'camera_alt'),
    ('Riprese Video', '#ef4444', 'videocam'),
    ('Workshop', '#8b5cf6', 'school'),
    ('Call Cliente', '#10b981', 'call')
ON CONFLICT (name) DO NOTHING;

-- 2. Appointments Table
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    note TEXT,
    status TEXT DEFAULT 'bozza' CHECK (status IN ('bozza', 'confermato', 'annullato')),
    mode TEXT DEFAULT 'remoto' CHECK (mode IN ('remoto', 'in_presenza')),
    location TEXT,
    
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Link Types <-> Appointments (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.appointment_type_links (
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
    type_id UUID REFERENCES public.appointment_types(id) ON DELETE CASCADE,
    PRIMARY KEY (appointment_id, type_id)
);

-- 4. Internal Participants
CREATE TABLE IF NOT EXISTS public.appointment_internal_participants (
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
    collaborator_id UUID REFERENCES public.collaborators(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'participant', 
    status TEXT DEFAULT 'pending',
    required BOOLEAN DEFAULT true,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (appointment_id, collaborator_id)
);

-- 5. Client Participants
CREATE TABLE IF NOT EXISTS public.appointment_client_participants (
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    required BOOLEAN DEFAULT true,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (appointment_id, contact_id)
);

-- Enable RLS (Idempotentally?)
ALTER TABLE public.appointment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_type_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_internal_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_client_participants ENABLE ROW LEVEL SECURITY;

-- Grants (safe to re-run)
GRANT ALL ON public.appointment_types TO authenticated;
GRANT ALL ON public.appointments TO authenticated;
GRANT ALL ON public.appointment_type_links TO authenticated;
GRANT ALL ON public.appointment_internal_participants TO authenticated;
GRANT ALL ON public.appointment_client_participants TO authenticated;

GRANT ALL ON public.appointment_types TO service_role;
GRANT ALL ON public.appointments TO service_role;
GRANT ALL ON public.appointment_type_links TO service_role;
GRANT ALL ON public.appointment_internal_participants TO service_role;
GRANT ALL ON public.appointment_client_participants TO service_role;

-- Force Schema Cache Reload
NOTIFY pgrst, 'reload schema';
