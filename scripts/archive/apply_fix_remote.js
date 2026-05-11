const { Client } = require('pg');

const client = new Client({
    connectionString: "postgresql://postgres:%231rkB%26njQ%24Gn5C31BWwf@db.whpbetjyhpttinbxcffs.supabase.co:6543/postgres"
});

const sql = `
-- Fix infinite recursion in PM module RLS policies
BEGIN;

-- 1. pm_items
DROP POLICY IF EXISTS "Items: Collaborator visibility" ON public.pm_items;
DROP POLICY IF EXISTS "Items: Collaborator update own" ON public.pm_items;

CREATE POLICY "Items: Collaborator visibility" ON public.pm_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.pm_spaces s
            WHERE s.id = pm_items.space_ref
            AND (
                s.default_pm_user_ref = auth.uid()
                OR
                EXISTS (
                    SELECT 1 FROM public.assignments a
                    WHERE a.order_id = s.ref_ordine
                    AND a.collaborator_id IN (
                        SELECT id FROM public.collaborators WHERE user_id = auth.uid()
                    )
                )
            )
        )
    );

CREATE POLICY "Items: Collaborator update own" ON public.pm_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.pm_item_assignees a 
            WHERE a.pm_item_ref = id AND a.user_ref = auth.uid()
        )
    );

-- 2. pm_item_assignees
DROP POLICY IF EXISTS "Assignees: View" ON public.pm_item_assignees;
DROP POLICY IF EXISTS "Assignees: Manage" ON public.pm_item_assignees;
DROP POLICY IF EXISTS "Assignees: Update" ON public.pm_item_assignees;
DROP POLICY IF EXISTS "Assignees: Delete" ON public.pm_item_assignees;

CREATE POLICY "Assignees: View" ON public.pm_item_assignees
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Assignees: Manage" ON public.pm_item_assignees
    FOR INSERT WITH CHECK (
        public.is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.pm_items i 
            JOIN public.pm_spaces s ON s.id = i.space_ref
            WHERE i.id = pm_item_assignees.pm_item_ref
            AND s.default_pm_user_ref = auth.uid()
        )
    );

CREATE POLICY "Assignees: Update" ON public.pm_item_assignees
    FOR UPDATE USING (
        public.is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.pm_items i 
            JOIN public.pm_spaces s ON s.id = i.space_ref
            WHERE i.id = pm_item_assignees.pm_item_ref
            AND s.default_pm_user_ref = auth.uid()
        )
    );

CREATE POLICY "Assignees: Delete" ON public.pm_item_assignees
    FOR DELETE USING (
        public.is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.pm_items i 
            JOIN public.pm_spaces s ON s.id = i.space_ref
            WHERE i.id = pm_item_assignees.pm_item_ref
            AND s.default_pm_user_ref = auth.uid()
        )
    );

-- 3. pm_item_incarichi
DROP POLICY IF EXISTS "Incarichi Link: View" ON public.pm_item_incarichi;
DROP POLICY IF EXISTS "Incarichi Link: Manage" ON public.pm_item_incarichi;
DROP POLICY IF EXISTS "Incarichi Link: Manage Insert" ON public.pm_item_incarichi;
DROP POLICY IF EXISTS "Incarichi Link: Manage Delete" ON public.pm_item_incarichi;

CREATE POLICY "Incarichi Link: View" ON public.pm_item_incarichi
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Incarichi Link: Manage Insert" ON public.pm_item_incarichi
    FOR INSERT WITH CHECK (
        public.is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.pm_items i 
            JOIN public.pm_spaces s ON s.id = i.space_ref
            WHERE i.id = pm_item_incarichi.pm_item_ref
            AND s.default_pm_user_ref = auth.uid()
        )
    );

CREATE POLICY "Incarichi Link: Manage Delete" ON public.pm_item_incarichi
    FOR DELETE USING (
        public.is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.pm_items i 
            JOIN public.pm_spaces s ON s.id = i.space_ref
            WHERE i.id = pm_item_incarichi.pm_item_ref
            AND s.default_pm_user_ref = auth.uid()
        )
    );

COMMIT;
`;

async function run() {
    try {
        await client.connect();
        console.log('Connected to remote DB');
        await client.query(sql);
        console.log('SQL executed successfully');
    } catch (err) {
        console.error('Execution error:', err);
    } finally {
        await client.end();
    }
}

run();
