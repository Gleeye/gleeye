-- Enable RLS and add policies for tables with security warnings

-- 1. booking_item_collaborators
ALTER TABLE IF EXISTS public.booking_item_collaborators ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    -- Public read access for booking flow
    CREATE POLICY "Public read access for booking_item_collaborators" 
    ON public.booking_item_collaborators FOR SELECT 
    USING (true);

    -- Admin/Manager management
    CREATE POLICY "Admins/Managers manage booking_item_collaborators" 
    ON public.booking_item_collaborators FOR ALL 
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' OR
        EXISTS (
            SELECT 1 FROM collaborators 
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
            AND (role IN ('admin', 'manager'))
        )
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- 2. booking_holds
-- Sensitive data (session_id) exposed. RLS will hide it by default if no SELECT policy allows it.
ALTER TABLE IF EXISTS public.booking_holds ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    -- Allow anonymous users to create holds (needed for public booking)
    -- They cannot read holds (no SELECT policy for anon), protecting session_id
    CREATE POLICY "Anonymous can insert booking_holds" 
    ON public.booking_holds FOR INSERT 
    WITH CHECK (true);

    -- Service role / Admins can view/manage
    CREATE POLICY "Admins can manage booking_holds" 
    ON public.booking_holds FOR ALL 
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- 3. external_calendar_connections
-- Sensitive tokens. Restrict to owner.
ALTER TABLE IF EXISTS public.external_calendar_connections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users manage own external_calendar_connections" 
    ON public.external_calendar_connections FOR ALL 
    USING (collaborator_id = auth.uid())
    WITH CHECK (collaborator_id = auth.uid());
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- 4. external_busy_cache
ALTER TABLE IF EXISTS public.external_busy_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    -- Users can see their own busy cache
    CREATE POLICY "Users view own external_busy_cache" 
    ON public.external_busy_cache FOR SELECT
    USING (collaborator_id = auth.uid());

    -- System/Admin might need to manage it. 
    -- Assuming cache is populated via backend functions (service role) or by the user during sync.
    CREATE POLICY "Users manage own external_busy_cache" 
    ON public.external_busy_cache FOR ALL
    USING (collaborator_id = auth.uid())
    WITH CHECK (collaborator_id = auth.uid());
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- 5. availability_rules
ALTER TABLE IF EXISTS public.availability_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    -- Public read access to know when people are available
    CREATE POLICY "Public read access for availability_rules" 
    ON public.availability_rules FOR SELECT 
    USING (true);

    -- Users manage their own rules
    CREATE POLICY "Users manage own availability_rules" 
    ON public.availability_rules FOR ALL 
    USING (collaborator_id = auth.uid())
    WITH CHECK (collaborator_id = auth.uid());
    
    -- Admins can manage all
    CREATE POLICY "Admins manage all availability_rules" 
    ON public.availability_rules FOR ALL 
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Force schema cache reload
NOTIFY pgrst, 'reload schema';
