-- Add pending transactions review workflow
-- Adds status column, review tracking, indexes, and approval/rejection RPC functions

alter table public.bank_transactions
  add column if not exists status text;

update public.bank_transactions
set status = 'posted'
where status is null;

alter table public.bank_transactions
  alter column status set not null;

alter table public.bank_transactions
  alter column status set default 'posted';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bank_transactions_status_check') then
    alter table public.bank_transactions
      add constraint bank_transactions_status_check
      check (status in ('pending','posted','rejected'));
  end if;
end $$;

alter table public.bank_transactions
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid,
  add column if not exists review_notes text;

create index if not exists bank_transactions_status_date_idx
on public.bank_transactions (status, date desc);

create index if not exists bank_transactions_statement_status_idx
on public.bank_transactions (statement_id, status);

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

create or replace function public.reject_bank_transaction(
  p_tx_id uuid,
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
  update public.bank_transactions
  set
    status = 'rejected',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    review_notes = p_note
  where id = p_tx_id
  returning * into tx;

  return tx;
end $$;
