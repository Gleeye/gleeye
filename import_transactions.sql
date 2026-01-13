-- Auto-generated import script for Bank Transactions

-- 1. Insert Categories

INSERT INTO public.transaction_categories (name, type)
VALUES ('Uscita Generica', 'uscita')
ON CONFLICT (name, type) DO NOTHING;

INSERT INTO public.transaction_categories (name, type)
VALUES ('Affitto', 'uscita')
ON CONFLICT (name, type) DO NOTHING;

INSERT INTO public.transaction_categories (name, type)
VALUES ('Entrata Generica', 'entrata')
ON CONFLICT (name, type) DO NOTHING;

INSERT INTO public.transaction_categories (name, type)
VALUES ('Collaboratori', 'uscita')
ON CONFLICT (name, type) DO NOTHING;

INSERT INTO public.transaction_categories (name, type)
VALUES ('Pagamento F24', 'uscita')
ON CONFLICT (name, type) DO NOTHING;

INSERT INTO public.transaction_categories (name, type)
VALUES ('Pagamento per conto cliente', 'uscita')
ON CONFLICT (name, type) DO NOTHING;

INSERT INTO public.transaction_categories (name, type)
VALUES ('Abbonamento servizi', 'uscita')
ON CONFLICT (name, type) DO NOTHING;

