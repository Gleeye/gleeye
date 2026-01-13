ALTER TABLE public.booking_items 
ADD COLUMN IF NOT EXISTS max_advance_days INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS min_notice_minutes INTEGER DEFAULT 1440, -- 1 day
ADD COLUMN IF NOT EXISTS cancellation_policy TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS buffer_before_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS buffer_after_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS requires_confirmation BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_rule TEXT DEFAULT 'none';

-- Drop old buffer column if it creates confusion, or keep for migration. Keeping for now.
