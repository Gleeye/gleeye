-- Create debug_logs table
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    function_name TEXT NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert logs (for debugging purposes)
DROP POLICY IF EXISTS "Enable insert for all" ON public.debug_logs;
CREATE POLICY "Enable insert for all" ON public.debug_logs
    FOR INSERT WITH CHECK (true);

-- Allow admins to view logs
DROP POLICY IF EXISTS "Enable view for admins" ON public.debug_logs;
CREATE POLICY "Enable view for admins" ON public.debug_logs
    FOR SELECT USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' OR
        EXISTS (
            SELECT 1 FROM collaborators 
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
            AND role = 'admin'
        )
    );
