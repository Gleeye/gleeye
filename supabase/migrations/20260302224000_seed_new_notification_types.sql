-- Migration: Register New Notification Types for CRM, Admin, and Accounting
-- Description: Inserts the new configuration types into public.notification_types

INSERT INTO public.notification_types 
    (key, label_it, description, category, default_email, default_web, default_email_guest, is_active, email_subject_template, email_body_template, variables_schema)
VALUES
    -- CRM & Leads
    (
        'crm_new_lead',
        'Nuovo Lead',
        'Notifica inviata quando viene inserito un nuovo lead',
        'general',
        false, true, false, true,
        'Nuovo Lead: {{lead_first_name}} {{lead_last_name}}',
        '<p>È stato registrato un nuovo lead: <strong>{{lead_first_name}} {{lead_last_name}}</strong> ({{lead_email}}).</p>',
        '["lead_first_name", "lead_last_name", "lead_email"]'::jsonb
    ),
    (
        'crm_lead_status',
        'Cambio Stato Lead',
        'Notifica inviata quando un lead cambia stato',
        'general',
        false, true, false, true,
        'Aggiornamento Lead: {{lead_first_name}} {{lead_last_name}}',
        '<p>Il lead <strong>{{lead_first_name}} {{lead_last_name}}</strong> è passato allo stato: <strong>{{new_status}}</strong>.</p>',
        '["lead_first_name", "lead_last_name", "new_status"]'::jsonb
    ),
    (
        'crm_contact_form',
        'Nuovo Modulo Contatto',
        'Notifica quando un utente compila il modulo sul sito web',
        'general',
        true, true, false, true,
        'Nuova Richiesta di Contatto',
        '<p>È stato compilato un nuovo modulo di contatto da <strong>{{name}}</strong> ({{email}}).</p><p>Messaggio: <br><em>{{message}}</em></p>',
        '["name", "email", "message"]'::jsonb
    ),
    
    -- Accounting
    (
        'accounting_invoice_created',
        'Nuova Fattura',
        'Notifica alla creazione di una nuova fattura attiva o passiva',
        'invoice',
        false, true, false, true,
        'Nuova Fattura Registrata',
        '<p>È stata registrata una nuova fattura ({{invoice_type}}): <strong>{{invoice_number}}</strong> - {{client_name}} (Importo: {{amount}}€).</p>',
        '["invoice_type", "invoice_number", "client_name", "amount"]'::jsonb
    ),
    (
        'accounting_invoice_overdue',
        'Fattura Scaduta',
        'Promemoria inviato quando una fattura supera la data di scadenza',
        'invoice',
        true, true, false, true,
        'Promemoria Fattura Scaduta: {{invoice_number}}',
        '<p>La fattura <strong>{{invoice_number}}</strong> di {{client_name}} per un importo di {{amount}}€ è scaduta il <strong>{{due_date}}</strong> e non risulta ancora saldata.</p>',
        '["invoice_number", "client_name", "amount", "due_date"]'::jsonb
    ),
    (
        'accounting_payment_received',
        'Pagamento Ricevuto',
        'Notifica quando un pagamento viene registrato come incassato',
        'payment',
        false, true, false, true,
        'Pagamento Registrato: {{invoice_number}}',
        '<p>Il pagamento per la fattura <strong>{{invoice_number}}</strong> di {{client_name}} è stato registrato come incassato.</p>',
        '["invoice_number", "client_name"]'::jsonb
    ),
    (
        'accounting_bank_transaction',
        'Nuovo Movimento Bancario',
        'Notifica alla registrazione manuale o importazione di un movimento bancario',
        'payment',
        false, true, false, true,
        'Nuovo Movimento Bancario',
        '<p>È stato registrato un nuovo movimento bancario: {{description}} ({{amount}}€).</p>',
        '["description", "amount"]'::jsonb
    ),
    
    -- Admin & System
    (
        'admin_new_user',
        'Nuovo Utente Registrato',
        'Notifica quando un nuovo collaboratore o partner viene aggiunto',
        'general',
        true, true, false, true,
        'Nuovo Utente a Sistema: {{user_name}}',
        '<p>Un nuovo utente è stato aggiunto al sistema: <strong>{{user_name}}</strong> (Ruolo: {{user_role}}).</p>',
        '["user_name", "user_role"]'::jsonb
    ),
    (
        'admin_system_alert',
        'Allerta di Sistema',
        'Avvisi generali di sistema (errori critici, avvisi sicurezza)',
        'general',
        true, true, false, true,
        '⚠️ Avviso di Sistema: {{alert_title}}',
        '<p>Il sistema segnala il seguente evento:</p><p><strong>{{alert_message}}</strong></p>',
        '["alert_title", "alert_message"]'::jsonb
    ),
    (
        'admin_new_order',
        'Nuovo Ordine (Commessa)',
        'Notifica quando viene generato un nuovo ordine di vendita',
        'order',
        false, true, false, true,
        'Nuovo Ordine Registrato: {{order_number}}',
        '<p>È stato registrato un nuovo ordine: <strong>{{order_number}}</strong> per il cliente {{client_name}}.</p>',
        '["order_number", "client_name"]'::jsonb
    )
ON CONFLICT (key) DO UPDATE SET
    category = EXCLUDED.category,
    label_it = EXCLUDED.label_it,
    description = EXCLUDED.description,
    variables_schema = EXCLUDED.variables_schema;
