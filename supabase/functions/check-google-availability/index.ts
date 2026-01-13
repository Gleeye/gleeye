import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { collaborator_id, timeMin, timeMax } = await req.json()

    if (!collaborator_id || !timeMin || !timeMax) {
      throw new Error('collaborator_id, timeMin, and timeMax are required')
    }

    // 1. Get Google Auth for the collaborator
    const { data: auth, error: authError } = await supabaseClient
      .from('collaborator_google_auth')
      .select('*')
      .eq('collaborator_id', collaborator_id)
      .single()

    if (authError || !auth) throw new Error('Google connection not found for this collaborator')

    let accessToken = auth.access_token

    // 2. Check if token is expired and refresh if needed
    if (new Date(auth.expires_at) <= new Date()) {
      console.log('Token expired, refreshing...')
      const refreshedAuth = await refreshGoogleToken(auth.refresh_token)
      accessToken = refreshedAuth.access_token

      // Update DB
      const expiresAt = new Date()
      expiresAt.setSeconds(expiresAt.getSeconds() + refreshedAuth.expires_in)

      await supabaseClient
        .from('collaborator_google_auth')
        .update({
          access_token: accessToken,
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('collaborator_id', collaborator_id)
    }

    // 3. Query FreeBusy
    const calendarIds = Array.isArray(auth.selected_calendars) && auth.selected_calendars.length > 0
      ? auth.selected_calendars
      : ['primary']

    const freeBusyResponse = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: calendarIds.map(id => ({ id }))
      })
    })

    const freeBusyData = await freeBusyResponse.json()

    if (freeBusyData.error) throw new Error(`Google API error: ${freeBusyData.error.message}`)

    // 4. Extract busy intervals
    const busyIntervals = []
    for (const calId in freeBusyData.calendars) {
      const busy = freeBusyData.calendars[calId].busy || []
      busyIntervals.push(...busy)
    }

    // Sort and return
    busyIntervals.sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime())

    return new Response(JSON.stringify({ busy: busyIntervals }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})


async function refreshGoogleToken(refreshToken: string) {
  // Try to get credentials from database first, fallback to env vars
  let clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  let clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

  // Attempt to fetch from system_config table
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: configData } = await supabaseClient
      .from('system_config')
      .select('key, value')
      .in('key', ['google_client_id', 'google_client_secret'])

    if (configData && configData.length > 0) {
      const clientIdConfig = configData.find((c: any) => c.key === 'google_client_id')
      const clientSecretConfig = configData.find((c: any) => c.key === 'google_client_secret')

      if (clientIdConfig?.value) clientId = clientIdConfig.value
      if (clientSecretConfig?.value) clientSecret = clientSecretConfig.value
    }
  } catch (dbErr) {
    console.warn('Could not fetch credentials from database, using env vars:', dbErr)
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const data = await response.json()
  if (data.error) throw new Error(`Refresh token failed: ${data.error_description || data.error}`)
  return data
}
