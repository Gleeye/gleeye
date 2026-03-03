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

        const { data: typeData } = await supabase.from('notification_types').select('*').eq('key', record.type).single();
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
            const variables = { ...(record.data || {}), user_name: profile.first_name || 'Utente', notification_title: record.title, notification_message: record.message };
            const fillTemplate = (tpl: string, vars: any) => {
                if (!tpl) return '';
                return tpl.replace(/{{(\w+)}}/g, (match, key) => vars[key] !== undefined ? vars[key] : match);
            };

            const subject = fillTemplate(typeData?.email_subject_template, variables) || record.title;
            const bodyHtml = `<h2>Gleeye Workspace</h2><p>${fillTemplate(typeData?.email_body_template, variables) || record.message}</p>`;

            try {
                await sendEmail(supabase, { to: profile.email, subject, html: bodyHtml });
                await supabase.from('notifications').update({ email_status: 'sent' }).eq('id', record.id);
            } catch (err: any) {
                await supabase.from('notifications').update({ email_status: 'error', email_error: err.message }).eq('id', record.id);
            }
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
})

async function sendEmail(supabase: any, { to, subject, html }: { to: string, subject: string, html: string }) {
    const { data: configRows } = await supabase.from('system_config').select('*').like('key', 'smtp_%');
    const config: any = {};
    configRows?.forEach((r: any) => config[r.key] = r.value);
    if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) throw new Error("SMTP incomplete");
    const port = parseInt(config.smtp_port || '587');
    const secure = config.smtp_security === 'ssl' || port === 465;
    const transporter = nodemailer.createTransport({ host: config.smtp_host, port, secure, auth: { user: config.smtp_user, pass: config.smtp_pass }, tls: { rejectUnauthorized: false } });
    await transporter.sendMail({ from: `"${config.smtp_from_name || 'Gleeye System'}" <${config.smtp_user}>`, to, subject, html });
}
