-- DB Function for Admin Notification Logs
-- Allows admins to view all notifications in the system for debugging purposes
-- Uses SECURITY DEFINER to bypass the strict RLS we just added

CREATE OR REPLACE FUNCTION get_admin_notification_logs(
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_search TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    created_at TIMESTAMPTZ,
    type TEXT,
    title TEXT,
    message TEXT,
    user_email TEXT,
    collaborator_name TEXT,
    is_read BOOLEAN
)
AS $$
BEGIN
    -- Security Check: Ensure the caller is an admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) AND NOT EXISTS (
        SELECT 1 FROM collaborators 
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()) 
        AND role IN ('admin', 'manager')
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    RETURN QUERY
    SELECT 
        n.id,
        n.created_at,
        n.type,
        n.title,
        n.message,
        u.email as user_email,
        c.first_name || ' ' || c.last_name as collaborator_name,
        n.is_read
    FROM notifications n
    LEFT JOIN auth.users u ON n.user_id = u.id
    LEFT JOIN collaborators c ON n.collaborator_id = c.id
    WHERE 
        (p_search IS NULL OR 
         n.title ILIKE '%' || p_search || '%' OR 
         n.message ILIKE '%' || p_search || '%' OR
         u.email ILIKE '%' || p_search || '%' OR
         c.first_name ILIKE '%' || p_search || '%' OR
         c.last_name ILIKE '%' || p_search || '%'
        )
    ORDER BY n.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
