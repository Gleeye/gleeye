


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."assignment_logic_type" AS ENUM (
    'OR',
    'AND',
    'TEAM_SIZE'
);


ALTER TYPE "public"."assignment_logic_type" OWNER TO "postgres";


CREATE TYPE "public"."booking_status" AS ENUM (
    'hold',
    'confirmed',
    'cancelled',
    'completed',
    'no_show',
    'rescheduled'
);


ALTER TYPE "public"."booking_status" OWNER TO "postgres";


CREATE TYPE "public"."calendar_provider" AS ENUM (
    'google',
    'apple',
    'other_ical'
);


ALTER TYPE "public"."calendar_provider" OWNER TO "postgres";


CREATE TYPE "public"."pm_item_type" AS ENUM (
    'attivita',
    'task',
    'milestone'
);


ALTER TYPE "public"."pm_item_type" OWNER TO "postgres";


CREATE TYPE "public"."pm_space_type" AS ENUM (
    'commessa',
    'interno'
);


ALTER TYPE "public"."pm_space_type" OWNER TO "postgres";


CREATE TYPE "public"."service_logic_type" AS ENUM (
    'OR',
    'AND',
    'TEAM_SIZE'
);


ALTER TYPE "public"."service_logic_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_clients_business_name_search_trg"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.business_name_search := unaccent(lower(new.business_name));
  return new;
end $$;


ALTER FUNCTION "public"."_clients_business_name_search_trg"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_col_exists"("p_table" "text", "p_col" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists(
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = p_table
      and column_name = p_col
  );
$$;


ALTER FUNCTION "public"."_col_exists"("p_table" "text", "p_col" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_collaborators_full_name_search_trg"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.full_name_search := unaccent(lower(new.full_name));
  return new;
end $$;


ALTER FUNCTION "public"."_collaborators_full_name_search_trg"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_invoices_invoice_number_search_trg"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.invoice_number_search := case
    when new.invoice_number is null then null
    else public.normalize_invoice_ref(new.invoice_number)
  end;
  return new;
end $$;


ALTER FUNCTION "public"."_invoices_invoice_number_search_trg"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_name_expr"("p_table" "text", "p_alias" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    AS $$
declare
  has_name boolean;
  has_full_name boolean;
  has_business_name boolean;
  has_company_name boolean;
  has_display_name boolean;
  has_ragione_sociale boolean;
  has_first_name boolean;
  has_last_name boolean;
begin
  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name=p_table and column_name='full_name'
  ) into has_full_name;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name=p_table and column_name='ragione_sociale'
  ) into has_ragione_sociale;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name=p_table and column_name='company_name'
  ) into has_company_name;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name=p_table and column_name='business_name'
  ) into has_business_name;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name=p_table and column_name='display_name'
  ) into has_display_name;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name=p_table and column_name='name'
  ) into has_name;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name=p_table and column_name='first_name'
  ) into has_first_name;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name=p_table and column_name='last_name'
  ) into has_last_name;

  if has_full_name then
    return format('%s.%I', p_alias, 'full_name');
  elsif has_ragione_sociale then
    return format('%s.%I', p_alias, 'ragione_sociale');
  elsif has_company_name then
    return format('%s.%I', p_alias, 'company_name');
  elsif has_business_name then
    return format('%s.%I', p_alias, 'business_name');
  elsif has_display_name then
    return format('%s.%I', p_alias, 'display_name');
  elsif has_name then
    return format('%s.%I', p_alias, 'name');
  elsif has_first_name and has_last_name then
    return format('concat_ws('' '', %s.%I, %s.%I)', p_alias, 'first_name', p_alias, 'last_name');
  else
    return null;
  end if;
end $$;


ALTER FUNCTION "public"."_name_expr"("p_table" "text", "p_alias" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_passive_invoices_invoice_number_search_trg"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.invoice_number_search := case
    when new.invoice_number is null then null
    else public.normalize_invoice_ref(new.invoice_number)
  end;
  return new;
end $$;


ALTER FUNCTION "public"."_passive_invoices_invoice_number_search_trg"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_suppliers_name_search_trg"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.name_search := unaccent(lower(new.name));
  return new;
end $$;


ALTER FUNCTION "public"."_suppliers_name_search_trg"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bank_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "old_id" "text",
    "date" "date" NOT NULL,
    "type" "text",
    "amount" numeric(15,2) NOT NULL,
    "description" "text",
    "category_id" "uuid",
    "active_invoice_id" "uuid",
    "passive_invoice_id" "uuid",
    "client_id" "uuid",
    "supplier_id" "uuid",
    "counterparty_name" "text",
    "external_ref_active_invoice" "text",
    "external_ref_passive_invoice" "text",
    "attachment_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "collaborator_id" "uuid",
    "statement_id" "uuid",
    "dedupe_key" "text",
    "raw" "jsonb",
    "status" "text" DEFAULT 'posted'::"text" NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "review_notes" "text",
    "linked_invoices" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "bank_transactions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'posted'::"text", 'rejected'::"text"]))),
    CONSTRAINT "bank_transactions_type_check" CHECK (("type" = ANY (ARRAY['entrata'::"text", 'uscita'::"text"])))
);


