INSERT INTO public.contact_forms (id, name, description, is_active, has_welcome_screen, welcome_title, welcome_description, welcome_button_text, fields)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Test Form Typeform Clone',
  'Testing',
  true,
  true,
  'Hi! Welcome to the premium experience',
  'We need to ask you a few quick questions to get started.',
  'Start Now',
  '[
    {"id": "field_name", "type": "text", "label": "What is your full name?", "required": true, "placeholder": "John Doe"},
    {"id": "field_email", "type": "email", "label": "What is your email address?", "required": true, "placeholder": "john@example.com"},
    {"id": "field_budget", "type": "radio", "label": "What is your estimated budget?", "options": ["< €1k", "€1k - €5k", "> €5k"], "required": true},
    {"id": "field_services", "type": "checkbox", "label": "Which services are you interested in?", "options": ["Web Development", "Marketing", "Consulting"], "required": false},
    {"id": "field_details", "type": "textarea", "label": "Tell us a bit more about your project", "required": false, "rows": 4},
    {"id": "field_terms", "type": "acceptance", "label": "I agree to the terms and conditions", "required": true}
  ]'::jsonb
);
