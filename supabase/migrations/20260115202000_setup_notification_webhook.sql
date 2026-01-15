-- Migration: Setup Webhook for Notifications
-- Description: Creates a net hook to call the Edge Function when a notification is queued

-- Note: In a real Supabase environment, this is often done via the Dashboard or
-- using the 'supabase_functions' schema if available. 
-- Since we are in a local/dev context, we'll document the SQL for the webhook trigger.

-- 1. Ensure the net extension is enabled (for webhooks)
CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "extensions";

-- 2. Create the function that will call our Edge Function
CREATE OR REPLACE FUNCTION trigger_process_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- We call our local Edge Function (or remote if deployed)
  -- The URL depends on the environment. 
  -- Locally it's usually http://host.docker.internal:54321/functions/v1/process-notification
  -- In production, it's https://[project].supabase.co/functions/v1/process-notification
  
  PERFORM
    net.http_post(
      url := 'http://host.docker.internal:54321/functions/v1/process-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS trg_process_notification ON notifications;
CREATE TRIGGER trg_process_notification
AFTER INSERT ON notifications
FOR EACH ROW
WHEN (NEW.email_status = 'queued')
EXECUTE FUNCTION trigger_process_notification();
