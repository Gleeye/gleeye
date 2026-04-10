-- =============================================================================
-- FIX ACTIVITY FEED: enriched trigger + correct action names
-- =============================================================================
-- Fixes:
-- 1. Missing insert/update action names in registry → generic "created"/"updated"
-- 2. UPDATE logs don't store col/old/new → frontend can't show what changed
-- 3. entity_name = "una risorsa" for relation tables → resolved via JOIN
-- 4. pm_item_assignees: assignee name not resolved
-- 5. payments/bank_transactions: amount not stored in details
-- =============================================================================

-- Step 1: Fix registry action names
UPDATE pm_activity_registry
SET insert_action_name = 'new_task', update_action_name = 'task_updated'
WHERE table_name = 'pm_items';

UPDATE pm_activity_registry
SET insert_action_name = 'new_space', update_action_name = 'space_updated'
WHERE table_name = 'pm_spaces';

UPDATE pm_activity_registry
SET insert_action_name = 'new_incarico', update_action_name = 'incarico_updated'
WHERE table_name = 'assignments';

-- Fix pm_item_assignees template to use {assignee_name} (resolvable)
UPDATE pm_activity_registry
SET template_insert = 'ha aggiunto **{assignee_name}** al team di **{entity}**',
    template_delete = 'ha rimosso un membro dal team di **{entity}**'
WHERE table_name = 'pm_item_assignees';

-- Fix pm_item_comments template
UPDATE pm_activity_registry
SET template_insert = 'ha commentato su **{entity}**'
WHERE table_name = 'pm_item_comments';


-- Step 2: Rewrite trigger with enriched details
CREATE OR REPLACE FUNCTION public.fn_app_activity_logger()
RETURNS TRIGGER AS $$
DECLARE
    _reg RECORD;
    _template TEXT;
    _action_name TEXT;
    _order_id UUID;
    _space_id UUID;
    _item_id UUID;
    _client_id UUID;
    _actor_id UUID;
    _new_json JSONB;
    _old_json JSONB;
    _entity_name TEXT;
    _is_acc BOOLEAN := false;
    _details JSONB;
    _tracked_col TEXT;
    _has_tracked_change BOOLEAN := false;
    _assignee_name TEXT;
