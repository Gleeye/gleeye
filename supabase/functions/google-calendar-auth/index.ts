import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { collaborator_id, code, redirect_uri } = await req.json()

    if (!collaborator_id || !code) {
      throw new Error('collaborator_id and code are required')
    }

    // Try to get credentials from database first, fallback to env vars
    let clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    let clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

    // Attempt to fetch from system_config table
    try {
      const { data: configData } = await supabaseClient
        .from('system_config')
        .select('key, value')
        .in('key', ['google_client_id', 'google_client_secret'])

      if (configData && configData.length > 0) {
        const clientIdConfig = configData.find(c => c.key === 'google_client_id')
        const clientSecretConfig = configData.find(c => c.key === 'google_client_secret')

        if (clientIdConfig?.value) clientId = clientIdConfig.value
        if (clientSecretConfig?.value) clientSecret = clientSecretConfig.value
      }
    } catch (dbErr) {
      console.warn('Could not fetch credentials from database, using env vars:', dbErr)
    }

    if (!clientId || !clientSecret) {
      throw new Error('Google configuration missing (client_id or client_secret). Please configure in Admin → Calendari Esterni.')
    }

    // 1. Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenResponse.json()

    if (tokens.error) {
      console.error('Google Token error:', tokens)
      throw new Error(`Google error: ${tokens.error_description || tokens.error}`)
    }

    // 2. Save/Update tokens in DB
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in)

    const { data, error: dbError } = await supabaseClient
      .from('collaborator_google_auth')
      .upsert({
        collaborator_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token, // Only sent on first time or if prompt=consent
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      }, { on_conflict: 'collaborator_id' })
      .select()

    if (dbError) throw dbError

    return new Response(JSON.stringify({ success: true, data }), {
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