-- 2. Insert Transactions

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-4-15', 'entrata', 10000.00, 'Versamento Capitale Sociale',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-4-16', 'uscita', 1500.00, '"Saldo parcella n. 150/001 del 18/03/2024
Per costituzione di S.R.L. in data 14 marzo 2024"',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Francesco Porcile Notaio' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Francesco Porcile Notaio' LIMIT 1),
    NULL, NULL,
    'Francesco Porcile Notaio', NULL, 'Francesco Porcile 150/001',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-4-16', 'uscita', 103.72, 'Abbonamento annuale Make.com per automazioni',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Celonis Inc.' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Celonis Inc.' LIMIT 1),
    NULL, NULL,
    'Celonis Inc.', NULL, 'Celonis Inc. Invoice-270DF76E-0001',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-4-16', 'uscita', 461.02, 'Licenza annuale Airtable per 2 utenti',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Airtable' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Airtable' LIMIT 1),
    NULL, NULL,
    'Airtable', NULL, 'Airtable 2A62818B0001',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-4-16', 'uscita', 1.22, 'Primi tre mesi fatturazione elettronica',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Aruba' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Aruba' LIMIT 1),
    NULL, NULL,
    'Aruba', NULL, 'ARUBA SPA 1000243002952662',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-4-17', 'entrata', 6039.00, 'Saldo fattura n. 24/1',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Fanimar' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Fanimar' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '24-1' OR invoice_number = '24/1' LIMIT 1), NULL,
    'Fanimar', '24-1', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-5-13', 'uscita', 2400.00, 'SALDO RITENUTA N. 2/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'BERTOLONE ELISA' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'BERTOLONE ELISA' LIMIT 1),
    NULL, NULL,
    'BERTOLONE ELISA', NULL, 'Elisa Bertolone 24-2',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-5-16', 'uscita', 177.75, 'Versamento Ritenuta d''acconto APRILE',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento F24' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    'Quietanza (1).pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/ZC7ZK_0xe-3UxC3EQDgn1A/UZhYXq6Py9Sw5_Si18_DXiCmR6rrrtVw7HYXIf5KWTOHOjWWuxidLiBI-WDRiNtG6wXaZTM--GL27pl1cq-5FSqUys8pNyWWk8l_uN777ejt5QhsAyXs8J-qqG8tmE3wLa6cDHsoI-RdY9r8FQ3ZfBySOsweqJIS3Jt_WV7-iU0/xgEn-2pqLPjFceAD04WECfzWKxv4Hn-gNALTKgY-now)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-5-23', 'entrata', 6100.00, 'Saldo fattura n. 24/4',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'GRUPPO CONSILIARE PARTITO DEMOCRATICO ARTICOLO UNO' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'GRUPPO CONSILIARE PARTITO DEMOCRATICO ARTICOLO UNO' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '24-4' OR invoice_number = '24/4' LIMIT 1), NULL,
    'GRUPPO CONSILIARE PARTITO DEMOCRATICO ARTICOLO UNO', '24-4', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-5-28', 'uscita', 92.72, 'Acquisto hosting per conto di PD LIGURIA',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'ServerPlan' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'ServerPlan' LIMIT 1),
    NULL, NULL,
    'ServerPlan', NULL, NULL,
    '47571_28-5-2024.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/5Ga3Qepp8MKLeit-T1mXJg/S6375e687Gt8eyehVdDDhDiPCA4QYKMHxQ_hQv7CM5woGsnoycsW6HiaysCjklIE2z41Bn_ilEfw0mGAs5Xt_Rh5EHr3HDlmxAIzmea_5Rp--O8kEpIsB9rb2tGiCGOJ8EkD56EMBvgmX44KVpugVWWfz_M_6fEO-L3hDmNt-zU/AvcsL_66tjixuCnRUsa-TH_elkPgSFNQW2i4hu7n_dA)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-5-29', 'uscita', 116.48, 'Pagamento INAIL',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento F24' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    'Quietanza.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/soLPcgORkiZiAjEwwKnLnA/LCZMpHvGYJIRTqJG5qWEQSSJAKd4sqoJJJtsN_kKn-7KYaJEy0LYCXCObGm9QSNVYhyFTO_iUAPnxszT6-GTkHmjL1NuEwWXo6TZ_PZRjVXlxzCvclEVMI3r79n8kanIY7sGU-OyMK8Oy4f0QYx8zVb_KASCZJb06eg0GeKKZPY/0pIethpQCWRrDnsSoSvOSwpQVuiIeQc-lZZm5gsMbQ4)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-5-30', 'entrata', 1098.00, 'Saldo fattura n. 24/2',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'PressCommTech' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'PressCommTech' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '24-2' OR invoice_number = '24/2' LIMIT 1), NULL,
    'PressCommTech', '24-2', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-6-3', 'entrata', 610.00, 'Saldo fattura n. 24-5',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'FANIMAR' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'FANIMAR' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '24-5' OR invoice_number = '24/5' LIMIT 1), NULL,
    'FANIMAR', '24-5', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-6-4', 'entrata', 1830.00, 'Saldo fattura n. 24-3',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'AQUA' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'AQUA' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '24-3' OR invoice_number = '24/3' LIMIT 1), NULL,
    'AQUA', '24-3', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-6-10', 'uscita', 31.72, 'Aquisto per conto di Aqua spazio hosting per sito',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Serverplan' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Serverplan' LIMIT 1),
    NULL, NULL,
    'Serverplan', NULL, NULL,
    '48984_3-6-2024.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/fq4WAsnRuUQLDsaW9MEOwg/mceC71I7gknWMc2cGCWpGVoL3QP1EUujODuyrDlxu7NaONnZQBdxUk3YgJpZUwSsk8_sI-UZn8D3KkBwyFXbuUKk47C3hk0sRoc55_WKlY0M5E6L1STeR8mziSOk-SSttqOzDuB-mimFKfRN-E1zYRLMeu6gwfBJ4jCFAYQW6-I/hbDhj1qqjJtsX_M7xXjV35ivQXKrndUgzVKBvJG0rI0)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-6-11', 'uscita', 1960.00, 'Saldo fattura n.24-24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'SARA VERTERANO' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'SARA VERTERANO' LIMIT 1),
    NULL, NULL,
    'SARA VERTERANO', NULL, 'Sara Verterano 24-24',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-6-11', 'uscita', 418.08, 'Saldo fattura n. 24-3',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'SIMONE SPINETTI' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'SIMONE SPINETTI' LIMIT 1),
    NULL, NULL,
    'SIMONE SPINETTI', NULL, 'Simone Spinetti 24-12',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-6-11', 'uscita', 9.76, 'Acquisto crediti CloudConvert',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'CloudConvert' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'CloudConvert' LIMIT 1),
    NULL, NULL,
    'CloudConvert', NULL, 'CloudConvert 03C5E0E1-0001',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-6-14', 'uscita', 600.00, 'Versamento ritenute d''acconto MAGGIO',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento F24' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-6-30', 'uscita', 0.20, 'Spese conto bancario - canone mensile GIUGNO',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-7-8', 'entrata', 1220.00, 'Saldo fattura 24-6',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Confindustria Genova' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Confindustria Genova' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '24-6' OR invoice_number = '24/6' LIMIT 1), NULL,
    'Confindustria Genova', '24-6', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-7-9', 'uscita', 82.96, 'Affitto sala presso Regus',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Regus' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Regus' LIMIT 1),
    NULL, NULL,
    'Regus', NULL, 'Regus 4332-2024-592INV',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-7-9', 'entrata', 3660.00, 'Saldo fattura n. 24-7',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Associazione Tara Bianca' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Associazione Tara Bianca' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '24-7' OR invoice_number = '24/7' LIMIT 1), NULL,
    'Associazione Tara Bianca', '24-7', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-7-10', 'uscita', 414.53, 'Acquisto Task Magic ',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'TaskMagic Inc' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'TaskMagic Inc' LIMIT 1),
    NULL, NULL,
    'TaskMagic Inc', NULL, 'TaskMagic Inc 9D043A6E0001',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-7-15', 'uscita', 30.50, 'Abbonamento annuale Fatturazione Elettronica',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Aruba' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Aruba' LIMIT 1),
    NULL, NULL,
    'Aruba', NULL, 'ARUBA SPA 1000243004922171',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-7-18', 'uscita', 3470.48, 'Consulenza Avvocato per stipula contratti e documenti',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Avv. Martina Lasagna' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Avv. Martina Lasagna' LIMIT 1),
    NULL, NULL,
    'Avv. Martina Lasagna', NULL, 'Martina Lasagna 24-59',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-7-18', 'uscita', 1104.79, 'Consulenza Commercialista avvio srl',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Studio Dondero' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Studio Dondero' LIMIT 1),
    NULL, NULL,
    'Studio Dondero', NULL, 'Studio Dondero 24- 121',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-7-23', 'uscita', 8.99, 'Abbonamento mensile Google workspace',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Google' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Google' LIMIT 1),
    NULL, NULL,
    'Google', NULL, 'Google 9246439417823840-1',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-7-31', 'uscita', 0.20, 'Spese conto bancario - canone mensile LUGLIO',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-8-8', 'uscita', 31.11, 'Affitto sala presso Regus',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Regus' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Regus' LIMIT 1),
    NULL, NULL,
    'Regus', NULL, 'Regus 4332-2024-675INV',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-8-12', 'uscita', 648.00, 'Abbonamento annuale Dropbox',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Dropbox' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Dropbox' LIMIT 1),
    NULL, NULL,
    'Dropbox', NULL, 'Dropbox YK99Y5S8XTQ7',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-8-13', 'uscita', 41.48, 'Affitto sala presso Regus',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Regus' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Regus' LIMIT 1),
    NULL, NULL,
    'Regus', NULL, 'Regus 4332-2024-677INV',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-8-19', 'uscita', 2879.77, 'Versamento IVA Q2',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento F24' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    'GLEEYE - Versamento IVA Q2 2024.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/3yPL-Yga7noO2YaJNkxdZQ/npywOMHyJqyAyTObnW_Lgcki92vYbNOUc4YrN-ImOsCRKAaRRJDL2OlIQhhKwFWo5pBpdkolnsS9iuSdlcBtQ1vh110UomVazfB5CRJECKMKZXvZpcj1YnnV_wSE767recQ65LX1CAx4o-lx-JnEdl3ejRUjXWm7_j-Cxq9dbpjYzovJewA62dR1tsCq6mmy/3NZln64V-osgnRTw3xddT51tpYRGfPEoAo9fYMtsi3o)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-8-19', 'uscita', 168.00, 'Versamento ritenute d''acconto LUGLIO',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento F24' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    'GLEEYE - Versamento ritenute d''acconto LUGLIO24.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/AfdbW-t04MIiZhEVWLwxgQ/zJp0M4dpwml7pIh5UydxxaUXadpLVEAEdPRkTMMZDPf1UNvCYBPQLBV9vtED7JzM7n1uaU0GR0ZFculV-F_AAyShKIvUPsIBxYEO9H8QOprS3gOWe5D9_RQ4aK4YBveRuWEUvo8YuhHxMES-J8L84kl7k5cw--DBpUpe83F0r7o-xlkTSI3yaOTO6gJRprr48d2fyiACMDejYOVsTgg29A/0CPs9UX9QkaURba1Phne9Aap68LetUJgjPLcsbnciYY)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-8-20', 'uscita', 47.98, 'Acquisto domini per Arboscello',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Serveplan' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Serveplan' LIMIT 1),
    NULL, NULL,
    'Serveplan', NULL, NULL,
    '67987_13-8-2024.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/wuJz8bIZ4WJk36iZaclu9A/rgCSFmPWVgwX9MCpuqPOW6jkG4tbUwuod4B1pI0ByHpK2H_dsXE_ztpkP_Dx00xW56xpcnM_AJBi8BB8xMchqIEetBsDk1g1svUw693xN0PIOUNJif9n44HyjpNwBIU9pvCZMPqM48oGFcar46NL9Ie_hXavTOm1pwbAO6FtDtU/vrq3VqXK72fmxLi05jZkFqHsvwVp1NbKF5KgISHGma4)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-8-21', 'uscita', 8.99, 'Abbonamento mensile Google workspace',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Google' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Google' LIMIT 1),
    NULL, NULL,
    'Google', NULL, 'Google 9246439417823840-2',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-8-31', 'uscita', 0.20, 'Spese conto bancario - canone mensile LUGLIO',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-9-6', 'uscita', 2440.00, 'Saldo fattura n. 34/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Sara Verterano' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Sara Verterano' LIMIT 1),
    NULL, NULL,
    'Sara Verterano', NULL, 'Sara Verterano 24-34',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-9-12', 'uscita', 41.48, 'Affito sala Regus',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Regus' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Regus' LIMIT 1),
    NULL, NULL,
    'Regus', NULL, 'Regus 4332-2024-753INV',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-9-18', 'entrata', 5490.00, 'Saldo fattura n. 10/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'GRUPPO CONSILIARE PARTITO DEMOCRATICO' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'GRUPPO CONSILIARE PARTITO DEMOCRATICO' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '24-10' OR invoice_number = '24/10' LIMIT 1), NULL,
    'GRUPPO CONSILIARE PARTITO DEMOCRATICO', '24-10', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-9-18', 'uscita', 8.99, 'Abbonamento mensile Google workspace',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Google' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Google' LIMIT 1),
    NULL, NULL,
    'Google', NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-9-18', 'uscita', 2.00, 'Campagna Ads Locanda da toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    '2024-09-18T07-35 Transazione #8061974530580304-7991284197649330.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/-w2fAqym5yzm7sGP_X-huA/rgHq_GFb35FxgD2m2pwjMMhcIJbKadz46CnJbdlDBTJGEJ_-f4ASF_LC6SVBCBUuSvwAKpUG5Qtv_ZL-6s0LSFeck_zT29tdRprAKQ4zuAvAJnsTInsV9iPsuJbsoEo2ZSoy58x847D3h_PxxEFRm8jTMhEEynlPphlnZoXnSa8b94TeRs5DfKB6iwqu_-LbYFj5RmMO9m_b-OtkfF1SOjuN-CKk2oaf2pxn4leT3So/PyJ5DPMlYn7_YsOOBIUGLAJSz4FMk3aylPyvjBomnqw)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-9-18', 'uscita', 2.00, 'Campagna Ads Locanda da Toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    '2024-09-18T14-08 Transazione #8212010828910005-8064774816966936.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/T3oh74QnmzphOsfX81-xpg/2DVtqqoazKuO8yID9YkKId6ty-DLvsGSwOEkCNE0mBpv4CUrTkMTaatI3cCf8lHQqNr3rnmpG5aRum80bE6ALhCoESPlq299kNMvZIqZppgRmfhbHYNOQfn8z6qur6mq4iIMzVFJEw94-tPXXu_Vse8Pp79ReDblv0rrMd8gCdHeBpCrLBPyV8rmgk_nWb8gi_JunG5IBxkU5tqKvE5rV9ZJZgDKsS8uLTrUmn2I8sc/S4Z5EbnOlx5p_mHqyfZVJux-1prbCdvBH5EBbfzRuww)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-9-18', 'uscita', 2.00, 'Campagna Ads Locanda da Toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    '2024-09-18T18-24 Transazione #7895496787228075-7895496790561408.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/mHZY0TuzPMWoQHrDVyZlqQ/mzSKQRxLt5bJ34YXnvhE90tsnyk9kKYwv0X2HLb3W-UpAaUUqetmx4-cdC-EPE4G513L-xkVqpIQ9KaPwbDBVfVlYDt46uEJRTN6COMpQ1Z--F5pyATChLrNhE0KmztyCqO6-90p-BS6SY5o7No5naCzMLhxVerSYYQ3xduo9FhwuxEUm3ibdNCkuwq86tnCHv_A9hL8nQdC7zyXa-FBoLsofFhw17btgcr1NQWGyLw/6dchlysxjLm12s9nf5iDvPZe1bCRfE3seYbtn36WGik)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-9-18', 'uscita', 3.00, 'Campagna Ads Locanda da Toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    '2024-09-18T23-11 Transazione #8155581697886251-8067704686673955.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/tgm57XIFowxj8OAv9UAB3w/ROSGAbUfg14oTTDpVB3ojWIw_rpeKC7HSf567lKExG8lAxJVAkdXsf1pXLJssvMiKT_9TFj1Hxbw270un8AluIjmPdC57GXsZb73ZLJ_O6OQbna8tOqvXKzehjWVONgEmw07DtfK7j2dJ4egimv01vvbXEj8_sVTx2OIx8Vj1D9pevITNgtpb7dXVlshBf_QK5La42ml0U9lUuU-t0AzrADE6P7JWJp77Mal8btXJ0E/45lYEMGhpCyj7zDOAz3I59RjKkJc2y9o5_j-eTN9E2Q)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-9-19', 'entrata', 6600.00, 'Saldo fattura n. 9/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Ordine degli Ingegneri' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Ordine degli Ingegneri' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '24-9' OR invoice_number = '24/9' LIMIT 1), NULL,
    'Ordine degli Ingegneri', '24-9', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-9-19', 'uscita', 4.00, 'Campagna Ads Locanda da Toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    '2024-09-19T13-45 Transazione #8002022346575514-8073944212716669.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/Dt3eLbaz4PhZ28uJsayagg/0jfBL37bf4BoRd0muH3ZzGXkEYLo3HuaHADyEC93GbUvZEmAZN1d4vLxrxfZSvLU37qceDSTCjPxO8lzMa324R7RMzLcPIzcfwo6msomu0vUgzmBua-OCSlZF6Bn10MHa8ZlP2GhsbTZCsUVmw70P6ukdcFBEE2urBlYXKHG5fxSlM8BJk78uAYeNRNivj6kkpRR6vpyRwsQCGXUID11ZHptwgqGCAUMwNHxMqinUcU/vibGid-w3OHW5mb0TJMlbHuUi2bJCMxAKCL3sthS6Ng)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-9-19', 'uscita', 5.00, 'Campagna Ads Locanda da Toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    '2024-09-19T20-22 Transazione #8076118845832533-8088808921230194.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/3kpiZyxwJto7nsi-HPJGSQ/ZQplFr6QcFHjDYdqww9xerMKTJq9ShTLvXrq84B5LUzKvACrhUlOv1gayyPdvbZRj6yV1lEWx7rScs_ijFZsTx-a8FnzLumS-EN9mRaTPAYM3pgQ76To7dM7479YsLhjZcUwOrq6CdLIDnD3JoDAeJZhXJIVyKAx88JA8y2dUBDbUz_OOrTJVLm5_FqT9kVycc4ibHAOQK8yGbdXPXM_ACUufUTr7pEusTxuICwyRnI/o21jjNSC70Csa5_7HEJdcQA0nOUa0a300MY_U5pN02o)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-9-20', 'uscita', 6.00, 'Campagna Ads Locanda da Toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    '2024-09-20T08-43 Transazione #8008998879211194-8024835277627560.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/bIK4J-SAOBfw8Z-X7ThwkA/svsd1Wg6NwpivTbYDh_zae-GjbxArj-_SOxsNRGH8E85hNDxloLv7Y5y19It4uBC3d3oZx9i9Q4YwMG_OqsNnmytPL-8cWL1eVdJgQ_FdpgQcXq8VfD-7WT3-vBsESEDYg-adB4yRCEnL26Ah_P8Dgb_elLkSTnlI_PlfLShFs8NGbHvHR-4QRMZVY8UyXilX8qlrcDjsV9jnuwavmhlqrwuqDWr1m8AJRm6HkVIJ6w/86kZC7lIvy1ibBG5TDNxvuLVoSkLfcziIJACYPTrIdU)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-9-20', 'uscita', 8.00, 'Campagna Ads Locanda da Toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    '2024-09-20T19-19 Transazione #8172414532869634-8028780817233006.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/Owew6EYP8YVm1JAP6JT4kg/Sy5huG-hjWXQJFBj3ZQYLJDjDkgu_JL8cXSVA8Vj_4889axl3NBtGhBhYcku8rLWS0L3f8F8Vw_YP1uSjisdM8f-Wcm1MPBUibzTCAiIGcbnBeiE10c5E5mpKqdIBSrmTz4wZd3SqWxkXYOvkri7ybZTHekXLnqk6esiE82UPM4SNnLGnfrXDXGsiBADhIzkBtm0WPsH2cfTgtFS08z-eDpWjqR5yD3syswSt8dy9CU/ZbSb-X9SBgLx5JndFfE_2h6i5xsgFOcr0__rGr89CG4)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-9-21', 'uscita', 8.00, 'Campagna Ads Locanda da Toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    '2024-09-21T09-57 Transazione #8019347091509707-8034672703310484.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/V7yhl1EMt26yPCjLYPLgqg/Dj0L9lOwSeQrj9Wsn-ldYLOIogvJUfoekgJiYSEeoA4wTG40gPJutr7fMnjZ278IIPaGqg-DBN1Gn6fOfMmkeS6ALWxySBPpngrJxRIDxGRsfDmzzE9esTp0pziJjPktch8SqvJsHjEuzeDjYNNPE9Vcei56DflpKpwZkhpz_n-YBIGtQDDIaHDFaXjNJ5j8jpVvW4xxXshasX3IOTnC8wzSpBOqEfm11uJUHZUEado/1k4141bf03AVD_jgwdGf6sb2DTeaHkEvjxwGhqlFg4I)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-9-21', 'uscita', 8.00, 'Campagna Ads Locanda da Toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    '2024-09-21T20-04 Transazione #8094795870631497-8182099468567807.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/meOxxoT4oWeyCDWn9l0FHA/r-l2q2J7HCxSa5WgCoh9XW8Lidm5oDjn7VUAP8L_sGNybuC6NYHigGviNYxMz0qVWpT9Op6US3vO5DganWAO6HChNh0sohB8maQfbCAKT0-vIMoLOBq3KUNfjGHeuhkZ79i3aYwCitWldYgcNDT-uw_UzHj71dsvsDir00Z7c0vCpEFoMbMmxj4r3M_wfEv6EbIFeSiv_DZx-ARc1e0DA-ipYgofXCjXFuFDNRXOpHQ/Kd2oMXGQ-gXWaM1O1LjincJ1hXY5zViDtsaVAYzWp3E)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-9-22', 'uscita', 8.00, 'Campagna Ads Locanda da Toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    '2024-09-22T09-56 Transazione #8028229820621433-7929676453810108.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/QZgmbra3N67UvgcP5_J-Sg/rZttgajqLZQ_qMDzzJaeVS6Xph9cPcy9uKj92Z2REBezLcxVlV0wHAdnyKCR7WBIKbn-4IAqi5dBVULZM1uDNodPIQDfe5A273TTOEvsBtwPyOQ-lTEUmbCEb66_d712lMHKgAVePNIHBT40_Uj55p1s1-HQ7xrI1eHPWlG0iedzpwukwbmjRe5ES0NhAlrPsaJM-Ze6b471kChKJRq1v4Z5LJXB7w58Z0OcqFSbJMk/MLasJhP64aBlV6RRQSgQo856eZRBPg8bEvmJ7HbsMb0)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-9-22', 'uscita', 9.00, 'Campagna Ads Locanda da Toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    '2024-09-22T19-50 Transazione #8231216830322732-7933071263470627.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/AAVCkoic3r8Yw2DfKV7u1A/WVQjMjt7GhyauXGYEyBCfyajdfxNsaJgcy5hOnhrPi4sWVhrSD3SgfeBeSkukepBQK7wxtUZhuWNqrRivP921ChLFqG9S2mT4OWp_9UfVCuaWL8N-xUzGay8efLyOGBPayoOhxkmgmNQyeHt14w3HwNzQ_aG4ODwFKg0D3r3HNx1d8RaUUpQcVboXYcdJrLOYJFXqWi4zFzyNU-1oRtCYFyDYC4RBfbRJaIECwEkoxc/nkPThHUaErcTZJz2ANfCEp8NpBHXfUpcy6N4tInkRms)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-9-23', 'uscita', 10.00, 'Campagna Ads Locanda da Toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    '2024-09-23T12-57 Transazione #8256809301096824-7939912482786505.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/3Se7ROHyfhWSdGIMP2jpBQ/JjnjpWvgK2VkO7n_aUJylkZifZSno9E0MKAEWHtucJ3R-sBHr2aS3dXm4vKT6kSQLUv59JGeLAqo1jfNGJBz-jo2vdZHakldcGIGXfGgltYyMc6r0hoduzZUdQh9BcqPIcBbQ52tkX7AxeqVIgspRnKtf85UzGiYwiX2ADITk5wEweFTBPmSAXIwYuKTHVC8TDIUzDHHIzndC7jUCfkrWR64RvEkAgAFKrLvBDu6TCU/A9QCryVWDrCQwAiU57b1oYyfM1YTMZe7GPzuWowUIos)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-9-24', 'uscita', 11.00, 'Campagna Ads Locanda da Toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    '2024-09-24T07-06 Transazione #8137317523046000-8137317529712666.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/18bXNULdAR9Q_cAYspTFpg/Kd_EpXiNFOXpM48vL1RGXBCOEDHhpIAphMH4UZD5T3g6Jo2kSkNoSkbDPmoYRF2CRNqWBjLfghenRJqaEiN9cw9h1SlZjlI8docMdC8A4_kNpU6nXwNOdRFHpR2AwQS-sT16QQeLIXkzId1qenNSnfhxM-JQGIlrReT5xkxZofal0ojZgPRRiCZ4tEPJ9KzgMw3-aWeOZjER_i23XTzTk14szLbjVryOu3pJDKRN6Q0/2MnZbOVmUowjwAaYd69pFL4CuwvVfkJig1wyyZ4lhmw)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-9-30', 'uscita', 0.20, 'Spese conto bancario - canone mensile SETTEMBRE',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-9-30', 'uscita', 25.10, 'Imposta di bollo e/c e rendiconto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Spese bancarie' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Spese bancarie' LIMIT 1),
    NULL, NULL,
    'Spese bancarie', NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-10-2', 'entrata', 1677.50, 'Saldo fattura n. 13/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Aqua' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Aqua' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '24-13' OR invoice_number = '24/13' LIMIT 1), NULL,
    'Aqua', '24-13', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-10-7', 'uscita', 750.88, 'Saldo Fattura 14/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Spinetti Simone' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Spinetti Simone' LIMIT 1),
    NULL, NULL,
    'Spinetti Simone', NULL, 'Simone Spinetti 24-14',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-10-7', 'uscita', 255.00, 'Saldo Fattura n. 24/12',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Bignone Wiliam' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Bignone Wiliam' LIMIT 1),
    NULL, NULL,
    'Bignone Wiliam', NULL, 'William Bignone 24-12',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-10-17', 'uscita', 3.99, 'Campagna Ads Locanda da Toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    '2024-10-17T10-04 Transazione #8269628796481539-8252042144906865.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/YYfKrUUuI3KMXvpOMIk_HQ/mY3KxnVTxNw1znXDxgENjcEyrwcGN_rBtIhGcxKEi_BUEUt23crTVimJ4T5szcy_nIexy-xr8W-diwCMfqboe0paFBtBtF6Mk47Ftyc8bg6PpEl6tXlzv4cm-b1p6qLJzsoHah-rRb21w44sTAb4RFNwfgfUn4CIPLRRTamCfg9xu1TJiWyUm8aobxTHyXKO_BOKYqptmcyPya7pX2WFF_0S5SGSQv3xG9Sk9icPlvI/tX343SYvH8eZJ1_oO_WE8L39eOx6MsCSJ7JvcoKiWqM)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-10-18', 'uscita', 8.99, 'Abbonamento mensile workspace',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Google' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Google' LIMIT 1),
    NULL, NULL,
    'Google', NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-10-24', 'entrata', 3300.00, 'Saldo fattura n. 14/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Ordine degli Ingegneri' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Ordine degli Ingegneri' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '24-14' OR invoice_number = '24/14' LIMIT 1), NULL,
    'Ordine degli Ingegneri', '24-14', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-10-31', 'uscita', 0.20, 'Spese conto bancario - canone mensile OTTOBRE',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-11-12', 'uscita', 200.00, 'Saldo fattura 14/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Leyla El Aribi' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Leyla El Aribi' LIMIT 1),
    NULL, NULL,
    'Leyla El Aribi', NULL, 'Leyla El Abiri 14/24',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-11-13', 'uscita', 686.40, 'Saldo fattura 26/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Paolo Dondero' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Paolo Dondero' LIMIT 1),
    NULL, NULL,
    'Paolo Dondero', NULL, 'Studio Dondero 26/24',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-11-13', 'uscita', 42.00, 'Prelievo per acquisto bolli per convenzione Unige',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-11-14', 'entrata', 1250.00, 'Saldo fattura n.24/12',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Fabio Gilardi' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Fabio Gilardi' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '24-12' OR invoice_number = '24/12' LIMIT 1), NULL,
    'Fabio Gilardi', '24-12', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-11-15', 'uscita', 3025.23, 'Versamento IVA Q3',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento F24' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    'F24_DOCUMENTO12112024.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/dtTTuwiZ-oeiUskjAAN_cQ/toMDSN5AOEYpszCOqkijYnIgOo2kHoxBS3vxM0f0xw7uDAgoUh24dM3dGiM2_WYIvUFpLzDmmexN7V6jQpXmU97GlLh0hvF15YkZTRR9Z3lsgocaxFEGkJCEz-GdF3rlhEtFxIoovcYxWIM9TjKGKkwxH2JKYL6O823BBhEPwBA/Uip3fI38FmN3yY51f9RPKxxtsefTQ9ucmF2PDFKfp88)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-11-18', 'uscita', 8.99, 'Abbonamento mensile workspace',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Google' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Google' LIMIT 1),
    NULL, NULL,
    'Google', NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-11-27', 'uscita', 552.00, 'Saldo fattura n. 24/1',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Vela Ricardo' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Vela Ricardo' LIMIT 1),
    NULL, NULL,
    'Vela Ricardo', NULL, 'Ricardo  Vela  24-1',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-11-30', 'uscita', 0.20, 'Spese conto bancario - canone mensile NOVEMBRE24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-12-2', 'uscita', 1440.01, 'saldo fattura 4/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Mara Barbero' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Mara Barbero' LIMIT 1),
    NULL, NULL,
    'Mara Barbero', NULL, 'Mara Barbero 4/24',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-12-3', 'entrata', 915.00, 'saldo fattura n.8/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Ausind' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Ausind' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '24-8' OR invoice_number = '24/8' LIMIT 1), NULL,
    'Ausind', '24-8', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-12-3', 'uscita', 1464.25, 'Acquisto annuale softr',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Softr' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Softr' LIMIT 1),
    NULL, NULL,
    'Softr', NULL, 'Softr Platforms GmbH 53C48C670002',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-12-10', 'uscita', 470.00, 'Saldo Fattura n. 24/2',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Gommellini Martina' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Gommellini Martina' LIMIT 1),
    NULL, NULL,
    'Gommellini Martina', NULL, 'Martina Gommellini 24-2',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-12-23', 'entrata', 1251.00, 'Seconda parte Saldo fattura n.12/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Fabio Gilardi' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Fabio Gilardi' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '24-12' OR invoice_number = '24/12' LIMIT 1), NULL,
    'Fabio Gilardi', '24-12', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-12-23', 'uscita', 92.69, 'Rinnovo domini+hosting locanda da toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'ServerPlan' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'ServerPlan' LIMIT 1),
    NULL, NULL,
    'ServerPlan', NULL, NULL,
    '105374:2024.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/D8P7V0LnKiJQCnrIpKMjXg/MHk8PxsgArRf4-k0HDw8KVR5ou2O3UvEhK0Eayn2elBkA1eE7YU5EJVtrzXF7SZzadn3uyFHsFP_vUGqYjYTHSdJcPpI9xox2Od4zzE7X-vu6Cp_CHpg7xVMDJEjGFh5uSvKvUwv9JpOInALBiP_KywYcmitSppTjQ62Z7MXRAk/FFeQN9zvmwfmPDA5JeMIcfydEup_54npJe-h65DmYIY)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-12-24', 'entrata', 3752.72, 'Saldo Fattura n.11/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Pd Liguria' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Pd Liguria' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '24-11' OR invoice_number = '24/11' LIMIT 1), NULL,
    'Pd Liguria', '24-11', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-12-24', 'uscita', 8.99, 'Abbonamento mensile workspace',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Google' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Google' LIMIT 1),
    NULL, NULL,
    'Google', NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-12-24', 'uscita', 128.00, 'Saldo Ritenuta n.1/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Mattia Montano' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Mattia Montano' LIMIT 1),
    NULL, NULL,
    'Mattia Montano', NULL, 'Mattia Montano 24-1',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-12-24', 'uscita', 150.00, 'Saldo Fattura n. 26/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'William Bignone' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'William Bignone' LIMIT 1),
    NULL, NULL,
    'William Bignone', NULL, 'William Bignone 24-26',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-12-24', 'uscita', 1196.00, 'Saldo Fattura n.3/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Martina Gommellini' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Martina Gommellini' LIMIT 1),
    NULL, NULL,
    'Martina Gommellini', NULL, 'Martina Gommellini 24-3',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-12-30', 'uscita', 13.00, 'Campagna Ads Locanda da Toto ',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    '2024-12-25T06-40 Transazione #8867825823328499-8817080115069736.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/kBZO7GbI2MfI5WXzadkgSQ/O3dY4-hyx1RyMiXo2XOHFwW39NMRUXchV0QpP2co9BMPbT85V-7WV4cFd6Je_0OwSuikes19_Ou-CUSqfBO9pi4h6yl0KqOx22S7sl-gj9G2RPOGfpAA-9culfCIx3aSYg1-x0ukbkfAawqaKwsY2tKJZm1ft5OpSx5vfHzs_tD08Gls8zl9g1WyMRklWwth4YqSYmrgj7n_CSZAv-eUSruKXgMxQpzC0etBCYFqMCs/9CT5dD31ZqRPuxKVy2xj0eBOQCb7T_xBHC7aEannkRE)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-12-30', 'uscita', 13.00, 'Campagna Ads Locanda da Toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    '2024-12-25T17-11 Transazione #8549458381831909-8678151915629223.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/8fGYjVFrITpi0Tg1sUFAAw/cKU70FOfspJkd6cHpD1K3IL_atINO5OrgJGQ-VHzUFKoMo70B9XlIFBosTHpHCGuGkb8kmnH1J_TZw3_8ngB4HJPJ-irV-kMhv21FKYcDIIWK66VONIWTP8bk2yZ0Uo9DAOxBMMo_QCA93iUoSPmocmJKhviTj-2wMHOivmbfZckstXpD2K2ahQy5aniKlQHQCNw1kcP8xyx-izJsyJpRO2JKUS1BESQ6XuLLDedRZQ/5XsNQv3hAeriSafSDRwHNhdrLrhiP1RZb4MsoWNi0z4)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-12-30', 'uscita', 15.00, 'Campagna Ads Locanda da Toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    '2024-12-25T23-26 Transazione #8679509672160114-8724285181015893.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/4nI8zF0AeaQ_FPDM7irFPA/OJKo53U0Cdz5c0HWNfYif9KU0Mkr8fKqvKW2IbltasieJe7NwN7pucvRYGYylXVmn11p5eYRJoXHLSQGi9qX9bzHcJCs3FCPVQHBzHL4AIechc_nZ7yTtTN-h1SR4M6G-1iRduIRHNAC4OxP_qUeqoEI0zSZsv7lD8kMIGmTdaBI6M3LLOy8O771hgKDtSWKcU9JxRxgO-vG6KiyDod2gu0bQMq__oGUwowBC3ERf4c/wr0n8O0G4UgIhPHjTwktxzHv-lLiBjuppiGXzFyVt2U)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-12-31', 'uscita', 17.00, 'Campagna Ads Locanda da Toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    '2024-12-26T16-04 Transazione #8683099861801095-8761385347305878.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/0xqX9TQou5JKA-dONRDcbw/C3IoD8err5Fupmc7Bvidpgpblz1Ip6-DD-vTdWQlrC41JEvEEI1ZVPetYJrE9YQgeBf-Pb0xjEgF-duv_0BIIcke_4Y1RN57mYY69XlHX_RriVvg4vJ-9TZZIcq6uf41cP_mEALcNlQ0InZt72Kq7eJGBJpmzjvq5r90_XEXR3qe-Dk_jNb9B2ZrwcsCNezRuThvTQ9PBUARqbpep3NICPSPGECur3b9F3RKhDUKpPo/4FtP7KTSbKzG26X-3Gy0sR0cB9PHMXLfFF1ofmXoN_A)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-12-31', 'uscita', 19.00, 'Campagna Ads Locanda da Toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    '2024-12-28T13-13 Transazione #8834528949991519-8737643383013406.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/Wb8SvKKZOmSITxCEl0RwuQ/-OgnY_GElx921XbSQOQHi1W0A7VDCPEkSK8IDD6_OqBBlzeYGmi2KPnRddsHkIOIX6zXQmUFKF1PbMHg-qVV2C_LczXW6DX_SIFLFZSn70vCpy6bJio0wRtCwTHpvXDYF1qbRQ6oT4dZE-ORZ8Y_S2Px2QXAfl_7ritRlZ5d-l8-mhdQd4J_gnEB8_mIgbVki-xnQ6sVLNqu2US4rGIIcqmsT7-jMCC_uI_n2dCRyBM/9vPZa6slJdtmabgWVohQcvbv0oIqo2l3SUr20g48JIk)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-12-31', 'uscita', 21.00, 'Campagna Ads Locanda da Toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    '2024-12-28T18-35 Transazione #8681678355276574-8738899902887754.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/BHE_zndemzhQVKWUrIcbyA/3OAR9MHgbKqJBPzc3Eb5Hgkdyf22V8_91nfmqg8J5MOCU5nOoi4DNwGpe1-Wjjme2Pc-L_siPbMpzA9_Epe1jWih5OJrXFqqmSEHhrFSpc0YbQX-0FLr4nmpeikURA19yaAMMuGiIu_WNQMPzm9P7aR5qGiEhPf1pv2E4iwwmolglw6rzCcLDHUe-bn3XioLfXkbFK8-jJr1S59Uda4bL0AxmolQADtMRLw0S83wG-w/c8I85625YpNRMKe5RqR9uIgZ7ptzo5SeM6BNadS2NfQ)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2024-12-31', 'entrata', 3001.20, 'Saldo FAttura n.21/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Transmare' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Transmare' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '24-21' OR invoice_number = '24/21' LIMIT 1), NULL,
    'Transmare', '24-21', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-1-3', 'uscita', 25.10, 'Imposta di bollo e/c e rendiconto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-1-9', 'entrata', 3001.20, 'Saldo Fattura n. 22/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'VERNAZZA AUTOGRU SRL' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'VERNAZZA AUTOGRU SRL' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '24-22' OR invoice_number = '24/22' LIMIT 1), NULL,
    'VERNAZZA AUTOGRU SRL', '24-22', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-1-13', 'uscita', 5.75, 'Abbonamento Mensile',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Notion' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Notion' LIMIT 1),
    NULL, NULL,
    'Notion', NULL, 'Notion in_1QevwLCcKlYJxALVEPddwIcX',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-1-14', 'entrata', 2.44, 'Saldo Fattura n. 2-25',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'TARA BIANCA' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'TARA BIANCA' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '25-2' OR invoice_number = '25/2' LIMIT 1), NULL,
    'TARA BIANCA', '25-2', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-1-15', 'entrata', 4001.60, 'Saldo Fattura n. 20/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Arco Srl' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Arco Srl' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '24-20' OR invoice_number = '24/20' LIMIT 1), NULL,
    'Arco Srl', '24-20', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-1-16', 'entrata', 3300.00, 'Saldo Fattura n. 25/1',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Ordine degli Ingegneri di Genova' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Ordine degli Ingegneri di Genova' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '25-1' OR invoice_number = '25/1' LIMIT 1), NULL,
    'Ordine degli Ingegneri di Genova', '25-1', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-1-16', 'uscita', 32.00, 'Versamento Ritenute d''acconto dicembre 24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento F24' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    '"F24 GLEEYE SRL - 32,00 €.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/5Pgoqy7NHdAY_ylTkejzAQ/Z1U64YkegPRe1SkQeZqol4V2WKUqZtidjgkZI9SzXf9NXkNApfds7R5dz_9eKCONblp7xJsDFZ5G8hHJhRtV9BQ31Cf9e-UtnYUCxKGLjURsQda-pVwh-y9_AjAp_agt6AmRZm0aohe_tBcThqACMPWoqhL9cjhnhuipj-3rlQI/o3NXX0l9gILGd4B1ks7BdwbtfdC45relbLoKJqoS9F0)"'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-1-17', 'uscita', 9.64, 'Rinnovo dominio gleeye.eu',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Keliweb' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Keliweb' LIMIT 1),
    NULL, NULL,
    'Keliweb', NULL, 'Keliweb SRL 2025A-2957',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-1-17', 'uscita', 12.20, 'Spostamento servizi su nuovo account gleeye srl',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Keliweb' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Keliweb' LIMIT 1),
    NULL, NULL,
    'Keliweb', NULL, 'Keliweb SRL 2025A-2941',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-1-17', 'uscita', 106.02, 'Rinnovo spazio hosting sito web gleeye',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Keliweb' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Keliweb' LIMIT 1),
    NULL, NULL,
    'Keliweb', NULL, 'Keliweb SRL 2025A-2955',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-1-21', 'uscita', 2.00, 'Campagna Ads Locanda da Toto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Meta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Meta' LIMIT 1),
    NULL, NULL,
    'Meta', NULL, NULL,
    'Transazione 17 Gen 2025.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/s6Nmn9QnovVAkUCBYcHuvA/AlhGAoVQAfYaUQaEixW4B7Z67FeCB1RIJaV8My7Cdj9EReA7HzmAa-eJNYxhC8wWQ8ZynU6bhCzAb-30R60aLQUXkhLIY39Q7Wi4UZHrZ87fq1qKMoBdD23YmemRj7HBoIz2g9nxx_LOgl5IA7S0KvPvorKnA8r3kgsidJI1MSxaldEeUrq_xOgq2Gvq3cHF/9OmGWWuoP79rJV9FWionFxNjwqzBhhGqTxjKruMh_mk)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-1-21', 'uscita', 8.99, 'Abbonamento mensile Workspace',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Google' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Google' LIMIT 1),
    NULL, NULL,
    'Google', NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-1-31', 'uscita', 0.20, 'Spese bancarie - canone gennaio25',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-2-11', 'uscita', 5.75, 'Abbonamento mensile Notion',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Notion' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Notion' LIMIT 1),
    NULL, NULL,
    'Notion', NULL, 'Notion in_1QqAj7CcKlYJxALVkmEfxgVf',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-2-17', 'uscita', 1.00, 'Commissione disposizione di bonifico