ALTER TABLE "public"."bank_transactions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_bank_transaction"("p_tx_id" "uuid", "p_category_id" "uuid" DEFAULT NULL::"uuid", "p_client_id" "uuid" DEFAULT NULL::"uuid", "p_supplier_id" "uuid" DEFAULT NULL::"uuid", "p_collaborator_id" "uuid" DEFAULT NULL::"uuid", "p_active_invoice_id" "uuid" DEFAULT NULL::"uuid", "p_passive_invoice_id" "uuid" DEFAULT NULL::"uuid", "p_payment_id" "uuid" DEFAULT NULL::"uuid", "p_note" "text" DEFAULT NULL::"text") RETURNS "public"."bank_transactions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."approve_bank_transaction"("p_tx_id" "uuid", "p_category_id" "uuid", "p_client_id" "uuid", "p_supplier_id" "uuid", "p_collaborator_id" "uuid", "p_active_invoice_id" "uuid", "p_passive_invoice_id" "uuid", "p_payment_id" "uuid", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_set_payment_done_on_invoice_paid"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."auto_set_payment_done_on_invoice_paid"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_set_payment_done_on_link"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- If transaction_id is set (and wasn't before or changed), set status to 'Done'
    IF NEW.transaction_id IS NOT NULL THEN
        NEW.status := 'Done';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_set_payment_done_on_link"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_notification_logs"("p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0, "p_search" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "created_at" timestamp with time zone, "type" "text", "title" "text", "message" "text", "user_email" "text", "collaborator_name" "text", "is_read" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Security Check: Ensure the caller is an admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
    ) AND NOT EXISTS (
        SELECT 1 FROM collaborators c2
        WHERE c2.user_id = auth.uid()
        AND c2.role IN ('admin', 'manager')
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    RETURN QUERY
    SELECT 
        n.id,
        n.created_at,
        n.type::TEXT,
        n.title::TEXT,
        n.message::TEXT,
        COALESCE(u.email, 'Unknown')::TEXT,
        (COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, ''))::TEXT,
        n.is_read
    FROM notifications n
    LEFT JOIN auth.users u ON n.user_id = u.id
    LEFT JOIN collaborators c ON n.collaborator_id = c.id
    WHERE 
        (p_search IS NULL OR 
         n.title ILIKE '%' || p_search || '%' OR 
         n.message ILIKE '%' || p_search || '%' OR
         u.email ILIKE '%' || p_search || '%' OR
         c.first_name ILIKE '%' || p_search || '%' OR
         c.last_name ILIKE '%' || p_search || '%'
        )
    ORDER BY n.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."get_admin_notification_logs"("p_limit" integer, "p_offset" integer, "p_search" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_outstanding_invoices_list"("p_client_id" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS json
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(t) INTO v_result FROM (
        SELECT 
            i.id,
            i.invoice_number,
            i.invoice_date,
            i.amount_tax_excluded,
            i.amount_tax_included,
            i.title,
            c.business_name as client_name,
            CURRENT_DATE - i.invoice_date as days_open
        FROM invoices i
        LEFT JOIN clients c ON i.client_id = c.id
        WHERE i.status != 'Saldata' 
          AND i.status != 'Annullata'
          AND (i.payment_date IS NULL) -- Truly unpaid
          AND (p_client_id IS NULL OR i.client_id = p_client_id)
        ORDER BY i.invoice_date ASC -- Oldest first
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_outstanding_invoices_list"("p_client_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_revenue_chart_data"("p_start_date" "date", "p_end_date" "date", "p_interval" "text" DEFAULT 'month'::"text", "p_client_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_series JSON;
BEGIN
    -- We generate a series of dates for the axis, then join with data
    -- This handles gaps (months with 0 revenue)
    IF p_interval = 'quarter' THEN
        SELECT json_agg(t) INTO v_series FROM (
            SELECT
                to_char(d, 'Q-YYYY') as label, -- Q1-2024
                date_trunc('quarter', d) as period_start,
                -- Issued in this quarter
                COALESCE((SELECT SUM(amount_tax_excluded) FROM invoices 
                          WHERE date_trunc('quarter', invoice_date) = date_trunc('quarter', d)
                          AND status != 'Annullata'
                          AND (p_client_id IS NULL OR client_id = p_client_id)), 0) as issued,
                -- Collected in this quarter
                COALESCE((SELECT SUM(amount_tax_excluded) FROM invoices 
                          WHERE date_trunc('quarter', payment_date) = date_trunc('quarter', d)
                          AND (status = 'Saldata' OR payment_date IS NOT NULL)
                          AND status != 'Annullata'
                          AND (p_client_id IS NULL OR client_id = p_client_id)), 0) as collected
            FROM generate_series(date_trunc('quarter', p_start_date), date_trunc('quarter', p_end_date), '3 months'::interval) d
        ) t;
    ELSE
        SELECT json_agg(t) INTO v_series FROM (
            SELECT
                to_char(d, 'YYYY-MM') as label,
                d as period_start,
                COALESCE((SELECT SUM(amount_tax_excluded) FROM invoices 
                          WHERE date_trunc('month', invoice_date) = date_trunc('month', d)
                          AND status != 'Annullata'
                          AND (p_client_id IS NULL OR client_id = p_client_id)), 0) as issued,
                COALESCE((SELECT SUM(amount_tax_excluded) FROM invoices 
                          WHERE date_trunc('month', payment_date) = date_trunc('month', d)
                          AND (status = 'Saldata' OR payment_date IS NOT NULL)
                          AND status != 'Annullata'
                          AND (p_client_id IS NULL OR client_id = p_client_id)), 0) as collected
            FROM generate_series(date_trunc('month', p_start_date), date_trunc('month', p_end_date), '1 month'::interval) d
        ) t;
    END IF;

    RETURN v_series;
END;
$$;


ALTER FUNCTION "public"."get_revenue_chart_data"("p_start_date" "date", "p_end_date" "date", "p_interval" "text", "p_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_revenue_chart_data"("p_start_date" "date", "p_end_date" "date", "p_interval" "text" DEFAULT 'month'::"text", "p_client_id" "uuid" DEFAULT NULL::"uuid", "p_is_gross" boolean DEFAULT false) RETURNS json
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_series JSON;
BEGIN
    IF p_interval = 'quarter' THEN
        SELECT json_agg(t) INTO v_series FROM (
            SELECT
                to_char(d, 'Q-YYYY') as label, -- Q1-2024
                date_trunc('quarter', d) as period_start,
                -- Issued in this quarter
                COALESCE((SELECT SUM(CASE WHEN p_is_gross THEN amount_tax_included ELSE amount_tax_excluded END) FROM invoices
                          WHERE date_trunc('quarter', invoice_date) = date_trunc('quarter', d)
                          AND status != 'Annullata'
                          AND (p_client_id IS NULL OR client_id = p_client_id)), 0) as issued,
                -- Collected in this quarter
                COALESCE((SELECT SUM(CASE WHEN p_is_gross THEN amount_tax_included ELSE amount_tax_excluded END) FROM invoices
                          WHERE date_trunc('quarter', payment_date) = date_trunc('quarter', d)
                          AND (status = 'Saldata' OR payment_date IS NOT NULL)
                          AND status != 'Annullata'
                          AND (p_client_id IS NULL OR client_id = p_client_id)), 0) as collected
            FROM generate_series(date_trunc('quarter', p_start_date), date_trunc('quarter', p_end_date), '3 months'::interval) d
        ) t;
    ELSE
        SELECT json_agg(t) INTO v_series FROM (
            SELECT
                to_char(d, 'YYYY-MM') as label,
                d as period_start,
                COALESCE((SELECT SUM(CASE WHEN p_is_gross THEN amount_tax_included ELSE amount_tax_excluded END) FROM invoices
                          WHERE date_trunc('month', invoice_date) = date_trunc('month', d)
                          AND status != 'Annullata'
                          AND (p_client_id IS NULL OR client_id = p_client_id)), 0) as issued,
                COALESCE((SELECT SUM(CASE WHEN p_is_gross THEN amount_tax_included ELSE amount_tax_excluded END) FROM invoices
                          WHERE date_trunc('month', payment_date) = date_trunc('month', d)
                          AND (status = 'Saldata' OR payment_date IS NOT NULL)
                          AND status != 'Annullata'
                          AND (p_client_id IS NULL OR client_id = p_client_id)), 0) as collected
            FROM generate_series(date_trunc('month', p_start_date), date_trunc('month', p_end_date), '1 month'::interval) d
        ) t;
    END IF;

    RETURN v_series;
END;
$$;


ALTER FUNCTION "public"."get_revenue_chart_data"("p_start_date" "date", "p_end_date" "date", "p_interval" "text", "p_client_id" "uuid", "p_is_gross" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_revenue_kpis"("p_start_date" "date", "p_end_date" "date", "p_client_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_issued NUMERIC;
    v_collected NUMERIC;
    v_outstanding NUMERIC;
    v_avg_days NUMERIC;
BEGIN
    -- Issued: Invoice Date in range, not Cancelled
    SELECT COALESCE(SUM(amount_tax_excluded), 0)
    INTO v_issued
    FROM invoices
    WHERE invoice_date BETWEEN p_start_date AND p_end_date
      AND status != 'Annullata'
      AND (p_client_id IS NULL OR client_id = p_client_id);

    -- Collected: Payment Date in range, Status = Saldata (or has payment date)
    -- We assume 'Collected' means the money came in during this period, regardless of when invoice was issued.
    SELECT COALESCE(SUM(amount_tax_excluded), 0)
    INTO v_collected
    FROM invoices
    WHERE payment_date BETWEEN p_start_date AND p_end_date
      AND (status = 'Saldata' OR payment_date IS NOT NULL)
      AND status != 'Annullata'
      AND (p_client_id IS NULL OR client_id = p_client_id);

    -- Outstanding: All time (or maybe snapshot? implementation says "sum importi delle fatture NON saldate... nel perimetro dei filtri")
    -- Requirement: "Da incassare (Outstanding): somma importi delle fatture non saldate (data saldo assente e/o stato non “pagata”) nel perimetro dei filtri."
    -- "Nel perimetro dei filtri" usually implies "Issued in this period but not yet paid" OR "Currently outstanding regardless of issue date"?
    -- Common ERP logic: "Outstanding" usually refers to CURRENTLY outstanding debt.
    -- However, if I filter for 2024, do I want to see what is STILL outstanding from 2024? Yes.
    SELECT COALESCE(SUM(amount_tax_excluded), 0)
    INTO v_outstanding
    FROM invoices
    WHERE invoice_date BETWEEN p_start_date AND p_end_date
      AND (status != 'Saldata' AND (payment_date IS NULL OR payment_date > p_end_date)) -- If paid AFTER the period, it was outstanding AT END of period? Or just simplistic "Is currently unpaid from that period"?
      -- UX Requirement: "Quanto mi manca da incassare". This usually implies "What is left to collect from the invoices issued in this period".
      AND status != 'Annullata'
      AND (p_client_id IS NULL OR client_id = p_client_id);

    -- Avg Days: Payment Date - Invoice Date for invoices PAID in this period
    SELECT COALESCE(AVG(payment_date - invoice_date), 0)
    INTO v_avg_days
    FROM invoices
    WHERE payment_date BETWEEN p_start_date AND p_end_date
      AND (status = 'Saldata' OR payment_date IS NOT NULL)
      AND status != 'Annullata'
      AND (p_client_id IS NULL OR client_id = p_client_id);

    RETURN json_build_object(
        'issued', v_issued,
        'collected', v_collected,
        'outstanding', v_outstanding,
        'avg_days', ROUND(v_avg_days, 1)
    );
END;
$$;


ALTER FUNCTION "public"."get_revenue_kpis"("p_start_date" "date", "p_end_date" "date", "p_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_revenue_kpis"("p_start_date" "date", "p_end_date" "date", "p_client_id" "uuid" DEFAULT NULL::"uuid", "p_is_gross" boolean DEFAULT false) RETURNS json
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_issued NUMERIC;
    v_collected NUMERIC;
    v_outstanding NUMERIC;
    v_avg_days NUMERIC;
    
    -- Helper to select column based on flag
    v_col TEXT; 
BEGIN
    -- We can't use dynamic SQL easily for variables, so we use CASE in queries.
    
    -- Issued: Invoice Date in range, not Cancelled
    SELECT COALESCE(SUM(CASE WHEN p_is_gross THEN amount_tax_included ELSE amount_tax_excluded END), 0)
    INTO v_issued
    FROM invoices
    WHERE invoice_date BETWEEN p_start_date AND p_end_date
      AND status != 'Annullata'
      AND (p_client_id IS NULL OR client_id = p_client_id);

    -- Collected: Payment Date in range, Status = Saldata (or has payment date)
    SELECT COALESCE(SUM(CASE WHEN p_is_gross THEN amount_tax_included ELSE amount_tax_excluded END), 0)
    INTO v_collected
    FROM invoices
    WHERE payment_date BETWEEN p_start_date AND p_end_date
      AND (status = 'Saldata' OR payment_date IS NOT NULL)
      AND status != 'Annullata'
      AND (p_client_id IS NULL OR client_id = p_client_id);

    -- Outstanding: Sum of amounts for unpaid invoices within the filtered period.
    SELECT COALESCE(SUM(CASE WHEN p_is_gross THEN amount_tax_included ELSE amount_tax_excluded END), 0)
    INTO v_outstanding
    FROM invoices
    WHERE invoice_date BETWEEN p_start_date AND p_end_date
      AND (status != 'Saldata' AND (payment_date IS NULL OR payment_date > p_end_date))
      AND status != 'Annullata'
      AND (p_client_id IS NULL OR client_id = p_client_id);

    -- Avg Days: Payment Date - Invoice Date for invoices PAID in this period
    SELECT COALESCE(AVG(payment_date - invoice_date), 0)
    INTO v_avg_days
    FROM invoices
    WHERE payment_date BETWEEN p_start_date AND p_end_date
      AND (status = 'Saldata' OR payment_date IS NOT NULL)
      AND status != 'Annullata'
      AND (p_client_id IS NULL OR client_id = p_client_id);

    RETURN json_build_object(
        'issued', v_issued,
        'collected', v_collected,
        'outstanding', v_outstanding,
        'avg_days', ROUND(v_avg_days, 1)
    );
END;
$$;


ALTER FUNCTION "public"."get_revenue_kpis"("p_start_date" "date", "p_end_date" "date", "p_client_id" "uuid", "p_is_gross" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_top_clients_revenue"("p_start_date" "date", "p_end_date" "date") RETURNS json
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(t) INTO v_result FROM (
        SELECT 
            c.business_name,
            c.id as client_id,
            SUM(CASE WHEN i.invoice_date BETWEEN p_start_date AND p_end_date THEN i.amount_tax_excluded ELSE 0 END) as issued,
            SUM(CASE WHEN i.payment_date BETWEEN p_start_date AND p_end_date AND (i.status = 'Saldata' OR i.payment_date IS NOT NULL) THEN i.amount_tax_excluded ELSE 0 END) as collected,
            -- Outstanding from invoices ISSUED in this period
            SUM(CASE WHEN i.invoice_date BETWEEN p_start_date AND p_end_date AND i.status != 'Saldata' THEN i.amount_tax_excluded ELSE 0 END) as outstanding
        FROM invoices i
        JOIN clients c ON i.client_id = c.id
        WHERE i.status != 'Annullata'
          AND (i.invoice_date BETWEEN p_start_date AND p_end_date OR i.payment_date BETWEEN p_start_date AND p_end_date)
        GROUP BY c.id, c.business_name
        HAVING SUM(CASE WHEN i.invoice_date BETWEEN p_start_date AND p_end_date THEN i.amount_tax_excluded ELSE 0 END) > 0 
            OR SUM(CASE WHEN i.payment_date BETWEEN p_start_date AND p_end_date AND (i.status = 'Saldata' OR i.payment_date IS NOT NULL) THEN i.amount_tax_excluded ELSE 0 END) > 0
        ORDER BY issued DESC
        LIMIT 10
    ) t;
    
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_top_clients_revenue"("p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_top_clients_revenue"("p_start_date" "date", "p_end_date" "date", "p_is_gross" boolean DEFAULT false) RETURNS json
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(t) INTO v_result FROM (
        SELECT
            c.business_name,
            c.id as client_id,
            SUM(CASE WHEN i.invoice_date BETWEEN p_start_date AND p_end_date THEN (CASE WHEN p_is_gross THEN i.amount_tax_included ELSE i.amount_tax_excluded END) ELSE 0 END) as issued,
            SUM(CASE WHEN i.payment_date BETWEEN p_start_date AND p_end_date AND (i.status = 'Saldata' OR i.payment_date IS NOT NULL) THEN (CASE WHEN p_is_gross THEN i.amount_tax_included ELSE i.amount_tax_excluded END) ELSE 0 END) as collected,
            -- Outstanding from invoices ISSUED in this period
            SUM(CASE WHEN i.invoice_date BETWEEN p_start_date AND p_end_date AND i.status != 'Saldata' THEN (CASE WHEN p_is_gross THEN i.amount_tax_included ELSE i.amount_tax_excluded END) ELSE 0 END) as outstanding
        FROM invoices i
        JOIN clients c ON i.client_id = c.id
        WHERE i.status != 'Annullata'
          AND (i.invoice_date BETWEEN p_start_date AND p_end_date OR i.payment_date BETWEEN p_start_date AND p_end_date)
        GROUP BY c.id, c.business_name
        HAVING SUM(CASE WHEN i.invoice_date BETWEEN p_start_date AND p_end_date THEN (CASE WHEN p_is_gross THEN i.amount_tax_included ELSE i.amount_tax_excluded END) ELSE 0 END) > 0
            OR SUM(CASE WHEN i.payment_date BETWEEN p_start_date AND p_end_date AND (i.status = 'Saldata' OR i.payment_date IS NOT NULL) THEN (CASE WHEN p_is_gross THEN i.amount_tax_included ELSE i.amount_tax_excluded END) ELSE 0 END) > 0
        ORDER BY issued DESC
        LIMIT 10
    ) t;

    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_top_clients_revenue"("p_start_date" "date", "p_end_date" "date", "p_is_gross" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unread_counts"() RETURNS TABLE("context_id" "uuid", "count" bigint, "type" "text", "last_read_message_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    curr_user_id uuid;
BEGIN
    curr_user_id := auth.uid();

    RETURN QUERY
    -- Channels
    SELECT 
        c.id as context_id,
        (
            SELECT count(*) 
            FROM public.messages m 
            WHERE m.channel_id = c.id 
            AND m.created_at > COALESCE(mr.last_read_at, '1970-01-01')
            AND m.deleted_at IS NULL
        ) as count,
        'channel' as type,
        mr.last_read_message_id
    FROM public.channels c
    LEFT JOIN public.channel_members cm ON c.id = cm.channel_id
    LEFT JOIN public.message_reads mr ON c.id = mr.channel_id AND mr.user_id = curr_user_id
    WHERE (c.is_private = false OR cm.user_id = curr_user_id)
    
    UNION ALL

    -- Conversations (DM/Group)
    SELECT 
        conv.id as context_id,
        (
            SELECT count(*) 
            FROM public.messages m 
            WHERE m.conversation_id = conv.id 
            AND m.created_at > COALESCE(mr.last_read_at, '1970-01-01')
            AND m.deleted_at IS NULL
        ) as count,
        'dm' as type,
        mr.last_read_message_id
    FROM public.conversations conv
    JOIN public.conversation_members cm ON conv.id = cm.conversation_id
    LEFT JOIN public.message_reads mr ON conv.id = mr.conversation_id AND mr.user_id = curr_user_id
    WHERE cm.user_id = curr_user_id;

END;
$$;


ALTER FUNCTION "public"."get_unread_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_author_name text;
    v_recipient_id uuid;
    v_title text;
    v_message_body text;
    v_parent_author_id uuid;
BEGIN
    -- Skip if deleted (though insert shouldn't start deleted)
    IF NEW.deleted_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Get author email/name (using auth.users or profiles?)
    -- Ideally profiles, but let's check auth.users via a known trick or just use "Someone" if strictly inside DB without helper.
    -- Better: Use profiles table if available.
    SELECT email INTO v_author_name FROM auth.users WHERE id = NEW.author_id;
    -- Fallback or refine
    v_author_name := COALESCE(v_author_name, 'Un utente');

    v_message_body := substring(NEW.body from 1 for 100); -- Truncate

    -- 1. Direct Messages & Group Conversations
    IF NEW.conversation_id IS NOT NULL THEN
        -- Notify all OTHER members of the conversation
        FOR v_recipient_id IN 
            SELECT user_id FROM public.conversation_members 
            WHERE conversation_id = NEW.conversation_id 
            AND user_id != NEW.author_id
        LOOP
            INSERT INTO public.notifications (
                user_id, 
                type, 
                title, 
                message, 
                data,
                channel_web,
                channel_email, -- Maybe false for chat spam? Let's default to false for now or true depending on preference.
                email_status
            ) VALUES (
                v_recipient_id,
                'chat_dm',
                'Nuovo messaggio da ' || v_author_name,
                v_message_body,
                jsonb_build_object(
                    'context_id', NEW.conversation_id,
                    'message_id', NEW.id,
                    'type', 'conversation'
                ),
                true, -- Web
                false, -- Email off by default for chat
                'none'
            );
        END LOOP;
        
    -- 2. Thread Replies (in Channels)
    ELSIF NEW.channel_id IS NOT NULL AND NEW.parent_message_id IS NOT NULL THEN
        -- Notify the author of the parent message
        SELECT author_id INTO v_parent_author_id FROM public.messages WHERE id = NEW.parent_message_id;
        
        -- Only notify if parent author is different from replier
        IF v_parent_author_id IS NOT NULL AND v_parent_author_id != NEW.author_id THEN
            INSERT INTO public.notifications (
                user_id, 
                type, 
                title, 
                message, 
                data,
                channel_web,
                channel_email,
                email_status
            ) VALUES (
                v_parent_author_id,
                'chat_reply',
                'Nuova risposta da ' || v_author_name,
                v_message_body,
                jsonb_build_object(
                    'context_id', NEW.channel_id,
                    'message_id', NEW.id,
                    'parent_id', NEW.parent_message_id,
                    'type', 'channel'
                ),
                true,
                false,
                'none'
            );
        END IF;
    END IF;

    -- Mentions (Simple Regex MVP): Look for @user_uuid? 
    -- Too complex for SQL regex to be robust for names. 
    -- Assuming frontend sends mentions in metadata or we skip for sprint 5.
    -- Skipping mentions for Sprint 5 as per plan.

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, email, full_name, role, is_onboarded)
  values (new.id, new.email, split_part(new.email, '@', 1), 'collaborator', false)
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$;


ALTER FUNCTION "public"."is_admin"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_member_of_channel"("chan_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE channel_id = chan_id AND user_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."is_member_of_channel"("chan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_member_of_conversation"("conv_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = conv_id AND user_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."is_member_of_conversation"("conv_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_payment_to_bank_transaction"("p_payment_id" "uuid", "p_bank_transaction_id" "uuid", "p_new_status" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  update public.payments
  set bank_transaction_id = p_bank_transaction_id,
      status = coalesce(p_new_status, status),
      updated_at = now()
  where id = p_payment_id
    and (bank_transaction_id is null or bank_transaction_id = p_bank_transaction_id);
end $$;


ALTER FUNCTION "public"."link_payment_to_bank_transaction"("p_payment_id" "uuid", "p_bank_transaction_id" "uuid", "p_new_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_message_read"("p_message_id" "uuid", "p_channel_id" "uuid" DEFAULT NULL::"uuid", "p_conversation_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_created_at timestamptz;
BEGIN
    -- Get message timestamp
    SELECT created_at INTO v_created_at FROM public.messages WHERE id = p_message_id;
    
    IF v_created_at IS NULL THEN
        RAISE EXCEPTION 'Message not found';
    END IF;

    -- Upsert into message_reads
    INSERT INTO public.message_reads (user_id, channel_id, conversation_id, last_read_message_id, last_read_at)
    VALUES (auth.uid(), p_channel_id, p_conversation_id, p_message_id, v_created_at)
    ON CONFLICT (user_id, channel_id) WHERE channel_id IS NOT NULL 
    DO UPDATE SET 
        last_read_message_id = EXCLUDED.last_read_message_id,
        last_read_at = EXCLUDED.last_read_at
        WHERE message_reads.last_read_at < EXCLUDED.last_read_at; -- Only update forward
        
    -- Handle Separate Unique constraints... actually we have 2 unique constraints.
    -- Postgres ON CONFLICT requires specific constraint name or column list.
    -- "unique (user_id, channel_id)" and "unique (user_id, conversation_id)"
    -- We need separate statements or a smarter upsert.
    
    -- Let's retry with separate blocks to be safe.
    IF p_channel_id IS NOT NULL THEN
        INSERT INTO public.message_reads (user_id, channel_id, last_read_message_id, last_read_at)
        VALUES (auth.uid(), p_channel_id, p_message_id, v_created_at)
        ON CONFLICT (user_id, channel_id) 
        DO UPDATE SET 
            last_read_message_id = EXCLUDED.last_read_message_id,
            last_read_at = EXCLUDED.last_read_at
            WHERE message_reads.last_read_at < EXCLUDED.last_read_at;
    ELSIF p_conversation_id IS NOT NULL THEN
        INSERT INTO public.message_reads (user_id, conversation_id, last_read_message_id, last_read_at)
        VALUES (auth.uid(), p_conversation_id, p_message_id, v_created_at)
        ON CONFLICT (user_id, conversation_id)
        DO UPDATE SET 
            last_read_message_id = EXCLUDED.last_read_message_id,
            last_read_at = EXCLUDED.last_read_at
             WHERE message_reads.last_read_at < EXCLUDED.last_read_at;
    END IF;
END;
$$;


ALTER FUNCTION "public"."mark_message_read"("p_message_id" "uuid", "p_channel_id" "uuid", "p_conversation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_invoice_ref"("p" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select nullif(
    regexp_replace(
      upper(
        replace(replace(replace(trim(coalesce(p,'')), '-', '/'), ' ', ''), '.', '')
      ),
      '[^A-Z0-9/]',
      '',
      'g'
    ),
    ''
  );
$$;


ALTER FUNCTION "public"."normalize_invoice_ref"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_collaborator_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_booking record;
    v_collab record;
    v_item_name TEXT;
    v_guest_name TEXT;
    v_company_name TEXT := 'Gleeye';
    v_title TEXT;
    v_body TEXT;
    v_debug_id UUID;
BEGIN
    -- Log Entry
    INSERT INTO debug_logs (function_name, message, details)
    VALUES ('notify_collaborator_assignment', 'Trigger Fired', jsonb_build_object('assignment_id', NEW.id, 'booking_id', NEW.booking_id, 'collaborator_id', NEW.collaborator_id));
    
    -- Fetch booking details
    SELECT * INTO v_booking FROM bookings WHERE id = NEW.booking_id;
    
    -- If no booking found (orphan assignment?), exit gracefully
    IF NOT FOUND THEN
        INSERT INTO debug_logs (function_name, message, details)
        VALUES ('notify_collaborator_assignment', 'Booking NOT FOUND', jsonb_build_object('booking_id', NEW.booking_id));
        RETURN NEW;
    END IF;
    
    -- Fetch collaborator details (to get user_id)
    SELECT * INTO v_collab FROM collaborators WHERE id = NEW.collaborator_id;
    
    -- If no collaborator found, exit gracefully
    IF NOT FOUND THEN
        INSERT INTO debug_logs (function_name, message, details)
        VALUES ('notify_collaborator_assignment', 'Collaborator NOT FOUND', jsonb_build_object('collaborator_id', NEW.collaborator_id));
        RETURN NEW;
    END IF;
    
    -- Fetch item name (if linked)
    IF v_booking.booking_item_id IS NOT NULL THEN
        SELECT name INTO v_item_name FROM booking_items WHERE id = v_booking.booking_item_id;
    END IF;
    
    -- Construct guest name from JSON
    v_guest_name := COALESCE(
        (v_booking.guest_info::jsonb->>'first_name') || ' ' || (v_booking.guest_info::jsonb->>'last_name'),
        'Cliente'
    );
    
    -- Construct Message Content
    v_title := 'Nuova prenotazione - ' || v_company_name;
    v_body := format('%s ha prenotato %s per il %s alle %s', 
               v_guest_name,
               COALESCE(v_item_name, 'un servizio'), 
               to_char(v_booking.start_time AT TIME ZONE 'Europe/Rome', 'DD/MM/YYYY'),
               to_char(v_booking.start_time AT TIME ZONE 'Europe/Rome', 'HH24:MI')
    );

    INSERT INTO debug_logs (function_name, message, details)
    VALUES ('notify_collaborator_assignment', 'Preparing Insert', jsonb_build_object('guest', v_guest_name, 'user_id', v_collab.user_id));

    -- Insert notification linked to the specific collaborator
    INSERT INTO notifications (collaborator_id, user_id, type, title, message, data)
    VALUES (
        NEW.collaborator_id,
        v_collab.user_id,
        'booking_new',
        v_title,
        v_body,
        jsonb_build_object(
            'booking_id', NEW.booking_id,
            'assignment_id', NEW.id,
            'service_name', v_item_name,
            'guest_name', v_guest_name,
            'guest_email', (v_booking.guest_info::jsonb->>'email')
        )
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Safety catch to prevent breaking the booking flow
    INSERT INTO debug_logs (function_name, message, details)
    VALUES ('notify_collaborator_assignment', 'EXCEPTION', jsonb_build_object('error', SQLERRM));
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_collaborator_assignment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."payment_invoice_link_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- When invoice_id is set and status is still 'Da Fare' or 'Invito Inviato', move to 'In Attesa'
    IF NEW.invoice_id IS NOT NULL AND OLD.invoice_id IS NULL THEN
        IF NEW.status IN ('Da Fare', 'Invito Inviato') THEN
            NEW.status := 'In Attesa';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."payment_invoice_link_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_bank_transaction"("p_tx_id" "uuid", "p_note" "text" DEFAULT NULL::"text") RETURNS "public"."bank_transactions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."reject_bank_transaction"("p_tx_id" "uuid", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_active_invoice_candidates"("refs" "text"[], "p_client_id" "uuid" DEFAULT NULL::"uuid", "p_amount" numeric DEFAULT NULL::numeric, "p_date" "date" DEFAULT NULL::"date", "min_score" double precision DEFAULT 0.35) RETURNS TABLE("active_invoice_id" "uuid", "score" double precision, "matched_ref" "text", "candidate_rank" integer)
    LANGUAGE "plpgsql" STABLE
    AS $_$
declare
  sql text;
begin
  sql :=
    'with cand_raw as ( '||
    '  select u.ref as ref, u.ord as ord, public.normalize_invoice_ref(u.ref) as ref_norm '||
    '  from unnest($1) with ordinality u(ref, ord) '||
    '  where u.ref is not null and length(trim(u.ref)) > 1 '||
    '), cand as ( '||
    '  select ref, ord, ref_norm from cand_raw '||
    '  union all '||
    '  select ref, ord, (substr(ref_norm,1,2) || ''/'' || substr(ref_norm,3,2)) as ref_norm '||
    '  from cand_raw '||
    '  where ref_norm ~ ''^[0-9]{4}$'' '||
    '), src as ( '||
    '  select i.id as active_invoice_id, i.invoice_number_search as row_ref_norm, '||
    '         i.amount_tax_included::numeric as row_amount, '||
    '         i.invoice_date::date as row_invoice_date, '||
    '         i.payment_date::date as row_payment_date, '||
    '         i.client_id '||
    '  from public.invoices i '||
    '  where 1=1 '||
    '    and ($2::uuid is null or i.client_id = $2) '||
    ') '||
    'select active_invoice_id, score, matched_ref, candidate_rank '||
    'from ( '||
    '  select s.active_invoice_id, '||
    '         ( '||
    '           similarity(s.row_ref_norm, c.ref_norm)::double precision '||
    '           + case when s.row_ref_norm = c.ref_norm then 0.60 else 0 end '||
    '           + case when s.row_ref_norm like ''%''||c.ref_norm||''%'' or c.ref_norm like ''%''||s.row_ref_norm||''%'' then 0.15 else 0 end '||
    '           + case when $3 is not null and s.row_amount is not null and abs(s.row_amount - $3) <= 0.02 then 0.20 else 0 end '||
    '           + case when $4 is not null and s.row_payment_date is not null and s.row_payment_date = $4 then 0.15 else 0 end '||
    '           + case when $4 is not null and s.row_payment_date is null and s.row_invoice_date is not null and s.row_invoice_date = $4 then 0.07 else 0 end '||
    '         ) as score, '||
    '         c.ref as matched_ref, '||
    '         c.ord::int as candidate_rank '||
    '  from src s cross join cand c '||
    '  where s.row_ref_norm is not null and c.ref_norm is not null '||
    ') x '||
    'where x.score >= $5 '||
    'order by x.score desc, x.candidate_rank asc '||
    'limit 1';

  return query execute sql using refs, p_client_id, p_amount, p_date, min_score;
end $_$;


ALTER FUNCTION "public"."resolve_active_invoice_candidates"("refs" "text"[], "p_client_id" "uuid", "p_amount" numeric, "p_date" "date", "min_score" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_counterparty_candidates"("candidates" "text"[], "min_score" double precision DEFAULT 0.35) RETURNS TABLE("entity_type" "text", "entity_id" "uuid", "entity_name" "text", "score" double precision, "matched_candidate" "text", "candidate_rank" integer)
    LANGUAGE "plpgsql" STABLE
    AS $_$
declare
  supplier_expr text;
  client_expr text;
  collab_expr text;
  parts text[] := array[]::text[];
  sql text;
begin
  supplier_expr := public._name_expr('suppliers', 's');
  client_expr   := public._name_expr('clients', 'c');
  collab_expr   := public._name_expr('collaborators', 'co');

  if supplier_expr is not null then
    parts := parts || format($f$
      select
        'supplier'::text as entity_type,
        s.id as entity_id,
        (%s)::text as entity_name,
        similarity(unaccent(lower((%s)::text)), cand.qq)::double precision as score,
        cand.cand as matched_candidate,
        cand.ord::int as candidate_rank
      from public.suppliers s
      cross join cand
      where similarity(unaccent(lower((%s)::text)), cand.qq)::double precision >= $2
    $f$, supplier_expr, supplier_expr, supplier_expr);
  end if;

  if client_expr is not null then
    parts := parts || format($f$
      select
        'client'::text as entity_type,
        c.id as entity_id,
        (%s)::text as entity_name,
        similarity(unaccent(lower((%s)::text)), cand.qq)::double precision as score,
        cand.cand as matched_candidate,
        cand.ord::int as candidate_rank
      from public.clients c
      cross join cand
      where similarity(unaccent(lower((%s)::text)), cand.qq)::double precision >= $2
    $f$, client_expr, client_expr, client_expr);
  end if;

  if collab_expr is not null then
    parts := parts || format($f$
      select
        'collaborator'::text as entity_type,
        co.id as entity_id,
        (%s)::text as entity_name,
        similarity(unaccent(lower((%s)::text)), cand.qq)::double precision as score,
        cand.cand as matched_candidate,
        cand.ord::int as candidate_rank
      from public.collaborators co
      cross join cand
      where similarity(unaccent(lower((%s)::text)), cand.qq)::double precision >= $2
    $f$, collab_expr, collab_expr, collab_expr);
  end if;

  if array_length(parts, 1) is null then
    return;
  end if;

  sql :=
    'with cand as ( '||
    '  select u.cand, u.ord, unaccent(lower(trim(u.cand))) as qq '||
    '  from unnest($1) with ordinality u(cand, ord) '||
    '  where u.cand is not null and length(trim(u.cand)) > 1 '||
    ') '||
    'select * from ('|| array_to_string(parts, ' union all ') ||') x '||
    'order by 4 desc, 6 asc '||
    'limit 1';

  return query execute sql using candidates, min_score;
end $_$;


ALTER FUNCTION "public"."resolve_counterparty_candidates"("candidates" "text"[], "min_score" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_passive_invoice_candidates"("refs" "text"[], "p_supplier_id" "uuid" DEFAULT NULL::"uuid", "p_collaborator_id" "uuid" DEFAULT NULL::"uuid", "p_amount" numeric DEFAULT NULL::numeric, "p_date" "date" DEFAULT NULL::"date", "min_score" double precision DEFAULT 0.35) RETURNS TABLE("passive_invoice_id" "uuid", "score" double precision, "matched_ref" "text", "candidate_rank" integer)
    LANGUAGE "plpgsql" STABLE
    AS $_$
declare
  sql text;
begin
  sql :=
    'with cand_raw as ( '||
    '  select u.ref as ref, u.ord as ord, public.normalize_invoice_ref(u.ref) as ref_norm '||
    '  from unnest($1) with ordinality u(ref, ord) '||
    '  where u.ref is not null and length(trim(u.ref)) > 1 '||
    '), cand as ( '||
    '  select ref, ord, ref_norm from cand_raw '||
    '  union all '||
    '  select ref, ord, (substr(ref_norm,1,2) || ''/'' || substr(ref_norm,3,2)) as ref_norm '||
    '  from cand_raw '||
    '  where ref_norm ~ ''^[0-9]{4}$'' '||
    '), src as ( '||
    '  select pi.id as passive_invoice_id, pi.invoice_number_search as row_ref_norm, '||
    '         pi.amount_tax_included::numeric as row_amount, '||
    '         pi.issue_date::date as row_issue_date, '||
    '         pi.payment_date::date as row_payment_date, '||
    '         pi.supplier_id, pi.collaborator_id '||
    '  from public.passive_invoices pi '||
    '  where 1=1 '||
    '    and ($2::uuid is null or pi.supplier_id = $2) '||
    '    and ($3::uuid is null or pi.collaborator_id = $3) '||
    ') '||
    'select passive_invoice_id, score, matched_ref, candidate_rank '||
    'from ( '||
    '  select s.passive_invoice_id, '||
    '         ( similarity(s.row_ref_norm, c.ref_norm)::double precision '||
    '           + case when s.row_ref_norm = c.ref_norm then 0.60 else 0 end '||
    '           + case when s.row_ref_norm like ''%''||c.ref_norm||''%'' or c.ref_norm like ''%''||s.row_ref_norm||''%'' then 0.15 else 0 end '||
    '           + case when $4 is not null and s.row_amount is not null and abs(s.row_amount - $4) <= 0.02 then 0.20 else 0 end '||
    '           + case when $5 is not null and s.row_payment_date is not null and s.row_payment_date = $5 then 0.15 else 0 end '||
    '           + case when $5 is not null and s.row_payment_date is null and s.row_issue_date is not null and s.row_issue_date = $5 then 0.07 else 0 end '||
    '         ) as score, '||
    '         c.ref as matched_ref, '||
    '         c.ord::int as candidate_rank '||
    '  from src s cross join cand c '||
    '  where s.row_ref_norm is not null and c.ref_norm is not null '||
    ') x '||
    'where x.score >= $6 '||
    'order by x.score desc, x.candidate_rank asc '||
    'limit 1';

  return query execute sql using refs, p_supplier_id, p_collaborator_id, p_amount, p_date, min_score;
end $_$;


ALTER FUNCTION "public"."resolve_passive_invoice_candidates"("refs" "text"[], "p_supplier_id" "uuid", "p_collaborator_id" "uuid", "p_amount" numeric, "p_date" "date", "min_score" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_payment_candidates"("p_bank_transaction_id" "uuid", "p_days_window" integer DEFAULT 30, "min_score" double precision DEFAULT 0.35) RETURNS TABLE("payment_id" "uuid", "score" double precision, "reason" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $$
declare
  tx record;
begin
  select *
  into tx
  from public.bank_transactions
  where id = p_bank_transaction_id;

  if not found then
    return;
  end if;

  return query
  with candidates as (
    select
      p.id as payment_id,

      (
        -- 1) match fattura (fortissimo)
        (case when tx.active_invoice_id is not null and p.invoice_id = tx.active_invoice_id then 2.0 else 0 end) +
        (case when tx.passive_invoice_id is not null and p.passive_invoice_id = tx.passive_invoice_id then 2.0 else 0 end) +

        -- 2) match controparte
        (case when tx.client_id is not null and p.client_id = tx.client_id then 0.9 else 0 end) +
        (case when tx.supplier_id is not null and p.supplier_id = tx.supplier_id then 0.9 else 0 end) +
        (case when tx.collaborator_id is not null and p.collaborator_id = tx.collaborator_id then 0.9 else 0 end) +

        -- 3) importo
        (case when abs(p.amount - tx.amount) <= 0.02 then 0.6
              when abs(p.amount - tx.amount) <= 1.00 then 0.25
              else 0 end) +

        -- 4) vicinanza a due_date (se presente)
        (case
          when p.due_date is null then 0
          else greatest(
                 0.0,
                 0.45 - (abs((p.due_date - tx.date))::double precision / p_days_window::double precision) * 0.45
               )
         end) +

        -- 5) coerenza payment_type con direzione
        -- (assumo tx.type = 'Entrata'/'Uscita' come stai usando tu)
        (case
          when tx.type ilike 'entrata' and p.payment_type ilike 'cliente' then 0.15
          when tx.type ilike 'uscita' and p.payment_type ilike 'cliente' then -0.10
          else 0
         end)
      )::double precision as score,

      jsonb_build_object(
        'tx_date', tx.date,
        'tx_amount', tx.amount,
        'tx_type', tx.type,
        'match_invoice', (tx.active_invoice_id is not null and p.invoice_id = tx.active_invoice_id),
        'match_passive_invoice', (tx.passive_invoice_id is not null and p.passive_invoice_id = tx.passive_invoice_id),
        'match_client', (tx.client_id is not null and p.client_id = tx.client_id),
        'match_supplier', (tx.supplier_id is not null and p.supplier_id = tx.supplier_id),
        'match_collaborator', (tx.collaborator_id is not null and p.collaborator_id = tx.collaborator_id),
        'amount_delta', abs(p.amount - tx.amount),
        'due_date', p.due_date,
        'payment_type', p.payment_type,
        'title', p.title
      ) as reason

    from public.payments p
    where p.bank_transaction_id is null
      and (p.status is null or p.status <> 'Done')
      and (p.due_date is null or p.due_date between (tx.date - p_days_window) and (tx.date + p_days_window))
      and (
        -- Deve avere almeno UN aggancio sensato:
        (tx.active_invoice_id is not null and p.invoice_id = tx.active_invoice_id) or
        (tx.passive_invoice_id is not null and p.passive_invoice_id = tx.passive_invoice_id) or
        (tx.client_id is not null and p.client_id = tx.client_id) or
        (tx.supplier_id is not null and p.supplier_id = tx.supplier_id) or
        (tx.collaborator_id is not null and p.collaborator_id = tx.collaborator_id) or
        abs(p.amount - tx.amount) <= 1.00
      )
  )
  select c.payment_id, c.score, c.reason
  from candidates c
  where c.score >= min_score
  order by c.score desc
  limit 5;
end $$;


ALTER FUNCTION "public"."resolve_payment_candidates"("p_bank_transaction_id" "uuid", "p_days_window" integer, "min_score" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."safe_numeric"("val" "anyelement") RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
    RETURN COALESCE(val::numeric, 0);
EXCEPTION WHEN OTHERS THEN
    RETURN 0;
END;
$$;


ALTER FUNCTION "public"."safe_numeric"("val" "anyelement") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_messages"("query_text" "text", "limit_val" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "body" "text", "created_at" timestamp with time zone, "author_id" "uuid", "channel_id" "uuid", "conversation_id" "uuid", "rank" real)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.body,
        m.created_at,
        m.author_id,
        m.channel_id,
        m.conversation_id,
        ts_rank(m.fts, websearch_to_tsquery('english', query_text)) as rank
    FROM public.messages m
    WHERE m.fts @@ websearch_to_tsquery('english', query_text)
    AND m.deleted_at IS NULL
    -- RLS is usually bypassed in SECURITY DEFINER functions, 
    -- so we MUST filter manually for security!
    AND (
        (m.channel_id IS NOT NULL AND (
             EXISTS (SELECT 1 FROM public.channels c WHERE c.id = m.channel_id AND c.is_private = false) OR
             EXISTS (SELECT 1 FROM public.channel_members cm WHERE cm.channel_id = m.channel_id AND cm.user_id = auth.uid())
        )) OR
        (m.conversation_id IS NOT NULL AND (
             EXISTS (SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id = m.conversation_id AND cm.user_id = auth.uid())
        ))
    )
    ORDER BY rank DESC, m.created_at DESC
    LIMIT limit_val;
END;
$$;


ALTER FUNCTION "public"."search_messages"("query_text" "text", "limit_val" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text",
    "due_date" "date",
    "amount" numeric(10,2),
    "status" "text",
    "payment_type" "text",
    "payment_mode" "text",
    "notes" "text",
    "order_id" "uuid",
    "assignment_id" "text",
    "client_id" "uuid",
    "collaborator_id" "uuid",
    "supplier_id" "uuid",
    "invoice_id" "uuid",
    "passive_invoice_id" "uuid",
    "res_partner_request" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "transaction_id" "uuid",
    "bank_transaction_id" "uuid",
    "type" "text" DEFAULT 'passive'::"text",
    "invited_at" timestamp with time zone
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_payment_invite"("p_payment_id" "uuid", "p_webhook_url" "text" DEFAULT NULL::"text") RETURNS "public"."payments"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."send_payment_invite"("p_payment_id" "uuid", "p_webhook_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_profile_name"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF NEW.user_id IS NOT NULL THEN
        UPDATE public.profiles
        SET full_name = NEW.full_name
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_profile_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_process_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM
    net.http_post(
      url := 'https://whpbetjyhpttinbxcffs.supabase.co/functions/v1/process-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_process_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_sync_google_calendar"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  request_id BIGINT;
BEGIN
  -- Call the Edge Function via pg_net
  -- URL: https://whpbetjyhpttinbxcffs.supabase.co/functions/v1/sync-google-calendar
  -- We send the NEW record as payload
  SELECT net.http_post(
    url := 'https://whpbetjyhpttinbxcffs.supabase.co/functions/v1/sync-google-calendar',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := json_build_object(
        'record', row_to_json(NEW),
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA
    )::jsonb
  ) INTO request_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_sync_google_calendar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unlink_payment_from_bank_transaction"("p_payment_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  update public.payments
  set bank_transaction_id = null,
      updated_at = now()
  where id = p_payment_id;
end $$;


ALTER FUNCTION "public"."unlink_payment_from_bank_transaction"("p_payment_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointment_client_participants" (
    "appointment_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "required" boolean DEFAULT true,
    "added_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."appointment_client_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointment_google_sync" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_id" "uuid",
    "user_id" "uuid",
    "google_event_id" "text" NOT NULL,
    "google_calendar_id" "text" NOT NULL,
    "last_synced_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'synced'::"text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "appointment_google_sync_status_check" CHECK (("status" = ANY (ARRAY['synced'::"text", 'error'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."appointment_google_sync" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointment_internal_participants" (
    "appointment_id" "uuid" NOT NULL,
    "collaborator_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'participant'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "required" boolean DEFAULT true,
    "added_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."appointment_internal_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointment_type_links" (
    "appointment_id" "uuid" NOT NULL,
    "type_id" "uuid" NOT NULL
);


ALTER TABLE "public"."appointment_type_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointment_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#3b82f6'::"text",
    "icon" "text" DEFAULT 'event'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."appointment_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "note" "text",
    "status" "text" DEFAULT 'bozza'::"text",
    "mode" "text" DEFAULT 'remoto'::"text",
    "location" "text",
    "order_id" "uuid",
    "client_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "pm_space_id" "uuid",
    CONSTRAINT "appointments_mode_check" CHECK (("mode" = ANY (ARRAY['remoto'::"text", 'in_presenza'::"text"]))),
    CONSTRAINT "appointments_status_check" CHECK (("status" = ANY (ARRAY['bozza'::"text", 'confermato'::"text", 'annullato'::"text"])))
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignments" (
    "id" "text" NOT NULL,
    "legacy_id" "text",
    "order_id" "uuid",
    "collaborator_id" "uuid",
    "description" "text",
    "status" "text",
    "start_date" "date",
    "total_amount" numeric(10,2),
    "payment_terms" "text",
    "payment_details" "text",
    "pm_notes" "text",
    "drive_link" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "payment_mode" "text" DEFAULT 'saldo'::"text",
    "deposit_percentage" numeric DEFAULT 0,
    "installments_count" integer DEFAULT 1,
    "installment_type" "text" DEFAULT 'Mensile'::"text",
    "balance_percentage" numeric DEFAULT 0,
    "contract_duration_months" integer DEFAULT 12,
    "order_number" "text",
    "client_code" "text"
);


ALTER TABLE "public"."assignments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."assignments"."contract_duration_months" IS 'Duration of the assignment in months';



COMMENT ON COLUMN "public"."assignments"."order_number" IS 'Denormalized order number for easier lookup';



COMMENT ON COLUMN "public"."assignments"."client_code" IS 'Denormalized client code for easier lookup';



CREATE TABLE IF NOT EXISTS "public"."availability_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "collaborator_id" "uuid",
    "date" "date" NOT NULL,
    "is_available" boolean DEFAULT true NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "end_date" "date",
    "booking_item_id" "uuid",
    "is_on_call" boolean DEFAULT false,
    "service_ids" "uuid"[]
);


ALTER TABLE "public"."availability_overrides" OWNER TO "postgres";


COMMENT ON TABLE "public"."availability_overrides" IS 'Specific date-based availability slots for collaborators v2';



CREATE TABLE IF NOT EXISTS "public"."availability_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "collaborator_id" "uuid",
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "service_id" "uuid",
    "service_ids" "uuid"[],
    "is_on_call" boolean DEFAULT false,
    CONSTRAINT "availability_rules_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."availability_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bank_statements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "statement_date" "date",
    "balance" numeric(15,2),
    "attachment_name" "text",
    "attachment_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bank_statements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_assignments" (
    "booking_id" "uuid" NOT NULL,
    "collaborator_id" "uuid" NOT NULL,
    "role_in_order" "text" DEFAULT 'Collaborator'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."booking_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "parent_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."booking_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_holds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "booking_item_id" "uuid",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "session_id" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."booking_holds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_item_collaborators" (
    "booking_item_id" "uuid" NOT NULL,
    "collaborator_id" "uuid" NOT NULL,
    "priority" integer DEFAULT 0
);


ALTER TABLE "public"."booking_item_collaborators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2),
    "duration_minutes" integer DEFAULT 60,
    "buffer_minutes" integer DEFAULT 0,
    "logic_type" "public"."service_logic_type" DEFAULT 'OR'::"public"."service_logic_type",
    "team_size_req" integer DEFAULT 1,
    "is_active" boolean DEFAULT true,
    "category_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "location_type" "text" DEFAULT 'in_person'::"text",
    "payment_required" boolean DEFAULT false,
    "location_address" "text",
    "max_advance_days" integer DEFAULT 60,
    "min_notice_minutes" integer DEFAULT 1440,
    "cancellation_policy" "text" DEFAULT 'standard'::"text",
    "buffer_before_minutes" integer DEFAULT 0,
    "buffer_after_minutes" integer DEFAULT 0,
    "requires_confirmation" boolean DEFAULT false,
    "recurrence_rule" "text" DEFAULT 'none'::"text",
    "assignment_logic" "public"."assignment_logic_type" DEFAULT 'OR'::"public"."assignment_logic_type",
    "required_team_size" integer DEFAULT 1
);


ALTER TABLE "public"."booking_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "booking_item_id" "uuid",
    "user_id" "uuid",
    "guest_info" "jsonb",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "status" "public"."booking_status" DEFAULT 'confirmed'::"public"."booking_status",
    "google_event_id" "text",
    "notes" "text"
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channel_members" (
    "channel_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text",
    "joined_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."channel_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "is_private" boolean DEFAULT false,
    "topic" "text",
    "description" "text",
    "is_archived" boolean DEFAULT false,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "first_name" "text",
    "last_name" "text",
    "email" "text",
    "phone" "text",
    "role" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_name" "text" NOT NULL,
    "vat_number" "text",
    "fiscal_code" "text",
    "address" "text",
    "city" "text",
    "is_potential" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "airtable_id" "text",
    "dropbox_folder" "text",
    "client_code" "text",
    "zip_code" "text",
    "sdi_code" "text",
    "pec" "text",
    "phone" "text",
    "province" "text",
    "email" "text",
    "business_name_search" "text"
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collaborator_google_auth" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "collaborator_id" "uuid" NOT NULL,
    "access_token" "text",
    "refresh_token" "text",
    "expires_at" timestamp with time zone,
    "selected_calendars" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."collaborator_google_auth" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collaborator_rest_days" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "collaborator_id" "uuid",
    "name" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "repeat_annually" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."collaborator_rest_days" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collaborator_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "order_id" "uuid",
    "service_id" "uuid",
    "collaborator_id" "uuid",
    "legacy_order_id" "text",
    "legacy_service_name" "text",
    "legacy_collaborator_name" "text",
    "department" "text",
    "tariff_type" "text",
    "quantity" numeric,
    "hours" numeric,
    "months" numeric,
    "spot_quantity" numeric,
    "unit_cost" numeric,
    "unit_price" numeric,
    "total_cost" numeric,
    "total_price" numeric,
    "status_work" "text",
    "status_offer" "text",
    "notes" "text",
    "airtable_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "assignment_id" "text"
);


ALTER TABLE "public"."collaborator_services" OWNER TO "postgres";


COMMENT ON COLUMN "public"."collaborator_services"."assignment_id" IS 'Link to the specific assignment (Incarico) this service belongs to';



CREATE TABLE IF NOT EXISTS "public"."collaborators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "first_name" "text",
    "last_name" "text",
    "full_name" "text",
    "role" "text",
    "tags" "text",
    "email" "text",
    "phone" "text",
    "vat_number" "text",
    "fiscal_code" "text",
    "address" "text",
    "birth_date" "date",
    "birth_place" "text",
    "airtable_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "pec" "text",
    "address_cap" "text",
    "address_city" "text",
    "address_province" "text",
    "avatar_url" "text",
    "user_id" "uuid",
    "is_active" boolean DEFAULT true,
    "full_name_search" "text",
    "iban" "text",
    "bank_name" "text",
    "document_id_front_url" "text",
    "document_id_back_url" "text",
    "document_health_card_url" "text",
    "document_health_card_back_url" "text",
    "city" "text",
    "province" "text",
    "cap" "text"
);


ALTER TABLE "public"."collaborators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "first_name" "text",
    "last_name" "text",
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "mobile" "text",
    "role" "text",
    "airtable_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_members" (
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversation_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "conversations_type_check" CHECK (("type" = ANY (ARRAY['dm'::"text", 'group'::"text"])))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debug_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "function_name" "text" NOT NULL,
    "message" "text" NOT NULL,
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "level" "text" DEFAULT 'info'::"text",
    "is_resolved" boolean DEFAULT false
);


ALTER TABLE "public"."debug_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#4e92d8'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."external_busy_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "collaborator_id" "uuid",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "source" "text",
    "description" "text"
);


ALTER TABLE "public"."external_busy_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."external_calendar_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "collaborator_id" "uuid",
    "provider" "public"."calendar_provider" NOT NULL,
    "email" "text",
    "access_token" "text",
    "refresh_token" "text",
    "expires_at" timestamp with time zone,
    "calendar_id" "text" DEFAULT 'primary'::"text",
    "ics_url" "text",
    "last_synced_at" timestamp with time zone
);


ALTER TABLE "public"."external_calendar_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "movement_code" "text",
    "amount" numeric(15,2),
    "movement_date" "date",
    "description" "text",
    "type" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."finance_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_movements" (
    "invoice_id" "uuid" NOT NULL,
    "movement_id" "uuid" NOT NULL
);


ALTER TABLE "public"."invoice_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid",
    "order_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invoice_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_payments" (
    "invoice_id" "uuid" NOT NULL,
    "payment_id" "uuid" NOT NULL
);


ALTER TABLE "public"."invoice_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_number" "text",
    "invoice_date" "date",
    "client_id" "uuid",
    "order_id" "uuid",
    "title" "text",
    "amount_tax_excluded" numeric(15,2),
    "tax_amount" numeric(15,2),
    "amount_tax_included" numeric(15,2),
    "status" "text",
    "payment_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "vat_eligibility" "text",
    "vat_rate" numeric(5,2),
    "expenses_client_account" boolean DEFAULT false,
    "invoice_number_search" "text"
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


COMMENT ON COLUMN "public"."invoices"."vat_eligibility" IS 'Esigibilità IVA: "Scissione dei pagamenti" o "Iva ad esigibilità immediata"';



CREATE TABLE IF NOT EXISTS "public"."message_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid",
    "file_path" "text" NOT NULL,
    "file_type" "text",
    "file_size" bigint,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."message_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_reads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "channel_id" "uuid",
    "conversation_id" "uuid",
    "last_read_message_id" "uuid",
    "last_read_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "read_target_check" CHECK (((("channel_id" IS NOT NULL) AND ("conversation_id" IS NULL)) OR (("channel_id" IS NULL) AND ("conversation_id" IS NOT NULL))))
);


ALTER TABLE "public"."message_reads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid",
    "channel_id" "uuid",
    "conversation_id" "uuid",
    "body" "text",
    "format" "text" DEFAULT 'plain'::"text",
    "parent_message_id" "uuid",
    "edited_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "fts" "tsvector" GENERATED ALWAYS AS ("to_tsvector"('"english"'::"regconfig", COALESCE("body", ''::"text"))) STORED,
    CONSTRAINT "message_target_check" CHECK (((("channel_id" IS NOT NULL) AND ("conversation_id" IS NULL)) OR (("channel_id" IS NULL) AND ("conversation_id" IS NOT NULL))))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "label_it" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'general'::"text",
    "default_email" boolean DEFAULT true,
    "default_web" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "email_subject_template" "text",
    "email_body_template" "text",
    "variables_schema" "jsonb" DEFAULT '[]'::"jsonb",
    "email_subject_template_guest" "text",
    "email_body_template_guest" "text",
    "default_email_guest" boolean DEFAULT true
);


ALTER TABLE "public"."notification_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "collaborator_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text",
    "data" "jsonb",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "channel_email" boolean DEFAULT false,
    "channel_web" boolean DEFAULT true,
    "email_status" "text" DEFAULT 'none'::"text",
    "email_error" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_collaborators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "collaborator_id" "uuid",
    "role_in_order" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."order_collaborators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "contact_id" "uuid",
    "role" "text" DEFAULT 'Referente'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."order_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "service_title" "text",
    "quantity" numeric(10,2) DEFAULT 1,
    "unit_price" numeric(12,2),
    "unit_cost" numeric(12,2),
    "assigned_to" "uuid"
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_number" "text" NOT NULL,
    "client_id" "uuid",
    "pm_id" "uuid",
    "title" "text",
    "status_sales" "text" DEFAULT 'draft'::"text",
    "total_price" numeric(12,2) DEFAULT 0,
    "total_cost" numeric(12,2) DEFAULT 0,
    "delivery_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "order_date" "date",
    "total_amount" numeric,
    "airtable_id" "text",
    "status_works" "text",
    "offer_status" "text",
    "price_planned" numeric,
    "price_actual" numeric,
    "cost_planned" numeric,
    "cost_actual" numeric,
    "revenue_planned" numeric,
    "revenue_actual" numeric,
    "payment_mode" "text" DEFAULT 'saldo'::"text",
    "deposit_percentage" numeric DEFAULT 0,
    "balance_percentage" numeric DEFAULT 0,
    "installment_type" "text" DEFAULT 'Mensile'::"text",
    "installments_count" integer DEFAULT 1,
    "contact_id" "uuid",
    "account_id" "uuid",
    "contract_duration" integer,
    "price_final" numeric(10,2),
    "cost_final" numeric(10,2),
    CONSTRAINT "orders_status_sales_check" CHECK (("status_sales" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'accepted'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."orders"."price_actual" IS 'Prezzi Finali storici da Airtable';



COMMENT ON COLUMN "public"."orders"."cost_actual" IS 'Costi Finali storici da Airtable';



COMMENT ON COLUMN "public"."orders"."contact_id" IS 'Referente dell''ordine (link a contacts)';



COMMENT ON COLUMN "public"."orders"."account_id" IS 'Account Gleeye responsabile dell''ordine (link a collaborators)';



COMMENT ON COLUMN "public"."orders"."contract_duration" IS 'Durata del contratto in mesi';



COMMENT ON COLUMN "public"."orders"."price_final" IS 'Prezzo finale corrente gestito dall''account';



COMMENT ON COLUMN "public"."orders"."cost_final" IS 'Costo finale corrente gestito dall''account';



CREATE TABLE IF NOT EXISTS "public"."passive_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_number" "text",
    "issue_date" "date",
    "due_date" "date",
    "payment_date" "date",
    "status" "text",
    "amount_tax_excluded" numeric(15,2),
    "tax_amount" numeric(15,2),
    "amount_tax_included" numeric(15,2),
    "supplier_id" "uuid",
    "collaborator_id" "uuid",
    "notes" "text",
    "category" "text",
    "related_orders" "text",
    "attachment_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "ritenuta" numeric(15,2) DEFAULT 0,
    "rivalsa_inps" numeric(15,2) DEFAULT 0,
    "iva_attiva" boolean DEFAULT false,
    "amount_paid" numeric(15,2) DEFAULT 0,
    "stamp_duty" numeric(15,2) DEFAULT 0,
    "invoice_number_search" "text",
    "description" "text",
    "service_description" "text",
    "vat_rate" numeric(5,2),
    "vat_eligibility" "text"
);


ALTER TABLE "public"."passive_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pm_item_assignees" (
    "pm_item_ref" "uuid" NOT NULL,
    "user_ref" "uuid",
    "role" "text" DEFAULT 'assignee'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "collaborator_ref" "uuid",
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."pm_item_assignees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pm_item_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pm_item_ref" "uuid" NOT NULL,
    "author_user_ref" "uuid",
    "body" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pm_item_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pm_item_incarichi" (
    "pm_item_ref" "uuid" NOT NULL,
    "incarico_ref" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pm_item_incarichi" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pm_item_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pm_item_ref" "uuid" NOT NULL,
    "linked_entity_type" "text" NOT NULL,
    "linked_entity_ref" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pm_item_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pm_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "space_ref" "uuid" NOT NULL,
    "parent_ref" "uuid",
    "item_type" "public"."pm_item_type" DEFAULT 'task'::"public"."pm_item_type" NOT NULL,
    "title" "text" NOT NULL,
    "notes" "text",
    "status" "text" DEFAULT 'todo'::"text",
    "priority" "text" DEFAULT 'medium'::"text",
    "impact" "text" DEFAULT 'medium'::"text",
    "start_date" timestamp with time zone,
    "due_date" timestamp with time zone,
    "pm_user_ref" "uuid",
    "created_by_user_ref" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "archived_at" timestamp with time zone
);


ALTER TABLE "public"."pm_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pm_space_assignees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pm_space_ref" "uuid" NOT NULL,
    "user_ref" "uuid",
    "collaborator_ref" "uuid",
    "role" "text" DEFAULT 'pm'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pm_space_assignees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pm_spaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "public"."pm_space_type" NOT NULL,
    "ref_ordine" "uuid",
    "name" "text",
    "default_pm_user_ref" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "area" "text",
    "is_cluster" boolean DEFAULT false,
    "parent_ref" "uuid"
);


ALTER TABLE "public"."pm_spaces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "email" "text",
    "role" "text" DEFAULT 'collaborator'::"text",
    "tags" "text"[],
    "avatar_url" "text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "is_onboarded" boolean DEFAULT false,
    "timezone" "text" DEFAULT 'Europe/Rome'::"text",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'pm'::"text", 'sales'::"text", 'collaborator'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid",
    "user_id" "uuid",
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "channel_id" "uuid",
    "conversation_id" "uuid"
);


ALTER TABLE "public"."reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "cost" numeric,
    "price" numeric,
    "margin" numeric,
    "margin_percent" numeric,
    "tags" "text"[],
    "type" "text",
    "details" "text",
    "notes" "text",
    "template_name" "text",
    "linked_service_ids" "text"[],
    "linked_collaborator_ids" "text"[],
    "airtable_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "organization_id" "uuid"
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "vat_number" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "archived" boolean DEFAULT false,
    "website" "text",
    "name_search" "text",
    "tax_code" "text",
    "address" "text",
    "city" "text",
    "zip_code" "text",
    "province" "text",
    "country" "text" DEFAULT 'IT'::"text",
    "fiscal_regime" "text" DEFAULT 'ordinario'::"text",
    "default_vat_rate" numeric(5,2) DEFAULT 22,
    "cassa_previdenziale_rate" numeric(5,2) DEFAULT 0,
    "withholding_tax_rate" numeric(5,2) DEFAULT 0,
    "payment_terms" "text",
    "bank_iban" "text"
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


COMMENT ON TABLE "public"."suppliers" IS 'Suppliers list (Refreshed)';



CREATE TABLE IF NOT EXISTS "public"."system_config" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid"
);


ALTER TABLE "public"."system_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "assigned_to" "uuid",
    "due_date" "date",
    "status" "text" DEFAULT 'todo'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['todo'::"text", 'doing'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaction_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text",
    "parent_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "transaction_categories_type_check" CHECK (("type" = ANY (ARRAY['entrata'::"text", 'uscita'::"text", 'altro'::"text"])))
);


ALTER TABLE "public"."transaction_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "notification_type_id" "uuid",
    "email_enabled" boolean DEFAULT true,
    "web_enabled" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_notification_preferences" OWNER TO "postgres";


ALTER TABLE ONLY "public"."appointment_client_participants"
    ADD CONSTRAINT "appointment_client_participants_pkey" PRIMARY KEY ("appointment_id", "contact_id");



ALTER TABLE ONLY "public"."appointment_google_sync"
    ADD CONSTRAINT "appointment_google_sync_appointment_id_user_id_key" UNIQUE ("appointment_id", "user_id");



ALTER TABLE ONLY "public"."appointment_google_sync"
    ADD CONSTRAINT "appointment_google_sync_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointment_internal_participants"
    ADD CONSTRAINT "appointment_internal_participants_pkey" PRIMARY KEY ("appointment_id", "collaborator_id");



ALTER TABLE ONLY "public"."appointment_type_links"
    ADD CONSTRAINT "appointment_type_links_pkey" PRIMARY KEY ("appointment_id", "type_id");



ALTER TABLE ONLY "public"."appointment_types"
    ADD CONSTRAINT "appointment_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."appointment_types"
    ADD CONSTRAINT "appointment_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_legacy_id_key" UNIQUE ("legacy_id");



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."availability_overrides"
    ADD CONSTRAINT "availability_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."availability_rules"
    ADD CONSTRAINT "availability_rules_collaborator_id_day_of_week_start_time_key" UNIQUE ("collaborator_id", "day_of_week", "start_time");



ALTER TABLE ONLY "public"."availability_rules"
    ADD CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_statements"
    ADD CONSTRAINT "bank_statements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_old_id_key" UNIQUE ("old_id");



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_statement_dedupe_uniq" UNIQUE ("statement_id", "dedupe_key");



ALTER TABLE ONLY "public"."booking_assignments"
    ADD CONSTRAINT "booking_assignments_pkey" PRIMARY KEY ("booking_id", "collaborator_id");



ALTER TABLE ONLY "public"."booking_holds"
    ADD CONSTRAINT "booking_holds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_items"
    ADD CONSTRAINT "booking_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channel_members"
    ADD CONSTRAINT "channel_members_pkey" PRIMARY KEY ("channel_id", "user_id");



ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_contacts"
    ADD CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_airtable_id_key" UNIQUE ("airtable_id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collaborator_google_auth"
    ADD CONSTRAINT "collaborator_google_auth_collaborator_id_key" UNIQUE ("collaborator_id");



ALTER TABLE ONLY "public"."collaborator_google_auth"
    ADD CONSTRAINT "collaborator_google_auth_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collaborator_rest_days"
    ADD CONSTRAINT "collaborator_rest_days_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collaborator_services"
    ADD CONSTRAINT "collaborator_services_airtable_id_key" UNIQUE ("airtable_id");



ALTER TABLE ONLY "public"."collaborator_services"
    ADD CONSTRAINT "collaborator_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collaborators"
    ADD CONSTRAINT "collaborators_airtable_id_key" UNIQUE ("airtable_id");



ALTER TABLE ONLY "public"."collaborators"
    ADD CONSTRAINT "collaborators_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."collaborators"
    ADD CONSTRAINT "collaborators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_airtable_id_key" UNIQUE ("airtable_id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_members"
    ADD CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debug_logs"
    ADD CONSTRAINT "debug_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_busy_cache"
    ADD CONSTRAINT "external_busy_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_calendar_connections"
    ADD CONSTRAINT "external_calendar_connections_collaborator_id_provider_key" UNIQUE ("collaborator_id", "provider");



ALTER TABLE ONLY "public"."external_calendar_connections"
    ADD CONSTRAINT "external_calendar_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_movements"
    ADD CONSTRAINT "finance_movements_movement_code_key" UNIQUE ("movement_code");



ALTER TABLE ONLY "public"."finance_movements"
    ADD CONSTRAINT "finance_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_movements"
    ADD CONSTRAINT "invoice_movements_pkey" PRIMARY KEY ("invoice_id", "movement_id");



ALTER TABLE ONLY "public"."invoice_orders"
    ADD CONSTRAINT "invoice_orders_invoice_id_order_id_key" UNIQUE ("invoice_id", "order_id");



ALTER TABLE ONLY "public"."invoice_orders"
    ADD CONSTRAINT "invoice_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_payments"
    ADD CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("invoice_id", "payment_id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_attachments"
    ADD CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_reads"
    ADD CONSTRAINT "message_reads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_reads"
    ADD CONSTRAINT "message_reads_user_id_channel_id_key" UNIQUE ("user_id", "channel_id");



ALTER TABLE ONLY "public"."message_reads"
    ADD CONSTRAINT "message_reads_user_id_conversation_id_key" UNIQUE ("user_id", "conversation_id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_types"
    ADD CONSTRAINT "notification_types_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."notification_types"
    ADD CONSTRAINT "notification_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_collaborators"
    ADD CONSTRAINT "order_collaborators_order_id_collaborator_id_key" UNIQUE ("order_id", "collaborator_id");



ALTER TABLE ONLY "public"."order_collaborators"
    ADD CONSTRAINT "order_collaborators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_contacts"
    ADD CONSTRAINT "order_contacts_order_id_contact_id_key" UNIQUE ("order_id", "contact_id");



ALTER TABLE ONLY "public"."order_contacts"
    ADD CONSTRAINT "order_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_airtable_id_key" UNIQUE ("airtable_id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."passive_invoices"
    ADD CONSTRAINT "passive_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pm_item_assignees"
    ADD CONSTRAINT "pm_item_assignees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pm_item_comments"
    ADD CONSTRAINT "pm_item_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pm_item_incarichi"
    ADD CONSTRAINT "pm_item_incarichi_pkey" PRIMARY KEY ("pm_item_ref", "incarico_ref");



ALTER TABLE ONLY "public"."pm_item_links"
    ADD CONSTRAINT "pm_item_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pm_items"
    ADD CONSTRAINT "pm_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pm_space_assignees"
    ADD CONSTRAINT "pm_space_assignees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pm_space_assignees"
    ADD CONSTRAINT "pm_space_assignees_pm_space_ref_collaborator_ref_key" UNIQUE ("pm_space_ref", "collaborator_ref");



ALTER TABLE ONLY "public"."pm_space_assignees"
    ADD CONSTRAINT "pm_space_assignees_pm_space_ref_user_ref_key" UNIQUE ("pm_space_ref", "user_ref");



ALTER TABLE ONLY "public"."pm_spaces"
    ADD CONSTRAINT "pm_spaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_message_id_user_id_emoji_key" UNIQUE ("message_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_categories"
    ADD CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_item_collaborators"
    ADD CONSTRAINT "service_collaborators_pkey" PRIMARY KEY ("booking_item_id", "collaborator_id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_airtable_id_key" UNIQUE ("airtable_id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_config"
    ADD CONSTRAINT "system_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaction_categories"
    ADD CONSTRAINT "transaction_categories_name_type_key" UNIQUE ("name", "type");



ALTER TABLE ONLY "public"."transaction_categories"
    ADD CONSTRAINT "transaction_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_notification_preferences"
    ADD CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_notification_preferences"
    ADD CONSTRAINT "user_notification_preferences_user_id_notification_type_id_key" UNIQUE ("user_id", "notification_type_id");



CREATE INDEX "bank_transactions_statement_status_idx" ON "public"."bank_transactions" USING "btree" ("statement_id", "status");



CREATE INDEX "bank_transactions_status_date_idx" ON "public"."bank_transactions" USING "btree" ("status", "date" DESC);



CREATE INDEX "clients_business_name_search_trgm" ON "public"."clients" USING "gin" ("business_name_search" "public"."gin_trgm_ops");



CREATE INDEX "collaborators_full_name_search_trgm" ON "public"."collaborators" USING "gin" ("full_name_search" "public"."gin_trgm_ops");



CREATE INDEX "idx_appointments_client" ON "public"."appointments" USING "btree" ("client_id");



CREATE INDEX "idx_appointments_order" ON "public"."appointments" USING "btree" ("order_id");



CREATE INDEX "idx_appointments_space" ON "public"."appointments" USING "btree" ("pm_space_id");



CREATE INDEX "idx_appointments_start" ON "public"."appointments" USING "btree" ("start_time");



CREATE INDEX "idx_appt_internal_collab" ON "public"."appointment_internal_participants" USING "btree" ("collaborator_id");



CREATE INDEX "idx_bank_trans_active_inv" ON "public"."bank_transactions" USING "btree" ("active_invoice_id");



CREATE INDEX "idx_bank_trans_category" ON "public"."bank_transactions" USING "btree" ("category_id");



CREATE INDEX "idx_bank_trans_collaborator_id" ON "public"."bank_transactions" USING "btree" ("collaborator_id");



CREATE INDEX "idx_bank_trans_date" ON "public"."bank_transactions" USING "btree" ("date");



CREATE INDEX "idx_bank_trans_passive_inv" ON "public"."bank_transactions" USING "btree" ("passive_invoice_id");



CREATE INDEX "idx_bookings_range" ON "public"."bookings" USING "btree" ("start_time", "end_time");



CREATE INDEX "idx_busy_cache_range" ON "public"."external_busy_cache" USING "btree" ("collaborator_id", "start_time", "end_time");



CREATE INDEX "idx_contacts_client_id" ON "public"."contacts" USING "btree" ("client_id");



CREATE INDEX "idx_debug_logs_level" ON "public"."debug_logs" USING "btree" ("level");



CREATE INDEX "idx_invoices_client_id" ON "public"."invoices" USING "btree" ("client_id");



CREATE INDEX "idx_invoices_order_id" ON "public"."invoices" USING "btree" ("order_id");



CREATE INDEX "idx_notification_types_key" ON "public"."notification_types" USING "btree" ("key");



CREATE INDEX "idx_notifications_collab" ON "public"."notifications" USING "btree" ("collaborator_id", "is_read", "created_at" DESC);



CREATE INDEX "idx_notifications_email_queued" ON "public"."notifications" USING "btree" ("email_status") WHERE ("email_status" = 'queued'::"text");



CREATE INDEX "idx_notifications_user" ON "public"."notifications" USING "btree" ("user_id", "is_read", "created_at" DESC);



CREATE INDEX "idx_passive_invoices_collaborator_id" ON "public"."passive_invoices" USING "btree" ("collaborator_id");



CREATE INDEX "idx_passive_invoices_supplier_id" ON "public"."passive_invoices" USING "btree" ("supplier_id");



CREATE UNIQUE INDEX "idx_pm_assignees_dedupe_collab" ON "public"."pm_item_assignees" USING "btree" ("pm_item_ref", "collaborator_ref") WHERE ("collaborator_ref" IS NOT NULL);



CREATE UNIQUE INDEX "idx_pm_assignees_dedupe_user" ON "public"."pm_item_assignees" USING "btree" ("pm_item_ref", "user_ref") WHERE ("user_ref" IS NOT NULL);



CREATE INDEX "idx_pm_comments_item" ON "public"."pm_item_comments" USING "btree" ("pm_item_ref", "created_at");



CREATE INDEX "idx_pm_item_incarichi_ref" ON "public"."pm_item_incarichi" USING "btree" ("incarico_ref");



CREATE INDEX "idx_pm_items_due" ON "public"."pm_items" USING "btree" ("space_ref", "due_date");



CREATE INDEX "idx_pm_items_parent" ON "public"."pm_items" USING "btree" ("parent_ref");



CREATE INDEX "idx_pm_items_space" ON "public"."pm_items" USING "btree" ("space_ref");



CREATE INDEX "idx_pm_items_status" ON "public"."pm_items" USING "btree" ("space_ref", "status");



CREATE INDEX "idx_pm_spaces_is_cluster" ON "public"."pm_spaces" USING "btree" ("is_cluster");



CREATE INDEX "idx_pm_spaces_parent" ON "public"."pm_spaces" USING "btree" ("parent_ref");



CREATE INDEX "idx_system_config_key" ON "public"."system_config" USING "btree" ("key");



CREATE INDEX "idx_user_notif_prefs_user" ON "public"."user_notification_preferences" USING "btree" ("user_id");



CREATE INDEX "invoices_client_id_idx" ON "public"."invoices" USING "btree" ("client_id");



CREATE INDEX "invoices_invnum_trgm" ON "public"."invoices" USING "gin" ("invoice_number_search" "public"."gin_trgm_ops");



CREATE INDEX "messages_fts_idx" ON "public"."messages" USING "gin" ("fts");



CREATE INDEX "passive_invoices_collaborator_id_idx" ON "public"."passive_invoices" USING "btree" ("collaborator_id");



CREATE INDEX "passive_invoices_invnum_trgm" ON "public"."passive_invoices" USING "gin" ("invoice_number_search" "public"."gin_trgm_ops");



CREATE INDEX "passive_invoices_supplier_id_idx" ON "public"."passive_invoices" USING "btree" ("supplier_id");



CREATE INDEX "payments_bank_transaction_id_idx" ON "public"."payments" USING "btree" ("bank_transaction_id");



CREATE INDEX "payments_client_amount_due_idx" ON "public"."payments" USING "btree" ("client_id", "amount", "due_date") WHERE ("bank_transaction_id" IS NULL);



CREATE INDEX "payments_collab_amount_due_idx" ON "public"."payments" USING "btree" ("collaborator_id", "amount", "due_date") WHERE ("bank_transaction_id" IS NULL);



CREATE INDEX "payments_invoice_idx" ON "public"."payments" USING "btree" ("invoice_id") WHERE ("bank_transaction_id" IS NULL);



CREATE INDEX "payments_order_idx" ON "public"."payments" USING "btree" ("order_id") WHERE ("bank_transaction_id" IS NULL);



CREATE INDEX "payments_passive_invoice_idx" ON "public"."payments" USING "btree" ("passive_invoice_id") WHERE ("bank_transaction_id" IS NULL);



CREATE INDEX "payments_supplier_amount_due_idx" ON "public"."payments" USING "btree" ("supplier_id", "amount", "due_date") WHERE ("bank_transaction_id" IS NULL);



CREATE INDEX "payments_unlinked_idx" ON "public"."payments" USING "btree" ("status", "due_date") WHERE ("bank_transaction_id" IS NULL);



CREATE INDEX "suppliers_name_search_trgm" ON "public"."suppliers" USING "gin" ("name_search" "public"."gin_trgm_ops");



CREATE OR REPLACE TRIGGER "notify_collaborator_assignment_trigger" AFTER INSERT ON "public"."booking_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_collaborator_assignment"();



CREATE OR REPLACE TRIGGER "on_booking_assignment_created" AFTER INSERT ON "public"."booking_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_sync_google_calendar"();



CREATE OR REPLACE TRIGGER "set_collaborator_google_auth_updated_at" BEFORE UPDATE ON "public"."collaborator_google_auth" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "sync_profile_name_trigger" AFTER INSERT OR UPDATE OF "full_name" ON "public"."collaborators" FOR EACH ROW EXECUTE FUNCTION "public"."sync_profile_name"();



CREATE OR REPLACE TRIGGER "trg_clients_business_name_search" BEFORE INSERT OR UPDATE OF "business_name" ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."_clients_business_name_search_trg"();



CREATE OR REPLACE TRIGGER "trg_collaborators_full_name_search" BEFORE INSERT OR UPDATE OF "full_name" ON "public"."collaborators" FOR EACH ROW EXECUTE FUNCTION "public"."_collaborators_full_name_search_trg"();



CREATE OR REPLACE TRIGGER "trg_handle_new_message" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_message"();



CREATE OR REPLACE TRIGGER "trg_invoices_invoice_number_search" BEFORE INSERT OR UPDATE OF "invoice_number" ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."_invoices_invoice_number_search_trg"();



CREATE OR REPLACE TRIGGER "trg_passive_invoices_invoice_number_search" BEFORE INSERT OR UPDATE OF "invoice_number" ON "public"."passive_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."_passive_invoices_invoice_number_search_trg"();



CREATE OR REPLACE TRIGGER "trg_payment_invoice_link" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."payment_invoice_link_trigger"();



CREATE OR REPLACE TRIGGER "trg_process_notification" AFTER INSERT ON "public"."notifications" FOR EACH ROW WHEN (("new"."email_status" = 'queued'::"text")) EXECUTE FUNCTION "public"."trigger_process_notification"();



CREATE OR REPLACE TRIGGER "trg_suppliers_name_search" BEFORE INSERT OR UPDATE OF "name" ON "public"."suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."_suppliers_name_search_trg"();



CREATE OR REPLACE TRIGGER "trigger_payment_auto_done_on_invoice_paid" AFTER UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."auto_set_payment_done_on_invoice_paid"();



CREATE OR REPLACE TRIGGER "trigger_payment_auto_done_on_link" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."auto_set_payment_done_on_link"();



CREATE OR REPLACE TRIGGER "trigger_payment_auto_done_on_passive_invoice_paid" AFTER UPDATE ON "public"."passive_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."auto_set_payment_done_on_invoice_paid"();



ALTER TABLE ONLY "public"."appointment_client_participants"
    ADD CONSTRAINT "appointment_client_participants_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_client_participants"
    ADD CONSTRAINT "appointment_client_participants_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_google_sync"
    ADD CONSTRAINT "appointment_google_sync_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_google_sync"
    ADD CONSTRAINT "appointment_google_sync_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_internal_participants"
    ADD CONSTRAINT "appointment_internal_participants_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_internal_participants"
    ADD CONSTRAINT "appointment_internal_participants_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_type_links"
    ADD CONSTRAINT "appointment_type_links_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_type_links"
    ADD CONSTRAINT "appointment_type_links_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "public"."appointment_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pm_space_id_fkey" FOREIGN KEY ("pm_space_id") REFERENCES "public"."pm_spaces"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."availability_overrides"
    ADD CONSTRAINT "availability_overrides_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "public"."booking_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."availability_overrides"
    ADD CONSTRAINT "availability_overrides_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."availability_rules"
    ADD CONSTRAINT "availability_rules_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."availability_rules"
    ADD CONSTRAINT "availability_rules_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."booking_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_active_invoice_id_fkey" FOREIGN KEY ("active_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."transaction_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_passive_invoice_id_fkey" FOREIGN KEY ("passive_invoice_id") REFERENCES "public"."passive_invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "public"."bank_statements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_assignments"
    ADD CONSTRAINT "booking_assignments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_assignments"
    ADD CONSTRAINT "booking_assignments_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_holds"
    ADD CONSTRAINT "booking_holds_service_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."booking_item_collaborators"
    ADD CONSTRAINT "booking_item_collaborators_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "public"."booking_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_item_collaborators"
    ADD CONSTRAINT "booking_item_collaborators_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_items"
    ADD CONSTRAINT "booking_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."booking_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "public"."booking_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."channel_members"
    ADD CONSTRAINT "channel_members_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_members"
    ADD CONSTRAINT "channel_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."client_contacts"
    ADD CONSTRAINT "client_contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collaborator_google_auth"
    ADD CONSTRAINT "collaborator_google_auth_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collaborator_rest_days"
    ADD CONSTRAINT "collaborator_rest_days_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collaborator_services"
    ADD CONSTRAINT "collaborator_services_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."collaborator_services"
    ADD CONSTRAINT "collaborator_services_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."collaborator_services"
    ADD CONSTRAINT "collaborator_services_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."collaborator_services"
    ADD CONSTRAINT "collaborator_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."collaborators"
    ADD CONSTRAINT "collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_members"
    ADD CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_members"
    ADD CONSTRAINT "conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."external_busy_cache"
    ADD CONSTRAINT "external_busy_cache_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."external_calendar_connections"
    ADD CONSTRAINT "external_calendar_connections_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_movements"
    ADD CONSTRAINT "invoice_movements_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_movements"
    ADD CONSTRAINT "invoice_movements_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "public"."finance_movements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_orders"
    ADD CONSTRAINT "invoice_orders_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_orders"
    ADD CONSTRAINT "invoice_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_payments"
    ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."message_attachments"
    ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_reads"
    ADD CONSTRAINT "message_reads_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_reads"
    ADD CONSTRAINT "message_reads_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_reads"
    ADD CONSTRAINT "message_reads_last_read_message_id_fkey" FOREIGN KEY ("last_read_message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."message_reads"
    ADD CONSTRAINT "message_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_collaborators"
    ADD CONSTRAINT "order_collaborators_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_collaborators"
    ADD CONSTRAINT "order_collaborators_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_contacts"
    ADD CONSTRAINT "order_contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_contacts"
    ADD CONSTRAINT "order_contacts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."collaborators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pm_id_fkey" FOREIGN KEY ("pm_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."passive_invoices"
    ADD CONSTRAINT "passive_invoices_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."passive_invoices"
    ADD CONSTRAINT "passive_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_passive_invoice_id_fkey" FOREIGN KEY ("passive_invoice_id") REFERENCES "public"."passive_invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pm_item_assignees"
    ADD CONSTRAINT "pm_item_assignees_collaborator_ref_fkey" FOREIGN KEY ("collaborator_ref") REFERENCES "public"."collaborators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pm_item_assignees"
    ADD CONSTRAINT "pm_item_assignees_pm_item_ref_fkey" FOREIGN KEY ("pm_item_ref") REFERENCES "public"."pm_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pm_item_assignees"
    ADD CONSTRAINT "pm_item_assignees_user_ref_fkey" FOREIGN KEY ("user_ref") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pm_item_comments"
    ADD CONSTRAINT "pm_item_comments_author_user_ref_fkey" FOREIGN KEY ("author_user_ref") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pm_item_comments"
    ADD CONSTRAINT "pm_item_comments_pm_item_ref_fkey" FOREIGN KEY ("pm_item_ref") REFERENCES "public"."pm_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pm_item_incarichi"
    ADD CONSTRAINT "pm_item_incarichi_incarico_ref_fkey" FOREIGN KEY ("incarico_ref") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pm_item_incarichi"
    ADD CONSTRAINT "pm_item_incarichi_pm_item_ref_fkey" FOREIGN KEY ("pm_item_ref") REFERENCES "public"."pm_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pm_item_links"
    ADD CONSTRAINT "pm_item_links_pm_item_ref_fkey" FOREIGN KEY ("pm_item_ref") REFERENCES "public"."pm_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pm_items"
    ADD CONSTRAINT "pm_items_created_by_user_ref_fkey" FOREIGN KEY ("created_by_user_ref") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pm_items"
    ADD CONSTRAINT "pm_items_parent_ref_fkey" FOREIGN KEY ("parent_ref") REFERENCES "public"."pm_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pm_items"
    ADD CONSTRAINT "pm_items_pm_user_ref_fkey" FOREIGN KEY ("pm_user_ref") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pm_items"
    ADD CONSTRAINT "pm_items_space_ref_fkey" FOREIGN KEY ("space_ref") REFERENCES "public"."pm_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pm_space_assignees"
    ADD CONSTRAINT "pm_space_assignees_collaborator_ref_fkey" FOREIGN KEY ("collaborator_ref") REFERENCES "public"."collaborators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pm_space_assignees"
    ADD CONSTRAINT "pm_space_assignees_pm_space_ref_fkey" FOREIGN KEY ("pm_space_ref") REFERENCES "public"."pm_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pm_space_assignees"
    ADD CONSTRAINT "pm_space_assignees_user_ref_fkey" FOREIGN KEY ("user_ref") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pm_spaces"
    ADD CONSTRAINT "pm_spaces_default_pm_user_ref_fkey" FOREIGN KEY ("default_pm_user_ref") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pm_spaces"
    ADD CONSTRAINT "pm_spaces_parent_ref_fkey" FOREIGN KEY ("parent_ref") REFERENCES "public"."pm_spaces"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pm_spaces"
    ADD CONSTRAINT "pm_spaces_ref_ordine_fkey" FOREIGN KEY ("ref_ordine") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_categories"
    ADD CONSTRAINT "service_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."booking_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_config"
    ADD CONSTRAINT "system_config_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_categories"
    ADD CONSTRAINT "transaction_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."transaction_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_notification_preferences"
    ADD CONSTRAINT "user_notification_preferences_notification_type_id_fkey" FOREIGN KEY ("notification_type_id") REFERENCES "public"."notification_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_notification_preferences"
    ADD CONSTRAINT "user_notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admin can do everything on bank_statements" ON "public"."bank_statements" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admin can do everything on bank_transactions" ON "public"."bank_transactions" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admin can do everything on clients" ON "public"."clients" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admin can do everything on collaborator_services" ON "public"."collaborator_services" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admin can do everything on collaborators" ON "public"."collaborators" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admin can do everything on contacts" ON "public"."contacts" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admin can do everything on invoices" ON "public"."invoices" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admin can do everything on order_collaborators" ON "public"."order_collaborators" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admin can do everything on orders" ON "public"."orders" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admin can do everything on passive_invoices" ON "public"."passive_invoices" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admin can do everything on services" ON "public"."services" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admin can do everything on suppliers" ON "public"."suppliers" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admin can do everything on transaction_categories" ON "public"."transaction_categories" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admin full access" ON "public"."finance_movements" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admin full access" ON "public"."invoice_movements" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admin full access" ON "public"."invoice_orders" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admin full access" ON "public"."invoice_payments" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admins can manage all overrides" ON "public"."availability_overrides" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage all rest days" ON "public"."collaborator_rest_days" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all notifications" ON "public"."notifications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins/Collaborators can delete assignments" ON "public"."booking_assignments" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Admins/Collaborators can delete bookings" ON "public"."bookings" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Admins/Collaborators can update bookings" ON "public"."bookings" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all access to booking_categories" ON "public"."booking_categories" USING (true);



CREATE POLICY "Allow all access to booking_items" ON "public"."booking_items" USING (true);



CREATE POLICY "Allow all for authenticated departments" ON "public"."departments" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."collaborator_google_auth" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public inserts to bookings" ON "public"."bookings" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public read departments" ON "public"."departments" FOR SELECT USING (true);



CREATE POLICY "Anyone can insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Assignees: Delete" ON "public"."pm_item_assignees" FOR DELETE USING (("public"."is_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."pm_items" "i"
     JOIN "public"."pm_spaces" "s" ON (("s"."id" = "i"."space_ref")))
  WHERE (("i"."id" = "pm_item_assignees"."pm_item_ref") AND ("s"."default_pm_user_ref" = "auth"."uid"()))))));



CREATE POLICY "Assignees: Manage" ON "public"."pm_item_assignees" FOR INSERT WITH CHECK (("public"."is_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."pm_items" "i"
     JOIN "public"."pm_spaces" "s" ON (("s"."id" = "i"."space_ref")))
  WHERE (("i"."id" = "pm_item_assignees"."pm_item_ref") AND ("s"."default_pm_user_ref" = "auth"."uid"()))))));



CREATE POLICY "Assignees: Update" ON "public"."pm_item_assignees" FOR UPDATE USING (("public"."is_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."pm_items" "i"
     JOIN "public"."pm_spaces" "s" ON (("s"."id" = "i"."space_ref")))
  WHERE (("i"."id" = "pm_item_assignees"."pm_item_ref") AND ("s"."default_pm_user_ref" = "auth"."uid"()))))));



CREATE POLICY "Assignees: View" ON "public"."pm_item_assignees" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Auth all client" ON "public"."appointment_client_participants" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Auth all internal" ON "public"."appointment_internal_participants" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Auth all links" ON "public"."appointment_type_links" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Auth delete appointments" ON "public"."appointments" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Auth insert appointments" ON "public"."appointments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Auth read appointments" ON "public"."appointments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Auth read types" ON "public"."appointment_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Auth update appointments" ON "public"."appointments" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Authenticated can create conversations" ON "public"."conversations" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Authenticated users can read notification types" ON "public"."notification_types" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view collaborator_services" ON "public"."collaborator_services" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view services" ON "public"."services" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Comments: Insert" ON "public"."pm_item_comments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."pm_items" "i"
  WHERE ("i"."id" = "pm_item_comments"."pm_item_ref"))));



CREATE POLICY "Comments: Visibility" ON "public"."pm_item_comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."pm_items" "i"
  WHERE ("i"."id" = "pm_item_comments"."pm_item_ref"))));



CREATE POLICY "Creator can add members" ON "public"."conversation_members" FOR INSERT TO "authenticated" WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable delete access for authenticated users" ON "public"."order_contacts" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."order_contacts" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for all" ON "public"."debug_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."passive_invoices" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."assignments" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."passive_invoices" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."payments" FOR SELECT USING (true);



CREATE POLICY "Enable read access for authenticated users" ON "public"."order_contacts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable update access for authenticated users" ON "public"."order_contacts" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Enable update for users based on email" ON "public"."passive_invoices" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Enable view for admins" ON "public"."debug_logs" FOR SELECT USING (((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."collaborators"
  WHERE (("collaborators"."email" = (( SELECT "users"."email"
           FROM "auth"."users"
          WHERE ("users"."id" = "auth"."uid"())))::"text") AND ("collaborators"."role" = 'admin'::"text"))))));



CREATE POLICY "Enable write access for authenticated users" ON "public"."assignments" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable write access for authenticated users" ON "public"."payments" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Incarichi Link: Manage Delete" ON "public"."pm_item_incarichi" FOR DELETE USING (("public"."is_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."pm_items" "i"
     JOIN "public"."pm_spaces" "s" ON (("s"."id" = "i"."space_ref")))
  WHERE (("i"."id" = "pm_item_incarichi"."pm_item_ref") AND ("s"."default_pm_user_ref" = "auth"."uid"()))))));



