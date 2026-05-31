// Mina 6 Step 4 — Bozze email transazionali
// Vista #outbound-emails: lista bozze "Lavori conclusi" + invio manuale

import { supabase } from '/js/modules/config.js?v=8000';
import { state } from '/js/modules/state.js?v=8000';
import { formatDatetime } from '/js/modules/utils.js?v=9200';

const STATUS_LABELS = {
    draft: { label: 'Bozza', color: '#f59e0b', bg: '#fef3c7' },
    sent: { label: 'Inviata', color: '#10b981', bg: '#d1fae5' },
    failed: { label: 'Errore invio', color: '#dc2626', bg: '#fee2e2' },
    discarded: { label: 'Scartata', color: '#6b7280', bg: '#f3f4f6' },
};

const TYPE_LABELS = {
    order_completed: 'Lavori conclusi',
    nps_invite: 'Invito NPS',
    custom: 'Personalizzata',
};

let currentFilter = 'draft';

export async function renderOutboundEmails(container) {
    container.innerHTML = buildShell();
    attachFilterListeners(container);
    await reloadList(container);
}

function buildShell() {
    return `
        <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:1.25rem;">
            <div>
                <h1 style="margin:0;font-size:1.5rem;">Bozze Email</h1>
                <p style="margin:.25rem 0 0;color:#6b7280;font-size:.875rem;">
                    Email generate dal sistema (es. "Lavori conclusi") in attesa di invio manuale.
                </p>
            </div>
            <div id="oe-status-chips" style="display:flex;gap:.4rem;flex-wrap:wrap;">
                ${chipsHtml()}
            </div>
        </div>
        <div id="oe-list" style="display:flex;flex-direction:column;gap:.75rem;">
            <div style="padding:2rem;text-align:center;color:#9ca3af;">Caricamento…</div>
        </div>
    `;
}

function chipsHtml() {
    const opts = [
        { key: 'draft', label: 'Bozze' },
        { key: 'sent', label: 'Inviate' },
        { key: 'failed', label: 'Errore' },
        { key: 'discarded', label: 'Scartate' },
        { key: 'all', label: 'Tutte' },
    ];
    return opts.map(o => {
        const active = o.key === currentFilter;
        return `<button class="oe-chip" data-filter="${o.key}"
            style="padding:.35rem .75rem;border-radius:999px;border:1px solid ${active ? '#1f2937' : '#e5e7eb'};
                   background:${active ? '#1f2937' : '#fff'};color:${active ? '#fff' : '#374151'};
                   font-size:.8rem;cursor:pointer;font-weight:500;">${o.label}</button>`;
    }).join('');
}

function attachFilterListeners(container) {
    container.querySelector('#oe-status-chips').addEventListener('click', async e => {
        const btn = e.target.closest('.oe-chip');
        if (!btn) return;
        currentFilter = btn.dataset.filter;
        container.querySelector('#oe-status-chips').innerHTML = chipsHtml();
        await reloadList(container);
    });
}

async function reloadList(container) {
    const list = container.querySelector('#oe-list');
    list.innerHTML = '<div style="padding:2rem;text-align:center;color:#9ca3af;">Caricamento…</div>';

    let query = supabase
        .from('outbound_emails')
        .select('id, type, status, subject, to_email, from_name, generated_at, sent_at, failed_reason, order_id, client_id, metadata')
        .order('generated_at', { ascending: false })
        .limit(100);

    if (currentFilter !== 'all') {
        query = query.eq('status', currentFilter);
    }

    const { data: emails, error } = await query;
    if (error) {
        list.innerHTML = `<div style="padding:1rem;color:#dc2626;background:#fee2e2;border-radius:8px;">Errore: ${error.message}</div>`;
        return;
    }

    if (!emails || emails.length === 0) {
        list.innerHTML = `<div style="padding:3rem;text-align:center;color:#9ca3af;background:#f9fafb;border-radius:12px;">
            Nessuna email in questo stato.
        </div>`;
        return;
    }

    const orderIds = [...new Set(emails.map(e => e.order_id).filter(Boolean))];
    const clientIds = [...new Set(emails.map(e => e.client_id).filter(Boolean))];

    const [ordersRes, clientsRes] = await Promise.all([
        orderIds.length
            ? supabase.from('orders').select('id, order_number, title').in('id', orderIds)
            : Promise.resolve({ data: [] }),
        clientIds.length
            ? supabase.from('clients').select('id, business_name').in('id', clientIds)
            : Promise.resolve({ data: [] }),
    ]);

    const ordersMap = Object.fromEntries((ordersRes.data || []).map(o => [o.id, o]));
    const clientsMap = Object.fromEntries((clientsRes.data || []).map(c => [c.id, c]));

    list.innerHTML = emails.map(e => renderCard(e, ordersMap, clientsMap)).join('');

    list.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', async ev => {
            ev.stopPropagation();
            const id = btn.dataset.id;
            const action = btn.dataset.action;
            if (action === 'open') await openEditor(id, container);
            else if (action === 'discard') await discardEmail(id, container);
        });
    });
}

