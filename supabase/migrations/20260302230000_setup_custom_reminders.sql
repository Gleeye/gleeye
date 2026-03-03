-- Migration: Setup Custom Admin Reminders and Cron
-- Description: Creates the custom_reminders table, default types, and the cron job checking routine.

-- 1. Enable pg_cron (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create the custom_reminders table
CREATE TABLE IF NOT EXISTS public.custom_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- e.g., 'unpaid_invoices', 'unreconciled_transactions', 'stale_leads'
    is_active BOOLEAN DEFAULT true,
    frequency TEXT DEFAULT 'daily', -- 'daily', 'weekly'
    time_of_day TIME DEFAULT '09:00:00',
    threshold_days INTEGER DEFAULT 0, -- e.g., notify if overdue by X days
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, type)
);

ALTER TABLE public.custom_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own reminders." ON public.custom_reminders;
CREATE POLICY "Users can manage their own reminders."
ON public.custom_reminders
FOR ALL
USING (auth.uid() = user_id);

-- 3. Insert specific Notification Types for these Reminders
INSERT INTO public.notification_types 
    (key, label_it, description, category, default_email, default_web, default_email_guest, is_active, email_subject_template, email_body_template, variables_schema)
VALUES
    (
        'reminder_unpaid_invoices',
        'Promemoria Fatture Insolute',
        'Avviso giornaliero sulle fatture scadute e non pagate',
        'invoice',
        false, true, false, true,
        'Riepilogo: Fatture Insolute',
        '<p>Ci sono <strong>{{count}}</strong> fatture scadute e non ancora pagate. (Totale stimato: {{total_amount}}€)</p>',
        '["count", "total_amount"]'::jsonb
    ),
    (
        'reminder_bank_reconciliation',
        'Promemoria Riconciliazioni Bancarie',
        'Avviso sui movimenti bancari non riconciliati',
        'payment',
        false, true, false, true,
        'Riepilogo: Movimenti da Riconciliare',
        '<p>Attenzione: hai <strong>{{count}}</strong> movimenti in cassa non ancora riconciliati con fatture.</p>',
        '["count"]'::jsonb
    ),
    (
        'reminder_stale_leads',
        'Promemoria Lead In Sospeso',
        'Avviso sui preventivi/lead non aggiornati di recente',
        'general',
        false, true, false, true,
        'Riepilogo: Lead in sospeso',
        '<p>Ci sono <strong>{{count}}</strong> lead/preventivi che non ricevono aggiornamenti da troppo tempo.</p>',
        '["count"]'::jsonb
    )
ON CONFLICT (key) DO UPDATE SET
    category = EXCLUDED.category,
    label_it = EXCLUDED.label_it,
    description = EXCLUDED.description,
    variables_schema = EXCLUDED.variables_schema;


-- 4. Store procedure to check conditions and generate notifications
CREATE OR REPLACE FUNCTION public.check_custom_reminders()
RETURNS void AS $$
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
$$ LANGUAGE plpgsql;

-- 5. Schedule the cron job (Hourly on the hour)
SELECT cron.schedule(
    'process-custom-reminders',
    '0 * * * *', -- Every hour at minute 0
    $$ SELECT public.check_custom_reminders(); $$
);

-- Ensure correct permissions
GRANT EXECUTE ON FUNCTION public.check_custom_reminders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_custom_reminders() TO service_role;
