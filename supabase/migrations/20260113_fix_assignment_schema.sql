
-- Fix: Add missing columns to booking_assignments table
-- This resolves the PGRST204 error when frontend tries to insert 'role_in_order'

ALTER TABLE booking_assignments 
ADD COLUMN IF NOT EXISTS role_in_order TEXT DEFAULT 'Collaborator';

ALTER TABLE booking_assignments 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Reload schema cache to ensure PostgREST sees the new columns immediately
NOTIFY pgrst, 'reload schema';