function renderCard(e, ordersMap, clientsMap) {
    const st = STATUS_LABELS[e.status] || STATUS_LABELS.draft;
    const order = ordersMap[e.order_id];
    const client = clientsMap[e.client_id];
    const dateLabel = e.sent_at
        ? `Inviata il ${formatDatetime(e.sent_at)}`
        : `Generata il ${formatDatetime(e.generated_at)}`;

    return `
        <div class="oe-card" style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1rem 1.25rem;display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
            <div style="flex:1;min-width:240px;">
                <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.35rem;">
                    <span style="background:${st.bg};color:${st.color};font-size:.7rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;">${st.label}</span>
                    <span style="font-size:.7rem;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">${TYPE_LABELS[e.type] || e.type}</span>
                </div>
                <div style="font-weight:600;color:#1f2937;margin-bottom:.2rem;">${escapeHtml(e.subject)}</div>
                <div style="font-size:.825rem;color:#6b7280;display:flex;gap:.75rem;flex-wrap:wrap;">
                    <span>${escapeHtml(client?.business_name || 'Cliente sconosciuto')}</span>
                    ${order ? `<span>·</span><span>Commessa ${escapeHtml(order.order_number || '—')}</span>` : ''}
                    <span>·</span><span>${escapeHtml(e.to_email || 'email cliente mancante')}</span>
                </div>
                <div style="font-size:.75rem;color:#9ca3af;margin-top:.25rem;">${dateLabel} · da ${escapeHtml(e.from_name || 'sistema')}</div>
                ${e.failed_reason ? `<div style="font-size:.75rem;color:#dc2626;margin-top:.25rem;">${escapeHtml(e.failed_reason)}</div>` : ''}
            </div>
            <div style="display:flex;gap:.5rem;">
                ${e.status === 'draft' || e.status === 'failed' ? `
                    <button data-action="open" data-id="${e.id}"
                        style="padding:.5rem 1rem;border-radius:8px;border:none;background:#1f2937;color:#fff;cursor:pointer;font-weight:500;font-size:.85rem;">
                        Apri
                    </button>
                    <button data-action="discard" data-id="${e.id}"
                        style="padding:.5rem .85rem;border-radius:8px;border:1px solid #e5e7eb;background:#fff;color:#6b7280;cursor:pointer;font-size:.85rem;">
                        Scarta
                    </button>
                ` : `
                    <button data-action="open" data-id="${e.id}"
                        style="padding:.5rem 1rem;border-radius:8px;border:1px solid #e5e7eb;background:#fff;color:#374151;cursor:pointer;font-size:.85rem;">
                        Visualizza
                    </button>
                `}
            </div>
        </div>
    `;
}