CREATE POLICY "Incarichi Link: Manage Insert" ON "public"."pm_item_incarichi" FOR INSERT WITH CHECK (("public"."is_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."pm_items" "i"
     JOIN "public"."pm_spaces" "s" ON (("s"."id" = "i"."space_ref")))
  WHERE (("i"."id" = "pm_item_incarichi"."pm_item_ref") AND ("s"."default_pm_user_ref" = "auth"."uid"()))))));



CREATE POLICY "Incarichi Link: View" ON "public"."pm_item_incarichi" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Items: Admin access" ON "public"."pm_items" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Items: Collaborator update own" ON "public"."pm_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."pm_item_assignees" "a"
  WHERE (("a"."pm_item_ref" = "pm_items"."id") AND (("a"."user_ref" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."collaborators" "c"
          WHERE (("c"."id" = "a"."collaborator_ref") AND ("c"."user_id" = "auth"."uid"())))))))));



CREATE POLICY "Items: Collaborator visibility" ON "public"."pm_items" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."pm_item_assignees" "a"
  WHERE (("a"."pm_item_ref" = "pm_items"."id") AND ("a"."user_ref" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."pm_item_assignees" "a"
     JOIN "public"."collaborators" "c" ON (("c"."id" = "a"."collaborator_ref")))
  WHERE (("a"."pm_item_ref" = "pm_items"."id") AND ("c"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM (("public"."pm_item_incarichi" "i"
     JOIN "public"."assignments" "ass" ON (("i"."incarico_ref" = "ass"."id")))
     JOIN "public"."collaborators" "c" ON (("c"."id" = "ass"."collaborator_id")))
  WHERE (("i"."pm_item_ref" = "pm_items"."id") AND ("c"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Items: Insert Admin/PM" ON "public"."pm_items" FOR INSERT WITH CHECK (("public"."is_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."pm_spaces" "s"
  WHERE (("s"."id" = "pm_items"."space_ref") AND ("s"."default_pm_user_ref" = "auth"."uid"()))))));



CREATE POLICY "Items: Space PM access" ON "public"."pm_items" USING ((EXISTS ( SELECT 1
   FROM "public"."pm_spaces" "s"
  WHERE (("s"."id" = "pm_items"."space_ref") AND ("s"."default_pm_user_ref" = "auth"."uid"())))));



CREATE POLICY "Messages update author" ON "public"."messages" FOR UPDATE TO "authenticated" USING (("author_id" = "auth"."uid"()));



CREATE POLICY "Owner can update channel" ON "public"."channels" FOR UPDATE TO "authenticated" USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Public Insert Assignments" ON "public"."booking_assignments" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Public Insert Bookings" ON "public"."bookings" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Public Read Assignments" ON "public"."booking_assignments" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public Read Availability" ON "public"."bookings" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public access assignments" ON "public"."assignments" USING (true);



CREATE POLICY "Public access auth" ON "public"."collaborator_google_auth" USING (true);



CREATE POLICY "Public access bank_statements" ON "public"."bank_statements" USING (true);



CREATE POLICY "Public access bank_transactions" ON "public"."bank_transactions" USING (true);



CREATE POLICY "Public access client_contacts" ON "public"."client_contacts" USING (true);



CREATE POLICY "Public access clients" ON "public"."clients" USING (true);



CREATE POLICY "Public access collaborator_services" ON "public"."collaborator_services" USING (true);



CREATE POLICY "Public access collaborators" ON "public"."collaborators" USING (true);



CREATE POLICY "Public access contacts" ON "public"."contacts" USING (true);



CREATE POLICY "Public access departments" ON "public"."departments" USING (true);



CREATE POLICY "Public access finance_movements" ON "public"."finance_movements" USING (true);



CREATE POLICY "Public access invoice_movements" ON "public"."invoice_movements" USING (true);



CREATE POLICY "Public access invoice_orders" ON "public"."invoice_orders" USING (true);



CREATE POLICY "Public access invoice_payments" ON "public"."invoice_payments" USING (true);



CREATE POLICY "Public access invoices" ON "public"."invoices" USING (true);



CREATE POLICY "Public access order_collaborators" ON "public"."order_collaborators" USING (true);



CREATE POLICY "Public access order_contacts" ON "public"."order_contacts" USING (true);



CREATE POLICY "Public access order_items" ON "public"."order_items" USING (true);



CREATE POLICY "Public access orders" ON "public"."orders" USING (true);



CREATE POLICY "Public access passive_invoices" ON "public"."passive_invoices" USING (true);



CREATE POLICY "Public access payments" ON "public"."payments" USING (true);



CREATE POLICY "Public access profiles" ON "public"."profiles" USING (true);



CREATE POLICY "Public access services" ON "public"."services" USING (true);



CREATE POLICY "Public access suppliers" ON "public"."suppliers" USING (true);



CREATE POLICY "Public access tasks" ON "public"."tasks" USING (true);



CREATE POLICY "Public access transaction_categories" ON "public"."transaction_categories" USING (true);



CREATE POLICY "Public insert assignments" ON "public"."booking_assignments" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public read config" ON "public"."system_config" FOR SELECT USING (true);



CREATE POLICY "Public select assignments" ON "public"."booking_assignments" FOR SELECT USING (true);



CREATE POLICY "Public select overrides" ON "public"."availability_overrides" FOR SELECT USING (true);



CREATE POLICY "Public write config" ON "public"."system_config" USING (true);



CREATE POLICY "Reactions delete own" ON "public"."reactions" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Reactions insert optimized" ON "public"."reactions" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ((("channel_id" IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM "public"."channels"
  WHERE (("channels"."id" = "reactions"."channel_id") AND ("channels"."is_private" = false)))) OR (EXISTS ( SELECT 1
   FROM "public"."channel_members"
  WHERE (("channel_members"."channel_id" = "reactions"."channel_id") AND ("channel_members"."user_id" = "auth"."uid"())))))) OR (("conversation_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."conversation_members"
  WHERE (("conversation_members"."conversation_id" = "reactions"."conversation_id") AND ("conversation_members"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "Reactions select optimized" ON "public"."reactions" FOR SELECT TO "authenticated" USING (((("channel_id" IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM "public"."channels"
  WHERE (("channels"."id" = "reactions"."channel_id") AND ("channels"."is_private" = false)))) OR (EXISTS ( SELECT 1
   FROM "public"."channel_members"
  WHERE (("channel_members"."channel_id" = "reactions"."channel_id") AND ("channel_members"."user_id" = "auth"."uid"())))))) OR (("conversation_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."conversation_members"
  WHERE (("conversation_members"."conversation_id" = "reactions"."conversation_id") AND ("conversation_members"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Reactions visibility" ON "public"."reactions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."messages"
  WHERE ("messages"."id" = "reactions"."message_id"))));



CREATE POLICY "Read status own" ON "public"."message_reads" TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Service role can insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service role can manage notification types" ON "public"."notification_types" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Space Assignees: Manage" ON "public"."pm_space_assignees" USING (("public"."is_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."pm_spaces" "s"
  WHERE (("s"."id" = "pm_space_assignees"."pm_space_ref") AND ("s"."default_pm_user_ref" = "auth"."uid"()))))));



CREATE POLICY "Space Assignees: View" ON "public"."pm_space_assignees" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."pm_spaces" "s"
  WHERE ("s"."id" = "pm_space_assignees"."pm_space_ref"))));



