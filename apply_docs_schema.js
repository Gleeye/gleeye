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
        console.log("Connected to Supabase! Applying Docs Module schema...");

        // Tables + RLS
        await client.query(`
            -- Create Documents Module Tables

            -- 1. Document Spaces (Workspace per Project)
            CREATE TABLE IF NOT EXISTS public.doc_spaces (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                space_ref UUID REFERENCES public.pm_spaces(id) ON DELETE CASCADE NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(space_ref)
            );

            -- 2. Document Pages (Hierarchy)
            CREATE TABLE IF NOT EXISTS public.doc_pages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                space_ref UUID REFERENCES public.doc_spaces(id) ON DELETE CASCADE NOT NULL,
                parent_ref UUID REFERENCES public.doc_pages(id) ON DELETE CASCADE,
                title TEXT NOT NULL DEFAULT 'Untitled',
                icon TEXT,
                cover_image TEXT,
                order_index FLOAT DEFAULT 0,
                created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_doc_pages_parent ON public.doc_pages(space_ref, parent_ref);
            CREATE INDEX IF NOT EXISTS idx_doc_pages_order ON public.doc_pages(space_ref, order_index);

            -- 3. Document Blocks (Content)
            CREATE TABLE IF NOT EXISTS public.doc_blocks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                page_ref UUID REFERENCES public.doc_pages(id) ON DELETE CASCADE NOT NULL,
                type TEXT NOT NULL DEFAULT 'paragraph',
                content JSONB DEFAULT '{}',
                order_index FLOAT DEFAULT 0,
                created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_doc_blocks_page ON public.doc_blocks(page_ref, order_index);

            -- Enable RLS
            ALTER TABLE public.doc_spaces ENABLE ROW LEVEL SECURITY;
            ALTER TABLE public.doc_pages ENABLE ROW LEVEL SECURITY;
            ALTER TABLE public.doc_blocks ENABLE ROW LEVEL SECURITY;
        `);

        // Policies (Try/Catch policies individually to avoid errors if they exist)
        const policies = [
            `CREATE POLICY "Docs: Public Access Spaces" ON public.doc_spaces FOR ALL USING (true);`,
            `CREATE POLICY "Docs: Public Access Pages" ON public.doc_pages FOR ALL USING (true);`,
            `CREATE POLICY "Docs: Public Access Blocks" ON public.doc_blocks FOR ALL USING (true);`
        ];

        for (const p of policies) {
            try {
                await client.query(p);
                console.log("Policy applied.");
            } catch (e) {
                if (e.code === '42710') console.log("Policy already exists (skipped).");
                else console.error("Policy error:", e.message);
            }
        }

        console.log("Docs Module schema applied successfully.");

    } catch (err) {
        console.error("Error applying schema:", err);
    } finally {
        await client.end();
    }
}

run();
