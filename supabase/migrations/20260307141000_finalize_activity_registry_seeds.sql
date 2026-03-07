-- 1. Final Logger refinement for 'id' and 'item_ref'
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

    -- Space Ref
    IF _reg.space_ref_source IS NOT NULL AND _reg.space_ref_source != '' THEN 
        IF _reg.space_ref_source = 'id' THEN _space_id := (_new_json->>'id')::uuid;
        ELSIF _reg.space_ref_source = 'pm_item_ref.space_ref' AND (_new_json->>'pm_item_ref') IS NOT NULL THEN
             SELECT space_ref INTO _space_id FROM public.pm_items WHERE id = (_new_json->>'pm_item_ref')::uuid;
        ELSIF _reg.space_ref_source = 'space_ref.space_ref' AND (_new_json->>'space_ref') IS NOT NULL THEN
             SELECT space_ref INTO _space_id FROM public.doc_spaces WHERE id = (_new_json->>'space_ref')::uuid;
        ELSE _space_id := (_new_json->>_reg.space_ref_source)::uuid; 
        END IF;
    END IF;

    -- Order Ref
    IF _reg.order_ref_source IS NOT NULL THEN
        IF _reg.order_ref_source = 'id' THEN _order_id := (_new_json->>'id')::uuid;
        ELSIF _reg.order_ref_source = 'ref_ordine' THEN _order_id := (_new_json->>'ref_ordine')::uuid;
        ELSIF _reg.order_ref_source = 'order_ref' THEN _order_id := (_new_json->>'order_ref')::uuid;
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

    -- Client Ref
    IF _reg.client_ref_source IS NOT NULL THEN
        IF _reg.client_ref_source = 'client_id' THEN _client_id := (_new_json->>'client_id')::uuid;
        ELSIF _reg.client_ref_source = 'id' THEN _client_id := (_new_json->>'id')::uuid;
        ELSIF _reg.client_ref_source = 'order_ref.client_id' THEN
            _ref_order := COALESCE(_order_id, (_new_json->>'order_ref')::uuid);
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
                    actor_ref, action_type, description, space_ref, item_ref, order_ref, client_ref, metadata
                ) VALUES (
                    _actor_id, _action_name || ':' || _col, _description, _space_id, _item_id, _order_id, _client_id,
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
                _description := REPLACE(_description, '{' || _col || '}', COALESCE(_new_json->>_col, ''));
            END LOOP;
        END IF;

        INSERT INTO public.pm_activity_logs (
            actor_ref, action_type, description, space_ref, item_ref, order_ref, client_ref, metadata
        ) VALUES (
            _actor_id, _action_name, _description, _space_id, _item_id, _order_id, _client_id,
            jsonb_build_object('table', TG_TABLE_NAME, 'diff', _diff_json)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Refine Orders/Spaces/Clients Registry
UPDATE public.pm_activity_registry 
SET 
  track_columns = ARRAY['status_works', 'title', 'offer_status', 'total_amount_tax_excluded'],
  column_templates = '{
    "status_works": "Stato avanzamento ordine cambiato in {new_value}",
    "title": "Titolo commessa rinominato in: {title}",
    "offer_status": "Stato offerta commerciale: {new_value}",
    "total_amount_tax_excluded": "Importo ordine aggiornato a € {total_amount_tax_excluded}"
  }'::jsonb,
  client_ref_source = 'client_id'
WHERE table_name = 'orders';

UPDATE public.pm_activity_registry 
SET 
  track_columns = ARRAY['status', 'name', 'type'],
  template_insert = 'Nuovo spazio creato: {name}',
  column_templates = '{
    "status": "Stato progetto cambiato in {new_value}",
    "name": "Nome progetto cambiato in: {name}",
    "type": "Tipologia spostata in {new_value}"
  }'::jsonb,
  order_ref_source = 'ref_ordine',
  space_ref_source = 'id',
  client_ref_source = 'space_ref.ref_ordine.client_id'
WHERE table_name = 'pm_spaces';

INSERT INTO public.pm_activity_registry (table_name, track_insert, track_update, template_insert, template_update, track_columns, client_ref_source)
VALUES (
    'clients', 
    false, 
    true, 
    NULL, 
    'Anagrafica cliente aggiornata', 
    ARRAY['business_name', 'email', 'phone', 'address'], 
    'id'
)
ON CONFLICT (table_name) DO UPDATE SET 
  track_update = EXCLUDED.track_update,
  template_update = EXCLUDED.template_update,
  track_columns = EXCLUDED.track_columns,
  client_ref_source = EXCLUDED.client_ref_source;

DROP TRIGGER IF EXISTS trg_clients_generic_log ON public.clients;
CREATE TRIGGER trg_clients_generic_log AFTER UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.fn_app_activity_logger();

