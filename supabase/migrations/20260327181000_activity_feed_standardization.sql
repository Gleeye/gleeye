-- 1. Aggiornamento Funzione Logger (Automazione percorsi e account livello)
CREATE OR REPLACE FUNCTION public.fn_app_activity_logger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    _reg RECORD;
    _old_json jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
    _new_json jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
    _diff_json jsonb := '{}'::jsonb;
    _description text;
    _template text;
    _action_name text;
    _actor_id uuid;
    _item_id uuid;
    _space_id uuid;
    _order_id uuid;
    _client_id uuid;
    _is_acc boolean := false;
    _ref_space uuid;
    _ref_order uuid;
    _final_log_count int := 0;
    _col text;
    _col_template text;
    _val text;
BEGIN
    SELECT * INTO _reg FROM public.pm_activity_registry WHERE table_name = TG_TABLE_NAME AND is_active = true;
    IF NOT FOUND THEN RETURN COALESCE(NEW, OLD); END IF;

    _actor_id := auth.uid();

    IF TG_OP = 'UPDATE' THEN
        SELECT jsonb_object_agg(n.key, n.value) INTO _diff_json
        FROM jsonb_each(_new_json) n
        JOIN jsonb_each(_old_json) o ON n.key = o.key
        WHERE n.value IS DISTINCT FROM o.value
        AND (TG_TABLE_NAME != 'pm_items' OR n.key NOT IN ('updated_at', 'created_at'));
    END IF;

    IF TG_OP = 'INSERT' AND _reg.track_insert THEN
        _action_name := COALESCE(_reg.insert_action_name, 'new_' || TG_TABLE_NAME);
        _template := _reg.template_insert;
    ELSIF TG_OP = 'UPDATE' AND _reg.track_update THEN
        _action_name := COALESCE(_reg.update_action_name, TG_TABLE_NAME || '_updated');
        _template := _reg.template_update;
    ELSIF TG_OP = 'DELETE' AND _reg.track_delete THEN
        _action_name := COALESCE(_reg.delete_action_name, TG_TABLE_NAME || '_deleted');
        _template := _reg.template_delete;
    ELSE
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Item Ref
    IF _reg.item_ref_source IS NOT NULL AND _reg.item_ref_source != '' THEN 
        IF _reg.item_ref_source = 'id' THEN _item_id := (_new_json->>'id')::uuid;
        ELSE _item_id := (_new_json->>_reg.item_ref_source)::uuid; 
        END IF;
    END IF;

    -- Order Ref (Percorso speciale per pagamenti e incarichi)
    IF _reg.order_ref_source IS NOT NULL THEN
        IF _reg.order_ref_source = 'id' THEN _order_id := (_new_json->>'id')::uuid;
        ELSIF _reg.order_ref_source = 'ref_ordine' THEN _order_id := (_new_json->>'ref_ordine')::uuid;
        ELSIF _reg.order_ref_source = 'order_ref' THEN _order_id := (_new_json->>'order_ref')::uuid;
        ELSIF _reg.order_ref_source = 'order_id' THEN _order_id := (_new_json->>'order_id')::uuid;
        ELSIF _reg.order_ref_source = 'assignment_id.order_id' AND (_new_json->>'assignment_id') IS NOT NULL THEN
            SELECT order_id INTO _order_id FROM public.assignments WHERE id = (_new_json->>'assignment_id')::uuid;
        ELSIF _reg.order_ref_source = 'space_ref.ref_ordine' AND (_new_json->>'space_ref') IS NOT NULL THEN
            SELECT ref_ordine INTO _order_id FROM public.pm_spaces WHERE id = (_new_json->>'space_ref')::uuid;
        END IF;
    END IF;

    -- Flag Account Level
    IF TG_TABLE_NAME IN ('assignments', 'payments', 'invoices', 'passive_invoices', 'bank_transactions') THEN
        _is_acc := true; 
    ELSIF TG_TABLE_NAME IN ('pm_items', 'appointments') THEN
        _is_acc := COALESCE((_new_json->>'is_account_level')::boolean, false);
    END IF;

    -- Granular UPDATE Log
    IF TG_OP = 'UPDATE' AND _reg.column_templates IS NOT NULL THEN
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
                    actor_user_ref, action_type, description, space_ref, item_ref, order_ref, is_account_level, metadata
                ) VALUES (
                    _actor_id, _action_name || ':' || _col, _description, _space_id, _item_id, _order_id, _is_acc,
                    jsonb_build_object('table', TG_TABLE_NAME, 'col', _col, 'old', _old_json->>_col, 'new', _new_json->>_col)
                );
                _final_log_count := _final_log_count + 1;
            END IF;
        END LOOP;
    END IF;

    -- Standard Template Fallback
    IF (_final_log_count = 0 OR TG_OP != 'UPDATE') AND _template IS NOT NULL THEN
        _description := _template;
        FOR _col IN SELECT jsonb_object_keys(_new_json) LOOP
            _description := REPLACE(_description, '{' || _col || '}', COALESCE(_new_json->>_col, ''));
        END LOOP;

        INSERT INTO public.pm_activity_logs (
            actor_user_ref, action_type, description, space_ref, item_ref, order_ref, is_account_level, metadata
        ) VALUES (
            _actor_id, _action_name, _description, _space_id, _item_id, _order_id, _is_acc,
            jsonb_build_object('table', TG_TABLE_NAME, 'diff', _diff_json)
        );
    END IF;

    RETURN NEW;
