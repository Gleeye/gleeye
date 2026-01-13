-- Force a schema change to trigger cache reload
COMMENT ON TABLE public.availability_overrides IS 'Specific date-based availability slots for collaborators v2';

-- Re-grant everything to be sure
GRANT ALL ON TABLE public.availability_overrides TO postgres, anon, authenticated, service_role;

-- Notify reload
NOTIFY pgrst, 'reload schema';
