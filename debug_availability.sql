-- Check data for availability troubleshooting
SELECT '--- SERVICES ---' as section;
SELECT id, name, requires_confirmation, assignment_logic FROM booking_items WHERE is_active = true;

SELECT '--- COLLABORATORS PER SERVICE ---' as section;
SELECT bic.booking_item_id, bi.name as service_name, c.id as collab_id, c.first_name, c.last_name 
FROM booking_item_collaborators bic
JOIN booking_items bi ON bic.booking_item_id = bi.id
JOIN collaborators c ON bic.collaborator_id = c.id;

SELECT '--- AVAILABILITY RULES ---' as section;
SELECT collaborator_id, day_of_week, start_time, end_time 
FROM availability_rules;
