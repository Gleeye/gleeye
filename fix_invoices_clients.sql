-- Fix script to link invoices to clients via orders
UPDATE public.invoices
SET client_id = orders.client_id
FROM public.orders
WHERE public.invoices.order_id = public.orders.id
AND public.invoices.client_id IS NULL;

-- Verification query (to run in Supabase)
-- SELECT invoice_number, client_id FROM public.invoices WHERE client_id IS NULL;
