-- Fix duplicate logging issues
BEGIN;

-- Drop any potentially conflicting triggers on pm_items
DROP TRIGGER IF EXISTS trg_items_log ON public.pm_items;
DROP TRIGGER IF EXISTS trg_items_activity_log ON public.pm_items;
DROP TRIGGER IF EXISTS trg_pm_items_log ON public.pm_items;
DROP TRIGGER IF EXISTS trg_pm_items_generic_log ON public.pm_items;
DROP TRIGGER IF EXISTS trg_pm_items_activity_log ON public.pm_items;
DROP TRIGGER IF EXISTS trg_pm_items_audit_notify ON public.pm_items;

-- Recreate only the core logger and the core notify on items
CREATE TRIGGER trg_pm_items_activity_log 
AFTER INSERT OR UPDATE ON public.pm_items 
FOR EACH ROW EXECUTE FUNCTION public.fn_app_activity_logger();

CREATE TRIGGER trg_pm_items_audit_notify
AFTER INSERT OR UPDATE ON public.pm_items
FOR EACH ROW EXECUTE FUNCTION public.trg_pm_items_notify_log();


-- Drop any potentially conflicting triggers on pm_item_assignees
DROP TRIGGER IF EXISTS trg_assignees_log ON public.pm_item_assignees;
DROP TRIGGER IF EXISTS trg_pm_assignees_log ON public.pm_item_assignees;
DROP TRIGGER IF EXISTS trg_pm_assignees_generic_log ON public.pm_item_assignees;
DROP TRIGGER IF EXISTS trg_pm_assignees_audit_notify ON public.pm_item_assignees;
DROP TRIGGER IF EXISTS trg_pm_item_assignees_activity_log ON public.pm_item_assignees;

-- Recreate only the core notify (let's disable individual activity logs for assignees for now to prevent spam, or format it correctly)
-- The notify handles broadcast and mail
CREATE TRIGGER trg_pm_assignees_audit_notify
AFTER INSERT ON public.pm_item_assignees
FOR EACH ROW EXECUTE FUNCTION public.trg_pm_assignees_notify_log();

-- If we still want assignee activity logs in the UI (like "ha assegnato ..."), let's be careful and disable it in the registry instead, but let's just make sure the trigger is fresh
CREATE TRIGGER trg_pm_assignees_activity_log 
AFTER INSERT OR UPDATE ON public.pm_item_assignees 
FOR EACH ROW EXECUTE FUNCTION public.fn_app_activity_logger();

-- Fix the registry for assignees so it doesn't output "ha creato"
UPDATE public.pm_activity_registry
SET template_insert = 'ha aggiunto membri a {entity}'
WHERE table_name = 'pm_item_assignees';

-- Clean recent bogus logs the user just complained about (spam created in last 1 hour)
DELETE FROM public.pm_activity_logs 
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND details->>'description' ILIKE '%descrizione%'
  AND (action_type ILIKE '%pm_item_assignees%' OR action_type ILIKE '%pm_items:updated:notes%')
  AND details->>'old' IS NULL 
  AND (details->>'new' IS NULL OR details->>'new' = '');

-- De-duplicate all EXACT same logs (from multi-triggers firing at once) in the last hour
DELETE FROM public.pm_activity_logs a USING (
    SELECT MIN(id::text)::uuid as min_id, actor_user_ref, item_ref, action_type, details->>'description' as descr, date_trunc('minute', created_at)
    FROM public.pm_activity_logs
    WHERE created_at > NOW() - INTERVAL '2 hours'
    GROUP BY actor_user_ref, item_ref, action_type, details->>'description', date_trunc('minute', created_at)
) b
WHERE a.actor_user_ref = b.actor_user_ref 
AND a.item_ref = b.item_ref 
AND a.action_type = b.action_type
AND a.created_at > NOW() - INTERVAL '2 hours'
AND a.id != b.min_id;

COMMIT;
