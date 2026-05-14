// Email AI di sollecito per fatture scadute.
// Usato dal bottone "📧 Sollecita" nel detail cliente in sofferenza credito.

import { state } from '/js/modules/state.js?v=8000';
import { complete } from '/js/modules/ai_client.js?v=8000';
import { formatAmount } from '/js/modules/utils.js?v=8000';

/**
 * Genera oggetto + corpo email di sollecito tarato sul cliente.
 * Tono: cordiale se ritardo medio < 60gg, fermo ma rispettoso se > 90gg.
 * @param {Object} client
 * @returns {Promise<{ subject: string, body: string, overdueList: Array }>}
 */
export async function composeReminderEmail(client) {
    if (!client) throw new Error('client mancante');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fatture overdue del cliente
    const overdue = (state.invoices || []).filter(i => {
        if (i.client_id !== client.id) return false;
        if (i.status === 'Saldata' || i.status === 'Annullata') return false;
        const dueRaw = i.due_date || i.invoice_date;
        if (!dueRaw) return false;
        return new Date(dueRaw) < today;
    }).map(i => {
        const dueRaw = i.due_date || i.invoice_date;
        const days = Math.floor((today - new Date(dueRaw)) / (1000 * 60 * 60 * 24));
        const lordo = parseFloat(i.amount_tax_included) || parseFloat(i.amount_tax_excluded) || 0;
        const paid = parseFloat(i.amount_paid) || 0;
        return {
            number: i.invoice_number,
            date: i.invoice_date,
            due_date: i.due_date,
            amount: lordo,
            paid: paid,
            residuo: Math.max(0, lordo - paid),
            days_late: days,
        };
    }).sort((a, b) => b.days_late - a.days_late);

    if (overdue.length === 0) {
        throw new Error('Nessuna fattura scaduta per questo cliente.');
    }

    const totalDue = overdue.reduce((s, x) => s + x.residuo, 0);
    const maxDays = overdue[0].days_late;
    const isHard = maxDays > 90 || overdue.length >= 3;

    const invoicesList = overdue.map(o =>
        `- Fattura n. ${o.number} del ${o.date}: €${formatAmount(o.amount)}${o.paid > 0 ? ` (acconto incassato €${formatAmount(o.paid)}, residuo €${formatAmount(o.residuo)})` : ''}, scaduta da ${o.days_late} giorni${o.due_date ? ` (scadenza ${o.due_date})` : ''}`
    ).join('\n');

    const tonoIstruzione = isHard
        ? 'TONO: fermo ma rispettoso. La situazione è seria. Chiedi un riscontro entro 7 giorni lavorativi. Niente minacce, ma chiarezza sulla necessità di rientrare. Italiano professionale.'
        : 'TONO: cordiale, di promemoria. Trattalo come una dimenticanza. Chiedi un riscontro sui tempi. Italiano colloquiale ma professionale.';

    const prompt = `Sei un account manager di un'agenzia di comunicazione italiana. Devi scrivere una mail di sollecito a un cliente.

DESTINATARIO:
- Azienda: ${client.business_name}
${client.email ? `- Email: ${client.email}` : ''}

FATTURE SCADUTE (totale residuo €${formatAmount(totalDue)}):
${invoicesList}

${tonoIstruzione}

ISTRUZIONI:
- Scrivi un oggetto email breve e chiaro (max 60 caratteri, no clickbait).
- Scrivi un corpo email di 80-150 parole, in italiano, niente formule troppo formali tipo "Egregio".
- Apri con "Salve," o "Buongiorno,".
- Cita i numeri delle fatture in modo conciso (non ripetere tutto, basta menzionarle se 2-3, altrimenti dire "alcune fatture" + totale).
- Chiudi con disponibilità e firma generica "il team Gleeye".
- NON inventare nomi di persone.
- NON usare emoji.

OUTPUT FORMATO ESATTO (rispetta questa struttura, niente JSON):
===SUBJECT===
[oggetto qui]
===BODY===
[corpo email qui]`;

    const text = await complete(prompt, {
        feature: 'invoice_reminder',
        // gemini-2.5-flash-lite è il default centrale, niente model: override
        temperature: 0.4,
        max_tokens: 600,
    });

    // Parser semplice del formato ===SUBJECT=== / ===BODY===
    const subjectMatch = text.match(/===SUBJECT===\s*\n?(.*?)\n===BODY===/s);
    const bodyMatch = text.match(/===BODY===\s*\n?([\s\S]*?)$/);
    const subject = (subjectMatch && subjectMatch[1] || '').trim();
    const body = (bodyMatch && bodyMatch[1] || '').trim();

    if (!subject || !body) {
        // Fallback: tutto il testo come body, subject di default
        return {
            subject: `Sollecito pagamento fatture - ${client.business_name}`,
            body: text.trim(),
            overdueList: overdue,
        };
    }
    return { subject, body, overdueList: overdue };
}

