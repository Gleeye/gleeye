-- =============================================================================
-- FIX: Appointment activity logs
-- 1. Fix registry: appointments use pm_space_id not space_ref
-- 2. Rewrite participant trigger: resolve name, skip on initial creation, add order_ref
-- 3. Update main trigger to support pm_space_id as space source
-- =============================================================================

-- Step 1: Fix registry — appointments have pm_space_id column
UPDATE pm_activity_registry
SET space_ref_source = 'pm_space_id'
WHERE table_name = 'appointments';

-- Step 2: Rewrite the participant trigger to:
--   a) Resolve participant name from collaborators/profiles
--   b) Skip activity log if appointment was JUST created (within 5 seconds) — avoids duplicates
--   c) Include order_ref in the log
--   d) Still send notification regardless
CREATE OR REPLACE FUNCTION public.trg_appointment_participants_notify_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT := 'Un utente';
    v_appointment RECORD;
    v_target_user UUID;
    v_participant_name TEXT;
    v_order_id UUID;
    v_is_initial_creation BOOLEAN := false;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        SELECT COALESCE(full_name, 'Un utente') INTO v_actor_name
        FROM profiles WHERE id = v_actor_id;
    END IF;

    SELECT * INTO v_appointment FROM public.appointments WHERE id = NEW.appointment_id;

    IF v_appointment.pm_space_id IS NOT NULL THEN
        -- Resolve target user from collaborator
        SELECT user_id INTO v_target_user FROM public.collaborators WHERE id = NEW.collaborator_id;

        -- Resolve participant name
        IF v_target_user IS NOT NULL THEN
            SELECT full_name INTO v_participant_name FROM public.profiles WHERE id = v_target_user;
        END IF;
        IF v_participant_name IS NULL AND NEW.collaborator_id IS NOT NULL THEN
            SELECT full_name INTO v_participant_name FROM public.collaborators WHERE id = NEW.collaborator_id;
        END IF;
        v_participant_name := COALESCE(v_participant_name, 'un partecipante');

        -- Get order_id
        v_order_id := v_appointment.order_id;

        -- Check if this is part of initial appointment creation (within 5 seconds)
        IF v_appointment.created_at IS NOT NULL AND
           (NOW() - v_appointment.created_at) < INTERVAL '5 seconds' THEN
            v_is_initial_creation := true;
        END IF;

        IF v_target_user IS NOT NULL THEN
            IF TG_OP = 'INSERT' THEN
                -- Only log activity if NOT initial creation (avoid duplicates with appointment_created)
                IF NOT v_is_initial_creation THEN
                    INSERT INTO public.pm_activity_logs (space_ref, order_ref, actor_user_ref, action_type, details)
                    VALUES (
                        v_appointment.pm_space_id,
                        v_order_id,
                        v_actor_id,
                        'appointment_participant_added',
                        jsonb_build_object(
                            'appointment_title', v_appointment.title,
                            'assigned_user', v_target_user,
                            'participant_name', v_participant_name,
                            'entity_name', v_appointment.title
                        )
                    );
                END IF;

                -- Always send notification
                PERFORM public.broadcast_pm_notification(
                    ARRAY[v_target_user], 'pm_appointment_invited', 'Invito Appuntamento',
                    v_actor_name || ' ti ha invitato all''appuntamento: ' || v_appointment.title,
                    jsonb_build_object('space_id', v_appointment.pm_space_id, 'appointment_id', v_appointment.id),
                    v_actor_id
                );
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

-- Step 3: Update main trigger to support pm_space_id as space source
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

    -- Space Ref (support both space_ref and pm_space_id)
    IF _reg.space_ref_source = 'id' THEN
        _space_id := (_new_json->>'id')::uuid;
    ELSIF _reg.space_ref_source = 'space_ref' THEN
        _space_id := (_new_json->>'space_ref')::uuid;
    ELSIF _reg.space_ref_source = 'pm_space_id' THEN
        _space_id := (_new_json->>'pm_space_id')::uuid;
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

    -- AUTO-RESOLVE cascade
    IF _space_id IS NULL AND _order_id IS NOT NULL THEN
        SELECT id INTO _space_id FROM public.pm_spaces WHERE ref_ordine = _order_id LIMIT 1;
    END IF;
    IF _space_id IS NULL AND _item_id IS NOT NULL THEN
        SELECT space_ref INTO _space_id FROM public.pm_items WHERE id = _item_id;
    END IF;
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
