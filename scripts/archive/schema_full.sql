


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


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






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
    'interno',
    'sap_service'
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
    "linked_invoices" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."bank_transactions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_bank_transaction"("p_tx_id" "uuid", "p_category_id" "uuid" DEFAULT NULL::"uuid", "p_client_id" "uuid" DEFAULT NULL::"uuid", "p_supplier_id" "uuid" DEFAULT NULL::"uuid", "p_collaborator_id" "uuid" DEFAULT NULL::"uuid", "p_active_invoice_id" "uuid" DEFAULT NULL::"uuid", "p_passive_invoice_id" "uuid" DEFAULT NULL::"uuid", "p_payment_id" "uuid" DEFAULT NULL::"uuid", "p_note" "text" DEFAULT NULL::"text") RETURNS "public"."bank_transactions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."approve_bank_transaction"("p_tx_id" "uuid", "p_category_id" "uuid", "p_client_id" "uuid", "p_supplier_id" "uuid", "p_collaborator_id" "uuid", "p_active_invoice_id" "uuid", "p_passive_invoice_id" "uuid", "p_payment_id" "uuid", "p_note" "text") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."notify_collaborator_on_booking"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_booking RECORD;
    v_collab RECORD;
    v_item_name TEXT;
    v_guest_name TEXT;
BEGIN
    -- Fetch booking details
    SELECT * INTO v_booking FROM bookings WHERE id = NEW.booking_id;
    
    IF NOT FOUND THEN RETURN NEW; END IF;
    
    -- Fetch collaborator details
    SELECT * INTO v_collab FROM collaborators WHERE id = NEW.collaborator_id;
    
    IF NOT FOUND THEN RETURN NEW; END IF;
    
    -- Fetch item name
    SELECT name INTO v_item_name FROM booking_items WHERE id = v_booking.booking_item_id;
    
    v_guest_name := COALESCE(
        NULLIF(v_booking.guest_info->>'first_name', '') || ' ' || NULLIF(v_booking.guest_info->>'last_name', ''),
        v_booking.guest_info->>'first_name',
        v_booking.guest_info->>'last_name',
        'Cliente'
    );
    
    -- Insert notification with Email channel enabled
    INSERT INTO notifications (
        collaborator_id, 
        user_id, 
        type, 
        title, 
        message, 
        data,
        channel_email,
        channel_web,
        email_status
    )
    VALUES (
        NEW.collaborator_id,
        v_collab.user_id,
        'booking_new', -- Must match key in notification_types
        'Nuova prenotazione',
        format('%s ha prenotato %s per il %s alle %s', 
               v_guest_name,
               COALESCE(v_item_name, 'un servizio'), 
               to_char(v_booking.start_time AT TIME ZONE 'Europe/Rome', 'DD/MM/YYYY'),
               to_char(v_booking.start_time AT TIME ZONE 'Europe/Rome', 'HH24:MI')),
        jsonb_build_object(
            'booking_id', NEW.booking_id,
            'booking_item_id', v_booking.booking_item_id,
            'start_time', v_booking.start_time,
            'end_time', v_booking.end_time,
            'guest_name', v_guest_name,
            'guest_email', v_booking.guest_info->>'email',
            'service_name', v_item_name
        ),
        true, -- Enable Email
        true, -- Enable Web
        'queued' -- Mark for processing
    );
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Notification trigger error: %', SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_collaborator_on_booking"() OWNER TO "postgres";


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
    "end_date" "date"
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
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."collaborators" OWNER TO "postgres";


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
    "installments_count" integer DEFAULT 1
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."passive_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_number" "text",
    "issue_date" "date",
    "amount" numeric(15,2),
    "supplier_id" "uuid",
    "collaborator_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "cassa_previdenziale" numeric DEFAULT 0
);


ALTER TABLE "public"."passive_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "text",
    "amount" numeric(15,2),
    "status" "text" DEFAULT 'pending'::"text",
    "payment_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pm_item_assignees" (
    "pm_item_ref" "uuid" NOT NULL,
    "user_ref" "uuid" NOT NULL,
    "role" "text" DEFAULT 'assignee'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
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


CREATE TABLE IF NOT EXISTS "public"."pm_spaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "public"."pm_space_type" NOT NULL,
    "ref_ordine" "uuid",
    "name" "text",
    "default_pm_user_ref" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ref_sap_service" "uuid",
    "price_final" numeric,
    "cost_final" numeric
);


ALTER TABLE "public"."pm_spaces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "role" "text" DEFAULT 'user'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "avatar_url" "text",
    "full_name" "text"
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
    "organization_id" "uuid"
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "archived" boolean DEFAULT false,
    "website" "text"
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
    ADD CONSTRAINT "collaborators_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."core_service_types"
    ADD CONSTRAINT "core_service_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."core_services"
    ADD CONSTRAINT "core_services_pkey" PRIMARY KEY ("id");



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
    ADD CONSTRAINT "pm_item_assignees_pkey" PRIMARY KEY ("pm_item_ref", "user_ref");



