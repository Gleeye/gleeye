-- ============================================================
-- MIGRATION: Normalizzazione flusso ordini (3 layer)
-- ============================================================

-- 0. ASSICURA esistenza colonna status_sales
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status_sales text;

-- 1. NORMALIZZA status_works (capitalizzazioni miste → snake_case)
UPDATE orders SET status_works = 'in_svolgimento'
  WHERE LOWER(TRIM(status_works)) IN ('in svolgimento', 'in_svolgimento');

UPDATE orders SET status_works = 'completato'
  WHERE LOWER(TRIM(status_works)) = 'completato';

UPDATE orders SET status_works = 'in_pausa'
  WHERE LOWER(TRIM(status_works)) IN ('in_pausa', 'in attesa', 'lavoro in attesa');

UPDATE orders SET status_works = 'manutenzione'
  WHERE LOWER(TRIM(status_works)) = 'manutenzione';

UPDATE orders SET status_works = NULL
  WHERE TRIM(status_works) = '';

-- 2. MIGRA "Contratto da inviare" da status_works a status_sales
UPDATE orders
  SET status_sales = 'contratto_da_inviare',
      status_works = 'da_iniziare'
  WHERE LOWER(TRIM(status_works)) = 'contratto da inviare';

-- 3. NORMALIZZA offer_status (stringhe italiane → snake_case)
UPDATE orders SET offer_status = 'accettata'         WHERE offer_status = 'Offerta Accettata';
UPDATE orders SET offer_status = 'rifiutata'         WHERE offer_status = 'Offerta Rifiutata';
UPDATE orders SET offer_status = 'invio_programmato' WHERE offer_status = 'Invio Programmato';
UPDATE orders SET offer_status = 'in_lavorazione'    WHERE offer_status = 'In Lavorazione';

-- 4. PULISCI status_sales (era tutto 'draft' inutilizzato)
-- Offerte accettate + lavori in svolgimento → layer 2 già attivo
UPDATE orders SET status_sales = 'lavori_in_corso'
  WHERE offer_status = 'accettata'
    AND status_works = 'in_svolgimento'
    AND (status_sales IS NULL OR status_sales = 'draft');

-- Offerte accettate + lavori completati → pronte per fatturazione
UPDATE orders SET status_sales = 'in_fatturazione'
  WHERE offer_status = 'accettata'
    AND status_works = 'completato'
    AND (status_sales IS NULL OR status_sales = 'draft');

-- Contratto da inviare già migrato sopra.
-- Le restanti draft con offerta accettata → contratto_da_inviare
UPDATE orders SET status_sales = 'contratto_da_inviare'
  WHERE offer_status = 'accettata'
    AND (status_sales IS NULL OR status_sales = 'draft');

-- Ordini non ancora accettati → status_sales NULL
UPDATE orders SET status_sales = NULL
  WHERE offer_status IN ('in_lavorazione', 'invio_programmato', 'rifiutata')
    AND status_sales = 'draft';

-- 5. TRIGGER automatico Layer 3 → Layer 2
CREATE OR REPLACE FUNCTION fn_sync_status_sales_from_works()
RETURNS TRIGGER AS $$
BEGIN
  -- PM avvia lavori → Account vede "Lavori in Corso"
  IF NEW.status_works = 'in_svolgimento'
     AND (OLD.status_works IS DISTINCT FROM 'in_svolgimento')
     AND NEW.status_sales = 'contratto_firmato'
  THEN
    NEW.status_sales := 'lavori_in_corso';
    INSERT INTO pm_activity_logs
      (action_type, description, actor_user_ref, order_ref, metadata)
    VALUES (
      'order_updated:status_sales',
      'Gleeye ha aggiornato lo stato commerciale di "' || COALESCE(NEW.title, 'commessa') || '" a Lavori in Corso',
      NULL,
      NEW.id,
      jsonb_build_object(
        'col', 'status_sales',
        'old', OLD.status_sales,
        'new', 'lavori_in_corso',
        'auto', true
      )
    );
  END IF;

  -- PM completa lavori → Account vede "In Fatturazione"
  IF NEW.status_works = 'completato'
     AND (OLD.status_works IS DISTINCT FROM 'completato')
     AND NEW.status_sales = 'lavori_in_corso'
  THEN
    NEW.status_sales := 'in_fatturazione';
    INSERT INTO pm_activity_logs
      (action_type, description, actor_user_ref, order_ref, metadata)
    VALUES (
      'order_updated:status_sales',
      'Gleeye ha aggiornato lo stato commerciale di "' || COALESCE(NEW.title, 'commessa') || '" a In Fatturazione',
      NULL,
      NEW.id,
      jsonb_build_object(
        'col', 'status_sales',
        'old', OLD.status_sales,
        'new', 'in_fatturazione',
        'auto', true
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_status_sales ON orders;
CREATE TRIGGER trg_sync_status_sales
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_sync_status_sales_from_works();

-- 6. AGGIORNA pm_activity_registry per la tabella 'orders'
UPDATE public.pm_activity_registry
SET 
  track_columns = ARRAY['p_m', 'notes', 'offer_status', 'status_works', 'status_sales'],
  update_action_name = 'order_updated',
  column_templates = COALESCE(column_templates, '{}'::jsonb) || jsonb_build_object(
    'status_sales', 'ha aggiornato lo stato commerciale di {title} a {new_value}',
    'status_works', 'ha aggiornato lo stato lavori di {title} a {new_value}',
    'offer_status', 'ha aggiornato l''offerta di {title} a {new_value}'
  )
WHERE table_name = 'orders';
