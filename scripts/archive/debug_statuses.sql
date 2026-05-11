-- Check distinct statuses
SELECT 'Orders Statuses' as type, status_works as status, COUNT(*) as count FROM orders GROUP BY status_works
UNION ALL
SELECT 'Assignments Statuses' as type, status, COUNT(*) as count FROM assignments GROUP BY status;

-- Check last 5 orders
SELECT id, title, order_number, status_works, created_at FROM orders ORDER BY created_at DESC LIMIT 5;

-- Check last 5 assignments
SELECT id, description, status, created_at FROM assignments ORDER BY created_at DESC LIMIT 5;
