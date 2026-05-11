const { Client } = require('pg');
const config = {
    user: 'postgres.whpbetjyhpttinbxcffs',
    host: 'aws-1-eu-west-3.pooler.supabase.com',
    database: 'postgres',
    password: '#1rkB&njQ$Gn5C31BWwf',
    port: 5432,
    ssl: { rejectUnauthorized: false }
};

async function createSubSchema() {
    const client = new Client(config);
    try {
        await client.connect();

        // 1. Create table
        await client.query(`
            CREATE TABLE IF NOT EXISTS public.pm_item_subscriptions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                item_id UUID NOT NULL REFERENCES public.pm_items(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT now(),
                UNIQUE(item_id, user_id)
            );
        `);
        console.log("Table pm_item_subscriptions created.");

        // 2. Enable RLS
        await client.query(`ALTER TABLE public.pm_item_subscriptions ENABLE ROW LEVEL SECURITY;`);

        // 3. Policies
        await client.query(`
            DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.pm_item_subscriptions;
            CREATE POLICY "Users can view their own subscriptions" ON public.pm_item_subscriptions
            FOR SELECT USING (auth.uid() = user_id);

            DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON public.pm_item_subscriptions;
            CREATE POLICY "Users can manage their own subscriptions" ON public.pm_item_subscriptions
            FOR ALL USING (auth.uid() = user_id);
        `);
        console.log("Policies created.");

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
createSubSchema();
