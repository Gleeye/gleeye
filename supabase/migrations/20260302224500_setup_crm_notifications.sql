-- Migration: CRM Triggers (Leads and Contact Forms)
-- Description: Adds triggers to create notifications for CRM events

-- 1. Trigger for new leads and status changes
CREATE OR REPLACE FUNCTION public.trg_leads_notify()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
    v_admin_users UUID[];
    v_recipients UUID[];
BEGIN
    v_actor_id := auth.uid();

    -- Fetch admins
    SELECT array_agg(id) INTO v_admin_users FROM auth.users WHERE EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.users.id AND profiles.role = 'admin'
    );
    
    -- Assignees usually get notified, but for leads, usually just admins and the assigned person (if any)
    v_recipients := v_admin_users;

    IF TG_OP = 'INSERT' THEN
        -- Send Notifications to Admins
        PERFORM public.broadcast_pm_notification(
            v_recipients,
            'crm_new_lead',
            'Nuovo Lead',
            'È stato registrato un nuovo lead: ' || NEW.first_name || ' ' || NEW.last_name,
            jsonb_build_object('lead_id', NEW.id, 'lead_first_name', NEW.first_name, 'lead_last_name', NEW.last_name, 'lead_email', NEW.email),
            v_actor_id
        );
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status <> OLD.status THEN
            PERFORM public.broadcast_pm_notification(
                v_recipients,
                'crm_lead_status',
                'Cambio Stato Lead',
                'Il lead ' || NEW.first_name || ' ' || NEW.last_name || ' è passato a: ' || NEW.status,
                jsonb_build_object('lead_id', NEW.id, 'lead_first_name', NEW.first_name, 'lead_last_name', NEW.last_name, 'new_status', NEW.status),
                v_actor_id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_leads_audit_notify ON public.leads;
CREATE TRIGGER trg_leads_audit_notify
AFTER INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.trg_leads_notify();

--------------------------------------------------------------------------------
-- 2. Trigger for Contact Forms (Form Submissions)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_contact_submissions_notify()
RETURNS TRIGGER AS $$
DECLARE
    v_admin_users UUID[];
    v_form_name TEXT := 'Sconosciuto';
BEGIN
    -- Fetch admins
    SELECT array_agg(id) INTO v_admin_users FROM auth.users WHERE EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.users.id AND profiles.role = 'admin'
    );

    IF NEW.form_id IS NOT NULL THEN
       SELECT name INTO v_form_name FROM public.contact_forms WHERE id = NEW.form_id;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- Invia notifica agli admin
        PERFORM public.broadcast_pm_notification(
            v_admin_users,
            'crm_contact_form',
            'Nuova Richiesta di Contatto',
            'Nuova richiesta dal form "' || v_form_name || '" da ' || NEW.data->>'name',
            jsonb_build_object('submission_id', NEW.id, 'form_name', v_form_name, 'name', NEW.data->>'name', 'email', NEW.data->>'email', 'message', NEW.data->>'message'),
            NULL -- Nessun actor_id perché è un'azione pubblica dal sito
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_contact_submissions_notify ON public.contact_submissions;
CREATE TRIGGER trg_contact_submissions_notify
AFTER INSERT ON public.contact_submissions
FOR EACH ROW EXECUTE FUNCTION public.trg_contact_submissions_notify();
