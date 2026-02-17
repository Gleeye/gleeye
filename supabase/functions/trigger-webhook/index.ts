import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { webhookUrl, payload } = await req.json()

        if (!webhookUrl) {
            return new Response(JSON.stringify({ error: 'webhookUrl is required' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            })
        }

        console.log(`Triggering webhook: ${webhookUrl}`)

        // Create a controller to handle timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds timeout before returning 'accepted'

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload || {}),
                signal: controller.signal
            })

            clearTimeout(timeoutId);
            const result = await response.text()

            // If n8n says it started but has no respond node, it's a success for us (background start)
            if (result.includes("No Respond to Webhook node found") || result.includes("Workflow was started")) {
                return new Response('accepted', {
                    headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
                    status: 200,
                })
            }

            return new Response(result, {
                headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
                status: 200,
            })
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log("Webhook call is taking long, returning 'accepted' to client.");
                return new Response('accepted', {
                    headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
                    status: 200,
                })
            }
            throw error;
        }
    } catch (error) {
        console.error(`Edge Function Error: ${error.message}`)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
