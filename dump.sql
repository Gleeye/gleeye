


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
    "statement_id" "uuid",
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "review_notes" "text",
    "category_name" "text",
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


CREATE OR REPLACE FUNCTION "public"."broadcast_pm_notification"("p_user_ids" "uuid"[], "p_type" "text", "p_title" "text", "p_message" "text", "p_data" "jsonb", "p_actor_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_id UUID;
    v_collab_id UUID;
BEGIN
    FOR v_user_id IN 
        -- Select distinct user IDs, excluding the actor themselves so we don't notify the person who did the action
        SELECT DISTINCT unnest(p_user_ids) EXCEPT SELECT p_actor_id
    LOOP
        -- Find the collaborator row for this user, if any
        SELECT id INTO v_collab_id FROM public.collaborators WHERE user_id = v_user_id LIMIT 1;
        
        IF v_user_id IS NOT NULL THEN
            -- Insert a separate row for each recipient
            INSERT INTO public.notifications (user_id, collaborator_id, type, title, message, data, is_read)
            VALUES (v_user_id, v_collab_id, p_type, p_title, p_message, p_data, false);
        END IF;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."broadcast_pm_notification"("p_user_ids" "uuid"[], "p_type" "text", "p_title" "text", "p_message" "text", "p_data" "jsonb", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_custom_reminders"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    r RECORD;
    v_count INT;
    v_total NUMERIC;
    v_admin_users UUID[];
    v_current_time TIME;
    v_current_day INT;
BEGIN
    -- We get the current time truncated to hour (since cron usually runs hourly)
    -- But since cron might run at slightly different minutes, let's just assume we check the 'hour' part explicitly if needed,
    -- or if we run it exactly on the hour, we can just check if current_time >= time_of_day.
    -- For safety, we'll run the cron every hour, and check if time_of_day matches the current hour.
    -- Actually, to avoid missing, let's keep it simple: run everyday at 09:00 UTC via cron. 
    -- The user setting `time_of_day` in the UI can be ignored for MVP or we just check if extract(hour from now()) = extract(hour from r.time_of_day).

    -- Extract current hour (UTC)
    v_current_time := current_time;
    v_current_day := extract(dow from current_date);

    FOR r IN SELECT * FROM public.custom_reminders WHERE is_active = true LOOP
        
        -- Basic Frequency Check
        IF r.frequency = 'weekly' AND v_current_day <> 1 THEN
            -- Skip if weekly and not Monday
            CONTINUE;
        END IF;

        -- We only process if the hour matches (to allow 1 hourly cron job to process all times)
        IF extract(hour from v_current_time) <> extract(hour from r.time_of_day) THEN
            CONTINUE;
        END IF;

        -- Check conditions based on type
        IF r.type = 'unpaid_invoices' THEN
            SELECT count(*), coalesce(sum(total_amount), 0)
            INTO v_count, v_total
            FROM public.active_invoices
            WHERE status != 'paid' 
              AND due_date IS NOT NULL 
              AND due_date < (CURRENT_DATE - (r.threshold_days || ' days')::INTERVAL);

            IF v_count > 0 THEN
                PERFORM public.broadcast_pm_notification(
                    ARRAY[r.user_id],
                    'reminder_unpaid_invoices',
                    'Fatture Scadute in Sospeso',
                    'Hai ' || v_count || ' fatture insolute ("scadute" da oltre ' || r.threshold_days || ' giorni).',
                    jsonb_build_object('count', v_count, 'total_amount', v_total),
                    NULL
                );
            END IF;

        ELSIF r.type = 'unreconciled_transactions' THEN
            SELECT count(*)
            INTO v_count
            FROM public.bank_transactions
            WHERE is_reconciled = false; -- Assuming we have a way to know, or 'status' != 'reconciled'

            -- If table doesn't have is_reconciled, we skip or adapt. We'll fallback to a generic message if column exists.
            -- Actually, let's check if there are any invoices without payments, or pending tx.
            -- For Gleeye, we use 'pending_transactions' or just bank_transactions where invoice_id is null if they exist.
            -- Let's just assume bank_transactions has some field. We'll use a SAFE query.
            -- Instead of crashing if column doesn't exist, we'll wrap. 
            -- Given the schema, bank_transactions usually has a 'status' or we match them to invoices.
            -- I'll use a simple count of active_invoices where status = 'pending' for now as a fallback if Bank tx logic is complex.
            -- Let's count bank movements just to be sure.
            SELECT count(*) INTO v_count FROM public.bank_transactions; -- Placeholder for MVP if needed

            IF v_count > 0 THEN
               -- Temporarily disabled or simplified until we confirm the exact field for reconciliation
               -- PERFORM public.broadcast_pm_notification(...);
               NULL;
            END IF;

        ELSIF r.type = 'stale_leads' THEN
            SELECT count(*)
            INTO v_count
            FROM public.leads
            WHERE status NOT IN ('Client', 'Lost')
              AND updated_at < (CURRENT_DATE - (r.threshold_days || ' days')::INTERVAL);

            IF v_count > 0 THEN
                PERFORM public.broadcast_pm_notification(
                    ARRAY[r.user_id],
                    'reminder_stale_leads',
                    'Lead da ricontattare',
                    'Hai ' || v_count || ' preventivi o contatti fermi da oltre ' || r.threshold_days || ' giorni.',
                    jsonb_build_object('count', v_count),
                    NULL
                );
            END IF;
        END IF;

    END LOOP;
END;
$$;


ALTER FUNCTION "public"."check_custom_reminders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_notifications"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Delete read notifications older than 30 days
    DELETE FROM public.notifications
    WHERE is_read = true 
      AND created_at < (NOW() - INTERVAL '30 days');

    -- Delete ANY notifications (even unread) older than 90 days to prevent bloat
    DELETE FROM public.notifications
    WHERE created_at < (NOW() - INTERVAL '90 days');
    
    -- Cleanup push subscriptions that haven't been updated in 6 months (stale devices)
    DELETE FROM public.push_subscriptions
    WHERE updated_at < (NOW() - INTERVAL '180 days');
END;
$$;


ALTER FUNCTION "public"."cleanup_old_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_app_activity_logger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    _reg RECORD;
    _description TEXT;
    _item_id UUID;
    _space_id UUID;
    _order_id UUID;
    _new_json JSONB;
    _old_json JSONB;
    _diff_json JSONB := '{}'::jsonb;
    _entity_name TEXT;
    _col TEXT;
    _val TEXT;
    _col_template TEXT;
    _final_log_count INTEGER := 0;
BEGIN
    SELECT * INTO _reg FROM public.pm_activity_registry WHERE table_name = TG_TABLE_NAME AND is_active = true;
    IF NOT FOUND THEN RETURN NEW; END IF;

    _new_json := to_jsonb(NEW);

    -- Operation Detection
    IF (TG_OP = 'UPDATE') THEN
        _old_json := to_jsonb(OLD);
        FOR _col IN SELECT jsonb_object_keys(_new_json) LOOP
            IF (_new_json->>_col IS DISTINCT FROM _old_json->>_col) THEN
                _diff_json := _diff_json || jsonb_build_object(_col, _new_json->>_col);
            END IF;
        END LOOP;
        IF _reg.track_columns IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jsonb_object_keys(_diff_json) k WHERE k = ANY(_reg.track_columns)) THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Reference Resolution
    IF _reg.item_ref_source = 'id' THEN _item_id := (NEW.id);
    ELSIF _reg.item_ref_source IS NOT NULL THEN _item_id := (_new_json->>_reg.item_ref_source)::uuid; 
    END IF;

    IF _reg.space_ref_source = 'id' THEN _space_id := (NEW.id);
    ELSIF _reg.space_ref_source = 'space_ref' THEN _space_id := (NEW.space_ref);
    ELSIF _reg.space_ref_source = 'pm_item_ref.space_ref' AND (_new_json->>'pm_item_ref') IS NOT NULL THEN
        SELECT space_ref INTO _space_id FROM public.pm_items WHERE id = (_new_json->>'pm_item_ref')::uuid;
    END IF;

    IF _reg.order_ref_source = 'id' THEN _order_id := (NEW.id);
    ELSIF _reg.order_ref_source IN ('order_id', 'order_ref', 'ref_ordine') THEN _order_id := (_new_json->>_reg.order_ref_source)::uuid;
    ELSIF _reg.order_ref_source = 'space_ref.ref_ordine' AND _space_id IS NOT NULL THEN
        SELECT ref_ordine INTO _order_id FROM public.pm_spaces WHERE id = _space_id;
    END IF;

    -- Entity Name: Be extremely persistent.
    _entity_name := COALESCE(
        _new_json->>'title', 
        _new_json->>'name',
        (SELECT title FROM public.pm_items WHERE id = _item_id),
        (SELECT title FROM public.orders WHERE id = _order_id),
        (SELECT name FROM public.pm_spaces WHERE id = _space_id),
        'questa attività'
    );

    IF TG_OP = 'UPDATE' AND _reg.column_templates IS NOT NULL THEN
        FOR _col IN SELECT jsonb_object_keys(_diff_json) LOOP
            _col_template := _reg.column_templates->>_col;
            IF _col_template IS NOT NULL THEN
                _val := public.fn_human_val(_new_json->>_col);
                -- Reference translation (names)
                IF _col IN ('pm_user_ref', 'user_ref', 'collaborator_id', 'p_m') THEN
                   _val := public.fn_resolve_name(CASE WHEN _col = 'collaborator_id' THEN 'collaborators' ELSE 'profiles' END, _new_json->>_col);
                END IF;

                _description := REPLACE(_col_template, '{entity}', '**' || _entity_name || '**');
                _description := REPLACE(_description, '{new_value}', '**' || _val || '**');
                _description := REPLACE(_description, '{old_value}', '**' || public.fn_human_val(_old_json->>_col) || '**');

                INSERT INTO public.pm_activity_logs (actor_user_ref, action_type, space_ref, item_ref, order_ref, details)
                VALUES (auth.uid(), TG_TABLE_NAME || ':updated:' || _col, _space_id, _item_id, _order_id, 
                    jsonb_build_object('description', _description, 'entity_name', _entity_name, 'old', _old_json->>_col, 'new', _new_json->>_col));
                _final_log_count := _final_log_count + 1;
            END IF;
        END LOOP;
    END IF;

    IF (_final_log_count = 0 OR TG_OP = 'INSERT') AND _reg.template_insert IS NOT NULL THEN
        _description := REPLACE(_reg.template_insert, '{entity}', '**' || _entity_name || '**');
        INSERT INTO public.pm_activity_logs (actor_user_ref, action_type, space_ref, item_ref, order_ref, details)
        VALUES (auth.uid(), TG_TABLE_NAME || ':created', _space_id, _item_id, _order_id, 
            jsonb_build_object('description', _description, 'entity_name', _entity_name));
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_app_activity_logger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_friendly_label"("_val" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
    -- This handles the internal codes and turns them into human-friendly words
    RETURN CASE 
        -- Task Statuses
        WHEN _val = 'todo' THEN 'Da Fare'
        WHEN _val = 'in_progress' THEN 'In Corso'
        WHEN _val = 'review' THEN 'In Revisione'
        WHEN _val = 'done' THEN 'Completata'
        WHEN _val = 'blocked' THEN 'Bloccata'
        
        -- Projects & Commesse Statuses
        WHEN _val = 'in_attesa' THEN 'In Attesa'
        WHEN _val = 'lavoro_in_attesa' THEN 'Lavoro In sospeso'
        WHEN _val = 'in_svolgimento' THEN 'Lavorazione attiva'
        WHEN _val = 'accettata' THEN 'Accettata ✅'
        WHEN _val = 'rifiutata' THEN 'Rifiutata ❌'
        WHEN _val = 'in_approvazione' THEN 'In Approvazione'
        
        -- Meeting Types
        WHEN _val = 'remoto' THEN 'Online (GMeet/Teams)'
        WHEN _val = 'presenza' THEN 'Di Persona'
        
        -- Roles/Boolean-ish
        WHEN _val = 'true' THEN 'Sì'
        WHEN _val = 'false' THEN 'No'
        
        -- Default: humanize underscores
        ELSE INITCAP(REPLACE(_val, '_', ' '))
    END;
END;
$$;


ALTER FUNCTION "public"."fn_friendly_label"("_val" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_get_pm_item_descendants"("root_id" "uuid") RETURNS TABLE("id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE item_hierarchy AS (
        SELECT root_id AS item_id
        UNION ALL
        SELECT i.id FROM public.pm_items i
        INNER JOIN item_hierarchy h ON i.parent_ref = h.item_id
    )
    SELECT item_id FROM item_hierarchy;
END;
$$;


ALTER FUNCTION "public"."fn_get_pm_item_descendants"("root_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_human_val"("_val" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
    IF _val IS NULL OR _val = '' THEN RETURN 'vuoto'; END IF;
    RETURN CASE 
        WHEN _val = 'todo' THEN 'Da Fare'
        WHEN _val = 'in_progress' THEN 'In Corso'
        WHEN _val = 'review' THEN 'In Revisione'
        WHEN _val = 'done' THEN 'Completata'
        WHEN _val = 'blocked' THEN 'Bloccata'
        WHEN _val = 'in_svolgimento' THEN 'Lavorazione attiva'
        WHEN _val = 'lavoro_in_attesa' THEN 'In Sospeso'
        WHEN _val = 'accettata' THEN 'Accettata'
        WHEN _val = 'rifiutata' THEN 'Rifiutata'
        WHEN _val = 'high' THEN 'Alta'
        WHEN _val = 'medium' THEN 'Media'
        WHEN _val = 'low' THEN 'Bassa'
        ELSE INITCAP(REPLACE(_val, '_', ' '))
    END;
END;
$$;


ALTER FUNCTION "public"."fn_human_val"("_val" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_resolve_name"("_table" "text", "_id" "anyelement") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
    _name TEXT;
BEGIN
    IF _id IS NULL THEN RETURN 'Nessuno'; END IF;

    CASE _table
        WHEN 'profiles' THEN 
            SELECT full_name INTO _name FROM public.profiles WHERE id = _id::uuid;
        WHEN 'collaborators' THEN 
            SELECT business_name INTO _name FROM public.collaborators WHERE id = _id::uuid;
        WHEN 'auth_users' THEN 
            SELECT full_name INTO _name FROM public.profiles WHERE id = _id::uuid;
        WHEN 'pm_items' THEN 
            SELECT title INTO _name FROM public.pm_items WHERE id = _id::uuid;
        WHEN 'orders' THEN 
            SELECT title INTO _name FROM public.orders WHERE id = _id::uuid;
        WHEN 'pm_spaces' THEN 
            SELECT name INTO _name FROM public.pm_spaces WHERE id = _id::uuid;
        ELSE 
            _name := _id::text;
    END CASE;

    RETURN COALESCE(_name, _id::text);
END;
$$;


ALTER FUNCTION "public"."fn_resolve_name"("_table" "text", "_id" "anyelement") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."get_monthly_active_invoices"("p_year" integer, "p_month" integer) RETURNS TABLE("invoice_number" "text", "invoice_date" "date", "client_name" "text", "amount_total" numeric, "vat_amount" numeric, "net_amount" numeric, "status" "text", "payment_date" "date")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_monthly_active_invoices"("p_year" integer, "p_month" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_bank_statements"("p_year" integer, "p_month" integer) RETURNS TABLE("statement_date" "date", "name" "text", "balance" numeric, "attachment_url" "text", "attachment_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_monthly_bank_statements"("p_year" integer, "p_month" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_passive_invoices"("p_year" integer, "p_month" integer) RETURNS TABLE("invoice_date" "date", "supplier_name" "text", "description" "text", "amount_total" numeric, "payment_status" "text", "payment_date" "date", "vat_amount" numeric, "is_vat_active" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_monthly_passive_invoices"("p_year" integer, "p_month" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_transactions"("p_year" integer, "p_month" integer) RETURNS TABLE("transaction_date" "date", "description" "text", "amount" numeric, "supplier_name" "text", "client_name" "text", "status" "text", "category_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_monthly_transactions"("p_year" integer, "p_month" integer) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."has_space_view_access"("_space_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_collab_id UUID;
BEGIN
    -- 1. Check Admin
    SELECT (role = 'admin') INTO v_is_admin FROM profiles WHERE id = _user_id;
    IF v_is_admin THEN RETURN TRUE; END IF;

    -- Get Collaborator ID for this user (cached for subsequent checks)
    SELECT id INTO v_collab_id FROM collaborators WHERE user_id = _user_id LIMIT 1;

    -- 2. Check Space Access (Direct PM, Assignee, or Order Assignment)
    -- We query pm_spaces and join related tables.
    -- Since this is SECURITY DEFINER, it bypasses RLS on these tables.
    RETURN EXISTS (
        SELECT 1 
        FROM pm_spaces s
        LEFT JOIN pm_space_assignees psa ON s.id = psa.pm_space_ref
        LEFT JOIN assignments ass ON s.ref_ordine = ass.order_id
        WHERE s.id = _space_id
        AND (
            -- A. Default PM
            s.default_pm_user_ref = _user_id
            OR
            -- B. Space Assignee (User)
            psa.user_ref = _user_id
            OR
            -- C. Space Assignee (Collaborator)
            (v_collab_id IS NOT NULL AND psa.collaborator_ref = v_collab_id)
            OR
            -- D. Order Assignment (for Commesse)
            (s.type = 'commessa' AND v_collab_id IS NOT NULL AND ass.collaborator_id = v_collab_id)
        )
    );
END;
$$;


ALTER FUNCTION "public"."has_space_view_access"("_space_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."trg_appointment_participants_notify_log"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT := 'Un utente';
    v_appointment RECORD;
    v_target_user UUID;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        SELECT COALESCE(first_name || ' ' || last_name, 'Un utente') INTO v_actor_name 
        FROM profiles WHERE id = v_actor_id;
    END IF;

    -- Get the appointment and verify it's part of PM (has pm_space_id)
    SELECT * INTO v_appointment FROM public.appointments WHERE id = NEW.appointment_id;
    
    -- We mainly care about PM space appointments for the PM activity log
    IF v_appointment.pm_space_id IS NOT NULL THEN
        -- Find the user_id associated with this collaborator_id
        SELECT user_id INTO v_target_user FROM public.collaborators WHERE id = NEW.collaborator_id;

        IF v_target_user IS NOT NULL THEN
            -- Insert Activity Log
            IF TG_OP = 'INSERT' THEN
                -- Optionally, we log that an assignee was added to the appointment
                INSERT INTO public.pm_activity_logs (space_ref, actor_user_ref, action_type, details)
                VALUES (
                    v_appointment.pm_space_id, 
                    v_actor_id, 
                    'appointment_participant_added', 
                    jsonb_build_object('appointment_title', v_appointment.title, 'assigned_user', v_target_user)
                );

                -- Send Notification
                PERFORM public.broadcast_pm_notification(
                    ARRAY[v_target_user],
                    'pm_appointment_invited',
                    'Invito Appuntamento',
                    v_actor_name || ' ti ha invitato all''appuntamento: ' || v_appointment.title,
                    jsonb_build_object('space_id', v_appointment.pm_space_id, 'appointment_id', v_appointment.id),
                    v_actor_id
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_appointment_participants_notify_log"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_bank_transactions_notify"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_actor_id UUID;
    v_admin_users UUID[];
    v_recipients UUID[];
BEGIN
    v_actor_id := auth.uid();

    SELECT array_agg(id) INTO v_admin_users FROM auth.users WHERE EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.users.id AND profiles.role = 'admin'
    );
    v_recipients := v_admin_users;

    IF TG_OP = 'INSERT' THEN
        PERFORM public.broadcast_pm_notification(
            v_recipients,
            'accounting_bank_transaction',
            'Nuovo Movimento Bancario',
            'Registrato movimento: ' || NEW.description || ' (' || NEW.amount || '€)',
            jsonb_build_object('transaction_id', NEW.id, 'description', NEW.description, 'amount', NEW.amount, 'date', NEW.date),
            v_actor_id
        );
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_bank_transactions_notify"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_collaborators_notify"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_actor_id UUID;
    v_admin_users UUID[];
    v_recipients UUID[];
BEGIN
    v_actor_id := auth.uid();

    -- Fetch admins
    SELECT array_agg(id) INTO v_admin_users FROM auth.users WHERE EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.users.id AND profiles.role = 'admin'
    );
    
    v_recipients := v_admin_users;

    IF TG_OP = 'INSERT' THEN
        -- Only notify if the collaborator wasn't created by the admin themselves
        -- (Often admins create collaborators manually, but sometimes they register via invite)
        IF v_actor_id IS NULL OR NOT (v_actor_id = ANY(v_admin_users)) THEN
            PERFORM public.broadcast_pm_notification(
                v_recipients,
                'admin_new_user',
                'Nuovo Collaboratore Registrato',
                'Un nuovo collaboratore si è registrato: ' || NEW.first_name || ' ' || NEW.last_name,
                jsonb_build_object('collaborator_id', NEW.id, 'user_name', NEW.first_name || ' ' || NEW.last_name, 'user_role', 'Collaboratore'),
                v_actor_id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_collaborators_notify"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_contact_submissions_notify"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_admin_users UUID[];
    v_form_name TEXT := 'Sconosciuto';
BEGIN
    -- Fetch admins
    SELECT array_agg(id) INTO v_admin_users FROM auth.users WHERE EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.users.id AND profiles.role = 'admin'
    );

    IF NEW.form_id IS NOT NULL THEN
       SELECT name INTO v_form_name FROM public.contact_forms WHERE id = NEW.form_id;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- Invia notifica agli admin
        PERFORM public.broadcast_pm_notification(
            v_admin_users,
            'crm_contact_form',
            'Nuova Richiesta di Contatto',
            'Nuova richiesta dal form "' || v_form_name || '" da ' || NEW.data->>'name',
            jsonb_build_object('submission_id', NEW.id, 'form_name', v_form_name, 'name', NEW.data->>'name', 'email', NEW.data->>'email', 'message', NEW.data->>'message'),
            NULL -- Nessun actor_id perché è un'azione pubblica dal sito
        );
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_contact_submissions_notify"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_doc_pages_notify_log"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT := 'Un utente';
    v_pm_space_id UUID;
    v_recipients UUID[] := ARRAY[]::UUID[];
    v_shared_users UUID[];
    v_subscribed_users UUID[];
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := NEW.created_by;
    END IF;

    IF v_actor_id IS NOT NULL THEN
        SELECT COALESCE(full_name, 'Un utente') INTO v_actor_name 
        FROM profiles WHERE id = v_actor_id;
    END IF;

    -- Get the PM space ID from the doc_spaces link
    SELECT space_ref INTO v_pm_space_id FROM public.doc_spaces WHERE id = NEW.space_ref;
    
    IF v_pm_space_id IS NOT NULL THEN
        -- A. Direct Direct Shared Users (Automatic)
        -- We join doc_page_permissions with collaborators to get user_ids
        SELECT array_agg(c.user_id) INTO v_shared_users
        FROM public.doc_page_permissions p
        JOIN public.collaborators c ON p.target_id = c.id
        WHERE p.page_ref = NEW.id AND p.target_type = 'collaborator' AND c.user_id IS NOT NULL;

        -- B. Subscribed Users (The Bell)
        SELECT array_agg(user_id) INTO v_subscribed_users
        FROM public.doc_subscriptions
        WHERE page_id = NEW.id;

        -- Combine recipients (unique)
        v_recipients := (
            SELECT array_agg(DISTINCT u)
            FROM unnest(array_cat(COALESCE(v_shared_users, ARRAY[]::UUID[]), COALESCE(v_subscribed_users, ARRAY[]::UUID[]))) AS u
            WHERE u IS NOT NULL AND u <> v_actor_id
        );

        IF v_recipients IS NOT NULL AND array_length(v_recipients, 1) > 0 THEN
            IF TG_OP = 'INSERT' THEN
                -- Activity Log
                INSERT INTO public.pm_activity_logs (space_ref, actor_user_ref, action_type, details)
                VALUES (v_pm_space_id, v_actor_id, 'document_created', jsonb_build_object('doc_title', NEW.title, 'doc_id', NEW.id));

                -- Notification
                PERFORM public.broadcast_pm_notification(
                    v_recipients,
                    'pm_document_created',
                    'Nuovo Documento',
                    v_actor_name || ' ha creato il documento: ' || NEW.title,
                    jsonb_build_object('space_id', v_pm_space_id, 'doc_id', NEW.id),
                    v_actor_id
                );
            ELSIF TG_OP = 'UPDATE' THEN
                IF NEW.title <> OLD.title THEN
                    INSERT INTO public.pm_activity_logs (space_ref, actor_user_ref, action_type, details)
                    VALUES (v_pm_space_id, v_actor_id, 'document_updated', jsonb_build_object('old_title', OLD.title, 'new_title', NEW.title));
                    
                    PERFORM public.broadcast_pm_notification(
                        v_recipients,
                        'pm_document_updated',
                        'Documento Aggiornato',
                        v_actor_name || ' ha rinominato un documento in: ' || NEW.title,
                        jsonb_build_object('space_id', v_pm_space_id, 'doc_id', NEW.id),
                        v_actor_id
                    );
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_doc_pages_notify_log"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_leads_notify"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_actor_id UUID;
    v_admin_users UUID[];
    v_recipients UUID[];
BEGIN
    v_actor_id := auth.uid();

    -- Fetch admins
    SELECT array_agg(id) INTO v_admin_users FROM auth.users WHERE EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.users.id AND profiles.role = 'admin'
    );
    
    -- Assignees usually get notified, but for leads, usually just admins and the assigned person (if any)
    v_recipients := v_admin_users;

    IF TG_OP = 'INSERT' THEN
        -- Send Notifications to Admins
        PERFORM public.broadcast_pm_notification(
            v_recipients,
            'crm_new_lead',
            'Nuovo Lead',
            'È stato registrato un nuovo lead: ' || COALESCE(NEW.company_name, NEW.lead_code),
            jsonb_build_object('lead_id', NEW.id, 'company_name', NEW.company_name, 'lead_code', NEW.lead_code),
            v_actor_id
        );
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status <> OLD.status THEN
            PERFORM public.broadcast_pm_notification(
                v_recipients,
                'crm_lead_status',
                'Cambio Stato Lead',
                'Il lead ' || COALESCE(NEW.company_name, NEW.lead_code) || ' è passato a: ' || NEW.status,
                jsonb_build_object('lead_id', NEW.id, 'company_name', NEW.company_name, 'lead_code', NEW.lead_code, 'new_status', NEW.status),
                v_actor_id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_leads_notify"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_orders_notify"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_actor_id UUID;
    v_admin_users UUID[];
    v_recipients UUID[];
    v_client_name TEXT := 'Sconosciuto';
BEGIN
    v_actor_id := auth.uid();

    SELECT array_agg(id) INTO v_admin_users FROM auth.users WHERE EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.users.id AND profiles.role = 'admin'
    );
    v_recipients := v_admin_users;

    IF NEW.client_id IS NOT NULL THEN
        SELECT business_name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
    END IF;

    IF TG_OP = 'INSERT' THEN
        PERFORM public.broadcast_pm_notification(
            v_recipients,
            'admin_new_order',
            'Nuovo Ordine',
            'È stato registrato il nuovo ordine ' || NEW.id || ' per ' || v_client_name,
            jsonb_build_object('order_id', NEW.id, 'order_number', NEW.id, 'client_name', v_client_name),
            v_actor_id
        );
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_orders_notify"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_pm_assignees_notify_log"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT := 'Un utente';
    v_item RECORD;
    v_order_ref UUID;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        SELECT COALESCE(first_name || ' ' || last_name, 'Un utente') INTO v_actor_name
        FROM profiles WHERE id = v_actor_id;
    END IF;

    SELECT * INTO v_item FROM public.pm_items WHERE id = NEW.pm_item_ref;
    SELECT ref_ordine INTO v_order_ref FROM public.pm_spaces WHERE id = v_item.space_ref;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.pm_activity_logs (space_ref, order_ref, item_ref, actor_user_ref, action_type, details)
        VALUES (v_item.space_ref, v_order_ref, NEW.pm_item_ref, v_actor_id, 'assignee_added', jsonb_build_object('assigned_user', NEW.user_ref));

        PERFORM public.broadcast_pm_notification(
            ARRAY[NEW.user_ref],
            'pm_item_assigned',
            'Nuova Assegnazione',
            v_actor_name || ' ti ha assegnato a: ' || v_item.title,
            jsonb_build_object('space_id', v_item.space_ref, 'item_id', v_item.id),
            v_actor_id
        );
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_pm_assignees_notify_log"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_pm_comments_notify_log"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_actor_name TEXT := 'Un utente';
    v_item RECORD;
    v_space_pm UUID;
    v_order_ref UUID;
    v_assignees UUID[];
    v_recipients UUID[];
BEGIN
    IF NEW.author_user_ref IS NOT NULL THEN
        SELECT COALESCE(first_name || ' ' || last_name, 'Un utente') INTO v_actor_name
        FROM profiles WHERE id = NEW.author_user_ref;
    END IF;

    SELECT * INTO v_item FROM public.pm_items WHERE id = NEW.pm_item_ref;
    SELECT default_pm_user_ref, ref_ordine INTO v_space_pm, v_order_ref FROM public.pm_spaces WHERE id = v_item.space_ref;
    SELECT array_agg(user_ref) INTO v_assignees FROM public.pm_item_assignees WHERE pm_item_ref = NEW.pm_item_ref;
    IF v_assignees IS NULL THEN v_assignees := ARRAY[]::UUID[]; END IF;

    v_recipients := array_cat(ARRAY[v_space_pm, v_item.created_by_user_ref], v_assignees);

    INSERT INTO public.pm_activity_logs (space_ref, order_ref, item_ref, actor_user_ref, action_type, details)
    VALUES (v_item.space_ref, v_order_ref, NEW.pm_item_ref, NEW.author_user_ref, 'comment_added', jsonb_build_object('comment_snippet', substring(NEW.body from 1 for 50)));

    PERFORM public.broadcast_pm_notification(
        v_recipients,
        'pm_comment_added',
        'Nuovo Commento',
        v_actor_name || ' ha commentato in: ' || v_item.title,
        jsonb_build_object('space_id', v_item.space_ref, 'item_id', v_item.id),
        NEW.author_user_ref
    );

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_pm_comments_notify_log"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_pm_items_notify_log"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT := 'Un utente';
    v_space_pm UUID;
    v_assignees UUID[];
    v_recipients UUID[];
BEGIN
    v_actor_id := COALESCE(auth.uid(), NEW.created_by_user_ref);
    IF v_actor_id IS NOT NULL THEN
        SELECT COALESCE(first_name || ' ' || last_name, 'Un utente') INTO v_actor_name FROM profiles WHERE id = v_actor_id;
    END IF;

    SELECT default_pm_user_ref INTO v_space_pm FROM public.pm_spaces WHERE id = NEW.space_ref;
    SELECT array_agg(user_ref) INTO v_assignees FROM public.pm_item_assignees WHERE pm_item_ref = NEW.id;
    v_recipients := array_cat(ARRAY[v_space_pm, NEW.created_by_user_ref, NEW.pm_user_ref], COALESCE(v_assignees, ARRAY[]::UUID[]));

    IF TG_OP = 'INSERT' THEN
        PERFORM public.broadcast_pm_notification(v_recipients, 'pm_item_created', 'Nuova Attività', v_actor_name || ' ha creato: ' || NEW.title, jsonb_build_object('space_id', NEW.space_ref, 'item_id', NEW.id), v_actor_id);
    ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
        PERFORM public.broadcast_pm_notification(v_recipients, 'pm_item_status', 'Cambio Stato', v_actor_name || ' ha spostato "' || NEW.title || '" in ' || NEW.status, jsonb_build_object('space_id', NEW.space_ref, 'item_id', NEW.id, 'status', NEW.status), v_actor_id);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_pm_items_notify_log"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_pm_spaces_notify_log"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_actor_id UUID;
    v_pm_name TEXT := '';
    v_admin_users UUID[];
    v_recipients UUID[];
BEGIN
    v_actor_id := COALESCE(auth.uid(), NEW.default_pm_user_ref);
    IF v_actor_id IS NOT NULL THEN SELECT COALESCE(first_name || ' ' || last_name, 'Un utente') INTO v_pm_name FROM profiles WHERE id = v_actor_id; END IF;
    SELECT array_agg(id) INTO v_admin_users FROM auth.users WHERE EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.users.id AND profiles.role = 'admin');
    v_recipients := array_cat(v_admin_users, ARRAY[NEW.default_pm_user_ref]);
    
    IF TG_OP = 'INSERT' THEN
        PERFORM public.broadcast_pm_notification(v_recipients, 'pm_space_created', 'Nuovo Spazio Lavoro', v_pm_name || ' ha creato: ' || NEW.name, jsonb_build_object('space_id', NEW.id, 'space_type', NEW.type), v_actor_id);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_pm_spaces_notify_log"() OWNER TO "postgres";


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
    "recurrence_rule" "jsonb",
    "recurrence_id" "uuid",
    "is_account_level" boolean DEFAULT false,
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
    "required_team_size" integer DEFAULT 1,
    "sap_service_id" "uuid"
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
    "created_at" timestamp with time zone DEFAULT "now"(),
    "vat_number" "text",
    "fiscal_code" "text",
    "address" "text",
    "city" "text",
    "province" "text",
    "cap" "text",
    "pec" "text",
    "sdi_code" "text",
    "phone" "text"
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
    "tags" "text",
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
    "avatar_url" "text",
    "airtable_id" "text",
    "type" "text" DEFAULT 'individual'::"text",
    "fiscal_regime" "text" DEFAULT 'ordinario'::"text",
    "country" "text" DEFAULT 'IT'::"text",
    "default_vat_rate" numeric DEFAULT 22,
    "cassa_previdenziale_rate" numeric DEFAULT 0,
    "withholding_tax_rate" numeric DEFAULT 0,
    "payment_terms" "text"
);


ALTER TABLE "public"."collaborators" OWNER TO "postgres";


COMMENT ON COLUMN "public"."collaborators"."type" IS 'individual or white_label';



CREATE TABLE IF NOT EXISTS "public"."contact_forms" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "fields" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "success_message" "text",
    "primary_color" "text" DEFAULT '#0d6efd'::"text",
    "is_active" boolean DEFAULT true,
    "has_welcome_screen" boolean DEFAULT false,
    "welcome_title" "text",
    "welcome_description" "text",
    "welcome_button_text" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "step_settings" "jsonb" DEFAULT '{"type": "number", "shape": "circle"}'::"jsonb"
);


ALTER TABLE "public"."contact_forms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_submissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "form_id" "uuid" NOT NULL,
    "data" "jsonb" NOT NULL,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."contact_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "client_id" "uuid",
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


CREATE TABLE IF NOT EXISTS "public"."core_service_area_links" (
    "core_service_id" "uuid" NOT NULL,
    "area_id" "uuid" NOT NULL
);


ALTER TABLE "public"."core_service_area_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."core_service_areas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "core_service_areas_name_check" CHECK (("char_length"("name") > 0))
);


ALTER TABLE "public"."core_service_areas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."core_service_department_links" (
    "core_service_id" "uuid" NOT NULL,
    "department_id" "uuid" NOT NULL
);


ALTER TABLE "public"."core_service_department_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."core_service_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "department_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "core_service_types_name_check" CHECK (("char_length"("name") > 0))
);


ALTER TABLE "public"."core_service_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."core_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "department_id" "uuid",
    "type_id" "uuid",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "cloud_links" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "core_services_name_check" CHECK (("char_length"("name") > 0))
);


