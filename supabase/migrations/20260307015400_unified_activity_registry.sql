-- 1. Create the configuration registry table
CREATE TABLE IF NOT EXISTS public.pm_activity_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    track_insert BOOLEAN DEFAULT true,
    track_update BOOLEAN DEFAULT true,
    track_delete BOOLEAN DEFAULT false,
    track_columns TEXT[], -- Null means all columns
    template_insert TEXT,
    template_update TEXT,
    template_delete TEXT,
    -- Mapping (column names or dot-notation paths for relations)
    order_ref_source TEXT,
    space_ref_source TEXT,
    item_ref_source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for admins
ALTER TABLE public.pm_activity_registry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage registry" ON public.pm_activity_registry;
CREATE POLICY "Admins can manage registry" ON public.pm_activity_registry
    FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- 2. The Generic Logger Function
CREATE OR REPLACE FUNCTION public.fn_app_activity_logger()
RETURNS TRIGGER AS $$
DECLARE
    _reg RECORD;
    _template TEXT;
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
    -- 1. Get registry config for this table
    SELECT * INTO _reg FROM public.pm_activity_registry WHERE table_name = TG_TABLE_NAME AND is_active = true;
    IF NOT FOUND THEN RETURN NEW; END IF;

    -- 2. Determine Operation and Template
    IF (TG_OP = 'INSERT' AND _reg.track_insert) THEN
        _template := _reg.template_insert;
        _new_json := to_jsonb(NEW);
    ELSIF (TG_OP = 'UPDATE' AND _reg.track_update) THEN
        _template := _reg.template_update;
        _new_json := to_jsonb(NEW);
        _old_json := to_jsonb(OLD);

        -- Build diff
        FOR _col IN SELECT jsonb_object_keys(_new_json) LOOP
            IF (_new_json->>_col IS DISTINCT FROM _old_json->>_col) THEN
                _diff_json := _diff_json || jsonb_build_object(_col, _new_json->>_col);
            END IF;
        END LOOP;

        -- If specific columns are tracked, check if any of THEM changed
        IF _reg.track_columns IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM jsonb_object_keys(_diff_json) k WHERE k = ANY(_reg.track_columns)) THEN
                RETURN NEW; -- No relevant changes
            END IF;
        END IF;
    ELSIF (TG_OP = 'DELETE' AND _reg.track_delete) THEN
        _template := _reg.template_delete;
        _new_json := to_jsonb(OLD); -- Use OLD for delete
    ELSE
        RETURN NEW;
    END IF;

    IF _template IS NULL THEN RETURN NEW; END IF;

    -- 3. Hydrate Template (Replace {col_name} with value)
    _description := _template;
    FOR _col IN SELECT jsonb_object_keys(_new_json) LOOP
        _val := COALESCE(_new_json->>_col, '');
        _description := REPLACE(_description, '{' || _col || '}', _val);
    END LOOP;

    -- 4. Resolve References
    -- Order Ref
    IF _reg.order_ref_source IS NOT NULL THEN
        IF _reg.order_ref_source = 'ref_ordine' THEN
            _order_id := (_new_json->>'ref_ordine')::uuid;
        ELSIF _reg.order_ref_source = 'order_ref' THEN
            _order_id := (_new_json->>'order_ref')::uuid;
        ELSIF _reg.order_ref_source = 'space_ref.ref_ordine' THEN
            SELECT ref_ordine INTO _order_id FROM public.pm_spaces WHERE id = (_new_json->>'space_ref')::uuid;
        END IF;
    END IF;

    -- Space Ref
    IF _reg.space_ref_source IS NOT NULL AND _reg.space_ref_source != '' THEN
        _space_id := (_new_json->>_reg.space_ref_source)::uuid;
    END IF;

    -- Item Ref
    IF _reg.item_ref_source IS NOT NULL AND _reg.item_ref_source != '' THEN
       _item_id := (_new_json->>_reg.item_ref_source)::uuid;
    END IF;

    -- Actor
    _actor_id := auth.uid();

    -- 5. Insert Log
    INSERT INTO public.pm_activity_logs (
        actor_ref,
        action_type,
        description,
        space_ref,
        item_ref,
        order_ref,
        metadata
    ) VALUES (
        _actor_id,
        TG_OP,
        _description,
        _space_id,
        _item_id,
        _order_id,
        jsonb_build_object(
            'table', TG_TABLE_NAME,
            'diff', _diff_json
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Seed initial registry rules
DELETE FROM public.pm_activity_registry WHERE table_name IN ('pm_items', 'pm_spaces', 'pm_item_comments');
INSERT INTO public.pm_activity_registry (table_name, track_columns, template_insert, template_update, order_ref_source, space_ref_source, item_ref_source)
VALUES 
('pm_items', ARRAY['status', 'title', 'due_date'], 'Nuovo Task: {title}', 'Aggiornato Task: {title} ({status})', 'space_ref.ref_ordine', 'space_ref', 'id'),
('pm_spaces', ARRAY['status', 'name'], 'Nuova Commessa/Cluster: {name}', 'Stato Progetto: {status}', 'ref_ordine', 'id', NULL),
('pm_item_comments', NULL, 'Nuovo commento: {body}', NULL, 'space_ref.ref_ordine', 'space_ref', 'pm_item_ref');

-- 4. Apply Triggers
DROP TRIGGER IF EXISTS trg_pm_items_generic_log ON public.pm_items;
CREATE TRIGGER trg_pm_items_generic_log AFTER INSERT OR UPDATE ON public.pm_items FOR EACH ROW EXECUTE FUNCTION public.fn_app_activity_logger();

DROP TRIGGER IF EXISTS trg_pm_spaces_generic_log ON public.pm_spaces;
CREATE TRIGGER trg_pm_spaces_generic_log AFTER INSERT OR UPDATE ON public.pm_spaces FOR EACH ROW EXECUTE FUNCTION public.fn_app_activity_logger();

DROP TRIGGER IF EXISTS trg_pm_comments_generic_log ON public.pm_item_comments;
CREATE TRIGGER trg_pm_comments_generic_log AFTER INSERT ON public.pm_item_comments FOR EACH ROW EXECUTE FUNCTION public.fn_app_activity_logger();

