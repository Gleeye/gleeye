-- Migration: Setup Auto-Cleanup for Notifications
-- Description: Creates a cron job to delete old read notifications and very old unread ones.

-- 1. Ensure pg_cron is available
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create the cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void AS $$
BEGIN
    -- Delete read notifications older than 30 days
    DELETE FROM public.notifications
    WHERE is_read = true 
      AND created_at < (NOW() - INTERVAL '30 days');

    -- Delete ANY notifications (even unread) older than 90 days to prevent bloat
    DELETE FROM public.notifications
    WHERE created_at < (NOW() - INTERVAL '90 days');
    
    -- Cleanup push subscriptions that haven't been updated in 6 months (stale devices)
    DELETE FROM public.push_subscriptions
    WHERE updated_at < (NOW() - INTERVAL '180 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Schedule the cleanup (Every night at 03:00 AM)
SELECT cron.schedule(
    'cleanup-notifications-job',
    '0 3 * * *',
    $$ SELECT public.cleanup_old_notifications(); $$
);

-- Ensure correct permissions
GRANT EXECUTE ON FUNCTION public.cleanup_old_notifications() TO service_role;