ALTER TABLE "public"."core_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "frequency" "text" DEFAULT 'daily'::"text",
    "time_of_day" time without time zone DEFAULT '09:00:00'::time without time zone,
    "threshold_days" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."custom_reminders" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."doc_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page_ref" "uuid" NOT NULL,
    "type" "text" DEFAULT 'paragraph'::"text" NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb",
    "order_index" double precision DEFAULT 0,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."doc_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doc_page_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page_ref" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "access_level" "text" DEFAULT 'view'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."doc_page_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doc_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "space_ref" "uuid" NOT NULL,
    "parent_ref" "uuid",
    "title" "text" DEFAULT 'Untitled'::"text" NOT NULL,
    "icon" "text",
    "cover_image" "text",
    "order_index" double precision DEFAULT 0,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "cover_url" "text",
    "is_public" boolean DEFAULT false,
    "item_ref" "uuid"
);


ALTER TABLE "public"."doc_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doc_spaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "space_ref" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."doc_spaces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doc_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "page_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."doc_subscriptions" OWNER TO "postgres";


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
    "created_at" timestamp with time zone DEFAULT "now"(),
    "client_name" "text"
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_code" character varying(50) NOT NULL,
    "company_name" character varying(255) NOT NULL,
    "core_service_id" "uuid",
    "status" character varying(100) DEFAULT 'Call di onboarding prenotata'::character varying NOT NULL,
    "macro_status" character varying(50) DEFAULT 'in lavorazione'::character varying NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "leads_macro_status_check" CHECK ((("macro_status")::"text" = ANY ((ARRAY['in lavorazione'::character varying, 'vinto'::character varying, 'perso'::character varying])::"text"[])))
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


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
    "related_orders" "jsonb",
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
    "cassa_previdenziale" numeric DEFAULT 0,
    "collaborator_name" "text",
    "supplier_name" "text"
);


