// Mina 6 Step 6 — NPS survey feedback cliente
// Vista order-detail: card "Feedback cliente" + bottone "Chiedi feedback NPS"

import { supabase } from '/js/modules/config.js?v=8000';
import { state } from '/js/modules/state.js?v=8000';

const SCORE_COLOR = score => {
    if (score >= 9) return '#10b981'; // promoter
    if (score >= 7) return '#f59e0b'; // passive
    return '#ef4444'; // detractor
};

const SCORE_LABEL = score => {
    if (score >= 9) return 'Promoter';
    if (score >= 7) return 'Passive';
    return 'Detractor';
};

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

export async function populateNpsCard(order) {
    const body = document.getElementById(`nps-body-${order.id}`);
    if (!body) return;

    const { data: surveys, error } = await supabase
        .from('nps_surveys')
        .select('id, score, comment, sent_at, completed_at, expires_at, to_email')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        body.innerHTML = `<span style="color:#ef4444;">Errore: ${escapeHtml(error.message)}</span>`;
        return;
    }

    const latest = surveys?.[0];

    if (!latest) {
        body.innerHTML = `
            <div style="color:var(--text-secondary);margin-bottom:.85rem;">
                Nessun feedback ancora richiesto per questa commessa.
            </div>
            <button onclick="window.requestNpsFeedback('${order.id}')" class="primary-btn"
                style="width:100%;justify-content:center;gap:.5rem;background:#3b82f6;color:#fff;border:none;padding:.7rem;border-radius:10px;font-weight:600;cursor:pointer;">
                <span class="material-icons-round">send</span> Chiedi feedback NPS
            </button>
        `;
        return;
    }

    if (latest.completed_at) {
        const color = SCORE_COLOR(latest.score);
        const label = SCORE_LABEL(latest.score);
        body.innerHTML = `
            <div style="display:flex;align-items:baseline;gap:.65rem;margin-bottom:.5rem;">
                <span style="font-size:2rem;font-weight:800;color:${color};line-height:1;">${latest.score}</span>
                <span style="font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:${color};font-weight:700;">${label}</span>
                <span style="font-size:.7rem;color:var(--text-tertiary);">/10</span>
            </div>
            ${latest.comment ? `<div style="background:var(--bg-tertiary);padding:.75rem;border-radius:8px;font-size:.85rem;color:var(--text-primary);margin-bottom:.5rem;font-style:italic;">"${escapeHtml(latest.comment)}"</div>` : ''}
            <div style="font-size:.7rem;color:var(--text-tertiary);">
                Risposta ricevuta il ${formatDate(latest.completed_at)}
            </div>
        `;
        return;
    }

    // Survey inviata, in attesa di risposta
    const isExpired = new Date(latest.expires_at) < new Date();
    body.innerHTML = `
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;">
            <span style="font-size:.7rem;padding:.2rem .55rem;border-radius:999px;background:${isExpired ? '#fee2e2' : '#fef3c7'};color:${isExpired ? '#dc2626' : '#d97706'};font-weight:600;text-transform:uppercase;">${isExpired ? 'Scaduto' : 'In attesa'}</span>
            <span style="font-size:.75rem;color:var(--text-secondary);">
                ${isExpired ? `Scaduto il ${formatDate(latest.expires_at)}` : `Inviato il ${formatDate(latest.sent_at || latest.created_at)} a ${escapeHtml(latest.to_email || '—')}`}
            </span>
        </div>
        <button onclick="window.requestNpsFeedback('${order.id}', true)"
            style="width:100%;background:none;border:1px dashed var(--glass-border);color:var(--text-secondary);padding:.55rem;border-radius:8px;font-size:.8rem;cursor:pointer;">
            ${isExpired ? 'Invia nuovo' : 'Rinvia / nuovo link'}
        </button>
    `;
}

window.requestNpsFeedback = async function (orderId, isResend) {
    const { data: order, error: oErr } = await supabase
        .from('orders')
        .select('id, order_number, title, client_id, account_id, pm_id')
        .eq('id', orderId)
        .single();
    if (oErr || !order) { alert('Errore lettura ordine: ' + (oErr?.message || 'not found')); return; }

    if (!order.client_id) { alert('Manca il cliente sulla commessa.'); return; }

    const { data: client } = await supabase
        .from('clients')
        .select('id, business_name, email')
        .eq('id', order.client_id)
        .single();
    if (!client) { alert('Cliente non trovato.'); return; }

    const defaultEmail = client.email || '';
    const toEmail = prompt(`Email destinatario NPS:`, defaultEmail);
    if (!toEmail) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
        alert('Email non valida.');
        return;
    }

    const senderUserId = order.account_id || order.pm_id || state.profile?.id;
    let senderName = null;
    let senderEmail = null;
    if (senderUserId) {
        const { data: p } = await supabase
            .from('profiles')
            .select('full_name, first_name, last_name, email')
            .eq('id', senderUserId)
            .single();
        if (p) {
            senderName = p.full_name || ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || p.email;
            senderEmail = p.email;
        }
    }
    senderName = senderName || 'Il team Gleeye';

    if (!confirm(`Inviare la survey NPS a ${toEmail}?\nMittente: ${senderName}`)) return;

    const { data: surveyRow, error: insertErr } = await supabase
        .from('nps_surveys')
        .insert({
            order_id: order.id,
            client_id: client.id,
            to_email: toEmail,
            to_name: client.business_name,
            sent_by_user_id: senderUserId,
            sent_at: new Date().toISOString(),
        })
        .select('id, token')
        .single();

    if (insertErr) { alert('Errore creazione survey: ' + insertErr.message); return; }

    const baseUrl = window.location.origin;
    const npsUrl = `${baseUrl}/nps.html?token=${surveyRow.token}`;

    const orderRef = order.order_number ? ` (rif. ${order.order_number})` : '';
    const subject = `Com'è andata? Il tuo feedback su "${order.title || 'la commessa'}"`;
    const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#1f2937; line-height:1.55; max-width:600px;">
<p>Ciao ${escapeHtml(client.business_name || '')},</p>

<p>Abbiamo appena chiuso i lavori per <strong>${escapeHtml(order.title || 'la tua commessa')}</strong>${escapeHtml(orderRef)}.</p>

<p>Vorrei chiederti <strong>30 secondi</strong> di feedback: ci aiuta a capire dove stiamo bene e dove possiamo migliorare.</p>

<p style="margin: 24px 0;">
    <a href="${npsUrl}" style="display:inline-block;background:#1f2937;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;">Lascia il tuo feedback</a>
</p>

<p style="font-size:.85rem;color:#6b7280;">Il link &eacute; valido per i prossimi 60 giorni.<br>
Se non si apre: ${npsUrl}</p>

<p style="margin-top:32px;">Grazie!<br>${escapeHtml(senderName)}<br><span style="color:#6b7280;">${escapeHtml(senderEmail || '')}</span></p>
</div>`;

    try {
        const { data: result, error: sendErr } = await supabase.functions.invoke('send-email', {
            body: {
                to: toEmail,
                subject,
                html,
                fromName: senderName,
                replyTo: senderEmail || undefined,
            },
        });
        if (sendErr || !result?.success) {
            alert('Survey creata ma invio email fallito: ' + (sendErr?.message || result?.error || 'errore sconosciuto'));
            return;
        }
        alert('Survey inviata!');
        await populateNpsCard(order);
    } catch (err) {
        alert('Errore inatteso: ' + err.message);
    }
};

function formatDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString('it-IT', {
            day: '2-digit', month: '2-digit', year: 'numeric',
        });
    } catch { return iso; }
}
