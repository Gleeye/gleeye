-- Create PM Spaces
DO $$ BEGIN
    CREATE TYPE pm_space_type AS ENUM ('commessa', 'interno');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.pm_spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type pm_space_type NOT NULL,
    ref_ordine UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    name TEXT,
    default_pm_user_ref UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for spaces
ALTER TABLE public.pm_spaces ENABLE ROW LEVEL SECURITY;

-- Create PM Items
DO $$ BEGIN
    CREATE TYPE pm_item_type AS ENUM ('attivita', 'task', 'milestone');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.pm_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_ref UUID REFERENCES public.pm_spaces(id) ON DELETE CASCADE NOT NULL,
    parent_ref UUID REFERENCES public.pm_items(id) ON DELETE CASCADE,
    item_type pm_item_type NOT NULL DEFAULT 'task',
    title TEXT NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    impact TEXT DEFAULT 'medium',
    start_date TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    pm_user_ref UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_user_ref UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    archived_at TIMESTAMPTZ
);

-- Indexes for items
CREATE INDEX IF NOT EXISTS idx_pm_items_space ON public.pm_items(space_ref);
CREATE INDEX IF NOT EXISTS idx_pm_items_parent ON public.pm_items(parent_ref);
CREATE INDEX IF NOT EXISTS idx_pm_items_status ON public.pm_items(space_ref, status);
CREATE INDEX IF NOT EXISTS idx_pm_items_due ON public.pm_items(space_ref, due_date);

ALTER TABLE public.pm_items ENABLE ROW LEVEL SECURITY;

-- Assignees
CREATE TABLE IF NOT EXISTS public.pm_item_assignees (
    pm_item_ref UUID REFERENCES public.pm_items(id) ON DELETE CASCADE,
    user_ref UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'assignee',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (pm_item_ref, user_ref)
);

ALTER TABLE public.pm_item_assignees ENABLE ROW LEVEL SECURITY;

-- Incarichi Bridge (assignments.id is TEXT!)
CREATE TABLE IF NOT EXISTS public.pm_item_incarichi (
    pm_item_ref UUID REFERENCES public.pm_items(id) ON DELETE CASCADE,
    incarico_ref TEXT REFERENCES public.assignments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (pm_item_ref, incarico_ref)
);

CREATE INDEX IF NOT EXISTS idx_pm_item_incarichi_ref ON public.pm_item_incarichi(incarico_ref);
ALTER TABLE public.pm_item_incarichi ENABLE ROW LEVEL SECURITY;

-- Comments
CREATE TABLE IF NOT EXISTS public.pm_item_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pm_item_ref UUID REFERENCES public.pm_items(id) ON DELETE CASCADE NOT NULL,
    author_user_ref UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    body TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pm_comments_item ON public.pm_item_comments(pm_item_ref, created_at);
ALTER TABLE public.pm_item_comments ENABLE ROW LEVEL SECURITY;

-- Links (to clients/contacts etc)
CREATE TABLE IF NOT EXISTS public.pm_item_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pm_item_ref UUID REFERENCES public.pm_items(id) ON DELETE CASCADE NOT NULL,
    linked_entity_type TEXT NOT NULL,
    linked_entity_ref TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pm_item_links ENABLE ROW LEVEL SECURITY;

-- Helpers
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup existing policies to avoid duplicates
DO $$ BEGIN
    DROP POLICY IF EXISTS "Spaces: Admin access" ON public.pm_spaces;
    DROP POLICY IF EXISTS "Spaces: PM access" ON public.pm_spaces;
    DROP POLICY IF EXISTS "Spaces: Collaborator access (assigned to order)" ON public.pm_spaces;
    DROP POLICY IF EXISTS "Items: Admin access" ON public.pm_items;
    DROP POLICY IF EXISTS "Items: Space PM access" ON public.pm_items;
    DROP POLICY IF EXISTS "Items: Collaborator visibility" ON public.pm_items;
    DROP POLICY IF EXISTS "Items: Collaborator update own" ON public.pm_items;
    DROP POLICY IF EXISTS "Children: Access if parent visible" ON public.pm_item_comments;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- PM SPACES RLS