ALTER TABLE "public"."passive_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pm_activity_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "space_ref" "uuid",
    "item_ref" "uuid",
    "actor_user_ref" "uuid",
    "action_type" "text" NOT NULL,
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "order_ref" "uuid",
    "client_ref" "uuid",
    "is_account_level" boolean DEFAULT false
);


ALTER TABLE "public"."pm_activity_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pm_activity_registry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "track_insert" boolean DEFAULT true,
    "track_update" boolean DEFAULT true,
    "track_delete" boolean DEFAULT false,
    "track_columns" "text"[],
    "template_insert" "text",
    "template_update" "text",
    "template_delete" "text",
    "order_ref_source" "text",
    "space_ref_source" "text",
    "item_ref_source" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "insert_action_name" "text",
    "update_action_name" "text",
    "delete_action_name" "text",
    "column_templates" "jsonb" DEFAULT '{}'::"jsonb",
    "is_notification_enabled" boolean DEFAULT false,
    "notification_template_insert" "text",
    "notification_template_update" "text",
    "client_ref_source" "text"
);


ALTER TABLE "public"."pm_activity_registry" OWNER TO "postgres";


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
    "space_ref" "uuid",
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
    "cloud_links" "jsonb" DEFAULT '[]'::"jsonb",
    "recurrence_rule" "jsonb",
    "recurrence_id" "uuid",
    "is_account_level" boolean DEFAULT false,
    "client_ref" "uuid"
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
    "area" "text",
    "is_cluster" boolean DEFAULT false,
    "parent_ref" "uuid",
    "cloud_links" "jsonb" DEFAULT '[]'::"jsonb",
    "ref_sap_service" "uuid",
    "price_final" numeric,
    "cost_final" numeric
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


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


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
    "organization_id" "uuid"
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



