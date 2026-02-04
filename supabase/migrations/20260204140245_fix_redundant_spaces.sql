
-- Migration to fix duplicate spaces for order 5dabc420-2a41-4a1b-ad8a-07f5fcc332f3
-- Move all tasks from old space to new space
UPDATE tasks 
SET space_id = '7129b6fb-e085-4668-9a68-bddc494b4b9f' 
WHERE space_id = 'b7992812-e44d-437b-982a-d3f420ec5efb';

-- Delete the old space record
DELETE FROM pm_spaces 
WHERE id = 'b7992812-e44d-437b-982a-d3f420ec5efb';
