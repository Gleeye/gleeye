-- 1. Extend Registry to support Action Name Overrides
ALTER TABLE public.pm_activity_registry 
ADD COLUMN IF NOT EXISTS insert_action_name TEXT,
ADD COLUMN IF NOT EXISTS update_action_name TEXT,
ADD COLUMN IF NOT EXISTS delete_action_name TEXT;

-- 2. Update the Logger Function to use overrides
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
    _actor_id UUID;
    _val TEXT;
    _col TEXT;
    _new_json JSONB;
    _old_json JSONB;
    _diff_json JSONB := '{}'::jsonb;
BEGIN
    SELECT * INTO _reg FROM public.pm_activity_registry WHERE table_name = TG_TABLE_NAME AND is_active = true;
    IF NOT FOUND THEN RETURN NEW; END IF;

    IF (TG_OP = 'INSERT' AND _reg.track_insert) THEN
        _template := _reg.template_insert;
        _action_name := COALESCE(_reg.insert_action_name, 'INSERT');
        _new_json := to_jsonb(NEW);
    ELSIF (TG_OP = 'UPDATE' AND _reg.track_update) THEN
        _template := _reg.template_update;
        _action_name := COALESCE(_reg.update_action_name, 'UPDATE');
        _new_json := to_jsonb(NEW);
        _old_json := to_jsonb(OLD);

        FOR _col IN SELECT jsonb_object_keys(_new_json) LOOP
            IF (_new_json->>_col IS DISTINCT FROM _old_json->>_col) THEN
                _diff_json := _diff_json || jsonb_build_object(_col, _new_json->>_col);
            END IF;
        END LOOP;

        IF _reg.track_columns IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM jsonb_object_keys(_diff_json) k WHERE k = ANY(_reg.track_columns)) THEN
                RETURN NEW;
            END IF;
        END IF;
    ELSIF (TG_OP = 'DELETE' AND _reg.track_delete) THEN
        _template := _reg.template_delete;
        _action_name := COALESCE(_reg.delete_action_name, 'DELETE');
        _new_json := to_jsonb(OLD);
    ELSE
        RETURN NEW;
    END IF;

    IF _template IS NULL THEN RETURN NEW; END IF;

    _description := _template;
    FOR _col IN SELECT jsonb_object_keys(_new_json) LOOP
        _val := COALESCE(_new_json->>_col, '');
        _description := REPLACE(_description, '{' || _col || '}', _val);
    END LOOP;

    -- Reference Resolution
    IF _reg.order_ref_source IS NOT NULL THEN
        IF _reg.order_ref_source = 'ref_ordine' THEN _order_id := (_new_json->>'ref_ordine')::uuid;
        ELSIF _reg.order_ref_source = 'order_ref' THEN _order_id := (_new_json->>'order_ref')::uuid;
        ELSIF _reg.order_ref_source = 'space_ref.ref_ordine' THEN
            SELECT ref_ordine INTO _order_id FROM public.pm_spaces WHERE id = (_new_json->>'space_ref')::uuid;
        END IF;
    END IF;

    IF _reg.space_ref_source IS NOT NULL AND _reg.space_ref_source != '' THEN _space_id := (_new_json->>_reg.space_ref_source)::uuid; END IF;
    IF _reg.item_ref_source IS NOT NULL AND _reg.item_ref_source != '' THEN _item_id := (_new_json->>_reg.item_ref_source)::uuid; END IF;
    
    _actor_id := auth.uid();

    INSERT INTO public.pm_activity_logs (
        actor_ref, action_type, description, space_ref, item_ref, order_ref, metadata
    ) VALUES (
        _actor_id, _action_name, _description, _space_id, _item_id, _order_id,
        jsonb_build_object('table', TG_TABLE_NAME, 'diff', _diff_json)
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update Registry Data with more descriptive action names
UPDATE public.pm_activity_registry SET insert_action_name = 'new_task', update_action_name = 'update' WHERE table_name = 'pm_items';
UPDATE public.pm_activity_registry SET insert_action_name = 'new_space', update_action_name = 'update' WHERE table_name = 'pm_spaces';
UPDATE public.pm_activity_registry SET insert_action_name = 'new_comment' WHERE table_name = 'pm_item_comments';

-- 4. DROP LEGACY TRIGGERS
DROP TRIGGER IF EXISTS trg_pm_spaces_notify_log ON public.pm_spaces;
DROP TRIGGER IF EXISTS trg_pm_items_notify_log ON public.pm_items;
DROP TRIGGER IF EXISTS trg_pm_comments_notify_log ON public.pm_item_comments;
DROP TRIGGER IF EXISTS trg_pm_assignees_notify_log ON public.pm_item_assignees;

-- 5. Add pm_item_assignees to Registry
INSERT INTO public.pm_activity_registry (table_name, track_columns, template_insert, insert_action_name, order_ref_source, space_ref_source, item_ref_source)
VALUES ('pm_item_assignees', NULL, 'Aggiunto nuovo membro al team', 'new_assignment', NULL, NULL, 'pm_item_ref');

CREATE TRIGGER trg_pm_assignees_generic_log AFTER INSERT ON public.pm_item_assignees FOR EACH ROW EXECUTE FUNCTION public.fn_app_activity_logger();
