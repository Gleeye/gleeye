-- ULTRA PRECISE ACTIVITY LOGGER (The "Detective" version)

-- 1. Helper to resolve any ID to a human name
CREATE OR REPLACE FUNCTION public.fn_resolve_name(_table TEXT, _id ANYELEMENT)
RETURNS TEXT AS $$
DECLARE
    _name TEXT;
BEGIN
    IF _id IS NULL THEN RETURN 'Nessuno'; END IF;

    CASE _table
        WHEN 'profiles' THEN 
            SELECT full_name INTO _name FROM public.profiles WHERE id = _id::uuid;
        WHEN 'collaborators' THEN 
            SELECT business_name INTO _name FROM public.collaborators WHERE id = _id::uuid;
        WHEN 'auth_users' THEN 
            SELECT full_name INTO _name FROM public.profiles WHERE id = _id::uuid;
        WHEN 'pm_items' THEN 
            SELECT title INTO _name FROM public.pm_items WHERE id = _id::uuid;
        WHEN 'orders' THEN 
            SELECT title INTO _name FROM public.orders WHERE id = _id::uuid;
        WHEN 'pm_spaces' THEN 
            SELECT name INTO _name FROM public.pm_spaces WHERE id = _id::uuid;
        ELSE 
            _name := _id::text;
    END CASE;

    RETURN COALESCE(_name, _id::text);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Enhanced Logger Function
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
    _ref_id UUID;
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

    -- Order / Space / Client resolution (Generic paths)
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

    -- Client Ref fallback from order
    IF _reg.client_ref_source = 'client_id' THEN _client_id := (_new_json->>'client_id')::uuid;
    ELSIF _order_id IS NOT NULL THEN SELECT client_id INTO _client_id FROM public.orders WHERE id = _order_id;
    END IF;

    -- Determine Entity Name (Identifying the object)
    _entity_name := COALESCE(_new_json->>'title', _new_json->>'name', _new_json->>'description', _new_json->>'id');
    IF TG_TABLE_NAME = 'pm_item_assignees' THEN
        SELECT title INTO _entity_name FROM public.pm_items WHERE id = (_new_json->>'pm_item_ref')::uuid;
    END IF;

    -- --- LOG GENERATION ---
    
    -- 1. Specific Column Updates
    IF TG_OP = 'UPDATE' AND _reg.column_templates IS NOT NULL THEN
        FOR _col IN SELECT jsonb_object_keys(_diff_json) LOOP
            _col_template := _reg.column_templates->>_col;
            IF _col_template IS NOT NULL THEN
                _description := _col_template;
                
                -- Dynamic Value Resolution
                _val := _new_json->>_col;
                IF _col IN ('pm_user_ref', 'default_pm_user_ref', 'created_by', 'collaborator_id', 'user_ref') THEN
                    _val := public.fn_resolve_name(CASE WHEN _col = 'collaborator_id' THEN 'collaborators' ELSE 'profiles' END, _val);
                ELSIF _col IN ('due_date', 'start_date', 'start_time') THEN
                    _val := to_char(_val::timestamptz, 'DD/MM/YYYY');
                ELSIF _col = 'total_amount' THEN
                    _val := '€' || _val;
                ELSE
                    _val := public.fn_human_val(_val);
                END IF;

                _description := REPLACE(_description, '{entity}', '**' || COALESCE(_entity_name, 'questa risorsa') || '**');
                _description := REPLACE(_description, '{new_value}', '**' || _val || '**');
                _description := REPLACE(_description, '{old_value}', '**' || public.fn_human_val(_old_json->>_col) || '**');

                INSERT INTO public.pm_activity_logs (
                    actor_user_ref, action_type, space_ref, item_ref, order_ref, client_ref, details
                ) VALUES (
                    _actor_id, _action_name || ':' || _col, _space_id, _item_id, _order_id, _client_id,
                    jsonb_build_object('description', _description, 'entity_name', _entity_name)
                );
                _final_log_count := _final_log_count + 1;
            END IF;
        END LOOP;
    END IF;

    -- 2. General Actions (Insert/Delete/Untracked Updates)
    IF (_final_log_count = 0 OR TG_OP != 'UPDATE') AND _template IS NOT NULL THEN
        _description := _template;
        
        -- Resolve Special Placeholders for Inserts
        IF TG_TABLE_NAME = 'pm_item_assignees' THEN
             _val := public.fn_resolve_name('profiles', _new_json->>'user_ref');
             _description := REPLACE(_description, '{user_name}', '**' || _val || '**');
        END IF;

        _description := REPLACE(_description, '{entity}', '**' || COALESCE(_entity_name, 'una nuova risorsa') || '**');
        _description := REPLACE(_description, '{body}', _new_json->>'body'); -- for comments
        _description := REPLACE(_description, '{title}', _new_json->>'title'); -- for docs

        INSERT INTO public.pm_activity_logs (
            actor_user_ref, action_type, space_ref, item_ref, order_ref, client_ref, details
        ) VALUES (
            _actor_id, _action_name, _space_id, _item_id, _order_id, _client_id,
            jsonb_build_object('description', _description, 'entity_name', _entity_name)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. THE "PRECISION" REGISTRY
-- We want zero ambiguity. Every action defines its story.

-- TASKS (pm_items)
UPDATE public.pm_activity_registry 
SET 
    track_insert = true,
    template_insert = 'ha creato l''attività {entity}',
    track_update = true,
    column_templates = '{
        "status": "ha cambiato lo stato di {entity} da {old_value} a {new_value}",
        "due_date": "ha spostato la scadenza di {entity} al {new_value}",
        "pm_user_ref": "ha assegnato {entity} a {new_value}",
        "priority": "ha impostato la priorità di {entity} a {new_value}"
    }'::jsonb
