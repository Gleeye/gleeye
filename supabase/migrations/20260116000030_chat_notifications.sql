-- Chat Notifications Trigger

-- Trigger function to handle new messages
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_author_name text;
    v_recipient_id uuid;
    v_title text;
    v_message_body text;
    v_parent_author_id uuid;
BEGIN
    -- Skip if deleted (though insert shouldn't start deleted)
    IF NEW.deleted_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Get author email/name (using auth.users or profiles?)
    -- Ideally profiles, but let's check auth.users via a known trick or just use "Someone" if strictly inside DB without helper.
    -- Better: Use profiles table if available.
    SELECT email INTO v_author_name FROM auth.users WHERE id = NEW.author_id;
    -- Fallback or refine
    v_author_name := COALESCE(v_author_name, 'Un utente');

    v_message_body := substring(NEW.body from 1 for 100); -- Truncate

    -- 1. Direct Messages & Group Conversations
    IF NEW.conversation_id IS NOT NULL THEN
        -- Notify all OTHER members of the conversation
        FOR v_recipient_id IN 
            SELECT user_id FROM public.conversation_members 
            WHERE conversation_id = NEW.conversation_id 
            AND user_id != NEW.author_id
        LOOP
            INSERT INTO public.notifications (
                user_id, 
                type, 
                title, 
                message, 
                data,
                channel_web,
                channel_email, -- Maybe false for chat spam? Let's default to false for now or true depending on preference.
                email_status
            ) VALUES (
                v_recipient_id,
                'chat_dm',
                'Nuovo messaggio da ' || v_author_name,
                v_message_body,
                jsonb_build_object(
                    'context_id', NEW.conversation_id,
                    'message_id', NEW.id,
                    'type', 'conversation'
                ),
                true, -- Web
                false, -- Email off by default for chat
                'none'
            );
        END LOOP;
        
    -- 2. Thread Replies (in Channels)
    ELSIF NEW.channel_id IS NOT NULL AND NEW.parent_message_id IS NOT NULL THEN
        -- Notify the author of the parent message
        SELECT author_id INTO v_parent_author_id FROM public.messages WHERE id = NEW.parent_message_id;
        
        -- Only notify if parent author is different from replier
        IF v_parent_author_id IS NOT NULL AND v_parent_author_id != NEW.author_id THEN
            INSERT INTO public.notifications (
                user_id, 
                type, 
                title, 
                message, 
                data,
                channel_web,
                channel_email,
                email_status
            ) VALUES (
                v_parent_author_id,
                'chat_reply',
                'Nuova risposta da ' || v_author_name,
                v_message_body,
                jsonb_build_object(
                    'context_id', NEW.channel_id,
                    'message_id', NEW.id,
                    'parent_id', NEW.parent_message_id,
                    'type', 'channel'
                ),
                true,
                false,
                'none'
            );
        END IF;
    END IF;

    -- Mentions (Simple Regex MVP): Look for @user_uuid? 
    -- Too complex for SQL regex to be robust for names. 
    -- Assuming frontend sends mentions in metadata or we skip for sprint 5.
    -- Skipping mentions for Sprint 5 as per plan.

    RETURN NEW;
END;
$$;

-- Create Trigger
DROP TRIGGER IF EXISTS trg_handle_new_message ON public.messages;
CREATE TRIGGER trg_handle_new_message
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_message();
