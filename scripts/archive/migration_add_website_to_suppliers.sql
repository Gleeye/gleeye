-- Add website column to suppliers table
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS website TEXT;

-- Refresh schema cache happens automatically usually, but good to know.
