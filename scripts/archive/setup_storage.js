const { Client } = require('pg');

async function run() {
    const client = new Client({
        user: 'postgres.whpbetjyhpttinbxcffs',
        host: 'aws-1-eu-west-3.pooler.supabase.com',
        database: 'postgres',
        password: '#1rkB&njQ$Gn5C31BWwf',
        port: 5432,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected! Setting up storage...");

        // 1. Create Bucket
        console.log("Creating bucket 'secure_collaborator_documents'...");
        await client.query(`
            INSERT INTO storage.buckets (id, name, public) 
            VALUES ('secure_collaborator_documents', 'secure_collaborator_documents', false)
            ON CONFLICT (id) DO NOTHING;
        `);

        // 2. Policy: Authenticated users can upload to their own folder (folder name = user_id)
        console.log("Creating Upload Policy...");
        // Drop existing to avoid conflicts if re-running
        await client.query(`DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;`);
        await client.query(`
            CREATE POLICY "Users can upload own documents" ON storage.objects
            FOR INSERT TO authenticated
            WITH CHECK (
                bucket_id = 'secure_collaborator_documents' 
                AND (storage.foldername(name))[1] = auth.uid()::text
            );
        `);

        // 3. Policy: Users can view their own documents OR Admins can view all
        console.log("Creating View Policy...");
        await client.query(`DROP POLICY IF EXISTS "Users and Admins can view documents" ON storage.objects;`);
        await client.query(`
            CREATE POLICY "Users and Admins can view documents" ON storage.objects
            FOR SELECT TO authenticated
            USING (
                bucket_id = 'secure_collaborator_documents' 
                AND (
                    (storage.foldername(name))[1] = auth.uid()::text
                    OR 
                    EXISTS (
                        SELECT 1 FROM public.collaborators 
                        WHERE user_id = auth.uid() 
                        AND role IN ('admin', 'superadmin', 'manager')
                    )
                )
            );
        `);

        // 4. Policy: Users can update/delete? Maybe not needed for now, but let's allow delete own.
        console.log("Creating Delete Policy...");
        await client.query(`DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;`);
        await client.query(`
            CREATE POLICY "Users can delete own documents" ON storage.objects
            FOR DELETE TO authenticated
            USING (
                bucket_id = 'secure_collaborator_documents' 
                AND (storage.foldername(name))[1] = auth.uid()::text
            );
        `);

        console.log("Storage setup completed successfully.");

    } catch (err) {
        console.error("Error setting up storage:", err);
    } finally {
        await client.end();
    }
}

run();
