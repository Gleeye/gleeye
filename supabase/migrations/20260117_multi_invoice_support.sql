-- Add linked_invoices column for multi-invoice support
ALTER TABLE public.bank_transactions 
ADD COLUMN IF NOT EXISTS linked_invoices jsonb DEFAULT '[]'::jsonb;

-- Update approve function to handle multiple invoices
CREATE OR REPLACE FUNCTION public.approve_bank_transaction(
  p_tx_id uuid,
  p_category_id uuid DEFAULT NULL,
  p_client_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_collaborator_id uuid DEFAULT NULL,
  p_active_invoice_id uuid DEFAULT NULL,
  p_passive_invoice_id uuid DEFAULT NULL,
  p_payment_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS public.bank_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tx public.bank_transactions;
  invoice_id uuid;
BEGIN
  -- Update the transaction
  UPDATE public.bank_transactions
  SET
    status = 'posted',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    review_notes = p_note,
    category_id = COALESCE(p_category_id, category_id),
    client_id = COALESCE(p_client_id, client_id),
    supplier_id = COALESCE(p_supplier_id, supplier_id),
    collaborator_id = COALESCE(p_collaborator_id, collaborator_id),
    active_invoice_id = COALESCE(p_active_invoice_id, active_invoice_id),
    passive_invoice_id = COALESCE(p_passive_invoice_id, passive_invoice_id)
  WHERE id = p_tx_id
  RETURNING * INTO tx;

  -- Handle single active_invoice_id (legacy support)
  IF tx.active_invoice_id IS NOT NULL THEN
    UPDATE public.invoices
    SET 
      status = 'Saldata',
      payment_date = tx.date
    WHERE id = tx.active_invoice_id;
  END IF;

  -- Handle single passive_invoice_id (legacy support)
  IF tx.passive_invoice_id IS NOT NULL THEN
    UPDATE public.passive_invoices
    SET 
      status = 'Pagato',
      payment_date = tx.date
    WHERE id = tx.passive_invoice_id;
  END IF;

  -- Handle multiple linked invoices from linked_invoices JSONB
  IF tx.linked_invoices IS NOT NULL AND jsonb_array_length(tx.linked_invoices) > 0 THEN
    FOR invoice_id IN SELECT jsonb_array_elements_text(tx.linked_invoices)::uuid
    LOOP
      -- Try to update as active invoice first
      UPDATE public.invoices
      SET 
        status = 'Saldata',
        payment_date = tx.date
      WHERE id = invoice_id;
      
      -- Also try passive invoice (one of these will match)
      UPDATE public.passive_invoices
      SET 
        status = 'Pagato',
        payment_date = tx.date
      WHERE id = invoice_id;
    END LOOP;
  END IF;

  -- Existing Payment Logic
  IF p_payment_id IS NOT NULL THEN
    UPDATE public.payments
    SET
      bank_transaction_id = p_tx_id,
      status = 'Done',
      updated_at = now()
    WHERE id = p_payment_id
      AND (bank_transaction_id IS NULL OR bank_transaction_id = p_tx_id);
  END IF;

  RETURN tx;
END $$;
