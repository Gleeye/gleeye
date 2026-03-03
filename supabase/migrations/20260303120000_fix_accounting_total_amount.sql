-- Migration: Fix Accounting Triggers (Invoices, Payments, Transactions)
-- Description: Fixes total_amount error in accounting triggers

-- 1. Trigger for Active and Passive Invoices
CREATE OR REPLACE FUNCTION public.trg_invoices_notify()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
    v_admin_users UUID[];
    v_recipients UUID[];
    v_invoice_type TEXT := 'Attiva';
    v_client_name TEXT := 'Sconosciuto';
BEGIN
    v_actor_id := auth.uid();

    -- Fetch admins
    SELECT array_agg(id) INTO v_admin_users FROM auth.users WHERE EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.users.id AND profiles.role = 'admin'
    );
    
    v_recipients := v_admin_users;

    IF TG_TABLE_NAME = 'passive_invoices' THEN
        v_invoice_type := 'Passiva';
        -- For passive invoices, the name might be in supplier_name or collaborator_name
        IF NEW.supplier_id IS NOT NULL THEN
            SELECT business_name INTO v_client_name FROM public.suppliers WHERE id = NEW.supplier_id;
        ELSIF NEW.collaborator_id IS NOT NULL THEN
            SELECT COALESCE(business_name, first_name || ' ' || last_name) INTO v_client_name FROM public.collaborators WHERE id = NEW.collaborator_id;
        END IF;
    ELSE
        -- Active invoices
        IF NEW.client_id IS NOT NULL THEN
            SELECT business_name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
        END IF;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- Send notification for new invoice
        PERFORM public.broadcast_pm_notification(
            v_recipients,
            'accounting_invoice_created',
            'Nuova Fattura ' || v_invoice_type,
            'È stata registrata una nuova fattura: ' || COALESCE(NEW.invoice_number, 'Bozza') || ' - ' || v_client_name,
            jsonb_build_object('invoice_id', NEW.id, 'invoice_type', v_invoice_type, 'invoice_number', NEW.invoice_number, 'client_name', v_client_name, 'amount', NEW.amount),
            v_actor_id
        );
    ELSIF TG_OP = 'UPDATE' THEN
        -- Check if status changed to 'paid'
        IF NEW.status = 'paid' AND OLD.status <> 'paid' THEN
            PERFORM public.broadcast_pm_notification(
                v_recipients,
                'accounting_payment_received',
                'Pagamento Ricevuto',
                'La fattura ' || COALESCE(NEW.invoice_number, '') || ' (' || v_client_name || ') è risultata pagata.',
                jsonb_build_object('invoice_id', NEW.id, 'invoice_type', v_invoice_type, 'invoice_number', NEW.invoice_number, 'client_name', v_client_name),
                v_actor_id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
