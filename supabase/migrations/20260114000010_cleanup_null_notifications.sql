-- Migration: Cleanup broken notifications
-- Description: Removes notifications with NULL user_id that are causing ghost unread badges.

DELETE FROM notifications WHERE user_id IS NULL;

-- Also ensure future inserts try to be safer (this is handled by the trigger function, 
-- but we can add a constraint if we want to be strict, though that might break booking flow).
-- For now, just cleaning up the bad data is enough to solve the current UI bug.
