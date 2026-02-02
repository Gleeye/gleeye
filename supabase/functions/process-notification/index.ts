import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import nodemailer from "npm:nodemailer"

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// --- MASTER TEMPLATE ---
const getMasterTemplate = (title: string, bodyContent: string, actionUrl?: string, actionText?: string, calendarLinks?: { google: string, outlook: string, ics: string }) => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap');
    body { margin: 0; padding: 0; background-color: #fafbfc; font-family: 'Poppins', sans-serif; color: #1a1f36; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: 600; color: #1a1f36; letter-spacing: -0.5px; text-decoration: none; }
    .card { background: white; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid rgba(0,0,0,0.04); }
    .card-header { background: linear-gradient(135deg, #4e92d8 0%, #614aa2 100%); padding: 30px; text-align: center; }
    .card-title { margin: 0; color: white; font-size: 20px; font-weight: 500; }
    .card-body { padding: 40px 30px; line-height: 1.6; font-size: 15px; color: #4a5568; }
    .btn { display: inline-block; background: #4e92d8; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500; margin-top: 20px; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #a0aec0; }
    .footer a { color: #4e92d8; text-decoration: none; }
    ul { padding-left: 20px; }
    li { margin-bottom: 8px; }
    strong { color: #1a1f36; font-weight: 600; }
    .calendar-links { margin-top: 30px; border-top: 1px solid #edf2f7; padding-top: 20px; text-align: center; }
    .calendar-link { display: inline-block; margin: 0 5px; color: #4a5568; text-decoration: none; font-size: 13px; padding: 8px 12px; background: #f7fafc; border-radius: 6px; border: 1px solid #edf2f7; }
    .calendar-link:hover { background: #edf2f7; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="https://www.gleeye.eu" class="logo">
        <img src="https://i0.wp.com/www.gleeye.eu/wp-content/uploads/2023/01/gleeyescontornato-e1673556744175.png" alt="Gleeye Workspace" style="height: 40px; margin-bottom: 10px;">
      </a>
    </div>
    
    <div class="card">
      <div class="card-header">
        <h1 class="card-title">${title}</h1>
      </div>
      <div class="card-body">
        ${bodyContent}
        
        ${actionUrl && actionText ? `
          <div style="text-align: center;">
            <a href="${actionUrl}" class="btn">${actionText}</a>
          </div>
        ` : ''}

        ${calendarLinks ? `
          <div class="calendar-links">
            <p style="font-size: 12px; color: #a0aec0; margin-bottom: 10px;">Aggiungi al calendario:</p>
            <a href="${calendarLinks.google}" class="calendar-link">Google</a>
            <a href="${calendarLinks.outlook}" class="calendar-link">Outlook</a>
          </div>
        ` : ''}
      </div>
    </div>
    
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Gleeye Workspace. Tutti i diritti riservati.</p>
      <p>Questa è una notifica automatica. <a href="#">Gestisci preferenze</a></p>
    </div>
  </div>
</body>
</html>
  `;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { record, test, recipient_email } = await req.json()

        // Handle Test Email
        if (test && recipient_email) {
            try {
                await sendEmail({
                    to: recipient_email,
                    subject: 'Gleeye - Email di Test',
                    html: getMasterTemplate('Test Configurazione', '<p>Se leggi questa email, la configurazione SMTP funziona correttamente!</p><p>Il brand system è stato applicato con successo.</p>', '#', 'Accedi alla Dashboard')
                });
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200
                })
            } catch (smtpErr: any) {
                return new Response(JSON.stringify({ success: false, error: smtpErr.message }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200
                })
            }
        }

        if (!record || record.email_status !== 'queued') {
            return new Response(JSON.stringify({ message: 'No queued email found' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            })
        }

        console.log(`Processing notification: ${record.id} (${record.type})`)

        // 1. Check Preferences
        // Default to sending if we can't determine otherwise, unless logic says no
        let shouldSendEmail = true;

        // Fetch Notification Type defaults
        const { data: typeData } = await supabase
            .from('notification_types')
            .select('default_email, id')
            .eq('key', record.type)
            .single();

        if (typeData) {
            shouldSendEmail = typeData.default_email;

            // Check User Override
            if (record.user_id) {
                const { data: prefData } = await supabase
                    .from('user_notification_preferences')
                    .select('email_enabled')
                    .eq('user_id', record.user_id)
                    .eq('notification_type_id', typeData.id)
                    .single();

                if (prefData) {
                    shouldSendEmail = prefData.email_enabled;
                }
            }
        }

        if (!shouldSendEmail) {
            console.log(`Email skipped for ${record.id} due to preferences.`);
            await updateStatus(record.id, 'skipped');
            return new Response(JSON.stringify({ skipped: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        // 2. Prepare Content - Dynamic Template Logic
        const variables: any = {
            today: new Date().toLocaleDateString('it-IT')
        };

        if (record.data) {
            // Flatten basic data
            for (const [key, val] of Object.entries(record.data)) {
                if (typeof val === 'string' || typeof val === 'number') {
                    variables[key] = val;
                }
            }
            // Date Format Helpers
            if (record.data.start_time) {
                const d = new Date(record.data.start_time);
                variables['date'] = d.toLocaleDateString('it-IT');
                variables['time'] = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                variables['start_time'] = variables['time'];
            }
            if (record.data.end_time) {
                const ends = new Date(record.data.end_time);
                variables['end_time'] = ends.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                variables['time_range'] = `${variables['start_time']} - ${variables['end_time']}`;
            }
        }

        // Helper: Replace {{key}}
        const fillTemplate = (tpl: string, vars: any) => {
            if (!tpl) return '';
            return tpl.replace(/{{(\w+)}}/g, (match, key) => {
                return vars[key] !== undefined ? vars[key] : match;
            });
        };

        let subject = fillTemplate(typeData?.email_subject_template, variables) || record.title;
        let bodyHtml = fillTemplate(typeData?.email_body_template, variables) || `<p>${record.message}</p>`;

        // Fallback for types without templates (safety)
        if (!typeData?.email_subject_template && record.type === 'booking_new') {
            subject = `📅 Nuova Prenotazione: ${record.data.guest_name}`;
            // ... keep old fallback if strictly needed, but DB seed should cover it.
        }

        let actionUrl = 'https://gleeye-workspace.vercel.app';
        let actionText = 'Accedi alla Dashboard';

        if (record.type === 'booking_new') {
            actionUrl += '/#booking';
            actionText = 'Vai alle Prenotazioni';
        } else if (record.type === 'invoice_overdue') {
            actionUrl += '/#invoices';
            actionText = 'Vedi Fatture';
        }

        // 3. Send
        const guestEmail = record.data?.guest_email;

        // ... (Recipient Logic remains same)
        let recipientEmail = null;
        if (record.user_id) {
            const { data: userData, error: userError } = await supabase.auth.admin.getUserById(record.user_id);
            if (userData?.user) {
                recipientEmail = userData.user.email;
            }
        }



        // Fallback recipient
        if (!recipientEmail) {
            console.log('No recipient email found for user_id:', record.user_id);
            if (record.data && record.data.recipient_email) recipientEmail = record.data.recipient_email;
            else {
                await updateStatus(record.id, 'failed', { error: 'No recipient email found' });
                return new Response(JSON.stringify({ error: 'No recipient' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200
                });
            }
        }

        const finalHtml = getMasterTemplate(subject, bodyHtml, actionUrl, actionText);

        try {
            // 1. Send to Collaborator
            await sendEmail({
                to: recipientEmail,
                subject: subject,
                html: finalHtml
            });

            // 2. Send to Guest (if applicable)
            if (record.type === 'booking_new' && record.data?.guest_email) {
                // Fetch Guest Template (if exists) -> NOW we use new columns
                const { data: typeGuestData } = await supabase
                    .from('notification_types')
                    .select('email_subject_template_guest, email_body_template_guest, default_email_guest')
                    .eq('key', record.type)
                    .single();

                const guestEnabled = typeGuestData?.default_email_guest !== false; // Default true if null

                if (guestEnabled) {
                    let guestSubject = fillTemplate(typeGuestData?.email_subject_template_guest, variables) || `Conferma Prenotazione: ${record.data.service_name}`;

                    // Fallback Body if DB empty (Safety)
                    let guestBodyRaw = typeGuestData?.email_body_template_guest;
                    if (!guestBodyRaw) {
                        guestBodyRaw = `<p>Gentile {{guest_name}}, conferma prenotazione per {{service_name}} il {{date}} alle {{start_time}}.</p>`;
                    }

                    let guestBodyHtml = fillTemplate(guestBodyRaw, variables);

                    // Add Calendar Links Logic if specific tag present or append? 
                    // Usually user wants standard template + calendar links. 
                    // Let's generate links first
                    const formatDateVEvent = (dateStr: string) => {
                        return dateStr.replace(/[-:]/g, '').split('.')[0] + 'Z';
                    };
                    const startTime = new Date(record.data.start_time).toISOString();
                    const endTime = new Date(record.data.end_time).toISOString();

                    const googleLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(record.data.service_name)}&details=${encodeURIComponent('Prenotazione con Gleeye')}&dates=${formatDateVEvent(startTime)}/${formatDateVEvent(endTime)}`;
                    const outlookLink = `https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(record.data.service_name)}&body=${encodeURIComponent('Prenotazione con Gleeye')}&startdt=${startTime}&enddt=${endTime}`;

                    // Send Email
                    const guestFinalHtml = getMasterTemplate(guestSubject, guestBodyHtml, '', '', {
                        google: googleLink,
                        outlook: outlookLink,
                        ics: '#'
                    });

                    console.log(`Sending confirmation to guest: ${record.data.guest_email}`);
                    await sendEmail({
                        to: record.data.guest_email,
                        subject: guestSubject,
                        html: guestFinalHtml
                    });
                } else {
                    console.log('Guest email disabled by configuration.');
                }
            }

            await updateStatus(record.id, 'sent', { sent_to: recipientEmail, sent_to_guest: record.data?.guest_email });
        } catch (err: any) {
            console.error("SMTP Error:", err);
            await updateStatus(record.id, 'failed', { error: err.message });
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error: any) {
        console.error('Error processing notification:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        })
    }
})

// --- HELPERS ---

async function updateStatus(id: string, status: string, metaUpdates: any = {}) {
    await supabase.from('notifications').update({
        email_status: status,
        metadata: { ...metaUpdates, updated_at: new Date().toISOString() }
    }).eq('id', id);
}

async function sendEmail({ to, subject, html }: { to: string, subject: string, html: string }) {
    // 1. Fetch Config from DB
    const { data: configRows } = await supabase.from('system_config')
        .select('key, value')
        .in('key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_name', 'smtp_security']);

    const config: any = {};
    configRows?.forEach((row: any) => config[row.key] = row.value);

    if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
        const missing = [];
        if (!config.smtp_host) missing.push("Host");
        if (!config.smtp_user) missing.push("User");
        if (!config.smtp_pass) missing.push("Password");
        throw new Error(`Configurazione SMTP incompleta nel database (Mancano: ${missing.join(', ')})`);
    }

    const port = parseInt(config.smtp_port || '587');
    const secure = config.smtp_security === 'ssl' || port === 465;

    console.log(`Configuring nodemailer for ${config.smtp_host}:${port} (Secure: ${secure})`);

    const transporter = nodemailer.createTransport({
        host: config.smtp_host,
        port: port,
        secure: secure,
        auth: {
            user: config.smtp_user,
            pass: config.smtp_pass,
        },
        // For self-signed certificates or similar issues
        tls: {
            rejectUnauthorized: false
        }
    });

    try {
        await transporter.sendMail({
            from: `"${config.smtp_from_name || 'Gleeye System'}" <${config.smtp_user}>`,
            to: to,
            subject: subject,
            html: html,
        });
        console.log(`Email successfully sent to ${to}`);
    } catch (err: any) {
        console.error("Nodemailer Error:", err.message);
        throw new Error(`Errore invio: ${err.message}`);
    }
}
