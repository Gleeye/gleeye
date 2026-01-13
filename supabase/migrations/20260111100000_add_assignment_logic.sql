-- Add assignment_logic enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE assignment_logic_type AS ENUM ('OR', 'AND', 'TEAM_SIZE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add column to booking_items
ALTER TABLE booking_items 
ADD COLUMN IF NOT EXISTS assignment_logic assignment_logic_type DEFAULT 'OR';

-- Add required_team_size column for advanced logic
ALTER TABLE booking_items 
ADD COLUMN IF NOT EXISTS required_team_size integer DEFAULT 1;

-- Refresh schema cache if needed
NOTIFY pgrst, 'reload schema';
