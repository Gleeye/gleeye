
curl -X POST https://whpbetjyhpttinbxcffs.supabase.co/functions/v1/check-google-availability \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTQzMjcsImV4cCI6MjA4MjkzMDMyN30.cwGACRAp_aLaXKHrSVcZKHz0tX1zvvHb_xGHNHxJxu8" \
  -H "Content-Type: application/json" \
  -d '{
    "collaborator_id": "61810c9c-ab9e-4c2e-9c16-2ab2f9823301",
    "timeMin": "2026-01-19T00:00:00Z",
    "timeMax": "2026-01-19T23:59:59Z"
  }'
