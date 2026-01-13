-- Add missing fiscal fields to passive_invoices
ALTER TABLE public.passive_invoices
ADD COLUMN IF NOT EXISTS ritenuta NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS rivalsa_inps NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS iva_attiva BOOLEAN DEFAULT FALSE, -- Assuming this was the 'checked' flag in error log
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS stamp_duty NUMERIC(15,2) DEFAULT 0;

-- Update RLS if needed (Admin already has ALL)
