-- Add missing column for assignment duration
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS contract_duration_months INTEGER DEFAULT 12;

COMMENT ON COLUMN assignments.contract_duration_months IS 'Duration of the assignment in months';
