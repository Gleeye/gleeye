-- Recreate the notification trigger with explicit logging
-- Run this in Supabase SQL Editor to debug

-- First, check if trigger exists
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE event_object_table = 'booking_assignments';

-- Drop and recreate the function with better error handling
CREATE OR REPLACE FUNCTION notify_collaborator_on_booking()
RETURNS TRIGGER AS $$
DECLARE
    v_booking RECORD;
    v_collab RECORD;
    v_item_name TEXT;
    v_guest_name TEXT;
BEGIN
    RAISE NOTICE 'Trigger fired for assignment: booking=%, collab=%', NEW.booking_id, NEW.collaborator_id;
    
    -- Fetch booking details
    SELECT * INTO v_booking FROM bookings WHERE id = NEW.booking_id;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'Booking not found: %', NEW.booking_id;
        RETURN NEW;
    END IF;
    
    -- Fetch collaborator details
    SELECT * INTO v_collab FROM collaborators WHERE id = NEW.collaborator_id;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'Collaborator not found: %', NEW.collaborator_id;
        RETURN NEW;
    END IF;
    
    -- Fetch item name
    SELECT name INTO v_item_name FROM booking_items WHERE id = v_booking.booking_item_id;
    
    -- Construct guest name
    v_guest_name := COALESCE(
        NULLIF(v_booking.guest_info->>'first_name', '') || ' ' || NULLIF(v_booking.guest_info->>'last_name', ''),
        v_booking.guest_info->>'first_name',
        v_booking.guest_info->>'last_name',
        'Cliente'
    );
    
    RAISE NOTICE 'Creating notification for guest: %, service: %', v_guest_name, v_item_name;
    
    -- Insert notification
    INSERT INTO notifications (collaborator_id, user_id, type, title, message, data)
    VALUES (
        NEW.collaborator_id,
        v_collab.user_id,
        'booking_new',
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
            'guest_name', v_guest_name,
            'service_name', v_item_name
        )
    );
    
    RAISE NOTICE 'Notification inserted successfully';
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Notification trigger error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trg_booking_notification ON booking_assignments;
CREATE TRIGGER trg_booking_notification
AFTER INSERT ON booking_assignments
FOR EACH ROW
EXECUTE FUNCTION notify_collaborator_on_booking();