CREATE POLICY "Spaces: Admin access" ON public.pm_spaces
    FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Spaces: PM access" ON public.pm_spaces
    FOR ALL USING (default_pm_user_ref = auth.uid());

CREATE POLICY "Spaces: Collaborator access (assigned to order)" ON public.pm_spaces
    FOR SELECT USING (
        type = 'commessa' AND
        EXISTS (
            SELECT 1 FROM public.assignments a
            WHERE a.order_id = pm_spaces.ref_ordine
            AND a.collaborator_id IN (
                SELECT id FROM public.collaborators WHERE user_id = auth.uid()
            )
        )
    );

-- PM ITEMS RLS
CREATE POLICY "Items: Admin access" ON public.pm_items
    FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Items: Space PM access" ON public.pm_items
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.pm_spaces s WHERE s.id = pm_items.space_ref AND s.default_pm_user_ref = auth.uid())
    );

CREATE POLICY "Items: Collaborator visibility" ON public.pm_items
    FOR SELECT USING (
        -- Directly assigned
        EXISTS (
            SELECT 1 FROM public.pm_item_assignees a WHERE a.pm_item_ref = pm_items.id AND a.user_ref = auth.uid()
        )
        OR
        -- Linked to their assignment
        EXISTS (
            SELECT 1 FROM public.pm_item_incarichi i
            JOIN public.assignments ass ON i.incarico_ref = ass.id
            JOIN public.collaborators c ON c.id = ass.collaborator_id
            WHERE i.pm_item_ref = pm_items.id
            AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Items: Collaborator update own" ON public.pm_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.pm_item_assignees a WHERE a.pm_item_ref = pm_items.id AND a.user_ref = auth.uid()
        )
    );

-- Allow creating items if you have access to the space
-- (For complexity reduction, we assume if you can see the space, you can create items, 
--  OR restrict to PMs. Plan says "assignee: update status/notes", "PM: do everything".
--  Creating items should probably be restricted to PM/Admin or if you are in the space context?
--  For now, let's allow enable standard INSERT if you are PM/Admin.
--  Collaborators usually don't create items in strict PM, but maybe they create child tasks?
--  Let's stick to PM/Admin for creation for now, as per rules "Hierarchy... Activity...".
--  Wait, "Collaboratore" is a consequence. They work on tasks.
--  Let's allow Admin/PM to insert.
CREATE POLICY "Items: Insert Admin/PM" ON public.pm_items
    FOR INSERT WITH CHECK (
        public.is_admin(auth.uid()) OR
        EXISTS (SELECT 1 FROM public.pm_spaces s WHERE s.id = space_ref AND s.default_pm_user_ref = auth.uid())
    );

-- COMMENTS RLS
-- Visible if you can see the item
CREATE POLICY "Comments: Visibility" ON public.pm_item_comments
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.pm_items i WHERE i.id = pm_item_comments.pm_item_ref)
    );

-- Insert if you can see the item
CREATE POLICY "Comments: Insert" ON public.pm_item_comments
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.pm_items i WHERE i.id = pm_item_comments.pm_item_ref)
    );

-- ASSIGNEES / INCARICHI RLS
-- Only Admin/PM can manage these tables
CREATE POLICY "Assignees: Manage" ON public.pm_item_assignees
    FOR ALL USING (
        public.is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.pm_items i 
            JOIN public.pm_spaces s ON s.id = i.space_ref
            WHERE i.id = pm_item_assignees.pm_item_ref
            AND s.default_pm_user_ref = auth.uid()
        )
    );
    
-- Allow viewing assignees if you can view the item
CREATE POLICY "Assignees: View" ON public.pm_item_assignees
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.pm_items i WHERE i.id = pm_item_assignees.pm_item_ref)
    );

CREATE POLICY "Incarichi Link: Manage" ON public.pm_item_incarichi
    FOR ALL USING (
        public.is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.pm_items i 
            JOIN public.pm_spaces s ON s.id = i.space_ref
            WHERE i.id = pm_item_incarichi.pm_item_ref
            AND s.default_pm_user_ref = auth.uid()
        )
    );

CREATE POLICY "Incarichi Link: View" ON public.pm_item_incarichi
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.pm_items i WHERE i.id = pm_item_incarichi.pm_item_ref)
    );

