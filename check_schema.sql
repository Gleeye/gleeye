SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'payments';
SELECT id, counterparty_name, description, collaborator_id FROM bank_transactions WHERE status = 'pending' LIMIT 5;
