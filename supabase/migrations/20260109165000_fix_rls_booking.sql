-- Add RLS for booking_categories if missing or broken after renames
ALTER TABLE public.booking_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Public read access for categories" ON public.booking_categories;
    CREATE POLICY "Public read access for categories" 
    ON public.booking_categories FOR SELECT 
    USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Admins can manage categories" ON public.booking_categories;
    CREATE POLICY "Admins can manage categories" 
    ON public.booking_categories FOR ALL 
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

-- Also ensure booking_items has proper RLS
ALTER TABLE public.booking_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Public read access for booking_items" ON public.booking_items;
    CREATE POLICY "Public read access for booking_items" 
    ON public.booking_items FOR SELECT 
    USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Admins/Managers manage booking_items" ON public.booking_items;
    CREATE POLICY "Admins/Managers manage booking_items" 
    ON public.booking_items FOR ALL 
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
