-- Initial scheme for Contact Forms & Submissions
CREATE TABLE IF NOT EXISTS public.contact_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    fields JSONB DEFAULT '[]'::jsonb NOT NULL,
    success_message TEXT,
    primary_color TEXT DEFAULT '#0d6efd',
    is_active BOOLEAN DEFAULT true,
    has_welcome_screen BOOLEAN DEFAULT false,
    welcome_title TEXT,
    welcome_description TEXT,
    welcome_button_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.contact_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID REFERENCES public.contact_forms(id) ON DELETE CASCADE NOT NULL,
    data JSONB NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Contact Forms
ALTER TABLE public.contact_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read active forms" ON public.contact_forms FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated users can manage forms" ON public.contact_forms FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS Submissions
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can insert submissions" ON public.contact_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can view/manage submissions" ON public.contact_submissions FOR ALL TO authenticated USING (true) WITH CHECK (true);
