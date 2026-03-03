-- Migration: Remove Accounting Notifications
-- Description: Drops the triggers that were breaking invoice inserts

DROP TRIGGER IF EXISTS trg_invoices_notify ON public.invoices;
DROP TRIGGER IF EXISTS trg_passive_invoices_notify ON public.passive_invoices;
DROP FUNCTION IF EXISTS public.trg_invoices_notify();
