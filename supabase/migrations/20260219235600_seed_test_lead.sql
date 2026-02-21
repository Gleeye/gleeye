-- Seed: Insert Video Explainer core service and test lead from SAP booking
INSERT INTO core_services (name, description) 
VALUES ('Video Explainer', 'Servizio di Video Explainer originato da SAP')
ON CONFLICT DO NOTHING;

INSERT INTO leads (lead_code, company_name, core_service_id, status, macro_status, notes)
SELECT 
    'L-3D4MEC',
    '3D4MEC Srl',
    (SELECT id FROM core_services WHERE name = 'Video Explainer' LIMIT 1),
    'Call di onboarding prenotata',
    'in lavorazione',
    E'Generato da prenotazione SAP.\nReferente: Fabrizio Marino Corsini\nEmail: fabrizio.mc@3d4mec.com\nTelefono: +39 3455450838\nData prenotazione: 11/02/2026 09:30:00\nServizio: Video Explainer'
WHERE NOT EXISTS (SELECT 1 FROM leads WHERE lead_code = 'L-3D4MEC');