ALTER TABLE ONLY "public"."pm_item_comments"
    ADD CONSTRAINT "pm_item_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pm_item_incarichi"
    ADD CONSTRAINT "pm_item_incarichi_pkey" PRIMARY KEY ("pm_item_ref", "incarico_ref");



ALTER TABLE ONLY "public"."pm_item_links"
    ADD CONSTRAINT "pm_item_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pm_items"
    ADD CONSTRAINT "pm_items_pkey" PRIMARY KEY ("id");



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



CREATE INDEX "idx_bank_trans_collaborator_id" ON "public"."bank_transactions" USING "btree" ("collaborator_id");



CREATE INDEX "idx_bookings_range" ON "public"."bookings" USING "btree" ("start_time", "end_time");



CREATE INDEX "idx_busy_cache_range" ON "public"."external_busy_cache" USING "btree" ("collaborator_id", "start_time", "end_time");



CREATE INDEX "idx_notification_types_key" ON "public"."notification_types" USING "btree" ("key");



CREATE INDEX "idx_notifications_collab" ON "public"."notifications" USING "btree" ("collaborator_id", "is_read", "created_at" DESC);



CREATE INDEX "idx_notifications_email_queued" ON "public"."notifications" USING "btree" ("email_status") WHERE ("email_status" = 'queued'::"text");



CREATE INDEX "idx_notifications_user" ON "public"."notifications" USING "btree" ("user_id", "is_read", "created_at" DESC);



CREATE INDEX "idx_pm_comments_item" ON "public"."pm_item_comments" USING "btree" ("pm_item_ref", "created_at");



CREATE INDEX "idx_pm_item_incarichi_ref" ON "public"."pm_item_incarichi" USING "btree" ("incarico_ref");



CREATE INDEX "idx_pm_items_due" ON "public"."pm_items" USING "btree" ("space_ref", "due_date");



CREATE INDEX "idx_pm_items_parent" ON "public"."pm_items" USING "btree" ("parent_ref");



CREATE INDEX "idx_pm_items_space" ON "public"."pm_items" USING "btree" ("space_ref");



CREATE INDEX "idx_pm_items_status" ON "public"."pm_items" USING "btree" ("space_ref", "status");



CREATE INDEX "idx_system_config_key" ON "public"."system_config" USING "btree" ("key");



CREATE INDEX "idx_user_notif_prefs_user" ON "public"."user_notification_preferences" USING "btree" ("user_id");



CREATE INDEX "messages_fts_idx" ON "public"."messages" USING "gin" ("fts");



CREATE OR REPLACE TRIGGER "on_booking_assignment_created" AFTER INSERT ON "public"."booking_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_sync_google_calendar"();



CREATE OR REPLACE TRIGGER "set_collaborator_google_auth_updated_at" BEFORE UPDATE ON "public"."collaborator_google_auth" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "sync_profile_name_trigger" AFTER INSERT OR UPDATE OF "full_name" ON "public"."collaborators" FOR EACH ROW EXECUTE FUNCTION "public"."sync_profile_name"();



CREATE OR REPLACE TRIGGER "trg_booking_notification" AFTER INSERT ON "public"."booking_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_collaborator_on_booking"();



CREATE OR REPLACE TRIGGER "trg_handle_new_message" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_message"();



CREATE OR REPLACE TRIGGER "trg_process_notification" AFTER INSERT ON "public"."notifications" FOR EACH ROW WHEN (("new"."email_status" = 'queued'::"text")) EXECUTE FUNCTION "public"."trigger_process_notification"();



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



ALTER TABLE ONLY "public"."core_service_area_links"
    ADD CONSTRAINT "core_service_area_links_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "public"."core_service_areas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."core_service_area_links"
    ADD CONSTRAINT "core_service_area_links_core_service_id_fkey" FOREIGN KEY ("core_service_id") REFERENCES "public"."core_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."core_service_types"
    ADD CONSTRAINT "core_service_types_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."core_services"
    ADD CONSTRAINT "core_services_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."core_services"
    ADD CONSTRAINT "core_services_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "public"."core_service_types"("id") ON DELETE SET NULL;



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



ALTER TABLE ONLY "public"."passive_invoices"
    ADD CONSTRAINT "passive_invoices_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."passive_invoices"
    ADD CONSTRAINT "passive_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."pm_spaces"
    ADD CONSTRAINT "pm_spaces_default_pm_user_ref_fkey" FOREIGN KEY ("default_pm_user_ref") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pm_spaces"
    ADD CONSTRAINT "pm_spaces_ref_ordine_fkey" FOREIGN KEY ("ref_ordine") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pm_spaces"
    ADD CONSTRAINT "pm_spaces_ref_sap_service_fkey" FOREIGN KEY ("ref_sap_service") REFERENCES "public"."core_services"("id") ON DELETE CASCADE;



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



