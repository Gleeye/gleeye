CREATE TABLE IF NOT EXISTS public.appointment_google_sync (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    google_event_id TEXT NOT NULL,
    google_calendar_id TEXT NOT NULL,
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'synced' CHECK (status IN ('synced', 'error', 'pending')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(appointment_id, user_id)
);

-- RLS
ALTER TABLE public.appointment_google_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync records" ON public.appointment_google_sync
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync records" ON public.appointment_google_sync
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync records" ON public.appointment_google_sync
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sync records" ON public.appointment_google_sync
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- Service Role (Edge Function) needs full access
GRANT ALL ON public.appointment_google_sync TO service_role;