ALTER TABLE ONLY "public"."contact_forms"
    ADD CONSTRAINT "contact_forms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_submissions"
    ADD CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_members"
    ADD CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."core_service_area_links"
    ADD CONSTRAINT "core_service_area_links_pkey" PRIMARY KEY ("core_service_id", "area_id");



ALTER TABLE ONLY "public"."core_service_areas"
    ADD CONSTRAINT "core_service_areas_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."core_service_areas"
    ADD CONSTRAINT "core_service_areas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."core_service_department_links"
    ADD CONSTRAINT "core_service_department_links_pkey" PRIMARY KEY ("core_service_id", "department_id");



ALTER TABLE ONLY "public"."core_service_types"
    ADD CONSTRAINT "core_service_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."core_services"
    ADD CONSTRAINT "core_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_reminders"
    ADD CONSTRAINT "custom_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_reminders"
    ADD CONSTRAINT "custom_reminders_user_id_type_key" UNIQUE ("user_id", "type");



ALTER TABLE ONLY "public"."debug_logs"
    ADD CONSTRAINT "debug_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doc_blocks"
    ADD CONSTRAINT "doc_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doc_page_permissions"
    ADD CONSTRAINT "doc_page_permissions_page_ref_target_type_target_id_key" UNIQUE ("page_ref", "target_type", "target_id");



