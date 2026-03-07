-- BRUTE FORCE REGISTRY AND LOG CLEANUP
-- 1. Update the registry for BOTH 'notes' and 'description' columns, using the user's preferred "cambiato" copy.

UPDATE public.pm_activity_registry 
SET 
    column_templates = column_templates || '{
        "notes": "ha cambiato la descrizione di {entity}",
        "description": "ha cambiato la descrizione di {entity}"
    }'::jsonb
WHERE table_name = 'pm_items';

UPDATE public.pm_activity_registry 
SET 
    column_templates = column_templates || '{
        "notes": "ha cambiato le note della commessa {entity}",
        "description": "ha cambiato la descrizione della commessa {entity}"
    }'::jsonb
WHERE table_name = 'orders';

-- 2. Retroactive fix for historical logs
-- We search for any log containing "Descrizione attività aggiornata" inside the JSONB details
UPDATE public.pm_activity_logs
SET details = jsonb_set(details, '{description}', 
    format('ha cambiato la descrizione di **%s**', COALESCE(details->>'entity_name', 'questa attività'))::jsonb
)
WHERE details->>'description' ILIKE '%Descrizione attività aggiornata%';

-- 4. Final check on the trigger function: ensure it uses 'description' column too if it exists
CREATE OR REPLACE FUNCTION public.fn_app_activity_logger()
RETURNS TRIGGER AS $$
DECLARE
    _reg RECORD;
    _template TEXT;
    _action_name TEXT;
    _description TEXT;
    _order_id UUID;
    _space_id UUID;
    _item_id UUID;
    _client_id UUID;
    _actor_id UUID;
    _val TEXT;
    _col TEXT;
    _new_json JSONB;
    _old_json JSONB;
    _diff_json JSONB := '{}'::jsonb;
    _col_template TEXT;
    _final_log_count INTEGER := 0;
    _entity_name TEXT;
    _is_acc BOOLEAN := false;