WHERE table_name = 'pm_items';

-- COMMESSE (orders)
UPDATE public.pm_activity_registry 
SET 
    track_update = true,
    column_templates = '{
        "status_works": "ha aggiornato l''avanzamento di {entity} a {new_value}",
        "offer_status": "ha cambiato lo stato offerta di {entity} in {new_value}",
        "p_m": "ha assegnato la gestione di {entity} a {new_value}",
        "total_amount_tax_excluded": "ha aggiornato il budget di {entity} a {new_value}"
    }'::jsonb,
    template_insert = 'ha aperto la commessa {entity}'
WHERE table_name = 'orders';

-- INCARICHI (assignments)
UPDATE public.pm_activity_registry 
SET 
    template_insert = 'ha creato un nuovo incarico',
    column_templates = '{
        "status": "ha cambiato lo stato dell''incarico in {new_value}",
        "collaborator_id": "ha assegnato l''incarico a {new_value}",
        "total_amount": "ha aggiornato il compenso dell''incarico a {new_value}"
    }'::jsonb
WHERE table_name = 'assignments';

-- ASSIGNEES (pm_item_assignees) - Bridge for Task Assignments
INSERT INTO public.pm_activity_registry (table_name, track_insert, template_insert, item_ref_source, space_ref_source)
VALUES (
    'pm_item_assignees',
    true,
    'ha assegnato {entity} a {user_name}',
    'pm_item_ref',
    'pm_item_ref.space_ref'
) ON CONFLICT (table_name) DO UPDATE SET track_insert = true, template_insert = EXCLUDED.template_insert;

DROP TRIGGER IF EXISTS trg_assignees_log ON public.pm_item_assignees;
CREATE TRIGGER trg_assignees_log AFTER INSERT ON public.pm_item_assignees FOR EACH ROW EXECUTE FUNCTION public.fn_app_activity_logger();

-- APPOINTMENTS
UPDATE public.pm_activity_registry 
SET 
    column_templates = '{
        "status": "ha cambiato lo stato dell''appuntamento {entity} in {new_value}",
        "start_time": "ha spostato l''appuntamento {entity} al {new_value}"
    }'::jsonb,
    template_insert = 'ha fissato un appuntamento: {entity}'
WHERE table_name = 'appointments';

-- COMMENTS
UPDATE public.pm_activity_registry 
SET template_insert = 'ha aggiunto un commento in {entity}'
WHERE table_name = 'pm_item_comments';

-- DOCUMENTS
UPDATE public.pm_activity_registry 
SET template_insert = 'ha caricato il file **{title}**'
WHERE table_name = 'doc_pages';
