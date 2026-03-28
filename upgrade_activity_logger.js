const { Client } = require('pg');

const config = {
    user: 'postgres.whpbetjyhpttinbxcffs',
    host: 'aws-1-eu-west-3.pooler.supabase.com',
    database: 'postgres',
    password: '#1rkB&njQ$Gn5C31BWwf',
    port: 5432,
    ssl: { rejectUnauthorized: false }
};

const SQL_UPGRADE = `
-- 1. UPGRADE fn_app_activity_logger to DYNAMIC MODE
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
    _data_json JSONB;
    _key TEXT;
    _record_val TEXT;
    _final_log_count INTEGER := 0;
BEGIN
    -- Get Registry config for this table
    SELECT * INTO _reg FROM public.pm_activity_registry WHERE table_name = TG_TABLE_NAME AND is_active = true;
    IF NOT FOUND THEN RETURN COALESCE(NEW, OLD); END IF;

    -- Setup row data for placeholder replacement
    IF (TG_OP = 'DELETE') THEN
        _data_json := to_jsonb(OLD);
    ELSE
        _data_json := to_jsonb(NEW);
    END IF;

    -- Detailed Diff for Updates
    IF (TG_OP = 'UPDATE') THEN
        _new_json := to_jsonb(NEW);
        _old_json := to_jsonb(OLD);
        FOR _col IN SELECT jsonb_object_keys(_new_json) LOOP
            IF (_new_json->>_col IS DISTINCT FROM _old_json->>_col) THEN
                _diff_json := _diff_json || jsonb_build_object(_col, _new_json->>_col);
            END IF;
        END LOOP;
        
        -- Guard: Skip if tracked columns are not in diff
        IF _reg.track_columns IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jsonb_object_keys(_diff_json) k WHERE k = ANY(_reg.track_columns)) THEN
            RETURN NEW;
        END IF;
    END IF;

    -- --- Reference Resolution (Context Bubbling) ---
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

    -- --- Entity Name Resolution ---
    _entity_name := COALESCE(
        _data_json->>'title', 
        _data_json->>'name',
        _data_json->>'description',
        _data_json->>'business_name',
        (SELECT title FROM public.pm_items WHERE id = _item_id),
        (SELECT title FROM public.orders WHERE id = _order_id),
        (SELECT name FROM public.pm_spaces WHERE id = _space_id),
        'questa risorsa'
    );

    -- 1. SPECIFIC COLUMN UPDATES (Granular Logic)
    IF (TG_OP = 'UPDATE' AND _reg.column_templates IS NOT NULL) THEN
        FOR _col IN SELECT jsonb_object_keys(_diff_json) LOOP
            _col_template := _reg.column_templates->>_col;
            IF _col_template IS NOT NULL THEN
                _description := _col_template;
                
                -- Dynamic replacement for ALL columns in column template too
                FOR _key IN SELECT jsonb_object_keys(_data_json) LOOP
                    _record_val := _data_json->>_key;
                    IF _key IN ('pm_user_ref', 'user_ref', 'collaborator_id', 'p_m') THEN
                        _record_val := public.fn_resolve_name(CASE WHEN _key = 'collaborator_id' THEN 'collaborators' ELSE 'profiles' END, _record_val);
                    ELSIF _key ~* 'date|time' AND _record_val IS NOT NULL THEN
                         BEGIN _record_val := to_char(_record_val::timestamptz, 'DD/MM/YYYY'); EXCEPTION WHEN OTHERS THEN NULL; END;
                    ELSE
                        _record_val := public.fn_human_val(_record_val);
                    END IF;
                    _description := REPLACE(_description, '{' || _key || '}', '**' || COALESCE(_record_val, '') || '**');
                END LOOP;

                _val := public.fn_human_val(_new_json->>_col);
                IF _col IN ('pm_user_ref', 'user_ref', 'collaborator_id', 'p_m') THEN
                   _val := public.fn_resolve_name(CASE WHEN _col = 'collaborator_id' THEN 'collaborators' ELSE 'profiles' END, _new_json->>_col);
                END IF;

                _description := REPLACE(_description, '{entity}', '**' || _entity_name || '**');
                _description := REPLACE(_description, '{new_value}', '**' || _val || '**');
                _description := REPLACE(_description, '{old_value}', '**' || public.fn_human_val(_old_json->>_col) || '**');

                INSERT INTO public.pm_activity_logs (actor_user_ref, action_type, space_ref, item_ref, order_ref, details)
                VALUES (auth.uid(), TG_TABLE_NAME || ':updated:' || _col, _space_id, _item_id, _order_id, 
                    jsonb_build_object('description', _description, 'entity_name', _entity_name, 'old', _old_json->>_col, 'new', _new_json->>_col));
                _final_log_count := _final_log_count + 1;
            END IF;
        END LOOP;
    END IF;

    -- 2. GENERAL ACTIONS (Insert/Delete or non-template Updated)
    IF (_final_log_count = 0 OR TG_OP != 'UPDATE') THEN
        _description := CASE 
            WHEN TG_OP = 'INSERT' THEN _reg.template_insert 
            WHEN TG_OP = 'DELETE' THEN _reg.template_delete 
            ELSE NULL 
        END;

        IF _description IS NOT NULL THEN
            -- DYNAMIC REPLACEMENT for General Templates
            FOR _key IN SELECT jsonb_object_keys(_data_json) LOOP
                _record_val := _data_json->>_key;
                IF _key IN ('pm_user_ref', 'user_ref', 'collaborator_id', 'p_m') THEN
                    _record_val := public.fn_resolve_name(CASE WHEN _key = 'collaborator_id' THEN 'collaborators' ELSE 'profiles' END, _record_val);
                ELSIF _key ~* 'date|time' AND _record_val IS NOT NULL THEN
                     BEGIN _record_val := to_char(_record_val::timestamptz, 'DD/MM/YYYY'); EXCEPTION WHEN OTHERS THEN NULL; END;
                ELSE
                    _record_val := public.fn_human_val(_record_val);
                END IF;
                _description := REPLACE(_description, '{' || _key || '}', '**' || COALESCE(_record_val, '') || '**');
            END LOOP;

            _description := REPLACE(_description, '{entity}', '**' || _entity_name || '**');

            INSERT INTO public.pm_activity_logs (actor_user_ref, action_type, space_ref, item_ref, order_ref, details)
            VALUES (auth.uid(), TG_TABLE_NAME || ':' || LOWER(TG_OP), _space_id, _item_id, _order_id, 
                jsonb_build_object('description', _description, 'entity_name', _entity_name));
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2. REGISTRY BUG FIXES (Standardization)
UPDATE public.pm_activity_registry 
SET template_insert = 'ha caricato il file **{file_name}**', track_columns = ARRAY['file_name']
WHERE table_name = 'doc_pages';

UPDATE public.pm_activity_registry 
SET template_insert = 'ha assegnato **{user_ref}** a **{entity}**'
WHERE table_name = 'pm_item_assignees';

UPDATE public.pm_activity_registry 
SET template_insert = 'ha creato l''incarico **{description}**'
WHERE table_name = 'assignments';

UPDATE public.pm_activity_registry 
SET template_insert = 'ha fissato un appuntamento: **{title}**'
WHERE table_name = 'appointments';
`;

async function apply() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log("Connected to Supabase DB");
        await client.query(SQL_UPGRADE);
        console.log("SQL Upgrade Applied Successfully!");
        console.log("1. Dynamic Logger Trigger initialized.");
        console.log("2. Registry Bug Fixes (doc_pages, assignees, assignments) applied."); 
    } catch (err) {
        console.error("Upgrade Failed:", err);
    } finally {
        await client.end();
    }
}
apply();