Bonifico da voi disposto a favore di: beneficiari diversi - Commissioni bs200235045438817919999xe notprovided',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-2-17', 'uscita', 158.45, 'Versamento ritenute d''acconto GENNAIO25',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento F24' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-2-17', 'uscita', 488.00, 'Affitto ufficio MARZO25',
    (SELECT id FROM public.transaction_categories WHERE name = 'Affitto' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Workspace Italia' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Workspace Italia' LIMIT 1),
    NULL, NULL,
    'Workspace Italia', NULL, 'WorkSpace Italy 25-22',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-2-21', 'uscita', 8.99, 'Abbonamento mensile Workspace',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Google' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Google' LIMIT 1),
    NULL, NULL,
    'Google', NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-2-28', 'uscita', 0.20, 'Spese bancarie - canone febbraio25',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-3-3', 'entrata', 634.40, 'Saldo Fattura n.16/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Ausind' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Ausind' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '24-16' OR invoice_number = '24/16' LIMIT 1), NULL,
    'Ausind', '24-16', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-3-10', 'uscita', 309.87, 'TASSA ANNUALE LIBRI SOCIALI ',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento F24' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-3-10', 'uscita', 5.14, 'Acquisto domini per mail outreach',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Namecheap' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Namecheap' LIMIT 1),
    NULL, NULL,
    'Namecheap', NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-3-11', 'uscita', 1332.00, 'Saldo fattura n.2/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Gabriele Picone' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Gabriele Picone' LIMIT 1),
    NULL, NULL,
    'Gabriele Picone', NULL, 'Gabriele Picone 2-25',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-3-11', 'uscita', 686.40, 'Tenuta contabilita e chiusura iva terzo trimestre 2024',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Paolo Dondero' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Paolo Dondero' LIMIT 1),
    NULL, NULL,
    'Paolo Dondero', NULL, 'Studio Dondero 44/24',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-3-11', 'uscita', 5.75, 'Abbonamento mensile Notion',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Notion' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Notion' LIMIT 1),
    NULL, NULL,
    'Notion', NULL, 'Notion in_1R0K3qCcKlYJxALVJKLrjPOH',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-3-11', 'uscita', 1.00, 'Commissione disposizione di bonifico',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-3-11', 'uscita', 1.00, 'Commissione disposizione di bonifico',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-3-12', 'entrata', 1.68, 'Saldo fattura n.19/24',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Aqua' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Aqua' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '24-19' OR invoice_number = '24/19' LIMIT 1), NULL,
    'Aqua', '24-19', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-3-14', 'uscita', 2431.98, 'Versamento iva 4 trim',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento F24' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-3-14', 'uscita', 17.30, 'Copie chiavi ufficio',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-3-21', 'uscita', 8.99, 'Abbonamento mensile Google Workspace',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Google' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Google' LIMIT 1),
    NULL, NULL,
    'Google', NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-4-2', 'uscita', 0.20, 'Canone mensile base e servizi aggiuntivi',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-4-3', 'uscita', 24.70, 'Imposta di bollo e/c e rendiconto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-4-8', 'uscita', 1920.00, 'Saldo fattura 1/4/2024',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'SARA VERTERANO' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'SARA VERTERANO' LIMIT 1),
    NULL, NULL,
    'SARA VERTERANO', NULL, 'Sara Verterano 24-12',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-4-8', 'uscita', 200.00, 'Saldo fattura n.1/25',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'ALESSIO URSIDA' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'ALESSIO URSIDA' LIMIT 1),
    NULL, NULL,
    'ALESSIO URSIDA', NULL, 'Alessio Ursida 25-1',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-4-8', 'uscita', 602.00, 'Saldo fattura n. 25/2',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'LUCA DESPINI' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'LUCA DESPINI' LIMIT 1),
    NULL, NULL,
    'LUCA DESPINI', NULL, 'Luca Despini 25-2',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-4-8', 'uscita', 488.00, 'Affitto ufficio APRILE25',
    (SELECT id FROM public.transaction_categories WHERE name = 'Affitto' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Workspace Italia' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Workspace Italia' LIMIT 1),
    NULL, NULL,
    'Workspace Italia', NULL, 'WorkSpace Italy 25-41',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-4-8', 'uscita', 686.40, ' Tenuta contabilità e chiusura iva quarto trimestre 2024',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'DONDERO' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'DONDERO' LIMIT 1),
    NULL, NULL,
    'DONDERO', NULL, 'Studio Dondero 25-17',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-4-8', 'uscita', 1.00, 'COMMISSIONE BONIFICO',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-4-8', 'uscita', 1.00, 'COMMISSIONE BONIFICO',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-4-8', 'uscita', 1.00, 'COMMISSIONE BONIFICO',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-4-8', 'uscita', 1.00, 'COMMISSIONE BONIFICO',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-4-8', 'uscita', 1.00, 'COMMISSIONE BONIFICO',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-4-9', 'entrata', 3.30, 'Saldo fattura n.3/25',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Ordine degli Ingegneri di Genova' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Ordine degli Ingegneri di Genova' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '25-3' OR invoice_number = '25/3' LIMIT 1), NULL,
    'Ordine degli Ingegneri di Genova', '25-3', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-4-11', 'uscita', 11.50, 'Abbonamento mensile',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Notion' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Notion' LIMIT 1),
    NULL, NULL,
    'Notion', NULL, 'Notion in_1RBYq5CcKlYJxALV6gq1j6xE',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-4-22', 'uscita', 434.00, 'Abbonamento annuale Airtable',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Airtable' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Airtable' LIMIT 1),
    NULL, NULL,
    'Airtable', NULL, 'Airtable 2A62818B0002',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-4-22', 'uscita', 97.65, 'Abbonamento annuale',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Make.com' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Make.com' LIMIT 1),
    NULL, NULL,
    'Make.com', NULL, 'Make.com 270DF76E0002',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-4-23', 'uscita', 8.99, 'Abbonamento mensile workspace',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Google' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Google' LIMIT 1),
    NULL, NULL,
    'Google', NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-4-30', 'uscita', 0.20, 'Canone mensile base e servizi aggiuntivi',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-5-2', 'uscita', 164.70, 'Abbonamento 12 mesi Brevo per OIGE',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Brevo' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Brevo' LIMIT 1),
    NULL, NULL,
    'Brevo', NULL, 'Brevo SIB-3060991',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-5-6', 'uscita', 298.83, 'Acquisto plugin Amelia',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'TMS Plugins' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'TMS Plugins' LIMIT 1),
    NULL, NULL,
    'TMS Plugins', NULL, 'TMS Plugins 71861137',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-5-12', 'uscita', 1440.01, 'Saldo fattura n. 25-1',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Mara Barbero' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Mara Barbero' LIMIT 1),
    NULL, NULL,
    'Mara Barbero', NULL, 'Mara Barbero 25-1',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-5-12', 'uscita', 243.35, 'Versamento IVA Q1-25',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento F24' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-5-12', 'uscita', 130.00, 'Saldo fattura n. 25-1',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'RALUCA GHEBENEI' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'RALUCA GHEBENEI' LIMIT 1),
    NULL, NULL,
    'RALUCA GHEBENEI', NULL, 'Raluca Ghebenei 25-1',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-5-12', 'uscita', 1.00, 'Commissione disposizione di bonifico',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-5-12', 'uscita', 1.00, 'Commissione disposizione di bonifico',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-5-13', 'uscita', 11.50, 'Abbonamento mensile',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Notion' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Notion' LIMIT 1),
    NULL, NULL,
    'Notion', NULL, 'Notion in_1RMR8vCcKlYJxALVXbNhB1yY',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-5-20', 'entrata', 1464.00, 'Saldo fattura n. 25-6',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Fanimar' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Fanimar' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '25-6' OR invoice_number = '25/6' LIMIT 1), NULL,
    'Fanimar', '25-6', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-5-21', 'uscita', 8.99, 'Abbonamento mensile',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Google' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Google' LIMIT 1),
    NULL, NULL,
    'Google', NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-5-22', 'uscita', 488.00, 'Affitto MAGGIO25',
    (SELECT id FROM public.transaction_categories WHERE name = 'Affitto' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Workspace Italia' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Workspace Italia' LIMIT 1),
    NULL, NULL,
    'Workspace Italia', NULL, 'WorkSpace Italy 25-62',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-5-22', 'uscita', 1.00, 'Commissione disposizione di bonifico',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-5-23', 'entrata', 1037.00, 'Saldo fattura n. 24-18',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'EdilPorta' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'EdilPorta' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '24-18' OR invoice_number = '24/18' LIMIT 1), NULL,
    'EdilPorta', '24-18', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-5-23', 'entrata', 1677.50, 'Saldo fattura n. 25-5',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Aqua' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Aqua' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '25-5' OR invoice_number = '25/5' LIMIT 1), NULL,
    'Aqua', '25-5', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-5-27', 'uscita', 232.00, 'Registrazione del verbale bilancio 2024 presso AdE + bolli',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento F24' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-5-31', 'uscita', 0.20, 'Canone mensile base e servizi aggiuntivi
