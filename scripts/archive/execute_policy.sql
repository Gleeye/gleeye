CREATE POLICY "Spaces: Assignee access" ON public.pm_spaces
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.pm_space_assignees a
            WHERE a.pm_space_ref = id
            AND (
                a.user_ref = auth.uid() OR
                a.collaborator_ref IN (SELECT id FROM public.collaborators WHERE user_id = auth.uid())
            )
        )
    );

CREATE POLICY "Items: Space Assignee access" ON public.pm_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.pm_space_assignees a
            WHERE a.pm_space_ref = space_ref
            AND (
                a.user_ref = auth.uid() OR
                a.collaborator_ref IN (SELECT id FROM public.collaborators WHERE user_id = auth.uid())
            )
        )
    );
