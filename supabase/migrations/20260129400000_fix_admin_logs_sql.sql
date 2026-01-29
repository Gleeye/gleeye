-- Fix Admin Logs Function
-- Replaces get_admin_notification_logs with proper table aliases to avoid ambiguity

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
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
    ) AND NOT EXISTS (
        SELECT 1 FROM collaborators c2
        WHERE c2.user_id = auth.uid()
        AND c2.role IN ('admin', 'manager')
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
        COALESCE(u.email, 'Unknown'),
        COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, ''),
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
