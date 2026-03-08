const { Client } = require('pg');

const config = {
    user: 'postgres.whpbetjyhpttinbxcffs',
    host: 'aws-1-eu-west-3.pooler.supabase.com',
    database: 'postgres',
    password: '#1rkB&njQ$Gn5C31BWwf',
    port: 5432,
    ssl: { rejectUnauthorized: false }
};

const SQL_FUNCTION = `
CREATE OR REPLACE FUNCTION public.fn_app_activity_logger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
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
    _data_json JSONB;
BEGIN
    SELECT * INTO _reg FROM public.pm_activity_registry WHERE table_name = TG_TABLE_NAME AND is_active = true;
    IF NOT FOUND THEN RETURN COALESCE(NEW, OLD); END IF;

    IF (TG_OP = 'DELETE') THEN
        _data_json := to_jsonb(OLD);
    ELSE
        _data_json := to_jsonb(NEW);
    END IF;

    -- Operation Detection
    IF (TG_OP = 'UPDATE') THEN
        _new_json := to_jsonb(NEW);
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
    IF _reg.item_ref_source = 'id' THEN _item_id := (_data_json->>'id')::uuid;
    ELSIF _reg.item_ref_source IS NOT NULL AND (_data_json->>_reg.item_ref_source) IS NOT NULL THEN _item_id := (_data_json->>_reg.item_ref_source)::uuid; 
    END IF;

    IF _reg.space_ref_source = 'id' THEN _space_id := (_data_json->>'id')::uuid;
    ELSIF _reg.space_ref_source = 'space_ref' THEN _space_id := (_data_json->>'space_ref')::uuid;
    ELSIF _reg.space_ref_source = 'pm_item_ref.space_ref' AND (_data_json->>'pm_item_ref') IS NOT NULL THEN
        SELECT space_ref INTO _space_id FROM public.pm_items WHERE id = (_data_json->>'pm_item_ref')::uuid;
    END IF;

    IF _reg.order_ref_source = 'id' THEN _order_id := (_data_json->>'id')::uuid;
    ELSIF _reg.order_ref_source IN ('order_id', 'order_ref', 'ref_ordine') AND (_data_json->>_reg.order_ref_source) IS NOT NULL THEN _order_id := (_data_json->>_reg.order_ref_source)::uuid;
    ELSIF _reg.order_ref_source = 'space_ref.ref_ordine' AND _space_id IS NOT NULL THEN
        SELECT ref_ordine INTO _order_id FROM public.pm_spaces WHERE id = _space_id;
    END IF;

    -- Entity Name: Be extremely persistent.
    _entity_name := COALESCE(
        _data_json->>'title', 
        _data_json->>'name',
        (SELECT title FROM public.pm_items WHERE id = _item_id),
        (SELECT title FROM public.orders WHERE id = _order_id),
        (SELECT name FROM public.pm_spaces WHERE id = _space_id),
        'questa attività'
    );

    IF (TG_OP = 'UPDATE' AND _reg.column_templates IS NOT NULL) THEN
        FOR _col IN SELECT jsonb_object_keys(_diff_json) LOOP
            _col_template := _reg.column_templates->>_col;
            IF _col_template IS NOT NULL THEN
                _val := public.fn_human_val(_new_json->>_col);
                IF _col IN ('pm_user_ref', 'user_ref', 'collaborator_id', 'p_m') THEN
                   _val := public.fn_resolve_name(CASE WHEN _col = 'collaborator_id' THEN 'collaborators' ELSE 'profiles' END, _new_json->>_col);
                END IF;

                _description := REPLACE(_col_template, '{entity}', '**' || _entity_name || '**');
                _description := REPLACE(_description, '{new_value}', '**' || _val || '**');
                _description := REPLACE(_description, '{old_value}', '**' || public.fn_human_val(_old_json->>_col) || '**');

                INSERT INTO public.pm_activity_logs (actor_user_ref, action_type, space_ref, item_ref, order_ref, details)
                VALUES (auth.uid(), TG_TABLE_NAME || ':updated:' || _col, _space_id, _item_id, _order_id, 
                    jsonb_build_object('description', _description, 'entity_name', _entity_name, 'old', _old_json->>_col, 'new', _new_json->>_col, 'row_data', _data_json));
                _final_log_count := _final_log_count + 1;
            END IF;
        END LOOP;
    END IF;

    IF (TG_OP = 'INSERT' AND _reg.template_insert IS NOT NULL) THEN
        _description := REPLACE(_reg.template_insert, '{entity}', '**' || _entity_name || '**');
        INSERT INTO public.pm_activity_logs (actor_user_ref, action_type, space_ref, item_ref, order_ref, details)
        VALUES (auth.uid(), TG_TABLE_NAME || ':created', _space_id, _item_id, _order_id, 
            jsonb_build_object('description', _description, 'entity_name', _entity_name, 'row_data', _data_json));
        _final_log_count := _final_log_count + 1;
    END IF;

    IF (TG_OP = 'DELETE' AND _reg.template_delete IS NOT NULL AND _reg.track_delete = true) THEN
        _description := REPLACE(_reg.template_delete, '{entity}', '**' || _entity_name || '**');
        INSERT INTO public.pm_activity_logs (actor_user_ref, action_type, space_ref, item_ref, order_ref, details)
        VALUES (auth.uid(), TG_TABLE_NAME || ':deleted', _space_id, _item_id, _order_id, 
            jsonb_build_object('description', _description, 'entity_name', _entity_name, 'row_data', _data_json));
        _final_log_count := _final_log_count + 1;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;
`;

const SQL_REGISTRY = `
UPDATE public.pm_activity_registry 
SET 
  track_delete = true, 
  template_insert = 'ha aggiunto membri a {entity}',
  template_delete = 'membro rimosso da {entity}'
WHERE table_name = 'pm_item_assignees';
`;

const SQL_TRIGGER = `
DROP TRIGGER IF EXISTS trg_pm_assignees_generic_log ON pm_item_assignees;
CREATE TRIGGER trg_pm_assignees_generic_log 
AFTER INSERT OR DELETE ON pm_item_assignees 
FOR EACH ROW EXECUTE FUNCTION fn_app_activity_logger();
`;

async function apply() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log("Connected to PROD DB");

        console.log("Applying fn_app_activity_logger...");
        await client.query(SQL_FUNCTION);

        console.log("Updating Registry...");
        await client.query(SQL_REGISTRY);

        console.log("Recreating Trigger...");
        await client.query(SQL_TRIGGER);

        console.log("ALL FIXES APPLIED TO PRODUCTION!");
    } catch (err) {
        console.error("FAILED APPLYING FIXES:", err);
    } finally {
        await client.end();
    }
}

apply();
