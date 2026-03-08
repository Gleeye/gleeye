-- Table to track when a user last viewed the comments for a specific PM item
CREATE TABLE IF NOT EXISTS public.pm_item_view_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    item_id uuid REFERENCES public.pm_items(id) ON DELETE CASCADE NOT NULL,
    last_viewed_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(user_id, item_id)
);

-- Enable RLS
ALTER TABLE public.pm_item_view_log ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see and manage their own view logs
CREATE POLICY "Users can view their own view logs" 
ON public.pm_item_view_log FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own view logs" 
ON public.pm_item_view_log FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own view logs" 
ON public.pm_item_view_log FOR UPDATE 
USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pm_item_view_log_user_item ON public.pm_item_view_log(user_id, item_id);
