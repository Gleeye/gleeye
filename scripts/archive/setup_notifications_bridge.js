const { Client } = require('pg');
const config = {
    user: 'postgres.whpbetjyhpttinbxcffs',
    host: 'aws-1-eu-west-3.pooler.supabase.com',
    database: 'postgres',
    password: '#1rkB&njQ$Gn5C31BWwf',
    port: 5432,
    ssl: { rejectUnauthorized: false }
};

async function setupNotifications() {
    const client = new Client(config);
    try {
        await client.connect();

        // 1. Update the broadcast_pm_notification function to handle subscribers
        await client.query(`
            CREATE OR REPLACE FUNCTION public.broadcast_pm_notification(
                p_item_id UUID,
                p_type TEXT,
                p_title TEXT,
                p_message TEXT,
                p_data JSONB,
                p_actor_id UUID
            ) RETURNS VOID AS $$
            DECLARE
                v_user_id UUID;
                v_collab_id UUID;
                v_space_pm UUID;
                v_item_creator UUID;
                v_recipients UUID[] := ARRAY[]::UUID[];
                v_item RECORD;
            BEGIN
                -- 1. Get fundamental actors of the item
                SELECT * INTO v_item FROM public.pm_items WHERE id = p_item_id;
                IF NOT FOUND THEN RETURN; END IF;

                SELECT default_pm_user_ref INTO v_space_pm FROM public.pm_spaces WHERE id = v_item.space_ref;
                v_item_creator := v_item.created_by_user_ref;

                -- 2. Build recipient list: Creator + Space PM + Direct Assignees + Explicit Subscribers
                -- Creator
                IF v_item_creator IS NOT NULL THEN v_recipients := array_append(v_recipients, v_item_creator); END IF;
                -- PM
                IF v_space_pm IS NOT NULL THEN v_recipients := array_append(v_recipients, v_space_pm); END IF;
                
                -- Assignees
                SELECT array_agg(user_ref) INTO v_recipients FROM (
                    SELECT unnest(v_recipients)
                    UNION
                    SELECT user_ref FROM public.pm_item_assignees WHERE pm_item_ref = p_item_id AND user_ref IS NOT NULL
                ) AS t;

                -- Subscribers (the bell icon)
                SELECT array_agg(u) INTO v_recipients FROM (
                    SELECT unnest(v_recipients) AS u
                    UNION
                    SELECT user_id FROM public.pm_item_subscriptions WHERE item_id = p_item_id
                ) AS t;

                -- 3. Loop and Send (excluding actor)
                FOR v_user_id IN 
                    SELECT DISTINCT u FROM unnest(v_recipients) u WHERE u IS NOT NULL AND u <> p_actor_id
                LOOP
                    SELECT id INTO v_collab_id FROM public.collaborators WHERE user_id = v_user_id LIMIT 1;
                    
                    INSERT INTO public.notifications (user_id, collaborator_id, type, title, message, data, is_read)
                    VALUES (v_user_id, v_collab_id, p_type, p_title, p_message, p_data, false);
                END LOOP;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;
        `);
        console.log("Function broadcast_pm_notification updated.");

        // 2. Update fn_app_activity_logger to trigger notifications
        // We need to inject the notification call into the generic logger
        // I will recreate the function adding the notification part
        await client.query(`
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
                _entity_name TEXT;
                _actor_name TEXT;
            BEGIN
                SELECT * INTO _reg FROM public.pm_activity_registry WHERE table_name = TG_TABLE_NAME AND is_active = true;
                IF NOT FOUND THEN RETURN NEW; END IF;

                _actor_id := auth.uid();
                _new_json := to_jsonb(NEW);

                IF _actor_id IS NOT NULL THEN
                    SELECT COALESCE(full_name, 'Un utente') INTO _actor_name FROM public.profiles WHERE id = _actor_id;
                ELSE
                    _actor_name := 'Sistema';
                END IF;

                -- Operation setup
                IF (TG_OP = 'INSERT' AND _reg.track_insert) THEN
                    _template := _reg.template_insert;
                    _action_name := COALESCE(_reg.insert_action_name, 'created');
                ELSIF (TG_OP = 'UPDATE' AND _reg.track_update) THEN
                    _old_json := to_jsonb(OLD);
                    _action_name := COALESCE(_reg.update_action_name, 'updated');
                    
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
                    _action_name := COALESCE(_reg.delete_action_name, 'deleted');
                    _new_json := to_jsonb(OLD);
                ELSE
                    RETURN NEW;
                END IF;

                -- Reference Resolution
                IF _reg.item_ref_source = 'id' THEN _item_id := (_new_json->>'id')::uuid;
                ELSIF _reg.item_ref_source IS NOT NULL THEN _item_id := (_new_json->>_reg.item_ref_source)::uuid; 
                END IF;

                IF _reg.order_ref_source = 'id' THEN _order_id := (_new_json->>'id')::uuid;
                ELSIF _reg.order_ref_source = 'order_id' THEN _order_id := (_new_json->>'order_id')::uuid;
                ELSIF _reg.order_ref_source = 'order_ref' THEN _order_id := (_new_json->>'order_ref')::uuid;
                ELSIF _reg.order_ref_source = 'ref_ordine' THEN _order_id := (_new_json->>'ref_ordine')::uuid;
                ELSIF _reg.order_ref_source = 'space_ref.ref_ordine' THEN 
                    SELECT ref_ordine INTO _order_id FROM public.pm_spaces WHERE id = (_new_json->>'space_ref')::uuid;
                ELSIF _reg.order_ref_source = 'pm_item_ref.space_ref.ref_ordine' THEN
                    SELECT s.ref_ordine INTO _order_id FROM public.pm_items i JOIN public.pm_spaces s ON i.space_ref = s.id WHERE i.id = (_new_json->>'pm_item_ref')::uuid;
                END IF;

                IF _reg.space_ref_source = 'id' THEN _space_id := (_new_json->>'id')::uuid;
                ELSIF _reg.space_ref_source = 'space_ref' THEN _space_id := (_new_json->>'space_ref')::uuid;
                ELSIF _reg.space_ref_source = 'pm_item_ref.space_ref' THEN
                    SELECT space_ref INTO _space_id FROM public.pm_items WHERE id = (_new_json->>'pm_item_ref')::uuid;
                END IF;

                _entity_name := COALESCE(_new_json->>'title', _new_json->>'name', _new_json->>'description', _new_json->>'id');
                IF TG_TABLE_NAME = 'pm_item_assignees' THEN
                    SELECT title INTO _entity_name FROM public.pm_items WHERE id = (_new_json->>'pm_item_ref')::uuid;
                END IF;

                -- LOGGING AND NOTIFYING
                
                -- 1. Specific Column Updates
                IF TG_OP = 'UPDATE' AND _reg.column_templates IS NOT NULL THEN
                    FOR _col IN SELECT jsonb_object_keys(_diff_json) LOOP
                        _col_template := _reg.column_templates->>_col;
                        IF _col_template IS NOT NULL THEN
                            _description := _col_template;
                            _val := _new_json->>_col;
                            
                            -- Formatting values...
                            IF _col IN ('pm_user_ref', 'default_pm_user_ref', 'created_by', 'collaborator_id', 'user_ref') THEN
                                _val := public.fn_resolve_name(CASE WHEN _col = 'collaborator_id' THEN 'collaborators' ELSE 'profiles' END, _val);
                            ELSIF _col IN ('due_date', 'start_date') THEN
                                _val := to_char(_val::timestamptz, 'DD/MM/YYYY');
                            ELSE
                                _val := public.fn_human_val(_val);
                            END IF;

                            _description := REPLACE(_description, '{entity}', '**' || COALESCE(_entity_name, 'questa risorsa') || '**');
                            _description := REPLACE(_description, '{new_value}', '**' || _val || '**');
                            _description := REPLACE(_description, '{old_value}', '**' || public.fn_human_val(_old_json->>_col) || '**');

                            INSERT INTO public.pm_activity_logs (actor_user_ref, action_type, space_ref, item_ref, order_ref, details) 
                            VALUES (_actor_id, _action_name || ':' || _col, _space_id, _item_id, _order_id, jsonb_build_object('description', _description, 'entity_name', _entity_name));
                            
                            -- NOTIFY if it is a task item
                            IF _item_id IS NOT NULL THEN
                                PERFORM public.broadcast_pm_notification(_item_id, 'pm_item_updated', 'Attività Aggiornata', _actor_name || ' ' || _description, jsonb_build_object('item_id', _item_id), _actor_id);
                            END IF;
                            
                            _final_log_count := _final_log_count + 1;
                        END IF;
                    END LOOP;
                END IF;

                -- 2. General Actions
                IF (_final_log_count = 0 OR TG_OP != 'UPDATE') AND _template IS NOT NULL THEN
                    _description := _template;
                    IF TG_TABLE_NAME = 'pm_item_assignees' THEN
                         _val := public.fn_resolve_name('profiles', _new_json->>'user_ref');
                         _description := REPLACE(_description, '{user_name}', '**' || _val || '**');
                    END IF;
                    _description := REPLACE(_description, '{entity}', '**' || COALESCE(_entity_name, 'questa attività') || '**');
                    _description := REPLACE(_description, '{body}', substring(_new_json->>'body' from 1 for 100));

                    INSERT INTO public.pm_activity_logs (actor_user_ref, action_type, space_ref, item_ref, order_ref, details)
                    VALUES (_actor_id, _action_name, _space_id, _item_id, _order_id, jsonb_build_object('description', _description, 'entity_name', _entity_name));

                    -- NOTIFY
                    IF _item_id IS NOT NULL AND TG_OP != 'DELETE' THEN
                         PERFORM public.broadcast_pm_notification(_item_id, 'pm_' || TG_TABLE_NAME || '_' || _action_name, 'Attività Project Management', _actor_name || ' ' || _description, jsonb_build_object('item_id', _item_id), _actor_id);
                    END IF;
                END IF;

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;
        `);
        console.log("Function fn_app_activity_logger updated with notifications.");

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
setupNotifications();
