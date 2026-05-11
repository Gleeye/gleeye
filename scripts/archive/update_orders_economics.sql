-- update_orders_economics.sql
-- Add final economics fields for account-managed pricing

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS price_final NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS cost_final NUMERIC(10,2);

COMMENT ON COLUMN public.orders.price_final IS 'Prezzo finale concordato dall''account (editabile manualmente)';
COMMENT ON COLUMN public.orders.cost_final IS 'Costo finale concordato dall''account (editabile manualmente)';