CREATE POLICY "Spaces: Admin access" ON "public"."pm_spaces" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Spaces: Collaborator access (assigned to order)" ON "public"."pm_spaces" FOR SELECT USING ((("type" = 'commessa'::"public"."pm_space_type") AND (EXISTS ( SELECT 1
   FROM "public"."assignments" "a"
  WHERE (("a"."order_id" = "pm_spaces"."ref_ordine") AND ("a"."collaborator_id" IN ( SELECT "collaborators"."id"
           FROM "public"."collaborators"
          WHERE ("collaborators"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "Spaces: PM access" ON "public"."pm_spaces" USING (("default_pm_user_ref" = "auth"."uid"()));



CREATE POLICY "Users and Admins can update notifications" ON "public"."notifications" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR ("collaborator_id" IN ( SELECT "collaborators"."id"
   FROM "public"."collaborators"
  WHERE ("collaborators"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))))) WITH CHECK ((("auth"."uid"() = "user_id") OR ("collaborator_id" IN ( SELECT "collaborators"."id"
   FROM "public"."collaborators"
  WHERE ("collaborators"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))));



CREATE POLICY "Users and Admins can view notifications" ON "public"."notifications" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("collaborator_id" IN ( SELECT "collaborators"."id"
   FROM "public"."collaborators"
  WHERE ("collaborators"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))));



CREATE POLICY "Users can delete own preferences" ON "public"."user_notification_preferences" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own sync records" ON "public"."appointment_google_sync" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own preferences" ON "public"."user_notification_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own sync records" ON "public"."appointment_google_sync" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own overrides" ON "public"."availability_overrides" USING (("collaborator_id" IN ( SELECT "collaborators"."id"
   FROM "public"."collaborators"
  WHERE ("collaborators"."email" = ("auth"."jwt"() ->> 'email'::"text")))));