',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-6-3', 'uscita', 99.55, 'Abbonamento annuale Vimeo',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Vimeo' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Vimeo' LIMIT 1),
    NULL, NULL,
    'Vimeo', NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-6-4', 'entrata', 3660.00, 'Saldo Fattura n. 25-4',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'TARA BIANCA' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'TARA BIANCA' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '25-4' OR invoice_number = '25/4' LIMIT 1), NULL,
    'TARA BIANCA', '25-4', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-6-4', 'uscita', 59.88, 'Abbonamento annuale',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Iubenda' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Iubenda' LIMIT 1),
    NULL, NULL,
    'Iubenda', NULL, 'Iubenda 2025-160829',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-6-10', 'uscita', 92.72, 'rinnovo sito pd liguria?',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'ServerPlan' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'ServerPlan' LIMIT 1),
    NULL, NULL,
    'ServerPlan', NULL, NULL,
    '51794_3-6-2025.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/RaCXDI-FvsHKxau4FsKiXA/buS6kaHvwi0PbQfk7qgIIrTo4yx4UIjDJWBDq_rmDFpUd8DiteXUlQLRGCihUKLJDOMxIBNUEqBlV7rBML7LEVXQSD2yqctHiLPHW9u83cPdUmxEH6sWiuUKvPILCCx-m1pCn5AbvuzuubWhL8RfVMF1C0AamTq-NYLabcsPJAw/2ETWydhxF4i4nMKg6HjCJJlojiqn2dN9KsYmh_26kCA)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-6-11', 'uscita', 11.50, 'Abbonamento mensile',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Notion' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Notion' LIMIT 1),
    NULL, NULL,
    'Notion', NULL, 'Notion in_1RXfuSCcKlYJxALVlORrPM85',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-6-17', 'uscita', 2294.26, 'Acquisto Mac Studio',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Apple' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Apple' LIMIT 1),
    NULL, NULL,
    'Apple', NULL, 'Apple UA23130226',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-6-17', 'uscita', 31.72, 'Rinnovo per Aqua dominio aquaesteticaebenessere.it',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento per conto cliente' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Serveplan' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Serveplan' LIMIT 1),
    NULL, NULL,
    'Serveplan', NULL, NULL,
    '53950_10-6-2025.pdf (https://v5.airtableusercontent.com/v3/u/48/48/1767571200000/Tia0t3-Mv_vP42a9_w_JkQ/CZ2Jiirgo33XBlwB1Gmxs7dq1pDKmK5Pt4uSweRv4fIwIcKrK682-s0EW8vSbHH9uhtQFkqw7HqzM8dvURq470kt7u9Lz-yq-MhOB8syjbWkHSUdnpywbEJxs2Q_u2pVK3G1hTvJ7BUL4vceDOhYi42XKNC8wFqhJMsB_NFnBPY/NnDAACQRvisS_D_xucQ8g6n0cHj267eW97Sv6soAFXI)'
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-6-17', 'uscita', 686.40, 'Tenuta contabilità e chiusura iva primo trimestre 2025',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Dondero' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Dondero' LIMIT 1),
    NULL, NULL,
    'Dondero', NULL, 'Studio Dondero 25-29',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-6-18', 'uscita', 553.28, 'Saldo fattura n. 25-9',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Simone Spinetti' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Simone Spinetti' LIMIT 1),
    NULL, NULL,
    'Simone Spinetti', NULL, 'Simone Spinetti 25-9',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-6-18', 'uscita', 488.00, 'Affitto GIUGNO25',
    (SELECT id FROM public.transaction_categories WHERE name = 'Affitto' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Workspace Italy' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Workspace Italy' LIMIT 1),
    NULL, NULL,
    'Workspace Italy', NULL, 'WorkSpace Italy 77/2025',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-6-18', 'uscita', 210.08, 'Saldo fattura n. 25-7',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Mattia Montano' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Mattia Montano' LIMIT 1),
    NULL, NULL,
    'Mattia Montano', NULL, 'Mattia Montano 25-7',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-6-18', 'uscita', 105.00, 'Saldo fattura n.  13-25',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'William Bignone' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'William Bignone' LIMIT 1),
    NULL, NULL,
    'William Bignone', NULL, 'William Bignone 25-13',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-6-18', 'uscita', 5.00, 'Commissione disposizione di n. 5 bonifici',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-6-24', 'entrata', 838.75, 'Saldo fattura',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Aqua' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Aqua' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '25-14' OR invoice_number = '25/14' LIMIT 1), NULL,
    'Aqua', '25-14', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-6-26', 'uscita', 370.30, 'Acquisto Booknetic',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Booknetic' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Booknetic' LIMIT 1),
    NULL, NULL,
    'Booknetic', NULL, 'Booknetic 73114686',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-6-30', 'uscita', 0.20, 'Canone mensile base e servizi aggiuntivi',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-7-3', 'uscita', 24.90, 'Imposta di bollo e/c e rendiconto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-7-7', 'uscita', 120.00, 'Saldo Ritenuta',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'PAOLO FERRETTI' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'PAOLO FERRETTI' LIMIT 1),
    NULL, NULL,
    'PAOLO FERRETTI', NULL, 'Paolo Ferretti 25-1',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-7-7', 'uscita', 1.00, 'Commissione disposizione di bonifico',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-7-8', 'uscita', 488.00, 'Affitto luglio',
    (SELECT id FROM public.transaction_categories WHERE name = 'Affitto' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Workspace Italy' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Workspace Italy' LIMIT 1),
    NULL, NULL,
    'Workspace Italy', NULL, 'WorkSpace Italy 25-84',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-7-8', 'uscita', 1.00, 'Commissione disposizione di bonifico',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-7-9', 'entrata', 2750.00, 'Saldo fattura 25/12',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'CNR IMATI' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'CNR IMATI' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '25-12' OR invoice_number = '25/12' LIMIT 1), NULL,
    'CNR IMATI', '25-12', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-7-11', 'uscita', 11.50, 'Abbonamento mensile',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Notion' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Notion' LIMIT 1),
    NULL, NULL,
    'Notion', NULL, 'Notion in_1RiYD6CcKlYJxALVuImhq6KL',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-7-11', 'entrata', 3300.00, 'Saldo fattura 25/13',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Ordine Ingegneri Genova' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Ordine Ingegneri Genova' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '25-13' OR invoice_number = '25/13' LIMIT 1), NULL,
    'Ordine Ingegneri Genova', '25-13', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-7-15', 'uscita', 1440.01, 'Saldo fattura 25/3',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'MARA BARBERO' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'MARA BARBERO' LIMIT 1),
    NULL, NULL,
    'MARA BARBERO', NULL, 'Mara Barbero 25-3',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-7-15', 'uscita', 292.60, 'Saldo fattura n. 25/2',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'RALUCA GHEBENEI' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'RALUCA GHEBENEI' LIMIT 1),
    NULL, NULL,
    'RALUCA GHEBENEI', NULL, 'Raluca Ghebenei 2025-2',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-7-15', 'uscita', 2.00, 'Commissione disposizione di bonifico',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-7-16', 'uscita', 11536.50, 'DIVISIONE QUOTE UTILI 2024',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'DAVIDE GENTILE' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'DAVIDE GENTILE' LIMIT 1),
    NULL, NULL,
    'DAVIDE GENTILE', NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-7-16', 'uscita', 2.80, 'SALDO FATTURA 18/6/25',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'SARA VERTERANO' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'SARA VERTERANO' LIMIT 1),
    NULL, NULL,
    'SARA VERTERANO', NULL, 'Sara Verterano 25-180625',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-7-16', 'uscita', 472.16, 'Saldo fatture 25-10 e 25-11',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'MATTIA MONTANO' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'MATTIA MONTANO' LIMIT 1),
    NULL, NULL,
    'MATTIA MONTANO', NULL, 'Mattia Montano 10-2025,Mattia Montano 20251 - 11',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-7-16', 'uscita', 444.08, 'Saldo fattura n. 25-10',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'SIMONE SPINETTI' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'SIMONE SPINETTI' LIMIT 1),
    NULL, NULL,
    'SIMONE SPINETTI', NULL, 'Simone Spinetti 25-10',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-7-16', 'uscita', 4.00, 'Commissione disposizione di bonifico',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-7-21', 'uscita', 1578.00, 'IRAP',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento F24' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-7-23', 'entrata', 2440.00, 'Saldo fattura n.25/10',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'TARA BIANCA' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'TARA BIANCA' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '25-10' OR invoice_number = '25/10' LIMIT 1), NULL,
    'TARA BIANCA', '25-10', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-7-23', 'entrata', 838.75, 'Saldo fattura n.25/17',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'AQUA' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'AQUA' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '25-17' OR invoice_number = '25/17' LIMIT 1), NULL,
    'AQUA', '25-17', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-7-23', 'uscita', 17.99, 'Spesa personale Davide',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-7-28', 'uscita', 262.06, 'Estensione Calendario Amelia',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'TMS PLUGIN' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'TMS PLUGIN' LIMIT 1),
    NULL, NULL,
    'TMS PLUGIN', NULL, 'TMS Plugins 71861137',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-8-1', 'entrata', 10980.00, 'Saldo fattura n. 25-15',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'START 4.0' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'START 4.0' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '25-15' OR invoice_number = '25/15' LIMIT 1), NULL,
    'START 4.0', '25-15', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-8-4', 'uscita', 0.20, 'Canone mensile base e servizi aggiuntivi',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-8-6', 'uscita', 40.25, 'Spesa personale Davide',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-8-12', 'uscita', 648.00, 'Abbonamento annuale Dropbox',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Dropbox' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Dropbox' LIMIT 1),
    NULL, NULL,
    'Dropbox', NULL, 'Dropbox  8778WKVGGYJ6',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-8-12', 'uscita', 11.50, 'Abbonamento mensile',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Notion' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Notion' LIMIT 1),
    NULL, NULL,
    'Notion', NULL, 'Notion in_1RtmyuCcKlYJxALVIZrMTSXB',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-8-12', 'uscita', 8.99, 'Plugin finalcut sottotitoli',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Apple' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Apple' LIMIT 1),
    NULL, NULL,
    'Apple', NULL, 'Apple 814005973197',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-8-14', 'uscita', 59.99, 'Acquisto Apple Motion',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Apple' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Apple' LIMIT 1),
    NULL, NULL,
    'Apple', NULL, 'Apple 814005973196',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-8-20', 'uscita', 2216.65, 'Versamento IVA Q2',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento F24' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-8-20', 'uscita', 30.00, 'Versamento ritenute luglio',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento F24' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-8-31', 'uscita', 0.20, 'Canone mensile base e servizi aggiuntivi',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-9-4', 'entrata', 916.00, 'Saldo fattura n.11/25',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Ausind' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Ausind' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '25-11' OR invoice_number = '25/11' LIMIT 1), NULL,
    'Ausind', '25-11', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-9-11', 'uscita', 11.50, 'Abbonamento mensile',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Notion' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Notion' LIMIT 1),
    NULL, NULL,
    'Notion', NULL, 'Notion in_1S51lHCcKlYJxALVOCNoO6np',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-9-16', 'uscita', 686.40, 'Tenuta contabilità e chiusura iva secondo trimestre 2025