CREATE POLICY "Assignees: Manage" ON "public"."pm_item_assignees" USING (("public"."is_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."pm_items" "i"
     JOIN "public"."pm_spaces" "s" ON (("s"."id" = "i"."space_ref")))
  WHERE (("i"."id" = "pm_item_assignees"."pm_item_ref") AND ("s"."default_pm_user_ref" = "auth"."uid"()))))));



CREATE POLICY "Assignees: View" ON "public"."pm_item_assignees" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."pm_items" "i"
  WHERE ("i"."id" = "pm_item_assignees"."pm_item_ref"))));



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



CREATE POLICY "Enable read access for all users" ON "public"."assignments" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."core_service_area_links" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable read access for all users" ON "public"."core_service_areas" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable read access for all users" ON "public"."core_service_types" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable read access for all users" ON "public"."core_services" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable read access for authenticated users" ON "public"."order_contacts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable update access for authenticated users" ON "public"."order_contacts" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Enable write access for authenticated users" ON "public"."assignments" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable write access for authenticated users" ON "public"."core_service_area_links" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable write access for authenticated users" ON "public"."core_service_areas" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable write access for authenticated users" ON "public"."core_service_types" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable write access for authenticated users" ON "public"."core_services" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Incarichi Link: Manage" ON "public"."pm_item_incarichi" USING (("public"."is_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."pm_items" "i"
     JOIN "public"."pm_spaces" "s" ON (("s"."id" = "i"."space_ref")))
  WHERE (("i"."id" = "pm_item_incarichi"."pm_item_ref") AND ("s"."default_pm_user_ref" = "auth"."uid"()))))));



CREATE POLICY "Incarichi Link: View" ON "public"."pm_item_incarichi" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."pm_items" "i"
  WHERE ("i"."id" = "pm_item_incarichi"."pm_item_ref"))));



CREATE POLICY "Items: Admin access" ON "public"."pm_items" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Items: Collaborator update own" ON "public"."pm_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."pm_item_assignees" "a"
  WHERE (("a"."pm_item_ref" = "pm_items"."id") AND ("a"."user_ref" = "auth"."uid"())))));



CREATE POLICY "Items: Collaborator visibility" ON "public"."pm_items" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."pm_item_assignees" "a"
  WHERE (("a"."pm_item_ref" = "pm_items"."id") AND ("a"."user_ref" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
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



CREATE POLICY "Users can manage own overrides" ON "public"."availability_overrides" USING (("collaborator_id" IN ( SELECT "collaborators"."id"
   FROM "public"."collaborators"
  WHERE ("collaborators"."email" = ("auth"."jwt"() ->> 'email'::"text")))));



CREATE POLICY "Users can manage own rest days" ON "public"."collaborator_rest_days" USING (("collaborator_id" IN ( SELECT "collaborators"."id"
   FROM "public"."collaborators"
  WHERE ("collaborators"."email" = ("auth"."jwt"() ->> 'email'::"text")))));



CREATE POLICY "Users can read own preferences" ON "public"."user_notification_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own preferences" ON "public"."user_notification_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own bookings" ON "public"."bookings" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("auth"."uid"() IN ( SELECT "booking_assignments"."collaborator_id"
   FROM "public"."booking_assignments"
  WHERE ("booking_assignments"."booking_id" = "bookings"."id")))));



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


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collaborator_google_auth" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collaborator_rest_days" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collaborator_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collaborators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."core_service_area_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."core_service_areas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."core_service_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."core_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


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




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";






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



GRANT ALL ON FUNCTION "public"."notify_collaborator_on_booking"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_collaborator_on_booking"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_collaborator_on_booking"() TO "service_role";



GRANT ALL ON FUNCTION "public"."search_messages"("query_text" "text", "limit_val" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_messages"("query_text" "text", "limit_val" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_messages"("query_text" "text", "limit_val" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_profile_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_profile_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_profile_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_process_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_process_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_process_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_sync_google_calendar"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_sync_google_calendar"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_sync_google_calendar"() TO "service_role";


















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



GRANT ALL ON TABLE "public"."core_service_area_links" TO "anon";
GRANT ALL ON TABLE "public"."core_service_area_links" TO "authenticated";
GRANT ALL ON TABLE "public"."core_service_area_links" TO "service_role";



GRANT ALL ON TABLE "public"."core_service_areas" TO "anon";
GRANT ALL ON TABLE "public"."core_service_areas" TO "authenticated";
GRANT ALL ON TABLE "public"."core_service_areas" TO "service_role";



GRANT ALL ON TABLE "public"."core_service_types" TO "anon";
GRANT ALL ON TABLE "public"."core_service_types" TO "authenticated";
GRANT ALL ON TABLE "public"."core_service_types" TO "service_role";



GRANT ALL ON TABLE "public"."core_services" TO "anon";
GRANT ALL ON TABLE "public"."core_services" TO "authenticated";
GRANT ALL ON TABLE "public"."core_services" TO "service_role";



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



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



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































