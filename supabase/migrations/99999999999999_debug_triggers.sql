DO $$
DECLARE
    t_name TEXT;
BEGIN
    FOR t_name IN (SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.pm_items'::regclass) LOOP
        RAISE NOTICE 'Found trigger: %', t_name;
    END LOOP;
END $$;
