-- Migration: Setup PM Notifications & Activity Logs Triggers
-- Description: Creates functions and triggers to log activities and notify users on PM events.

-- Reusable function to broadcast notifications to a list of users
CREATE OR REPLACE FUNCTION public.broadcast_pm_notification(
    p_user_ids UUID[],
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_data JSONB,
    p_actor_id UUID
) RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_collab_id UUID;
BEGIN
    FOR v_user_id IN 
        -- Select distinct user IDs, excluding the actor themselves so we don't notify the person who did the action
        SELECT DISTINCT unnest(p_user_ids) EXCEPT SELECT p_actor_id
    LOOP
        -- Find the collaborator row for this user, if any
        SELECT id INTO v_collab_id FROM public.collaborators WHERE user_id = v_user_id LIMIT 1;
        
        IF v_user_id IS NOT NULL THEN
            -- Insert a separate row for each recipient
            INSERT INTO public.notifications (user_id, collaborator_id, type, title, message, data, is_read)
            VALUES (v_user_id, v_collab_id, p_type, p_title, p_message, p_data, false);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 1. Trigger for pm_spaces (Commesse & Progetti)
CREATE OR REPLACE FUNCTION public.trg_pm_spaces_notify_log()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
    v_pm_name TEXT := '';
    v_admin_users UUID[];
    v_recipients UUID[];
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL AND NEW.default_pm_user_ref IS NOT NULL THEN
        -- Fallback if manipulated by service role but default PM is set
        v_actor_id := NEW.default_pm_user_ref;
    END IF;

    -- Fetch admins
    SELECT array_agg(id) INTO v_admin_users FROM auth.users WHERE EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.users.id AND profiles.role = 'admin'
    );
    
    -- Recipients = Admins + the default PM
    v_recipients := array_cat(v_admin_users, ARRAY[NEW.default_pm_user_ref]);
    
    -- Get actor name
    IF v_actor_id IS NOT NULL THEN
        SELECT COALESCE(first_name || ' ' || last_name, 'Un utente') INTO v_pm_name 
        FROM profiles WHERE id = v_actor_id;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- Insert Activity Log
        INSERT INTO public.pm_activity_logs (space_ref, actor_user_ref, action_type, details)
        VALUES (NEW.id, v_actor_id, 'workspace_created', jsonb_build_object('name', NEW.name, 'type', NEW.type));

        -- Send Notifications
        PERFORM public.broadcast_pm_notification(
            v_recipients,
            'pm_space_created',
            'Nuovo Spazio Lavoro',
            v_pm_name || ' ha creato: ' || NEW.name,
            jsonb_build_object('space_id', NEW.id, 'space_type', NEW.type),
            v_actor_id
        );
    ELSIF TG_OP = 'UPDATE' AND (NEW.name <> OLD.name OR NEW.default_pm_user_ref <> OLD.default_pm_user_ref) THEN
        INSERT INTO public.pm_activity_logs (space_ref, actor_user_ref, action_type, details)
        VALUES (NEW.id, v_actor_id, 'workspace_updated', jsonb_build_object('old_name', OLD.name, 'new_name', NEW.name));
        
        -- Notification for updates could be noisy, but let's notify the new PM if changed
        IF NEW.default_pm_user_ref <> OLD.default_pm_user_ref AND NEW.default_pm_user_ref IS NOT NULL THEN
            PERFORM public.broadcast_pm_notification(
                ARRAY[NEW.default_pm_user_ref],
                'pm_space_assigned',
                'Assegnazione Spazio',
                v_pm_name || ' ti ha assegnato come PM su: ' || NEW.name,
                jsonb_build_object('space_id', NEW.id),
                v_actor_id
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_pm_spaces_audit_notify ON public.pm_spaces;
CREATE TRIGGER trg_pm_spaces_audit_notify
AFTER INSERT OR UPDATE ON public.pm_spaces
FOR EACH ROW EXECUTE FUNCTION public.trg_pm_spaces_notify_log();


-- 2. Trigger for pm_items (Tasks, Attività)
CREATE OR REPLACE FUNCTION public.trg_pm_items_notify_log()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT := 'Un utente';
    v_space_pm UUID;
    v_assignees UUID[];
    v_recipients UUID[];
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := NEW.created_by_user_ref;
    END IF;

    IF v_actor_id IS NOT NULL THEN
        SELECT COALESCE(first_name || ' ' || last_name, 'Un utente') INTO v_actor_name 
        FROM profiles WHERE id = v_actor_id;
    END IF;

    SELECT default_pm_user_ref INTO v_space_pm FROM public.pm_spaces WHERE id = NEW.space_ref;
    
    SELECT array_agg(user_ref) INTO v_assignees FROM public.pm_item_assignees WHERE pm_item_ref = NEW.id;
    IF v_assignees IS NULL THEN
        v_assignees := ARRAY[]::UUID[];
    END IF;

    v_recipients := array_cat(ARRAY[v_space_pm, NEW.created_by_user_ref], v_assignees);

    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.pm_activity_logs (space_ref, item_ref, actor_user_ref, action_type, details)
        VALUES (NEW.space_ref, NEW.id, v_actor_id, 'item_created', jsonb_build_object('title', NEW.title, 'type', NEW.item_type));

        PERFORM public.broadcast_pm_notification(
            v_recipients,
            'pm_item_created',
            'Nuova Attività',
            v_actor_name || ' ha creato: ' || NEW.title,
            jsonb_build_object('space_id', NEW.space_ref, 'item_id', NEW.id),
            v_actor_id
        );
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status <> OLD.status THEN
            INSERT INTO public.pm_activity_logs (space_ref, item_ref, actor_user_ref, action_type, details)
            VALUES (NEW.space_ref, NEW.id, v_actor_id, 'status_changed', jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));

            PERFORM public.broadcast_pm_notification(
                v_recipients,
                'pm_item_status',
                'Cambio Stato',
                v_actor_name || ' ha spostato "' || NEW.title || '" in ' || NEW.status,
                jsonb_build_object('space_id', NEW.space_ref, 'item_id', NEW.id, 'status', NEW.status),
                v_actor_id
            );
        ELSIF NEW.title <> OLD.title OR NEW.due_date <> OLD.due_date THEN
            INSERT INTO public.pm_activity_logs (space_ref, item_ref, actor_user_ref, action_type, details)
            VALUES (NEW.space_ref, NEW.id, v_actor_id, 'item_updated', jsonb_build_object('title_changed', NEW.title <> OLD.title, 'due_date_changed', NEW.due_date <> OLD.due_date));
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_pm_items_audit_notify ON public.pm_items;
CREATE TRIGGER trg_pm_items_audit_notify
AFTER INSERT OR UPDATE ON public.pm_items
FOR EACH ROW EXECUTE FUNCTION public.trg_pm_items_notify_log();


