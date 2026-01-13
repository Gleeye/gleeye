-- TEMPORARY: Allow anyone to view notifications for debugging
CREATE POLICY "Debug: Allow anyone to view" ON notifications FOR SELECT USING (true);
