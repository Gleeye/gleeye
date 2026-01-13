-- Test direct insertion into notifications from trigger context
DO $$
DECLARE
    test_collab_id UUID := '61810c9c-ab9e-4c2e-9c16-2ab2f9823301';
    test_user_id UUID;
BEGIN
    -- Get user_id from collaborator
    SELECT user_id INTO test_user_id FROM collaborators WHERE id = test_collab_id;
    
    RAISE NOTICE 'Collaborator user_id: %', test_user_id;
    
    -- Try to insert
    INSERT INTO notifications (collaborator_id, user_id, type, title, message)
    VALUES (test_collab_id, test_user_id, 'test', 'Test Diretto SQL', 'Inserimento di test via SQL');
    
    RAISE NOTICE 'Insert successful';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Insert failed: %', SQLERRM;
END $$;

-- Check if it was inserted
SELECT id, title, message, created_at FROM notifications ORDER BY created_at DESC LIMIT 3;