-- 3. Trigger for pm_item_comments
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
        SELECT COALESCE(first_name || ' ' || last_name, 'Un utente') INTO v_actor_name 
        FROM profiles WHERE id = NEW.author_user_ref;
    END IF;

    SELECT * INTO v_item FROM public.pm_items WHERE id = NEW.pm_item_ref;
    SELECT default_pm_user_ref INTO v_space_pm FROM public.pm_spaces WHERE id = v_item.space_ref;
    SELECT array_agg(user_ref) INTO v_assignees FROM public.pm_item_assignees WHERE pm_item_ref = NEW.pm_item_ref;
    IF v_assignees IS NULL THEN v_assignees := ARRAY[]::UUID[]; END IF;

    v_recipients := array_cat(ARRAY[v_space_pm, v_item.created_by_user_ref], v_assignees);

    INSERT INTO public.pm_activity_logs (space_ref, item_ref, actor_user_ref, action_type, details)
    VALUES (v_item.space_ref, NEW.pm_item_ref, NEW.author_user_ref, 'comment_added', jsonb_build_object('comment_snippet', substring(NEW.body from 1 for 50)));

    PERFORM public.broadcast_pm_notification(
        v_recipients,
        'pm_comment_added',
        'Nuovo Commento',
        v_actor_name || ' ha commentato in: ' || v_item.title,
        jsonb_build_object('space_id', v_item.space_ref, 'item_id', v_item.id),
        NEW.author_user_ref
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_pm_comments_audit_notify ON public.pm_item_comments;
CREATE TRIGGER trg_pm_comments_audit_notify
AFTER INSERT ON public.pm_item_comments
FOR EACH ROW EXECUTE FUNCTION public.trg_pm_comments_notify_log();


-- 4. Trigger for assignments (to notify when someone is linked)
CREATE OR REPLACE FUNCTION public.trg_pm_assignees_notify_log()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT := 'Un utente';
    v_item RECORD;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        SELECT COALESCE(first_name || ' ' || last_name, 'Un utente') INTO v_actor_name 
        FROM profiles WHERE id = v_actor_id;
    END IF;

    SELECT * INTO v_item FROM public.pm_items WHERE id = NEW.pm_item_ref;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.pm_activity_logs (space_ref, item_ref, actor_user_ref, action_type, details)
        VALUES (v_item.space_ref, NEW.pm_item_ref, v_actor_id, 'assignee_added', jsonb_build_object('assigned_user', NEW.user_ref));

        PERFORM public.broadcast_pm_notification(
            ARRAY[NEW.user_ref],
            'pm_item_assigned',
            'Nuova Assegnazione',
            v_actor_name || ' ti ha assegnato a: ' || v_item.title,
            jsonb_build_object('space_id', v_item.space_ref, 'item_id', v_item.id),
            v_actor_id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_pm_assignees_audit_notify ON public.pm_item_assignees;
CREATE TRIGGER trg_pm_assignees_audit_notify
AFTER INSERT ON public.pm_item_assignees
FOR EACH ROW EXECUTE FUNCTION public.trg_pm_assignees_notify_log();
