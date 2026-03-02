-- Migration: System and Admin Triggers
-- Description: Adds triggers for system-level administrative notifications

-- 1. Trigger for New Collaborators
CREATE OR REPLACE FUNCTION public.trg_collaborators_notify()
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
    
    v_recipients := v_admin_users;

    IF TG_OP = 'INSERT' THEN
        -- Only notify if the collaborator wasn't created by the admin themselves
        -- (Often admins create collaborators manually, but sometimes they register via invite)
        IF v_actor_id IS NULL OR NOT (v_actor_id = ANY(v_admin_users)) THEN
            PERFORM public.broadcast_pm_notification(
                v_recipients,
                'admin_new_user',
                'Nuovo Collaboratore Registrato',
                'Un nuovo collaboratore si è registrato: ' || NEW.first_name || ' ' || NEW.last_name,
                jsonb_build_object('collaborator_id', NEW.id, 'user_name', NEW.first_name || ' ' || NEW.last_name, 'user_role', 'Collaboratore'),
                v_actor_id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_collaborators_notify ON public.collaborators;
CREATE TRIGGER trg_collaborators_notify
AFTER INSERT ON public.collaborators
FOR EACH ROW EXECUTE FUNCTION public.trg_collaborators_notify();


-- 2. Trigger for New Orders (Commesse)
CREATE OR REPLACE FUNCTION public.trg_orders_notify()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
    v_admin_users UUID[];
    v_recipients UUID[];
    v_client_name TEXT := 'Sconosciuto';
BEGIN
    v_actor_id := auth.uid();

    SELECT array_agg(id) INTO v_admin_users FROM auth.users WHERE EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.users.id AND profiles.role = 'admin'
    );
    v_recipients := v_admin_users;

    IF NEW.client_id IS NOT NULL THEN
        SELECT business_name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
    END IF;

    IF TG_OP = 'INSERT' THEN
        PERFORM public.broadcast_pm_notification(
            v_recipients,
            'admin_new_order',
            'Nuovo Ordine',
            'È stato registrato il nuovo ordine ' || NEW.id || ' per ' || v_client_name,
            jsonb_build_object('order_id', NEW.id, 'order_number', NEW.id, 'client_name', v_client_name),
            v_actor_id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_orders_notify ON public.orders;
CREATE TRIGGER trg_orders_notify
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_orders_notify();
