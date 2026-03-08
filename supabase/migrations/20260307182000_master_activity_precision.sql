-- MASTER ACTIVITY LOG UNIFICATION & PRECISION OVERHAUL
-- 1. Remove all redundant/conflicting logging from notification triggers
-- 2. Drop all known logging triggers to start clean
-- 3. Install the ultimate fn_app_activity_logger
-- 4. Fix ALL historical logs (both top-level and jsonb columns)

-- --- PART 1: NOTIFICATION TRIGGERS CLEANUP ---
-- We need notifications, but NOT logging inside them.
CREATE OR REPLACE FUNCTION public.trg_pm_items_notify_log()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT := 'Un utente';
    v_space_pm UUID;
    v_assignees UUID[];
    v_recipients UUID[];
BEGIN
    v_actor_id := COALESCE(auth.uid(), NEW.created_by_user_ref);
    IF v_actor_id IS NOT NULL THEN
        SELECT COALESCE(first_name || ' ' || last_name, 'Un utente') INTO v_actor_name FROM profiles WHERE id = v_actor_id;
    END IF;

    SELECT default_pm_user_ref INTO v_space_pm FROM public.pm_spaces WHERE id = NEW.space_ref;
    SELECT array_agg(user_ref) INTO v_assignees FROM public.pm_item_assignees WHERE pm_item_ref = NEW.id;
    v_recipients := array_cat(ARRAY[v_space_pm, NEW.created_by_user_ref, NEW.pm_user_ref], COALESCE(v_assignees, ARRAY[]::UUID[]));

    IF TG_OP = 'INSERT' THEN
        PERFORM public.broadcast_pm_notification(v_recipients, 'pm_item_created', 'Nuova Attività', v_actor_name || ' ha creato: ' || NEW.title, jsonb_build_object('space_id', NEW.space_ref, 'item_id', NEW.id), v_actor_id);
    ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
        PERFORM public.broadcast_pm_notification(v_recipients, 'pm_item_status', 'Cambio Stato', v_actor_name || ' ha spostato "' || NEW.title || '" in ' || NEW.status, jsonb_build_object('space_id', NEW.space_ref, 'item_id', NEW.id, 'status', NEW.status), v_actor_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (Repeat for spaces and comments if they log)
CREATE OR REPLACE FUNCTION public.trg_pm_spaces_notify_log()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
    v_pm_name TEXT := '';
    v_admin_users UUID[];
    v_recipients UUID[];
BEGIN
    v_actor_id := COALESCE(auth.uid(), NEW.default_pm_user_ref);
    IF v_actor_id IS NOT NULL THEN SELECT COALESCE(first_name || ' ' || last_name, 'Un utente') INTO v_pm_name FROM profiles WHERE id = v_actor_id; END IF;
    SELECT array_agg(id) INTO v_admin_users FROM auth.users WHERE EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.users.id AND profiles.role = 'admin');
    v_recipients := array_cat(v_admin_users, ARRAY[NEW.default_pm_user_ref]);
    
    IF TG_OP = 'INSERT' THEN
        PERFORM public.broadcast_pm_notification(v_recipients, 'pm_space_created', 'Nuovo Spazio Lavoro', v_pm_name || ' ha creato: ' || NEW.name, jsonb_build_object('space_id', NEW.id, 'space_type', NEW.type), v_actor_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --- PART 2: ULTIMATE LOGGER ---
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
BEGIN
    SELECT * INTO _reg FROM public.pm_activity_registry WHERE table_name = TG_TABLE_NAME AND is_active = true;
    IF NOT FOUND THEN RETURN NEW; END IF;

    _new_json := to_jsonb(NEW);

    -- Operation Detection
    IF (TG_OP = 'UPDATE') THEN
        _old_json := to_jsonb(OLD);
        FOR _col IN SELECT jsonb_object_keys(_new_json) LOOP
            IF (_new_json->>_col IS DISTINCT FROM _old_json->>_col) THEN
                _diff_json := _diff_json || jsonb_build_object(_col, _new_json->>_col);
            END IF;
        END LOOP;
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

    -- Entity Name: Be extremely persistent.
    _entity_name := COALESCE(
        _new_json->>'title', 
        _new_json->>'name',
        (SELECT title FROM public.pm_items WHERE id = _item_id),
        (SELECT title FROM public.orders WHERE id = _order_id),
        (SELECT name FROM public.pm_spaces WHERE id = _space_id),
        'questa attività'
    );

    IF TG_OP = 'UPDATE' AND _reg.column_templates IS NOT NULL THEN
        FOR _col IN SELECT jsonb_object_keys(_diff_json) LOOP
            _col_template := _reg.column_templates->>_col;
            IF _col_template IS NOT NULL THEN
                _val := public.fn_human_val(_new_json->>_col);
                -- Reference translation (names)
                IF _col IN ('pm_user_ref', 'user_ref', 'collaborator_id', 'p_m') THEN
                   _val := public.fn_resolve_name(CASE WHEN _col = 'collaborator_id' THEN 'collaborators' ELSE 'profiles' END, _new_json->>_col);
                END IF;

                _description := REPLACE(_col_template, '{entity}', '**' || _entity_name || '**');
                _description := REPLACE(_description, '{new_value}', '**' || _val || '**');
                _description := REPLACE(_description, '{old_value}', '**' || public.fn_human_val(_old_json->>_col) || '**');

                INSERT INTO public.pm_activity_logs (actor_user_ref, action_type, space_ref, item_ref, order_ref, details)
                VALUES (auth.uid(), TG_TABLE_NAME || ':updated:' || _col, _space_id, _item_id, _order_id, 
                    jsonb_build_object('description', _description, 'entity_name', _entity_name, 'old', _old_json->>_col, 'new', _new_json->>_col));
                _final_log_count := _final_log_count + 1;
            END IF;
        END LOOP;
    END IF;

    IF (_final_log_count = 0 OR TG_OP = 'INSERT') AND _reg.template_insert IS NOT NULL THEN
        _description := REPLACE(_reg.template_insert, '{entity}', '**' || _entity_name || '**');
        INSERT INTO public.pm_activity_logs (actor_user_ref, action_type, space_ref, item_ref, order_ref, details)
        VALUES (auth.uid(), TG_TABLE_NAME || ':created', _space_id, _item_id, _order_id, 
            jsonb_build_object('description', _description, 'entity_name', _entity_name));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --- PART 3: REINSTALL TRIGGERS ---
-- Drop all suspected conflicting triggers
DROP TRIGGER IF EXISTS trg_pm_items_log ON public.pm_items;
DROP TRIGGER IF EXISTS trg_pm_items_generic_log ON public.pm_items;
DROP TRIGGER IF EXISTS trg_items_activity_log ON public.pm_items;
DROP TRIGGER IF EXISTS trg_items_log ON public.pm_items;

DROP TRIGGER IF EXISTS trg_pm_items_activity_log ON public.pm_items;
CREATE TRIGGER trg_pm_items_activity_log 
AFTER INSERT OR UPDATE ON public.pm_items 
FOR EACH ROW EXECUTE FUNCTION public.fn_app_activity_logger();

-- Repeat for orders
DROP TRIGGER IF EXISTS trg_orders_activity_log ON public.orders;
CREATE TRIGGER trg_orders_activity_log 
AFTER INSERT OR UPDATE ON public.orders 
FOR EACH ROW EXECUTE FUNCTION public.fn_app_activity_logger();

-- --- PART 4: CLEANUP HISTORY (The Real Brute Force) ---
-- Fix historical logs inside the JSONB 'details' column
UPDATE public.pm_activity_logs
SET 
    details = jsonb_set(details, '{description}', 
        format('ha cambiato la descrizione di **%s**', 
            COALESCE(
                 (SELECT title FROM pm_items WHERE id = item_ref),
                 (SELECT title FROM orders WHERE id = order_ref),
                 details->>'entity_name',
                 'questa attività'
            )
        )::jsonb
    )
WHERE (details->>'description' ILIKE '%descrizione attività aggiornata%' OR details->>'description' ILIKE '%aggiornato i dettagli%');

-- Cleanup duplication from earlier (exact same description for same item on same day)
DELETE FROM public.pm_activity_logs a WHERE id IN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY actor_user_ref, item_ref, details->>'description', created_at::date ORDER BY created_at DESC) as rn FROM public.pm_activity_logs WHERE created_at > NOW() - INTERVAL '12 hours') t WHERE t.rn > 1);
