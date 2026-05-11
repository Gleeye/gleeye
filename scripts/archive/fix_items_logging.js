const { Client } = require('pg');
const config = {
    user: 'postgres.whpbetjyhpttinbxcffs',
    host: 'aws-1-eu-west-3.pooler.supabase.com',
    database: 'postgres',
    password: '#1rkB&njQ$Gn5C31BWwf',
    port: 5432,
    ssl: { rejectUnauthorized: false }
};

async function fixItems() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log("Connected to PROD DB");

        // Clean up duplicate triggers
        await client.query(`DROP TRIGGER IF EXISTS trg_pm_items_activity_log ON public.pm_items;`);
        await client.query(`
            CREATE TRIGGER trg_pm_items_activity_log
            AFTER INSERT OR UPDATE OR DELETE ON public.pm_items
            FOR EACH ROW EXECUTE FUNCTION public.fn_app_activity_logger();
        `);

        // Update registry to track cloud_links
        await client.query(`
            UPDATE public.pm_activity_registry 
            SET column_templates = column_templates || '{"cloud_links": "ha aggiornato le risorse di {entity}"}'::jsonb
            WHERE table_name = 'pm_items';
        `);

        console.log("FIXES APPLIED SUCCESSFUL!");
    } catch (err) {
        console.error("FIXES FAILED:", err);
    } finally {
        await client.end();
    }
}
fixItems();
