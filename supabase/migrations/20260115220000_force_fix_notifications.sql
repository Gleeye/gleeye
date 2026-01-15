-- Force Fix Notification Trigger and Function

-- 1. Drop existing trigger and function to ensure clean state
DROP TRIGGER IF EXISTS trg_booking_notification ON booking_assignments;
DROP FUNCTION IF EXISTS notify_collaborator_on_booking();

-- 2. Recreate the function
CREATE OR REPLACE FUNCTION notify_collaborator_on_booking()
RETURNS TRIGGER AS $$
DECLARE
    v_booking RECORD;
    v_collab RECORD;
    v_item_name TEXT;
    v_guest_name TEXT;
BEGIN
    -- Fetch booking details
    SELECT * INTO v_booking FROM bookings WHERE id = NEW.booking_id;
    
    IF NOT FOUND THEN RETURN NEW; END IF;
    
    -- Fetch collaborator details
    SELECT * INTO v_collab FROM collaborators WHERE id = NEW.collaborator_id;
    
    IF NOT FOUND THEN RETURN NEW; END IF;
    
    -- Fetch item name
    SELECT name INTO v_item_name FROM booking_items WHERE id = v_booking.booking_item_id;
    
    v_guest_name := COALESCE(
        NULLIF(v_booking.guest_info->>'first_name', '') || ' ' || NULLIF(v_booking.guest_info->>'last_name', ''),
        v_booking.guest_info->>'first_name',
        v_booking.guest_info->>'last_name',
        'Cliente'
    );
    
    -- Insert notification with Email channel enabled
    INSERT INTO notifications (
        collaborator_id, 
        user_id, 
        type, 
        title, 
        message, 
        data,
        channel_email,
        channel_web,
        email_status
    )
    VALUES (
        NEW.collaborator_id,
        v_collab.user_id,
        'booking_new', -- Must match key in notification_types
        'Nuova prenotazione',
        format('%s ha prenotato %s per il %s alle %s', 
               v_guest_name,
               COALESCE(v_item_name, 'un servizio'), 
               to_char(v_booking.start_time AT TIME ZONE 'Europe/Rome', 'DD/MM/YYYY'),
               to_char(v_booking.start_time AT TIME ZONE 'Europe/Rome', 'HH24:MI')),
        jsonb_build_object(
            'booking_id', NEW.booking_id,
            'booking_item_id', v_booking.booking_item_id,
            'start_time', v_booking.start_time,
            'end_time', v_booking.end_time,
            'guest_name', v_guest_name,
            'guest_email', v_booking.guest_info->>'email',
            'service_name', v_item_name
        ),
        true, -- Enable Email
        true, -- Enable Web
        'queued' -- Mark for processing
    );
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Notification trigger error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recreate the trigger
CREATE TRIGGER trg_booking_notification
AFTER INSERT ON booking_assignments
FOR EACH ROW
EXECUTE FUNCTION notify_collaborator_on_booking();

-- 4. Verify/Recreate Webhook Trigger just in case
-- (This ensures the Edge Function gets called for the queued email)

DROP TRIGGER IF EXISTS trg_process_notification ON notifications;

CREATE OR REPLACE FUNCTION trigger_process_notification()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM
    net.http_post(
      url := 'https://whpbetjyhpttinbxcffs.supabase.co/functions/v1/process-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_process_notification
AFTER INSERT ON notifications
FOR EACH ROW
WHEN (NEW.email_status = 'queued')
EXECUTE FUNCTION trigger_process_notification();
