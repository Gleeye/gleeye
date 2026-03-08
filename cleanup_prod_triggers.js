const { Client } = require('pg');
const config = {
    user: 'postgres.whpbetjyhpttinbxcffs',
    host: 'aws-1-eu-west-3.pooler.supabase.com',
    database: 'postgres',
    password: '#1rkB&njQ$Gn5C31BWwf',
    port: 5432,
    ssl: { rejectUnauthorized: false }
};

async function cleanup() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log("Connected to PROD DB");

        // List all triggers to be sure
        const res = await client.query(`
            SELECT trigger_name 
            FROM information_schema.triggers 
            WHERE event_object_table = 'pm_item_assignees' 
            AND event_object_schema = 'public';
        `);

        for (const row of res.rows) {
            console.log(`Dropping trigger: ${row.trigger_name}`);
            await client.query(`DROP TRIGGER IF EXISTS "${row.trigger_name}" ON public.pm_item_assignees;`);
        }

        console.log("Creating standard trigger trg_pm_assignees_generic_log...");
        await client.query(`
            CREATE TRIGGER trg_pm_assignees_generic_log
            AFTER INSERT OR DELETE ON public.pm_item_assignees
            FOR EACH ROW EXECUTE FUNCTION public.fn_app_activity_logger();
        `);

        console.log("CLEANUP SUCCESSFUL!");
    } catch (err) {
        console.error("CLEANUP FAILED:", err);
    } finally {
        await client.end();
    }
}
cleanup();