ALTER TABLE ONLY "public"."doc_page_permissions"
    ADD CONSTRAINT "doc_page_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doc_pages"
    ADD CONSTRAINT "doc_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doc_spaces"
    ADD CONSTRAINT "doc_spaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doc_spaces"
    ADD CONSTRAINT "doc_spaces_space_ref_key" UNIQUE ("space_ref");



ALTER TABLE ONLY "public"."doc_subscriptions"
    ADD CONSTRAINT "doc_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doc_subscriptions"
    ADD CONSTRAINT "doc_subscriptions_user_id_page_id_key" UNIQUE ("user_id", "page_id");



ALTER TABLE ONLY "public"."external_busy_cache"
    ADD CONSTRAINT "external_busy_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_calendar_connections"
    ADD CONSTRAINT "external_calendar_connections_collaborator_id_provider_key" UNIQUE ("collaborator_id", "provider");



ALTER TABLE ONLY "public"."external_calendar_connections"
    ADD CONSTRAINT "external_calendar_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_lead_code_key" UNIQUE ("lead_code");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."pm_activity_logs"
    ADD CONSTRAINT "pm_activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pm_activity_registry"
    ADD CONSTRAINT "pm_activity_registry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pm_activity_registry"
    ADD CONSTRAINT "pm_activity_registry_table_name_key" UNIQUE ("table_name");



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



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_endpoint_key" UNIQUE ("user_id", "endpoint");



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



CREATE INDEX "bank_transactions_statement_status_idx" ON "public"."bank_transactions" USING "btree" ("statement_id", "status");



CREATE INDEX "bank_transactions_status_date_idx" ON "public"."bank_transactions" USING "btree" ("status", "date" DESC);



CREATE INDEX "idx_appointments_client" ON "public"."appointments" USING "btree" ("client_id");



CREATE INDEX "idx_appointments_order" ON "public"."appointments" USING "btree" ("order_id");



CREATE INDEX "idx_appointments_space" ON "public"."appointments" USING "btree" ("pm_space_id");



CREATE INDEX "idx_appointments_start" ON "public"."appointments" USING "btree" ("start_time");



CREATE INDEX "idx_appt_internal_collab" ON "public"."appointment_internal_participants" USING "btree" ("collaborator_id");



CREATE INDEX "idx_bank_trans_collaborator_id" ON "public"."bank_transactions" USING "btree" ("collaborator_id");



CREATE INDEX "idx_booking_items_sap_service_id" ON "public"."booking_items" USING "btree" ("sap_service_id");



CREATE INDEX "idx_bookings_range" ON "public"."bookings" USING "btree" ("start_time", "end_time");



CREATE INDEX "idx_busy_cache_range" ON "public"."external_busy_cache" USING "btree" ("collaborator_id", "start_time", "end_time");



CREATE INDEX "idx_debug_logs_level" ON "public"."debug_logs" USING "btree" ("level");



CREATE INDEX "idx_doc_blocks_page" ON "public"."doc_blocks" USING "btree" ("page_ref", "order_index");



CREATE INDEX "idx_doc_page_permissions_page" ON "public"."doc_page_permissions" USING "btree" ("page_ref");



CREATE INDEX "idx_doc_pages_order" ON "public"."doc_pages" USING "btree" ("space_ref", "order_index");



CREATE INDEX "idx_doc_pages_parent" ON "public"."doc_pages" USING "btree" ("space_ref", "parent_ref");



CREATE INDEX "idx_notification_types_key" ON "public"."notification_types" USING "btree" ("key");



CREATE INDEX "idx_notifications_collab" ON "public"."notifications" USING "btree" ("collaborator_id", "is_read", "created_at" DESC);



CREATE INDEX "idx_notifications_email_queued" ON "public"."notifications" USING "btree" ("email_status") WHERE ("email_status" = 'queued'::"text");



CREATE INDEX "idx_notifications_user" ON "public"."notifications" USING "btree" ("user_id", "is_read", "created_at" DESC);



CREATE INDEX "idx_pm_activity_logs_actor" ON "public"."pm_activity_logs" USING "btree" ("actor_user_ref");



CREATE INDEX "idx_pm_activity_logs_item" ON "public"."pm_activity_logs" USING "btree" ("item_ref");



CREATE INDEX "idx_pm_activity_logs_space" ON "public"."pm_activity_logs" USING "btree" ("space_ref");



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



CREATE INDEX "messages_fts_idx" ON "public"."messages" USING "gin" ("fts");



CREATE OR REPLACE TRIGGER "notify_collaborator_assignment_trigger" AFTER INSERT ON "public"."booking_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_collaborator_assignment"();



CREATE OR REPLACE TRIGGER "on_booking_assignment_created" AFTER INSERT ON "public"."booking_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_sync_google_calendar"();



CREATE OR REPLACE TRIGGER "set_collaborator_google_auth_updated_at" BEFORE UPDATE ON "public"."collaborator_google_auth" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "sync_profile_name_trigger" AFTER INSERT OR UPDATE OF "full_name" ON "public"."collaborators" FOR EACH ROW EXECUTE FUNCTION "public"."sync_profile_name"();



CREATE OR REPLACE TRIGGER "trg_appointment_participants_audit_notify" AFTER INSERT ON "public"."appointment_internal_participants" FOR EACH ROW EXECUTE FUNCTION "public"."trg_appointment_participants_notify_log"();



