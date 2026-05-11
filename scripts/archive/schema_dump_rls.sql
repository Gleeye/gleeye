


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

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bank_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "description" "text",
    "amount" numeric(15,2),
    "date" "date",
    "category_id" "uuid",
    "client_id" "uuid",
    "supplier_id" "uuid",
    "invoice_id" "uuid",
    "passive_invoice_id" "uuid",
    "attachment_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "collaborator_id" "uuid",
    "linked_invoices" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'posted'::"text" NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "review_notes" "text",
    CONSTRAINT "bank_transactions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'posted'::"text", 'rejected'::"text"])))
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
    "assignment_id" "text",
    "amount" numeric(15,2),
    "status" "text" DEFAULT 'pending'::"text",
    "payment_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "type" "text" DEFAULT 'passive'::"text",
    "invoice_id" "uuid",
    "invited_at" timestamp with time zone,
    "bank_transaction_id" "uuid"
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


CREATE TABLE IF NOT EXISTS "public"."appointment_client_participants" (
    "appointment_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "required" boolean DEFAULT true,
    "added_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."appointment_client_participants" OWNER TO "postgres";


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
    "is_available" boolean DEFAULT false NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "end_date" "date",
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


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_name" "text" NOT NULL,
    "client_code" "text",
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
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
    "full_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "role" "text",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true,
    "document_health_card_back_url" "text",
    "name" "text",
    "first_name" "text",
    "last_name" "text",
    "birth_date" "date",
    "birth_place" "text",
    "fiscal_code" "text",
    "address" "text",
    "city" "text",
    "province" "text",
    "cap" "text",
    "pec" "text",
    "vat_number" "text",
    "bank_name" "text",
    "iban" "text",
    "tags" "text" DEFAULT '[]'::"jsonb",
    "avatar_url" "text",
    "airtable_id" "text"
);


ALTER TABLE "public"."collaborators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "client_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "first_name" "text",
    "last_name" "text",
    "tags" "text",
    "comments" "text",
    "mobile" "text",
    "role" "text",
    "airtable_id" "text"
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
    "name" "text" NOT NULL
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


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_number" "text",
    "date" "date",
    "amount" numeric(15,2),
    "client_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_number" "text",
    "title" "text",
    "client_id" "uuid",
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "payment_mode" "text" DEFAULT 'saldo'::"text",
    "deposit_percentage" numeric DEFAULT 0,
    "balance_percentage" numeric DEFAULT 0,
    "installment_type" "text" DEFAULT 'Mensile'::"text",
    "installments_count" integer DEFAULT 1,
    "status_works" "text" DEFAULT 'In Attesa'::"text",
    "offer_status" "text" DEFAULT 'Bozza'::"text",
    "pm_id" "uuid",
    "cloud_links" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."orders"."cloud_links" IS 'List of external resource links: [{type, url, label}]';



CREATE TABLE IF NOT EXISTS "public"."passive_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_number" "text",
    "issue_date" "date",
    "amount" numeric(15,2),
    "supplier_id" "uuid",
    "collaborator_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "service_description" "text",
    "related_orders" "text",
    "tax_amount" numeric(15,2) DEFAULT 0,
    "amount_tax_included" numeric(15,2),
    "amount_tax_excluded" numeric(15,2),
    "vat_rate" numeric(5,2),
    "vat_eligibility" "text",
    "attachment_url" "text",
    "status" "text" DEFAULT 'Da Pagare'::"text",
    "payment_date" "date",
    "category" "text",
    "ritenuta" numeric(15,2) DEFAULT 0,
    "rivalsa_inps" numeric(15,2) DEFAULT 0,
    "stamp_duty" numeric(15,2) DEFAULT 0,
    "iva_attiva" boolean DEFAULT false,
    "notes" "text"
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
    "archived_at" timestamp with time zone,
    "cloud_links" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."pm_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."pm_items"."cloud_links" IS 'List of external resource links: [{type, url, label}]';



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
    "cloud_links" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."pm_spaces" OWNER TO "postgres";


