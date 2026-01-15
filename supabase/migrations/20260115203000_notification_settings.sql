-- Migration: Create Notification Types and User Preferences
-- Description: Tables for managing notification settings globally and per-user

-- 1. Create notification_types table (Admin-managed)
CREATE TABLE IF NOT EXISTS notification_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,  -- e.g. 'booking_new', 'payment_due'
    label_it TEXT NOT NULL,    -- Italian label for UI
    description TEXT,          -- Explanation shown in settings
    category TEXT DEFAULT 'general',  -- e.g. 'booking', 'payment', 'order'
    default_email BOOLEAN DEFAULT true,
    default_web BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Insert initial notification types
INSERT INTO notification_types (key, label_it, description, category, default_email, default_web) VALUES
    ('booking_new', 'Nuova Prenotazione', 'Quando viene creata una nuova prenotazione', 'booking', true, true),
    ('booking_cancelled', 'Prenotazione Annullata', 'Quando una prenotazione viene cancellata', 'booking', true, true),
    ('booking_reminder', 'Promemoria Prenotazione', 'Promemoria 24h prima della prenotazione', 'booking', true, false),
    ('payment_due', 'Pagamento in Scadenza', 'Quando un pagamento sta per scadere', 'payment', true, true),
    ('payment_received', 'Pagamento Ricevuto', 'Quando viene registrato un pagamento', 'payment', true, true),
    ('invoice_ready', 'Fattura Pronta', 'Quando viene generata una nuova fattura', 'invoice', true, false),
    ('order_assigned', 'Nuovo Ordine Assegnato', 'Quando vieni assegnato a un nuovo ordine', 'order', true, true)
ON CONFLICT (key) DO NOTHING;

-- 3. Create user_notification_preferences table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_type_id UUID REFERENCES notification_types(id) ON DELETE CASCADE,
    email_enabled BOOLEAN DEFAULT true,
    web_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, notification_type_id)
);

-- 4. Enable RLS
ALTER TABLE notification_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for notification_types (read by all authenticated, write by admin via service role)
CREATE POLICY "Authenticated users can read notification types" ON notification_types
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage notification types" ON notification_types
    FOR ALL USING (auth.role() = 'service_role');

-- 6. RLS Policies for user_notification_preferences
CREATE POLICY "Users can read own preferences" ON user_notification_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON user_notification_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON user_notification_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences" ON user_notification_preferences
    FOR DELETE USING (auth.uid() = user_id);

-- 7. Grant permissions
GRANT SELECT ON notification_types TO authenticated;
GRANT ALL ON user_notification_preferences TO authenticated;
GRANT ALL ON notification_types TO service_role;
GRANT ALL ON user_notification_preferences TO service_role;

-- 8. Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_types_key ON notification_types(key);
CREATE INDEX IF NOT EXISTS idx_user_notif_prefs_user ON user_notification_preferences(user_id);
