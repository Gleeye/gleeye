import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const payload = await req.json()
        console.log("[SyncAppt] Payload:", payload)

        const { appointment_id, action = 'create' } = payload
        if (!appointment_id) throw new Error("Missing appointment_id")

        // 1. Fetch Appointment with Participants
        const { data: appt, error: apptError } = await supabaseClient
            .from('appointments')
            .select(`
        *,
        appointment_types ( name ),
        appointment_internal_participants (
            collaborator_id,
            collaborators ( user_id )
        ),
        appointment_client_participants (
            contacts ( full_name, email )
        )
      `)
            .eq('id', appointment_id)
            .single()

        if (apptError || !appt) throw new Error("Appointment not found")

        // 2. Identify Target Users (Internal Participants with User IDs)
        const targetUserIds = appt.appointment_internal_participants
            .map((p: any) => p.collaborators?.user_id)
            .filter((uid: string) => !!uid)

        if (targetUserIds.length === 0) {
            return new Response(JSON.stringify({ message: "No internal participants to sync" }), { headers: corsHeaders })
        }

        // 3. For each user, check Google Auth and Sync
        const results = []

        for (const userId of targetUserIds) {
            try {
                // A. Check Auth
                // Note: We need to find the COLLABORATOR record for this user to get auth? 
                // Or is auth stored by user_id?
                // Checking schema: collaborator_google_auth has `collaborator_id`.
                // So we need to map userId -> collaboratorId (we have it in `p`).
                const collaboratorId = appt.appointment_internal_participants.find((p: any) => p.collaborators.user_id === userId)?.collaborator_id

                const { data: authParams } = await supabaseClient
                    .from('collaborator_google_auth')
                    .select('*')
                    .eq('collaborator_id', collaboratorId)
                    .single()

                if (!authParams) {
                    results.push({ userId, status: 'skipped_no_auth' })
                    continue
                }

                // B. Refresh Token Code (Duplicated for standalone)
                let accessToken = authParams.access_token
                if (authParams.refresh_token) {
                    const now = new Date()
                    const expiry = new Date(authParams.expires_at || 0)
                    if (now >= expiry) {
                        console.log(`[SyncAppt] Refreshing token for ${userId}`)
                        // Fetch Client Config
                        const { data: configData } = await supabaseClient
                            .from('system_config')
                            .select('key, value')
                            .in('key', ['google_client_id', 'google_client_secret'])

                        const clientId = configData?.find(c => c.key === 'google_client_id')?.value || Deno.env.get('GOOGLE_CLIENT_ID')
                        const clientSecret = configData?.find(c => c.key === 'google_client_secret')?.value || Deno.env.get('GOOGLE_CLIENT_SECRET')

                        if (clientId && clientSecret) {
                            const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                                body: new URLSearchParams({
                                    client_id: clientId,
                                    client_secret: clientSecret,
                                    refresh_token: authParams.refresh_token,
                                    grant_type: 'refresh_token',
                                }),
                            })
                            const refreshData = await refreshRes.json()
                            if (refreshData.access_token) {
                                accessToken = refreshData.access_token
                                // Save
                                const newExpiry = new Date()
                                newExpiry.setSeconds(newExpiry.getSeconds() + refreshData.expires_in)
                                await supabaseClient.from('collaborator_google_auth').update({
                                    access_token: accessToken,
                                    expires_at: newExpiry.toISOString(),
                                    updated_at: new Date().toISOString()
                                }).eq('collaborator_id', collaboratorId)
                            }
                        }
                    }
                }

                // C. Check Existing Sync Record
                const { data: syncRecord } = await supabaseClient
                    .from('appointment_google_sync')
                    .select('*')
                    .eq('appointment_id', appointment_id)
                    .eq('user_id', userId)
                    .single()

                // D. Perform Action
                if (action === 'delete') {
                    if (syncRecord?.google_event_id) {
                        await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${syncRecord.google_event_id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${accessToken}` }
                        });
                        // Remove sync record
                        await supabaseClient.from('appointment_google_sync').delete().eq('id', syncRecord.id);
                        results.push({ userId, status: 'deleted' })
                    }
                } else {
                    // Create/Update
                    const summary = `${appt.title}`
                    const description = `${appt.note || ''}\n\nClienti: ${appt.appointment_client_participants.map((cp: any) => cp.contacts.full_name).join(', ')}`

                    const eventBody = {
                        summary: summary,
                        description: description,
                        location: appt.location,
                        start: { dateTime: appt.start_time },
                        end: { dateTime: appt.end_time },
                    }

                    let googleEventId = syncRecord?.google_event_id;
                    let apiMethod = 'POST';
                    let apiUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

                    if (googleEventId) {
                        apiMethod = 'PUT'; // or PATCH
                        apiUrl = `${apiUrl}/${googleEventId}`;
                    }

                    const googleRes = await fetch(apiUrl, {
                        method: apiMethod,
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(eventBody)
                    });

                    const googleData = await googleRes.json();
                    if (googleData.error) throw new Error(googleData.error.message);

                    googleEventId = googleData.id;

                    // Update Sync Table
                    const { error: upsertError } = await supabaseClient.from('appointment_google_sync').upsert({
                        appointment_id: appointment_id,
                        user_id: userId,
                        google_event_id: googleEventId, // This is explicitly required
                        google_calendar_id: 'primary', // Default
                        last_synced_at: new Date().toISOString(),
                        status: 'synced',
                        error_message: null
                    }, { onConflict: 'appointment_id,user_id' });

                    if (upsertError) console.error("Upsert Error", upsertError);

                    results.push({ userId, status: 'synced', eventId: googleEventId });
                }

            } catch (err: any) {
                console.error(`[SyncAppt] Error for user ${userId}:`, err)
                results.push({ userId, status: 'error', error: err.message })

                // Log error to sync table if record exists or create one?
                // Maybe later.
            }
        }

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error: any) {
        console.error("Sync Error:", error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
