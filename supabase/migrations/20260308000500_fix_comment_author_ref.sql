-- Update pm_item_comments to reference public.profiles instead of auth.users
-- This allows easy fetching of user details (name, avatar) in comments
ALTER TABLE public.pm_item_comments 
DROP CONSTRAINT IF EXISTS pm_item_comments_author_user_ref_fkey;

ALTER TABLE public.pm_item_comments
ADD CONSTRAINT pm_item_comments_author_user_ref_fkey 
FOREIGN KEY (author_user_ref) 
REFERENCES public.profiles(id) 
ON DELETE SET NULL;
