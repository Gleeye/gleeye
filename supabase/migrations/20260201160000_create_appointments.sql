-- Migration: Create Appointments Module Schema
-- Sprint 1: Data Model

-- 1. Appointment Types Catalog
CREATE TABLE IF NOT EXISTS public.appointment_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#3b82f6',
    icon TEXT DEFAULT 'event',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed defaults
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
    location TEXT, -- Link if remote, Address if in_presenza
    
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
    role TEXT DEFAULT 'participant', -- 'pm', 'watcher', 'participant'
    status TEXT DEFAULT 'pending', -- 'accepted', 'declined', 'pending'
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

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_appointments_order ON public.appointments(order_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON public.appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start ON public.appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appt_internal_collab ON public.appointment_internal_participants(collaborator_id);

-- 7. RLS
ALTER TABLE public.appointment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_type_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_internal_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_client_participants ENABLE ROW LEVEL SECURITY;

-- Simple policies for MVP (Authenticated users can read all, insert all for now - refine later)
CREATE POLICY "Auth read types" ON public.appointment_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read appointments" ON public.appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update appointments" ON public.appointments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete appointments" ON public.appointments FOR DELETE TO authenticated USING (true);

-- Same for links/participants
CREATE POLICY "Auth all links" ON public.appointment_type_links FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth all internal" ON public.appointment_internal_participants FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth all client" ON public.appointment_client_participants FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Grant permissions
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
