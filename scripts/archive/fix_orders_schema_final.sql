-- Sincronizziamo i nomi delle colonne con il frontend e rendiamo il titolo meno restrittivo per l'import
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_price NUMERIC;
ALTER TABLE public.orders ALTER COLUMN title DROP NOT NULL;

-- Se esiste total_amount, copiamo i dati (opzionale)
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='total_amount') THEN
    UPDATE public.orders SET total_price = total_amount WHERE total_price IS NULL;
  END IF;
END $$;
