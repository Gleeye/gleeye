-- Enable RLS on bookings if not already enabled
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_assignments ENABLE ROW LEVEL SECURITY;

-- 1. Allow 'anon' (public) to READ bookings for availability calculation
DROP POLICY IF EXISTS "Public Read Availability" ON bookings;
CREATE POLICY "Public Read Availability" ON bookings
FOR SELECT
TO anon, authenticated
USING (true);

-- 2. Allow 'anon' to READ booking_assignments (needed for the join)
DROP POLICY IF EXISTS "Public Read Assignments" ON booking_assignments;
CREATE POLICY "Public Read Assignments" ON booking_assignments
FOR SELECT
TO anon, authenticated
USING (true);

-- 3. Allow 'anon' to INSERT bookings (Registration)
DROP POLICY IF EXISTS "Public Insert Bookings" ON bookings;
CREATE POLICY "Public Insert Bookings" ON bookings
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Public Insert Assignments" ON booking_assignments;
CREATE POLICY "Public Insert Assignments" ON booking_assignments
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
