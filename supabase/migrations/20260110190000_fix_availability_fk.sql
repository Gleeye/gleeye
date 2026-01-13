-- Migration to fix availability tables Foreign Keys to point to public.collaborators
-- This ensures consistency with the ERP module where collaborators are managed.

-- 1. Fix availability_rules
ALTER TABLE public.availability_rules
DROP CONSTRAINT IF EXISTS availability_rules_collaborator_id_fkey;

ALTER TABLE public.availability_rules
ADD CONSTRAINT availability_rules_collaborator_id_fkey
FOREIGN KEY (collaborator_id)
REFERENCES public.collaborators(id)
ON DELETE CASCADE;

-- 2. Fix availability_overrides
ALTER TABLE public.availability_overrides
DROP CONSTRAINT IF EXISTS availability_overrides_collaborator_id_fkey;

ALTER TABLE public.availability_overrides
ADD CONSTRAINT availability_overrides_collaborator_id_fkey
FOREIGN KEY (collaborator_id)
REFERENCES public.collaborators(id)
ON DELETE CASCADE;

-- 3. Fix external_calendar_connections (if used by collaborators)
ALTER TABLE public.external_calendar_connections
DROP CONSTRAINT IF EXISTS external_calendar_connections_collaborator_id_fkey;

ALTER TABLE public.external_calendar_connections
ADD CONSTRAINT external_calendar_connections_collaborator_id_fkey
FOREIGN KEY (collaborator_id)
REFERENCES public.collaborators(id)
ON DELETE CASCADE;

-- 4. Fix external_busy_cache
ALTER TABLE public.external_busy_cache
DROP CONSTRAINT IF EXISTS external_busy_cache_collaborator_id_fkey;

ALTER TABLE public.external_busy_cache
ADD CONSTRAINT external_busy_cache_collaborator_id_fkey
FOREIGN KEY (collaborator_id)
REFERENCES public.collaborators(id)
ON DELETE CASCADE;
