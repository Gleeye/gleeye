-- 1. booking_assignments policies
ALTER TABLE booking_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public select assignments" ON booking_assignments;
CREATE POLICY "Public select assignments" ON booking_assignments FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public insert assignments" ON booking_assignments;
CREATE POLICY "Public insert assignments" ON booking_assignments FOR INSERT TO public WITH CHECK (true);

-- 2. availability_overrides policies (rules are currently open)
DROP POLICY IF EXISTS "Public select overrides" ON availability_overrides;
CREATE POLICY "Public select overrides" ON availability_overrides FOR SELECT TO public USING (true);

-- 3. Ensure booking items is readable (It should be, but just in case)
-- (Already handled in previous migrations)
