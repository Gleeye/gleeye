
const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function fixRLS() {
    await client.connect();

    console.log('--- Fixing RLS Policies ---');

    // Drop restrictive policies if they exist/conflict or just add a broad one
    await client.query(`
    DO $$ 
    BEGIN
        DROP POLICY IF EXISTS "Enable write access for authenticated users" ON public.assignments;
        DROP POLICY IF EXISTS "Enable read access for all users" ON public.assignments;
    EXCEPTION
        WHEN undefined_object THEN null;
    END $$;
  `);

    // Create a permissive policy
    await client.query(`
    CREATE POLICY "Allow all for assignments"
    ON public.assignments
    FOR ALL
    USING (true)
    WITH CHECK (true);
  `);

    // Also for collaborator_services just in case
    await client.query(`
    DO $$ 
    BEGIN
        DROP POLICY IF EXISTS "Allow all for collaborator_services" ON public.collaborator_services;
    EXCEPTION
        WHEN undefined_object THEN null;
    END $$;

    CREATE POLICY "Allow all for collaborator_services"
    ON public.collaborator_services
    FOR ALL
    USING (true)
    WITH CHECK (true);
  `);

    // Force cache reload
    await client.query("NOTIFY pgrst, 'reload schema';");

    console.log('RLS Policies Updated to Permissive Mode.');

    await client.end();
}

fixRLS().catch(e => {
    console.error(e);
    process.exit(1);
});
