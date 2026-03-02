-- Migration: Push Notifications Infrastructure
-- Description: Creates the push_subscriptions table and adds VAPID keys to system_config.

-- 1. Create push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);

-- 2. Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policy
DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage their own subscriptions"
    ON public.push_subscriptions
    FOR ALL
    USING (auth.uid() = user_id);

-- 4. Insert VAPID Keys into system_config
INSERT INTO public.system_config (key, value, description)
VALUES 
    ('vapid_public_key', 'BNEWfpEPRK2FKhpvKk--ZUzvbDZt9tLVwpq4bAuK0FjAnW-NXh3fZcTDYDYcLwLOaxrj00EZwhdhpiQVS18w1d8', 'Public VAPID Key for Web Push'),
    ('vapid_private_key', '4LEs_MchFW-_CCH5rn6eiYZQ0OsN2Xw-kDohoM-9_FE', 'Private VAPID Key for Web Push')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
