-- FORCE RE-ENTRY OF THE REGISTRY TO BE 100% SURE
-- We delete and re-insert to avoid any partial update issues

DELETE FROM public.pm_activity_registry WHERE table_name = 'pm_items';

INSERT INTO public.pm_activity_registry (
    table_name, 
    is_active, 
    track_insert, 
    track_update, 
    track_delete,
    template_insert,
    insert_action_name,
    update_action_name,
    item_ref_source,
    space_ref_source,
    order_ref_source,
    track_columns,
    column_templates
) VALUES (
    'pm_items',
    true,
    true,
    true,
    false,
    'ha creato l''attività {entity}',
    'created',
    'updated',
    'id',
    'space_ref',
    'space_ref.ref_ordine',
    ARRAY['status', 'priority', 'start_date', 'due_date', 'notes', 'title', 'cloud_links', 'pm_user_ref'],
    '{
        "status": "ha cambiato lo stato di {entity} da {old_value} a {new_value}",
        "due_date": "ha spostato la scadenza di {entity} al {new_value}",
        "pm_user_ref": "ha assegnato {entity} a {new_value}",
        "priority": "ha impostato la priorità di {entity} a {new_value}",
        "notes": "ha aggiornato la descrizione di {entity}",
        "title": "ha rinominato l''attività in **{new_value}**",
        "start_date": "ha impostato la data inizio di {entity} al {new_value}",
        "cloud_links": "ha aggiornato i link cloud di {entity}"
    }'::jsonb
);

-- Fix old logs that contain the ugly string
UPDATE public.pm_activity_logs
SET details = jsonb_set(details, '{description}', 
    format('ha aggiornato la descrizione di **%s**', COALESCE(details->>'entity_name', 'questa attività'))::jsonb
)
WHERE details->>'description' = 'Descrizione attività aggiornata';
