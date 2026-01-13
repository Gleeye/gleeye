-- Create departments table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#4e92d8',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Policies for public (read-only for guests, authenticated for all for now)
CREATE POLICY "Allow public read departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Allow all for authenticated departments" ON public.departments 
    FOR ALL 
    TO authenticated 
    USING (true)
    WITH CHECK (true);

-- Pre-populate some initial departments based on the user's previous data
INSERT INTO public.departments (name, color)
VALUES 
    ('Account', '#4e92d8'),
    ('Digital Marketing', '#f59e0b'),
    ('Foto', '#ec4899'),
    ('Grafica', '#8b5cf6'),
    ('Podcast', '#10b981'),
    ('Project Manager', '#6366f1'),
    ('Siti Web & E-commerce', '#f43f5e'),
    ('Video', '#614aa2')
ON CONFLICT (name) DO NOTHING;
