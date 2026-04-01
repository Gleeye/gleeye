-- Final RLS Fix for Availability Tables: Standardizing on user_id correlation
-- Ensures Collaborators can manage their own availability (Rules, Overrides, Rest Days, Connections)
-- while Admins/Partners retain management access.

DO $$
BEGIN
    -- 1. availability_rules
    ALTER TABLE IF EXISTS public.availability_rules ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public read access for availability_rules" ON public.availability_rules;
    DROP POLICY IF EXISTS "Users manage own availability_rules" ON public.availability_rules;
    DROP POLICY IF EXISTS "Admins manage all availability_rules" ON public.availability_rules;

    CREATE POLICY "Public select availability_rules" 
        ON public.availability_rules FOR SELECT USING (true);

    CREATE POLICY "Collaborators manage own availability_rules" 
        ON public.availability_rules FOR ALL 
        USING (
            EXISTS (
                SELECT 1 FROM public.collaborators 
                WHERE id = public.availability_rules.collaborator_id 
                AND user_id = auth.uid()
            ) OR public.is_privileged_user(auth.uid())
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.collaborators 
                WHERE id = public.availability_rules.collaborator_id 
                AND user_id = auth.uid()
            ) OR public.is_privileged_user(auth.uid())
        );

    -- 2. availability_overrides
    ALTER TABLE IF EXISTS public.availability_overrides ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public select overrides" ON public.availability_overrides;
    DROP POLICY IF EXISTS "Collaborators manage own availability_overrides" ON public.availability_overrides;

    CREATE POLICY "Public select availability_overrides" 
        ON public.availability_overrides FOR SELECT USING (true);

    CREATE POLICY "Collaborators manage own availability_overrides" 
        ON public.availability_overrides FOR ALL 
        USING (
            EXISTS (
                SELECT 1 FROM public.collaborators 
                WHERE id = public.availability_overrides.collaborator_id 
                AND user_id = auth.uid()
            ) OR public.is_privileged_user(auth.uid())
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.collaborators 
                WHERE id = public.availability_overrides.collaborator_id 
                AND user_id = auth.uid()
            ) OR public.is_privileged_user(auth.uid())
        );

    -- 3. external_calendar_connections
    ALTER TABLE IF EXISTS public.external_calendar_connections ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users manage own external_calendar_connections" ON public.external_calendar_connections;

    CREATE POLICY "Collaborators manage own external_calendar_connections" 
        ON public.external_calendar_connections FOR ALL 
        USING (
            EXISTS (
                SELECT 1 FROM public.collaborators 
                WHERE id = public.external_calendar_connections.collaborator_id 
                AND user_id = auth.uid()
            ) OR public.is_privileged_user(auth.uid())
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.collaborators 
                WHERE id = public.external_calendar_connections.collaborator_id 
                AND user_id = auth.uid()
            ) OR public.is_privileged_user(auth.uid())
        );

    -- 4. external_busy_cache
    ALTER TABLE IF EXISTS public.external_busy_cache ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users view own external_busy_cache" ON public.external_busy_cache;
    DROP POLICY IF EXISTS "Users manage own external_busy_cache" ON public.external_busy_cache;

    CREATE POLICY "Collaborators manage own external_busy_cache" 
        ON public.external_busy_cache FOR ALL 
        USING (
            EXISTS (
                SELECT 1 FROM public.collaborators 
                WHERE id = public.external_busy_cache.collaborator_id 
                AND user_id = auth.uid()
            ) OR public.is_privileged_user(auth.uid())
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.collaborators 
                WHERE id = public.external_busy_cache.collaborator_id 
                AND user_id = auth.uid()
            ) OR public.is_privileged_user(auth.uid())
        );

    -- 5. collaborator_rest_days
    ALTER TABLE IF EXISTS public.collaborator_rest_days ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can manage own rest days" ON public.collaborator_rest_days;
    DROP POLICY IF EXISTS "Admins can manage all rest days" ON public.collaborator_rest_days;

    CREATE POLICY "Collaborators/Privileged manage rest days" 
        ON public.collaborator_rest_days FOR ALL 
        USING (
            EXISTS (
                SELECT 1 FROM public.collaborators 
                WHERE id = public.collaborator_rest_days.collaborator_id 
                AND user_id = auth.uid()
            ) OR public.is_privileged_user(auth.uid())
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.collaborators 
                WHERE id = public.collaborator_rest_days.collaborator_id 
                AND user_id = auth.uid()
            ) OR public.is_privileged_user(auth.uid())
        );

END $$;

NOTIFY pgrst, 'reload schema';
