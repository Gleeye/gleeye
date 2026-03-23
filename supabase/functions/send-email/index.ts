import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import nodemailer from "https://esm.sh/nodemailer@6.9.1"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { to, subject, html } = await req.json()

        if (!to || !subject || !html) {
            throw new Error("Parameters 'to', 'subject', and 'html' are required.");
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Fetch SMTP configuration
        const { data: configRows, error: configError } = await supabase
            .from('system_config')
            .select('*')
            .like('key', 'smtp_%');

        if (configError) throw configError;

        const config: any = {};
        configRows?.forEach((r: any) => config[r.key] = r.value);

        if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
            throw new Error("SMTP configuration is incomplete in system_config.");
        }

        const port = parseInt(config.smtp_port || '587');
        const secure = config.smtp_security === 'ssl' || port === 465;

        const transporter = nodemailer.createTransport({
            host: config.smtp_host,
            port,
            secure,
            auth: {
                user: config.smtp_user,
                pass: config.smtp_pass
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        const fromName = config.smtp_from_name || 'Gleeye System';
        
        await transporter.sendMail({
            from: `"${fromName}" <${config.smtp_user}>`,
            to,
            subject,
            html
        });

        return new Response(JSON.stringify({ success: true, message: "Email sent successfully" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (err: any) {
        console.error("Error sending email:", err);
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
