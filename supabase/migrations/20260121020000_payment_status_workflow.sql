-- Payment Status Workflow Enhancement
-- New statuses: 'Da Fare', 'Invito Inviato', 'In Attesa', 'Completato'

-- 1. Add new columns to payments table
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'passive', -- 'active' or 'passive'
ADD COLUMN IF NOT EXISTS invoice_id UUID, -- Links to invoices or passive_invoices
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ, -- When invite was sent
ADD COLUMN IF NOT EXISTS bank_transaction_id UUID REFERENCES public.bank_transactions(id);

-- 2. Migrate existing statuses
UPDATE public.payments SET status = 'Da Fare' WHERE status = 'pending' OR status = 'todo' OR status IS NULL;
UPDATE public.payments SET status = 'Completato' WHERE status = 'Done' OR status = 'done' OR status = 'paid';

-- 3. Create trigger function for auto-status on invoice link
CREATE OR REPLACE FUNCTION public.payment_invoice_link_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- When invoice_id is set and status is still 'Da Fare' or 'Invito Inviato', move to 'In Attesa'
    IF NEW.invoice_id IS NOT NULL AND OLD.invoice_id IS NULL THEN
        IF NEW.status IN ('Da Fare', 'Invito Inviato') THEN
            NEW.status := 'In Attesa';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach trigger to payments table
DROP TRIGGER IF EXISTS trg_payment_invoice_link ON public.payments;
CREATE TRIGGER trg_payment_invoice_link
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.payment_invoice_link_trigger();

-- 5. Function to send invite (called from frontend, updates status and calls webhook)
CREATE OR REPLACE FUNCTION public.send_payment_invite(p_payment_id UUID, p_webhook_url TEXT DEFAULT NULL)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    pmt public.payments;
BEGIN
    UPDATE public.payments
    SET 
        status = 'Invito Inviato',
        invited_at = now()
    WHERE id = p_payment_id
    RETURNING * INTO pmt;
    
    -- Webhook call would be handled by edge function or external service
    -- This function just updates the status
    
    RETURN pmt;
END $$;
