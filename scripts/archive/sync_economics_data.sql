-- sync_economics_data.sql
-- Sync legacy price_actual/cost_actual to new price_final/cost_final columns

UPDATE public.orders 
SET 
  price_final = price_actual,
  cost_final = cost_actual
WHERE price_final IS NULL AND cost_final IS NULL;

-- Also update comments to clarify the relationship
COMMENT ON COLUMN public.orders.price_actual IS 'Prezzi Finali storici da Airtable';
COMMENT ON COLUMN public.orders.cost_actual IS 'Costi Finali storici da Airtable';
COMMENT ON COLUMN public.orders.price_final IS 'Prezzo finale corrente gestito dall''account';
COMMENT ON COLUMN public.orders.cost_final IS 'Costo finale corrente gestito dall''account';
