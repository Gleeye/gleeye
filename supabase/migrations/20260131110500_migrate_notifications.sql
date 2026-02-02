-- Migration: Move Notification Trigger from 'bookings' to 'booking_assignments'
-- Purpose: Support multi-collaborator notifications (equipe) by triggering on assignment creation.

-- 1. Drop the OLD Trigger and Function
DROP TRIGGER IF EXISTS notify_collaborator_on_booking_trigger ON bookings;
DROP TRIGGER IF EXISTS trg_booking_notification ON booking_assignments; -- Drop potential conflicting trigger
DROP FUNCTION IF EXISTS notify_collaborator_on_booking();


-- 2. Create the NEW Function for Assignments
CREATE OR REPLACE FUNCTION notify_collaborator_assignment()
RETURNS TRIGGER AS $$
DECLARE
    v_booking record;
    v_collab record;
    v_item_name TEXT;
    v_guest_name TEXT;
    v_company_name TEXT := 'Gleeye';
    v_title TEXT;
    v_body TEXT;
    v_debug_id UUID;
BEGIN
    -- Log Entry
    INSERT INTO debug_logs (function_name, message, details)
    VALUES ('notify_collaborator_assignment', 'Trigger Fired', jsonb_build_object('assignment_id', NEW.id, 'booking_id', NEW.booking_id, 'collaborator_id', NEW.collaborator_id));
    
    -- Fetch booking details
    SELECT * INTO v_booking FROM bookings WHERE id = NEW.booking_id;
    
    -- If no booking found (orphan assignment?), exit gracefully
    IF NOT FOUND THEN
        INSERT INTO debug_logs (function_name, message, details)
        VALUES ('notify_collaborator_assignment', 'Booking NOT FOUND', jsonb_build_object('booking_id', NEW.booking_id));
        RETURN NEW;
    END IF;
    
    -- Fetch collaborator details (to get user_id)
    SELECT * INTO v_collab FROM collaborators WHERE id = NEW.collaborator_id;
    
    -- If no collaborator found, exit gracefully
    IF NOT FOUND THEN
        INSERT INTO debug_logs (function_name, message, details)
        VALUES ('notify_collaborator_assignment', 'Collaborator NOT FOUND', jsonb_build_object('collaborator_id', NEW.collaborator_id));
        RETURN NEW;
    END IF;
    
    -- Fetch item name (if linked)
    IF v_booking.booking_item_id IS NOT NULL THEN
        SELECT name INTO v_item_name FROM booking_items WHERE id = v_booking.booking_item_id;
    END IF;
    
    -- Construct guest name from JSON
    v_guest_name := COALESCE(
        (v_booking.guest_info::jsonb->>'first_name') || ' ' || (v_booking.guest_info::jsonb->>'last_name'),
        'Cliente'
    );
    
    -- Construct Message Content
    v_title := 'Nuova prenotazione - ' || v_company_name;
    v_body := format('%s ha prenotato %s per il %s alle %s', 
               v_guest_name,
               COALESCE(v_item_name, 'un servizio'), 
               to_char(v_booking.start_time AT TIME ZONE 'Europe/Rome', 'DD/MM/YYYY'),
               to_char(v_booking.start_time AT TIME ZONE 'Europe/Rome', 'HH24:MI')
    );

    INSERT INTO debug_logs (function_name, message, details)
    VALUES ('notify_collaborator_assignment', 'Preparing Insert', jsonb_build_object('guest', v_guest_name, 'user_id', v_collab.user_id));

    -- Insert notification linked to the specific collaborator
    INSERT INTO notifications (collaborator_id, user_id, type, title, message, data)
    VALUES (
        NEW.collaborator_id,
        v_collab.user_id,
        'booking_new',
        v_title,
        v_body,
        jsonb_build_object(
            'booking_id', NEW.booking_id,
            'assignment_id', NEW.id,
            'service_name', v_item_name,
            'guest_name', v_guest_name,
            'guest_email', (v_booking.guest_info::jsonb->>'email')
        )
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Safety catch to prevent breaking the booking flow
    INSERT INTO debug_logs (function_name, message, details)
    VALUES ('notify_collaborator_assignment', 'EXCEPTION', jsonb_build_object('error', SQLERRM));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the NEW Trigger on booking_assignments
CREATE TRIGGER notify_collaborator_assignment_trigger
AFTER INSERT ON booking_assignments
FOR EACH ROW
EXECUTE FUNCTION notify_collaborator_assignment();
