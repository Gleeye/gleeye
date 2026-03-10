-- Add status column to pm_spaces for internal projects / clusters
ALTER TABLE pm_spaces ADD COLUMN IF NOT EXISTS status text DEFAULT 'in_svolgimento';
