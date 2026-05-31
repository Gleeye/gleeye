// Mina 6 Step 6 — NPS survey feedback cliente
// Vista order-detail: card "Feedback cliente" + bottone "Chiedi feedback NPS"

import { supabase } from '/js/modules/config.js?v=8000';
import { state } from '/js/modules/state.js?v=8000';
import { formatDateIT } from '/js/modules/utils.js?v=9200';

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
                Risposta ricevuta il ${formatDateIT(latest.completed_at)}
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
                ${isExpired ? `Scaduto il ${formatDateIT(latest.expires_at)}` : `Inviato il ${formatDateIT(latest.sent_at || latest.created_at)} a ${escapeHtml(latest.to_email || '—')}`}
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

    const toEmail = await openNpsEmailPickerModal({
        defaultEmail: client.email || '',
        clientName: client.business_name || '',
        senderName,
    });
    if (!toEmail) return;

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

function openNpsEmailPickerModal({ defaultEmail, clientName, senderName }) {
    return new Promise(resolve => {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
        modal.innerHTML = `
            <div style="background:#fff;border-radius:16px;max-width:480px;width:100%;padding:1.5rem 1.75rem;">
                <h3 style="margin:0 0 .25rem;font-size:1.15rem;color:#1f2937;">Chiedi feedback NPS</h3>
                <div style="font-size:.8rem;color:#6b7280;margin-bottom:1.25rem;">
                    Mittente: <strong>${escapeHtml(senderName)}</strong> · Cliente: <strong>${escapeHtml(clientName)}</strong>
                </div>
                <label style="display:block;font-size:.8rem;color:#374151;font-weight:500;margin-bottom:.3rem;">Email destinatario</label>
                <input type="email" id="nps-email-input" value="${escapeHtml(defaultEmail)}" placeholder="es. cliente@example.com"
                    style="width:100%;padding:.65rem .8rem;border:1px solid #e5e7eb;border-radius:8px;font-size:.95rem;margin-bottom:.4rem;box-sizing:border-box;">
                <div id="nps-email-err" style="font-size:.72rem;color:#dc2626;min-height:1em;margin-bottom:.85rem;"></div>
                <div style="display:flex;justify-content:flex-end;gap:.5rem;">
                    <button id="nps-cancel" style="padding:.55rem 1.1rem;border-radius:8px;border:1px solid #e5e7eb;background:#fff;color:#374151;cursor:pointer;font-size:.85rem;">Annulla</button>
                    <button id="nps-confirm" style="padding:.55rem 1.1rem;border-radius:8px;border:none;background:#1f2937;color:#fff;cursor:pointer;font-size:.85rem;font-weight:500;">Invia survey</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const input = modal.querySelector('#nps-email-input');
        const err = modal.querySelector('#nps-email-err');
        const cancel = modal.querySelector('#nps-cancel');
        const confirm = modal.querySelector('#nps-confirm');

        const close = (value) => { modal.remove(); resolve(value); };

        cancel.addEventListener('click', () => close(null));
        modal.addEventListener('click', ev => { if (ev.target === modal) close(null); });

        const validate = () => {
            const v = input.value.trim();
            const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            err.textContent = v && !ok ? 'Email non valida' : '';
            confirm.disabled = !ok;
            confirm.style.opacity = ok ? '1' : '.5';
            return ok ? v : null;
        };
        input.addEventListener('input', validate);
        validate();

        confirm.addEventListener('click', () => {
            const v = validate();
            if (v) close(v);
        });

        input.addEventListener('keydown', ev => {
            if (ev.key === 'Enter') {
                const v = validate();
                if (v) close(v);
            } else if (ev.key === 'Escape') {
                close(null);
            }
        });

        setTimeout(() => input.focus(), 50);
    });
}

