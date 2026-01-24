// No import needed for Deno.serve
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-auth, x-supabase-client-platform, x-supabase-client-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { collaborator_id, collaborator_ids, timeMin, timeMax } = await req.json()

    if ((!collaborator_id && !collaborator_ids) || !timeMin || !timeMax) {
      throw new Error('collaborator_id(s), timeMin, and timeMax are required')
    }

    const targetIds = collaborator_ids
      ? (Array.isArray(collaborator_ids) ? collaborator_ids : [collaborator_ids]) as string[]
      : [collaborator_id as string];

    if (targetIds.length === 0) {
      return new Response(JSON.stringify({ busy: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // 1. Get Google Auth for ALL collaborators
    const { data: auths, error: authError } = await supabaseClient
      .from('collaborator_google_auth')
      .select('*')
      .in('collaborator_id', targetIds)

    if (authError) throw new Error(`Database error: ${authError.message}`)

    // If no auth records found for any requested ID
    if (!auths || auths.length === 0) {
      return new Response(JSON.stringify({ busy: [], error: 'NOT_CONNECTED' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Helper function to process single user (refresh token + fetch busy)
    const processUser = async (auth: any) => {
      try {
        let accessToken = auth.access_token

        // Check expiry & Refresh if needed
        if (new Date(auth.expires_at) <= new Date()) {
          console.log(`Token expired for ${auth.collaborator_id}, refreshing...`)
          try {
            const refreshedAuth = await refreshGoogleToken(auth.refresh_token, supabaseClient)
            accessToken = refreshedAuth.access_token

            // Update DB 
            const expiresAt = new Date()
            expiresAt.setSeconds(expiresAt.getSeconds() + refreshedAuth.expires_in)
            await supabaseClient.from('collaborator_google_auth').update({
              access_token: accessToken,
              expires_at: expiresAt.toISOString(),
              updated_at: new Date().toISOString()
            }).eq('collaborator_id', auth.collaborator_id)

          } catch (refreshErr) {
            console.error(`Failed to refresh token for ${auth.collaborator_id}`, refreshErr)
            // Return a special error marker so the client knows auth is broken
            return [{ error: 'AUTH_ERROR', collaborator_id: auth.collaborator_id }]
          }
        }

        // Query FreeBusy
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
            items: calendarIds.map((id: string) => ({ id }))
          })
        })

        if (!freeBusyResponse.ok) {
          const errTxt = await freeBusyResponse.text()
          console.error(`Google API error for ${auth.collaborator_id}: ${freeBusyResponse.status}`, errTxt)
          return [{ error: 'API_ERROR', details: `${freeBusyResponse.status} - ${errTxt}` }]
        }

        const freeBusyData = await freeBusyResponse.json()

        // Extract busy intervals
        const userBusy: any[] = []
        for (const calId in freeBusyData.calendars) {
          const busy = freeBusyData.calendars[calId].busy || []
          userBusy.push(...busy.map((b: any) => ({
            ...b,
            collaborator_id: auth.collaborator_id
          })))
        }
        return userBusy

      } catch (err) {
        console.error(`Error processing collaborator ${auth.collaborator_id}`, err)
        return []
      }
    }

    // 2. Process all in parallel
    const results = await Promise.all(auths.map(processUser));
    const allBusy = results.flat().sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime())

    return new Response(JSON.stringify({ busy: allBusy }), {
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

// Helper for refresh token
async function refreshGoogleToken(refreshToken: string, supabaseClient: any) {
  // First try to fetch from system_config table (Admin Panel settings)
  let clientId: string | undefined
  let clientSecret: string | undefined

  try {
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
    console.warn('Could not fetch credentials from database:', dbErr)
  }

  // Fallback to env vars if not found in DB
  if (!clientId) clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  if (!clientSecret) clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error('Missing Google Credentials - check Admin Panel or Env Vars')
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
