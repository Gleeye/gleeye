-- Comprehensive Fix for Passive Invoices
BEGIN;

-- 1. Normalization: Divide by 100 IF the value is inexplicably larger than the taxable amount
-- (Heuristic: Tax/Rivalsa/Ritenuta should rarely exceed 100% of taxable)

UPDATE public.passive_invoices 
SET rivalsa_inps = rivalsa_inps / 100 
WHERE amount_tax_excluded > 0 AND rivalsa_inps > amount_tax_excluded;

UPDATE public.passive_invoices 
SET ritenuta = ritenuta / 100 
WHERE amount_tax_excluded > 0 AND ritenuta > amount_tax_excluded;

UPDATE public.passive_invoices 
SET tax_amount = tax_amount / 100 
WHERE amount_tax_excluded > 0 AND tax_amount > amount_tax_excluded;

-- 2. Recalculate Totals
-- Total (Lordo) = Taxable + VAT + Rivalsa + Bollo (if any)
-- We rely on the now-fixed components.
UPDATE public.passive_invoices
SET amount_tax_included = amount_tax_excluded + COALESCE(tax_amount, 0) + COALESCE(rivalsa_inps, 0) + COALESCE(stamp_duty, 0);

-- 3. Recalculate Amount Paid (Netto a Pagare)
-- Netto = Total - Ritenuta
UPDATE public.passive_invoices
SET amount_paid = amount_tax_included - COALESCE(ritenuta, 0);

COMMIT;
