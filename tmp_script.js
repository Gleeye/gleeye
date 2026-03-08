const { Client } = require('pg');

const client = new Client({
    user: 'postgres.whpbetjyhpttinbxcffs',
    host: 'aws-1-eu-west-3.pooler.supabase.com',
    database: 'postgres',
    password: '#1rkB&njQ$Gn5C31BWwf',
    port: 6543,
    ssl: { rejectUnauthorized: false }
});

const sql = `
ALTER TABLE public.doc_pages 
ADD COLUMN IF NOT EXISTS page_type TEXT DEFAULT 'document',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

UPDATE public.doc_pages SET page_type = 'document' WHERE page_type IS NULL;
UPDATE public.doc_pages SET metadata = '{}' WHERE metadata IS NULL;
`;

async function run() {
    try {
        await client.connect();
        await client.query(sql);
        console.log("Success!");
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
run();
