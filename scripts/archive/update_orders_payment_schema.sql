-- Add payment configuration columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_mode text DEFAULT 'Bonifico',
ADD COLUMN IF NOT EXISTS deposit_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS balance_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS installment_type text DEFAULT 'Mensile',
ADD COLUMN IF NOT EXISTS installments_count integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'Pagamento completo';

-- Add comment
COMMENT ON COLUMN orders.payment_mode IS 'Modalità di calcolo (es. Anticipo + Rate)';
COMMENT ON COLUMN orders.payment_method IS 'Tipo Pagamento (es. Bonifico, Ricevuta, etc) - in questo caso specifico enum schema: Pagamento completo, Saldo alla fattura...';
COMMENT ON COLUMN orders.deposit_percentage IS 'Percentuale anticipo';
COMMENT ON COLUMN orders.balance_percentage IS 'Percentuale saldo';
COMMENT ON COLUMN orders.installment_type IS 'Frequenza rate (Mensile, Trimestrale)';
COMMENT ON COLUMN orders.installments_count IS 'Numero di rate';
