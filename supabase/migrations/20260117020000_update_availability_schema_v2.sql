DO $$ 
BEGIN 
    -- 1. Add service_ids column (Array of UUIDs)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'availability_rules' AND column_name = 'service_ids') THEN
        ALTER TABLE public.availability_rules ADD COLUMN service_ids UUID[];
    END IF;

    -- 2. Add is_on_call column (Boolean)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'availability_rules' AND column_name = 'is_on_call') THEN
        ALTER TABLE public.availability_rules ADD COLUMN is_on_call BOOLEAN DEFAULT FALSE;
    END IF;

    -- 3. Migrate existing data: Move service_id to service_ids array
    -- Only update if service_ids is currently NULL
    UPDATE public.availability_rules 
    SET service_ids = ARRAY[service_id] 
    WHERE service_id IS NOT NULL AND service_ids IS NULL;

    -- 4. Note: We leave 'service_id' column for backward compatibility for now, but new code will use service_ids.

END $$;
