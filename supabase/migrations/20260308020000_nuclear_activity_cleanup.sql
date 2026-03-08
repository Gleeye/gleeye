-- NUCLEAR CLEANUP OF ACTIVITY LOGS
BEGIN;

-- 1. DEACTIVATE ALL MANUAL LOGGING FROM NOTIFICATION TRIGGERS
-- These functions should only handle broadcast/email, NOT insert into pm_activity_logs.

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

CREATE OR REPLACE FUNCTION public.trg_pm_comments_notify_log()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_name TEXT := 'Un utente';
    v_item RECORD;
    v_space_pm UUID;
    v_assignees UUID[];
    v_recipients UUID[];
BEGIN
    IF NEW.author_user_ref IS NOT NULL THEN
        SELECT COALESCE(first_name || ' ' || last_name, 'Un utente') INTO v_actor_name FROM profiles WHERE id = NEW.author_user_ref;
    END IF;
    SELECT * INTO v_item FROM public.pm_items WHERE id = NEW.pm_item_ref;
    SELECT default_pm_user_ref INTO v_space_pm FROM public.pm_spaces WHERE id = v_item.space_ref;
    SELECT array_agg(user_ref) INTO v_assignees FROM public.pm_item_assignees WHERE pm_item_ref = NEW.pm_item_ref;
    v_recipients := array_cat(ARRAY[v_space_pm, v_item.created_by_user_ref], COALESCE(v_assignees, ARRAY[]::UUID[]));

    PERFORM public.broadcast_pm_notification(v_recipients, 'pm_comment_added', 'Nuovo Commento', v_actor_name || ' ha commentato in: ' || v_item.title, jsonb_build_object('space_id', v_item.space_ref, 'item_id', v_item.id), NEW.author_user_ref);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trg_pm_assignees_notify_log()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT := 'Un utente';
    v_item RECORD;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN SELECT COALESCE(first_name || ' ' || last_name, 'Un utente') INTO v_actor_name FROM profiles WHERE id = v_actor_id; END IF;
    SELECT * INTO v_item FROM public.pm_items WHERE id = NEW.pm_item_ref;
    
    IF TG_OP = 'INSERT' THEN
        PERFORM public.broadcast_pm_notification(ARRAY[NEW.user_ref], 'pm_item_assigned', 'Nuova Assegnazione', v_actor_name || ' ti ha assegnato a: ' || v_item.title, jsonb_build_object('space_id', v_item.space_ref, 'item_id', v_item.id), v_actor_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. ENSURE ALL TABLES HAVE THE UNIFIED LOGGER TRIGGER
-- pm_items, pm_spaces, pm_item_assignees, pm_item_comments

DROP TRIGGER IF EXISTS trg_pm_items_activity_log ON public.pm_items;
CREATE TRIGGER trg_pm_items_activity_log AFTER INSERT OR UPDATE ON public.pm_items FOR EACH ROW EXECUTE FUNCTION public.fn_app_activity_logger();

DROP TRIGGER IF EXISTS trg_pm_spaces_activity_log ON public.pm_spaces;
CREATE TRIGGER trg_pm_spaces_activity_log AFTER INSERT OR UPDATE ON public.pm_spaces FOR EACH ROW EXECUTE FUNCTION public.fn_app_activity_logger();

DROP TRIGGER IF EXISTS trg_pm_assignees_activity_log ON public.pm_item_assignees;
CREATE TRIGGER trg_pm_assignees_activity_log AFTER INSERT ON public.pm_item_assignees FOR EACH ROW EXECUTE FUNCTION public.fn_app_activity_logger();

DROP TRIGGER IF EXISTS trg_pm_comments_activity_log ON public.pm_item_comments;
CREATE TRIGGER trg_pm_comments_activity_log AFTER INSERT ON public.pm_item_comments FOR EACH ROW EXECUTE FUNCTION public.fn_app_activity_logger();


-- 3. BRUTE FORCE DELETE OF ALL "SYSTEM" DUPLICATES CREATED IN LAST 24 HOURS
-- We delete any entry that doesn't have a structured 'description' or has technical action_types that we now handle.

DELETE FROM public.pm_activity_logs 
WHERE created_at > NOW() - INTERVAL '24 hours'
AND (
    action_type IN ('item_created', 'assignee_added', 'comment_added', 'workspace_created', 'workspace_updated', 'status_changed', 'item_updated')
    OR (details->>'description' IS NULL OR details->>'description' = '')
);

-- Delete entries with exact same minute/actor/item if they are just duplicates
DELETE FROM public.pm_activity_logs a USING (
    SELECT MIN(id::text)::uuid as min_id, actor_user_ref, item_ref, date_trunc('minute', created_at) as minute
    FROM public.pm_activity_logs
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY actor_user_ref, item_ref, date_trunc('minute', created_at)
    HAVING COUNT(*) > 1
) b
WHERE a.actor_user_ref = b.actor_user_ref 
AND a.item_ref = b.item_ref 
AND date_trunc('minute', a.created_at) = b.minute
AND a.id != b.min_id;

COMMIT;
