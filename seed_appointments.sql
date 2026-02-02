-- Seed Data for Appointments Verification (Safched)

-- 0. Patch Schema if missing (Local dev alignment)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status_works TEXT DEFAULT 'In Attesa';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS offer_status TEXT DEFAULT 'Bozza';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pm_id UUID REFERENCES auth.users(id);

-- 1. Create a Client
INSERT INTO public.clients (id, business_name, client_code, email)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Client SRL', 'CLI-001', 'test@client.com')
ON CONFLICT (id) DO NOTHING;

-- 2. Create an Order
INSERT INTO public.orders (id, order_number, title, client_id, status_works, offer_status, status)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ORD-2026-001', 'Campagna Test', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'In Corso', 'Offerta Accettata', 'active')
ON CONFLICT (id) DO NOTHING;

-- 3. Create an Appointment
INSERT INTO public.appointments (id, title, start_time, end_time, note, status, mode, location, order_id, client_id)
VALUES (
    'cccccccc-cccc-cccc-cccc-cccccccccccc', 
    'Meeting di alignement', 
    NOW() + INTERVAL '1 day', 
    NOW() + INTERVAL '1 day 1 hour', 
    'Discutere dettagli campagna', 
    'confermato', 
    'remoto', 
    'https://meet.google.com/abc-defg-hij', 
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
)
ON CONFLICT (id) DO NOTHING;

-- 4. Link a Type
INSERT INTO public.appointment_type_links (appointment_id, type_id)
SELECT 'cccccccc-cccc-cccc-cccc-cccccccccccc', id FROM public.appointment_types WHERE name = 'Riunione' LIMIT 1;
