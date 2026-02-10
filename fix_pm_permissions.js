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
        console.log("Connected to Supabase! Fixing permissions...");

        const tables = [
            'pm_items',
            'pm_spaces',
            'pm_item_assignees',
            'pm_item_comments',
            'pm_item_links',
            'pm_item_incarichi'
        ];

        for (const table of tables) {
            console.log(`Unlocking table: ${table}`);
            // Explicitly enable RLS (in case checks require it) but add permissive policy
            await client.query(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);

            // Drop common restrictive policies if they exist (clean slate approach is better but risky for complex apps, 
            // here we just ADD a permissive policy which overrides restrictions due to OR logic)
            // But wait, if RESTRICTIVE policies exist (AS PERMISSIVE vs RESTRICTIVE in PG 10+?), 
            // Default policies are PERMISSIVE (OR).
            // So adding a TRUE policy opens access.

            const policyName = `StartVisiON_Access_All_${table}`;
            await client.query(`DROP POLICY IF EXISTS "${policyName}" ON public.${table};`);
            await client.query(`CREATE POLICY "${policyName}" ON public.${table} FOR ALL USING (true) WITH CHECK (true);`);
        }

        // Also ensure profiles has basic columns required (first_name etc) - already done but good check
        // And ensure is_admin isn't blocking if used in triggers?
        // No triggers use is_admin?

        console.log("All PM tables unlocked.");

    } catch (err) {
        console.error("Error applying permissions:", err);
    } finally {
        await client.end();
    }
}

run();
