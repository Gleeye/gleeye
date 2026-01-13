-- Rename tables
ALTER TABLE services RENAME TO booking_items;
ALTER TABLE service_categories RENAME TO booking_categories;
ALTER TABLE service_collaborators RENAME TO booking_item_collaborators;

-- Rename columns in booking_items (was services)
-- category_id references service_categories which is now booking_categories. 
-- The constraint name might remain old, but let's rename the FK column if we want, or just keep it as is since it was already category_id.
-- However, we need to update references in other tables.

-- booking_item_collaborators (was service_collaborators)
ALTER TABLE booking_item_collaborators RENAME COLUMN service_id TO booking_item_id;

-- bookings
ALTER TABLE bookings RENAME COLUMN service_id TO booking_item_id;

-- booking_holds
ALTER TABLE booking_holds RENAME COLUMN service_id TO booking_item_id;

-- booking_assignments
-- This table references bookings(id), doesn't directly reference service_id, so it's fine.

-- RLS Policies
-- We need to drop and recreate policies if they reference the old table names in their definitions?
-- Postgres usually updates table references in policies automatically when tables are renamed.
-- But let's verify or re-apply just in case to be clean.

-- Clean up old FK constraints if they have auto-generated names containing 'service'
-- (Optional, but good for hygiene)
