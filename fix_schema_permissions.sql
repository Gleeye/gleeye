-- Ensure permissions are granted to API roles
GRANT ALL ON TABLE public.collaborator_rest_days TO postgres, anon, authenticated, service_role;

-- Force schema cache reload again
NOTIFY pgrst, 'reload schema';
