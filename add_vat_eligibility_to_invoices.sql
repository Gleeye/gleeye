-- Add vat_eligibility field to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS vat_eligibility TEXT; -- Esigibilità Iva

COMMENT ON COLUMN public.invoices.vat_eligibility IS 'Esigibilità IVA: "Scissione dei pagamenti" o "Iva ad esigibilità immediata"';
