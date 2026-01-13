-- Add website column to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS website TEXT;

-- Reload schema cache to make the new column visible to the API
NOTIFY pgrst, 'reload schema';
