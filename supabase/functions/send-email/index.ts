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

        const allConfigs: any = {};
        configRows?.forEach((r: any) => allConfigs[r.key] = r.value);

        let activeConfig: any = null;

        // Try to load from smtp_accounts JSON
        if (allConfigs.smtp_accounts) {
            try {
                const accounts = JSON.parse(allConfigs.smtp_accounts);
                if (Array.isArray(accounts) && accounts.length > 0) {
                    // Use first account as default for now
                    activeConfig = accounts[0];
                }
            } catch (e) {
                console.warn("Error parsing smtp_accounts JSON:", e);
            }
        }

        // Fallback to legacy single config if no activeConfig from array
        if (!activeConfig) {
            if (allConfigs.smtp_host && allConfigs.smtp_user && allConfigs.smtp_pass) {
                activeConfig = {
                    host: allConfigs.smtp_host,
                    port: allConfigs.smtp_port,
                    security: allConfigs.smtp_security,
                    from_name: allConfigs.smtp_from_name,
                    user: allConfigs.smtp_user,
                    pass: allConfigs.smtp_pass
                };
            }
        }

        if (!activeConfig || !activeConfig.host || !activeConfig.user || !activeConfig.pass) {
            throw new Error("SMTP configuration is missing or incomplete in system_config.");
        }

        const port = parseInt(activeConfig.port || '587');
        const secure = activeConfig.security === 'ssl' || port === 465;

        const transporter = nodemailer.createTransport({
            host: activeConfig.host,
            port,
            secure,
            auth: {
                user: activeConfig.user,
                pass: activeConfig.pass
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        const fromName = activeConfig.from_name || 'Gleeye System';
        
        await transporter.sendMail({
            from: `"${fromName}" <${activeConfig.user}>`,
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
