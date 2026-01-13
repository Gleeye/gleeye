-- Add missing columns for denormalized data
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS order_number TEXT,
ADD COLUMN IF NOT EXISTS client_code TEXT;

COMMENT ON COLUMN assignments.order_number IS 'Denormalized order number for easier lookup';
COMMENT ON COLUMN assignments.client_code IS 'Denormalized client code for easier lookup';
