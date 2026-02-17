-- Consolidated migration for "Genera Prima Nota"
-- Adds all functions for monthly accounting reports (Active, Passive, Transactions, Statements)

-- 0. DROP existing functions to avoid return type mismatch
DROP FUNCTION IF EXISTS public.get_monthly_passive_invoices(integer, integer);
DROP FUNCTION IF EXISTS public.get_monthly_active_invoices(integer, integer);
DROP FUNCTION IF EXISTS public.get_monthly_transactions(integer, integer);
DROP FUNCTION IF EXISTS public.get_monthly_bank_statements(integer, integer);

-- 1. PASSIVE INVOICES (Already created, but updating for consistency)
CREATE OR REPLACE FUNCTION public.get_monthly_passive_invoices(p_year integer, p_month integer)
 RETURNS TABLE(
    invoice_date date,
    supplier_name text,
    description text,
    amount_total numeric,
    payment_status text,
    payment_date date,
    vat_amount numeric,
    is_vat_active boolean
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    pi.issue_date,
    s.name as supplier_name,
    COALESCE(pi.service_description, pi.description) as description,
    pi.amount_tax_included,
    pi.status,
    pi.payment_date,
    pi.tax_amount,
    pi.iva_attiva
  FROM passive_invoices pi
  LEFT JOIN suppliers s ON pi.supplier_id = s.id
  WHERE 
    EXTRACT(YEAR FROM pi.issue_date) = p_year
    AND EXTRACT(MONTH FROM pi.issue_date) = p_month
  ORDER BY pi.issue_date ASC;
END;
$function$;

-- 2. ACTIVE INVOICES
CREATE OR REPLACE FUNCTION public.get_monthly_active_invoices(p_year integer, p_month integer)
 RETURNS TABLE(
    invoice_number text,
    invoice_date date,
    client_name text,
    amount_total numeric,
    vat_amount numeric,
    net_amount numeric,
    status text,
    payment_date date
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    i.invoice_number,
    i.date as invoice_date,
    c.name as client_name,
    i.amount as amount_total,
    (i.amount * 0.22) as vat_amount, -- Fallback calculation if column missing
    (i.amount / 1.22) as net_amount, -- Fallback calculation if column missing
    COALESCE(i.status, 'Bozza') as status,
    i.payment_date
  FROM invoices i
  LEFT JOIN clients c ON i.client_id = c.id
  WHERE 
    EXTRACT(YEAR FROM i.date) = p_year
    AND EXTRACT(MONTH FROM i.date) = p_month
  ORDER BY i.date ASC;
END;
$function$;

-- 3. BANK TRANSACTIONS (Registro Movimenti)
CREATE OR REPLACE FUNCTION public.get_monthly_transactions(p_year integer, p_month integer)
 RETURNS TABLE(
    transaction_date date,
    description text,
    amount numeric,
    supplier_name text,
    client_name text,
    status text,
    category_name text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    bt.date,
    bt.description,
    bt.amount,
    s.name as supplier_name,
    c.name as client_name,
    bt.status,
    NULL::text as category_name -- Add category join if needed later
  FROM bank_transactions bt
  LEFT JOIN suppliers s ON bt.supplier_id = s.id
  LEFT JOIN clients c ON bt.client_id = c.id
  WHERE 
    EXTRACT(YEAR FROM bt.date) = p_year
    AND EXTRACT(MONTH FROM bt.date) = p_month
  ORDER BY bt.date ASC;
END;
$function$;

-- 4. BANK STATEMENTS (Estratti Conto)
CREATE OR REPLACE FUNCTION public.get_monthly_bank_statements(p_year integer, p_month integer)
 RETURNS TABLE(
    statement_date date,
    name text,
    balance numeric,
    attachment_url text,
    attachment_name text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    bs.statement_date,
    bs.name,
    bs.balance,
    bs.attachment_url,
    bs.attachment_name
  FROM bank_statements bs
  WHERE 
    EXTRACT(YEAR FROM bs.statement_date) = p_year
    AND EXTRACT(MONTH FROM bs.statement_date) = p_month
  ORDER BY bs.statement_date ASC;
END;
$function$;

-- Set owner and permissions
ALTER FUNCTION public.get_monthly_passive_invoices(integer, integer) OWNER TO postgres;
ALTER FUNCTION public.get_monthly_active_invoices(integer, integer) OWNER TO postgres;
ALTER FUNCTION public.get_monthly_transactions(integer, integer) OWNER TO postgres;
ALTER FUNCTION public.get_monthly_bank_statements(integer, integer) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.get_monthly_passive_invoices(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_monthly_active_invoices(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_monthly_transactions(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_monthly_bank_statements(integer, integer) TO service_role;
