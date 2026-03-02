-- Migration: Setup PM Notifications for Documents & Appointments
-- Description: Adds triggers for appointment participants and document changes.

-- 1. Trigger for appointment_internal_participants
CREATE OR REPLACE FUNCTION public.trg_appointment_participants_notify_log()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT := 'Un utente';
    v_appointment RECORD;
    v_target_user UUID;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        SELECT COALESCE(first_name || ' ' || last_name, 'Un utente') INTO v_actor_name 
        FROM profiles WHERE id = v_actor_id;
    END IF;

    -- Get the appointment and verify it's part of PM (has pm_space_id)
    SELECT * INTO v_appointment FROM public.appointments WHERE id = NEW.appointment_id;
    
    -- We mainly care about PM space appointments for the PM activity log
    IF v_appointment.pm_space_id IS NOT NULL THEN
        -- Find the user_id associated with this collaborator_id
        SELECT user_id INTO v_target_user FROM public.collaborators WHERE id = NEW.collaborator_id;

        IF v_target_user IS NOT NULL THEN
            -- Insert Activity Log
            IF TG_OP = 'INSERT' THEN
                -- Optionally, we log that an assignee was added to the appointment
                INSERT INTO public.pm_activity_logs (space_ref, actor_user_ref, action_type, details)
                VALUES (
                    v_appointment.pm_space_id, 
                    v_actor_id, 
                    'appointment_participant_added', 
                    jsonb_build_object('appointment_title', v_appointment.title, 'assigned_user', v_target_user)
                );

                -- Send Notification
                PERFORM public.broadcast_pm_notification(
                    ARRAY[v_target_user],
                    'pm_appointment_invited',
                    'Invito Appuntamento',
                    v_actor_name || ' ti ha invitato all''appuntamento: ' || v_appointment.title,
                    jsonb_build_object('space_id', v_appointment.pm_space_id, 'appointment_id', v_appointment.id),
                    v_actor_id
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_appointment_participants_audit_notify ON public.appointment_internal_participants;
CREATE TRIGGER trg_appointment_participants_audit_notify
AFTER INSERT ON public.appointment_internal_participants
FOR EACH ROW EXECUTE FUNCTION public.trg_appointment_participants_notify_log();


-- 2. Trigger for doc_pages
CREATE OR REPLACE FUNCTION public.trg_doc_pages_notify_log()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT := 'Un utente';
    v_pm_space_id UUID;
    v_space_pm UUID;
    v_assignees UUID[];
    v_recipients UUID[];
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := NEW.created_by;
    END IF;

    IF v_actor_id IS NOT NULL THEN
        SELECT COALESCE(first_name || ' ' || last_name, 'Un utente') INTO v_actor_name 
        FROM profiles WHERE id = v_actor_id;
    END IF;

    -- Get the PM space ID from the doc_spaces link
    SELECT space_ref INTO v_pm_space_id FROM public.doc_spaces WHERE id = NEW.space_ref;
    
    IF v_pm_space_id IS NOT NULL THEN
        SELECT default_pm_user_ref INTO v_space_pm FROM public.pm_spaces WHERE id = v_pm_space_id;
        
        -- Get all space assignees
        SELECT array_agg(user_ref) INTO v_assignees 
        FROM public.pm_space_assignees 
        WHERE pm_space_ref = v_pm_space_id AND user_ref IS NOT NULL;
        
        IF v_assignees IS NULL THEN
            v_assignees := ARRAY[]::UUID[];
        END IF;

        -- Notify PM + Assignees + maybe actors
        v_recipients := array_cat(ARRAY[v_space_pm], v_assignees);

        IF TG_OP = 'INSERT' THEN
            -- Activity Log
            INSERT INTO public.pm_activity_logs (space_ref, actor_user_ref, action_type, details)
            VALUES (
                v_pm_space_id, 
                v_actor_id, 
                'document_created', 
                jsonb_build_object('doc_title', NEW.title, 'doc_id', NEW.id)
            );

            -- Notification
            PERFORM public.broadcast_pm_notification(
                v_recipients,
                'pm_document_created',
                'Nuovo Documento',
                v_actor_name || ' ha creato il documento: ' || NEW.title,
                jsonb_build_object('space_id', v_pm_space_id, 'doc_id', NEW.id),
                v_actor_id
            );
        ELSIF TG_OP = 'UPDATE' THEN
            -- Only log/notify if the title meaningfully changed so we don't spam on every text block change
            IF NEW.title <> OLD.title THEN
                INSERT INTO public.pm_activity_logs (space_ref, actor_user_ref, action_type, details)
                VALUES (
                    v_pm_space_id, 
                    v_actor_id, 
                    'document_updated', 
                    jsonb_build_object('old_title', OLD.title, 'new_title', NEW.title)
                );
                
                -- Notification
                PERFORM public.broadcast_pm_notification(
                    v_recipients,
                    'pm_document_updated',
                    'Documento Aggiornato',
                    v_actor_name || ' ha rinominato un documento in: ' || NEW.title,
                    jsonb_build_object('space_id', v_pm_space_id, 'doc_id', NEW.id),
                    v_actor_id
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_doc_pages_audit_notify ON public.doc_pages;
CREATE TRIGGER trg_doc_pages_audit_notify
AFTER INSERT OR UPDATE ON public.doc_pages
FOR EACH ROW EXECUTE FUNCTION public.trg_doc_pages_notify_log();
