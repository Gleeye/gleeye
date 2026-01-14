-- Migration: Enable Deletion of Bookings
-- Description: Adds RLS policies to allow deletion of bookings and assignments for authenticated users

-- 1. Allow authenticated users to DELETE bookings
DROP POLICY IF EXISTS "Admins/Collaborators can delete bookings" ON bookings;
CREATE POLICY "Admins/Collaborators can delete bookings" ON bookings
FOR DELETE
TO authenticated
USING (true);

-- 2. Allow authenticated users to DELETE booking_assignments
-- (Needed even if ON DELETE CASCADE is set, just to be safe if manual deletion is ever used)
DROP POLICY IF EXISTS "Admins/Collaborators can delete assignments" ON booking_assignments;
CREATE POLICY "Admins/Collaborators can delete assignments" ON booking_assignments
FOR DELETE
TO authenticated
USING (true);

-- 3. Also allow authenticated users to UPDATE bookings (needed to confirm/cancel)
DROP POLICY IF EXISTS "Admins/Collaborators can update bookings" ON bookings;
CREATE POLICY "Admins/Collaborators can update bookings" ON bookings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Grant DELETE on tables to authenticated
GRANT DELETE ON bookings TO authenticated;
GRANT DELETE ON booking_assignments TO authenticated;