BEGIN
    -- 1. Get registry config
    SELECT * INTO _reg FROM public.pm_activity_registry
    WHERE table_name = TG_TABLE_NAME AND is_active = true;
    IF NOT FOUND THEN RETURN COALESCE(NEW, OLD); END IF;

    _actor_id := auth.uid();
    _new_json := to_jsonb(COALESCE(NEW, OLD));

    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        _old_json := to_jsonb(OLD);
    END IF;

    -- 2. Reference Resolution
    -- Item Ref
    IF _reg.item_ref_source = 'id' THEN
        _item_id := (_new_json->>'id')::uuid;
    ELSIF _reg.item_ref_source IS NOT NULL THEN
        _item_id := (_new_json->>_reg.item_ref_source)::uuid;
    END IF;

    -- Delete safety: don't reference item that's being deleted
    IF TG_OP = 'DELETE' THEN _item_id := NULL; END IF;

    -- Space Ref
    IF _reg.space_ref_source = 'id' THEN
        _space_id := (_new_json->>'id')::uuid;
    ELSIF _reg.space_ref_source = 'space_ref' THEN
        _space_id := (_new_json->>'space_ref')::uuid;
    ELSIF _reg.space_ref_source = 'pm_item_ref.space_ref' THEN
        SELECT space_ref INTO _space_id FROM public.pm_items WHERE id = (_new_json->>'pm_item_ref')::uuid;
    END IF;

    -- Order Ref
    IF _reg.order_ref_source = 'id' THEN
        _order_id := (_new_json->>'id')::uuid;
    ELSIF _reg.order_ref_source IN ('order_id', 'order_ref', 'ref_ordine') THEN
        _order_id := (_new_json->>_reg.order_ref_source)::uuid;
    ELSIF _reg.order_ref_source LIKE '%ref_ordine' AND _space_id IS NOT NULL THEN
        -- Handles: space_ref.ref_ordine, pm_item_ref.space_ref.ref_ordine
        SELECT ref_ordine INTO _order_id FROM public.pm_spaces WHERE id = _space_id;
    END IF;

    -- 3. Entity Name Resolution (enriched)
    _entity_name := COALESCE(
        _new_json->>'title',
        _new_json->>'name',
        _new_json->>'business_name',
        _new_json->>'full_name',
        _new_json->>'file_name',
        _new_json->>'invoice_number'
    );

    -- For relation tables: resolve from the referenced item
    IF _entity_name IS NULL AND _item_id IS NOT NULL THEN
        SELECT title INTO _entity_name FROM public.pm_items WHERE id = _item_id;
    END IF;

    -- For space-level entities without item
    IF _entity_name IS NULL AND _space_id IS NOT NULL AND _item_id IS NULL THEN
        SELECT name INTO _entity_name FROM public.pm_spaces WHERE id = _space_id;
    END IF;

    _entity_name := COALESCE(_entity_name, 'una risorsa');

    -- 4. Assignee name resolution for pm_item_assignees
    IF TG_TABLE_NAME = 'pm_item_assignees' THEN
        -- Try profiles first (app users), then collaborators
        SELECT full_name INTO _assignee_name
        FROM public.profiles WHERE id = (_new_json->>'user_ref')::uuid;

        IF _assignee_name IS NULL AND _new_json->>'collaborator_ref' IS NOT NULL THEN
            SELECT full_name INTO _assignee_name
            FROM public.collaborators WHERE id = (_new_json->>'collaborator_ref')::uuid;
        END IF;

        _assignee_name := COALESCE(_assignee_name, 'un membro');
    END IF;

    -- 5. Process by operation type
    IF TG_OP = 'INSERT' AND _reg.track_insert THEN
        _action_name := COALESCE(_reg.insert_action_name, 'created');
        _template := _reg.template_insert;

        _details := jsonb_build_object(
            'entity_name', _entity_name,
            'description', _template
        );

        -- Enrich details with table-specific fields
        IF _new_json ? 'amount' THEN
            _details := _details || jsonb_build_object('amount', _new_json->>'amount');
        END IF;
        IF _new_json ? 'invoice_number' THEN
            _details := _details || jsonb_build_object('invoice_number', _new_json->>'invoice_number');
        END IF;
        IF _assignee_name IS NOT NULL THEN
            _details := _details || jsonb_build_object('assignee_name', _assignee_name);
        END IF;

        BEGIN
            INSERT INTO public.pm_activity_logs (
                actor_user_ref, action_type, space_ref, item_ref, order_ref, client_ref, is_account_level, details
            ) VALUES (
                _actor_id, _action_name, _space_id, _item_id, _order_id, _client_id, _is_acc, _details
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Activity logger INSERT fail: % (%)', SQLERRM, SQLSTATE;
        END;

    ELSIF TG_OP = 'UPDATE' AND _reg.track_update THEN
        -- For each tracked column that changed, insert a SPECIFIC log entry
        IF _reg.track_columns IS NOT NULL THEN
            FOREACH _tracked_col IN ARRAY _reg.track_columns LOOP
                IF (_new_json->>_tracked_col) IS DISTINCT FROM (_old_json->>_tracked_col) THEN
                    _has_tracked_change := true;
                    _action_name := COALESCE(_reg.update_action_name, 'updated') || ':' || _tracked_col;

                    _details := jsonb_build_object(
                        'entity_name', _entity_name,
                        'col', _tracked_col,
                        'old', _old_json->>_tracked_col,
                        'new', _new_json->>_tracked_col
                    );

                    BEGIN
                        INSERT INTO public.pm_activity_logs (
                            actor_user_ref, action_type, space_ref, item_ref, order_ref, client_ref, is_account_level, details
                        ) VALUES (
                            _actor_id, _action_name, _space_id, _item_id, _order_id, _client_id, _is_acc, _details
                        );
                    EXCEPTION WHEN OTHERS THEN
                        RAISE WARNING 'Activity logger UPDATE col fail: % (%)', SQLERRM, SQLSTATE;
                    END;
                END IF;
            END LOOP;
        END IF;

        -- If no tracked columns changed but track_columns is NULL, log generic update
        IF NOT _has_tracked_change AND _reg.track_columns IS NULL THEN
            _action_name := COALESCE(_reg.update_action_name, 'updated');
            _details := jsonb_build_object(
                'entity_name', _entity_name,
                'description', _reg.template_update
            );

            BEGIN
                INSERT INTO public.pm_activity_logs (
                    actor_user_ref, action_type, space_ref, item_ref, order_ref, client_ref, is_account_level, details
                ) VALUES (
                    _actor_id, _action_name, _space_id, _item_id, _order_id, _client_id, _is_acc, _details
                );
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Activity logger UPDATE generic fail: % (%)', SQLERRM, SQLSTATE;
            END;
        END IF;

    ELSIF TG_OP = 'DELETE' AND _reg.track_delete THEN
        _action_name := COALESCE(_reg.delete_action_name, 'deleted');
        _template := _reg.template_delete;

        _details := jsonb_build_object(
            'entity_name', _entity_name,
            'description', _template
        );

        BEGIN
            INSERT INTO public.pm_activity_logs (
                actor_user_ref, action_type, space_ref, item_ref, order_ref, client_ref, is_account_level, details
            ) VALUES (
                _actor_id, _action_name, _space_id, NULL, _order_id, _client_id, _is_acc, _details
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Activity logger DELETE fail: % (%)', SQLERRM, SQLSTATE;
        END;
    ELSE
        RETURN COALESCE(NEW, OLD);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
