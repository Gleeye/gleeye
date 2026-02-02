-- Update the notification trigger function to include company name and LOGGING
CREATE OR REPLACE FUNCTION notify_collaborator_on_booking()
RETURNS TRIGGER AS $$
DECLARE
    v_booking bookings%ROWTYPE;
    v_collab collaborators%ROWTYPE;
    v_item_name TEXT;
    v_guest_name TEXT;
    v_company_name TEXT := 'Gleeye';
    v_debug_id UUID;
BEGIN
    -- Log Entry
    INSERT INTO debug_logs (function_name, message, details)
    VALUES ('notify_collaborator_on_booking', 'Trigger Fired', jsonb_build_object('booking_id', NEW.booking_id, 'collaborator_id', NEW.collaborator_id));

    -- Fetch booking details
    SELECT * INTO v_booking FROM bookings WHERE id = NEW.booking_id;
    
    -- If no booking found, exit gracefully
    IF NOT FOUND THEN
        INSERT INTO debug_logs (function_name, message, details)
        VALUES ('notify_collaborator_on_booking', 'Booking NOT FOUND', jsonb_build_object('booking_id', NEW.booking_id));
        RETURN NEW;
    END IF;
    
    -- Fetch collaborator details (to get user_id)
    SELECT * INTO v_collab FROM collaborators WHERE id = NEW.collaborator_id;
    
    -- If no collaborator found, exit gracefully
    IF NOT FOUND THEN
        INSERT INTO debug_logs (function_name, message, details)
        VALUES ('notify_collaborator_on_booking', 'Collaborator NOT FOUND', jsonb_build_object('collaborator_id', NEW.collaborator_id));
        RETURN NEW;
    END IF;
    
    -- Fetch item name
    SELECT name INTO v_item_name FROM booking_items WHERE id = v_booking.booking_item_id;
    
    -- Construct guest name from JSON
    v_guest_name := COALESCE(
        (v_booking.guest_info::jsonb->>'first_name') || ' ' || (v_booking.guest_info::jsonb->>'last_name'),
        'Cliente'
    );
    
    INSERT INTO debug_logs (function_name, message, details)
    VALUES ('notify_collaborator_on_booking', 'Preparing Insert', jsonb_build_object('guest', v_guest_name, 'user_id', v_collab.user_id));

    -- Insert notification with company name included
    INSERT INTO notifications (collaborator_id, user_id, type, title, message, data)
    VALUES (
        NEW.collaborator_id,
        v_collab.user_id,
        'booking_new',
        'Nuova prenotazione - ' || v_company_name,
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
            'guest_email', (v_booking.guest_info::jsonb->>'email'),
            'service_name', v_item_name,
            'company_name', v_company_name
        )
    );
    
    INSERT INTO debug_logs (function_name, message, details)
    VALUES ('notify_collaborator_on_booking', 'Notification Inserted', jsonb_build_object('notification_type', 'booking_new'));

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log error
    INSERT INTO debug_logs (function_name, message, details)
    VALUES ('notify_collaborator_on_booking', 'EXCEPTION CAUGHT', jsonb_build_object('error', SQLERRM, 'state', SQLSTATE));
    
    RAISE WARNING 'Notification trigger error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
