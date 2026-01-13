
-- Enable pg_net extension for HTTP calls
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Create a function to call the Edge Function
CREATE OR REPLACE FUNCTION public.trigger_sync_google_calendar()
RETURNS TRIGGER AS $$
DECLARE
  request_id BIGINT;
BEGIN
  -- Call the Edge Function via pg_net
  -- URL: https://whpbetjyhpttinbxcffs.supabase.co/functions/v1/sync-google-calendar
  -- We send the NEW record as payload
  SELECT net.http_post(
    url := 'https://whpbetjyhpttinbxcffs.supabase.co/functions/v1/sync-google-calendar',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := json_build_object(
        'record', row_to_json(NEW),
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA
    )::jsonb
  ) INTO request_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the Trigger
DROP TRIGGER IF EXISTS on_booking_assignment_created ON public.booking_assignments;

CREATE TRIGGER on_booking_assignment_created
AFTER INSERT ON public.booking_assignments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_sync_google_calendar();
