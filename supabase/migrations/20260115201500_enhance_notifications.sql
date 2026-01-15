-- Migration: Enhance Notifications for Multi-Channel Support
-- Description: Adds channel flags and status tracking for emails

ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS channel_email BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS channel_web BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'none', -- none, queued, sent, failed
ADD COLUMN IF NOT EXISTS email_error TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create an index for the background worker (Edge Function) to find queued emails
CREATE INDEX IF NOT EXISTS idx_notifications_email_queued 
ON notifications(email_status) 
WHERE email_status = 'queued';

-- Update the trigger function to handle default channels
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
        v_booking.guest_info->>'first_name' || ' ' || v_booking.guest_info->>'last_name',
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