END;
$function$;

-- 2. Registry Corrections (BUG 1)
UPDATE pm_activity_registry SET template_insert = 'ha creato l''attività **{title}**' WHERE table_name = 'pm_items';
UPDATE pm_activity_registry SET template_insert = 'ha creato lo spazio **{name}**' WHERE table_name = 'pm_spaces';

-- 3. Register Missing Areas
DELETE FROM pm_activity_registry WHERE table_name IN ('clients', 'collaborators', 'invoices', 'passive_invoices', 'payments', 'bank_transactions');

INSERT INTO pm_activity_registry (table_name, is_active, track_insert, track_update, insert_action_name, template_insert, column_templates, order_ref_source, client_ref_source)
VALUES 
('clients', true, true, true, 'new_client', 'ha creato il nuovo cliente **{business_name}**', '{"business_name": "ha rinominato il cliente in **{new_value}**"}', 'id', 'id'),
('collaborators', true, true, true, 'new_collaborator', 'ha aggiunto il collaboratore **{full_name}**', '{"is_active": "ha cambiato lo stato di **{full_name}** in **{new_value}**"}', NULL, NULL),
('invoices', true, true, true, 'new_invoice', 'ha emesso la fattura **{invoice_number}** per **{client_name}**', '{"amount": "ha modificato l''importo della fattura **{invoice_number}**"}', 'id', 'client_id'),
('passive_invoices', true, true, true, 'new_passive_invoice', 'ha registrato una fattura passiva da **{supplier_name}**', '{"status": "ha aggiornato lo stato della fattura passiva di **{supplier_name}** a **{new_value}**"}', NULL, NULL),
('payments', true, true, true, 'new_payment', 'ha registrato un pagamento di **{amount}** €', '{"status": "ha segnato il pagamento di **{amount}** come **{new_value}**"}', 'assignment_id.order_id', NULL),
('bank_transactions', true, true, true, 'new_bank_transaction', 'ha registrato un movimento bancario di **{amount}** €', NULL, NULL, NULL);

-- 4. Enable Triggers
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['clients', 'collaborators', 'invoices', 'passive_invoices', 'payments', 'bank_transactions'])
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS tr_activity_logger_%I ON %I', t, t);
        EXECUTE format('CREATE TRIGGER tr_activity_logger_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION fn_app_activity_logger()', t, t);
    END LOOP;
END $$;
