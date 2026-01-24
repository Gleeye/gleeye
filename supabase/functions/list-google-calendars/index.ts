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

    const { collaborator_id } = await req.json()

    if (!collaborator_id) throw new Error('collaborator_id is required')

    // 1. Get Google Auth
    const { data: auth, error: authError } = await supabaseClient
      .from('collaborator_google_auth')
      .select('*')
      .eq('collaborator_id', collaborator_id)
      .single()

    if (authError || !auth) throw new Error('Google connection not found')

    let accessToken = auth.access_token

    // 2. Refresh token if needed
    if (new Date(auth.expires_at) <= new Date()) {
      const refreshedAuth = await refreshGoogleToken(auth.refresh_token)
      accessToken = refreshedAuth.access_token

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

    // 3. List Calendars
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    const data = await response.json()

    if (data.error) throw new Error(`Google API error: ${data.error.message}`)

    return new Response(JSON.stringify({ items: data.items }), {
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
