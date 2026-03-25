-- Migration to add get_my_activities RPC and fix activity logger trigger
-- Date: 2026-03-25

-- 1. Ensure actor_user_ref exists and fix naming if needed
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pm_activity_logs' AND column_name = 'actor_ref'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pm_activity_logs' AND column_name = 'actor_user_ref'
    ) THEN
        ALTER TABLE public.pm_activity_logs RENAME COLUMN actor_ref TO actor_user_ref;
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pm_activity_logs' AND column_name = 'actor_user_ref'
    ) THEN
        ALTER TABLE public.pm_activity_logs ADD COLUMN actor_user_ref UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Fix the trigger function to use the correct column name actor_user_ref
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
    _ref_space UUID;
    _ref_order UUID;
    _is_acc BOOLEAN := false;
BEGIN
    SELECT * INTO _reg FROM public.pm_activity_registry WHERE table_name = TG_TABLE_NAME AND is_active = true;
    IF NOT FOUND THEN RETURN NEW; END IF;

    _actor_id := auth.uid();
    _new_json := to_jsonb(NEW);

    -- Operation setup
    IF (TG_OP = 'INSERT' AND _reg.track_insert) THEN
        _template := _reg.template_insert;
        _action_name := COALESCE(_reg.insert_action_name, 'INSERT');
    ELSIF (TG_OP = 'UPDATE' AND _reg.track_update) THEN
        _old_json := to_jsonb(OLD);
        _action_name := COALESCE(_reg.update_action_name, 'UPDATE');
        
        -- Build diff
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
        _action_name := COALESCE(_reg.delete_action_name, 'DELETE');
        _new_json := to_jsonb(OLD);
    ELSE
        RETURN NEW;
    END IF;

    -- --- Reference Resolution ---
    
    -- Item Ref
    IF _reg.item_ref_source IS NOT NULL AND _reg.item_ref_source != '' THEN 
        IF _reg.item_ref_source = 'id' THEN _item_id := (_new_json->>'id')::uuid;
        ELSE _item_id := (_new_json->>_reg.item_ref_source)::uuid; 
        END IF;
    END IF;

    -- Order Ref
    IF _reg.order_ref_source IS NOT NULL THEN
        IF _reg.order_ref_source = 'id' THEN _order_id := (_new_json->>'id')::uuid;
        ELSIF _reg.order_ref_source = 'ref_ordine' THEN _order_id := (_new_json->>'ref_ordine')::uuid;
        ELSIF _reg.order_ref_source = 'order_ref' THEN _order_id := (_new_json->>'order_ref')::uuid;
        ELSIF _reg.order_ref_source = 'order_id' THEN _order_id := (_new_json->>'order_id')::uuid;
        ELSIF _reg.order_ref_source = 'space_ref.ref_ordine' AND (_new_json->>'space_ref') IS NOT NULL THEN
            SELECT ref_ordine INTO _order_id FROM public.pm_spaces WHERE id = (_new_json->>'space_ref')::uuid;
        ELSIF _reg.order_ref_source = 'pm_item_ref.space_ref.ref_ordine' AND (_new_json->>'pm_item_ref') IS NOT NULL THEN
            SELECT space_ref INTO _ref_space FROM public.pm_items WHERE id = (_new_json->>'pm_item_ref')::uuid;
            IF _ref_space IS NOT NULL THEN SELECT ref_ordine INTO _order_id FROM public.pm_spaces WHERE id = _ref_space; END IF;
        ELSIF _reg.order_ref_source = 'space_ref.space_ref.ref_ordine' AND (_new_json->>'space_ref') IS NOT NULL THEN
            SELECT space_ref INTO _ref_space FROM public.doc_spaces WHERE id = (_new_json->>'space_ref')::uuid;
            IF _ref_space IS NOT NULL THEN SELECT ref_ordine INTO _order_id FROM public.pm_spaces WHERE id = _ref_space; END IF;
        END IF;
    END IF;

    -- Space Ref
    IF _reg.space_ref_source IS NOT NULL AND _reg.space_ref_source != '' THEN 
        IF _reg.space_ref_source = 'id' THEN _space_id := (_new_json->>'id')::uuid;
        ELSIF _reg.space_ref_source = 'order_id.space_ref' AND (_new_json->>'order_id') IS NOT NULL THEN
             SELECT id INTO _space_id FROM public.pm_spaces WHERE ref_ordine = (_new_json->>'order_id')::uuid LIMIT 1;
        ELSIF _reg.space_ref_source = 'order_ref.space_ref' AND (_new_json->>'order_ref') IS NOT NULL THEN
             SELECT id INTO _space_id FROM public.pm_spaces WHERE ref_ordine = (_new_json->>'order_ref')::uuid LIMIT 1;
        ELSIF _reg.space_ref_source = 'pm_item_ref.space_ref' AND (_new_json->>'pm_item_ref') IS NOT NULL THEN
             SELECT space_ref INTO _space_id FROM public.pm_items WHERE id = (_new_json->>'pm_item_ref')::uuid;
        ELSIF _reg.space_ref_source = 'space_ref.space_ref' AND (_new_json->>'space_ref') IS NOT NULL THEN
             SELECT space_ref INTO _space_id FROM public.doc_spaces WHERE id = (_new_json->>'space_ref')::uuid;
        ELSE _space_id := (_new_json->>_reg.space_ref_source)::uuid; 
        END IF;
    END IF;

    -- Client Ref
    IF _reg.client_ref_source IS NOT NULL THEN
        IF _reg.client_ref_source = 'client_id' THEN _client_id := (_new_json->>'client_id')::uuid;
        ELSIF _reg.client_ref_source = 'id' THEN _client_id := (_new_json->>'id')::uuid;
        ELSIF _reg.client_ref_source = 'order_ref.client_id' THEN
            _ref_order := COALESCE(_order_id, (_new_json->>'order_ref')::uuid);
            IF _ref_order IS NOT NULL THEN SELECT client_id INTO _client_id FROM public.orders WHERE id = _ref_order; END IF;
        ELSIF _reg.client_ref_source = 'order_id.client_id' THEN
            _ref_order := COALESCE(_order_id, (_new_json->>'order_id')::uuid);
            IF _ref_order IS NOT NULL THEN SELECT client_id INTO _client_id FROM public.orders WHERE id = _ref_order; END IF;
        ELSIF _reg.client_ref_source = 'space_ref.ref_ordine.client_id' THEN
            _ref_space := COALESCE(_space_id, (_new_json->>'space_ref')::uuid);
            IF _ref_space IS NOT NULL THEN
                SELECT ref_ordine INTO _ref_order FROM public.pm_spaces WHERE id = _ref_space;
                IF _ref_order IS NOT NULL THEN SELECT client_id INTO _client_id FROM public.orders WHERE id = _ref_order; END IF;
            END IF;
        ELSIF _reg.client_ref_source = 'pm_item_ref.space_ref.ref_ordine.client_id' THEN
            SELECT space_ref INTO _ref_space FROM public.pm_items WHERE id = (_new_json->>'pm_item_ref')::uuid;
            IF _ref_space IS NOT NULL THEN
                SELECT ref_ordine INTO _ref_order FROM public.pm_spaces WHERE id = _ref_space;
                IF _ref_order IS NOT NULL THEN SELECT client_id INTO _client_id FROM public.orders WHERE id = _ref_order; END IF;
            END IF;
        END IF;
    END IF;

    -- Account Level Flag resolution
    IF TG_TABLE_NAME IN ('pm_items', 'appointments') THEN
        _is_acc := COALESCE((_new_json->>'is_account_level')::boolean, false);
    ELSIF TG_TABLE_NAME = 'orders' THEN
        _is_acc := true; -- Orders are always account level context
    ELSIF TG_TABLE_NAME = 'doc_pages' AND (_new_json->>'item_ref') IS NOT NULL THEN
        SELECT is_account_level INTO _is_acc FROM public.pm_items WHERE id = (_new_json->>'item_ref')::uuid;
    ELSIF TG_TABLE_NAME = 'pm_item_comments' AND (_new_json->>'pm_item_ref') IS NOT NULL THEN
        SELECT is_account_level INTO _is_acc FROM public.pm_items WHERE id = (_new_json->>'pm_item_ref')::uuid;
    ELSIF TG_TABLE_NAME IN ('assignments', 'payments', 'invoices') THEN
        _is_acc := true; -- Accounting tables
    END IF;

    -- --- LOG GENERATION ---
    
    -- UPDATE with Granular Templates
    IF TG_OP = 'UPDATE' AND _reg.column_templates IS NOT NULL AND jsonb_array_length(jsonb_path_query_array(_reg.column_templates, '$.*')) > 0 THEN
        FOR _col IN SELECT jsonb_object_keys(_diff_json) LOOP
            _col_template := _reg.column_templates->>_col;
            IF _col_template IS NOT NULL THEN
                _description := _col_template;
                FOR _val IN SELECT jsonb_object_keys(_new_json) LOOP
                    _description := REPLACE(_description, '{' || _val || '}', COALESCE(_new_json->>_val, ''));
                END LOOP;
                _description := REPLACE(_description, '{old_value}', COALESCE(_old_json->>_col, ''));
                _description := REPLACE(_description, '{new_value}', COALESCE(_new_json->>_col, ''));

                INSERT INTO public.pm_activity_logs (
                    actor_user_ref, action_type, description, space_ref, item_ref, order_ref, client_ref, is_account_level, metadata
                ) VALUES (
                    _actor_id, _action_name || ':' || _col, _description, _space_id, _item_id, _order_id, _client_id, _is_acc,
                    jsonb_build_object('table', TG_TABLE_NAME, 'col', _col, 'old', _old_json->>_col, 'new', _new_json->>_col)
                );
                _final_log_count := _final_log_count + 1;
            END IF;
        END LOOP;
    END IF;

    -- Standard Template (fallback)
    IF (_final_log_count = 0 OR TG_OP != 'UPDATE') AND _template IS NOT NULL THEN
        _description := _template;
        IF _description LIKE '%{%' THEN
            FOR _col IN SELECT jsonb_object_keys(_new_json) LOOP
                -- Use _col here instead of _val which was a bug in previous version
                _description := REPLACE(_description, '{' || _col || '}', COALESCE(_new_json->>_col, ''));
            END LOOP;
        END IF;

        INSERT INTO public.pm_activity_logs (
            actor_user_ref, action_type, description, space_ref, item_ref, order_ref, client_ref, is_account_level, metadata
        ) VALUES (
            _actor_id, _action_name, _description, _space_id, _item_id, _order_id, _client_id, _is_acc,
            jsonb_build_object('table', TG_TABLE_NAME, 'diff', _diff_json)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Create the optimized fetch function for the activity feed
CREATE OR REPLACE FUNCTION public.get_my_activities(target_user_id UUID, max_limit INT DEFAULT 50)
RETURNS TABLE (
    id UUID,
    action_type TEXT,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    item_ref UUID,
    space_ref UUID,
    order_ref UUID,
    actor_user_ref UUID,
    actor_name TEXT,
    actor_avatar TEXT,
    item_title TEXT,
    space_name TEXT,
    order_number TEXT,
    order_title TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH my_assigned_items AS (
        SELECT pm_item_ref FROM public.pm_item_assignees WHERE user_ref = target_user_id
    ),
    my_assigned_spaces AS (
        SELECT pm_space_ref FROM public.pm_space_assignees WHERE user_ref = target_user_id
    ),
    my_assigned_orders AS (
        -- Directly as PM
        SELECT o.id FROM public.orders o WHERE o.pm_id_uuid = target_user_id
        UNION
        -- Via Space (Internal or Commessa)
        SELECT s.ref_ordine FROM public.pm_spaces s WHERE s.default_pm_user_ref = target_user_id AND s.ref_ordine IS NOT NULL
        UNION
        -- Via Collaborator links
        SELECT oc.order_id FROM public.order_collaborators oc 
        JOIN public.collaborators c ON oc.collaborator_id = c.id 
        WHERE c.user_id = target_user_id
    )
    SELECT 
        l.id, l.action_type, l.description, l.metadata, l.created_at, l.item_ref, l.space_ref, l.order_ref, l.actor_user_ref,
        COALESCE(p.full_name, 'Sistema') AS actor_name,
        p.avatar_url AS actor_avatar,
        i.title AS item_title,
        s.name AS space_name,
        o.order_number,
        o.title AS order_title
    FROM public.pm_activity_logs l
    LEFT JOIN public.profiles p ON l.actor_user_ref = p.id
    LEFT JOIN public.pm_items i ON l.item_ref = i.id
    LEFT JOIN public.pm_spaces s ON l.space_ref = s.id
    LEFT JOIN public.orders o ON l.order_ref = o.id
    WHERE l.actor_user_ref = target_user_id
       OR l.item_ref IN (SELECT pm_item_ref FROM my_assigned_items)
       OR l.space_ref IN (SELECT pm_space_ref FROM my_assigned_spaces)
       OR l.order_ref IN (SELECT mao.id FROM my_assigned_orders mao)
       OR l.is_account_level = true
    ORDER BY l.created_at DESC
    LIMIT max_limit;
END;
$$ LANGUAGE plpgsql STABLE;
