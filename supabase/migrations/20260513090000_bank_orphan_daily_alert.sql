-- Migration: CA-8 — Alert giornaliero movimenti bancari senza fattura
-- Registra il tipo notifica nel catalogo + funzione daily + cron job

-- 1. Notification type nel catalogo
INSERT INTO public.notification_types (
    key,
    label_it,
    description,
    category,
    default_email,
    default_web,
    default_email_guest,
    is_active
)
VALUES (
    'bank_orphan_daily_alert',
    'Movimenti da Quadrare',
    'Riepilogo giornaliero dei movimenti bancari approvati senza fattura collegata',
    'accounting',
    false,
    true,
    false,
    true
)
ON CONFLICT (key) DO NOTHING;

-- 2. Funzione che conta gli orfani e invia la notifica agli admin
CREATE OR REPLACE FUNCTION public.notify_bank_orphans_daily()
RETURNS void AS $$
DECLARE
    v_count     INT;
    v_total     NUMERIC;
    v_admin_ids UUID[];
    v_uid       UUID;
    v_title     TEXT;
    v_body      TEXT;
BEGIN
    -- Conta transazioni "posted" senza alcun link a fatture negli ultimi 90 giorni
    SELECT
        COUNT(*),
        COALESCE(SUM(ABS(bt.amount)), 0)
    INTO v_count, v_total
    FROM public.bank_transactions bt
    WHERE bt.status = 'posted'
      AND bt.date >= (CURRENT_DATE - INTERVAL '90 days')
      AND bt.active_invoice_id  IS NULL
      AND bt.passive_invoice_id IS NULL
      AND (bt.linked_invoices IS NULL OR bt.linked_invoices = '[]'::jsonb)
      AND NOT EXISTS (
          SELECT 1 FROM public.payments p
          WHERE p.bank_transaction_id = bt.id
      );

    -- Nulla da segnalare
    IF v_count = 0 THEN
        RETURN;
    END IF;

    -- Raccoglie tutti gli utenti con role=admin
    SELECT array_agg(id)
    INTO v_admin_ids
    FROM auth.users
    WHERE EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.users.id
          AND profiles.role = 'admin'
    );

    IF v_admin_ids IS NULL OR array_length(v_admin_ids, 1) = 0 THEN
        RETURN;
    END IF;

    v_title := v_count || ' moviment' || CASE WHEN v_count = 1 THEN 'o' ELSE 'i' END || ' da quadrare';
    v_body  := 'Totale non riconciliato: ' || to_char(v_total, 'FM999G999G999D00') || ' €. Apri "Movimenti da Quadrare" per collegare le fatture.';

    -- Invia una notifica per ogni admin
    FOREACH v_uid IN ARRAY v_admin_ids LOOP
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            message,
            data,
            channel_web,
            channel_email,
            is_read
        ) VALUES (
            v_uid,
            'bank_orphan_daily_alert',
            v_title,
            v_body,
            jsonb_build_object(
                'orphan_count', v_count,
                'orphan_total', v_total,
                'link', '#bank-orphans'
            ),
            true,
            false,
            false
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.notify_bank_orphans_daily() TO service_role;

-- 3. pg_cron: ogni mattina alle 09:00
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
    'bank-orphan-daily-alert',
    '0 9 * * *',
    $$ SELECT public.notify_bank_orphans_daily(); $$
);
