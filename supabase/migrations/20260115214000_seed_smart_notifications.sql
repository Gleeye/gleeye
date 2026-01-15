-- Migration to seed smart notification types
-- ID 20260115214000_seed_smart_notifications.sql

-- Helper to safely insert or update notification types
INSERT INTO notification_types (key, label_it, description, category, default_email, default_web, is_active)
VALUES 
    -- Prenotazioni
    ('booking_new', 'Nuova Prenotazione', 'Quando viene ricevuta una nuova prenotazione.', 'booking', true, true, true),
    ('booking_canceled', 'Prenotazione Cancellata', 'Quando un cliente o admin cancella una prenotazione.', 'booking', true, true, true),
    ('booking_updated', 'Modifica Prenotazione', 'Quando i dettagli di una prenotazione vengono modificati.', 'booking', false, true, true),
    
    -- Fatturazione
    ('invoice_new', 'Nuova Fattura Emessa', 'Quando viene generata una nuova fattura attiva.', 'invoice', false, true, true),
    ('invoice_overdue', 'Fattura Scaduta', 'Avviso quando una fattura risulta scaduta e non pagata.', 'invoice', true, true, true),
    
    -- Pagamenti
    ('payment_received', 'Pagamento Ricevuto', 'Conferma di ricezione pagamento.', 'payment', true, false, true),
    
    -- Collaboratori / Generale
    ('user_welcome', 'Benvenuto in Gleeye', 'Email di benvenuto per i nuovi collaboratori.', 'general', true, false, true)

ON CONFLICT (key) DO UPDATE SET
    label_it = EXCLUDED.label_it,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    default_email = EXCLUDED.default_email,
    default_web = EXCLUDED.default_web;
