-- =============================================================================
-- CLEANUP: Drop duplicate triggers + fix registry misconfigs + space resolution
-- =============================================================================

-- Step 1: Drop duplicate triggers (these cause double logging!)
DROP TRIGGER IF EXISTS trg_clients_generic_log ON clients;
DROP TRIGGER IF EXISTS trg_orders_generic_log ON orders;
DROP TRIGGER IF EXISTS trg_pm_comments_activity_log ON pm_item_comments;
DROP TRIGGER IF EXISTS trg_pm_spaces_generic_log ON pm_spaces;

-- Step 2: Fix registry misconfigurations

-- orders: missing insert_action_name
UPDATE pm_activity_registry
SET insert_action_name = 'new_order'
WHERE table_name = 'orders';

-- invoices: order_ref_source was 'id' (wrong! sets order_ref to invoice's own id)
UPDATE pm_activity_registry
SET order_ref_source = 'order_id'
WHERE table_name = 'invoices';

-- clients: order_ref_source was 'id' (clients don't have order refs)
UPDATE pm_activity_registry
SET order_ref_source = NULL
WHERE table_name = 'clients';

-- payments: use direct order_id column instead of chain 'assignment_id.order_id'
UPDATE pm_activity_registry
SET order_ref_source = 'order_id'
WHERE table_name = 'payments';

-- appointments: space_ref_source = 'order_id.space_ref' is unresolvable chain.
-- We'll resolve space from order_ref inside the trigger instead.
UPDATE pm_activity_registry
SET space_ref_source = NULL
WHERE table_name = 'appointments';

-- doc_pages: space_ref points to doc_space (not pm_space), chain unresolvable
-- item_ref can still resolve correctly via doc_pages.item_ref
UPDATE pm_activity_registry
SET space_ref_source = NULL,
    order_ref_source = NULL
WHERE table_name = 'doc_pages';


-- Step 3: Upgrade trigger — auto-resolve space from order when space is missing
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
        SELECT ref_ordine INTO _order_id FROM public.pm_spaces WHERE id = _space_id;
    END IF;

    -- AUTO-RESOLVE: If we have order but no space, resolve space from order
    IF _space_id IS NULL AND _order_id IS NOT NULL THEN
        SELECT id INTO _space_id FROM public.pm_spaces WHERE ref_ordine = _order_id LIMIT 1;
    END IF;

    -- AUTO-RESOLVE: If we have item but no space, resolve from item
    IF _space_id IS NULL AND _item_id IS NOT NULL THEN
        SELECT space_ref INTO _space_id FROM public.pm_items WHERE id = _item_id;
    END IF;

    -- AUTO-RESOLVE: If we have space but no order, resolve from space
    IF _order_id IS NULL AND _space_id IS NOT NULL THEN
        SELECT ref_ordine INTO _order_id FROM public.pm_spaces WHERE id = _space_id;
    END IF;

    -- 3. Entity Name Resolution
    _entity_name := COALESCE(
        _new_json->>'title',
        _new_json->>'name',
        _new_json->>'business_name',
        _new_json->>'full_name',
        _new_json->>'file_name',
        _new_json->>'invoice_number'
    );

    IF _entity_name IS NULL AND _item_id IS NOT NULL THEN
        SELECT title INTO _entity_name FROM public.pm_items WHERE id = _item_id;
    END IF;

    IF _entity_name IS NULL AND _space_id IS NOT NULL AND _item_id IS NULL THEN
        SELECT name INTO _entity_name FROM public.pm_spaces WHERE id = _space_id;
    END IF;

    _entity_name := COALESCE(_entity_name, 'una risorsa');

    -- 4. Assignee name resolution for pm_item_assignees
    IF TG_TABLE_NAME = 'pm_item_assignees' THEN
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
