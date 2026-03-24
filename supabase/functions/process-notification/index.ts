import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import nodemailer from "https://esm.sh/nodemailer@6.9.1"
import webpush from "https://esm.sh/web-push@3.6.6"

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { record, test, recipient_email } = await req.json()
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        if (test && recipient_email) {
            try {
                await sendEmail(supabase, {
                    to: recipient_email,
                    subject: 'Gleeye - Email di Test',
                    html: `<h1>Ciao!</h1><p>Questa è un'email di test dal sistema di notifiche di Gleeye.</p>`
                });
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            } catch (err: any) {
                return new Response(JSON.stringify({ success: false, error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
        }

        if (!record) throw new Error("Manca il record di notifica");

        console.log(`Processing notification ${record.id} for user ${record.user_id}`);

        const { data: typeData } = await supabase.from('notification_types').select('*').eq('key', record.type).maybeSingle();
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', record.user_id).single();
        if (!profile) throw new Error("Profilo utente non trovato");

        if (record.channel_web !== false) {
            const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', record.user_id);
            if (subs && subs.length > 0) {
                const { data: vapidKeys } = await supabase.from('system_config').select('*').in('key', ['vapid_public_key', 'vapid_private_key']);
                const pubKey = vapidKeys?.find(k => k.key === 'vapid_public_key')?.value;
                const privKey = vapidKeys?.find(k => k.key === 'vapid_private_key')?.value;

                if (pubKey && privKey) {
                    webpush.setVapidDetails('mailto:info@gleeye.eu', pubKey, privKey);
                    const payload = JSON.stringify({ title: record.title, body: record.message, data: record.data, type: record.type });
                    for (const sub of subs) {
                        try {
                            const pushSub = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
                            await webpush.sendNotification(pushSub, payload);
                        } catch (err: any) {
                            console.error(`Push failed for sub ${sub.id}:`, err.message);
                            if (err.statusCode === 410 || err.statusCode === 404) {
                                await supabase.from('push_subscriptions').delete().eq('id', sub.id);
                            }
                        }
                    }
                }
            }
        }

        let shouldSendEmail = record.channel_email || false;
        if (record.channel_email === null || record.channel_email === undefined) {
            shouldSendEmail = typeData?.default_email || false;
        }

        if (shouldSendEmail && profile.email) {
            const variables = { 
                ...(record.data || {}), 
                user_name: profile.full_name || 'Collaboratore',
                notification_title: record.title, 
                notification_message: record.message 
            };
            
            const fillTemplate = (tpl: string, vars: any) => {
                if (!tpl) return '';
                return tpl.replace(/{{(\w+)}}/g, (match, key) => vars[key] !== undefined ? vars[key] : match);
            };

            // 0. Check for External Webhook (e.g. n8n)
            if (typeData?.webhook_url) {
                console.log(`Forwarding notification to Webhook: ${typeData.webhook_url}`);
                const response = await fetch(typeData.webhook_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event_type: typeData.key,
                        variables,
                        record,
                        template: typeData,
                        recipient: profile.email,
                        guest_email: record.data?.guest_email || record.data?.email
                    })
                });
                
                if (response.ok) {
                    await supabase.from('notifications').update({ email_status: 'sent', email_error: 'Handled by external webhook' }).eq('id', record.id);
                    return new Response(JSON.stringify({ success: true, message: 'Forwarded to Webhook' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                } else {
                    const errText = await response.text();
                    throw new Error(`Webhook failed: ${errText}`);
                }
            }

            // 1. Process Internal Email (Fallback if no webhook)
            const internalSubject = fillTemplate(typeData?.email_subject_template, variables) || record.title;
            const internalBody = fillTemplate(typeData?.email_body_template, variables) || record.message;
            const internalHtml = wrapInBrandTemplate(internalBody, internalSubject);

            try {
                await sendEmail(supabase, { 
                    to: profile.email, 
                    subject: internalSubject, 
                    html: internalHtml,
                    smtpAccountId: typeData?.smtp_account_id 
                });
                await supabase.from('notifications').update({ email_status: 'sent' }).eq('id', record.id);
            } catch (err: any) {
                console.error("Internal Email failed:", err.message);
                await supabase.from('notifications').update({ email_status: 'error', email_error: err.message }).eq('id', record.id);
            }

            // 2. Process Guest Email (if applicable)
            const guestEmail = record.data?.guest_email || record.data?.email;
            if (guestEmail && typeData?.email_body_template_guest) {
                const guestVariables = { 
                    ...variables,
                    user_name: variables.guest_name || 'Cliente' // For guest, user_name usually refers to them
                };
                const guestSubject = fillTemplate(typeData?.email_subject_template_guest, guestVariables) || internalSubject;
                const guestBody = fillTemplate(typeData?.email_body_template_guest, guestVariables);
                const guestHtml = wrapInBrandTemplate(guestBody, guestSubject);

                try {
                    await sendEmail(supabase, { 
                        to: guestEmail, 
                        subject: guestSubject, 
                        html: guestHtml,
                        smtpAccountId: typeData?.smtp_account_id
                    });
                    console.log(`Guest email sent to ${guestEmail}`);
                } catch (err: any) {
                    console.error("Guest Email failed:", err.message);
                }
            }
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
})

function wrapInBrandTemplate(content: string, title?: string) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
            body { 
                font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                line-height: 1.6;
                color: #1a1f36;
                margin: 0;
                padding: 0;
                background-color: #f7fafc;
            }
            .container {
                max-width: 600px;
                margin: 40px auto;
                background: #ffffff;
                border-radius: 24px;
                overflow: hidden;
                box-shadow: 0 10px 25px rgba(0,0,0,0.05);
                border: 1px solid rgba(0,0,0,0.06);
            }
            .header {
                background: linear-gradient(135deg, #4e92d8 0%, #614aa2 100%);
                padding: 40px 20px;
                text-align: center;
                color: white;
            }
            .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 700;
                letter-spacing: -0.02em;
            }
            .content {
                padding: 40px;
            }
            .footer {
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #697386;
                background: #fafbfc;
                border-top: 1px solid #edf2f7;
            }
            .button {
                display: inline-block;
                padding: 12px 24px;
                background: linear-gradient(135deg, #4e92d8 0%, #614aa2 100%);
                color: white;
                text-decoration: none;
                border-radius: 12px;
                font-weight: 600;
                margin-top: 20px;
            }
            hr { border: 0; border-top: 1px solid #edf2f7; margin: 30px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Gleeye Workspace</h1>
            </div>
            <div class="content">
                ${title ? `<h2 style="margin-top:0; color:#1a1f36; font-size:20px;">${title}</h2>` : ''}
                ${content}
                <hr>
                <p style="font-size:14px; color:#697386;">Questo è un messaggio automatico dal tuo spazio di lavoro Gleeye.</p>
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} Gleeye. Tutti i diritti riservati.
            </div>
        </div>
    </body>
    </html>
    `;
}

async function sendEmail(supabase: any, { to, subject, html, smtpAccountId }: { to: string, subject: string, html: string, smtpAccountId?: string }) {
    const { data: configRows } = await supabase.from('system_config').select('*').like('key', 'smtp_%');
    const allConfigs: any = {};
    configRows?.forEach((r: any) => allConfigs[r.key] = r.value);

    let activeConfig: any = null;

    if (allConfigs.smtp_accounts) {
        try {
            const accounts = JSON.parse(allConfigs.smtp_accounts);
            if (Array.isArray(accounts) && accounts.length > 0) {
                if (smtpAccountId) {
                    activeConfig = accounts.find((a: any) => a.id === smtpAccountId);
                }
                // Fallback to first if not found or not specified
                if (!activeConfig) activeConfig = accounts[0];
            }
        } catch (e) {
            console.warn("Error parsing smtp_accounts:", e);
        }
    }

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
        throw new Error("SMTP incomplete");
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
}
