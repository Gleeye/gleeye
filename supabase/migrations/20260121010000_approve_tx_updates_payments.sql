-- Update approve_bank_transaction to matched payments for passive invoices
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
  v_collab_id uuid;
  v_inv_amount numeric;
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

  -- Handle single active_invoice_id (Legacy / Single Mode)
  IF tx.active_invoice_id IS NOT NULL THEN
    UPDATE public.invoices
    SET 
      status = 'Saldata',
      payment_date = tx.date
    WHERE id = tx.active_invoice_id;
  END IF;

  -- Handle single passive_invoice_id (Legacy / Single Mode)
  IF tx.passive_invoice_id IS NOT NULL THEN
    -- 1. Update Invoice Link
    UPDATE public.passive_invoices
    SET 
      status = 'Pagato',
      payment_date = tx.date
    WHERE id = tx.passive_invoice_id;

    -- 2. Try to find and update associated Collaborator Payment
    -- Get collaborator and amount from invoice
    SELECT collaborator_id, amount_tax_included INTO v_collab_id, v_inv_amount 
    FROM public.passive_invoices WHERE id = tx.passive_invoice_id;
    
    -- Fallbacks
    IF v_collab_id IS NULL THEN v_collab_id := tx.collaborator_id; END IF;
    IF v_inv_amount IS NULL THEN v_inv_amount := tx.amount; END IF;

    IF v_collab_id IS NOT NULL THEN
       -- Update the OLDEST matching pending payment
       -- We use a CTE to find the ID first to ensure we limit to 1
       WITH target_payment AS (
           SELECT p.id 
           FROM public.payments p
           JOIN public.assignments a ON p.assignment_id = a.id::text
           WHERE a.collaborator_id = v_collab_id
             AND p.status = 'pending'
             -- Match amount with tolerance (covering net vs gross scenarios or small diffs)
             AND (abs(p.amount - tx.amount) < 1.0 OR abs(p.amount - v_inv_amount) < 1.0)
           ORDER BY p.payment_date ASC, p.created_at ASC
           LIMIT 1
       )
       UPDATE public.payments
       SET 
         status = 'Done', 
         bank_transaction_id = tx.id,
         payment_date = tx.date, -- Set actual payment date
         updated_at = now()
       WHERE id IN (SELECT id FROM target_payment);
    END IF;
  END IF;

  -- Handle multiple linked invoices from linked_invoices JSONB
  IF tx.linked_invoices IS NOT NULL AND jsonb_array_length(tx.linked_invoices) > 0 THEN
    FOR invoice_id IN SELECT jsonb_array_elements_text(tx.linked_invoices)::uuid
    LOOP
      UPDATE public.invoices
      SET status = 'Saldata', payment_date = tx.date
      WHERE id = invoice_id;
      
      UPDATE public.passive_invoices
      SET status = 'Pagato', payment_date = tx.date
      WHERE id = invoice_id;
      
      -- We could recursively try to update payments here too but for now let's stick to the primary one
    END LOOP;
  END IF;

  -- Explicit Payment override (if passed)
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
