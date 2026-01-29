-- Migration: Fix notification system issues
-- 1. Update trigger to include company name (Gleeye for now)
-- 2. Fix RLS so regular users only see their OWN notifications

-- Drop old policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

-- Create stricter RLS policies
-- Regular users can only see notifications where:
-- user_id = their auth.uid() OR collaborator_id links to their user_id in collaborators table
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (
        -- Direct link via user_id
        auth.uid() = user_id 
        -- OR via collaborator that belongs to this user
        OR collaborator_id IN (
            SELECT id FROM collaborators WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (
        auth.uid() = user_id 
        OR collaborator_id IN (
            SELECT id FROM collaborators WHERE user_id = auth.uid()
        )
    );

-- Update the notification trigger function to include company name
CREATE OR REPLACE FUNCTION notify_collaborator_on_booking()
RETURNS TRIGGER AS $$
DECLARE
    v_booking RECORD;
    v_collab RECORD;
    v_item_name TEXT;
    v_guest_name TEXT;
    v_company_name TEXT := 'Gleeye'; -- Hardcoded for now, can be made dynamic later
BEGIN
    -- Fetch booking details
    SELECT * INTO v_booking FROM bookings WHERE id = NEW.booking_id;
    
    -- If no booking found, exit gracefully
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    
    -- Fetch collaborator details (to get user_id)
    SELECT * INTO v_collab FROM collaborators WHERE id = NEW.collaborator_id;
    
    -- If no collaborator found, exit gracefully
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    
    -- Fetch item name
    SELECT name INTO v_item_name FROM booking_items WHERE id = v_booking.booking_item_id;
    
    -- Construct guest name from JSON
    v_guest_name := COALESCE(
        v_booking.guest_info->>'first_name' || ' ' || v_booking.guest_info->>'last_name',
        'Cliente'
    );
    
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
            'guest_email', v_booking.guest_info->>'email',
            'service_name', v_item_name,
            'company_name', v_company_name
        )
    );
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the booking insert
    RAISE WARNING 'Notification trigger error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
