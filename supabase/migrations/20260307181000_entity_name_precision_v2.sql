-- DEFINITIVE PRECISION: ENTITY NAME RESOLUTION & COPY ALIGNMENT
-- No more "questa risorsa", no more "aggiornato" where "cambiato" is requested.

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
    -- 1. Check if we should log this table
    SELECT * INTO _reg FROM public.pm_activity_registry WHERE table_name = TG_TABLE_NAME AND is_active = true;
    IF NOT FOUND THEN RETURN NEW; END IF;

    _actor_id := auth.uid();
    _new_json := to_jsonb(NEW);

    -- 2. Detect Operation & Build Diff
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

        -- Filter by track_columns if defined
        IF _reg.track_columns IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM jsonb_object_keys(_diff_json) k WHERE k = ANY(_reg.track_columns)) THEN
                -- If no tracked column changed, maybe we handle specific column_templates fallback
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

    -- 3. Resolve References (Space, Order, Item)
    IF _reg.item_ref_source = 'id' THEN _item_id := (_new_json->>'id')::uuid;
    ELSIF _reg.item_ref_source IS NOT NULL THEN _item_id := (_new_json->>_reg.item_ref_source)::uuid; 
    END IF;

    IF _reg.order_ref_source = 'id' THEN _order_id := (_new_json->>'id')::uuid;
    ELSIF _reg.order_ref_source IN ('order_id', 'order_ref', 'ref_ordine') THEN _order_id := (_new_json->>_reg.order_ref_source)::uuid;
    ELSIF _reg.order_ref_source = 'space_ref.ref_ordine' THEN 
        SELECT ref_ordine INTO _order_id FROM public.pm_spaces WHERE id = (_new_json->>'space_ref')::uuid;
    END IF;

    IF _reg.space_ref_source = 'id' THEN _space_id := (_new_json->>'id')::uuid;
    ELSIF _reg.space_ref_source = 'space_ref' THEN _space_id := (_new_json->>'space_ref')::uuid;
    ELSIF _reg.space_ref_source = 'pm_item_ref.space_ref' THEN
        SELECT space_ref INTO _space_id FROM public.pm_items WHERE id = (_new_json->>'pm_item_ref')::uuid;
    END IF;

    -- 4. BULLETPROOF ENTITY NAME RESOLUTION
    -- We try to get the most human-readable name for the current record.
    _entity_name := COALESCE(
        _new_json->>'title', 
        _new_json->>'name', 
        _new_json->>'full_name',
        _new_json->>'business_name',
        (SELECT title FROM public.pm_items WHERE id = _item_id), -- Deep fallback if we have an item_ref
        (SELECT name FROM public.pm_spaces WHERE id = _space_id),
        'questa attività'
    );

    -- Special handling for bridge tables
    IF TG_TABLE_NAME IN ('pm_item_assignees', 'pm_item_comments', 'pm_item_incarichi') THEN
        SELECT title INTO _entity_name FROM public.pm_items WHERE id = (_new_json->>'pm_item_ref')::uuid;
    END IF;

    -- 5. Generate Granular Logs for Updates
    IF TG_OP = 'UPDATE' AND _reg.column_templates IS NOT NULL THEN
        FOR _col IN SELECT jsonb_object_keys(_diff_json) LOOP
            _col_template := _reg.column_templates->>_col;
            IF _col_template IS NOT NULL THEN
                _description := _col_template;
                
                -- Value resolution for the phrase
                _val := _new_json->>_col;
                IF _col IN ('pm_user_ref', 'user_ref', 'collaborator_id', 'p_m') THEN
                    _val := public.fn_resolve_name(CASE WHEN _col = 'collaborator_id' THEN 'collaborators' ELSE 'profiles' END, _val);
                ELSIF _col LIKE '%_at' OR _col LIKE '%_date' OR _col LIKE '%_time' THEN
                    _val := to_char(_val::timestamptz, 'DD/MM/YYYY');
                ELSE
                    _val := public.fn_human_val(_val);
                END IF;

                -- Template placeholders
                _description := REPLACE(_description, '{entity}', '**' || COALESCE(_entity_name, 'quasta attività') || '**');
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
                        'col', _col,
                        'type', TG_TABLE_NAME
                    )
                );
                _final_log_count := _final_log_count + 1;
            END IF;
        END LOOP;
    END IF;

    -- 6. Fallback to General Template (Create/Delete or updates with no col-specific templates)
    IF (_final_log_count = 0 OR TG_OP != 'UPDATE') AND _template IS NOT NULL THEN
        _description := _template;
        _description := REPLACE(_description, '{entity}', '**' || COALESCE(_entity_name, 'questa attività') || '**');
        _description := REPLACE(_description, '{title}', COALESCE(_new_json->>'title', ''));
        _description := REPLACE(_description, '{body}', COALESCE(_new_json->>'body', ''));

        INSERT INTO public.pm_activity_logs (
            actor_user_ref, action_type, space_ref, item_ref, order_ref, details
        ) VALUES (
            _actor_id, _action_name, _space_id, _item_id, _order_id,
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

-- RE-SEED REGISTRY WITH "CAMBIATO" COPY AND PROPER ENTITY HOOKS
DELETE FROM public.pm_activity_registry WHERE table_name IN ('pm_items', 'orders', 'assignments', 'pm_spaces');

INSERT INTO public.pm_activity_registry (table_name, track_insert, track_update, template_insert, column_templates, order_ref_source, space_ref_source, item_ref_source)
VALUES 
('pm_items', true, true, 'ha creato l''attività {entity}', '{
    "status": "ha cambiato lo stato di {entity} da {old_value} a {new_value}",
    "due_date": "ha spostato la scadenza di {entity} al {new_value}",
    "pm_user_ref": "ha assegnato {entity} a {new_value}",
    "priority": "ha impostato la priorità di {entity} a {new_value}",
    "notes": "ha cambiato la descrizione di {entity}",
    "title": "ha rinominato l''attività in **{new_value}**"
}'::jsonb, 'space_ref.ref_ordine', 'space_ref', 'id'),

('orders', true, true, 'ha aperto la commessa {entity}', '{
    "status_works": "ha aggiornato l''avanzamento di {entity} a {new_value}",
    "offer_status": "ha cambiato lo stato offerta di {entity} in {new_value}",
    "p_m": "ha assegnato la gestione della commessa {entity} a {new_value}",
    "notes": "ha cambiato le note della commessa {entity}"
}'::jsonb, 'id', NULL, NULL),

('assignments', true, true, 'ha creato l''incarico {entity}', '{
    "status": "ha cambiato lo stato dell''incarico {entity} in {new_value}",
    "collaborator_id": "ha assegnato l''incarico {entity} a {new_value}",
    "description": "ha cambiato la descrizione dell''incarico {entity}"
}'::jsonb, 'order_id', NULL, NULL),

('pm_spaces', true, true, 'ha creato lo spazio {entity}', '{
    "name": "ha rinominato lo spazio in **{new_value}**"
}'::jsonb, 'ref_ordine', 'id', NULL);

-- RETROACTIVE FIX FOR THE "MISSING NAME" LOGS
-- We try to find the real name from the related table if possible
UPDATE public.pm_activity_logs
SET details = jsonb_set(details, '{description}', 
    format('ha cambiato la descrizione di **%s**', 
        COALESCE(
            (SELECT title FROM public.pm_items WHERE id = item_ref),
            (SELECT title FROM public.orders WHERE id = order_ref),
            details->>'entity_name',
            'questa attività'
        )
    )::jsonb
)
WHERE details->>'description' LIKE '%descrizione%' 
AND (details->>'description' LIKE '%attività%' OR details->>'description' LIKE '%risorsa%')
AND (details->>'description' NOT LIKE '%**%' OR details->>'description' LIKE '%questa attività%');
