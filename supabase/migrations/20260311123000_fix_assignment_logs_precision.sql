-- FIX LOGS REDUNDANCY AND PRECISION
-- This migration fixes the "aggiunto membri" spam when creating activities
BEGIN;

-- 1. Update the Logger to handle assignments more intelligently
CREATE OR REPLACE FUNCTION public.fn_app_activity_logger()
RETURNS TRIGGER AS $$
DECLARE
    _reg RECORD;
    _description TEXT;
    _item_id UUID;
    _space_id UUID;
    _order_id UUID;
    _new_json JSONB;
    _old_json JSONB;
    _diff_json JSONB := '{}'::jsonb;
    _entity_name TEXT;
    _col TEXT;
    _val TEXT;
    _col_template TEXT;
    _final_log_count INTEGER := 0;
    _creator_id UUID;
BEGIN
    SELECT * INTO _reg FROM public.pm_activity_registry WHERE table_name = TG_TABLE_NAME AND is_active = true;
    IF NOT FOUND THEN RETURN NEW; END IF;

    _new_json := to_jsonb(NEW);

    -- Operation Detection & Diff Building
    IF (TG_OP = 'UPDATE') THEN
        _old_json := to_jsonb(OLD);
        FOR _col IN SELECT jsonb_object_keys(_new_json) LOOP
            IF (_new_json->>_col IS DISTINCT FROM _old_json->>_col) THEN
                _diff_json := _diff_json || jsonb_build_object(_col, _new_json->>_col);
            END IF;
        END LOOP;
        
        -- If no tracked columns changed, return
        IF _reg.track_columns IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jsonb_object_keys(_diff_json) k WHERE k = ANY(_reg.track_columns)) THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Reference Resolution
    IF _reg.item_ref_source = 'id' THEN _item_id := (NEW.id);
    ELSIF _reg.item_ref_source IS NOT NULL THEN _item_id := (_new_json->>_reg.item_ref_source)::uuid; 
    END IF;

    IF _reg.space_ref_source = 'id' THEN _space_id := (NEW.id);
    ELSIF _reg.space_ref_source = 'space_ref' THEN _space_id := (NEW.space_ref);
    ELSIF _reg.space_ref_source = 'pm_item_ref.space_ref' AND (_new_json->>'pm_item_ref') IS NOT NULL THEN
        SELECT space_ref INTO _space_id FROM public.pm_items WHERE id = (_new_json->>'pm_item_ref')::uuid;
    END IF;

    IF _reg.order_ref_source = 'id' THEN _order_id := (NEW.id);
    ELSIF _reg.order_ref_source IN ('order_id', 'order_ref', 'ref_ordine') THEN _order_id := (_new_json->>_reg.order_ref_source)::uuid;
    ELSIF _reg.order_ref_source = 'space_ref.ref_ordine' AND _space_id IS NOT NULL THEN
        SELECT ref_ordine INTO _order_id FROM public.pm_spaces WHERE id = _space_id;
    END IF;

    -- Entity Name Resolution
    _entity_name := COALESCE(
        _new_json->>'title', 
        _new_json->>'name',
        (SELECT title FROM public.pm_items WHERE id = _item_id),
        (SELECT title FROM public.orders WHERE id = _order_id),
        (SELECT name FROM public.pm_spaces WHERE id = _space_id),
        'questa attività'
    );

    -- --- SPECIAL CASE: ASSIGNMENTS (Self-assignment skip & Member Resolve) ---
    IF TG_TABLE_NAME = 'pm_item_assignees' AND TG_OP = 'INSERT' THEN
        -- Resolve member name
        _val := public.fn_resolve_name(
            CASE WHEN (NEW.collaborator_ref) IS NOT NULL THEN 'collaborators' ELSE 'profiles' END,
            COALESCE(NEW.user_ref::text, NEW.collaborator_ref::text)
        );

        -- Check if it's the item creator assigning themselves during creation
        IF _item_id IS NOT NULL THEN
            SELECT created_by_user_ref INTO _creator_id FROM public.pm_items WHERE id = _item_id;
            IF NEW.user_ref = _creator_id AND auth.uid() = _creator_id THEN
                -- DO NOT LOG: Redundant with "Created activity" log
                RETURN NEW;
            END IF;
        END IF;

        -- Wording adjustment for self-assignment (later or by someone else)
        IF auth.uid() = NEW.user_ref THEN
            _val := 'se stesso';
        END IF;

        IF _reg.template_insert IS NOT NULL THEN
            _description := REPLACE(_reg.template_insert, '{entity}', '**' || _entity_name || '**');
            _description := REPLACE(_description, '{member}', '**' || _val || '**');
            
            INSERT INTO public.pm_activity_logs (actor_user_ref, action_type, space_ref, item_ref, order_ref, details)
            VALUES (auth.uid(), TG_TABLE_NAME || ':created', _space_id, _item_id, _order_id, 
                jsonb_build_object('description', _description, 'entity_name', _entity_name, 'member_name', _val));
            RETURN NEW;
        END IF;
    END IF;

    -- Specific Column Updates
    IF _reg.column_templates IS NOT NULL THEN
        FOR _col IN SELECT jsonb_object_keys(_diff_json) LOOP
            _col_template := _reg.column_templates->>_col;
            IF _col_template IS NOT NULL THEN
                -- On INSERT, skip 'notes'/'title' to favor generic "created" log
                IF TG_OP = 'INSERT' AND (_col = 'notes' OR _col = 'title') THEN
                   CONTINUE;
                END IF;

                _val := public.fn_human_val(_new_json->>_col);
                IF _col IN ('pm_user_ref', 'user_ref', 'collaborator_id', 'p_m', 'created_by_user_ref') THEN
                   _val := public.fn_resolve_name(CASE WHEN _col = 'collaborator_id' THEN 'collaborators' ELSE 'profiles' END, _new_json->>_col);
                END IF;

                _description := REPLACE(_col_template, '{entity}', '**' || _entity_name || '**');
                _description := REPLACE(_description, '{new_value}', '**' || _val || '**');
                _description := REPLACE(_description, '{old_value}', '**' || public.fn_human_val(_old_json->>_col) || '**');

                INSERT INTO public.pm_activity_logs (actor_user_ref, action_type, space_ref, item_ref, order_ref, details)
                VALUES (auth.uid(), TG_TABLE_NAME || ':' || TG_OP || ':' || _col, _space_id, _item_id, _order_id, 
                    jsonb_build_object('description', _description, 'entity_name', _entity_name, 'old', _old_json->>_col, 'new', _new_json->>_col));
                _final_log_count := _final_log_count + 1;
            END IF;
        END LOOP;
    END IF;

    -- Generic INSERT log if no specific columns were logged
    IF (_final_log_count = 0) AND (TG_OP = 'INSERT') AND _reg.template_insert IS NOT NULL THEN
        _description := REPLACE(_reg.template_insert, '{entity}', '**' || _entity_name || '**');
        INSERT INTO public.pm_activity_logs (actor_user_ref, action_type, space_ref, item_ref, order_ref, details)
        VALUES (auth.uid(), TG_TABLE_NAME || ':created', _space_id, _item_id, _order_id, 
            jsonb_build_object('description', _description, 'entity_name', _entity_name));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update Registry for Assignees
UPDATE public.pm_activity_registry 
SET template_insert = 'ha assegnato {member} a {entity}'
WHERE table_name = 'pm_item_assignees';

-- 3. Cleanup existing "bad" logs from the last 24 hours to give a clean look immediately
DELETE FROM public.pm_activity_logs 
WHERE created_at > NOW() - INTERVAL '24 hours'
AND action_type = 'pm_item_assignees:created'
AND details->>'description' LIKE '%aggiunto membri%';

COMMIT;
