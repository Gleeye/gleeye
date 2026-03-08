-- RESTORE MISSING CREATION LOG FOR USER
BEGIN;

INSERT INTO public.pm_activity_logs (
    actor_user_ref, 
    action_type, 
    space_ref, 
    item_ref, 
    order_ref, 
    details, 
    created_at
)
SELECT 
    '7d6784d0-e816-486b-aca5-049bb3190144'::uuid, -- Davide Gentile
    'pm_items:created',
    space_ref,
    id,
    (SELECT ref_ordine FROM pm_spaces WHERE id = space_ref),
    jsonb_build_object(
        'description', 'ha creato l''attività **' || title || '**',
        'entity_name', title
    ),
    created_at
FROM public.pm_items 
WHERE id = '58d3a5cf-ded0-41df-b886-1932fc4628ff'
AND NOT EXISTS (
    SELECT 1 FROM public.pm_activity_logs 
    WHERE item_ref = '58d3a5cf-ded0-41df-b886-1932fc4628ff' 
    AND action_type = 'pm_items:created'
);

-- Delete the "phantom" assignee log for the same item at the same time to avoid the "double" confusion again
DELETE FROM public.pm_activity_logs 
WHERE item_ref = '58d3a5cf-ded0-41df-b886-1932fc4628ff'
AND action_type = 'pm_item_assignees:created'
AND created_at < '2026-03-08T00:40:00Z';

COMMIT;
