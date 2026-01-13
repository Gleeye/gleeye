-- 1. Add transaction_id to payments table
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL;

-- 2. Function: Auto-set Payment Status to 'Done' when transaction_id is linked
CREATE OR REPLACE FUNCTION public.auto_set_payment_done_on_link()
RETURNS TRIGGER AS $$
BEGIN
    -- If transaction_id is set (and wasn't before or changed), set status to 'Done'
    IF NEW.transaction_id IS NOT NULL THEN
        NEW.status := 'Done';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger for Payment Link
DROP TRIGGER IF EXISTS trigger_payment_auto_done_on_link ON public.payments;
CREATE TRIGGER trigger_payment_auto_done_on_link
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.auto_set_payment_done_on_link();


-- 4. Function: Auto-set Payment Status to 'Done' when Invoice is Paid
CREATE OR REPLACE FUNCTION public.auto_set_payment_done_on_invoice_paid()
RETURNS TRIGGER AS $$
BEGIN
    -- Check for various "Paid" statuses
    IF NEW.status IN ('Saldata', 'Pagato', 'Paid', 'Completed', 'Saldato') AND 
       (OLD.status IS NULL OR OLD.status NOT IN ('Saldata', 'Pagato', 'Paid', 'Completed', 'Saldato')) THEN
        
        -- Update linked payments based on table name
        IF TG_TABLE_NAME = 'invoices' THEN
            UPDATE public.payments 
            SET status = 'Done' 
            WHERE invoice_id = NEW.id AND status <> 'Done';
            
        ELSIF TG_TABLE_NAME = 'passive_invoices' THEN
            UPDATE public.payments 
            SET status = 'Done' 
            WHERE passive_invoice_id = NEW.id AND status <> 'Done';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger for Active Invoices
DROP TRIGGER IF EXISTS trigger_payment_auto_done_on_invoice_paid ON public.invoices;
CREATE TRIGGER trigger_payment_auto_done_on_invoice_paid
AFTER UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.auto_set_payment_done_on_invoice_paid();

-- 6. Trigger for Passive Invoices
DROP TRIGGER IF EXISTS trigger_payment_auto_done_on_passive_invoice_paid ON public.passive_invoices;
CREATE TRIGGER trigger_payment_auto_done_on_passive_invoice_paid
AFTER UPDATE ON public.passive_invoices
FOR EACH ROW
EXECUTE FUNCTION public.auto_set_payment_done_on_invoice_paid();
