import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Get all admins
        const { data: admins, error: fetchErr } = await supabaseAdmin
            .from('collaborators')
            .select('user_id, tags')
            .not('user_id', 'is', null)

        if (fetchErr) throw fetchErr

        const adminIds = admins
            .filter(c => {
                let t = c.tags;
                if (typeof t === 'string') {
                    try { t = JSON.parse(t); } catch (e) { t = t.split(',').map(s => s.trim()); }
                }
                return Array.isArray(t) && t.some(tag => tag.toLowerCase() === 'amministrazione');
            })
            .map(c => c.user_id)

        if (adminIds.length === 0) {
            return new Response(JSON.stringify({ message: 'No admins found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // 2. Create notifications
        const notifications = adminIds.map(uid => ({
            user_id: uid,
            type: 'general',
            title: 'Prima Nota Inviata',
            message: 'La prima nota è stata inviata al commercialista.',
        }))

        const { error: insertErr } = await supabaseAdmin
            .from('notifications')
            .insert(notifications)

        if (insertErr) throw insertErr

        return new Response(JSON.stringify({ success: true, notified: adminIds.length }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