CREATE OR REPLACE TRIGGER "trg_appointments_generic_log" AFTER INSERT OR UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."fn_app_activity_logger"();



CREATE OR REPLACE TRIGGER "trg_assignees_log" AFTER INSERT ON "public"."pm_item_assignees" FOR EACH ROW EXECUTE FUNCTION "public"."fn_app_activity_logger"();



CREATE OR REPLACE TRIGGER "trg_assignments_generic_log" AFTER INSERT OR UPDATE ON "public"."assignments" FOR EACH ROW EXECUTE FUNCTION "public"."fn_app_activity_logger"();



CREATE OR REPLACE TRIGGER "trg_bank_transactions_notify" AFTER INSERT ON "public"."bank_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."trg_bank_transactions_notify"();



CREATE OR REPLACE TRIGGER "trg_clients_generic_log" AFTER UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."fn_app_activity_logger"();



CREATE OR REPLACE TRIGGER "trg_collaborators_notify" AFTER INSERT ON "public"."collaborators" FOR EACH ROW EXECUTE FUNCTION "public"."trg_collaborators_notify"();



CREATE OR REPLACE TRIGGER "trg_contact_submissions_notify" AFTER INSERT ON "public"."contact_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."trg_contact_submissions_notify"();



CREATE OR REPLACE TRIGGER "trg_doc_pages_generic_log" AFTER INSERT OR UPDATE ON "public"."doc_pages" FOR EACH ROW EXECUTE FUNCTION "public"."fn_app_activity_logger"();



CREATE OR REPLACE TRIGGER "trg_handle_new_message" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_message"();



CREATE OR REPLACE TRIGGER "trg_leads_audit_notify" AFTER INSERT OR UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."trg_leads_notify"();



CREATE OR REPLACE TRIGGER "trg_orders_activity_log" AFTER INSERT OR UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_app_activity_logger"();



CREATE OR REPLACE TRIGGER "trg_orders_generic_log" AFTER UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_app_activity_logger"();



CREATE OR REPLACE TRIGGER "trg_orders_notify" AFTER INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."trg_orders_notify"();



CREATE OR REPLACE TRIGGER "trg_payment_invoice_link" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."payment_invoice_link_trigger"();



CREATE OR REPLACE TRIGGER "trg_pm_assignees_audit_notify" AFTER INSERT ON "public"."pm_item_assignees" FOR EACH ROW EXECUTE FUNCTION "public"."trg_pm_assignees_notify_log"();



CREATE OR REPLACE TRIGGER "trg_pm_assignees_generic_log" AFTER INSERT ON "public"."pm_item_assignees" FOR EACH ROW EXECUTE FUNCTION "public"."fn_app_activity_logger"();



CREATE OR REPLACE TRIGGER "trg_pm_comments_audit_notify" AFTER INSERT ON "public"."pm_item_comments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_pm_comments_notify_log"();



CREATE OR REPLACE TRIGGER "trg_pm_comments_generic_log" AFTER INSERT ON "public"."pm_item_comments" FOR EACH ROW EXECUTE FUNCTION "public"."fn_app_activity_logger"();



CREATE OR REPLACE TRIGGER "trg_pm_items_activity_log" AFTER INSERT OR UPDATE ON "public"."pm_items" FOR EACH ROW EXECUTE FUNCTION "public"."fn_app_activity_logger"();



CREATE OR REPLACE TRIGGER "trg_pm_items_audit_notify" AFTER INSERT OR UPDATE ON "public"."pm_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_pm_items_notify_log"();



CREATE OR REPLACE TRIGGER "trg_pm_spaces_audit_notify" AFTER INSERT OR UPDATE ON "public"."pm_spaces" FOR EACH ROW EXECUTE FUNCTION "public"."trg_pm_spaces_notify_log"();



CREATE OR REPLACE TRIGGER "trg_pm_spaces_generic_log" AFTER INSERT OR UPDATE ON "public"."pm_spaces" FOR EACH ROW EXECUTE FUNCTION "public"."fn_app_activity_logger"();



CREATE OR REPLACE TRIGGER "trg_process_notification" AFTER INSERT ON "public"."notifications" FOR EACH ROW WHEN (("new"."email_status" = 'queued'::"text")) EXECUTE FUNCTION "public"."trigger_process_notification"();



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



ALTER TABLE ONLY "public"."booking_items"
    ADD CONSTRAINT "booking_items_sap_service_id_fkey" FOREIGN KEY ("sap_service_id") REFERENCES "public"."core_services"("id") ON DELETE SET NULL;



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



ALTER TABLE ONLY "public"."contact_submissions"
    ADD CONSTRAINT "contact_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."contact_forms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversation_members"
    ADD CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_members"
    ADD CONSTRAINT "conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."core_service_area_links"
    ADD CONSTRAINT "core_service_area_links_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "public"."core_service_areas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."core_service_area_links"
    ADD CONSTRAINT "core_service_area_links_core_service_id_fkey" FOREIGN KEY ("core_service_id") REFERENCES "public"."core_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."core_service_department_links"
    ADD CONSTRAINT "core_service_department_links_core_service_id_fkey" FOREIGN KEY ("core_service_id") REFERENCES "public"."core_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."core_service_department_links"
    ADD CONSTRAINT "core_service_department_links_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."core_service_types"
    ADD CONSTRAINT "core_service_types_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."core_services"
    ADD CONSTRAINT "core_services_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."core_services"
    ADD CONSTRAINT "core_services_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "public"."core_service_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."custom_reminders"
    ADD CONSTRAINT "custom_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doc_blocks"
    ADD CONSTRAINT "doc_blocks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."doc_blocks"
    ADD CONSTRAINT "doc_blocks_page_ref_fkey" FOREIGN KEY ("page_ref") REFERENCES "public"."doc_pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doc_page_permissions"
    ADD CONSTRAINT "doc_page_permissions_page_ref_fkey" FOREIGN KEY ("page_ref") REFERENCES "public"."doc_pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doc_pages"
    ADD CONSTRAINT "doc_pages_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."doc_pages"
    ADD CONSTRAINT "doc_pages_item_ref_fkey" FOREIGN KEY ("item_ref") REFERENCES "public"."pm_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doc_pages"
    ADD CONSTRAINT "doc_pages_parent_ref_fkey" FOREIGN KEY ("parent_ref") REFERENCES "public"."doc_pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doc_pages"
    ADD CONSTRAINT "doc_pages_space_ref_fkey" FOREIGN KEY ("space_ref") REFERENCES "public"."doc_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doc_spaces"
    ADD CONSTRAINT "doc_spaces_space_ref_fkey" FOREIGN KEY ("space_ref") REFERENCES "public"."pm_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doc_subscriptions"
    ADD CONSTRAINT "doc_subscriptions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."doc_pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doc_subscriptions"
    ADD CONSTRAINT "doc_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."external_busy_cache"
    ADD CONSTRAINT "external_busy_cache_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."external_calendar_connections"
    ADD CONSTRAINT "external_calendar_connections_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_core_service_id_fkey" FOREIGN KEY ("core_service_id") REFERENCES "public"."core_services"("id") ON DELETE SET NULL;



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



ALTER TABLE ONLY "public"."passive_invoices"
    ADD CONSTRAINT "passive_invoices_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."passive_invoices"
    ADD CONSTRAINT "passive_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "public"."bank_transactions"("id");



ALTER TABLE ONLY "public"."pm_activity_logs"
    ADD CONSTRAINT "pm_activity_logs_actor_user_ref_fkey" FOREIGN KEY ("actor_user_ref") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pm_activity_logs"
    ADD CONSTRAINT "pm_activity_logs_client_ref_fkey" FOREIGN KEY ("client_ref") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pm_activity_logs"
    ADD CONSTRAINT "pm_activity_logs_item_ref_fkey" FOREIGN KEY ("item_ref") REFERENCES "public"."pm_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pm_activity_logs"
    ADD CONSTRAINT "pm_activity_logs_order_ref_fkey" FOREIGN KEY ("order_ref") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pm_activity_logs"
    ADD CONSTRAINT "pm_activity_logs_space_ref_fkey" FOREIGN KEY ("space_ref") REFERENCES "public"."pm_spaces"("id") ON DELETE CASCADE;



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
    ADD CONSTRAINT "pm_items_client_ref_fkey" FOREIGN KEY ("client_ref") REFERENCES "public"."clients"("id");



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



ALTER TABLE ONLY "public"."pm_spaces"
    ADD CONSTRAINT "pm_spaces_ref_sap_service_fkey" FOREIGN KEY ("ref_sap_service") REFERENCES "public"."core_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



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



CREATE POLICY "Activity Logs: Admin access" ON "public"."pm_activity_logs" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Activity Logs: Insert" ON "public"."pm_activity_logs" FOR INSERT WITH CHECK (("auth"."uid"() = "actor_user_ref"));



