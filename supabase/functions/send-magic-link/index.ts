import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import nodemailer from "npm:nodemailer"

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// --- MASTER TEMPLATE (Copied from process-notification for consistency) ---
const getMasterTemplate = (title: string, bodyContent: string, actionUrl?: string, actionText?: string) => {
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
      </div>
    </div>
    
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Gleeye Workspace. Tutti i diritti riservati.</p>
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
        const { email } = await req.json()

        if (!email) {
            return new Response(JSON.stringify({ error: 'Email is required' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            })
        }

        console.log(`Generating Magic Link for: ${email}`)

        // 1. Generate Magic Link
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: email,
            options: {
                redirectTo: 'https://gleeye-workspace.vercel.app/'
            }
        });

        if (linkError) {
            throw linkError;
        }

        const actionUrl = linkData.properties?.action_link;
        if (!actionUrl) {
            throw new Error('Failed to generate action link');
        }

        console.log('Magic Link Generated. Sending Email...');

        // 2. Prepare Email Content
        const subject = 'Invito a Collaborare su Gleeye Workspace';
        const bodyHtml = `
            <p>Ciao,</p>
            <p>Sei stato invitato ad accedere al Workspace di Gleeye.</p>
            <p>Clicca il pulsante qui sotto per accedere immediatamente senza password.</p>
            <p>Se non hai richiesto questo accesso, puoi ignorare questa email.</p>
        `;

        const finalHtml = getMasterTemplate(subject, bodyHtml, actionUrl, 'Accedi al Workspace');

        // 3. Send Email via Custom SMTP
        await sendEmail({
            to: email,
            subject: subject,
            html: finalHtml
        });

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error: any) {
        console.error('Error sending magic link:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        })
    }
})

// --- HELPERS (Copied from process-notification) ---

async function sendEmail({ to, subject, html }: { to: string, subject: string, html: string }) {
    // 1. Fetch Config from DB
    const { data: configRows } = await supabase.from('system_config')
        .select('key, value')
        .in('key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_name', 'smtp_security']);

    const config: any = {};
    configRows?.forEach((row: any) => config[row.key] = row.value);

    if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
        // Fallback to error
        throw new Error(`Configurazione SMTP incompleta.`);
    }

    const port = parseInt(config.smtp_port || '587');
    const secure = config.smtp_security === 'ssl' || port === 465;

    const transporter = nodemailer.createTransport({
        host: config.smtp_host,
        port: port,
        secure: secure,
        auth: {
            user: config.smtp_user,
            pass: config.smtp_pass,
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    await transporter.sendMail({
        from: `"${config.smtp_from_name || 'Gleeye Team'}" <${config.smtp_user}>`,
        to: to,
        subject: subject,
        html: html,
    });
}
