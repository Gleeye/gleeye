ALTER TABLE pm_items ADD COLUMN IF NOT EXISTS is_account_level BOOLEAN DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS is_account_level BOOLEAN DEFAULT false;
