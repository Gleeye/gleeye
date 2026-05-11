-- Add missing relation fields to passive_invoices
ALTER TABLE public.passive_invoices
ADD COLUMN IF NOT EXISTS related_pagamenti TEXT,
ADD COLUMN IF NOT EXISTS related_movimenti TEXT;

-- Update the existing related_orders to be more consistent if needed
-- (Already exists as TEXT)