',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Dondero' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Dondero' LIMIT 1),
    NULL, NULL,
    'Dondero', NULL, 'Studio Dondero 2025-45',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-9-16', 'uscita', 602.00, 'Saldo fattura n. 3-Gly/2025',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Gabriele Picone' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Gabriele Picone' LIMIT 1),
    NULL, NULL,
    'Gabriele Picone', NULL, 'Gabriele Picone 3-GLY/2025',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-9-16', 'uscita', 438.88, 'Saldo fattura n. 16/25',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Mattia Montano' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Mattia Montano' LIMIT 1),
    NULL, NULL,
    'Mattia Montano', NULL, 'Mattia Montano 25-16',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-9-16', 'uscita', 180.00, 'Saldo fattura n. 21/25',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'William Bignone' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'William Bignone' LIMIT 1),
    NULL, NULL,
    'William Bignone', NULL, 'William Bignone 25-21',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-9-16', 'uscita', 4.00, 'Commissioni disposizione di bonifico',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-9-30', 'entrata', 915.00, 'Saldo fattura n. 25/16',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Ausind' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Ausind' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '25-16' OR invoice_number = '25/16' LIMIT 1), NULL,
    'Ausind', '25-16', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-10-1', 'uscita', 0.20, 'Canone mensile base e servizi aggiuntivi',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-10-3', 'uscita', 25.20, 'Imposta di bollo e/c e rendiconto',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-10-6', 'uscita', 11536.50, 'DIVISIONE QUOTE UTILI 2024',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'ANDREA VISENTIN' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'ANDREA VISENTIN' LIMIT 1),
    NULL, NULL,
    'ANDREA VISENTIN', NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-10-6', 'uscita', 1.00, 'Commissione disposizione di bonifico',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-10-13', 'uscita', 11.50, 'Abbonamento mensile',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Notion' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Notion' LIMIT 1),
    NULL, NULL,
    'Notion', NULL, 'Notion in_1SFu3KCcKlYJxALVFl4V4xEB',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-10-16', 'uscita', 225.00, 'Saldo ritenuta settembre25',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'PAOLO FERRETTI' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'PAOLO FERRETTI' LIMIT 1),
    NULL, NULL,
    'PAOLO FERRETTI', NULL, 'Paolo Ferretti 25-2',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-10-16', 'uscita', 1.00, 'Commissione disposizione di bonifico',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-10-20', 'uscita', 288.00, 'Abbonamento annuale',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Riverside Fm' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Riverside Fm' LIMIT 1),
    NULL, NULL,
    'Riverside Fm', NULL, '"""RiversideFM, Inc."" F7AMUWSD-0002"',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-10-23', 'entrata', 3300.00, 'Saldo Fattura n. 25-22',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Ordine Ingegneri Genova' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Ordine Ingegneri Genova' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '25-22' OR invoice_number = '25/22' LIMIT 1), NULL,
    'Ordine Ingegneri Genova', '25-22', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-10-31', 'uscita', 0.20, 'Canone mensile base e servizi aggiuntivi',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-11-4', 'entrata', 3355.00, 'Saldo fattura n.25/23',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'PRESSCOM TECH' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'PRESSCOM TECH' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '25-23' OR invoice_number = '25/23' LIMIT 1), NULL,
    'PRESSCOM TECH', '25-23', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-11-11', 'uscita', 11.50, 'Abbonamento mensile',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Notion' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Notion' LIMIT 1),
    NULL, NULL,
    'Notion', NULL, 'Notion in_1SR8q0CcKlYJxALVG9AKhzbU',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-11-12', 'uscita', 956.80, 'Saldo fatture n. 3-4/25',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'RALUCA GHEBENEI' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'RALUCA GHEBENEI' LIMIT 1),
    NULL, NULL,
    'RALUCA GHEBENEI', NULL, 'Raluca Ghebenei 25-3,Raluca Ghebenei 25-4',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-11-12', 'uscita', 1440.01, 'Saldo fattura n. 4/25',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'MARA BARBERO' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'MARA BARBERO' LIMIT 1),
    NULL, NULL,
    'MARA BARBERO', NULL, 'Mara Barbero 25-4',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-11-12', 'uscita', 2.00, 'Commissione disposizione di bonifico',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-11-13', 'uscita', 197.64, 'Abbonamento newsletter Andre',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Sendinblue' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Sendinblue' LIMIT 1),
    NULL, NULL,
    'Sendinblue', NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-11-13', 'uscita', 795.00, 'Saldo fattura n. 27-28/25',
    (SELECT id FROM public.transaction_categories WHERE name = 'Collaboratori' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'William Bignone' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'William Bignone' LIMIT 1),
    NULL, NULL,
    'William Bignone', NULL, 'William Bignone 25-27,William Bignone 25-28',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-11-13', 'uscita', 2111.20, 'Saldo competenze 2024',
    (SELECT id FROM public.transaction_categories WHERE name = 'Abbonamento servizi' AND type = 'uscita' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Dondero' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Dondero' LIMIT 1),
    NULL, NULL,
    'Dondero', NULL, 'Studio Dondero 25-74',
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-11-13', 'uscita', 2.00, 'Commissione disposizione di bonifico',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-11-17', 'uscita', 45.00, 'F24 Ritenute d''acconto ottobre',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-11-17', 'uscita', 2376.45, 'Versamento IVA III trim 2025',
    (SELECT id FROM public.transaction_categories WHERE name = 'Pagamento F24' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-11-25', 'entrata', 1525.00, 'Saldo fattura n. 24/25',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Aiga' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Aiga' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '25-24' OR invoice_number = '25/24' LIMIT 1), NULL,
    'Aiga', '25-24', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-11-26', 'entrata', 1525.00, 'Saldo fattura n. 25/27',
    (SELECT id FROM public.transaction_categories WHERE name = 'Entrata Generica' AND type = 'entrata' LIMIT 1), (SELECT id FROM public.clients WHERE name ILIKE 'Irida srl' LIMIT 1), (SELECT id FROM public.suppliers WHERE name ILIKE 'Irida srl' LIMIT 1),
    (SELECT id FROM public.invoices WHERE invoice_number = '25-27' OR invoice_number = '25/27' LIMIT 1), NULL,
    'Irida srl', '25-27', NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;

INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    NULL, '2025-11-30', 'uscita', 2.00, 'Canone mensile base e servizi aggiuntivi',
    (SELECT id FROM public.transaction_categories WHERE name = 'Uscita Generica' AND type = 'uscita' LIMIT 1), NULL, NULL,
    NULL, NULL,
    NULL, NULL, NULL,
    NULL
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;