CREATE POLICY "Users can manage own rest days" ON "public"."collaborator_rest_days" USING (("collaborator_id" IN ( SELECT "collaborators"."id"
   FROM "public"."collaborators"
  WHERE ("collaborators"."email" = ("auth"."jwt"() ->> 'email'::"text")))));



CREATE POLICY "Users can read own preferences" ON "public"."user_notification_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can see own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR ("collaborator_id" IN ( SELECT "collaborators"."id"
   FROM "public"."collaborators"
  WHERE ("collaborators"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own preferences" ON "public"."user_notification_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own sync records" ON "public"."appointment_google_sync" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("collaborator_id" IN ( SELECT "collaborators"."id"
   FROM "public"."collaborators"
  WHERE ("collaborators"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own sync records" ON "public"."appointment_google_sync" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own bookings" ON "public"."bookings" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("auth"."uid"() IN ( SELECT "booking_assignments"."collaborator_id"
   FROM "public"."booking_assignments"
  WHERE ("booking_assignments"."booking_id" = "bookings"."id")))));



ALTER TABLE "public"."appointment_client_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointment_google_sync" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointment_internal_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointment_type_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointment_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."availability_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bank_statements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bank_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."channel_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."channels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collaborator_google_auth" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collaborator_rest_days" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collaborator_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collaborators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."debug_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_movements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert_channel_members" ON "public"."channel_members" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND ((EXISTS ( SELECT 1
   FROM "public"."channels"
  WHERE (("channels"."id" = "channel_members"."channel_id") AND ("channels"."is_private" = false)))) OR (EXISTS ( SELECT 1
   FROM "public"."channels"
  WHERE (("channels"."id" = "channel_members"."channel_id") AND ("channels"."created_by" = "auth"."uid"())))))));



