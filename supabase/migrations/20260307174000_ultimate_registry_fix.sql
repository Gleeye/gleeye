-- THE ULTIMATE REGISTRY ALIGNMENT
-- Ensure every tracked column in every registered table includes {entity} to make them human-readable

UPDATE public.pm_activity_registry 
SET 
    track_columns = ARRAY['status', 'priority', 'start_date', 'due_date', 'notes', 'title', 'cloud_links', 'pm_user_ref'],
    column_templates = '{
        "status": "ha cambiato lo stato di {entity} da {old_value} a {new_value}",
        "due_date": "ha spostato la scadenza di {entity} al {new_value}",
        "pm_user_ref": "ha assegnato {entity} a {new_value}",
        "priority": "ha impostato la priorità di {entity} a {new_value}",
        "notes": "ha aggiornato la descrizione di {entity}",
        "title": "ha rinominato l''attività in **{new_value}**",
        "start_date": "ha impostato la data inizio di {entity} al {new_value}",
        "cloud_links": "ha aggiornato i link cloud di {entity}"
    }'::jsonb
WHERE table_name = 'pm_items';

UPDATE public.pm_activity_registry 
SET 
    column_templates = '{
        "status_works": "ha aggiornato l''avanzamento di {entity} a {new_value}",
        "offer_status": "ha cambiato lo stato offerta di {entity} in {new_value}",
        "p_m": "ha assegnato la gestione della commessa {entity} a {new_value}",
        "total_amount_tax_excluded": "ha aggiornato il budget della commessa {entity} a {new_value}",
        "notes": "ha aggiornato le note della commessa {entity}"
    }'::jsonb,
    track_columns = ARRAY['status_works', 'offer_status', 'p_m', 'total_amount_tax_excluded', 'notes', 'title']
WHERE table_name = 'orders';

UPDATE public.pm_activity_registry 
SET 
    track_columns = ARRAY['status', 'collaborator_id', 'total_amount', 'description'],
    column_templates = '{
        "status": "ha cambiato lo stato dell''incarico {entity} in {new_value}",
        "collaborator_id": "ha assegnato l''incarico {entity} a {new_value}",
        "total_amount": "ha aggiornato il compenso dell''incarico {entity} a {new_value}",
        "description": "ha aggiornato la descrizione dell''incarico {entity}"
    }'::jsonb
WHERE table_name = 'assignments';

UPDATE public.pm_activity_registry 
SET 
    column_templates = '{
        "status": "ha cambiato lo stato dell''appuntamento {entity} in {new_value}",
        "start_time": "ha spostato l''appuntamento {entity} al {new_value}",
        "title": "ha rinominato l''appuntamento in **{new_value}**"
    }'::jsonb
WHERE table_name = 'appointments';
