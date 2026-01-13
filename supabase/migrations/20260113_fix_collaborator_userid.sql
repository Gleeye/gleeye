-- Migration: Add user_id to collaborators and link existing users
-- Description: Ensures collaborators can be linked to auth users for notifications

-- 1. Add user_id column to collaborators
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Link existing collaborators based on email
-- This assumes the email in collaborators matches the email in auth.users
UPDATE collaborators c
SET user_id = u.id
FROM auth.users u
WHERE LOWER(c.email) = LOWER(u.email)
AND c.user_id IS NULL;

-- 3. Update the notification trigger to handle cases without user_id gracefully
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
    
    -- If no booking found, exit gracefully
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    
    -- Fetch collaborator details
    SELECT * INTO v_collab FROM collaborators WHERE id = NEW.collaborator_id;
    
    -- If no collaborator found, exit gracefully
    IF NOT FOUND THEN
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
    
    -- Insert notification (only if user_id exists, otherwise it's useless for ERP notifications)
    -- BUT we can also insert with just collaborator_id for the list
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
            'end_time', v_booking.end_time,
            'guest_name', v_guest_name,
            'guest_email', v_booking.guest_info->>'email',
            'service_name', v_item_name
        )
    );
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Fallback: ignore error to not block booking
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