BEGIN
    SELECT * INTO _reg FROM public.pm_activity_registry WHERE table_name = TG_TABLE_NAME AND is_active = true;
    IF NOT FOUND THEN RETURN NEW; END IF;

    _actor_id := auth.uid();
    _new_json := to_jsonb(NEW);

    -- Operation setup
    IF (TG_OP = 'INSERT' AND _reg.track_insert) THEN
        _template := _reg.template_insert;
        _action_name := 'created';
    ELSIF (TG_OP = 'UPDATE' AND _reg.track_update) THEN
        _old_json := to_jsonb(OLD);
        _action_name := 'updated';
        
        FOR _col IN SELECT jsonb_object_keys(_new_json) LOOP
            IF (_new_json->>_col IS DISTINCT FROM _old_json->>_col) THEN
                _diff_json := _diff_json || jsonb_build_object(_col, _new_json->>_col);
            END IF;
        END LOOP;

        IF _reg.track_columns IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM jsonb_object_keys(_diff_json) k WHERE k = ANY(_reg.track_columns)) THEN
                IF _reg.column_templates IS NULL OR jsonb_array_length(jsonb_path_query_array(_reg.column_templates, '$.*')) = 0 THEN
                   RETURN NEW;
                END IF;
            END IF;
        END IF;
    ELSIF (TG_OP = 'DELETE' AND _reg.track_delete) THEN
        _template := _reg.template_delete;
        _action_name := 'deleted';
        _new_json := to_jsonb(OLD);
    ELSE
        RETURN NEW;
    END IF;

    -- --- Reference Resolution ---
    IF TG_TABLE_NAME = 'pm_activity_logs' THEN RETURN NEW; END IF; -- Prevent self-log loops if misconfigured
    
    IF _reg.item_ref_source = 'id' THEN _item_id := (_new_json->>'id')::uuid;
    ELSIF _reg.item_ref_source IS NOT NULL THEN _item_id := (_new_json->>_reg.item_ref_source)::uuid; 
    END IF;

    IF _reg.order_ref_source = 'id' THEN _order_id := (_new_json->>'id')::uuid;
    ELSIF _reg.order_ref_source = 'order_id' OR _reg.order_ref_source = 'order_ref' OR _reg.order_ref_source = 'ref_ordine' THEN 
        _order_id := (_new_json->>(_reg.order_ref_source))::uuid;
    ELSIF _reg.order_ref_source = 'space_ref.ref_ordine' THEN 
        SELECT ref_ordine INTO _order_id FROM public.pm_spaces WHERE id = (_new_json->>'space_ref')::uuid;
    END IF;

    IF _reg.space_ref_source = 'id' THEN _space_id := (_new_json->>'id')::uuid;
    ELSIF _reg.space_ref_source = 'space_ref' THEN _space_id := (_new_json->>'space_ref')::uuid;
    ELSIF _reg.space_ref_source = 'pm_item_ref.space_ref' THEN
        SELECT space_ref INTO _space_id FROM public.pm_items WHERE id = (_new_json->>'pm_item_ref')::uuid;
    END IF;

    -- Entity Name Resolution
    _entity_name := COALESCE(_new_json->>'title', _new_json->>'name', _new_json->>'description', _new_json->>'notes');
    IF TG_TABLE_NAME = 'pm_item_assignees' OR TG_TABLE_NAME = 'pm_item_comments' THEN
        SELECT title INTO _entity_name FROM public.pm_items WHERE id = (_new_json->>'pm_item_ref')::uuid;
    END IF;
    
    -- --- LOG GENERATION ---
    
    IF TG_OP = 'UPDATE' AND _reg.column_templates IS NOT NULL THEN
        FOR _col IN SELECT jsonb_object_keys(_diff_json) LOOP
            _col_template := _reg.column_templates->>_col;
            IF _col_template IS NOT NULL THEN
                _description := _col_template;
                
                _val := _new_json->>_col;
                -- Resolve names for user references
                IF _col IN ('pm_user_ref', 'user_ref', 'collaborator_id') THEN
                    _val := public.fn_resolve_name(CASE WHEN _col = 'collaborator_id' THEN 'collaborators' ELSE 'profiles' END, _val);
                ELSIF _col LIKE '%_at' OR _col LIKE '%_date' OR _col LIKE '%_time' THEN
                    _val := to_char(_val::timestamptz, 'DD/MM/YYYY');
                END IF;

                _description := REPLACE(_description, '{entity}', '**' || COALESCE(_entity_name, 'questa risorsa') || '**');
                _description := REPLACE(_description, '{new_value}', '**' || COALESCE(_val, '') || '**');
                _description := REPLACE(_description, '{old_value}', '**' || COALESCE(public.fn_human_val(_old_json->>_col), '') || '**');

                INSERT INTO public.pm_activity_logs (
                    actor_user_ref, action_type, space_ref, item_ref, order_ref, details
                ) VALUES (
                    _actor_id, _action_name || ':' || _col, _space_id, _item_id, _order_id,
                    jsonb_build_object(
                        'description', _description, 
                        'entity_name', _entity_name, 
                        'old', _old_json->>_col, 
                        'new', _new_json->>_col,
                        'col', _col
                    )
                );
                _final_log_count := _final_log_count + 1;
            END IF;
        END LOOP;
    END IF;

    IF (_final_log_count = 0 OR TG_OP != 'UPDATE') AND _template IS NOT NULL THEN
        _description := _template;
        _description := REPLACE(_description, '{entity}', '**' || COALESCE(_entity_name, 'un oggetto') || '**');
        _description := REPLACE(_description, '{body}', COALESCE(_new_json->>'body', ''));
        _description := REPLACE(_description, '{title}', COALESCE(_new_json->>'title', ''));

        INSERT INTO public.pm_activity_logs (
            actor_user_ref, action_type, space_ref, item_ref, order_ref, details
        ) VALUES (
            _actor_id, _action_name, _space_id, _item_id, _order_id,
            jsonb_build_object('description', _description, 'entity_name', _entity_name)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