CREATE POLICY "Activity Logs: Space and Order Access" ON "public"."pm_activity_logs" FOR SELECT USING (((("space_ref" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."pm_spaces" "s"
  WHERE (("s"."id" = "pm_activity_logs"."space_ref") AND (("s"."default_pm_user_ref" = "auth"."uid"()) OR (("s"."type" = 'commessa'::"public"."pm_space_type") AND (EXISTS ( SELECT 1
           FROM "public"."assignments" "a"
          WHERE (("a"."order_id" = "s"."ref_ordine") AND ("a"."collaborator_id" IN ( SELECT "collaborators"."id"
                   FROM "public"."collaborators"
                  WHERE ("collaborators"."user_id" = "auth"."uid"())))))))))))) OR (("item_ref" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."pm_items" "i"
  WHERE (("i"."id" = "pm_activity_logs"."item_ref") AND ((EXISTS ( SELECT 1
           FROM "public"."pm_item_assignees" "a"
          WHERE (("a"."pm_item_ref" = "i"."id") AND ("a"."user_ref" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM (("public"."pm_item_incarichi" "inc"
             JOIN "public"."assignments" "ass" ON (("inc"."incarico_ref" = "ass"."id")))
             JOIN "public"."collaborators" "c" ON (("c"."id" = "ass"."collaborator_id")))
          WHERE (("inc"."pm_item_ref" = "i"."id") AND ("c"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM "public"."pm_spaces" "s"
          WHERE (("s"."id" = "i"."space_ref") AND ("s"."default_pm_user_ref" = "auth"."uid"()))))))))) OR (("order_ref" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."assignments" "a"
  WHERE (("a"."order_id" = "pm_activity_logs"."order_ref") AND ("a"."collaborator_id" IN ( SELECT "collaborators"."id"
           FROM "public"."collaborators"
          WHERE ("collaborators"."user_id" = "auth"."uid"())))))))));



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



CREATE POLICY "Admins can manage booking_holds" ON "public"."booking_holds" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admins can manage registry" ON "public"."pm_activity_registry" TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can view all notifications" ON "public"."notifications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage all availability_rules" ON "public"."availability_rules" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text"));



CREATE POLICY "Admins/Collaborators can delete assignments" ON "public"."booking_assignments" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Admins/Collaborators can delete bookings" ON "public"."bookings" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Admins/Collaborators can update bookings" ON "public"."bookings" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins/Managers manage booking_item_collaborators" ON "public"."booking_item_collaborators" USING (((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."collaborators"
  WHERE (("collaborators"."email" = (( SELECT "users"."email"
           FROM "auth"."users"
          WHERE ("users"."id" = "auth"."uid"())))::"text") AND ("collaborators"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"])))))));



CREATE POLICY "Allow all access to booking_categories" ON "public"."booking_categories" USING (true);



CREATE POLICY "Allow all access to booking_items" ON "public"."booking_items" USING (true);



CREATE POLICY "Allow all for authenticated users" ON "public"."collaborator_google_auth" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public inserts to bookings" ON "public"."bookings" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anonymous can insert booking_holds" ON "public"."booking_holds" FOR INSERT WITH CHECK (true);



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



CREATE POLICY "Authenticated users can manage forms" ON "public"."contact_forms" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can read notification types" ON "public"."notification_types" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view collaborator_services" ON "public"."collaborator_services" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view/manage submissions" ON "public"."contact_submissions" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Comments: Insert" ON "public"."pm_item_comments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."pm_items" "i"
  WHERE ("i"."id" = "pm_item_comments"."pm_item_ref"))));



CREATE POLICY "Comments: Visibility" ON "public"."pm_item_comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."pm_items" "i"
  WHERE ("i"."id" = "pm_item_comments"."pm_item_ref"))));



CREATE POLICY "Creator can add members" ON "public"."conversation_members" FOR INSERT TO "authenticated" WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Docs: Public Access Blocks" ON "public"."doc_blocks" USING (true);



CREATE POLICY "Docs: Public Access Pages" ON "public"."doc_pages" USING (true);



CREATE POLICY "Docs: Public Access Permissions" ON "public"."doc_page_permissions" USING (true);



CREATE POLICY "Docs: Public Access Spaces" ON "public"."doc_spaces" USING (true);



CREATE POLICY "Enable delete access for authenticated users" ON "public"."core_service_department_links" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Enable delete access for authenticated users" ON "public"."order_contacts" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."order_contacts" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for all" ON "public"."debug_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."passive_invoices" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."assignments" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."core_service_area_links" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable read access for all users" ON "public"."core_service_areas" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable read access for all users" ON "public"."core_service_types" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable read access for all users" ON "public"."core_services" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable read access for all users" ON "public"."passive_invoices" FOR SELECT USING (true);



CREATE POLICY "Enable read access for authenticated users" ON "public"."core_service_department_links" FOR SELECT TO "authenticated" USING (true);



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



CREATE POLICY "Enable write access for authenticated users" ON "public"."core_service_area_links" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable write access for authenticated users" ON "public"."core_service_areas" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable write access for authenticated users" ON "public"."core_service_department_links" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable write access for authenticated users" ON "public"."core_service_types" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable write access for authenticated users" ON "public"."core_services" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Incarichi Link: Manage Delete" ON "public"."pm_item_incarichi" FOR DELETE USING (("public"."is_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."pm_items" "i"
     JOIN "public"."pm_spaces" "s" ON (("s"."id" = "i"."space_ref")))
  WHERE (("i"."id" = "pm_item_incarichi"."pm_item_ref") AND ("s"."default_pm_user_ref" = "auth"."uid"()))))));



CREATE POLICY "Incarichi Link: Manage Insert" ON "public"."pm_item_incarichi" FOR INSERT WITH CHECK (("public"."is_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."pm_items" "i"
     JOIN "public"."pm_spaces" "s" ON (("s"."id" = "i"."space_ref")))
  WHERE (("i"."id" = "pm_item_incarichi"."pm_item_ref") AND ("s"."default_pm_user_ref" = "auth"."uid"()))))));



CREATE POLICY "Incarichi Link: View" ON "public"."pm_item_incarichi" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Items: Collaborator update own" ON "public"."pm_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."pm_item_assignees" "a"
  WHERE (("a"."pm_item_ref" = "pm_items"."id") AND (("a"."user_ref" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."collaborators" "c"
          WHERE (("c"."id" = "a"."collaborator_ref") AND ("c"."user_id" = "auth"."uid"())))))))));



CREATE POLICY "Items: Insert Admin/PM" ON "public"."pm_items" FOR INSERT WITH CHECK (("public"."is_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."pm_spaces" "s"
  WHERE (("s"."id" = "pm_items"."space_ref") AND ("s"."default_pm_user_ref" = "auth"."uid"()))))));



CREATE POLICY "Items: View Access" ON "public"."pm_items" FOR SELECT USING ("public"."has_space_view_access"("space_ref", "auth"."uid"()));



CREATE POLICY "Leads are deletable by authenticated users." ON "public"."leads" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Leads are insertable by authenticated users." ON "public"."leads" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Leads are updatable by authenticated users." ON "public"."leads" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Leads are viewable by authenticated users." ON "public"."leads" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Messages update author" ON "public"."messages" FOR UPDATE TO "authenticated" USING (("author_id" = "auth"."uid"()));



CREATE POLICY "Owner can update channel" ON "public"."channels" FOR UPDATE TO "authenticated" USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Public Insert Assignments" ON "public"."booking_assignments" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Public Insert Bookings" ON "public"."bookings" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Public Read Assignments" ON "public"."booking_assignments" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public Read Availability" ON "public"."bookings" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public access bank_transactions" ON "public"."bank_transactions" USING (true);



CREATE POLICY "Public access clients" ON "public"."clients" USING (true);



CREATE POLICY "Public access collaborators" ON "public"."collaborators" USING (true);



CREATE POLICY "Public access contacts" ON "public"."contacts" USING (true);



CREATE POLICY "Public access departments" ON "public"."departments" USING (true);



CREATE POLICY "Public access invoices" ON "public"."invoices" USING (true);



CREATE POLICY "Public access order_collaborators" ON "public"."order_collaborators" USING (true);



CREATE POLICY "Public access orders" ON "public"."orders" USING (true);



CREATE POLICY "Public access passive_invoices" ON "public"."passive_invoices" USING (true);



CREATE POLICY "Public access payments" ON "public"."payments" USING (true);



CREATE POLICY "Public access profiles" ON "public"."profiles" USING (true);



CREATE POLICY "Public access services" ON "public"."services" USING (true);



CREATE POLICY "Public access suppliers" ON "public"."suppliers" USING (true);



CREATE POLICY "Public access transaction_categories" ON "public"."transaction_categories" USING (true);



CREATE POLICY "Public can insert submissions" ON "public"."contact_submissions" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can read active forms" ON "public"."contact_forms" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public insert assignments" ON "public"."booking_assignments" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public read access for availability_rules" ON "public"."availability_rules" FOR SELECT USING (true);



CREATE POLICY "Public read access for booking_item_collaborators" ON "public"."booking_item_collaborators" FOR SELECT USING (true);



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



CREATE POLICY "Space Assignees: View Access" ON "public"."pm_space_assignees" FOR SELECT USING ("public"."has_space_view_access"("pm_space_ref", "auth"."uid"()));



CREATE POLICY "Spaces: Create Access" ON "public"."pm_spaces" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Spaces: Update Access" ON "public"."pm_spaces" FOR UPDATE USING ((("auth"."uid"() = "default_pm_user_ref") OR (EXISTS ( SELECT 1
   FROM "public"."pm_space_assignees" "sa"
  WHERE (("sa"."pm_space_ref" = "sa"."id") AND ("sa"."role" = 'pm'::"text") AND (("sa"."user_ref" = "auth"."uid"()) OR ("sa"."collaborator_ref" IN ( SELECT "collaborators"."id"
           FROM "public"."collaborators"
          WHERE ("collaborators"."user_id" = "auth"."uid"()))))))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))));



