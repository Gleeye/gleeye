-- Migration to synchronize legacy_id with id for assignments where legacy_id is missing.
-- This handles legacy data where 'id' was used as the human-readable identifier.

UPDATE public.assignments
SET legacy_id = id
WHERE legacy_id IS NULL OR legacy_id = '';
