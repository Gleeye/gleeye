-- Allow public (anon/authenticated) to insert new bookings
-- This is required for the public-facing Booking Wizard

CREATE POLICY "Allow public inserts to bookings"
ON public.bookings
FOR INSERT
TO public
WITH CHECK (true);

-- Allow public to select bookings matches their created/session or just open up for confirmation?
-- For security, strictly we might want to only return the ID. 
-- But for now, let's keep SELECT restricted to 'Users view own bookings' which likely uses auth.uid().
-- If the wizard needs to show "Success", it doesn't necessarily need to READ the row back if the INSERT return is enough.
-- However, Supabase .select() after insert usually respects Select policy.
-- If insert succeeds, we get data back if policy allows.
-- Let's try to minimal policy first.