COMMENT ON COLUMN "public"."pm_spaces"."cloud_links" IS 'List of external resource links: [{type, url, label}]';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "role" "text" DEFAULT 'user'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "avatar_url" "text",
    "full_name" "text",
    "timezone" "text" DEFAULT 'Europe/Rome'::"text"
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
    "type" "text",
    "department" "text",
    "price" numeric(15,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "organization_id" "uuid",
    "cost" numeric,
    "margin" numeric,
    "margin_percentage" numeric,
    "tags" "text"
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "archived" boolean DEFAULT false,
    "website" "text",
    "vat_number" "text",
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
    "bank_iban" "text",
    "notes" "text"
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


CREATE TABLE IF NOT EXISTS "public"."transaction_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
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
    ADD CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id");



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
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_busy_cache"
    ADD CONSTRAINT "external_busy_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_calendar_connections"
    ADD CONSTRAINT "external_calendar_connections_collaborator_id_provider_key" UNIQUE ("collaborator_id", "provider");



ALTER TABLE ONLY "public"."external_calendar_connections"
    ADD CONSTRAINT "external_calendar_connections_pkey" PRIMARY KEY ("id");



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
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_config"
    ADD CONSTRAINT "system_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."transaction_categories"
    ADD CONSTRAINT "transaction_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_notification_preferences"
    ADD CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_notification_preferences"
    ADD CONSTRAINT "user_notification_preferences_user_id_notification_type_id_key" UNIQUE ("user_id", "notification_type_id");



CREATE INDEX "bank_transactions_status_date_idx" ON "public"."bank_transactions" USING "btree" ("status", "date" DESC);



CREATE INDEX "idx_appointments_client" ON "public"."appointments" USING "btree" ("client_id");



CREATE INDEX "idx_appointments_order" ON "public"."appointments" USING "btree" ("order_id");



CREATE INDEX "idx_appointments_start" ON "public"."appointments" USING "btree" ("start_time");



CREATE INDEX "idx_appt_internal_collab" ON "public"."appointment_internal_participants" USING "btree" ("collaborator_id");



CREATE INDEX "idx_bank_trans_collaborator_id" ON "public"."bank_transactions" USING "btree" ("collaborator_id");



CREATE INDEX "idx_bookings_range" ON "public"."bookings" USING "btree" ("start_time", "end_time");



CREATE INDEX "idx_busy_cache_range" ON "public"."external_busy_cache" USING "btree" ("collaborator_id", "start_time", "end_time");



CREATE INDEX "idx_debug_logs_level" ON "public"."debug_logs" USING "btree" ("level");



CREATE INDEX "idx_notification_types_key" ON "public"."notification_types" USING "btree" ("key");



CREATE INDEX "idx_notifications_collab" ON "public"."notifications" USING "btree" ("collaborator_id", "is_read", "created_at" DESC);



CREATE INDEX "idx_notifications_email_queued" ON "public"."notifications" USING "btree" ("email_status") WHERE ("email_status" = 'queued'::"text");



CREATE INDEX "idx_notifications_user" ON "public"."notifications" USING "btree" ("user_id", "is_read", "created_at" DESC);



CREATE UNIQUE INDEX "idx_pm_assignees_dedupe_collab" ON "public"."pm_item_assignees" USING "btree" ("pm_item_ref", "collaborator_ref") WHERE ("collaborator_ref" IS NOT NULL);



CREATE UNIQUE INDEX "idx_pm_assignees_dedupe_user" ON "public"."pm_item_assignees" USING "btree" ("pm_item_ref", "user_ref") WHERE ("user_ref" IS NOT NULL);



CREATE INDEX "idx_pm_comments_item" ON "public"."pm_item_comments" USING "btree" ("pm_item_ref", "created_at");



CREATE INDEX "idx_pm_item_incarichi_ref" ON "public"."pm_item_incarichi" USING "btree" ("incarico_ref");



CREATE INDEX "idx_pm_items_due" ON "public"."pm_items" USING "btree" ("space_ref", "due_date");



CREATE INDEX "idx_pm_items_parent" ON "public"."pm_items" USING "btree" ("parent_ref");



CREATE INDEX "idx_pm_items_space" ON "public"."pm_items" USING "btree" ("space_ref");



CREATE INDEX "idx_pm_items_status" ON "public"."pm_items" USING "btree" ("space_ref", "status");



CREATE INDEX "idx_system_config_key" ON "public"."system_config" USING "btree" ("key");



CREATE INDEX "idx_user_notif_prefs_user" ON "public"."user_notification_preferences" USING "btree" ("user_id");



CREATE INDEX "messages_fts_idx" ON "public"."messages" USING "gin" ("fts");



CREATE OR REPLACE TRIGGER "notify_collaborator_assignment_trigger" AFTER INSERT ON "public"."booking_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_collaborator_assignment"();



CREATE OR REPLACE TRIGGER "on_booking_assignment_created" AFTER INSERT ON "public"."booking_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_sync_google_calendar"();



CREATE OR REPLACE TRIGGER "set_collaborator_google_auth_updated_at" BEFORE UPDATE ON "public"."collaborator_google_auth" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "sync_profile_name_trigger" AFTER INSERT OR UPDATE OF "full_name" ON "public"."collaborators" FOR EACH ROW EXECUTE FUNCTION "public"."sync_profile_name"();



CREATE OR REPLACE TRIGGER "trg_handle_new_message" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_message"();



CREATE OR REPLACE TRIGGER "trg_payment_invoice_link" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."payment_invoice_link_trigger"();



CREATE OR REPLACE TRIGGER "trg_process_notification" AFTER INSERT ON "public"."notifications" FOR EACH ROW WHEN (("new"."email_status" = 'queued'::"text")) EXECUTE FUNCTION "public"."trigger_process_notification"();



ALTER TABLE ONLY "public"."appointment_client_participants"
    ADD CONSTRAINT "appointment_client_participants_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_client_participants"
    ADD CONSTRAINT "appointment_client_participants_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."availability_overrides"
    ADD CONSTRAINT "availability_overrides_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."availability_rules"
    ADD CONSTRAINT "availability_rules_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."availability_rules"
    ADD CONSTRAINT "availability_rules_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."booking_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."transaction_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_passive_invoice_id_fkey" FOREIGN KEY ("passive_invoice_id") REFERENCES "public"."passive_invoices"("id") ON DELETE SET NULL;



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
    ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."channel_members"
    ADD CONSTRAINT "channel_members_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_members"
    ADD CONSTRAINT "channel_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



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
    ADD CONSTRAINT "collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



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



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



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



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pm_id_fkey" FOREIGN KEY ("pm_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."passive_invoices"
    ADD CONSTRAINT "passive_invoices_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."passive_invoices"
    ADD CONSTRAINT "passive_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "public"."bank_transactions"("id");



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
    ADD CONSTRAINT "pm_spaces_ref_ordine_fkey" FOREIGN KEY ("ref_ordine") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



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



ALTER TABLE ONLY "public"."user_notification_preferences"
    ADD CONSTRAINT "user_notification_preferences_notification_type_id_fkey" FOREIGN KEY ("notification_type_id") REFERENCES "public"."notification_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_notification_preferences"
    ADD CONSTRAINT "user_notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admin can do everything on bank_statements" ON "public"."bank_statements" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admin can do everything on collaborator_services" ON "public"."collaborator_services" USING ((( SELECT "profiles"."role"
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



CREATE POLICY "Allow all for authenticated users" ON "public"."collaborator_google_auth" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public inserts to bookings" ON "public"."bookings" FOR INSERT WITH CHECK (true);



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



CREATE POLICY "Public access availability_overrides" ON "public"."availability_overrides" USING (true);



CREATE POLICY "Public access availability_rules" ON "public"."availability_rules" USING (true);



CREATE POLICY "Public access bank_statements" ON "public"."bank_statements" USING (true);



CREATE POLICY "Public access bank_transactions" ON "public"."bank_transactions" USING (true);



CREATE POLICY "Public access booking_assignments" ON "public"."booking_assignments" USING (true);



CREATE POLICY "Public access booking_categories" ON "public"."booking_categories" USING (true);



CREATE POLICY "Public access booking_holds" ON "public"."booking_holds" USING (true);



CREATE POLICY "Public access booking_item_collaborators" ON "public"."booking_item_collaborators" USING (true);



CREATE POLICY "Public access booking_items" ON "public"."booking_items" USING (true);



CREATE POLICY "Public access bookings" ON "public"."bookings" USING (true);



CREATE POLICY "Public access channel_members" ON "public"."channel_members" USING (true);



CREATE POLICY "Public access channels" ON "public"."channels" USING (true);



CREATE POLICY "Public access clients" ON "public"."clients" USING (true);



CREATE POLICY "Public access collaborator_google_auth" ON "public"."collaborator_google_auth" USING (true);



CREATE POLICY "Public access collaborator_rest_days" ON "public"."collaborator_rest_days" USING (true);



CREATE POLICY "Public access collaborator_services" ON "public"."collaborator_services" USING (true);



CREATE POLICY "Public access collaborators" ON "public"."collaborators" USING (true);



CREATE POLICY "Public access contacts" ON "public"."contacts" USING (true);



CREATE POLICY "Public access conversation_members" ON "public"."conversation_members" USING (true);



CREATE POLICY "Public access conversations" ON "public"."conversations" USING (true);



CREATE POLICY "Public access debug_logs" ON "public"."debug_logs" USING (true);



CREATE POLICY "Public access departments" ON "public"."departments" USING (true);



CREATE POLICY "Public access external_busy_cache" ON "public"."external_busy_cache" USING (true);



CREATE POLICY "Public access external_calendar_connections" ON "public"."external_calendar_connections" USING (true);



CREATE POLICY "Public access invoices" ON "public"."invoices" USING (true);



CREATE POLICY "Public access message_attachments" ON "public"."message_attachments" USING (true);



CREATE POLICY "Public access message_reads" ON "public"."message_reads" USING (true);



CREATE POLICY "Public access messages" ON "public"."messages" USING (true);



CREATE POLICY "Public access notification_types" ON "public"."notification_types" USING (true);



CREATE POLICY "Public access notifications" ON "public"."notifications" USING (true);



CREATE POLICY "Public access order_collaborators" ON "public"."order_collaborators" USING (true);



CREATE POLICY "Public access order_contacts" ON "public"."order_contacts" USING (true);



CREATE POLICY "Public access orders" ON "public"."orders" USING (true);



CREATE POLICY "Public access passive_invoices" ON "public"."passive_invoices" USING (true);



CREATE POLICY "Public access payments" ON "public"."payments" USING (true);



CREATE POLICY "Public access pm_item_assignees" ON "public"."pm_item_assignees" USING (true);



CREATE POLICY "Public access pm_item_comments" ON "public"."pm_item_comments" USING (true);



CREATE POLICY "Public access pm_item_incarichi" ON "public"."pm_item_incarichi" USING (true);



CREATE POLICY "Public access pm_item_links" ON "public"."pm_item_links" USING (true);



CREATE POLICY "Public access pm_items" ON "public"."pm_items" USING (true);



CREATE POLICY "Public access pm_space_assignees" ON "public"."pm_space_assignees" USING (true);



CREATE POLICY "Public access pm_spaces" ON "public"."pm_spaces" USING (true);



CREATE POLICY "Public access profiles" ON "public"."profiles" USING (true);



CREATE POLICY "Public access reactions" ON "public"."reactions" USING (true);



CREATE POLICY "Public access services" ON "public"."services" USING (true);



CREATE POLICY "Public access suppliers" ON "public"."suppliers" USING (true);



CREATE POLICY "Public access system_config" ON "public"."system_config" USING (true);



CREATE POLICY "Public access transaction_categories" ON "public"."transaction_categories" USING (true);



CREATE POLICY "Public access user_notification_preferences" ON "public"."user_notification_preferences" USING (true);



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



CREATE POLICY "Users can insert own preferences" ON "public"."user_notification_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own preferences" ON "public"."user_notification_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR ("collaborator_id" IN ( SELECT "collaborators"."id"
   FROM "public"."collaborators"
  WHERE ("collaborators"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own preferences" ON "public"."user_notification_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("collaborator_id" IN ( SELECT "collaborators"."id"
   FROM "public"."collaborators"
  WHERE ("collaborators"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users view own bookings" ON "public"."bookings" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("auth"."uid"() IN ( SELECT "booking_assignments"."collaborator_id"
   FROM "public"."booking_assignments"
  WHERE ("booking_assignments"."booking_id" = "bookings"."id")))));



ALTER TABLE "public"."appointment_client_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointment_internal_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointment_type_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointment_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."availability_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."availability_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bank_statements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bank_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_holds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_item_collaborators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."channel_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."channels" ENABLE ROW LEVEL SECURITY;


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


ALTER TABLE "public"."external_busy_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."external_calendar_connections" ENABLE ROW LEVEL SECURITY;


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



ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_reads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_collaborators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_contacts" ENABLE ROW LEVEL SECURITY;


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


ALTER TABLE "public"."transaction_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_notification_preferences" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TABLE "public"."bank_transactions" TO "anon";
GRANT ALL ON TABLE "public"."bank_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_transactions" TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_bank_transaction"("p_tx_id" "uuid", "p_category_id" "uuid", "p_client_id" "uuid", "p_supplier_id" "uuid", "p_collaborator_id" "uuid", "p_active_invoice_id" "uuid", "p_passive_invoice_id" "uuid", "p_payment_id" "uuid", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_bank_transaction"("p_tx_id" "uuid", "p_category_id" "uuid", "p_client_id" "uuid", "p_supplier_id" "uuid", "p_collaborator_id" "uuid", "p_active_invoice_id" "uuid", "p_passive_invoice_id" "uuid", "p_payment_id" "uuid", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_bank_transaction"("p_tx_id" "uuid", "p_category_id" "uuid", "p_client_id" "uuid", "p_supplier_id" "uuid", "p_collaborator_id" "uuid", "p_active_invoice_id" "uuid", "p_passive_invoice_id" "uuid", "p_payment_id" "uuid", "p_note" "text") TO "service_role";



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



GRANT ALL ON FUNCTION "public"."mark_message_read"("p_message_id" "uuid", "p_channel_id" "uuid", "p_conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_message_read"("p_message_id" "uuid", "p_channel_id" "uuid", "p_conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_message_read"("p_message_id" "uuid", "p_channel_id" "uuid", "p_conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_collaborator_assignment"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_collaborator_assignment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_collaborator_assignment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."payment_invoice_link_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."payment_invoice_link_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."payment_invoice_link_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_bank_transaction"("p_tx_id" "uuid", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_bank_transaction"("p_tx_id" "uuid", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_bank_transaction"("p_tx_id" "uuid", "p_note" "text") TO "service_role";



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



GRANT ALL ON TABLE "public"."appointment_client_participants" TO "anon";
GRANT ALL ON TABLE "public"."appointment_client_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_client_participants" TO "service_role";



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







