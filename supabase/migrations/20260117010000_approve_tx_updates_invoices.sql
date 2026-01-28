
create or replace function public.approve_bank_transaction(
  p_tx_id uuid,
  p_category_id uuid default null,
  p_client_id uuid default null,
  p_supplier_id uuid default null,
  p_collaborator_id uuid default null,
  p_active_invoice_id uuid default null,
  p_passive_invoice_id uuid default null,
  p_payment_id uuid default null,
  p_note text default null
)
returns public.bank_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  tx public.bank_transactions;
begin
  -- Update the transaction
  update public.bank_transactions
  set
    status = 'posted',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    review_notes = p_note,
    category_id = coalesce(p_category_id, category_id),
    client_id = coalesce(p_client_id, client_id),
    supplier_id = coalesce(p_supplier_id, supplier_id),
    collaborator_id = coalesce(p_collaborator_id, collaborator_id),
    active_invoice_id = coalesce(p_active_invoice_id, active_invoice_id),
    passive_invoice_id = coalesce(p_passive_invoice_id, passive_invoice_id)
  where id = p_tx_id
  returning * into tx;

  -- Auto-update Active Invoice if linked
  if tx.active_invoice_id is not null then
    update public.invoices
    set 
      status = 'Saldata',
      payment_date = tx.date
    where id = tx.active_invoice_id;
  end if;

  -- Auto-update Passive Invoice if linked
  if tx.passive_invoice_id is not null then
    update public.passive_invoices
    set 
      status = 'Pagato',
      payment_date = tx.date
    where id = tx.passive_invoice_id;
  end if;

  -- Existing Payment Logic
  if p_payment_id is not null then
    update public.payments
    set
      bank_transaction_id = p_tx_id,
      status = 'Done',
      updated_at = now()
    where id = p_payment_id
      and (bank_transaction_id is null or bank_transaction_id = p_tx_id);
  end if;

  return tx;
end $$;
