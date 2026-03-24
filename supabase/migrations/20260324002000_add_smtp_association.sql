-- Migration: Add SMTP Account Association to Notification Templates
-- Description: Allows each template to specify which SMTP account to use.

ALTER TABLE public.notification_types 
ADD COLUMN IF NOT EXISTS smtp_account_id TEXT;

COMMENT ON COLUMN public.notification_types.smtp_account_id IS 'ID of the SMTP account to use (stored in system_config smtp_accounts)';