/**
 * Apre il modal di sollecito, mostra spinner, chiama AI, popola con editabili.
 */
export async function openReminderModal(clientId) {
    const client = (state.clients || []).find(c => c.id === clientId);
    if (!client) return;

    // Rimuove eventuale modal aperto
    document.getElementById('client-reminder-modal')?.remove();

    // Modal con spinner
    document.body.insertAdjacentHTML('beforeend', `
        <div id="client-reminder-modal" class="modal active" style="z-index: 10000;">
            <div class="modal-content glass-card" style="max-width: 640px; width: 100%; padding: 1.75rem;">
                <div style="display:flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <div>
                        <h2 style="margin: 0 0 0.25rem; font-size: 1.25rem;">📧 Sollecito pagamento</h2>
                        <p style="margin: 0; color: var(--text-secondary); font-size: 0.85rem;">${client.business_name}${client.email ? ` · ${client.email}` : ''}</p>
                    </div>
                    <button class="icon-btn" onclick="document.getElementById('client-reminder-modal').remove()">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <div id="rem-body-wrapper">
                    <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                        <div class="loader" style="width: 32px; height: 32px; margin: 0 auto 1rem; border: 3px solid #e5e7eb; border-top-color: var(--brand-blue); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                        <p style="margin: 0; font-size: 0.9rem;">L'AI sta scrivendo il sollecito...</p>
                    </div>
                </div>
            </div>
            <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
        </div>
    `);

    try {
        const { subject, body, overdueList } = await composeReminderEmail(client);

        const wrapper = document.getElementById('rem-body-wrapper');
        if (!wrapper) return;

        const overdueSummary = overdueList.map(o =>
            `<li style="padding: 2px 0;">Fattura <strong>${o.number}</strong> · €${formatAmount(o.residuo)} · scaduta da ${o.days_late}gg</li>`
        ).join('');

        const mailtoBody = encodeURIComponent(body);
        const mailtoSubject = encodeURIComponent(subject);
        const mailtoTo = client.email ? encodeURIComponent(client.email) : '';

        wrapper.innerHTML = `
            <details style="margin-bottom: 1rem; font-size: 0.85rem;">
                <summary style="cursor: pointer; color: var(--text-secondary); font-weight: 600;">
                    Fatture in oggetto (${overdueList.length})
                </summary>
                <ul style="margin: 0.5rem 0 0 0; padding-left: 1.25rem; color: var(--text-secondary);">
                    ${overdueSummary}
                </ul>
            </details>

            <label style="font-size: 0.7rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em;">Oggetto</label>
            <input id="rem-subject" type="text" value="${subject.replace(/"/g, '&quot;')}" class="modal-input" style="width: 100%; margin: 0.3rem 0 1rem; padding: 0.7rem 0.9rem; border-radius: 10px; font-size: 0.95rem;">

            <label style="font-size: 0.7rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em;">Corpo email</label>
            <textarea id="rem-body" class="modal-input" rows="11" style="width: 100%; margin-top: 0.3rem; padding: 0.8rem 0.9rem; border-radius: 10px; font-size: 0.92rem; line-height: 1.5; resize: vertical; font-family: inherit;">${body}</textarea>

            <div style="display: flex; gap: 0.5rem; margin-top: 1.25rem; flex-wrap: wrap;">
                <button id="rem-btn-copy" class="primary-btn" style="flex: 1; min-width: 140px; background: var(--brand-blue);">
                    <span class="material-icons-round">content_copy</span> Copia testo
                </button>
                ${client.email
                    ? `<a id="rem-btn-mailto" href="mailto:${mailtoTo}?subject=${mailtoSubject}&body=${mailtoBody}" class="primary-btn" style="flex: 1; min-width: 140px; background: #10b981; text-decoration: none; justify-content: center;">
                            <span class="material-icons-round">mail</span> Apri in mail
                       </a>`
                    : '<div style="flex: 1; min-width: 140px; padding: 0.6rem; background: rgba(245,158,11,0.1); color: #b45309; border-radius: 10px; font-size: 0.78rem; text-align: center;">Nessuna email salvata sul cliente</div>'}
                <button class="primary-btn secondary" onclick="document.getElementById('client-reminder-modal').remove()">Chiudi</button>
            </div>
            <p style="font-size: 0.7rem; color: var(--text-tertiary); margin-top: 1rem; text-align: center;">
                Generato da AI — controlla SEMPRE i contenuti prima di inviare. Modello: gemini-2.5-flash-lite.
            </p>
        `;

        // Wire bottone Copia
        document.getElementById('rem-btn-copy')?.addEventListener('click', () => {
            const s = document.getElementById('rem-subject').value;
            const b = document.getElementById('rem-body').value;
            const text = `Oggetto: ${s}\n\n${b}`;
            navigator.clipboard.writeText(text).then(() => {
                const btn = document.getElementById('rem-btn-copy');
                if (!btn) return;
                const original = btn.innerHTML;
                btn.innerHTML = '<span class="material-icons-round">check</span> Copiato!';
                btn.style.background = '#10b981';
                setTimeout(() => {
                    btn.innerHTML = original;
                    btn.style.background = '';
                }, 1500);
            });
        });

        // Mailto: aggiorna href live se l'utente edita
        const subjEl = document.getElementById('rem-subject');
        const bodyEl = document.getElementById('rem-body');
        const mailtoLink = document.getElementById('rem-btn-mailto');
        if (mailtoLink) {
            const updateMailto = () => {
                mailtoLink.href = `mailto:${mailtoTo}?subject=${encodeURIComponent(subjEl.value)}&body=${encodeURIComponent(bodyEl.value)}`;
            };
            subjEl.addEventListener('input', updateMailto);
            bodyEl.addEventListener('input', updateMailto);
        }
    } catch (err) {
        console.error('[reminder_compose]', err);
        const wrapper = document.getElementById('rem-body-wrapper');
        if (wrapper) {
            wrapper.innerHTML = `
                <div style="padding: 2rem 1rem; text-align: center; color: #b91c1c; background: rgba(239,68,68,0.06); border-radius: 12px;">
                    <span class="material-icons-round" style="font-size: 2rem; margin-bottom: 0.5rem;">error_outline</span>
                    <p style="margin: 0; font-size: 0.9rem;">${err.message || 'Errore nella generazione dell\'email.'}</p>
                </div>
                <div style="margin-top: 1rem; text-align: right;">
                    <button class="primary-btn secondary" onclick="document.getElementById('client-reminder-modal').remove()">Chiudi</button>
                </div>
            `;
        }
    }
}

if (typeof window !== 'undefined') {
    window.openReminderModal = openReminderModal;
}
