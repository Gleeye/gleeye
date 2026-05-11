console.log('Fetching raw assignments...');
const cid = state.profile?.id;
if(cid) {
  supabase.from('assignments').select('id, status, description, created_at').eq('collaborator_id', cid).limit(10).then(res => console.log('Raw Assignments:', res));
} else {
  console.log('No collaborator ID found in state.');
}