CREATE POLICY "insert_channels" ON "public"."channels" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "insert_messages" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("author_id" = "auth"."uid"()) AND ((("channel_id" IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM "public"."channels"
  WHERE (("channels"."id" = "messages"."channel_id") AND ("channels"."is_private" = false)))) OR "public"."is_member_of_channel"("channel_id"))) OR (("conversation_id" IS NOT NULL) AND "public"."is_member_of_conversation"("conversation_id")))));



CREATE POLICY "insert_reactions" ON "public"."reactions" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."messages" "m"
  WHERE (("m"."id" = "reactions"."message_id") AND ((("m"."channel_id" IS NOT NULL) AND ((EXISTS ( SELECT 1
           FROM "public"."channels"
          WHERE (("channels"."id" = "m"."channel_id") AND ("channels"."is_private" = false)))) OR "public"."is_member_of_channel"("m"."channel_id"))) OR (("m"."conversation_id" IS NOT NULL) AND "public"."is_member_of_conversation"("m"."conversation_id"))))))));



ALTER TABLE "public"."invoice_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_reads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_collaborators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."passive_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pm_item_assignees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pm_item_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pm_item_incarichi" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pm_item_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pm_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pm_space_assignees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pm_spaces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select_channel_members" ON "public"."channel_members" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."channels"
  WHERE (("channels"."id" = "channel_members"."channel_id") AND ("channels"."is_private" = false)))) OR ("user_id" = "auth"."uid"()) OR "public"."is_member_of_channel"("channel_id")));



