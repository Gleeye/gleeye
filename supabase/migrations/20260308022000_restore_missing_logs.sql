-- HEURISTIC RESTORATION OF DELETED LOGS
BEGIN;

-- 1. Restore COMMENT logs for the last 24h
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
    c.author_user_ref,
    'pm_item_comments:created',
    i.space_ref,
    c.pm_item_ref,
    (SELECT ref_ordine FROM pm_spaces WHERE id = i.space_ref),
    jsonb_build_object(
        'description', 'ha aggiunto un commento in **' || i.title || '**',
        'entity_name', i.title,
        'comment_snippet', LEFT(c.body, 50)
    ),
    c.created_at
FROM public.pm_item_comments c
JOIN public.pm_items i ON c.pm_item_ref = i.id
WHERE c.created_at > NOW() - INTERVAL '24 hours'
AND NOT EXISTS (
    SELECT 1 FROM public.pm_activity_logs l 
    WHERE l.item_ref = c.pm_item_ref 
    AND l.action_type LIKE '%comment%'
    AND l.created_at = c.created_at
);

-- 2. Restore ASSIGNEE logs for the last 24h (only if they aren't near-creation)
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
    p.id, -- Assume the actor is either the admin or the user themselves for simplicity
    'pm_item_assignees:created',
    i.space_ref,
    a.pm_item_ref,
    (SELECT ref_ordine FROM pm_spaces WHERE id = i.space_ref),
    jsonb_build_object(
        'description', 'ha aggiunto membri a **' || i.title || '**',
        'entity_name', i.title
    ),
    a.created_at
FROM public.pm_item_assignees a
JOIN public.pm_items i ON a.pm_item_ref = i.id
JOIN profiles p ON a.user_ref = p.id -- Simplification: actor = assigned user
WHERE a.created_at > NOW() - INTERVAL '24 hours'
AND NOT (a.created_at < i.created_at + INTERVAL '10 seconds') -- Only if it WASN'T part of creation
AND NOT EXISTS (
    SELECT 1 FROM public.pm_activity_logs l 
    WHERE l.item_ref = a.pm_item_ref 
    AND (l.action_type LIKE '%assignee%' OR l.action_type LIKE '%member%')
    AND l.created_at = a.created_at
);

COMMIT;
