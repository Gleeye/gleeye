-- Fix 100x scaling errors in passive invoices import
BEGIN;

-- 1. Fix Rivalsa INPS (4%)
-- If Rivalsa is > Taxable amount, it's definitely an error (should be ~4%).
UPDATE public.passive_invoices 
SET rivalsa_inps = rivalsa_inps / 100 
WHERE amount_tax_excluded > 0 AND rivalsa_inps > amount_tax_excluded;

-- 2. Fix Ritenuta d'Acconto (20%)
-- If Ritenuta is > Taxable amount, it's definitely an error (should be ~20%).
UPDATE public.passive_invoices 
SET ritenuta = ritenuta / 100 
WHERE amount_tax_excluded > 0 AND ritenuta > amount_tax_excluded;

-- 3. Fix Tax Amount (VAT)
-- If VAT is > Taxable amount, it's likely an error (max VAT is 22%).
UPDATE public.passive_invoices 
SET tax_amount = tax_amount / 100 
WHERE amount_tax_excluded > 0 AND tax_amount > amount_tax_excluded;

-- 4. Re-calculate Totals consistency (optional, but good for display)
-- Update Total = Taxable + VAT + Rivalsa (ignoring Ritenuta for 'amount_tax_included' definition usually)
-- OR just trust the import for Total if it wasn't scaled.
-- Let's stick to fixing the obvious columns first.

COMMIT;