async function openEditor(emailId, container) {
    const { data: e, error } = await supabase
        .from('outbound_emails')
        .select('*')
        .eq('id', emailId)
        .single();
    if (error) { alert('Errore: ' + error.message); return; }

    const readOnly = e.status === 'sent' || e.status === 'discarded';

    const modal = document.createElement('div');
    modal.className = 'oe-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:16px;max-width:780px;width:100%;max-height:92vh;display:flex;flex-direction:column;">
            <div style="padding:1.25rem 1.5rem;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;">
                <div>
                    <h3 style="margin:0;font-size:1.125rem;">${readOnly ? 'Email inviata' : 'Modifica bozza'}</h3>
                    <div style="font-size:.75rem;color:#9ca3af;margin-top:.15rem;">Mittente visibile: ${escapeHtml(e.from_name || '—')}${e.from_email ? ` &lt;${escapeHtml(e.from_email)}&gt;` : ''}</div>
                </div>
                <button class="oe-close" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#6b7280;">×</button>
            </div>
            <div style="padding:1.25rem 1.5rem;overflow-y:auto;flex:1;">
                <label style="display:block;font-size:.8rem;color:#374151;font-weight:500;margin-bottom:.3rem;">Destinatario</label>
                <input type="email" id="oe-to" value="${escapeAttr(e.to_email || '')}" ${readOnly ? 'readonly' : ''}
                    style="width:100%;padding:.55rem .75rem;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:1rem;font-size:.9rem;">

                <label style="display:block;font-size:.8rem;color:#374151;font-weight:500;margin-bottom:.3rem;">Oggetto</label>
                <input type="text" id="oe-subject" value="${escapeAttr(e.subject)}" ${readOnly ? 'readonly' : ''}
                    style="width:100%;padding:.55rem .75rem;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:1rem;font-size:.9rem;">

                <label style="display:block;font-size:.8rem;color:#374151;font-weight:500;margin-bottom:.3rem;">
                    Contenuto (HTML)
                    <button id="oe-toggle-preview" type="button" style="float:right;background:none;border:none;color:#3b82f6;font-size:.75rem;cursor:pointer;">Anteprima</button>
                </label>
                <textarea id="oe-body" ${readOnly ? 'readonly' : ''}
                    style="width:100%;min-height:280px;padding:.75rem;border:1px solid #e5e7eb;border-radius:8px;font-family:ui-monospace,monospace;font-size:.8rem;line-height:1.5;resize:vertical;">${escapeHtml(e.body_html)}</textarea>
                <div id="oe-preview" style="display:none;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;background:#f9fafb;min-height:280px;"></div>
            </div>
            <div style="padding:1rem 1.5rem;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:.5rem;">
                <button class="oe-close" style="padding:.6rem 1.1rem;border-radius:8px;border:1px solid #e5e7eb;background:#fff;color:#374151;cursor:pointer;">${readOnly ? 'Chiudi' : 'Annulla'}</button>
                ${!readOnly ? `
                    <button id="oe-save" style="padding:.6rem 1.1rem;border-radius:8px;border:1px solid #e5e7eb;background:#fff;color:#374151;cursor:pointer;">Salva bozza</button>
                    <button id="oe-send" style="padding:.6rem 1.1rem;border-radius:8px;border:none;background:#10b981;color:#fff;cursor:pointer;font-weight:500;">Invia ora</button>
                ` : ''}
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll('.oe-close').forEach(b => b.addEventListener('click', close));
    modal.addEventListener('click', ev => { if (ev.target === modal) close(); });

    const togglePreview = modal.querySelector('#oe-toggle-preview');
    const bodyTa = modal.querySelector('#oe-body');
    const preview = modal.querySelector('#oe-preview');
    togglePreview.addEventListener('click', () => {
        const showPreview = preview.style.display === 'none';
        if (showPreview) {
            preview.innerHTML = bodyTa.value;
            preview.style.display = 'block';
            bodyTa.style.display = 'none';
            togglePreview.textContent = 'Modifica';
        } else {
            preview.style.display = 'none';
            bodyTa.style.display = 'block';
            togglePreview.textContent = 'Anteprima';
        }
    });

    if (!readOnly) {
        modal.querySelector('#oe-save').addEventListener('click', async () => {
            const updated = {
                to_email: modal.querySelector('#oe-to').value.trim() || null,
                subject: modal.querySelector('#oe-subject').value.trim(),
                body_html: modal.querySelector('#oe-body').value,
            };
            const { error: upErr } = await supabase.from('outbound_emails').update(updated).eq('id', emailId);
            if (upErr) { alert('Errore salvataggio: ' + upErr.message); return; }
            close();
            await reloadList(container);
        });

        modal.querySelector('#oe-send').addEventListener('click', async () => {
            const to = modal.querySelector('#oe-to').value.trim();
            const subject = modal.querySelector('#oe-subject').value.trim();
            const body = modal.querySelector('#oe-body').value;

            if (!to) { alert('Manca il destinatario.'); return; }
            if (!subject) { alert('Manca l\'oggetto.'); return; }
            if (!confirm(`Inviare email a ${to}?`)) return;

            const sendBtn = modal.querySelector('#oe-send');
            sendBtn.disabled = true;
            sendBtn.textContent = 'Invio in corso…';

            await supabase.from('outbound_emails').update({
                to_email: to, subject, body_html: body
            }).eq('id', emailId);

            try {
                const { data: result, error: sendErr } = await supabase.functions.invoke('send-email', {
                    body: {
                        to,
                        subject,
                        html: body,
                        fromName: e.from_name || undefined,
                        replyTo: e.from_email || undefined,
                    },
                });

                if (sendErr || !result?.success) {
                    const errMsg = sendErr?.message || result?.error || 'Invio fallito';
                    await supabase.from('outbound_emails').update({
                        status: 'failed', failed_reason: errMsg
                    }).eq('id', emailId);
                    alert('Errore invio: ' + errMsg);
                    sendBtn.disabled = false;
                    sendBtn.textContent = 'Invia ora';
                    return;
                }

                await supabase.from('outbound_emails').update({
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    sent_by: state.profile?.id || null,
                    failed_reason: null,
                }).eq('id', emailId);

                close();
                await reloadList(container);
            } catch (err) {
                sendBtn.disabled = false;
                sendBtn.textContent = 'Invia ora';
                alert('Errore inatteso: ' + err.message);
            }
        });
    }
}

async function discardEmail(emailId, container) {
    if (!confirm('Scartare questa bozza? L\'email non verrà inviata.')) return;
    const { error } = await supabase.from('outbound_emails').update({ status: 'discarded' }).eq('id', emailId);
    if (error) { alert('Errore: ' + error.message); return; }
    await reloadList(container);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function escapeAttr(s) {
    return String(s ?? '').replace(/"/g, '&quot;');
}

// ─── Badge count export (per homepage / sidebar) ─────────────────────────────

export async function fetchOutboundDraftsCount() {
    const { count, error } = await supabase
        .from('outbound_emails')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'draft');
    if (error) return 0;
    return count || 0;
}
