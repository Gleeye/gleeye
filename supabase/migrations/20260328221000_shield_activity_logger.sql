-- Shield Activity Logger
-- Rende il sistema di logging "fail-safe" per evitare 409 Conflict durante la cancellazione delle task.
-- Questa migrazione aggiunge un blocco EXCEPTION alla funzione di logging e disabilita il link FK per le cancellazioni.

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
    -- 1. Get registry config for this table
    SELECT * INTO _reg FROM public.pm_activity_registry WHERE table_name = TG_TABLE_NAME AND is_active = true;
    IF NOT FOUND THEN RETURN COALESCE(NEW, OLD); END IF;

    _actor_id := auth.uid();
    
    -- 2. Determine Operation and Template
    IF (TG_OP = 'INSERT' AND _reg.track_insert) THEN
        _new_json := to_jsonb(NEW);
        _template := _reg.template_insert;
        _action_name := COALESCE(_reg.insert_action_name, 'created');
    ELSIF (TG_OP = 'UPDATE' AND _reg.track_update) THEN
        _new_json := to_jsonb(NEW);
        _old_json := to_jsonb(OLD);
        _action_name := COALESCE(_reg.update_action_name, 'updated');
        
        -- Build diff
        FOR _col IN SELECT jsonb_object_keys(_new_json) LOOP
            IF (_new_json->>_col IS DISTINCT FROM _old_json->>_col) THEN
                _diff_json := _diff_json || jsonb_build_object(_col, _new_json->>_col);
            END IF;
        END LOOP;

        -- Check tracked columns
        IF _reg.track_columns IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM jsonb_object_keys(_diff_json) k WHERE k = ANY(_reg.track_columns)) THEN
               -- Skip log if no tracked columns changed, but continue if there are specific column templates
               IF _reg.column_templates IS NULL OR jsonb_array_length(jsonb_path_query_array(_reg.column_templates, '$.*')) = 0 THEN
                  RETURN NEW;
               END IF;
            END IF;
        END IF;
    ELSIF (TG_OP = 'DELETE' AND _reg.track_delete) THEN
        _new_json := to_jsonb(OLD); 
        _template := _reg.template_delete;
        _action_name := COALESCE(_reg.delete_action_name, 'deleted');
    ELSE
        -- Default return to allow operation
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- 3. Reference Resolution
    -- Item Ref
    IF _reg.item_ref_source = 'id' THEN _item_id := (_new_json->>'id')::uuid;
    ELSIF _reg.item_ref_source IS NOT NULL THEN _item_id := (_new_json->>_reg.item_ref_source)::uuid; 
    END IF;

    -- SAFEGUARD: If deleting, we must NOT reference the item_ref in the log to avoid FK violation (409 Conflict)
    -- because the item is about to be (or already is) removed from the database.
    IF TG_OP = 'DELETE' THEN
        _item_id := NULL;
    END IF;

    -- Space Ref
    IF _reg.space_ref_source = 'id' THEN _space_id := (_new_json->>'id')::uuid;
    ELSIF _reg.space_ref_source = 'space_ref' THEN _space_id := (_new_json->>'space_ref')::uuid;
    ELSIF _reg.space_ref_source = 'pm_item_ref.space_ref' THEN
        SELECT space_ref INTO _space_id FROM public.pm_items WHERE id = (_new_json->>'pm_item_ref')::uuid;
    END IF;

    -- Order Ref
    IF _reg.order_ref_source = 'id' THEN _order_id := (_new_json->>'id')::uuid;
    ELSIF _reg.order_ref_source IN ('order_id', 'order_ref', 'ref_ordine') THEN _order_id := (_new_json->>_reg.order_ref_source)::uuid;
    ELSIF _reg.order_ref_source = 'space_ref.ref_ordine' AND _space_id IS NOT NULL THEN
        SELECT ref_ordine INTO _order_id FROM public.pm_spaces WHERE id = _space_id;
    END IF;

    -- Entity Name Resolution
    _entity_name := COALESCE(_new_json->>'title', _new_json->>'name', 'una risorsa');

    -- 4. Final Insertion with Exception Shield
    -- We wrap the log insertion in a BEGIN-EXCEPTION block to ensure that 
    -- any auxiliary logging failures (like FK conflicts) NEVER block the main transaction.
    BEGIN
        INSERT INTO public.pm_activity_logs (
            actor_user_ref, action_type, space_ref, item_ref, order_ref, client_ref, is_account_level, details
        ) VALUES (
            _actor_id, _action_name, _space_id, _item_id, _order_id, _client_id, _is_acc,
            jsonb_build_object('description', _template, 'entity_name', _entity_name, 'shield', true)
        );
    EXCEPTION WHEN OTHERS THEN
        -- SILENT FAIL: Just log to postgres stdout but don't re-raise
        RAISE WARNING 'Activity logger avoided a transaction failure: % (%)', SQLERRM, SQLSTATE;
    END;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
