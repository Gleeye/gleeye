-- Extract unique tags from collaborators and insert into departments
INSERT INTO public.departments (name)
SELECT DISTINCT trim(tag)
FROM (
    SELECT unnest(string_to_array(tags, ',')) as tag
    FROM public.collaborators
    WHERE tags IS NOT NULL AND tags != ''
) as subquery
ON CONFLICT (name) DO NOTHING;

-- Verification
SELECT * FROM public.departments ORDER BY name;
