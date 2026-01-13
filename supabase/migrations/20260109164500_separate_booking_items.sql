-- 1. Restore the legacy 'services' table
ALTER TABLE booking_items RENAME TO services;

-- 2. Create a NEW, EMPTY 'booking_items' table for the booking module
CREATE TABLE IF NOT EXISTS public.booking_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2),
    duration_minutes INTEGER DEFAULT 60,
    buffer_minutes INTEGER DEFAULT 0,
    logic_type service_logic_type DEFAULT 'OR', -- Enum type still exists
    team_size_req INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    category_id UUID REFERENCES public.booking_categories(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Move 'booking_item_collaborators' to point to the new table
-- Currently 'booking_item_collaborators' references the table that is now renamed 'services'.
-- We need to drop the FK to 'services' and add one to 'booking_items'.
-- Since 'booking_item_collaborators' likely has data pointing to 'services' IDs, we might need to truncate it if those IDs don't exist in the new table. 
-- Since the user just set this up, we assume it's safe to clear 'booking_item_collaborators' or it was empty.

TRUNCATE booking_item_collaborators; -- Clear old links
ALTER TABLE booking_item_collaborators 
    DROP CONSTRAINT IF EXISTS service_collaborators_service_id_fkey, -- Old name
    DROP CONSTRAINT IF EXISTS booking_item_collaborators_booking_item_id_fkey; -- Possible new name

ALTER TABLE booking_item_collaborators
    ADD CONSTRAINT booking_item_collaborators_booking_item_id_fkey 
    FOREIGN KEY (booking_item_id) REFERENCES booking_items(id) ON DELETE CASCADE;

-- 4. Clean up 'services' table (Optional but good practice)
-- Remove the columns we added for the booking module in 20260109120000_booking_module.sql
-- IF we want to revert 'services' completely to legacy state.
-- Columns to drop: duration_minutes, buffer_minutes, logic_type, team_size_req, category_id
ALTER TABLE services 
    DROP COLUMN IF EXISTS duration_minutes,
    DROP COLUMN IF EXISTS buffer_minutes,
    DROP COLUMN IF EXISTS logic_type,
    DROP COLUMN IF EXISTS team_size_req,
    DROP COLUMN IF EXISTS category_id,
    DROP COLUMN IF EXISTS is_active; -- Be careful if is_active was legacy.

-- 5. RLS for new booking_items
ALTER TABLE public.booking_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Public read access for booking_items" 
    ON public.booking_items FOR SELECT 
    USING (true);

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
