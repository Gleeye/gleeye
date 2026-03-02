-- Create pm_activity_logs table
CREATE TABLE IF NOT EXISTS public.pm_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_ref UUID REFERENCES public.pm_spaces(id) ON DELETE CASCADE,
    item_ref UUID REFERENCES public.pm_items(id) ON DELETE CASCADE,
    actor_user_ref UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL, -- 'created', 'updated_status', 'commented', 'document_added', etc.
    details JSONB, -- storing before/after or extra info
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pm_activity_logs_space ON public.pm_activity_logs(space_ref);
CREATE INDEX IF NOT EXISTS idx_pm_activity_logs_item ON public.pm_activity_logs(item_ref);
CREATE INDEX IF NOT EXISTS idx_pm_activity_logs_actor ON public.pm_activity_logs(actor_user_ref);

-- Enable RLS
ALTER TABLE public.pm_activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all activity logs
CREATE POLICY "Activity Logs: Admin access" ON public.pm_activity_logs
    FOR ALL USING (public.is_admin(auth.uid()));

-- Users can view activity logs if they can view the space or item
-- Since activities are linked to either a space or an item, we check those
CREATE POLICY "Activity Logs: Space access" ON public.pm_activity_logs
    FOR SELECT USING (
        (space_ref IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.pm_spaces s
            WHERE s.id = space_ref
            AND (
                s.default_pm_user_ref = auth.uid()
                OR (s.type = 'commessa' AND EXISTS (
                    SELECT 1 FROM public.assignments a
                    WHERE a.order_id = s.ref_ordine
                    AND a.collaborator_id IN (SELECT id FROM public.collaborators WHERE user_id = auth.uid())
                ))
            )
        ))
        OR
        (item_ref IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.pm_items i
            WHERE i.id = item_ref
            AND (
                EXISTS (SELECT 1 FROM public.pm_item_assignees a WHERE a.pm_item_ref = i.id AND a.user_ref = auth.uid())
                OR EXISTS (
                    SELECT 1 FROM public.pm_item_incarichi inc
                    JOIN public.assignments ass ON inc.incarico_ref = ass.id
                    JOIN public.collaborators c ON c.id = ass.collaborator_id
                    WHERE inc.pm_item_ref = i.id AND c.user_id = auth.uid()
                )
                OR EXISTS (SELECT 1 FROM public.pm_spaces s WHERE s.id = i.space_ref AND s.default_pm_user_ref = auth.uid())
            )
        ))
    );

-- Enable insert for all (triggers run with security definer usually, but good to have)
CREATE POLICY "Activity Logs: Insert" ON public.pm_activity_logs
    FOR INSERT WITH CHECK (auth.uid() = actor_user_ref);
