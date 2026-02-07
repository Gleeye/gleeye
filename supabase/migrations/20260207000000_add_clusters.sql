-- Add Cluster support to Internal Projects
-- Migration: 20260207000000_add_clusters.sql

DO $$ 
BEGIN

    -- 1. Add 'is_cluster' boolean (default false)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pm_spaces' AND column_name = 'is_cluster') THEN
        ALTER TABLE public.pm_spaces ADD COLUMN is_cluster BOOLEAN DEFAULT FALSE;
    END IF;

    -- 2. Add 'parent_ref' to link a project to a cluster
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pm_spaces' AND column_name = 'parent_ref') THEN
        ALTER TABLE public.pm_spaces ADD COLUMN parent_ref UUID REFERENCES public.pm_spaces(id) ON DELETE SET NULL;
    END IF;

END $$;

-- 3. Add Index for performance
CREATE INDEX IF NOT EXISTS idx_pm_spaces_parent ON public.pm_spaces(parent_ref);
CREATE INDEX IF NOT EXISTS idx_pm_spaces_is_cluster ON public.pm_spaces(is_cluster);
