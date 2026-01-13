-- Add payment configuration columns to assignments table
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS payment_mode text DEFAULT 'saldo',
ADD COLUMN IF NOT EXISTS deposit_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS installments_count integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS installment_type text DEFAULT 'Mensile',
ADD COLUMN IF NOT EXISTS balance_percentage numeric DEFAULT 0;
