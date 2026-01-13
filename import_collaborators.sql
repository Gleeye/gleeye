BEGIN;

-- Sync Collaborators Roster
INSERT INTO public.collaborators (name, first_name, last_name, full_name, role, tags, email, phone, vat_number, fiscal_code, address, birth_date, birth_place, airtable_id)
VALUES
('SPINE', 'Simone', 'Spinetti', 'Simone Spinetti', 'Videomaker', 'Video', 'simone@gleeye.eu', '+39 340 18 94 065', '02773540998', 'SPNSMN94L20D969X', 'Via Tomaso Pendola 7, 16143 Genova (GE)', '1994-07-20', 'Genova (GE)', 'SPINE'),
('MED', 'Marco', 'Selvaggio', 'Marco Selvaggio', 'Videomaker', 'Video', 'marco@gleeye.eu', '+39 348 78 91 508', '02790380998', 'SLVMRC95C29D969E', 'Via Fossato San Nicolò 11/1, 16136 Genova (GE)', '1995-07-29', 'Genova (GE)', 'MED'),
('WILLY', 'William', 'Bignone', 'William Bignone', 'Fotografo', 'Foto', 'william@gleeye.eu', '+39 348 975 9085', '02925490993', 'BGNWLM03A18D969K', 'Via Migliarini 4/13 - 16011 - Arenzano (GE)', NULL, NULL, 'WILLY'),
('MATTIA', 'Mattia', 'Montano', 'Mattia Montano', 'Videomaker', 'Video', 'mattia@gleeye.eu', '+39 340 970 3996', NULL, NULL, NULL, '1992-04-27', 'Genova', 'MATTIA'),
('URSIDA', 'Alessio', 'Ursida', 'Alessio Ursida', 'Fotografo', 'Foto', 'alessioursida@gmail.com', '+39 345 45 17 525', NULL, NULL, NULL, NULL, NULL, 'URSIDA'),
('SARA', 'Sara', 'Verterano', 'Sara Verterano', 'Web Designer', 'Siti Web & E-commerce', 'sara@gleeye.eu', '+39 340 49 62 711', '02494880996', 'VRTSRA88D64D969L', 'Via Palmaria 7/10, 16121 Genova (GE)', '1988-04-24', 'Genova (GE)', 'SARA'),
('GABRI', 'Gabriele', 'Picone', 'Gabriele Picone', NULL, 'Siti Web & E-commerce,Digital Marketing', 'gabriele@gleeye.eu', '+39 377 12 81 315', '02964730994', 'PCNGRL00L16D969S', 'Viale Giancarlo Odino 5, 16125 Genova (GE)', '2000-07-16', 'Genova (GE)', 'GABRI'),
('DAVIDE', 'Davide', 'Gentile', 'Davide Gentile', NULL, 'Project Manager,Account', 'davide@gleeye.eu', '+39 335 16 24 363', NULL, 'GNTDVDT17D969L', 'Via Napoli 20/2, 16134 Genova (GE)', '1987-12-17', 'Genova (GE)', 'DAVIDE'),
('ANDREA', 'Andrea', 'Visentin', 'Andrea Visentin', NULL, 'Project Manager,Account', 'andrea@gleeye.eu', '+39 340 10 99 024', NULL, NULL, NULL, NULL, NULL, 'ANDREA'),
('GOMMELLINIM', 'Martina', 'Gommellini', 'Martina Gommellini', 'Grafica', 'Grafica', 'martina@gleeye.eu', '+39 349 55 69 537', '02971080995', 'GMMMTN96H52D969H', 'S.TA DI SAN GEROLAMO 4 NERO INT 15', '1996-06-12', 'Genova (GE)', 'GOMMELLINIM'),
('BARBEROM', 'Mara', 'Barbero', 'Mara Barbero', 'Project Manager', 'Project Manager,Account', 'mara@gleeye.eu', '+39 347 58 59 230', '10189960965', 'BRBMRA80E70I480V', 'Via Millelire 1/d, 17028 Bergeggi (SV)', '1980-05-30', 'Savona (SV)', 'BARBEROM'),
('LEYLA', 'Leyla', 'El Abiri', 'Leyla El Abiri', 'Content Creator', 'Digital Marketing', 'leyla@gleeye.eu', '+39 331 72 85 271', '02803410998', 'LBRLYL99B44D969X', 'Via del Chiappazzo 108 uni, 16137 Genova (GE)', '1999-02-04', 'Genova (GE)', 'LEYLA'),
('ASQUIEC', 'Camille', 'Asquié', 'Camille Asquié', 'Content Creator', 'Digital Marketing', 'camille@gleeye.eu', '+39 351 44 09 578', '02981830991', 'SQACLL96A56D969P', 'Via Filippo Casoni 5/14D, 16143 Genova (GE)', '1996-01-16', 'Genova (GE)', 'ASQUIEC'),
('RALUCA', 'Raluca', 'Ghebenei', 'Raluca Ghebenei', 'Grafica', 'Grafica', 'raluca@gleeye.eu', '+39 353 398 2247', '03013370998', 'GHBRCL00L642129T', 'VIA XVI GIUGNO 1944 7B/1, 16153 GENOVA', '2000-07-24', 'SIBIU (ROMANIA)', 'RALUCA'),
('CASTELLANOA', 'Alessio', 'Castellano', 'Alessio Castellano', 'Videomaker', 'Video', 'alessiocastellano49@gmail.com', '+39 345 579 7000', '02964380998', 'CSTLSS98P01D969F', NULL, NULL, NULL, 'CASTELLANOA'),
('FERRETTIP', 'Paolo', 'Ferretti', 'Paolo Ferretti', 'FOTOGRAFO', 'Foto', 'paolo.ferrets@gmail.com', '+39 335 668 0299', NULL, 'FRRPLA90E03D969P', NULL, NULL, NULL, 'FERRETTIP'),
('DENURCHISN', 'Nadia', 'Denurchis', 'Nadia Denurchis', 'Podcast', 'Podcast', 'nadia.denurchis@gmail.com', '+39 347 969 8577', NULL, 'DNRNDA85C60D969F', 'Via Giacomo Boero 16/2, 16132 Genova (GE)', '1985-03-20', 'Genova (GE)', 'DENURCHISN'),
('PIAZZAE', 'Elisa', 'Piazza', 'Elisa Piazza', 'Tecnico Podcast', 'Podcast', 'elisa.piazza26@gmail.com', '+393491147106', NULL, 'PZZLSE03P66D969B', 'Corso de Stefanis 6/22 A', '2003-09-26', 'Genova', 'PIAZZAE'),
('SAVONAS', 'Sharon', 'Savona', 'Sharon Savona', 'Account Junior', 'Account', 'sharon@gleeye.eu', '+393281650760', NULL, 'SVNSRN93H51D969H', 'Via Giovanni Trossarelli 9b/23', '1993-06-11', 'Genova', 'SAVONAS'),
('BEATRICE', 'Beatrice', 'Frugone', 'Beatrice Frugone', 'Collaboratore Esterno', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'BEATRICE'),
('ELISA', 'Elisa', 'Bertolone', 'Elisa Bertolone', 'Collaboratore Esterno', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'ELISA'),
('RICARDO', 'Ricardo', 'Vela', 'Ricardo Vela', 'Collaboratore Esterno', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'RICARDO')
ON CONFLICT (airtable_id) DO UPDATE SET
name = EXCLUDED.name, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, full_name = EXCLUDED.full_name, role = EXCLUDED.role, email = EXCLUDED.email, phone = EXCLUDED.phone;