CREATE POLICY "select_channels" ON "public"."channels" FOR SELECT TO "authenticated" USING ((("is_private" = false) OR "public"."is_member_of_channel"("id")));



CREATE POLICY "select_conversation_members" ON "public"."conversation_members" FOR SELECT TO "authenticated" USING ("public"."is_member_of_conversation"("conversation_id"));



CREATE POLICY "select_conversations" ON "public"."conversations" FOR SELECT TO "authenticated" USING ("public"."is_member_of_conversation"("id"));



CREATE POLICY "select_messages" ON "public"."messages" FOR SELECT TO "authenticated" USING (((("channel_id" IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM "public"."channels"
  WHERE (("channels"."id" = "messages"."channel_id") AND ("channels"."is_private" = false)))) OR "public"."is_member_of_channel"("channel_id"))) OR (("conversation_id" IS NOT NULL) AND "public"."is_member_of_conversation"("conversation_id"))));



CREATE POLICY "select_reactions" ON "public"."reactions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."messages" "m"
  WHERE (("m"."id" = "reactions"."message_id") AND ((("m"."channel_id" IS NOT NULL) AND ((EXISTS ( SELECT 1
           FROM "public"."channels"
          WHERE (("channels"."id" = "m"."channel_id") AND ("channels"."is_private" = false)))) OR "public"."is_member_of_channel"("m"."channel_id"))) OR (("m"."conversation_id" IS NOT NULL) AND "public"."is_member_of_conversation"("m"."conversation_id")))))));



ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transaction_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_notification_preferences" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."_clients_business_name_search_trg"() TO "anon";
GRANT ALL ON FUNCTION "public"."_clients_business_name_search_trg"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_clients_business_name_search_trg"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_col_exists"("p_table" "text", "p_col" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_col_exists"("p_table" "text", "p_col" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_col_exists"("p_table" "text", "p_col" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_collaborators_full_name_search_trg"() TO "anon";
GRANT ALL ON FUNCTION "public"."_collaborators_full_name_search_trg"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_collaborators_full_name_search_trg"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_invoices_invoice_number_search_trg"() TO "anon";
GRANT ALL ON FUNCTION "public"."_invoices_invoice_number_search_trg"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_invoices_invoice_number_search_trg"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_name_expr"("p_table" "text", "p_alias" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_name_expr"("p_table" "text", "p_alias" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_name_expr"("p_table" "text", "p_alias" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_passive_invoices_invoice_number_search_trg"() TO "anon";
GRANT ALL ON FUNCTION "public"."_passive_invoices_invoice_number_search_trg"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_passive_invoices_invoice_number_search_trg"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_suppliers_name_search_trg"() TO "anon";
GRANT ALL ON FUNCTION "public"."_suppliers_name_search_trg"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_suppliers_name_search_trg"() TO "service_role";



GRANT ALL ON TABLE "public"."bank_transactions" TO "anon";
GRANT ALL ON TABLE "public"."bank_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_transactions" TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_bank_transaction"("p_tx_id" "uuid", "p_category_id" "uuid", "p_client_id" "uuid", "p_supplier_id" "uuid", "p_collaborator_id" "uuid", "p_active_invoice_id" "uuid", "p_passive_invoice_id" "uuid", "p_payment_id" "uuid", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_bank_transaction"("p_tx_id" "uuid", "p_category_id" "uuid", "p_client_id" "uuid", "p_supplier_id" "uuid", "p_collaborator_id" "uuid", "p_active_invoice_id" "uuid", "p_passive_invoice_id" "uuid", "p_payment_id" "uuid", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_bank_transaction"("p_tx_id" "uuid", "p_category_id" "uuid", "p_client_id" "uuid", "p_supplier_id" "uuid", "p_collaborator_id" "uuid", "p_active_invoice_id" "uuid", "p_passive_invoice_id" "uuid", "p_payment_id" "uuid", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_set_payment_done_on_invoice_paid"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_set_payment_done_on_invoice_paid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_set_payment_done_on_invoice_paid"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_set_payment_done_on_link"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_set_payment_done_on_link"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_set_payment_done_on_link"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_admin_notification_logs"("p_limit" integer, "p_offset" integer, "p_search" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_notification_logs"("p_limit" integer, "p_offset" integer, "p_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_notification_logs"("p_limit" integer, "p_offset" integer, "p_search" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_outstanding_invoices_list"("p_client_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_outstanding_invoices_list"("p_client_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_outstanding_invoices_list"("p_client_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_revenue_chart_data"("p_start_date" "date", "p_end_date" "date", "p_interval" "text", "p_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_revenue_chart_data"("p_start_date" "date", "p_end_date" "date", "p_interval" "text", "p_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_revenue_chart_data"("p_start_date" "date", "p_end_date" "date", "p_interval" "text", "p_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_revenue_chart_data"("p_start_date" "date", "p_end_date" "date", "p_interval" "text", "p_client_id" "uuid", "p_is_gross" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_revenue_chart_data"("p_start_date" "date", "p_end_date" "date", "p_interval" "text", "p_client_id" "uuid", "p_is_gross" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_revenue_chart_data"("p_start_date" "date", "p_end_date" "date", "p_interval" "text", "p_client_id" "uuid", "p_is_gross" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_revenue_kpis"("p_start_date" "date", "p_end_date" "date", "p_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_revenue_kpis"("p_start_date" "date", "p_end_date" "date", "p_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_revenue_kpis"("p_start_date" "date", "p_end_date" "date", "p_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_revenue_kpis"("p_start_date" "date", "p_end_date" "date", "p_client_id" "uuid", "p_is_gross" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_revenue_kpis"("p_start_date" "date", "p_end_date" "date", "p_client_id" "uuid", "p_is_gross" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_revenue_kpis"("p_start_date" "date", "p_end_date" "date", "p_client_id" "uuid", "p_is_gross" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_top_clients_revenue"("p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_top_clients_revenue"("p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_top_clients_revenue"("p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_top_clients_revenue"("p_start_date" "date", "p_end_date" "date", "p_is_gross" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_top_clients_revenue"("p_start_date" "date", "p_end_date" "date", "p_is_gross" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_top_clients_revenue"("p_start_date" "date", "p_end_date" "date", "p_is_gross" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unread_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_unread_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unread_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_member_of_channel"("chan_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_member_of_channel"("chan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_member_of_channel"("chan_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_member_of_conversation"("conv_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_member_of_conversation"("conv_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_member_of_conversation"("conv_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_payment_to_bank_transaction"("p_payment_id" "uuid", "p_bank_transaction_id" "uuid", "p_new_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."link_payment_to_bank_transaction"("p_payment_id" "uuid", "p_bank_transaction_id" "uuid", "p_new_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_payment_to_bank_transaction"("p_payment_id" "uuid", "p_bank_transaction_id" "uuid", "p_new_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_message_read"("p_message_id" "uuid", "p_channel_id" "uuid", "p_conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_message_read"("p_message_id" "uuid", "p_channel_id" "uuid", "p_conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_message_read"("p_message_id" "uuid", "p_channel_id" "uuid", "p_conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_invoice_ref"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_invoice_ref"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_invoice_ref"("p" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_collaborator_assignment"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_collaborator_assignment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_collaborator_assignment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."payment_invoice_link_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."payment_invoice_link_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."payment_invoice_link_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_bank_transaction"("p_tx_id" "uuid", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_bank_transaction"("p_tx_id" "uuid", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_bank_transaction"("p_tx_id" "uuid", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_active_invoice_candidates"("refs" "text"[], "p_client_id" "uuid", "p_amount" numeric, "p_date" "date", "min_score" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_active_invoice_candidates"("refs" "text"[], "p_client_id" "uuid", "p_amount" numeric, "p_date" "date", "min_score" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_active_invoice_candidates"("refs" "text"[], "p_client_id" "uuid", "p_amount" numeric, "p_date" "date", "min_score" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_counterparty_candidates"("candidates" "text"[], "min_score" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_counterparty_candidates"("candidates" "text"[], "min_score" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_counterparty_candidates"("candidates" "text"[], "min_score" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_passive_invoice_candidates"("refs" "text"[], "p_supplier_id" "uuid", "p_collaborator_id" "uuid", "p_amount" numeric, "p_date" "date", "min_score" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_passive_invoice_candidates"("refs" "text"[], "p_supplier_id" "uuid", "p_collaborator_id" "uuid", "p_amount" numeric, "p_date" "date", "min_score" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_passive_invoice_candidates"("refs" "text"[], "p_supplier_id" "uuid", "p_collaborator_id" "uuid", "p_amount" numeric, "p_date" "date", "min_score" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_payment_candidates"("p_bank_transaction_id" "uuid", "p_days_window" integer, "min_score" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_payment_candidates"("p_bank_transaction_id" "uuid", "p_days_window" integer, "min_score" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_payment_candidates"("p_bank_transaction_id" "uuid", "p_days_window" integer, "min_score" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."safe_numeric"("val" "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."safe_numeric"("val" "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."safe_numeric"("val" "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_messages"("query_text" "text", "limit_val" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_messages"("query_text" "text", "limit_val" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_messages"("query_text" "text", "limit_val" integer) TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON FUNCTION "public"."send_payment_invite"("p_payment_id" "uuid", "p_webhook_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."send_payment_invite"("p_payment_id" "uuid", "p_webhook_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_payment_invite"("p_payment_id" "uuid", "p_webhook_url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_profile_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_profile_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_profile_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_process_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_process_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_process_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_sync_google_calendar"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_sync_google_calendar"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_sync_google_calendar"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unlink_payment_from_bank_transaction"("p_payment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."unlink_payment_from_bank_transaction"("p_payment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unlink_payment_from_bank_transaction"("p_payment_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."appointment_client_participants" TO "anon";
GRANT ALL ON TABLE "public"."appointment_client_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_client_participants" TO "service_role";



GRANT ALL ON TABLE "public"."appointment_google_sync" TO "anon";
GRANT ALL ON TABLE "public"."appointment_google_sync" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_google_sync" TO "service_role";



GRANT ALL ON TABLE "public"."appointment_internal_participants" TO "anon";
GRANT ALL ON TABLE "public"."appointment_internal_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_internal_participants" TO "service_role";



GRANT ALL ON TABLE "public"."appointment_type_links" TO "anon";
GRANT ALL ON TABLE "public"."appointment_type_links" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_type_links" TO "service_role";



GRANT ALL ON TABLE "public"."appointment_types" TO "anon";
GRANT ALL ON TABLE "public"."appointment_types" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_types" TO "service_role";



GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."assignments" TO "anon";
GRANT ALL ON TABLE "public"."assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."assignments" TO "service_role";



GRANT ALL ON TABLE "public"."availability_overrides" TO "anon";
GRANT ALL ON TABLE "public"."availability_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."availability_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."availability_rules" TO "anon";
GRANT ALL ON TABLE "public"."availability_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."availability_rules" TO "service_role";



GRANT ALL ON TABLE "public"."bank_statements" TO "anon";
GRANT ALL ON TABLE "public"."bank_statements" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_statements" TO "service_role";



GRANT ALL ON TABLE "public"."booking_assignments" TO "anon";
GRANT ALL ON TABLE "public"."booking_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."booking_categories" TO "anon";
GRANT ALL ON TABLE "public"."booking_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_categories" TO "service_role";



GRANT ALL ON TABLE "public"."booking_holds" TO "anon";
GRANT ALL ON TABLE "public"."booking_holds" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_holds" TO "service_role";



GRANT ALL ON TABLE "public"."booking_item_collaborators" TO "anon";
GRANT ALL ON TABLE "public"."booking_item_collaborators" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_item_collaborators" TO "service_role";



GRANT ALL ON TABLE "public"."booking_items" TO "anon";
GRANT ALL ON TABLE "public"."booking_items" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_items" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."channel_members" TO "anon";
GRANT ALL ON TABLE "public"."channel_members" TO "authenticated";
GRANT ALL ON TABLE "public"."channel_members" TO "service_role";



GRANT ALL ON TABLE "public"."channels" TO "anon";
GRANT ALL ON TABLE "public"."channels" TO "authenticated";
GRANT ALL ON TABLE "public"."channels" TO "service_role";



GRANT ALL ON TABLE "public"."client_contacts" TO "anon";
GRANT ALL ON TABLE "public"."client_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."client_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."collaborator_google_auth" TO "anon";
GRANT ALL ON TABLE "public"."collaborator_google_auth" TO "authenticated";
GRANT ALL ON TABLE "public"."collaborator_google_auth" TO "service_role";



GRANT ALL ON TABLE "public"."collaborator_rest_days" TO "anon";
GRANT ALL ON TABLE "public"."collaborator_rest_days" TO "authenticated";
GRANT ALL ON TABLE "public"."collaborator_rest_days" TO "service_role";



GRANT ALL ON TABLE "public"."collaborator_services" TO "anon";
GRANT ALL ON TABLE "public"."collaborator_services" TO "authenticated";
GRANT ALL ON TABLE "public"."collaborator_services" TO "service_role";



GRANT ALL ON TABLE "public"."collaborators" TO "anon";
GRANT ALL ON TABLE "public"."collaborators" TO "authenticated";
GRANT ALL ON TABLE "public"."collaborators" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_members" TO "anon";
GRANT ALL ON TABLE "public"."conversation_members" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_members" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."debug_logs" TO "anon";
GRANT ALL ON TABLE "public"."debug_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."debug_logs" TO "service_role";



GRANT ALL ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON TABLE "public"."external_busy_cache" TO "anon";
GRANT ALL ON TABLE "public"."external_busy_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."external_busy_cache" TO "service_role";



GRANT ALL ON TABLE "public"."external_calendar_connections" TO "anon";
GRANT ALL ON TABLE "public"."external_calendar_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."external_calendar_connections" TO "service_role";



GRANT ALL ON TABLE "public"."finance_movements" TO "anon";
GRANT ALL ON TABLE "public"."finance_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_movements" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_movements" TO "anon";
GRANT ALL ON TABLE "public"."invoice_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_movements" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_orders" TO "anon";
GRANT ALL ON TABLE "public"."invoice_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_orders" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_payments" TO "anon";
GRANT ALL ON TABLE "public"."invoice_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_payments" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."message_attachments" TO "anon";
GRANT ALL ON TABLE "public"."message_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."message_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."message_reads" TO "anon";
GRANT ALL ON TABLE "public"."message_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."message_reads" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notification_types" TO "anon";
GRANT ALL ON TABLE "public"."notification_types" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_types" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."order_collaborators" TO "anon";
GRANT ALL ON TABLE "public"."order_collaborators" TO "authenticated";
GRANT ALL ON TABLE "public"."order_collaborators" TO "service_role";



GRANT ALL ON TABLE "public"."order_contacts" TO "anon";
GRANT ALL ON TABLE "public"."order_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."order_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."passive_invoices" TO "anon";
GRANT ALL ON TABLE "public"."passive_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."passive_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."pm_item_assignees" TO "anon";
GRANT ALL ON TABLE "public"."pm_item_assignees" TO "authenticated";
GRANT ALL ON TABLE "public"."pm_item_assignees" TO "service_role";



GRANT ALL ON TABLE "public"."pm_item_comments" TO "anon";
GRANT ALL ON TABLE "public"."pm_item_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."pm_item_comments" TO "service_role";



GRANT ALL ON TABLE "public"."pm_item_incarichi" TO "anon";
GRANT ALL ON TABLE "public"."pm_item_incarichi" TO "authenticated";
GRANT ALL ON TABLE "public"."pm_item_incarichi" TO "service_role";



GRANT ALL ON TABLE "public"."pm_item_links" TO "anon";
GRANT ALL ON TABLE "public"."pm_item_links" TO "authenticated";
GRANT ALL ON TABLE "public"."pm_item_links" TO "service_role";



GRANT ALL ON TABLE "public"."pm_items" TO "anon";
GRANT ALL ON TABLE "public"."pm_items" TO "authenticated";
GRANT ALL ON TABLE "public"."pm_items" TO "service_role";



GRANT ALL ON TABLE "public"."pm_space_assignees" TO "anon";
GRANT ALL ON TABLE "public"."pm_space_assignees" TO "authenticated";
GRANT ALL ON TABLE "public"."pm_space_assignees" TO "service_role";



GRANT ALL ON TABLE "public"."pm_spaces" TO "anon";
GRANT ALL ON TABLE "public"."pm_spaces" TO "authenticated";
GRANT ALL ON TABLE "public"."pm_spaces" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."reactions" TO "anon";
GRANT ALL ON TABLE "public"."reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."reactions" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."system_config" TO "anon";
GRANT ALL ON TABLE "public"."system_config" TO "authenticated";
GRANT ALL ON TABLE "public"."system_config" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_categories" TO "anon";
GRANT ALL ON TABLE "public"."transaction_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_categories" TO "service_role";



GRANT ALL ON TABLE "public"."user_notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notification_preferences" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







