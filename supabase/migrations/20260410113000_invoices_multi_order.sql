-- Add multiple order support to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS linked_orders JSONB DEFAULT '[]'::jsonb;
