-- Create Service Categories Table (Recursive)
CREATE TABLE IF NOT EXISTS public.service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    parent_id UUID REFERENCES public.service_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add category_id to services
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

-- Policies for service_categories
-- Admins/Collaborators (with proper tags) can manage categories
-- Users can view categories (read-only)

DO $$ BEGIN
    CREATE POLICY "Public read access for categories" 
    ON public.service_categories FOR SELECT 
    USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Admins can manage categories" 
    ON public.service_categories FOR ALL 
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
