-- Migration: Fix Notification User IDs
-- Description: Backfill user_id from collaborators table where missing

-- 1. Backfill user_id for notifications that have collaborator_id but NULL user_id
UPDATE notifications n
SET user_id = c.user_id
FROM collaborators c
WHERE n.collaborator_id = c.id
  AND n.user_id IS NULL
  AND c.user_id IS NOT NULL;

-- 2. Log how many were updated (optional, for debugging)
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % notifications with missing user_id', updated_count;
END $$;