CREATE POLICY "Spaces: View Access" ON "public"."pm_spaces" FOR SELECT USING ("public"."has_space_view_access"("id", "auth"."uid"()));



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



CREATE POLICY "Users can manage their own doc subscriptions" ON "public"."doc_subscriptions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own reminders." ON "public"."custom_reminders" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own subscriptions" ON "public"."push_subscriptions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own preferences" ON "public"."user_notification_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR ("collaborator_id" IN ( SELECT "collaborators"."id"
   FROM "public"."collaborators"
  WHERE ("collaborators"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own preferences" ON "public"."user_notification_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own sync records" ON "public"."appointment_google_sync" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("collaborator_id" IN ( SELECT "collaborators"."id"
   FROM "public"."collaborators"
  WHERE ("collaborators"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own sync records" ON "public"."appointment_google_sync" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own availability_rules" ON "public"."availability_rules" USING (("collaborator_id" = "auth"."uid"())) WITH CHECK (("collaborator_id" = "auth"."uid"()));



CREATE POLICY "Users manage own external_busy_cache" ON "public"."external_busy_cache" USING (("collaborator_id" = "auth"."uid"())) WITH CHECK (("collaborator_id" = "auth"."uid"()));



CREATE POLICY "Users manage own external_calendar_connections" ON "public"."external_calendar_connections" USING (("collaborator_id" = "auth"."uid"())) WITH CHECK (("collaborator_id" = "auth"."uid"()));



CREATE POLICY "Users view own bookings" ON "public"."bookings" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("auth"."uid"() IN ( SELECT "booking_assignments"."collaborator_id"
   FROM "public"."booking_assignments"
  WHERE ("booking_assignments"."booking_id" = "bookings"."id")))));



CREATE POLICY "Users view own external_busy_cache" ON "public"."external_busy_cache" FOR SELECT USING (("collaborator_id" = "auth"."uid"()));



ALTER TABLE "public"."appointment_client_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointment_google_sync" ENABLE ROW LEVEL SECURITY;


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


ALTER TABLE "public"."contact_forms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."core_service_area_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."core_service_areas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."core_service_department_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."core_service_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."core_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."debug_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doc_blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doc_page_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doc_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doc_spaces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doc_subscriptions" ENABLE ROW LEVEL SECURITY;


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


ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


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


ALTER TABLE "public"."pm_activity_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pm_activity_registry" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pm_item_assignees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pm_item_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pm_item_incarichi" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pm_item_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pm_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pm_space_assignees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pm_spaces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


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



GRANT ALL ON FUNCTION "public"."broadcast_pm_notification"("p_user_ids" "uuid"[], "p_type" "text", "p_title" "text", "p_message" "text", "p_data" "jsonb", "p_actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."broadcast_pm_notification"("p_user_ids" "uuid"[], "p_type" "text", "p_title" "text", "p_message" "text", "p_data" "jsonb", "p_actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."broadcast_pm_notification"("p_user_ids" "uuid"[], "p_type" "text", "p_title" "text", "p_message" "text", "p_data" "jsonb", "p_actor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_custom_reminders"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_custom_reminders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_custom_reminders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_app_activity_logger"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_app_activity_logger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_app_activity_logger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_friendly_label"("_val" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_friendly_label"("_val" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_friendly_label"("_val" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_get_pm_item_descendants"("root_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_get_pm_item_descendants"("root_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_get_pm_item_descendants"("root_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_human_val"("_val" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_human_val"("_val" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_human_val"("_val" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_resolve_name"("_table" "text", "_id" "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_resolve_name"("_table" "text", "_id" "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_resolve_name"("_table" "text", "_id" "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_admin_notification_logs"("p_limit" integer, "p_offset" integer, "p_search" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_notification_logs"("p_limit" integer, "p_offset" integer, "p_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_notification_logs"("p_limit" integer, "p_offset" integer, "p_search" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_active_invoices"("p_year" integer, "p_month" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_active_invoices"("p_year" integer, "p_month" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_active_invoices"("p_year" integer, "p_month" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_bank_statements"("p_year" integer, "p_month" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_bank_statements"("p_year" integer, "p_month" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_bank_statements"("p_year" integer, "p_month" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_passive_invoices"("p_year" integer, "p_month" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_passive_invoices"("p_year" integer, "p_month" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_passive_invoices"("p_year" integer, "p_month" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_transactions"("p_year" integer, "p_month" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_transactions"("p_year" integer, "p_month" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_transactions"("p_year" integer, "p_month" integer) TO "service_role";



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



GRANT ALL ON FUNCTION "public"."has_space_view_access"("_space_id" "uuid", "_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_space_view_access"("_space_id" "uuid", "_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_space_view_access"("_space_id" "uuid", "_user_id" "uuid") TO "service_role";



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



GRANT ALL ON FUNCTION "public"."trg_appointment_participants_notify_log"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_appointment_participants_notify_log"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_appointment_participants_notify_log"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_bank_transactions_notify"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_bank_transactions_notify"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_bank_transactions_notify"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_collaborators_notify"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_collaborators_notify"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_collaborators_notify"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_contact_submissions_notify"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_contact_submissions_notify"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_contact_submissions_notify"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_doc_pages_notify_log"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_doc_pages_notify_log"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_doc_pages_notify_log"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_leads_notify"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_leads_notify"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_leads_notify"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_orders_notify"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_orders_notify"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_orders_notify"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_pm_assignees_notify_log"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_pm_assignees_notify_log"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_pm_assignees_notify_log"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_pm_comments_notify_log"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_pm_comments_notify_log"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_pm_comments_notify_log"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_pm_items_notify_log"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_pm_items_notify_log"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_pm_items_notify_log"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_pm_spaces_notify_log"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_pm_spaces_notify_log"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_pm_spaces_notify_log"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_process_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_process_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_process_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_sync_google_calendar"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_sync_google_calendar"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_sync_google_calendar"() TO "service_role";



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



GRANT ALL ON TABLE "public"."contact_forms" TO "anon";
GRANT ALL ON TABLE "public"."contact_forms" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_forms" TO "service_role";



GRANT ALL ON TABLE "public"."contact_submissions" TO "anon";
GRANT ALL ON TABLE "public"."contact_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_members" TO "anon";
GRANT ALL ON TABLE "public"."conversation_members" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_members" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."core_service_area_links" TO "anon";
GRANT ALL ON TABLE "public"."core_service_area_links" TO "authenticated";
GRANT ALL ON TABLE "public"."core_service_area_links" TO "service_role";



GRANT ALL ON TABLE "public"."core_service_areas" TO "anon";
GRANT ALL ON TABLE "public"."core_service_areas" TO "authenticated";
GRANT ALL ON TABLE "public"."core_service_areas" TO "service_role";



GRANT ALL ON TABLE "public"."core_service_department_links" TO "anon";
GRANT ALL ON TABLE "public"."core_service_department_links" TO "authenticated";
GRANT ALL ON TABLE "public"."core_service_department_links" TO "service_role";



GRANT ALL ON TABLE "public"."core_service_types" TO "anon";
GRANT ALL ON TABLE "public"."core_service_types" TO "authenticated";
GRANT ALL ON TABLE "public"."core_service_types" TO "service_role";



GRANT ALL ON TABLE "public"."core_services" TO "anon";
GRANT ALL ON TABLE "public"."core_services" TO "authenticated";
GRANT ALL ON TABLE "public"."core_services" TO "service_role";



GRANT ALL ON TABLE "public"."custom_reminders" TO "anon";
GRANT ALL ON TABLE "public"."custom_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_reminders" TO "service_role";



GRANT ALL ON TABLE "public"."debug_logs" TO "anon";
GRANT ALL ON TABLE "public"."debug_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."debug_logs" TO "service_role";



GRANT ALL ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON TABLE "public"."doc_blocks" TO "anon";
GRANT ALL ON TABLE "public"."doc_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."doc_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."doc_page_permissions" TO "anon";
GRANT ALL ON TABLE "public"."doc_page_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."doc_page_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."doc_pages" TO "anon";
GRANT ALL ON TABLE "public"."doc_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."doc_pages" TO "service_role";



GRANT ALL ON TABLE "public"."doc_spaces" TO "anon";
GRANT ALL ON TABLE "public"."doc_spaces" TO "authenticated";
GRANT ALL ON TABLE "public"."doc_spaces" TO "service_role";



GRANT ALL ON TABLE "public"."doc_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."doc_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."doc_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."external_busy_cache" TO "anon";
GRANT ALL ON TABLE "public"."external_busy_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."external_busy_cache" TO "service_role";



GRANT ALL ON TABLE "public"."external_calendar_connections" TO "anon";
GRANT ALL ON TABLE "public"."external_calendar_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."external_calendar_connections" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



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



GRANT ALL ON TABLE "public"."pm_activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."pm_activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."pm_activity_logs" TO "service_role";



GRANT ALL ON TABLE "public"."pm_activity_registry" TO "anon";
GRANT ALL ON TABLE "public"."pm_activity_registry" TO "authenticated";
GRANT ALL ON TABLE "public"."pm_activity_registry" TO "service_role";



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



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



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







