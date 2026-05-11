SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict 1FUHg1j3xhKtjzd0WSR4HHXbq5s4xlb7UzU4zXAy7dIpfaIit4BWAc1Za0QIC5l

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: appointments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."appointments" ("id", "title", "start_time", "end_time", "note", "status", "mode", "location", "order_id", "client_id", "created_by", "created_at", "updated_at") VALUES
	('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Meeting di alignement', '2026-02-02 15:40:20.170991+00', '2026-02-02 16:40:20.170991+00', 'Discutere dettagli campagna', 'confermato', 'remoto', 'https://meet.google.com/abc-defg-hij', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, '2026-02-01 15:40:20.170991+00', '2026-02-01 15:40:20.170991+00');


--
-- Data for Name: appointment_client_participants; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: collaborators; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."collaborators" ("id", "full_name", "email", "phone", "role", "user_id", "created_at", "is_active", "document_health_card_back_url", "name", "first_name", "last_name", "birth_date", "birth_place", "fiscal_code", "address", "city", "province", "cap", "pec", "vat_number", "bank_name", "iban", "tags", "avatar_url", "airtable_id") VALUES
	('3266c159-9a87-44bd-a190-21a4d5d474fa', 'Simone Spinetti', 'simone@gleeye.eu', '+39 340 18 94 065', 'Videomaker', NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'SPINE', 'Simone', 'Spinetti', '1994-07-20', 'Genova (GE)', 'SPNSMN94L20D969X', 'Via Tomaso Pendola 7, 16143 Genova (GE)', NULL, NULL, NULL, NULL, '02773540998', NULL, NULL, 'Video', NULL, 'SPINE'),
	('31dc4488-7bbf-437a-8a0d-fd5ff515b9fc', 'Marco Selvaggio', 'marco@gleeye.eu', '+39 348 78 91 508', 'Videomaker', NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'MED', 'Marco', 'Selvaggio', '1995-07-29', 'Genova (GE)', 'SLVMRC95C29D969E', 'Via Fossato San Nicolò 11/1, 16136 Genova (GE)', NULL, NULL, NULL, NULL, '02790380998', NULL, NULL, 'Video', NULL, 'MED'),
	('36a0e60e-e5d5-403d-a7a6-07fe4429ab73', 'William Bignone', 'william@gleeye.eu', '+39 348 975 9085', 'Fotografo', NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'WILLY', 'William', 'Bignone', NULL, NULL, 'BGNWLM03A18D969K', 'Via Migliarini 4/13 - 16011 - Arenzano (GE)', NULL, NULL, NULL, NULL, '02925490993', NULL, NULL, 'Foto', NULL, 'WILLY'),
	('cc86b9a6-2b2a-49e8-ad16-b3189ecd7b4e', 'Mattia Montano', 'mattia@gleeye.eu', '+39 340 970 3996', 'Videomaker', NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'MATTIA', 'Mattia', 'Montano', '1992-04-27', 'Genova', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Video', NULL, 'MATTIA'),
	('b85acc72-bf2d-454a-b7c0-78ea8935d6bb', 'Alessio Ursida', 'alessioursida@gmail.com', '+39 345 45 17 525', 'Fotografo', NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'URSIDA', 'Alessio', 'Ursida', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Foto', NULL, 'URSIDA'),
	('217e746a-f823-4c64-bc9d-3cd026112b8b', 'Sara Verterano', 'sara@gleeye.eu', '+39 340 49 62 711', 'Web Designer', NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'SARA', 'Sara', 'Verterano', '1988-04-24', 'Genova (GE)', 'VRTSRA88D64D969L', 'Via Palmaria 7/10, 16121 Genova (GE)', NULL, NULL, NULL, NULL, '02494880996', NULL, NULL, 'Siti Web & E-commerce', NULL, 'SARA'),
	('db6d9031-51a1-4afb-a108-d62f3a9574ae', 'Gabriele Picone', 'gabriele@gleeye.eu', '+39 377 12 81 315', NULL, NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'GABRI', 'Gabriele', 'Picone', '2000-07-16', 'Genova (GE)', 'PCNGRL00L16D969S', 'Viale Giancarlo Odino 5, 16125 Genova (GE)', NULL, NULL, NULL, NULL, '02964730994', NULL, NULL, 'Siti Web & E-commerce,Digital Marketing', NULL, 'GABRI'),
	('2c19823b-bff3-47e0-bf93-84f8b0f7930e', 'Davide Gentile', 'davide@gleeye.eu', '+39 335 16 24 363', NULL, NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'DAVIDE', 'Davide', 'Gentile', '1987-12-17', 'Genova (GE)', 'GNTDVDT17D969L', 'Via Napoli 20/2, 16134 Genova (GE)', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Project Manager,Account', NULL, 'DAVIDE'),
	('8da75dbb-803d-41ab-b826-9c2350ae0925', 'Andrea Visentin', 'andrea@gleeye.eu', '+39 340 10 99 024', NULL, NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'ANDREA', 'Andrea', 'Visentin', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Project Manager,Account', NULL, 'ANDREA'),
	('a69ce95d-7e86-4c74-a715-20f302342958', 'Martina Gommellini', 'martina@gleeye.eu', '+39 349 55 69 537', 'Grafica', NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'GOMMELLINIM', 'Martina', 'Gommellini', '1996-06-12', 'Genova (GE)', 'GMMMTN96H52D969H', 'S.TA DI SAN GEROLAMO 4 NERO INT 15', NULL, NULL, NULL, NULL, '02971080995', NULL, NULL, 'Grafica', NULL, 'GOMMELLINIM'),
	('34a4e93d-a6fd-4944-8600-305681f881b7', 'Mara Barbero', 'mara@gleeye.eu', '+39 347 58 59 230', 'Project Manager', NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'BARBEROM', 'Mara', 'Barbero', '1980-05-30', 'Savona (SV)', 'BRBMRA80E70I480V', 'Via Millelire 1/d, 17028 Bergeggi (SV)', NULL, NULL, NULL, NULL, '10189960965', NULL, NULL, 'Project Manager,Account', NULL, 'BARBEROM'),
	('92419a73-8ad5-42ab-a08f-9db0e345cfcf', 'Leyla El Abiri', 'leyla@gleeye.eu', '+39 331 72 85 271', 'Content Creator', NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'LEYLA', 'Leyla', 'El Abiri', '1999-02-04', 'Genova (GE)', 'LBRLYL99B44D969X', 'Via del Chiappazzo 108 uni, 16137 Genova (GE)', NULL, NULL, NULL, NULL, '02803410998', NULL, NULL, 'Digital Marketing', NULL, 'LEYLA'),
	('a14199e5-9488-4500-a406-7e881cb4c62e', 'Camille Asquié', 'camille@gleeye.eu', '+39 351 44 09 578', 'Content Creator', NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'ASQUIEC', 'Camille', 'Asquié', '1996-01-16', 'Genova (GE)', 'SQACLL96A56D969P', 'Via Filippo Casoni 5/14D, 16143 Genova (GE)', NULL, NULL, NULL, NULL, '02981830991', NULL, NULL, 'Digital Marketing', NULL, 'ASQUIEC'),
	('dabaaee2-e9bb-4ae3-a477-2b73886be2d3', 'Beatrice Frugone', NULL, NULL, 'Collaboratore Esterno', NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'BEATRICE', 'Beatrice', 'Frugone', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'BEATRICE'),
	('ffba1af1-2c0c-4d71-86cf-5b0df4e5ece6', 'Raluca Ghebenei', 'raluca@gleeye.eu', '+39 353 398 2247', 'Grafica', NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'RALUCA', 'Raluca', 'Ghebenei', '2000-07-24', 'SIBIU (ROMANIA)', 'GHBRCL00L642129T', 'VIA XVI GIUGNO 1944 7B/1, 16153 GENOVA', NULL, NULL, NULL, NULL, '03013370998', NULL, NULL, 'Grafica', NULL, 'RALUCA'),
	('b789ce44-0dc2-4297-bb5b-8c81012f5743', 'Alessio Castellano', 'alessiocastellano49@gmail.com', '+39 345 579 7000', 'Videomaker', NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'CASTELLANOA', 'Alessio', 'Castellano', NULL, NULL, 'CSTLSS98P01D969F', NULL, NULL, NULL, NULL, NULL, '02964380998', NULL, NULL, 'Video', NULL, 'CASTELLANOA'),
	('0807e144-1150-4f79-8b0a-3f6a26ebf2cc', 'Paolo Ferretti', 'paolo.ferrets@gmail.com', '+39 335 668 0299', 'FOTOGRAFO', NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'FERRETTIP', 'Paolo', 'Ferretti', NULL, NULL, 'FRRPLA90E03D969P', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Foto', NULL, 'FERRETTIP'),
	('f04ad0b7-05ba-4c43-bbd7-e73b3b77204f', 'Nadia Denurchis', 'nadia.denurchis@gmail.com', '+39 347 969 8577', 'Podcast', NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'DENURCHISN', 'Nadia', 'Denurchis', '1985-03-20', 'Genova (GE)', 'DNRNDA85C60D969F', 'Via Giacomo Boero 16/2, 16132 Genova (GE)', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Podcast', NULL, 'DENURCHISN'),
	('30338196-c614-4643-a919-912543b5a800', 'Elisa Piazza', 'elisa.piazza26@gmail.com', '+393491147106', 'Tecnico Podcast', NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'PIAZZAE', 'Elisa', 'Piazza', '2003-09-26', 'Genova', 'PZZLSE03P66D969B', 'Corso de Stefanis 6/22 A', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Podcast', NULL, 'PIAZZAE'),
	('ee7d8812-d306-49f2-9fbd-433197bbc45c', 'Sharon Savona', 'sharon@gleeye.eu', '+393281650760', 'Account Junior', NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'SAVONAS', 'Sharon', 'Savona', '1993-06-11', 'Genova', 'SVNSRN93H51D969H', 'Via Giovanni Trossarelli 9b/23', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Account', NULL, 'SAVONAS'),
	('fe7264f3-2160-4372-b54d-adc93e55c820', 'Elisa Bertolone', NULL, NULL, 'Collaboratore Esterno', NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'ELISA', 'Elisa', 'Bertolone', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'ELISA'),
	('0c1c3f90-9279-4505-965b-836017ef0c18', 'Ricardo Vela', NULL, NULL, 'Collaboratore Esterno', NULL, '2026-02-01 14:40:41.520451+00', true, NULL, 'RICARDO', 'Ricardo', 'Vela', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'RICARDO');


--
-- Data for Name: appointment_internal_participants; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: appointment_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."appointment_types" ("id", "name", "color", "icon", "created_at") VALUES
	('c05021df-52ae-4ce1-a61b-4bbfd6d5affb', 'Riunione', '#3b82f6', 'groups', '2026-02-01 15:37:54.149608+00'),
	('89d8d563-0af8-4f33-95ff-939a553aa444', 'Shooting', '#f59e0b', 'camera_alt', '2026-02-01 15:37:54.149608+00'),
	('27604b6e-8ab4-4707-9d14-54729d3b88ff', 'Riprese Video', '#ef4444', 'videocam', '2026-02-01 15:37:54.149608+00'),
	('59df1c3e-db88-4a14-9831-31c81a1df211', 'Workshop', '#8b5cf6', 'school', '2026-02-01 15:37:54.149608+00'),
	('c1229b89-d7ec-4279-90d3-47cda8808c95', 'Call Cliente', '#10b981', 'call', '2026-02-01 15:37:54.149608+00');


--
-- Data for Name: appointment_type_links; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."appointment_type_links" ("appointment_id", "type_id") VALUES
	('cccccccc-cccc-cccc-cccc-cccccccccccc', 'c05021df-52ae-4ce1-a61b-4bbfd6d5affb');


--
-- Data for Name: assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: availability_overrides; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: booking_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: booking_items; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: availability_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: bank_statements; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: booking_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: booking_holds; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: booking_item_collaborators; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: channels; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."channels" ("id", "name", "is_private", "topic", "description", "is_archived", "created_by", "created_at") VALUES
	('c041f5a6-6500-4d62-8738-63649870264b', 'generale', false, NULL, 'Canale per discussioni generali', false, NULL, '2026-02-01 14:39:45.17144+00'),
	('957f3c89-c124-48d2-8ccf-047b72314110', 'casuale', false, NULL, 'Canale per discussioni off-topic', false, NULL, '2026-02-01 14:39:45.171989+00');


--
-- Data for Name: channel_members; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: collaborator_google_auth; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: collaborator_rest_days; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: collaborator_services; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: conversation_members; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: debug_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: external_busy_cache; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: external_calendar_connections; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: message_attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: message_reads; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: notification_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."notification_types" ("id", "key", "label_it", "description", "category", "default_email", "default_web", "is_active", "created_at", "email_subject_template", "email_body_template", "variables_schema", "email_subject_template_guest", "email_body_template_guest", "default_email_guest") VALUES
	('0c359dc7-7296-41c0-9777-1f5dd01d8002', 'booking_cancelled', 'Prenotazione Annullata', 'Quando una prenotazione viene cancellata', 'booking', true, true, true, '2026-02-01 14:39:44.560411+00', NULL, NULL, '[]', NULL, NULL, true),
	('212338fc-c682-4112-998f-94b01a74d575', 'payment_due', 'Pagamento in Scadenza', 'Quando un pagamento sta per scadere', 'payment', true, true, true, '2026-02-01 14:39:44.560411+00', NULL, NULL, '[]', NULL, NULL, true),
	('052e78e3-ac70-4776-9c89-53149889453f', 'invoice_ready', 'Fattura Pronta', 'Quando viene generata una nuova fattura', 'invoice', true, false, true, '2026-02-01 14:39:44.560411+00', NULL, NULL, '[]', NULL, NULL, true),
	('881adc7e-2311-4655-b566-df3c5ab5bdbc', 'order_assigned', 'Nuovo Ordine Assegnato', 'Quando vieni assegnato a un nuovo ordine', 'order', true, true, true, '2026-02-01 14:39:44.560411+00', NULL, NULL, '[]', NULL, NULL, true),
	('512e3b39-487f-4d3a-9a08-58c3d99d41b1', 'booking_canceled', 'Prenotazione Cancellata', 'Quando un cliente o admin cancella una prenotazione.', 'booking', true, true, true, '2026-02-01 14:39:44.615292+00', NULL, NULL, '[]', NULL, NULL, true),
	('ae93e631-115f-4610-a03f-8470d8479999', 'booking_updated', 'Modifica Prenotazione', 'Quando i dettagli di una prenotazione vengono modificati.', 'booking', false, true, true, '2026-02-01 14:39:44.615292+00', NULL, NULL, '[]', NULL, NULL, true),
	('f0ffdad9-6010-492f-ae44-1a3ad3c410e6', 'invoice_new', 'Nuova Fattura Emessa', 'Quando viene generata una nuova fattura attiva.', 'invoice', false, true, true, '2026-02-01 14:39:44.615292+00', NULL, NULL, '[]', NULL, NULL, true),
	('2a754248-9245-4dd9-a689-ff658eca4eaa', 'user_welcome', 'Benvenuto in Gleeye', 'Email di benvenuto per i nuovi collaboratori.', 'general', true, false, true, '2026-02-01 14:39:44.615292+00', NULL, NULL, '[]', NULL, NULL, true),
	('9390218d-256d-4ab1-b399-c1dd0908a9a3', 'invoice_overdue', 'Fattura Scaduta', 'Avviso quando una fattura risulta scaduta e non pagata.', 'invoice', true, true, true, '2026-02-01 14:39:44.615292+00', '⚠️ Fattura Scaduta', '<p>Attenzione, la fattura #{{invoice_number}} risulta scaduta.</p><p>Controlla il pannello amministrativo per i dettagli.</p>', '["invoice_number"]', NULL, NULL, true),
	('e9d81048-4b09-49d8-a89c-e162cf28b269', 'payment_received', 'Pagamento Ricevuto', 'Conferma di ricezione pagamento.', 'payment', true, false, true, '2026-02-01 14:39:44.560411+00', '💰 Pagamento Ricevuto', '<p>Hai ricevuto un pagamento di {{amount}} per la fattura #{{invoice_number}}.</p>', '["amount", "invoice_number"]', NULL, NULL, true),
	('cc1fc1e7-75b8-49b5-855c-414f24245a50', 'booking_new', 'Nuova Prenotazione', 'Quando viene ricevuta una nuova prenotazione.', 'booking', true, true, true, '2026-02-01 14:39:44.560411+00', '📅 Nuova Prenotazione: {{guest_name}}', '<p>Ciao,</p>
<p>Hai ricevuto una nuova prenotazione da <strong>{{guest_name}}</strong>.</p>
<div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
<ul style="margin: 0; padding-left: 20px;">
  <li><strong>Servizio:</strong> {{service_name}}</li>
  <li><strong>Data:</strong> {{date}}</li>
  <li><strong>Orario:</strong> {{time_range}}</li>
  <li><strong>Email Cliente:</strong> {{guest_email}}</li>
</ul>
</div>
<p>Verifica la disponibilità e gestisci la prenotazione dal pannello.</p>', '["guest_name", "service_name", "date", "time_range", "guest_email"]', 'Conferma Prenotazione: {{service_name}}', '<p style="font-size: 16px;">Gentile <strong>{{guest_name}}</strong>,</p>
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
<p style="text-align:center; font-size: 0.9em; color: #718096;">Puoi aggiungere questo evento al tuo calendario usando i link qui sotto.</p>', true),
	('51dfd48e-a429-482a-a04c-8afd406e4e92', 'booking_reminder', 'Promemoria Prenotazione', 'Promemoria 24h prima della prenotazione', 'booking', true, false, true, '2026-02-01 14:39:44.560411+00', '🔔 Promemoria: Prenotazione imminente', '<p>Ricorda che hai un appuntamento con {{guest_name}} domani alle {{start_time}}.</p>', '["guest_name", "start_time"]', '🔔 Promemoria: Il tuo appuntamento tra poco', '<p>Ciao {{guest_name}}, ti ricordiamo il tuo appuntamento di domani alle {{start_time}}.</p>', true);


--
-- Data for Name: order_collaborators; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: order_contacts; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: passive_invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."passive_invoices" ("id", "invoice_number", "issue_date", "amount", "supplier_id", "collaborator_id", "created_at", "description", "service_description", "related_orders", "tax_amount", "amount_tax_included", "amount_tax_excluded", "vat_rate", "vat_eligibility", "attachment_url", "status", "payment_date", "category", "ritenuta", "rivalsa_inps", "stamp_duty", "iva_attiva", "notes") VALUES
	('31ff5f3c-0d31-4857-95b4-5db90bd01422', '150/001', '2024-03-18', NULL, 'e5050daa-0756-4143-93d4-bf4e8ce77e58', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 1677.75, 1500.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/QrfksqeaF5d35lF4RVTtcQ/JE_bs0yv97lgvbsTCv6AszUqLIUirS2mNkodCHrDpi0mdYEdqQvWtvwe4dNaK83JvaejSL_IRUjbBaCwoG2xtIiv7rp78wBxqN5TElxX7iXgv9vkaKhxam2df7LIM4ysuiTGPWxJbYsBoNnnLBs-Duu8lGY7ymFNGwdw6OexPTvLBY8WXjzZf8izjRz1qbKI/mjh60WPTURBEn8utXzVpLDceSEk1EII7jVO58txCcRA', 'Pagato', '2024-04-16', 'Notaio per fondazione società', 0.00, 0.00, 0.00, false, NULL),
	('b89c35c0-abdf-40ff-895d-838ef920a2a4', 'Invoice-270DF76E-0001', '2024-04-16', NULL, 'ffdf22e8-76a0-4e64-a8a7-21956ed0e8e0', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 103.72, 103.72, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/LBgTjhIQ__uADSZKp9PnuA/ocf8uQ38V9KLD0ZnLkTWbv1M9s8PskS_iEot5lZhJMx4jURVNtnLb375cnZ-gGJ8vdeJksO4x_wEciohvXN-WQwaqpS3eb8i3IgpEmboSInOprdrNyxFJjwURd75mrCEgRL_Q6eoFd0vwTWcbevd0Y05IcUggC4P4NpDKZhh_As/HyX526gE_UUKjXimOV8u4GEfQkIBzTTmoadzkGiDNCA', 'Pagato', '2024-04-16', 'Licenza annuale per automazione Make.com', 0.00, 0.00, 0.00, false, NULL),
	('543e3a11-11f0-4ecc-82fe-d8305e82dc01', '2A62818B0001', '2024-04-16', NULL, 'c6694df0-d20e-47e3-afe3-f482867b7055', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 461.02, 461.02, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/WuB_UZTBdDoSj63orqt9SQ/fZDPYV5-036U05PeeReFEs1CUPnOHViFnuQrBiGyVEo8IYGpvkxzVvWIPeO0Z_oz4SvKjFTievF73GbF14nL_XJsupzPAxXz1ReIDUbqpFsTw4x1dFG9RWt0RzjX1IZqUE_mdMPKLIMjqCI8tbmmS5bmpIR2myuFtW2s-Ds1Uak/PdTJRToP7wVjPkz_d_T1StFicygsoQJYEgFHKBQgLPw', 'Pagato', '2024-04-16', 'Licenza annuale per 2 utenti', 0.00, 0.00, 0.00, false, NULL),
	('fbd63250-4b39-4ce2-aeff-a85d9bfe76ad', '1000243002952662', '2024-04-16', NULL, 'ab52e98e-2eb5-4c15-9ac4-5b1436b3ee93', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 22.00, 1.00, 1.22, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/xEo-5kuHjqI9wTVp2iSOAg/IIgRc3WSPrdVW1zNifzcbob88HqPmeOkKlhCEngQ7Z_qLu56Y5z4ICaE352fyr9i64yyLZIJnwxxVqcgJR5nvKuyvWBmCAWhhh7RtYFLtD7rsT_JXmyxQOOMpjoZo2vtIw1JP1AOyySb12nCPmqd4MZRWl7DCBIa7gjAFJeJLd1yE9mwGMelyhZbsFfSId3M/lr4Uwh4ImzPFmFkNxjZLr-Av9axZwNKL-fYy7AmSKv8', 'Pagato', '2024-04-16', 'Primi tre mesi di fatturazione elettronica', 0.00, 0.00, 0.00, false, NULL),
	('98051f95-969c-46f3-82e4-3fd60ade91fe', '24-2', '2024-05-10', NULL, NULL, 'fe7264f3-2160-4372-b54d-adc93e55c820', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0009', 0.00, 3000.00, 2400.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/eGQKfXZadVDd4Wj9ZRiH3A/w1pO6fSsQD-qBKHBBYEBSBwvkcW-OJ3zN_5eM-g75Kzte5-ISukM32oscZU55fy2sZDgGVZYQhOnQs1i88KuGMQnQtjmmgUJzivgXOjz2dF1N2JcvBw0R9Z5MMDJkA2CV57fY39-zbWIV0C_F-1hOeID5ZVUD_n5K0OJKq5ldZ9YCw8RBzxmtbwYTkbi-tmk/PA4RerHj5haj1MpMlb9PpX0mAD_3SpFuGxG4wMdZoSY', 'Pagato', '2024-05-13', 'Ritenuta d''acconto', 0.00, 0.00, 0.00, false, NULL),
	('065005ed-28a1-48b7-bae2-2067cd8f4a73', '24-12', '2024-07-11', NULL, NULL, '3266c159-9a87-44bd-a190-21a4d5d474fa', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0012', 0.00, 402.00, 418.08, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/uDaXMhNt63dMRwWzkDI-iw/atpeA9KrgyvjtuJyU1YQXK0qNeVOKVvCxcWp49ynKzSC0jyalOQD6OoDjz0zCb0XSJED01jrtN0qhQXLvE6vuDd4_XGfBqlTeEDkD_ePVuhoPEyiEHXNBIvMMMzLg642ACDs_m0ChaQKMPhZt1WoLbRrtebtggyc7opOvH36RD5iu6ptXldwd3vtU1y4m7X_vWrGcD7VoPu6geafFKfg9A/W-vc105g5YcwBT73gWUQifBN0IWR6pZhGuW-gwAnxPg', 'Pagato', '2024-06-11', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('eda46c85-c4c3-4e5b-be9b-5d6202f754bd', '03C5E0E1-0001', '2024-06-08', NULL, '7a17571f-cd7c-4ac9-921f-f0febb288b25', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 176.00, 8.00, 9.76, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/dhTy5wRzoORBTA89AL6FGQ/rJZbLLJBYDT0wq-fI2D-3-IPb-Wq06JYx5h85LW-gfMJ6H8i3ZY3Uju7816LFcxW5VLvh4jLqxb8PdcjIIIxch__j7Peoxu_Lf6EQGn503fQDkzA7s7FTO6yHsN02z3SvStf-dDvIj5Eqm3pXH60jqeGkO--SyIiYQVwqxEn1xE/nWXYGQAN5n91DEMbsgtUTiGQhQp2gC9t6f1Fks3-5v0', 'Pagato', '2024-06-08', 'Acquisto 500 crediti per conversioni automatizzate', 0.00, 0.00, 0.00, false, NULL),
	('e5b1846c-1727-429b-af9b-0d13b943e142', '24-24', '2024-06-07', NULL, NULL, '217e746a-f823-4c64-bc9d-3cd026112b8b', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0013,24-0002', 0.00, 1960.00, 1960.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/8d_VS5RG6WYdmQHkvUP8Dw/e1D13CXDuWR5ZzOyeQV2i0azRL80KoLPXKVSOe_j6kMGUiIl9E3CKdpSBeUjpdY5pIEGsUlsF269O9JCNt_IZqepBznn9PB140PKfAfNm9ktchk4UF9EwNU045JbTG3Jz6WaT0zh0fn8uYPLoH9sppHBfWoSWH-I2ur8Oj9ZcK0/TndbWJ6I9ew0L1mwsmdaYpyKHPH3kamX3EVLf65KoKA', 'Pagato', '2024-06-11', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('02b88983-fa14-4260-bc6a-9a743960a605', '4332-2024-592INV', '2024-07-31', NULL, 'b6590a04-eaac-4170-9603-42a87338558b', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 1825.00, 82.96, 82.96, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/JeODHXbKf7AgAwzz7aXfFQ/uCTc6KUMfs-XKuCj_4DySxZf5nzypIw6bLqpCxp0gH4yZn96E6yv4dcQJBm9CZpSHFDTXb103Loeh9S0DFA7F5VyvG5LAZFyoFZc5xvnLwQj2p5MZ3V1vHAOLC5a8yL63pndHpKe_3rhCbnXM1brsjJj_s-KHvRSLG5QZAU9XDc/0vkxYXyopoJOJGkr2jAtJwUjjMfP2drTdKcG7oMgXnQ', 'Pagato', '2024-07-09', 'Affitto sala riunioni', 0.00, 0.00, 0.00, false, NULL),
	('ca2526a4-9fde-4bdd-8f5f-3c9b217f400b', '9D043A6E0001', '2024-07-07', NULL, '271b22f2-d0dc-4195-9b5a-68daad05fb9c', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 414.53, 414.53, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/AxMQ7BweO6lLLUcdeNqURg/caHXgRmgNVKWQwfDV22qaYAThcLnR2755WsGaDIekO6gHJzd8I_KumcEgi6CHaM0seup5QjvICPoMeNoX2n0sH8c-B8-L5LamFnAmtu-F_w28viGxNjsjXGTlayw4Q64O7wysXIyCP9z4vEpzdU7pMD48OOb_6l1vSPf_0EsOdU/_4v4wRHKFey1lY9Oai117ayclxdz7ODFcbLnBZ-fvbQ', 'Pagato', '2024-07-10', 'Acquisto TaskMagic', 0.00, 0.00, 0.00, false, NULL),
	('892494f1-84af-4ade-978a-20ddf1d882e3', '24- 121', '2024-07-14', NULL, 'd5acd9e9-37e8-4d5e-9594-0d354db80781', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 1272.79, 1104.79, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/sRXTsqTrtO0irag_QBbKZg/O2GRc8wh4g7yEv4vZuCm0BwiBznpGCq7xslnhxiHqa8_7Sq6BOcvYVYNOx8GpLROZENjZlXe0f4jKmpofMRiiDmbXFROTDzkcTLI2ekD2QzXzG8moclFmE7IHdlV26WpjoBCqUfcxOZjfN4Y1Y2uSGTIVGPP9WkefBIsKr7sk_X4GWS6MB3hSZfU_T_DPknq/NG5WClDrTzBDb_kLmGU5GW_DEsGvgZZRz6UJI9NoFjY', 'Pagato', '2024-07-18', 'Parcella costituzione società e pratiche iniziali', 0.00, 0.00, 0.00, false, NULL),
	('874e6598-3666-4df7-ac08-e23915d545eb', '24-59', '2024-07-17', NULL, 'a7faf0c5-b524-45e5-ab29-90f4c069d2ee', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 3470.48, 3470.48, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/JWMguKFKhoXDCRN212Qy4A/r61qf_PaDkJXnwca5-GO8WIW8QkjrdRFgYj70UDeIN8Ki_PRu5TE4I8un4zwheUNWLsVDkn2fSE2BklwvLZzkaqbc73QPZnkjPVr8PtYHILRbYmap7RA5gpD9MFOVRsV1RLvt1yK-D0KGvNFoR9vYmbprFu26a0gLFdOJM7WMtXasmYX2FcUwFIjdmBLMUJs/rnMrqlRu1J9l9rnARgsfDCQWXiHd6lGywwsq28cmZzo', 'Pagato', '2024-07-18', 'Consulenza Avvocato per stipula contratti e documenti', 0.00, 0.00, 0.00, false, NULL),
	('b1a4dad3-ce6c-40d1-baf0-25afe1655d77', '1000243004922171', '2024-07-09', NULL, 'ab52e98e-2eb5-4c15-9ac4-5b1436b3ee93', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 550.00, 25.00, 30.50, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/xnAgjPBV_UuZjUOBWYSuSw/3RMTVVtrTgixuB3HjlPotrgHeWUlHMqmjGICD9CLGhvudUTqhXrzbXWwNRDEwKYgBjmuPue_rYvrD_O6dmT5qinHxYH5r6rk24Rw8YmjmRAyVPaVSwq6tpriELzwvFcZIhD8f-FTUZ79yv_kumgGl75n8y55DRKgBAZNKwyoUfI/4KRjpwukh3_RThLoSqL7_iGS9QRjdA7gqQi3nGtFAU4', 'Pagato', '2024-07-15', 'Abbonamento annuale Fatturazione Elettronica', 0.00, 0.00, 0.00, false, NULL),
	('955521c7-423a-4485-8bd7-cf5a772bfca1', '9246439417823840-1', '2024-07-18', NULL, '2a8fc5e2-a301-4b21-ab93-3f376ad35485', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 162.00, 7.37, 8.99, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/1qts3kdEodNlpaG50SBL8w/wULb5NjDF8CS8uhVI0ClvCDW7fMoNPi6UUjGebNRJjrLqeVWYa1KpUm49g-zT9n6B_s6YizjTd7O-SJoaG5t1cr6dX5QzlUDxpM2iybLXyg9nvdZZ-esX_8XLTzBe9qtKNUAYF3b7ne7aWbj0Ik0mRMmTzFgDrdd82jDpLgmYEY/yBTuVOyaQtVPkr521h8kAxh4aca-haYn6xoMgjyR8DE', 'Pagato', '2024-07-23', 'Abbonamento mensile Google workspace', 0.00, 0.00, 0.00, false, NULL),
	('f52b3166-3bf6-4e92-a265-fdb8d4d9b719', 'YK99Y5S8XTQ7', '2024-08-07', NULL, 'a55f480d-11d0-4b81-b7ab-a0555af3d4d2', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 648.00, 648.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/9JAXbQi9lRWkYLMKVZ7Z0Q/hIW02qgCLq7VjBlyARggppLVaJplZEE_q04F4k64Ol0KRczWNMlIgn440TPQltx3PHtQKaQYmVoHx-UiUX1NCaGTFWPE7ecCycCni8ql9CTSvJoTGnWIuzs91oLdEJpR8ysDdZgpaK4CWSbDaPiNmrMpgniYWs0-Vffjh2-93ZbTyEP7cub2PJcPuffgG5RQ/rvG--PHptBIHuUQkzRMPffEKhoNgjzxZooOJgcrjwAA', 'Pagato', '2024-08-12', 'Abbonamento annuale Dropbox', 0.00, 0.00, 0.00, false, NULL),
	('6d223d16-8361-4a91-a247-b5ca67778897', '4332-2024-677INV', '2024-08-09', NULL, 'b6590a04-eaac-4170-9603-42a87338558b', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 913.00, 41.48, 41.48, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/jLfvBY0Mynuq6oZrqxrWNw/loyOsmN-SPIn_sLoZmc7PgQJSoE76_3zBM5GD3NolPeDs5c7RXQx1tI4KZuRiON8qzgfPH0dwObna6J7bwUhUxKlg9-u-dzw-pu0IDJNpF6mwswM7Kjk348dtrDgEBJE3NHVSeQIAdLLniwtJuAnM4_deNHhGoaJ2WAQWOTSxec/XY7UHlz8jO4XxvsPxlfriErUAjMmbcO0Nz7a3KoURcA', 'Pagato', '2024-08-13', 'Affitto sala riunioni', 0.00, 0.00, 0.00, false, NULL),
	('454ac48d-13bb-40fb-9706-15cebe33c8f3', '4332-2024-675INV', '2024-08-05', NULL, 'b6590a04-eaac-4170-9603-42a87338558b', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 684.00, 31.11, 31.11, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/f8B_FneOI6j0ytl5Hz7_3A/oFCj04e4zkn9EGkP8r69GSZQ7FBOdFn0nZkD305q-4qIXHBi3Tjln8SbNqOjJ9nvw1x1japbrOpzXCi-dKU98V4Xpz1NxoB8lQBcHmzxfNiTLEDxTNcbclusoxfaYsIOuvRqNtjk16LIGwBeOSDYB_FD3IqN8U5jTTaqbMq7lI8/LmKcOINgWnbVIy7g6Zn3yHTUd9cAnAJIZk2DXzL-D08', 'Pagato', '2024-08-08', 'Affito sala riunioni', 0.00, 0.00, 0.00, false, NULL),
	('6aa79565-6e1c-4b91-9da7-f220d9a17ce6', '9246439417823840-2', '2024-08-18', NULL, '2a8fc5e2-a301-4b21-ab93-3f376ad35485', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 198.00, 8.99, 8.99, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/IHZwb9blGfHo20nZLctq_A/WWmexCo6bFiGri4hrNrD0MsfdF1qTK4fMWzSKiX6CTpR1JIOvXMPdLyK13hHSQ8F17dUdxWs9pZDC5ezlf4kfsIHpScVvFPDVIaaO3Jw1_hMw7YYHpG3OtmfK00V1co3beJtoyKbdK1nNAEq2FqAr9GHuzD1gBqczLCuF3rNmXg/pw7pN0F7ITRQ-JYLXcckWU05NRpCx4Uy_h7WGN_tlk4', 'Pagato', '2024-08-21', 'Abbonamento mensile Google workspace', 0.00, 0.00, 0.00, false, NULL),
	('a0d2bf83-b04c-41fd-bb1e-c7eadf396bcd', '24-34', '2024-09-03', NULL, NULL, '217e746a-f823-4c64-bc9d-3cd026112b8b', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0001,24-0009', 0.00, 2440.00, 2440.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/ia8ZyNonfX6CLqSrDVKDmw/x8ZPXD-DvyDtUopkyhFLEOEk6aXepDpDcYI0ytfs8WdAyG020Ut3E8PP15aYGfaYmgn_Omt7cGQaN2CI8_XRmx2sE9WhrY8ND0GybV4FMjIEtpKMBeg8lYHz0NlDid2jQi1CVLw_c2FlICpLrkRdnKM0bxfwjbRsyPjYOLHgUrM/X_2C1Mne3hUEuHRvt2oQ5iL4Uzr3J807U8qJl12YuNY', 'Pagato', '2024-09-05', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('4d9d5c79-96e4-481e-b323-40392936c78c', '24-14', '2024-09-23', NULL, NULL, '3266c159-9a87-44bd-a190-21a4d5d474fa', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0010,24-0011,24-0018', 0.00, 722.00, 750.88, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/zZO3iFQUxB7-JX3xXO_Dtw/WUzu5KytJVmqBcL9lbo5TKeiz163yd6JeJ21X3pUIclKCooI_TyLn9CxH7koSymP8UnJ7cjcw9xJSV3jlHBmXiynzLhTgdRkF_TIhRnAjZnxKMGDoT7MpY3ySZ__kux0JIr1sr9IszuIqSKZAdaQ4kEWFqiLI3z31Lfh5FURuB62jHGLceYGcx8IfaL5_DBC6WDHBnrRB4Ffi7lriep3SQ/MSa-mQ83GUTgFVThZkPi0tM5Am0hyJoouC5JHm1vicM', 'Pagato', '2024-10-07', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('22bc98f0-953d-46b6-b7f7-9a3df6f78fcb', '24-12', '2024-09-25', NULL, NULL, '36a0e60e-e5d5-403d-a7a6-07fe4429ab73', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0016,24-0011', 0.00, 255.00, 255.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/c1GaCh1T9h-6wmXfr2dxTA/nMTmkUfz2XIDj6laqjy9-RXQg7UG9bHvvhYWTHP_xRWW1N4orbPAzk1sQweqIwWQNWMZnisetctJAlastU691hU8pm68kOmYLkRcWkdGSaVs_GEKcTh_AmkR81m83BAwclvrswgJj42MI3cR_N2Hs1aIs9Jyy7EahmKS2G9d4HOl3h9S5qSmFfK4dQKvmoZf/C77xzbGTmhqN1mMv7I8ZAocEvD-DNObyGGObYm9lsU4', 'Pagato', '2024-10-07', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('79251f7b-50fa-4bb8-9f9b-42db4993b57d', '4332-2024-753INV', '2024-09-12', NULL, 'b6590a04-eaac-4170-9603-42a87338558b', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 748.00, 34.00, 41.48, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/GQEVO4PPxln1G7cJ2G43SQ/44F-1RmGVSdx2uZn2Dq-IUXR1JSPxGKi6LzKwOIJO-Az0HCIyIOYrkiq5DcgxTvEa9DRRuVCyLQHJHzxAul4OIqsm_wEicYXmfA26WUy7bwt8qukJTTbHaNfP2_gbZmqIlDtVwW_sj-hGgHQZxiQGsEnwCNgMzWnfLL82sEGECkzHzXYdPllJ78Z1vmBg4PL/E0-Y5xrow2UvDtqE5TprerPJefJ6mq7jwFXHs9p3iDU', 'Pagato', '2024-09-12', 'Affitto Sala riunioni', 0.00, 0.00, 0.00, false, NULL),
	('04653623-cc41-42dd-b9e5-185d0c764ed2', '14/24', '2024-11-10', NULL, NULL, '92419a73-8ad5-42ab-a08f-9db0e345cfcf', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0030', 0.00, 200.00, 200.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/6mZm0RTMgvpFtKvpv10BnA/Z1Vf-GPkLaRJ8FrQ9G_hnaccMU4fOF1rzABWZ9Gf60ffqu6mU3ekY7Ilc2f1a48ljFixxvwR8mZxngu6Ns_mqpYYXPxEE69cJnIJUKz0sItP6tQqD5I7pbgT4S8TdLW-Vsmn9a9yLAJCpNmUaTKQp0tUgPXnq28q8OpeZQrJ0Mo/TUbuCzGhcneJDzpqNgmWReVSLsxNNzGl_54QaxU8_zs', 'Pagato', '2024-11-12', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('05e8c47c-e793-4106-ae3c-2a13b840c5ca', '26/24', '2024-08-30', NULL, 'd5acd9e9-37e8-4d5e-9594-0d354db80781', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 686.40, 686.40, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/Z2X3-JD1iotTxCMORpRc4g/xtJVtGwfsox9nsm_wXPwBUH0NmiGDTEdOGu1NiWQ4g04UXadXS5sLb7aPsBQXuFajLdfMzH8rWqIx8t1RlBan1FLQseSWJk2Pygzr-gXaKbDRlGZHlXUdSlRgt3tdXiXTaaM45Rgc2C9JRbVPfUD0jesMBEmLk2E0lqv9DpGsZ4/aKrhlsiuukCtt_Q-YQfgZxDyxeICdATXwRAFSyYeJJY', 'Pagato', '2024-11-12', 'Parcella contabilità secondo trimestre', 0.00, 0.00, 0.00, false, NULL),
	('da879459-bf6d-4488-87d6-0a043f5405bb', '4/24', '2024-11-12', NULL, NULL, '34a4e93d-a6fd-4944-8600-305681f881b7', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0008', 0.00, 1440.01, 1440.01, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/j4035GuLbf2PltCgyx-zdw/G0klVuPhhgdJHor1nmw7CHnsWz00E_H9UnryDfjG-FipY3hk6bruKFCdhXhl7kjXMlgWWFDNLqTBAzQWl6Ennr8BrHuRY8TYqJsxxFSlo-HF7QpB7KSLdGBM-ypVpknToX9kNo62C4QodiXxi_2FX8XHlzYFyiy0TwWj0knuFCU/LRnjVlSe6ROZfxfr0iAAElWsc9bz_WROE2mhvR7bkhg', 'Pagato', '2024-12-02', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('17c0dd06-ae29-4bc6-a4a4-2fb03cf42ac8', '24-1', '2024-11-24', NULL, NULL, NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0020', 0.00, 550.00, 550.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/kpFT_0rSeYwAMd9Qk9GMwQ/iCT0pURWjySqE7bBvUMqkbZaiWOW6iO1x9Ijn8K1DMox1DAYOqIjyFX41OI4Ro54RDpOV5-0lkj5xHllJu3CJF3anAuZ7BWZGeknq2icPB4dKEu02JWHOsrTVq-9HKg8kSZYWH-3O6oCse3m4LHoZZTz2nMpHAvrtJhB3-ZBsgU/R5AvgSeQHxbspLrwN5vo_0eOwY9_dpMM10bCYsdt_5Q', 'Pagato', '2024-11-27', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('d6555ee0-415f-447b-a112-508a642c234f', '24-2', '2024-11-22', NULL, NULL, 'a69ce95d-7e86-4c74-a715-20f302342958', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0008', 0.00, 450.00, 470.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/1Z0ScPaUNEPCAfDRuC7E4Q/cMi8nMDchaU3De-kTxl59Lw3g_Ok3CLpfPal67hdaV-Lh27_jC-d4LwECU5YtMy5W5QV1aTjqqeLZdTW-x41cFwS_xFOBKMKyTYCBOiv-eG70DbBB860tLl73K-LrYIvVM9O8DiCG_ZNAJPorKogpvu-xWjoD2b_EnlmEybGrEfDTZNmHto6w_O9QD6j0yvv/0MOiaawH-1nj9p9KweIdzIt9sd3-SpOhO-edneUgdb8', 'Pagato', '2024-12-10', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('a20413d4-5324-43c8-8e26-c4fa257b0fa6', '24-3', '2024-12-16', NULL, NULL, 'a69ce95d-7e86-4c74-a715-20f302342958', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0020', 0.00, 1150.00, 1196.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/aknKdrNxYEKTNYno9jfkWg/dDq7bcBtaSxrWe2one3z7YZJ9Ud-aHQSGi1qX5sGc5OJxuSwofToMTN2egKDMmwbMuh8N5ZzfdFpxyngNGRDw-WpPSF7DxFo281XQNf9EcCeTarXTtLO0CdEcwpWOs4Sj3VY_RoDAeu2rgWXONdXqxDHo6K9qLPU-DADhCOf3FI/ZwHjqNFQDFik6O-ZBUtwBmGhR5ojLjkDFx3W8H2bnNA', 'Pagato', '2024-12-23', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('519ca68f-976f-441f-b822-62207333c40e', '24-1', '2024-12-16', NULL, NULL, 'cc86b9a6-2b2a-49e8-ad16-b3189ecd7b4e', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0016', 0.00, 160.00, 128.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/T_w-FTI9GenesJCJpkLeyA/sFuEGWw_xPmSpCt67UI_CZV3FkgnkbNocUGnh12WhvnLMZ_lc9UJXqDB_ITCiZGbt2bD-__4TdugivP8nIH7xWlLLHwOebGSeNZzznsGvIi0VIS5u5lgymm1u8jlGS2B9avWDRtG_uMxxZyck1DlzbzQr7F4juuMsYtAoKgxL9-FHSHTf-_z3SW7FpcG75h0/jvc37JuOnJkpenFZtgFadK_r8jJBkLPKvgudnA6iGL8', 'Pagato', '2024-12-23', 'Ritenuta d''acconto', 0.00, 0.00, 0.00, false, NULL),
	('23d390e6-6d9b-4423-9e4e-355e13e2ddc8', '24-26', '2024-12-17', NULL, NULL, '36a0e60e-e5d5-403d-a7a6-07fe4429ab73', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0020', 0.00, 150.00, 150.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/c8dTl2BRvvC-TyKyXrZMPg/FsM25QC71oA2LIgCYN6fKcYy16v7v-QwAxJArDxFKr4OFjSEjz1Vv00xOsTTjj5Ich11YP82uIeEUBRTRpqNnBxwfnHNNH7pxS6qWlKtksoRPxb0d8-_5c87iPfe2dtnbE3Z6i7iSwnzBlMGD3GfR9Z1tHPKwuSR9wYTzlmOGYAMk1tF_Iq0UisyCmRyFPHD/oCNmT_Q_RmVRAd1HfB0tjMw01iGscWxGWpjVrLsCY4s', 'Pagato', '2024-12-23', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('78312a8b-3bfa-4ab4-a5e1-fa767d920317', '53C48C670002', '2024-11-28', NULL, 'cf5b2e1a-b298-4b97-8b42-bf2d2d0a06fa', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 1464.25, 1464.25, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/Q30cA8rldQ67qYtVNbRqoA/OzWrUgr749aP_QR-ybp3T4aWv_x5kn8E_NdSmwK-RJ7__epDVBeU4aKjduQVAqyoVyCy4oOD5Ydx8SA7KSj0FRXzp2okzTM952R3_1awcXZioHO_OIWSxHBQrZZ32l-nlkJkzDrVu6mlkfW8s7xQZK4bnYI9TStW7ylpe-OhzGY-CjOzpNIP_7qQpmx8cgSr/4zW0d_3N_VVuY5_9QLSfGguv9o_p0P6_pffry0z-BzE', 'Pagato', '2024-12-03', 'Acquisto annuale softr', 0.00, 0.00, 0.00, false, NULL),
	('9f286161-35ee-4120-a03f-e32c7b145739', 'in_1QevwLCcKlYJxALVEPddwIcX', '2025-01-08', NULL, 'ade4aa40-dbd2-46c6-9eb1-67374007ab19', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 5.75, 5.75, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/Y68Zdi3CMXiMq1EazWnrLw/SiXazgMtlhSGyGh3KuN1zSW3FaOFyY-VNRxDyt_7Nv0DA212GpkUvrNeHKDMJUvE_Zom0GRqoDReeoQHBy-eV88EcQuO7xUHkyrlc2wxEzF-m23n8qR99BbtIztPmi7Tg69KFwUy2RUqhDf3_P5-SzbftycgCXkmMBqCg07Iy8ewz7h4t6EGFBlpucahBzzY/88cnsda0xzYsuzZgmrnvqL90pcetCHSxZoign5kNS0E', 'Pagato', '2025-01-13', 'Abbonamento Mensile Notion', 0.00, 0.00, 0.00, false, NULL),
	('642b3603-3f35-4e31-b282-227d99d37347', '2025A-2957', '2025-01-14', NULL, '17d96543-33b7-441c-ae37-58f6a09fa26f', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 174.00, 7.90, 9.64, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/M8sLvxhTinTOD5olBkzl0g/ESwPcXmI4MTRo376lmL6sNvRlAItVQ8Bs2ACgP9igjn1kdYln4iBXJNaMQ6R0eN4txSB2eIhyl6CFk_yQcSxxRfftPZ7BmjRB2I_1pujj6eKCo2rUaCZjl1U7ceP-8c56_xmG_DlkiT_J57fhQ0Hcv2LrkyIFdkUM8RGElQQF7c/CjNQ_b4JJXV6r4huGCOAljR-l-JAjWsaO8GTJv38f8U', 'Pagato', '2025-01-14', 'Rinnovo Dominio - gleeye.eu', 0.00, 0.00, 0.00, false, NULL),
	('3c9d0347-0dda-4a3f-9b82-38fdf3047307', '2025A-2941', '2025-01-14', NULL, '17d96543-33b7-441c-ae37-58f6a09fa26f', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 220.00, 10.00, 12.20, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/E1hn5huofXyxZ8NSRbFqaA/oKjNb7mUj60bguzGtZQvITQXBiuIrrfolEb9Qgfs_4gRbRwIgCpMUMI032xjScGrGIJCOILULAG1DImoXtRJEQpwjqVzFq4m3GuBSNB6WNgbGq7d_vupJkDBkVT0AEh2ZXwluyxx3aGzMdrVVpFSjNtRvU8bTMkMqZV7f9IB_AA/nRHsXHz0aA4fcRGhwRULp9MTezTY82zshcPJZny2Krs', 'Pagato', '2025-01-14', 'Spostamento servizi su nuovo account gleeye srl', 0.00, 0.00, 0.00, false, NULL),
	('0938913f-e819-4635-8e6f-cf83079ec150', '2025A-2955', '2025-01-14', NULL, '17d96543-33b7-441c-ae37-58f6a09fa26f', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 1912.00, 86.90, 106.02, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/1HuHm6VQeat6Lcb5NraY6w/MgIpCbAhxOec9aNWJHJVDEHy9LoKD8zAw9HVWFBT_Dgaw0NTt8-c7bfi3uY5w8BUGHsdTgNf-Qqji-18NTc2qZcybvbLxQQDIQte3aLXpxKmTHhU-T5CWdKce1aDHn3CDN2e_BYR4RbhdO-qRRbdyTh0suLM0k-Lvc5l7BhBYa4/OB2u6QFZoIB_QbW_PBCmLWJA86NBZDREoTTgnbhuP7s', 'Pagato', '2025-01-14', 'Rinnovo spazio hosting gleeye.eu', 0.00, 0.00, 0.00, false, NULL),
	('29f48ade-be2e-4a9b-806d-ef4ef265cfa0', '2-25', '2025-01-16', NULL, NULL, 'db6d9031-51a1-4afb-a108-d62f3a9574ae', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0003,24-0009,24-0011', 0.00, 1332.00, 1332.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/BZCWT7piLHIAC7iZ6K5pDQ/m1ffm9e-kQP05cOIL-tJ8kRd0altH7HO8AG0Nwyhc63cLo1Pckrq5-mSIuH7DhVb7HTfT727Pgo-vc_IvHQQDOiztcuTloxXe7ojq2bWlr9e9RlbYcLdN9msK3r2LCVfHoJmMjC--95rqDzxrrc0wVx6zwUI-DtUlnZBOSTayjIFQmXIbm16NwJHRTWskM-O/OsD2kJAwb6Id5le-jiY-3Wo9tVpZFHRoq21MAUORZcw', 'Pagato', '2025-03-11', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('fef958ac-e48f-46f4-a400-c421c366f368', '25-22', '2025-02-06', NULL, 'c775169d-7910-434d-9cf1-dd62f00e8984', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 8800.00, 400.00, 488.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/en3WQZMnjCy9T4sAjWtRPA/MZ2wwxadnGvcavIuknws4JOsbBeuPDcrc5aaagbhqR1uDxZRwSUJ-JRudJxDNKwY7u-anOR95RYn-b-Qst3-OQjvDs870Zq0mRApFLpzOwdBOYB3QGDOu1ydesXtGh3PIfMDaDIIZ1PaValcVQbQoheBG-3-aI449xeioOkp-gME38Sf0fxgxqtF-AoITRD2/cHyXwhXD-YR7YKV1epeK95CcdTYxvMj9ON6XW3ah9Fg', 'Pagato', '2025-02-17', 'Affitto', 0.00, 0.00, 0.00, false, NULL),
	('1a0c7479-c388-4ee5-9267-a862e15d297f', '44/24', '2024-12-20', NULL, 'd5acd9e9-37e8-4d5e-9594-0d354db80781', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 686.40, 686.40, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/mCxfDa6_fY2o3Qe70dlFVg/DY8BXapG11O-oMD-D3lyHj_fdJrrAl1UiF0ww-EdYB3If-y-S31eDpK85q29ZmLa_ovrorROmZeHcqhioI30Nl990TczuuKu5tPCNNFpXX8g_ZbSJidskr90XyR-fU8YFcYOSe1fTpTCBJcXQeSw7jaR15SQ2APF3bzhN8Is6RA/g3BJQuRBKwUZhofR4sqPgHg2YgYlaxjkD52vP-pmM74', 'Pagato', '2025-03-11', 'Tenuta contabilità e chiusura iva terzo trimestre 2024', 0.00, 0.00, 0.00, false, NULL),
	('aed9734e-71b2-433e-81e3-e6457cc93eab', 'in_1QqAj7CcKlYJxALVkmEfxgVf', '2025-02-08', NULL, 'ade4aa40-dbd2-46c6-9eb1-67374007ab19', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 5.75, 5.75, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/IZVLksRuWZy_x9M8AMrh9w/R1Vq3-9H5KR5E4M0C3Tms6HMYzj1Dm00cVAFb2q6qC4eyhUjSqSiaAHgDtrdKzV4nOHWcD_IDsXbYSkbwXmq7hWstnXuY5USmpmy3lKBy-47JbYbCayLH9jwCDZRZBBMHhojLP2BQUJb2OQhWPT6i3rX5zYKfI8ULtlwvwoF7ai-L8fZiPYWt75-Jxk4Dt-Z/w2W7p8wD4SojlxR2pu-l7PcDTxTgrdkOQaA73oVlMPY', 'Pagato', '2025-02-11', 'Abbonamento mensile', 0.00, 0.00, 0.00, false, NULL),
	('42e8b76e-78c3-48d4-9465-5a301d2d3135', '24-12', '2025-04-01', NULL, NULL, '217e746a-f823-4c64-bc9d-3cd026112b8b', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0001,24-0004', 0.00, 1920.00, 1920.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/hrs0QmXmuFM5QHgHz4TO4g/7geCjKs0XVpH7wzFR37VNhAUZjhK-sKO1fv3kBjOoDNE_5VrXfiJNcHhON5DliLcakfhtYidgnGFLiNm5i_TTOH_dK2PhN6_LAFiG99lRj-A1DlO6027NsFS6L_qJTM9r21L9bkYzB0P_IYUwp66WRQsf-JyUV7No0O84oth3bU/e5I1HRp5bG_oddu1gNkD7IiBoLE7CRFNGH1RFcZaAYM', 'Pagato', '2025-04-08', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('ed03995c-93b8-41f3-bd43-8404a213d857', '25-1', '2025-03-31', NULL, NULL, 'b85acc72-bf2d-454a-b7c0-78ea8935d6bb', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0036', 0.00, 200.00, 200.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/Gw1LVbSLVjcOCfgt_2c6mw/hgmI-myUkg1xqy0PYEOBLOezM3-sg4g5O-2UO84hn4y4InTrrfUe4CaQns8PqugqHQ8lFf7RizL9ZdMveFz2nJS4gqqXrdLsOdxg2w5NjrjnctAbQ0TUEi8tkEWeJNoQOKXmwrMErl6xCSd0Jak0MznhOX4xvSWzDTciUgbJPx8zELMDabJW6q0NQCFp7JQloWTums7owdpycYaa8wqOew/f1grvUKA-bteiFoPywIUxXVWaVqjNTgMtDwtqMW88hw', 'Pagato', '2025-04-08', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('0af60026-3e87-432f-8622-c301d4a788aa', '25-41', '2025-03-24', NULL, 'c775169d-7910-434d-9cf1-dd62f00e8984', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 8800.00, 400.00, 488.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/lPQ8tVCJbZw1H3b5oJuwhQ/1DIiTrcimxlLL9w7sQi0A2uWc3b8SVTsYECIsnCIs81ysxf8WhD1xzbBtXI17edF-UuaUTQYI_53WiTv1pafkwLh_u_kC0SMHSslCRXeWtd4uVnu7TSVR72wlV9wcgMlgpKdn9JXcBj_j9rsLJdsPV9Opoh-eA1iJjf1Nl69JRXvT44yYD_VLUhs5lJev0JV/Se5TcBtLuxONm8Czpn4NtiQQd-lLrr_rM-x6iBnK6Sk', 'Pagato', '2025-04-08', 'Affitto', 0.00, 0.00, 0.00, false, NULL),
	('c2f1d5dd-1d5b-4191-a18f-71fda3ad388f', '25-17', '2025-03-22', NULL, 'd5acd9e9-37e8-4d5e-9594-0d354db80781', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 660.00, 686.40, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/D4HTB3-NqVJAcZxOJstcEQ/cpm1bjQwkcXyzxwZ-eCxKge6xVOBlHHTIvrPkIVlr3UfSaIDWWXCCBPuewzPuztGzvRyEESSnC2cNk5FxTqQY7Aqh2hf5wEVpb562GXNpUoPa1KHmxy-BhyRSuIJXppsQhKjo7z6IlROcHNj3e2Wm2blwxyiaN_cLCWsyi7aN8w/eKmKNoRy7F6VzyJzj5Y_aKfg7hbWxnCC10MZ_94bDmQ', 'Pagato', '2025-04-08', 'Tenuta contabilità e chiusura iva quarto trimestre 2024', 0.00, 0.00, 0.00, false, NULL),
	('8fb69ef1-e65f-4fde-ba7c-2eacc2ba5f01', '25-2', '2025-03-06', NULL, 'ee3a81ba-7170-4397-9f79-9be2882596de', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 600.00, 602.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/ExGzTAllPt95L5nl0ipodQ/K4LCqy8d2XAlLVZJOiQwO_o9L_SJFMdTdp_4TlhUCUDUnxp-ExPx7b9MVV0wuZoGFwOFKs4cPlB_PYkIQ6pBfnwtiJS4vX5V5L_lb4DnYdHDYm9ml_E5zoFv84KVKctNLsKjqEwkMq-5Yzq4ebpUytyYVtBITk27dYaJ-PZd_5A/IsRaU6PLKRWmuDa2js_xnRrcScqwEO56zTOmHWDL8-w', 'Pagato', '2025-04-08', 'Riprese e montaggi video', 0.00, 0.00, 0.00, false, NULL),
	('f842694a-adef-4d76-87ab-fedad24d47d2', 'in_1R0K3qCcKlYJxALVJKLrjPOH', '2025-03-08', NULL, 'ade4aa40-dbd2-46c6-9eb1-67374007ab19', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 5.75, 5.75, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/Tq8j7im3ob1QXN0a8RS38Q/FBrFRhS8j8AkKgYcWdOA8uCvMjbn_V1oARJwcSmARChzJeOea13lwIJs242m5UX9F6j87h8eEac-DfcnpuRxOR57P-bVZjkZLvjTbD5TUe6Y8s1qTbpuM9A_OfMJmy4EtwEFwruOb0B3rO6qAjusCGRwBzJBh-PCuv5MlmTwob7GsMTTi8EvQFSp5H9ivmCg/em5_VE0HwdnRvokDqPaKuuOBSCsThHsOUhk0_reCKkc', 'Pagato', '2025-03-11', 'Abbonamento Mensile Notion', 0.00, 0.00, 0.00, false, NULL),
	('6eaed061-8fdf-4723-b4dc-c947c27ebbe8', '2A62818B0002', '2025-04-16', NULL, 'c6694df0-d20e-47e3-afe3-f482867b7055', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 434.00, 241.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/vgueHoGpAcde5iHppjmOcQ/x9sja6d-W07brm6CQv6u-29IoD5gZDVOYBemWItbCHRPJGtD3gq3g2POsSlSSJIu4ZBcCtEAhFXP0syi12Hoif8T5CSpbeowaKcX7m_k8qDw4s6oADEFWcRjJ68Bus-icQrvUsD6FQDhTnQpjoa__yqOOVpRCdOkGQL5gJg37xOBrlqVQZYn7n1VcNEnFfxw/kMyZIP583bKyPg2J7Dla0BB6nszu_5vvZnxiNc14ZSw', 'Pagato', '2025-04-22', 'Abbonamento annuale', 0.00, 0.00, 0.00, false, NULL),
	('24d9d52c-e742-4da1-a3b2-12b5425d72bf', 'in_1RBYq5CcKlYJxALV6gq1j6xE', '2025-04-08', NULL, 'ade4aa40-dbd2-46c6-9eb1-67374007ab19', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 11.50, 11.50, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/Wkb0ILji0iI6FZ8dXvaKVg/p8MmMKM2Dey1x02vq18-yxrAx7MQHofO0-woX6WStWpR236K2tQxG3QcGqZbjG7PNomVZvjlWrRyub1pG1_GfyfOg9Mq5aB6YaILJj6VM88cbIdIsCwEjbVb6u2sgpKJB2ppfi0z5JKcLrATGaopiHOTe29GA04M1PefuGicSqMEWqXXNZV4fKGHxiqX8USV/lc5r_iujWCLY-Cjx_THWTfJ8FwSZoN5TZh7kcLRTDsk', 'Pagato', '2025-04-11', 'Abbonamento Mensile Notion', 0.00, 0.00, 0.00, false, NULL),
	('d67b2afb-2050-49e3-b093-33efec35499f', '270DF76E0002', '2025-04-16', NULL, '7b0f182a-fca3-41d4-a903-ea98bc2196ae', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 97.65, 97.65, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/livg7z91x-by1FPcmhN-NA/9AztquAhCoV1zj0AvOGMhG4DEIqFhYojjPLCFvdWc7WiGDUMMngKVYgz1_YzyLQwWCl1bgYv5HuMg2KajrL30iZpIZKra_bjLUkBj7_iGu_9WCU1sxfA1gaOH5HCl9plIsAZGwqXftA__WK7mZMzDmCqcH-tGctC_C8bqFj-dds/U8Nbxf7ChxPK4qmTrh1qguSm4ll9uUCJKnTz-XwwfT4', 'Pagato', '2025-04-22', 'Abbonamento annuale Make.com', 0.00, 0.00, 0.00, false, NULL),
	('39703648-4b14-44a7-98c0-0f372201195d', '25-1', '2025-03-27', NULL, NULL, '34a4e93d-a6fd-4944-8600-305681f881b7', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0008', 0.00, 1382.70, 1440.01, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/K0y7taUM8VGIg71N0GS5KQ/yJjJyZa_HDrhioS4viB8Ak62JWbDiiOhkuT42zOySeEDkhhXi-t9iGyc-5Zh8v9n389OxCCyP0RPDA99CLN_8pt0sMaIBhakkCLQ_0BWXwDx5LFVgRBhDd50Ox39fCuy-lomPYG7lbwFHA0U_b5jVK6PQ4hGHkWJ52bLZOET3Ng/ZFhO6LhcL_buKgzbH0Da-3S6qcGUBDMxJCchcImj7M4', 'Pagato', '2025-05-12', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('27b5cdfa-2a36-4b8f-8b7b-173901c4b35e', '25-1', '2025-04-30', NULL, NULL, 'ffba1af1-2c0c-4d71-86cf-5b0df4e5ece6', '2026-02-01 14:41:30.159501+00', NULL, NULL, '25-0005', 0.00, 125.00, 130.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/aRhOkiCvebTeKGWa-srlBQ/TlIFurOeyLX-hTzU21QRMWaGeTZnuGQEfzNQBmBhNiuuOY13sjZTcFO5ONBk-fpkg4ImX3YmKalx-YUKVRG-V2SXOrL4HAjB4LmW256iHcMal1HMz78lPxzQjOJB80CbjnDnKdW_JawP3AbVlzxuOx4MHZwmPV7FFxROaL0yjL4/kj8CDLTMby7TRbER09mGIcSH7AfMgZV6PmfRIuvgSt8', 'Pagato', '2025-05-12', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('d0217293-e2ab-47aa-a5d2-22d4b06ae0ab', '25-7', '2025-05-27', NULL, NULL, 'cc86b9a6-2b2a-49e8-ad16-b3189ecd7b4e', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0031', 0.00, 200.00, 210.08, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/gP-tHsWzl1TXfPaa5tRoFw/-JsAn-2XVZsWgxMroGFnNvITjbI_SfZFE7NRN4mU-zEiJe6sWzDZzbbijXrKa7iF_iLjrXIhyrMrEKUsfqDGmmKjxg8mDrkpAW4jgGZgexPguLlhWgTYG3Pz4UCl7muDIAcfVYznH4-SDEq1ylU00KkTNXHDcOBNG9vw8ggYUnQJCPFt2lkXIFsNkpo9AGbi/7l0dDBlihM-KbOrfKRKShYmlq65SjuIWJl3_cYZ-1us', 'Pagato', '2025-06-17', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('975db7ae-f278-4813-bf28-1986f42efab8', '25-13', '2025-04-11', NULL, NULL, '36a0e60e-e5d5-403d-a7a6-07fe4429ab73', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0003', 0.00, 105.00, 105.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/khCl9hB-lL86i7BSkimhwg/caiolyOEcFCzFy5bxmtfIzHnXoCkUzue_5LUcEBYLt7ChtKcr9XXnWLATeaG_YYhsahZorUFpeLreAhqT25EHAWEitwNtK-ZI5BroY9MinZ6RXguqVX55ttGHalCQCkVMGY2i5IpDFveXqE5BgNqRKdz0r39VZvm4nUZtguGIyKVd03MwAknHeUh-IisGycL/wjwFAnim79ZEUCkqfXg8XAsGpcLwt01XVfccJuWJddY', 'Pagato', '2025-06-17', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('57f9c13c-04db-4393-ad00-5ec6b05ea677', '25-29', '2025-05-27', NULL, 'd5acd9e9-37e8-4d5e-9594-0d354db80781', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 660.00, 686.40, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/_Yopic-fHcEnc_gXR3m2Eg/epGqQJWzCkE4CxSqKwMQ1wTaYnETlPQ8kpboR_IioIkQrqKzCpV4izt1Xk3BHRuJ4BakzWHXpvEpfG8CpDIlRZxbhxlVpEWIFC4um5ft5Z7upttA-G_kmJp7QZvrvV30J-r0OxsLzKuPj5m3UoT4gCktShd7VbiQTQDTP-7PAp8/SYw31FpsVKncO6yw-2rbIu3rfoJ3Lb0r5sCCmshZDY0', 'Pagato', '2025-06-17', 'Tenuta contabilità e chiusura iva primo trimestre 2025', 0.00, 0.00, 0.00, false, NULL),
	('cc16feb8-7c7b-44e2-8258-763f33dafe18', 'SIB-3060991', '2025-04-28', NULL, '38b6d3b3-d46f-44e0-8887-344ed8d75a77', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0008', 0.00, 164.70, 164.70, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/KbY-wdOCrJeR9fxvQuLVhg/_NQY7TMuMiSjy-vagGp3sI1hNzZu_rcNp4NW9_hPp1xTGQq-9xH_B5mbSC9ZRHr7kqKL7wED4wI1yzxu6FlVmrFDG6Xdfvru38XeB635A3n1K-IWRlMkAE_lgfakFdOMgQqueyZnf4Fgpr2UBdP9A_HHfOHG20jkp7mBVq80ggc/Xk40Vs3w5-_IuZHAKqsgEn8SeRsYMOi2MUS_3R60uBo', 'Pagato', '2025-05-02', 'Abbonamento 12 mesi Brevo per OIGE', 0.00, 0.00, 0.00, false, NULL),
	('3444cfcd-6cc0-4fb7-99d4-63ec4437cf16', '71861137', '2025-05-03', NULL, '3afbff47-8c62-4b6e-a576-cb1c447fbc9d', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 298.83, 298.83, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/vAjz5OdUSfgHdYmyOebKwQ/BlLE4ybwQB0b4k98mMtqdEJIlKHwp5gFJ3WI6VeTleZ0u55ESvfr_H3LVpYlwk-WRQHE2b3Q9Tp8E17Q7smYjfsRemn_wruR46HG9tQuA_2TPdcX19Cm_wxBzKyKfkzBspM04zYJTlB0QtB3XZJB6BjzseniBbF_L9phmsqrllU/-vEoP-eY58qiME4cRU7S1cqW6hIM4RQbGS8GVK6BLLc', 'Pagato', '2025-05-06', 'Acquisto plugin Amelia', 0.00, 0.00, 0.00, false, NULL),
	('b0431da3-4045-4136-b8dd-f7645a27ba5c', 'in_1RMR8vCcKlYJxALVXbNhB1yY', '2025-05-08', NULL, 'ade4aa40-dbd2-46c6-9eb1-67374007ab19', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 11.50, 11.50, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/5Lk1uHzvlq0Ua2aYjY_Mjw/TW0IJ3WV5gFGBxx5cUuuOsNJjbHRKnHwo11XNld6pN5HCZdcXE0A3GUnjFjY0nJg5DI_0_DFk9iB-1pmwuxJpY-Jng-nJQLx1hGim2GWLzkjMJU4FU8izhqPHc7PStRIXYcDpM96yzdEi4WV9xaEXByXjSHIfMolhUBsOUegn1REZIOIlAQ7M1msgMj4lUkY/DusF6USTN57351zlk1LIOE9xiv5RpGkv2hQFiUIOEYs', 'Pagato', '2025-05-13', 'Abbonamento Mensile Notion', 0.00, 0.00, 0.00, false, NULL),
	('81ed0a34-cd6a-41d5-9c0a-27b2820070ea', '25-62', '2025-04-28', NULL, 'c775169d-7910-434d-9cf1-dd62f00e8984', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 8800.00, 400.00, 488.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/-vW79G8iEaGrIWTZqndEMg/-rgwIxJEJgUAqG63FgoNU8Mu-RGQOEHPICWTVYF7Wkox5T9oX1er0VUJCzAp2f1pVVTgIWWr1JdJn1HtVLIZjaExnkrYvhWUYVuiJvSOYaXdlVce9X-Q7lNMSbnCWjEdP8Pz3TcCp8Z3CKUfrSKhZ7WDrdApimPUc4jeXaklPxilKLZqKsf105PHwzBAdcj1/PT-EWdbHNl7f9RLzw4bIoDgcXs_j2AZ2o_cqrckkEwo', 'Pagato', '2025-05-22', 'Affitto', 0.00, 0.00, 0.00, false, NULL),
	('fa93ac2a-3c67-4c1a-9453-ba58772baa8b', '25-9', '2025-06-13', NULL, NULL, '3266c159-9a87-44bd-a190-21a4d5d474fa', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0031', 0.00, 532.00, 553.28, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/yExvjErbzdF3L5CzIDZNYg/VsiSxh91lYSy-K6P50RJWMAVc0gyx50mInVRb-ZvgDGUzpg-4jZGRw8T4sqhMwc_3EKX_7AXGC-9kMTlC7UpjFMawoilaILxojD4T3K_L-L7d_4mQbsXTNfTZsGUQVMOtSBFaC7u1JzIRL7U1SOmpfg46ZmmtrYzwRgSBbAFxe4yI1n0L0VL4nZVECqNizhjlArq3LL0kVg3XGMiVhxV9A/UqaHLNJDtYFlDwCwO6c-3wZXMvIb0DLPtxaZcLmxyKo', 'Pagato', '2025-06-17', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('07f1ad6b-51a1-4822-8bf4-58c8b0c7f543', '77/2025', '2025-06-09', NULL, 'c775169d-7910-434d-9cf1-dd62f00e8984', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 8800.00, 400.00, 488.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/wyBCw8zV9tLdnfn4G-igqw/_mmKj21jufLVm9twI6k1aVaUJWWy_W0G9DvdQ-buzWvs_dLmvoJaIThQfEjgdtcinmQmyJgmmWpyqB-aUDB7qhO6Snc8_kySht-MC-l8JThffKGZPPn1eVf10YrfwzKnT1NtyD8rKud9Hcicd8yYOM6bbkDfOo254sE2mZWs1k0/rThon2MCs88FK-zlv79CJ3jT7JIWByrRRrtc_JZOUnE', 'Pagato', '2025-06-17', 'Affitto', 0.00, 0.00, 0.00, false, NULL),
	('a3c4f544-7341-440f-b88a-f80b44fc5177', 'UA23130226', '2025-06-14', NULL, '8e3bddb8-afdd-4619-b7d2-94769e5e4c82', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 2294.26, 2294.26, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/qz2SIKjiqjvlLiV-u4fEmg/HkAzsdNlLOOT98N1iA3OhGuOi3GVl-qHJLYWJE07Dsh_K_Hgxgy5A0T1pGVudwsOhV_zvDRpmNylsc3qUwx-dmsJjGvOmtXgB2htVtimHEnOa28mclYLgrzTxZkCdHM0D54_Ney6tI9gPv9pYgegld4cmOkk7Ry0uyEMq5QwbsU/SorPEmpBkBeOS0AwAaN83Bj6F1zE8x8c8CX6wnle0o0', 'Pagato', '2025-06-11', 'Acquisto Mac Studio', 0.00, 0.00, 0.00, false, NULL),
	('bcbf541f-de9d-49a9-b209-b196ad968e10', '10-2025', '2025-07-02', NULL, NULL, 'cc86b9a6-2b2a-49e8-ad16-b3189ecd7b4e', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0008', 0.00, 150.00, 158.08, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/vAbK4fggPdijG9fB40Y0Sw/td0Jy5hxUKFs2CFRzw9KtObeOdYKQ9BhZQkGlPGcqRKZnwzR0RsKJdOu3kUlU0gXiZrtMCymjFv0nD-lQtAXi9x-iyFcFxKDyOBm99JOl_KyqqefWAaeWmjBQdoSOfk8uzd2Qutiea6g79tV0FM9ZTdr6vP8CtJTM3zzZtluJE6Oyi1X-2-7przyk1hdbj57/nadzC4dNjOU1U-HW4ZR-69jMZ1Tz2bpH1RmLXKOPIlE', 'Pagato', '2025-07-16', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('e28a08e3-ce45-45f3-a264-a609077daa60', '20251 - 11', '2025-07-02', NULL, NULL, 'cc86b9a6-2b2a-49e8-ad16-b3189ecd7b4e', '2026-02-01 14:41:30.159501+00', NULL, NULL, '25-0008', 0.00, 300.00, 314.08, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/aQ3C3mDiGfSrk4p3KPXrTQ/UsTCA_N-g_kmZun5vbm7P9r6G9EFMP754QNQJbmFckm50-W6j5cDLPk8SKI1Up8Rhf9na7owkvMULSawl5oh-7t-iiiazcuCw3cd2wQoKKfbjB1zKetPQ1CA4lhdBly-x00DwpRlQZnf7YxuWwO25kLlc_xUWOKvjskFKHj_jp3CUfeu4obqiNW7mZUIlO1R/3k2FbNb-hKx2CBj2VxOgTl3u0zssypubMsAE0PHjGro', 'Pagato', '2025-07-16', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('c01f17b9-1733-41e1-b190-99e4582850c6', '25-1', '2025-06-19', NULL, NULL, '0807e144-1150-4f79-8b0a-3f6a26ebf2cc', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0011', 0.00, 150.00, 120.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/oOj7oNqKf1GAplD5zOTXmg/FCPmCRkb52Ty39nB_v_NkV0AVYEQEsVP8glV7zgfgWa4XInkZMdLnVXBLo3JuZc4WBatJgFqhlFpws-BWwEOJqJ9seL4s1b0gVGCOVuQwZT24L1DP0LFfQBRTUmlJwpwNxLhsufcj15KaEsu7-3yLyXwWjICsj0QRQtgv1V9nh5qWnfWC_PK7Kbqi7hGA22g/VmBeVWoVhI3hhC3NMTYLSGpxTVZo3hqePVEw3JhYEOw', 'Pagato', '2025-07-08', 'Ritenuta d''acconto', 0.00, 0.00, 0.00, false, NULL),
	('4ee6e534-b2bb-4e39-8e57-90593ef4ce7d', '25-180625', '2025-06-18', NULL, NULL, '217e746a-f823-4c64-bc9d-3cd026112b8b', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0001,24-0003,24-0042', 0.00, 2800.00, 2800.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/XX5T3UaEmJ1xlg_9RHM92A/7h5Ff4olNTGp85rca-Af53HQB7R07Q2AwlYNVSp0tpUdTuxOeAsUn2YrV8ROxswW7k4QHuluJfycZ-rfO-EteJBzW9cOszNa615u9dxVGD-WmIY1lt87Z9vlhZs8pMU1hRWEOXMBCn9tqUnbGsYqo7J_WGx1U7uwgrRDIdNK13A/B5NlkXDXC1UwudaKhRQBQ6550iDrOKNOvcVUY0SSnRA', 'Pagato', '2025-07-16', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('6ecfe853-d9cc-4aa7-b414-b74a6757d099', 'in_1RXfuSCcKlYJxALVlORrPM85', '2025-06-08', NULL, 'ade4aa40-dbd2-46c6-9eb1-67374007ab19', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 11.50, 11.50, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/iXtcQu9ukBxkR-_2BTcllQ/O77I-omhvOApvcG021BbJlK4ucjoyDrYzADHtWWOkw_C6E2PihvoyyQRReOHQEA2ROr14fSzmpDkr0Htk2wqh7xCvgs_k9ZAEvcAM96QSlZuiPFbg6HnaDO0QZAdhvdSWyR4XvVMos8lUNQ8eQ7BoGVOKfVTn2sDPMXQNBKyw0efc-MHRSv69H5CZ-tog7F7/V69-juAQsIpV-aGZVrVy7M4fOMkOAo1DroHxfohwuGc', 'Pagato', '2025-06-11', 'Abbonamento mensile', 0.00, 0.00, 0.00, false, NULL),
	('e528e805-9a87-41c2-ac09-98639b92deb7', '2025-160829', '2025-06-04', NULL, '18ddf568-516f-437e-93a1-69353c8c0e7e', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 1080.00, 49.08, 58.99, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/cLU-7BljfmKddOIZNq2Hlw/w73I-c92lhwfqxKeulWvpVEjqFHCeE3-ASWq2aFSSAd5b3paTeapiQRBN4ajlI5WY_j1WM7nTDFSVELdArBAozk3NlcYY6nIC227HGAphT6cdkYCWl0TKIqhKJYD6JTNyoZRu4S2sl0dhKyTlAseYTaag1f23WJ756UrWw9_0dnh9IpX8nwIh2etTjYPnLKj/8x7bW-R_Nxc-2afjKcgRd-oagTSCZWOxwRan1lo5JsU', 'Pagato', '2025-06-04', 'Abbonamento annuale', 0.00, 0.00, 0.00, false, NULL),
	('d08d5f09-8da3-45f0-95ab-e012fb08fd03', '73114686', '2025-06-23', NULL, '94fc46a9-d412-4522-8c1e-9b78278b58ab', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 296.33, 296.33, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/gl-pBoQxwdejhUmQgRLczw/C0r8smKc0RX91qhi0eLm0Etv-06jBRCErujzcDCpkXLsUpIg4ajTKOxGoKTDO-pkESGHpxNvsRuVbLiA6HQgxlC0zg-I6ZFfetqXGrsUq14cWxuOE7h0EBqZRavqKP_N6PY0vFPEGYxMcwREIWx9f2a_wTIp0f4CQwls1dp6QNYBYTwVOBt5cRdtK0qUXlIK/QMNDzV8Gt5IwYWe8vTyi3__mXluPDqRa-KSC0MPoUBQ', 'Pagato', '2025-06-26', 'Abbonamento annuale', 0.00, 0.00, 0.00, false, NULL),
	('b899ea43-d5dc-4a27-87b7-c4dda33cb61d', '2025-2', '2025-07-10', NULL, NULL, 'ffba1af1-2c0c-4d71-86cf-5b0df4e5ece6', '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 292.60, 292.60, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/3Y7pyWGfcuty_LwmGk4w7A/cF9W8jGBPPjwjQ5Z7hSL01gdDi-ywURX3w6UdYuPcRbyeIKptW1flZnFkN3imZfMt4MNt3l1vACcA-mGfEoFlz9S5sdfjjjlFedcEGfDHbcATkV5rQJrNzz-uKdzOJxqxC9FqzxkYhol0Ppk1w8H6-6SiwQvZE6nz41_mWKiMnk/PO_jtLejNhoGKbulc5vTUKfkuVD_8NypK8RNfZldUT8', 'Pagato', '2025-07-16', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('8f582602-10ca-4c7b-944b-eb25708bf5b8', '25-10', '2025-07-11', NULL, NULL, '3266c159-9a87-44bd-a190-21a4d5d474fa', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0008,25-0008', 0.00, 427.00, 444.08, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/YaNk8ADc_E0B-T8bEFp4ew/fnr3SJUtDFLNgaPELUUfx_hwVXkv6fHvFAKmBeG8JcvIxakhyOaGdgN5x0aZ38HpmdHtqvkgQIzmlT_a0kjO8oZfPvVU3kjdBRS4yeV3cLs9QqatL-CKQpu3YgqsGIGzd0FNdyMA-oSbjMKLHNiz76SJ1gWPTeQcuO9k0MJWvLEygny4pbYROEW43ZR2TH-kOhniz-juAW-U_N2hWoxMbQ/SkBHBQ7ij0DEmKjnGISGTOWbKhEv1xG7qOJeRuhaudY', 'Pagato', '2025-07-16', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('40da58be-2997-4d54-9a04-9f50e013983c', '25-3', '2025-07-07', NULL, NULL, '34a4e93d-a6fd-4944-8600-305681f881b7', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0008', 0.00, 1382.70, 1440.01, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/mwboIl_ekIEkWWl6Mdy9Vw/jJc7neZQGd4f6NR5PuJxvoED8twrnA3RhnUpJqjDn6r1oVGREC7xRkgpUr_67NC_FhZYIoGJgnYYV7DuhDxS5Kqakq-pqmS9JdVVj7hWvFyPt5vIV-YMbqrsRMrA3sl-5c8N2L304IiLFZTP8pKKgYdHFZMgL1lgU4gj7Wr_mhQ/jqlVGaQ2KAmpBP285thC48BzYGqzBEksoJA6xQHH1sY', 'Pagato', '2025-07-16', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('492520b4-77ba-43d9-860a-617b54418099', 'in_1RiYD6CcKlYJxALVuImhq6KL', '2025-07-08', NULL, 'ade4aa40-dbd2-46c6-9eb1-67374007ab19', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 11.50, 11.50, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/U_vJWpUDKzTxN95RV27Cgg/i-MTvXQAqrDKxaA5eIT4KlA6-0lddgRSe6kaDvp1o85u64SH92zDIXnvx5nHOSa4Eph3uN65EsvM6bGUAKKwhXTTEP47c0IU9glN-OWT92dEMLoORYPw0AhbzLca_4A-JTVNv71N8jAzoERF59-kMY4asuZU54P_2QB3KcGlMRK9E5wuSL6io_O3yAKkJ5C-/Hp9dIs8TGZyJiPzjdzYb0uZ6-6KIPjYzf89QSPoNDTU', 'Pagato', '2025-07-11', 'Abbonamento mensile', 0.00, 0.00, 0.00, false, NULL),
	('40d454b0-bf95-4bbe-8d7b-8d766cdff443', '71861137', '2025-07-22', NULL, '3afbff47-8c62-4b6e-a576-cb1c447fbc9d', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 262.02, 262.02, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/pRmnb77Wo0xFAr2GgRKJRw/zNmoi4oMF1i3sMzgWjejhpKZY-LSo5a0KVMllnjUaQXksooRfQs2Oytj1Nkg9P2mkX7BP4ArxnLKbVpcjy6Ab_gT0Pw1UxZuVjb0XLX7FBZNpiOkAfQ2l4TVmGYgEx3KquTgiolTBltQRA_67bxgXQxK_2h-GC176mqWuk2HuPUQqSET8pMP_VwP7dIjURxT/-nOfxA0MhMtgnLGNuzi1FqyaRb-A5A0RE2TON3fHwmg', 'Pagato', '2025-07-28', 'Acquisto Estensione PLugin Amelia', 0.00, 0.00, 0.00, false, NULL),
	('25a87122-3e32-4a1e-960a-c8ac698f7d78', '25-84', '2025-07-28', NULL, 'c775169d-7910-434d-9cf1-dd62f00e8984', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 8800.00, 400.00, 488.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/wVPkF-u5igX44O64APCkWw/fK2fFNuyiTqNCY-mZXD_D_qjUBKew-YoliihCZWSAkaYXd4YZyuEw7Kal1L63NH6-C6w1B3kzTSsNheTanSqnyF501iXVSHLPc4vu4xtjLsPssXBoxiJfcfFate6DOvPWIFAxQLqHXOVaK_E5i1CMoU5cX-DQxMftwA5K3xrOXCHt6IrvoSWkCukJTbyg1e01dW17kmDfHlsMW0kYqjXejY22U8ATEByifcUQizkBDA/jwe04MU2nktia7qYARMfLP8zEU7suT8oLoB0lA5l8Do', 'Pagato', '2025-07-08', 'Affitto luglio', 0.00, 0.00, 0.00, false, NULL),
	('70632d40-6357-445b-af04-2f5cce6f410d', 'in_1RtmyuCcKlYJxALVIZrMTSXB', '2025-08-08', NULL, 'ade4aa40-dbd2-46c6-9eb1-67374007ab19', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 11.50, 11.50, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/Q9ABDxelzOCkNy4COsl-0A/jrjjc2Zf5AVlkJl5I9HoiPFdKxzwlBdsW8RCgNvIrSQPbe4q2c-ItT4LqEK9bwB8QDFqGQHBsmuIwn3fDm_cKxzN-0EjJx_OC1t1B82cpBY_9AHWLG0Ad1GNPckvzQqhokmmIAJlLeV2_bsrv3bKxWFk7qT-OUGEJb-NdaCEDKJSLZ8vEVIh4itb1bltGhHe/jO_Ast2w8gGsDxmTR5_VJSnGQBJIcBAPzWAjXgD5p9I', 'Pagato', '2025-08-12', 'Abbonamento mensile', 0.00, 0.00, 0.00, false, NULL),
	('c3d0b2be-f500-43e9-853f-dee697e9829f', '8778WKVGGYJ6', '2025-08-07', NULL, 'a55f480d-11d0-4b81-b7ab-a0555af3d4d2', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 648.00, 648.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/Kkk2F_UsbrnloG6y_fzUaw/DuC69xda8vu_80vCkQTRFyjS9Ya_ElITepbfZjUA-Awu75jVIDyPkvgY54PTIBpJWfAhi8gD9N2BYlX_818OCjbQc5QsQJt9zlImD-TTJl91NkkPALXQygdkUuPJWFJ2dYitbMp6scvqFnwSeTQq82iQFuCf9Pu7NekInY5acbM/oRKHuGu2pNcYGwOx1htkh5g07eAdmF1evgpqMtjukto', 'Pagato', '2025-08-12', 'Abbonamento annuale', 0.00, 0.00, 0.00, false, NULL),
	('f9cdc2ef-33e6-4a25-b406-d6cf16975940', '814005973196', '2025-08-09', NULL, '8e3bddb8-afdd-4619-b7d2-94769e5e4c82', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 1082.00, 49.17, 59.99, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/zfbXAYkxzDrJyt3Ff2F35Q/ZVhGKa16qWX8x4hKyL0Xcz04y0CaiKto45kAy50FuqVddQQSQ1XB3LTKwPpuo-NLDyh17BcJOxQ-G3BNXJnEyAwUuVM5BUAAPKygVJu3ZSgkOphTX5_c7aXzMsXHRS61ZECkAOFcecptdlre1JNLq2FTYUxwB4dxmclhDmk-CHU/HXMNGeEpKF-CU8IeGcuaFXRTQYhJhBGTb7F_2t4Z_l0', 'Pagato', '2025-08-14', 'Acquisto Apple Motion', 0.00, 0.00, 0.00, false, NULL),
	('bfbaf8de-033d-485b-a261-f15e091c95e1', '814005973197', '2025-08-09', NULL, '8e3bddb8-afdd-4619-b7d2-94769e5e4c82', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 162.00, 7.37, 8.99, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/UeY3kRv4PFU54AXzA3ObHA/Ejbkx62Kk5LSsUHmUth4-vsXCqV2zgrepXBVGoSk4Hut0blJFZiDG-L8vsXb-b9whBpGuii4mlbkI0emcH78UO4DRJNsfeeoN-LYPhs_G1Xr-5ooTgTeVO1HUAMxjCOdEeXLlPW9-3Fif4BUpgl-ijk17ydGsXUyJ5o-vFmjIYY/nA8R-EcnhWUscae5Qg0BT03VBCGUcVXQBcNuTgDzxP0', 'Pagato', '2025-08-12', 'Acquisto FinalCap Ultimate', 0.00, 0.00, 0.00, false, NULL),
	('0a0e45d0-2074-4ddd-8f5c-8e8ce6c11ae0', '25-16', '2025-08-11', NULL, NULL, 'cc86b9a6-2b2a-49e8-ad16-b3189ecd7b4e', '2026-02-01 14:41:30.159501+00', NULL, NULL, '25-0011,25-0013,25-0015', 0.00, 420.00, 438.88, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/OrsbH0JJ74uPeGe4SBOyQA/6DK09uRvT0034m_QMEdbe-U-Liiu19Us-dV0JS3D_Wc18YAmDO2dg5VpDIoWH1eI8Me8GEf2syGiROYkc2RNXPbj7XoqDKeisgILPxQYz9FN-wLhtK4ZGul97DTQ2TXI21iFUeQvROWp8TStLYdlJ1M1eMmG8ki6qcDShxrjU8R_PYt50z1AM9lMvDYX1chq/hFo8_AMx1DcT44n2tjArflS4VngLjOR1-xqbcOyWVyc', 'Pagato', '2025-09-15', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('01bcfe30-0084-4105-9167-7cff3703e33b', '2025-45', '2025-09-03', NULL, 'd5acd9e9-37e8-4d5e-9594-0d354db80781', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 660.00, 686.40, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/wR1iRbXEbaJNIkl_TpI22g/n9qww5Hggmj5yttBtSkykNi_5bayRncJdMIu3lyxDBtW8ureJtw2CT2KNfSh_BihRCUDCVtgEhEF3gtR08CJ8VTqpzp8ggBotFJmeo8HghADVr0RjbD8B5dUZxREKFkCni1ahOEBoX2aI42-2jzEMWhR9UCtqPkhBXZb2FMju2M/BTPYQaAAopTpQvqcmc386xWz9wQiay72uBR_Y35-t5c', 'Pagato', '2025-09-15', 'Tenuta contabilità e chiusura iva secondo trimestre 2025', 0.00, 0.00, 0.00, false, NULL),
	('fb1a2f4e-7115-42fd-8bde-7d91e864f477', '25-2', '2025-09-09', NULL, NULL, '0807e144-1150-4f79-8b0a-3f6a26ebf2cc', '2026-02-01 14:41:30.159501+00', NULL, NULL, '25-0013', 0.00, 270.00, 225.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/2Nhk2S7SD_xYcOQftExjaQ/toCsiZ7_33mEA_oHvK7zEIYpgGvJnCPWBGcg_OTD6SHSky6SsMr79-2Sizh5SWA6HKbDugGt0Yaie1a5C1TIrQ2T_H0Pi5Ce67dY6K4baERHj2Jh1B1Ez3HwjovzlL6UiK4wZrg4C_C8jW6__hX7reiFNEK3sQuOxgHSa0mam2K0RhBFYji7pz367N9tIF2M/nPA69QaDmrNfFjvMngxBZhYdo04YGEgZ1DKb9l_SGp8', 'Pagato', '2025-09-15', 'Ritenuta d''acconto', 0.00, 0.00, 0.00, false, NULL),
	('80c6bb1f-1aa2-451a-9b7c-9c225258b44a', '3-GLY/2025', '2025-09-12', NULL, NULL, 'db6d9031-51a1-4afb-a108-d62f3a9574ae', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0003', 0.00, 600.00, 602.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/0NXxhh8Gr5yTrKNTPXJFcg/H-dbu-uadZGxkau6PHDImv99fEusYGlOZaBE2UvFivtISX9CCZ1rYSsKjIEmICXUee1M6wFLzmudNw2ZVC8RAh8C4FWF0IVFY4biGne8ReuWIGJJz79FJYmydf3Ib1nlYJNzmMHMeZTX98113ZsgMk7-9qpbLXbUsgLA6ttHjOOH82jzZArWMv9Lu9XiHIKB/cnIhbZjGwJFlkv0-yqSaekYWNxpgcXhiqV3xUG2Ja7A', 'Pagato', '2025-09-15', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('fcd94d74-cf54-4452-bcca-373b0887d5be', '25-21', '2025-08-21', NULL, NULL, '36a0e60e-e5d5-403d-a7a6-07fe4429ab73', '2026-02-01 14:41:30.159501+00', NULL, NULL, '25-0011', 0.00, 180.00, 180.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/IHGbhwa9ii3UCtPICzyHrQ/S-6B-wwvFlWa7LABRyT_fBXwOkIfnd54H_ThTwsb8E0ZZfRUpzInUcoWlf-kJh_Tm4F9ODWCcU56nQYYsiJuNggzeTViBsHNVy3dW8cVwUdtnQMB16oPuGzlzF4mYduMew5YxT5fy3jzL5uamiIIMaib6PUwSy2OIGnj2buJ3eSok43-vVEaU-wMbnlnVtEq/z8JAo6Twa6NJyRosnD93B6jLglA3c_L0XYppXp8Hsnk', 'Pagato', '2025-09-15', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('fc61872d-0946-4b86-9e93-08ae12ae113f', 'in_1S51lHCcKlYJxALVOCNoO6np', '2025-09-08', NULL, 'ade4aa40-dbd2-46c6-9eb1-67374007ab19', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 11.50, 11.50, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/k7AhOnaE4KYUJj-DvWT3Zw/sFbQ9tINT9ykpb046undAQgCxYxoYia8dtmWkgDxcpzAce-arYgsSyYAcRT0IwnS7xaJb0WS_FccxrQkqdBR8TryE2ag_CiroJk6gE0vQvJynWvCekGzpo5oaGBzw8Va3jHu6m0svpzmqPb8u2l3TPv9osQRNN0TJQdLedPhdvWtN84-z8RINrxXK5KO83dx/fp4wzVtiowvqtKoVRM9dI0IgDLQcwFYDFaxXiqERBoE', 'Pagato', '2025-09-11', 'Abbonamento mensile', 0.00, 0.00, 0.00, false, NULL),
	('35bf9736-d78b-4b13-aa73-02cd157aa222', '25-3', '2025-10-13', NULL, NULL, 'ffba1af1-2c0c-4d71-86cf-5b0df4e5ece6', '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 800.00, 832.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/ywRDovIRKWqy72vQNP3s2Q/Z81hHZBd4-u5a9-LbpFrLftdxo18zmRGIKHsqUzs3FW5fvdTEcpevCGbfUZqg9RpUFIjgDikYrkEI1ZgafYzQjerFUw0SMLvbmn7q78H9jDjBbVfrYkJS5EWLnYMpAkKTpaWuTFp0vQFegILDRlOHyom6uyyHkHV0SYFq4_HoLs/AkHu7Ez-Yqm6EFGvPVaoiK3sODz5D2yBMP4gEezcrk8', 'Pagato', '2025-11-13', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('5f83af50-6ae1-40ba-b6a7-623cbfe71918', '25-4', '2025-10-17', NULL, NULL, 'ffba1af1-2c0c-4d71-86cf-5b0df4e5ece6', '2026-02-01 14:41:30.159501+00', NULL, NULL, '25-0014', 0.00, 120.00, 124.80, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/53Hp5-U_bemP4o-riaCtcA/9gfpDn6ZcgM5zBbaqNPhS3kz1tKSZPqrXr-kmXMqSYLDEq0cLbE6MXH7It6TvxVGZ0PY_5jGIGsxoUqx6SDzhZa7VHoNYJ2pud4Ubk9uyehw2KnJrU5fduaWFIcJQYZOTcmp4Fhtkrrr_Mp8gGtnNHcgr4G3XhnV_NIuxBaPnRc/zehxezLtzLbW2E0luIzlNeggOIO7xuZqPqqdChBZUaU', 'Pagato', '2025-11-13', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('d3c0b6c4-b920-4cfd-b779-4618f5bed745', '25-27', '2025-10-16', NULL, NULL, '36a0e60e-e5d5-403d-a7a6-07fe4429ab73', '2026-02-01 14:41:30.159501+00', NULL, NULL, '25-0016', 0.00, 245.00, 245.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/8OY_UMT6rGtuEXPWzmY_Tg/UuWosLcfKmPVuuMMGg_m_lUulpbhvYAHbPyExtzzXKE3bgZnarzGM5Foh4uZ_F5DMwjowCu9hlZVL5ruqu4X858ESVJYamIJoZ55hUjDmuzzgRppTZaWawlgv1wh7zCpmjYssFhRXgO_Zp3qm7wzVRMfX0lSMR_qj251Zt4WbciSx69o0Vu3wka803UXSxNJ/Ii8O7NjbPDr9cgLsM6oWgN79w6dt4MjO4vCoGDOZbfc', 'Pagato', '2025-11-13', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('addab9ea-e2a6-4950-95d1-e1ee1c77aa65', '25-28', '2025-10-16', NULL, NULL, '36a0e60e-e5d5-403d-a7a6-07fe4429ab73', '2026-02-01 14:41:30.159501+00', NULL, NULL, '25-0017', 0.00, 550.00, 550.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/dboldg2UX48eQsJ2pUKpqA/NJQuBt7isiDhp2q52tjaYT0r0dkpJXZiqzh-GKeCPlCHUZ76-2mmdyTqYKiPfwzLypp5e-JwHLmOS0P5_eNEt3d5uPFar8Wlx88ghxFPrnUU6C4ZvZzjKKitP53GCQFjGVUhcXlRQJ0UMCRqjyqFah1MztOVrBwpZ8NFgE5njKvPe5opdyIIZiiK-hrMWF9S/7GkBUBZI-LVX4sa8ukh4JclOnKcoKhAqXdFrywfIIHw', 'Pagato', '2025-11-13', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('169393cd-b427-4326-a9ee-4ef60ac5e4ce', '25-4', '2025-10-20', NULL, NULL, '34a4e93d-a6fd-4944-8600-305681f881b7', '2026-02-01 14:41:30.159501+00', NULL, NULL, '24-0008', 0.00, 1382.70, 1440.01, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/8IzFcyPaR9JJfiREVQPGCg/rU-P13fcxn9Q_VZkNiQcPcD14NfdxTgb1RycpRFwsSMnBF1OmPcCnix3Rxx5BzBXVR03nJe6bQt8oLHn3k-uTW9G3CwJ3rbjtNMBGVGR6bbL5ZcViPP7Lbix1Q9DhXQzCbwqqZal-REdLCugPg-FFRC2nfFaUPzuyuLHzrvM_zI/3n3KSlw5Ep7Ap5cJunHlZXMK3jwhQkxEL1UtTieqrHc', 'Pagato', '2025-11-13', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('935d9060-5a69-43a2-94ec-1ec65f571d20', '25-74', '2025-10-20', NULL, 'd5acd9e9-37e8-4d5e-9594-0d354db80781', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 2111.20, 2111.20, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/fK5suWUMVYucABjin2l9GA/8to5dW-Fm1QfXyN_CdTYbD7tl1z9kBsUt4AWNgSVyAK_8eelso_vHd7m10cRaIRouZlmUUrYPSSvIzdgFzgZ0EBJhpGAhM4i6C5ZCDoAi-OnLebAhqNF263yvbw0oTNAOAod2cXhCNrTBKGz4G3jRtzDx1XNKwOYRK0YsFJ70OE/2WybsOCl_2c7T5TdfBew0spA_lqu1xFygE40JconYMA', 'Pagato', '2025-11-13', 'Saldo competenze 2024: redazione e deposito bilancio, dichiarazione dei redditi società, dichiarazione IVA, modello 770', 0.00, 0.00, 0.00, false, NULL),
	('22b2796c-a1d5-4330-8566-0865b61f5939', 'in_1SFu3KCcKlYJxALVFl4V4xEB', '2025-10-08', NULL, 'ade4aa40-dbd2-46c6-9eb1-67374007ab19', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 11.50, 11.50, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/P3mQeWlIJKPZYOfskvpdqA/oIApN6HI1ZyYyDQCYKxifueXlnp1V_cvwcrEHS4KN-yhHyACMMRu4jn4hJirbCOsSUkBp-_rri0noL677yVVG4QryT6IAcWKuObdxZJZ0p-a4L5CtHRGRYXKIRnMo9ytYTIJmoIGLM88odoy0_9Djtwn9tsbwZi9YkayjaS1l2BmeUuv3qnQye8oMihrNoFl/Oln40A4p4tz-5c9-_ImRN_lnWTQexgl9h7xHchOh-EQ', 'Pagato', '2025-10-13', 'Abbonamento mensile', 0.00, 0.00, 0.00, false, NULL),
	('57922c4d-672b-4047-b457-5333c4be2f45', 'F7AMUWSD-0002', '2025-10-15', NULL, NULL, NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 288.00, 288.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/J11dEIXNmktN53XKdeMPmw/wpDPsVQuv_1XncEVIKn2XHuAicbEPTW9j2tFWv-AssYW1CE5lKhnR-7eKWX6pf7zYK91_f24mzELAoHNBG1t9j_cUyL7q7_YpuZ3qhvMtca2KR5KoMw94kTQ0nv8Q5IwlU8PEkdSvSJ9ktq23717SytkMxpm5r9rgDWHdrOP1h6Fgk0vYmaLvG_-yi2C5safi5A7DFVN48Guk0MLrlTDcD-_CmhKUYqwgJL2aX4zgMTgtD29vRIWxPYU1OpGL-0vIBr-SxoHsHqzzi2-MA2CDBhzv8UD5S0jrE3HIwI4C1E/psRGppM6lJmu3KPCdLB5VXWVz9MiQDBU9yL7OXaQvRQ', 'Pagato', '2025-10-20', 'Abbonamento annuale', 0.00, 0.00, 0.00, false, NULL),
	('91b9d48d-6fc6-4c79-b153-e646df2a413c', '25-20', '2025-11-18', NULL, NULL, 'cc86b9a6-2b2a-49e8-ad16-b3189ecd7b4e', '2026-02-01 14:41:30.159501+00', NULL, NULL, '25-0016,25-0019', 0.00, 515.00, 537.68, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/j3QkAEZx8YIleGnK8MgQsg/su418G_Tc483c6HCwiyvVe0ihy02OD_vGEMqfjFxywU4TYwsdkvCPGKSHPSnNvPHHAs_Li-tHY-VkDMCIYmE_hsV4yI1fzPPRDL7mvp9rUNsb8oLuGOGp5mrBNgWtBZyWp9JtzA3OW69nTeGfVHV7BengHsFjO0WHKeQOxFOlFqyuAL8RHIlotRq0Lx-WOjY/PjNqRCp-KRPy6yi3-uEMIUP4LsnSCcqoXNCMSyBFdJE', 'Pagato', '2025-12-09', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL),
	('464b2695-15aa-4ea6-b03d-a0a09a44c66f', 'in_1SR8q0CcKlYJxALVG9AKhzbU', '2025-11-08', NULL, 'ade4aa40-dbd2-46c6-9eb1-67374007ab19', NULL, '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 11.50, 11.50, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/mMcyLnog6HwvuKMLZB1MWA/LujO5ChC9kSHCqsuZyLVvJxQQylwGgtAwJ081WN46ctGfA83HTwifaf_FtIrZIzijgJRHiGnjJ09g_Jvhl8clxVsnNtoTMAHfhpCxdHT_dV_OCUyLVePZromp7N38fiK9PDI1pAyNB1YKGjAquJdVtY5cdJeMiHG52DytHED-_TAV8qakDct2xKPtz5ml6zO/sFiAf9dFByyav9kkfVFBMhg0Vf7CyVPLiQ5A5fb1u6k', 'Pagato', '2025-11-11', 'Abbonamento mensile', 0.00, 0.00, 0.00, false, NULL),
	('64f0a5c3-223b-4e55-a041-adcf1d97a6ff', '25-5', '2025-11-28', NULL, NULL, 'ffba1af1-2c0c-4d71-86cf-5b0df4e5ece6', '2026-02-01 14:41:30.159501+00', NULL, NULL, NULL, 0.00, 200.00, 208.00, NULL, NULL, 'https://v5.airtableusercontent.com/v3/u/48/48/1767470400000/UZTxK6amEAeBeXWp3CWXxg/Pvfm7OrQUlwH5PSSilap1O-d3nGQ8CxZ0yZZhp1ULMdViJEO5gyMua1896N_fEn2P8Jx8RQsYK1_gtslLp0dT9ZGPzG12a4RIQF1jkXPg6PhIcrwQzrTiNmcIcdVB79RBjrDEhDkL2XrTnG-iWuBpcXAnl7iL6DmUj3zSFVMTEs/a0gw6ttn_eZRv2vIaf-FWS1NLpFW2SYQZCMLZTnYNFI', 'Pagato', '2025-12-09', 'Prestazione Ocassionale', 0.00, 0.00, 0.00, false, NULL);


--
-- Data for Name: pm_spaces; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: pm_items; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: pm_item_assignees; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: pm_item_comments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: pm_item_incarichi; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: pm_item_links; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: pm_space_assignees; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: reactions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: system_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."system_config" ("key", "value", "description", "updated_at", "updated_by") VALUES
	('google_client_id', 'YOUR_GOOGLE_CLIENT_ID', 'Google OAuth Client ID for Calendar API', '2026-02-01 14:39:43.481736+00', NULL),
	('google_client_secret', 'YOUR_GOOGLE_CLIENT_SECRET', 'Google OAuth Client Secret for Calendar API', '2026-02-01 14:39:43.481736+00', NULL);


--
-- Data for Name: transaction_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user_notification_preferences; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- PostgreSQL database dump complete
--

-- \unrestrict 1FUHg1j3xhKtjzd0WSR4HHXbq5s4xlb7UzU4zXAy7dIpfaIit4BWAc1Za0QIC5l

RESET ALL;
