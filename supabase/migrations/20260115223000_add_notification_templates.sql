-- Add template columns to notification_types
ALTER TABLE notification_types 
ADD COLUMN IF NOT EXISTS email_subject_template TEXT,
ADD COLUMN IF NOT EXISTS email_body_template TEXT,
ADD COLUMN IF NOT EXISTS variables_schema JSONB DEFAULT '[]'::jsonb;

-- Seed default templates
-- 1. booking_new
UPDATE notification_types 
SET 
  email_subject_template = '📅 Nuova Prenotazione: {{guest_name}}',
  email_body_template = '<p>Ciao,</p>
<p>Hai ricevuto una nuova prenotazione da <strong>{{guest_name}}</strong>.</p>
<div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
<ul style="margin: 0; padding-left: 20px;">
  <li><strong>Servizio:</strong> {{service_name}}</li>
  <li><strong>Data:</strong> {{date}}</li>
  <li><strong>Orario:</strong> {{time_range}}</li>
  <li><strong>Email Cliente:</strong> {{guest_email}}</li>
</ul>
</div>
<p>Verifica la disponibilità e gestisci la prenotazione dal pannello.</p>',
  variables_schema = '["guest_name", "service_name", "date", "time_range", "guest_email"]'::jsonb
WHERE key = 'booking_new';

-- 2. booking_reminder (Example)
UPDATE notification_types 
SET 
  email_subject_template = '🔔 Promemoria: Prenotazione imminente',
  email_body_template = '<p>Ricorda che hai un appuntamento con {{guest_name}} domani alle {{start_time}}.</p>',
  variables_schema = '["guest_name", "start_time"]'::jsonb
WHERE key = 'booking_reminder';

-- 3. invoice_overdue
UPDATE notification_types 
SET 
  email_subject_template = '⚠️ Fattura Scaduta',
  email_body_template = '<p>Attenzione, la fattura #{{invoice_number}} risulta scaduta.</p><p>Controlla il pannello amministrativo per i dettagli.</p>',
  variables_schema = '["invoice_number"]'::jsonb
WHERE key = 'invoice_overdue';

-- 4. payment_received
UPDATE notification_types 
SET 
  email_subject_template = '💰 Pagamento Ricevuto',
  email_body_template = '<p>Hai ricevuto un pagamento di {{amount}} per la fattura #{{invoice_number}}.</p>',
  variables_schema = '["amount", "invoice_number"]'::jsonb
WHERE key = 'payment_received';
