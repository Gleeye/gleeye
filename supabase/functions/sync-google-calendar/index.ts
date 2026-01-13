
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

    // Expected payload from Database Webhook or direct call
    const payload = await req.json()
    console.log("Payload received:", payload)

    // Handle both direct call { booking_id } and webhook { record: { booking_id ... } }
    let bookingId = payload.booking_id
    let collaboratorId = payload.collaborator_id

    if (payload.record) {
      // It's a webhook from booking_assignments
      bookingId = payload.record.booking_id
      collaboratorId = payload.record.collaborator_id
    }

    if (!bookingId || !collaboratorId) {
      throw new Error("Missing booking_id or collaborator_id")
    }

    // 1. Fetch Booking Details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('*, booking_items(name)')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) throw new Error("Booking not found")

    // 2. Fetch Collaborator Google Auth
    const { data: authParams, error: authError } = await supabaseClient
      .from('collaborator_google_auth')
      .select('*')
      .eq('collaborator_id', collaboratorId)
      .single()

    if (authError || !authParams) {
      console.log("No Google Auth for collaborator, skipping sync.")
      return new Response(JSON.stringify({ message: "No Google Auth found, skipped" }), { headers: corsHeaders })
    }

    // 3. Get Google Calendar Config (Client ID/Secret)
    let clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    let clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

    const { data: configData } = await supabaseClient
      .from('system_config')
      .select('key, value')
      .in('key', ['google_client_id', 'google_client_secret'])

    if (configData) {
      const cId = configData.find(c => c.key === 'google_client_id')?.value
      const cSec = configData.find(c => c.key === 'google_client_secret')?.value
      if (cId) clientId = cId
      if (cSec) clientSecret = cSec
    }

    if (!clientId || !clientSecret) throw new Error("Missing Google Client Config")

    // 4. Refresh Token if needed (Simple check: always refresh if we have a refresh token to be safe, or check expiry)
    // For robustness, let's blindly try to use access_token, and if 401, refresh.
    // Actually, safest is to check expiry if available, but let's just refresh if we have a refresh token.
    let accessToken = authParams.access_token

    if (authParams.refresh_token) {
      // Check if expired
      const now = new Date()
      const expiry = new Date(authParams.expires_at || 0)

      if (now >= expiry) {
        console.log("Token expired, refreshing...")
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
        if (refreshData.error) throw new Error(`Refresh failed: ${refreshData.error_description}`)

        accessToken = refreshData.access_token

        // Save new token
        const newExpiry = new Date()
        newExpiry.setSeconds(newExpiry.getSeconds() + refreshData.expires_in)
        await supabaseClient.from('collaborator_google_auth').update({
          access_token: accessToken,
          expires_at: newExpiry.toISOString(),
          updated_at: new Date().toISOString()
        }).eq('collaborator_id', collaboratorId)
      }
    }

    // 5. Create Event
    const summary = `${booking.booking_items?.name || 'Prenotazione'} - ${booking.guest_info?.first_name} ${booking.guest_info?.last_name}`
    const description = `Prenotazione ID: ${booking.id}\nNote: ${booking.notes || 'Nessuna nota'}\nCliente: ${booking.guest_info?.first_name} ${booking.guest_info?.last_name} (${booking.guest_info?.email})`

    const eventBody = {
      summary: summary,
      description: description,
      start: { dateTime: booking.start_time }, // ISO string works
      end: { dateTime: booking.end_time },
    }

    const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventBody)
    })

    const eventData = await createRes.json()

    if (eventData.error) {
      throw new Error(`Google Calendar Error: ${eventData.error.message}`)
    }

    console.log("Event created:", eventData.id)

    // 6. Update Booking with Event ID
    await supabaseClient.from('bookings').update({
      google_event_id: eventData.id
    }).eq('id', bookingId)

    return new Response(JSON.stringify({ success: true, eventId: eventData.id }), {
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
