-- Add guest specific template columns to notification_types
ALTER TABLE notification_types 
ADD COLUMN IF NOT EXISTS email_subject_template_guest TEXT,
ADD COLUMN IF NOT EXISTS email_body_template_guest TEXT,
ADD COLUMN IF NOT EXISTS default_email_guest BOOLEAN DEFAULT TRUE;

-- Seed default guest templates for existing types
-- 1. booking_new: use the hardcoded logic as the default template
UPDATE notification_types 
SET 
  email_subject_template_guest = 'Conferma Prenotazione: {{service_name}}',
  email_body_template_guest = '<p style="font-size: 16px;">Gentile <strong>{{guest_name}}</strong>,</p>
<p>Ti confermiamo l''appuntamento per <strong>{{service_name}}</strong>.</p>
<div style="margin: 24px 0; padding: 20px; background-color: #f7fafc; border-radius: 12px; border: 1px solid #edf2f7;">
    <div style="margin-bottom: 8px; color: #718096; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Data e Ora</div>
    <div style="font-size: 18px; color: #2d3748; font-weight: 500;">
        {{date}}
    </div>
        <div style="font-size: 16px; color: #4a5568;">
       dalle {{start_time}} alle {{end_time}}
    </div>
</div>
<p style="text-align:center; font-size: 0.9em; color: #718096;">Puoi aggiungere questo evento al tuo calendario usando i link qui sotto.</p>'
WHERE key = 'booking_new';

-- 2. booking_reminder (Example)
UPDATE notification_types 
SET 
  email_subject_template_guest = '🔔 Promemoria: Il tuo appuntamento tra poco',
  email_body_template_guest = '<p>Ciao {{guest_name}}, ti ricordiamo il tuo appuntamento di domani alle {{start_time}}.</p>'
WHERE key = 'booking_reminder';
