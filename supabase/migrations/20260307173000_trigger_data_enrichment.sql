-- REFINING THE DETECTIVE: ADDING DATA FOR THE FRONTEND

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
        _action_name := COALESCE(_reg.insert_action_name, 'created');
    ELSIF (TG_OP = 'UPDATE' AND _reg.track_update) THEN
        _old_json := to_jsonb(OLD);
        _action_name := COALESCE(_reg.update_action_name, 'updated');
        
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
        _action_name := COALESCE(_reg.delete_action_name, 'deleted');
        _new_json := to_jsonb(OLD);
    ELSE
        RETURN NEW;
    END IF;

    -- --- Reference Resolution ---
    IF _reg.item_ref_source = 'id' THEN _item_id := (_new_json->>'id')::uuid;
    ELSIF _reg.item_ref_source IS NOT NULL THEN _item_id := (_new_json->>_reg.item_ref_source)::uuid; 
    END IF;

    IF _reg.order_ref_source = 'id' THEN _order_id := (_new_json->>'id')::uuid;
    ELSIF _reg.order_ref_source = 'order_id' THEN _order_id := (_new_json->>'order_id')::uuid;
    ELSIF _reg.order_ref_source = 'order_ref' THEN _order_id := (_new_json->>'order_ref')::uuid;
    ELSIF _reg.order_ref_source = 'ref_ordine' THEN _order_id := (_new_json->>'ref_ordine')::uuid;
    ELSIF _reg.order_ref_source = 'space_ref.ref_ordine' THEN 
        SELECT ref_ordine INTO _order_id FROM public.pm_spaces WHERE id = (_new_json->>'space_ref')::uuid;
    ELSIF _reg.order_ref_source = 'pm_item_ref.space_ref.ref_ordine' THEN
        SELECT s.ref_ordine INTO _order_id FROM public.pm_items i JOIN public.pm_spaces s ON i.space_ref = s.id WHERE i.id = (_new_json->>'pm_item_ref')::uuid;
    END IF;

    IF _reg.space_ref_source = 'id' THEN _space_id := (_new_json->>'id')::uuid;
    ELSIF _reg.space_ref_source = 'space_ref' THEN _space_id := (_new_json->>'space_ref')::uuid;
    ELSIF _reg.space_ref_source = 'order_id.space_ref' THEN
        SELECT id INTO _space_id FROM public.pm_spaces WHERE ref_ordine = (_new_json->>'order_id')::uuid LIMIT 1;
    ELSIF _reg.space_ref_source = 'pm_item_ref.space_ref' THEN
        SELECT space_ref INTO _space_id FROM public.pm_items WHERE id = (_new_json->>'pm_item_ref')::uuid;
    END IF;

    IF _reg.client_ref_source = 'client_id' THEN _client_id := (_new_json->>'client_id')::uuid;
    ELSIF _order_id IS NOT NULL THEN SELECT client_id INTO _client_id FROM public.orders WHERE id = _order_id;
    END IF;

    -- Account Level resolve
    IF TG_TABLE_NAME IN ('pm_items', 'appointments') THEN _is_acc := COALESCE((_new_json->>'is_account_level')::boolean, false);
    ELSIF TG_TABLE_NAME IN ('orders', 'assignments', 'payments', 'invoices') THEN _is_acc := true;
    END IF;

    -- Determine Entity Name
    IF TG_TABLE_NAME = 'pm_items' THEN _entity_name := _new_json->>'title';
    ELSIF TG_TABLE_NAME = 'orders' THEN _entity_name := _new_json->>'title';
    ELSIF TG_TABLE_NAME = 'pm_spaces' THEN _entity_name := _new_json->>'name';
    ELSIF TG_TABLE_NAME = 'pm_item_assignees' THEN SELECT title INTO _entity_name FROM public.pm_items WHERE id = (_new_json->>'pm_item_ref')::uuid;
    ELSIF TG_TABLE_NAME = 'pm_item_comments' THEN SELECT title INTO _entity_name FROM public.pm_items WHERE id = (_new_json->>'pm_item_ref')::uuid;
    ELSIF TG_TABLE_NAME = 'appointments' THEN _entity_name := _new_json->>'title';
    ELSIF TG_TABLE_NAME = 'assignments' THEN _entity_name := COALESCE(_new_json->>'description', 'un incarico');
    ELSE _entity_name := COALESCE(_new_json->>'title', _new_json->>'name', _new_json->>'description', 'una risorsa');
    END IF;

    -- --- LOG GENERATION ---
    
    -- 1. Specific Column Updates
    IF TG_OP = 'UPDATE' AND _reg.column_templates IS NOT NULL THEN
        FOR _col IN SELECT jsonb_object_keys(_diff_json) LOOP
            _col_template := _reg.column_templates->>_col;
            IF _col_template IS NOT NULL THEN
                _description := _col_template;
                
                -- Value Resolution for the string
                _val := _new_json->>_col;
                IF _col IN ('pm_user_ref', 'default_pm_user_ref', 'created_by', 'collaborator_id', 'user_ref') THEN
                    _val := public.fn_resolve_name(CASE WHEN _col = 'collaborator_id' THEN 'collaborators' ELSE 'profiles' END, _val);
                ELSIF _col IN ('due_date', 'start_date', 'start_time') THEN
                    _val := to_char(_val::timestamptz, 'DD/MM/YYYY');
                ELSIF _col = 'total_amount' OR _col = 'total_amount_tax_excluded' THEN
                    _val := '€' || _val;
                ELSE
                    _val := public.fn_human_val(_val);
                END IF;

                _description := REPLACE(_description, '{entity}', '**' || COALESCE(_entity_name, 'questa risorsa') || '**');
                _description := REPLACE(_description, '{new_value}', '**' || _val || '**');
                _description := REPLACE(_description, '{old_value}', '**' || public.fn_human_val(_old_json->>_col) || '**');

                INSERT INTO public.pm_activity_logs (
                    actor_user_ref, action_type, space_ref, item_ref, order_ref, client_ref, is_account_level, details
                ) VALUES (
                    _actor_id, _action_name || ':' || _col, _space_id, _item_id, _order_id, _client_id, _is_acc,
                    jsonb_build_object(
                        'description', _description, 
                        'entity_name', _entity_name, 
                        'type', TG_TABLE_NAME, 
                        'old', _old_json->>_col, 
                        'new', _new_json->>_col, 
                        'col', _col
                    )
                );
                _final_log_count := _final_log_count + 1;
            END IF;
        END LOOP;
    END IF;

    -- 2. General Actions
    IF (_final_log_count = 0 OR TG_OP != 'UPDATE') AND _template IS NOT NULL THEN
        _description := _template;
        
        IF TG_TABLE_NAME = 'pm_item_assignees' THEN
             _val := public.fn_resolve_name('profiles', _new_json->>'user_ref');
             _description := REPLACE(_description, '{user_name}', '**' || _val || '**');
        END IF;

        _description := REPLACE(_description, '{entity}', '**' || COALESCE(_entity_name, 'un oggetto') || '**');
        _description := REPLACE(_description, '{body}', COALESCE(_new_json->>'body', '')); 
        _description := REPLACE(_description, '{title}', COALESCE(_new_json->>'title', 'un documento')); 

        INSERT INTO public.pm_activity_logs (
            actor_user_ref, action_type, space_ref, item_ref, order_ref, client_ref, is_account_level, details
        ) VALUES (
            _actor_id, _action_name, _space_id, _item_id, _order_id, _client_id, _is_acc,
            jsonb_build_object(
                'description', _description, 
                'entity_name', _entity_name, 
                'type', TG_TABLE_NAME
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
