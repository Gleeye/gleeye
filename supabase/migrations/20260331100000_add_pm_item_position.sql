-- Add position column to pm_items for manual sorting
ALTER TABLE public.pm_items ADD COLUMN IF NOT EXISTS position DOUBLE PRECISION DEFAULT 0;

-- Initialize position for existing items based on created_at
WITH ordered_items AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY space_ref, parent_ref ORDER BY created_at ASC) as row_num
    FROM public.pm_items
)
UPDATE public.pm_items
SET position = ordered_items.row_num * 1000
FROM ordered_items
WHERE public.pm_items.id = ordered_items.id;
