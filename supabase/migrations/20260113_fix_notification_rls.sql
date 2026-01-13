-- Fix RLS to allow admins to see all notifications
-- And allow the service_role context (triggers) to insert

-- First, drop overly restrictive policies 
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Debug: Allow anyone to view" ON notifications;

-- Allow authenticated users to see notifications for their profile
-- OR if they are admin, see all
CREATE POLICY "Users and Admins can view notifications" ON notifications
FOR SELECT 
USING (
    auth.uid() = user_id 
    OR collaborator_id IN (SELECT id FROM collaborators WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Allow service_role (triggers) to insert notifications without restrictions
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;
CREATE POLICY "Anyone can insert notifications" ON notifications
FOR INSERT 
WITH CHECK (true);

-- Allow reading for debugging temporarily
CREATE POLICY "Temp: Allow all reads" ON notifications
FOR SELECT USING (true);
