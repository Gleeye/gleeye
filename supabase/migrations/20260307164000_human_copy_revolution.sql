-- Human Copy Revolution for Gleeye Activity Log

-- 1. Smarter Friendly Labels (The "Vocabulary")
CREATE OR REPLACE FUNCTION public.fn_friendly_label(_val TEXT)
RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Master Human Templates for the Registry
-- We are changing the wording to be more like a story ("Ha fatto questo", "Ha cambiato quello")

-- PM ITEMS (Tasks)
UPDATE public.pm_activity_registry 
SET 
    template_insert = '✨ Ha creato una nuova attività: **{title}**',
    column_templates = '{
        "status": "🛠️ Ha spostato l''attività in: **{status}**",
        "title": "📝 Ha rinominato l''attività in: **{title}**",
        "due_date": "📅 Ha aggiornato la scadenza al **{due_date}**",
        "priority": "⚡ Ha cambiato la priorità in: **{priority}**",
        "description": "📖 Ha aggiornato la descrizione dell''attività"
    }'::jsonb,
    insert_action_name = 'creazione',
    update_action_name = 'modifica'
WHERE table_name = 'pm_items';

-- ORDERS (Commesse)
UPDATE public.pm_activity_registry 
SET 
    column_templates = '{
        "status_works": "🛠️ Ha aggiornato lo stato avanzamento a: **{status_works}**",
        "offer_status": "📊 L''offerta è passata a: **{offer_status}**",
        "total_amount_tax_excluded": "💰 Budget aggiornato a: **€ {total_amount_tax_excluded}**",
        "title": "📝 Ha cambiato il nome della commessa in: **{title}**",
        "p_m": "👤 Ha cambiato il Project Manager in: **{p_m}**"
    }'::jsonb,
    update_action_name = 'aggiornamento'
WHERE table_name = 'orders';

-- SPACES (Progetti)
UPDATE public.pm_activity_registry 
SET 
    template_insert = '🚀 Ha aperto un nuovo progetto: **{name}**',
    column_templates = '{
        "status": "🔄 Stato progetto cambiato in: **{status}**",
        "name": "📝 Progetto rinominato in: **{name}**",
        "type": "🏷️ Tipologia progetto: **{type}**"
    }'::jsonb
WHERE table_name = 'pm_spaces';

-- COMMENTS
UPDATE public.pm_activity_registry 
SET 
    template_insert = '💬 Ha scritto: "{body}"',
    insert_action_name = 'commento'
WHERE table_name = 'pm_item_comments';

-- DOCUMENT PAGES
INSERT INTO public.pm_activity_registry (table_name, track_insert, template_insert, item_ref_source, space_ref_source)
VALUES (
    'doc_pages',
    true,
    '📄 Ha aggiunto un documento: **{title}**',
    'item_ref',
    'space_ref'
)
ON CONFLICT (table_name) DO UPDATE SET 
    track_insert = EXCLUDED.track_insert,
    template_insert = EXCLUDED.template_insert;

-- 3. Trigger Generic Fallback ("updated" instead of "status_changed")
-- If a table isn't matched specifically, we use a friendly default
UPDATE public.pm_activity_registry 
SET update_action_name = 'modifica_generica' 
WHERE update_action_name = 'status_changed' OR update_action_name = 'UPDATE';

-- 4. Incarichi (Assignments)
INSERT INTO public.pm_activity_registry (table_name, track_insert, track_update, template_insert, track_columns, column_templates, order_ref_source)
VALUES (
    'assignments',
    true,
    true,
    '🛠️ Ha assegnato un nuovo incarico su quest''ordine',
    ARRAY['status', 'collaborator_id', 'total_amount'],
    '{
        "status": "📦 Stato incarico: **{status}**",
        "collaborator_id": "👤 Ha assegnato l''incarico a un nuovo collaboratore",
        "total_amount": "💰 Compenso incarico aggiornato a: **€ {total_amount}**"
    }'::jsonb,
    'order_id'
)
ON CONFLICT (table_name) DO UPDATE SET 
    track_insert = EXCLUDED.track_insert,
    track_update = EXCLUDED.track_update,
    template_insert = EXCLUDED.template_insert,
    column_templates = EXCLUDED.column_templates;

DROP TRIGGER IF EXISTS trg_assignments_generic_log ON public.assignments;
CREATE TRIGGER trg_assignments_generic_log AFTER INSERT OR UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.fn_app_activity_logger();