-- Link Assignments
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0013' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0013' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0013' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0013' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0010' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0010' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0010' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0010' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0001' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0001' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0001' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0001' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0016' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'WILLY' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0016' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'WILLY' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0016' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0016' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0016' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0016' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0017' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0017' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0017' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0017' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0027' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0027' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0027' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0027' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0028' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0028' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0029' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0029' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0030' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'LEYLA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0030' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'LEYLA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0030' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0030' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0023' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0023' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0002' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0002' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0002' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0002' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0007' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0007' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0007' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0007' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0008' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'BARBEROM' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0008' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'BARBEROM' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0008' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0008' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0008' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0008' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0008' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'GOMMELLINIM' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0008' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'GOMMELLINIM' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0008' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0008' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '23-0075' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '23-0075' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0031' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'MED' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0031' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'MED' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0031' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0031' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0031' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0031' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0031' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0031' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-CVS' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-CVS' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0032' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0032' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0036' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'URSIDA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0036' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'URSIDA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0036' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0036' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0037' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0037' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0038' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0038' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0039' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'BARBEROM' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0039' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'BARBEROM' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0039' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0039' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0042' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0042' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0042' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0042' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0003' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0003' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0004' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0004' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0006' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0006' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0006' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0006' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0007' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0007' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0007' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0007' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0008' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0008' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0008' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0008' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0008' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0008' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0009' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0009' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0009' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0009' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0011' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'WILLY' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0011' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'WILLY' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0011' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0011' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0011' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0011' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0012' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0012' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0013' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0013' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0013' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0013' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0013' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'FERRETTIP' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0013' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'FERRETTIP' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0016' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'WILLY' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0016' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'WILLY' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0016' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0016' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0016' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0016' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0017' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0017' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0018' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0018' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0019' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0019' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0019' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0019' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0020' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0020' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0020' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0020' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0021' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0021' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0025' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'WILLY' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0025' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'WILLY' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0025' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0025' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0025' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0025' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0026' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0026' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0028' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0028' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0029' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SAVONAS' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0029' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SAVONAS' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0029' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0029' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0029' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0029' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DAVIDE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0009' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0009' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0009' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0009' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0009' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ELISA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0009' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ELISA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0012' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0012' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0012' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0012' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0020' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'WILLY' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0020' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'WILLY' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0020' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'RICARDO' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0020' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'RICARDO' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0020' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'GOMMELLINIM' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0020' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'GOMMELLINIM' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0020' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0020' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0020' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0020' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0021' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0021' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0022' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0022' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0022' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'GABRI' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0022' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'GABRI' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0022' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0022' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0022' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'GOMMELLINIM' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0022' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'GOMMELLINIM' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0026' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0026' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0014' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0014' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0043' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0043' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0024' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0024' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0024' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0024' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0025' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0025' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0025' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'GOMMELLINIM' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0025' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'GOMMELLINIM' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0006' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'BEATRICE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0006' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'BEATRICE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0006' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0006' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0019' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'WILLY' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0019' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'WILLY' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0019' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0019' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0019' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0019' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0015' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0015' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0004' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0004' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0004' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0004' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0005' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0005' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0018' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0018' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0018' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0018' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0018' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'CASTELLANOA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0018' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'CASTELLANOA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0011' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'WILLY' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0011' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'WILLY' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0011' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0011' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0011' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0011' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0011' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'GABRI' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0011' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'GABRI' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0011' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'FERRETTIP' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0011' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'FERRETTIP' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0001' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'LEYLA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0001' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'LEYLA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0001' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0001' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0005' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0005' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0005' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'RALUCA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0005' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'RALUCA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0003' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'WILLY' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0003' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'WILLY' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0003' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0003' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SARA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0003' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'GABRI' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0003' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'GABRI' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0003' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0003' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0015' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0015' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'MATTIA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0015' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0015' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0022' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0022' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0022' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'RALUCA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0022' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'RALUCA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0023' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'URSIDA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0023' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'URSIDA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0023' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0023' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0024' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0024' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'ANDREA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0024' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DENURCHISN' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0024' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DENURCHISN' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0014' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'BARBEROM' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0014' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'BARBEROM' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0014' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'DENURCHISN' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0014' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'DENURCHISN' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0014' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'PIAZZAE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0014' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'PIAZZAE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0014' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'RALUCA' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0014' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'RALUCA' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '25-0027' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'BARBEROM' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '25-0027' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'BARBEROM' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0040' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'MED' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0040' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'MED' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0040' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0040' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0040' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'WILLY' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0040' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'WILLY' LIMIT 1)
ON CONFLICT DO NOTHING;
INSERT INTO public.order_collaborators (order_id, collaborator_id)
SELECT (SELECT id FROM public.orders WHERE order_number = '24-0041' LIMIT 1), (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
WHERE EXISTS (SELECT id FROM public.orders WHERE order_number = '24-0041' LIMIT 1) AND EXISTS (SELECT id FROM public.collaborators WHERE airtable_id = 'SPINE' LIMIT 1)
ON CONFLICT DO NOTHING;

COMMIT;