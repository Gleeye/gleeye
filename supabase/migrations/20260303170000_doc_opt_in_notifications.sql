-- Migration: Setup Document Subscriptions and Update Notification Trigger
-- Description: Creates the doc_subscriptions table and updates the notification trigger to be opt-in.

-- 1. Create Subscriptions Table
CREATE TABLE IF NOT EXISTS public.doc_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    page_id UUID REFERENCES public.doc_pages(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, page_id)
);

-- Enable RLS
ALTER TABLE public.doc_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see and manage their own subscriptions
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own doc subscriptions' AND tablename = 'doc_subscriptions') THEN
        CREATE POLICY "Users can manage their own doc subscriptions" ON public.doc_subscriptions
            FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- 2. Update Notification Trigger to be Opt-In
CREATE OR REPLACE FUNCTION public.trg_doc_pages_notify_log()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT := 'Un utente';
    v_pm_space_id UUID;
    v_recipients UUID[] := ARRAY[]::UUID[];
    v_shared_users UUID[];
    v_subscribed_users UUID[];
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        v_actor_id := NEW.created_by;
    END IF;

    IF v_actor_id IS NOT NULL THEN
        SELECT COALESCE(full_name, 'Un utente') INTO v_actor_name 
        FROM profiles WHERE id = v_actor_id;
    END IF;

    -- Get the PM space ID from the doc_spaces link
    SELECT space_ref INTO v_pm_space_id FROM public.doc_spaces WHERE id = NEW.space_ref;
    
    IF v_pm_space_id IS NOT NULL THEN
        -- A. Direct Direct Shared Users (Automatic)
        -- We join doc_page_permissions with collaborators to get user_ids
        SELECT array_agg(c.user_id) INTO v_shared_users
        FROM public.doc_page_permissions p
        JOIN public.collaborators c ON p.target_id = c.id
        WHERE p.page_ref = NEW.id AND p.target_type = 'collaborator' AND c.user_id IS NOT NULL;

        -- B. Subscribed Users (The Bell)
        SELECT array_agg(user_id) INTO v_subscribed_users
        FROM public.doc_subscriptions
        WHERE page_id = NEW.id;

        -- Combine recipients (unique)
        v_recipients := (
            SELECT array_agg(DISTINCT u)
            FROM unnest(array_cat(COALESCE(v_shared_users, ARRAY[]::UUID[]), COALESCE(v_subscribed_users, ARRAY[]::UUID[]))) AS u
            WHERE u IS NOT NULL AND u <> v_actor_id
        );

        IF v_recipients IS NOT NULL AND array_length(v_recipients, 1) > 0 THEN
            IF TG_OP = 'INSERT' THEN
                -- Activity Log
                INSERT INTO public.pm_activity_logs (space_ref, actor_user_ref, action_type, details)
                VALUES (v_pm_space_id, v_actor_id, 'document_created', jsonb_build_object('doc_title', NEW.title, 'doc_id', NEW.id));

                -- Notification
                PERFORM public.broadcast_pm_notification(
                    v_recipients,
                    'pm_document_created',
                    'Nuovo Documento',
                    v_actor_name || ' ha creato il documento: ' || NEW.title,
                    jsonb_build_object('space_id', v_pm_space_id, 'doc_id', NEW.id),
                    v_actor_id
                );
            ELSIF TG_OP = 'UPDATE' THEN
                IF NEW.title <> OLD.title THEN
                    INSERT INTO public.pm_activity_logs (space_ref, actor_user_ref, action_type, details)
                    VALUES (v_pm_space_id, v_actor_id, 'document_updated', jsonb_build_object('old_title', OLD.title, 'new_title', NEW.title));
                    
                    PERFORM public.broadcast_pm_notification(
                        v_recipients,
                        'pm_document_updated',
                        'Documento Aggiornato',
                        v_actor_name || ' ha rinominato un documento in: ' || NEW.title,
                        jsonb_build_object('space_id', v_pm_space_id, 'doc_id', NEW.id),
                        v_actor_id
                    );
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
