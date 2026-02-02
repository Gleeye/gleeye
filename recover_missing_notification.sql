DO $$
DECLARE
    v_booking_id UUID := 'f60b990c-fb6f-4fa1-801d-f46bb1296029';
    v_booking bookings%ROWTYPE;
    v_collab collaborators%ROWTYPE;
    v_item_name TEXT;
    v_guest_name TEXT;
    v_company_name TEXT := 'Gleeye';
    v_collab_id UUID;
BEGIN
    -- Fetch a collaborator ID for this booking
    SELECT collaborator_id INTO v_collab_id 
    FROM booking_assignments 
    WHERE booking_id = v_booking_id 
    LIMIT 1;

    RAISE NOTICE 'Restoring notification for Booking: %, Collaborator: %', v_booking_id, v_collab_id;

    -- Fetch booking details
    SELECT * INTO v_booking FROM bookings WHERE id = v_booking_id;
    IF NOT FOUND THEN RAISE NOTICE 'Booking not found'; RETURN; END IF;

    -- Fetch collaborator details
    SELECT * INTO v_collab FROM collaborators WHERE id = v_collab_id;
    IF NOT FOUND THEN RAISE NOTICE 'Collaborator not found'; RETURN; END IF;

    -- Fetch item name
    SELECT name INTO v_item_name FROM booking_items WHERE id = v_booking.booking_item_id;

    -- Construct guest name
    v_guest_name := COALESCE(
        (v_booking.guest_info::jsonb->>'first_name') || ' ' || (v_booking.guest_info::jsonb->>'last_name'),
        'Cliente'
    );
    
    -- Attempt INSERT
    INSERT INTO notifications (collaborator_id, user_id, type, title, message, data)
    VALUES (
        v_collab_id,
        v_collab.user_id,
        'booking_new',
        'Nuova prenotazione - ' || v_company_name,
        format('%s ha prenotato %s per il %s alle %s', 
               v_guest_name,
               COALESCE(v_item_name, 'un servizio'), 
               to_char(v_booking.start_time AT TIME ZONE 'Europe/Rome', 'DD/MM/YYYY'),
               to_char(v_booking.start_time AT TIME ZONE 'Europe/Rome', 'HH24:MI')),
        jsonb_build_object(
            'booking_id', v_booking_id,
            'booking_item_id', v_booking.booking_item_id,
            'start_time', v_booking.start_time,
            'end_time', v_booking.end_time,
            'guest_name', v_guest_name,
            'guest_email', (v_booking.guest_info::jsonb->>'email'),
            'service_name', v_item_name,
            'company_name', v_company_name
        )
    );
    
    RAISE NOTICE 'Notification restored successfully!';
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Restoration error: %', SQLERRM;
END $$;
