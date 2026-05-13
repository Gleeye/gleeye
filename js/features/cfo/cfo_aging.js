import { formatAmount } from '/js/modules/utils.js?v=8000';
import { supabase } from '/js/modules/config.js?v=8000';
import { chat, extractText, AI_MODELS } from '/js/modules/ai_client.js?v=8000';

let currentRenderId = 0;

// ─── helpers ─────────────────────────────────────────────────────────────────

function today() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function daysSince(dateStr) {
    if (!dateStr) return null;
    const diff = today() - new Date(dateStr);
    return Math.floor(diff / 86400000);
}

function formatDateIT(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return d + '/' + m + '/' + y;
}

function bucketOf(days) {
    if (days <= 30) return 0;
    if (days <= 60) return 1;
    if (days <= 90) return 2;
    return 3;
}

const BUCKETS = [
    { label: '0–30 giorni', color: '#16a34a', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.25)' },
    { label: '31–60 giorni', color: '#ca8a04', bg: 'rgba(202,138,4,0.08)', border: 'rgba(202,138,4,0.25)' },
    { label: '61–90 giorni', color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)' },
    { label: '90+ giorni', color: '#dc2626', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.25)' },
];

// ─── AI sollecito ─────────────────────────────────────────────────────────────

async function generateSollecito(clientName, invoices, btnEl) {
    const original = btnEl.textContent;
    btnEl.disabled = true;
    btnEl.textContent = 'Generando...';

    const list = invoices.map(inv => {
        const { date: dueDate, stima } = effectiveDueDate(inv);
        return 'Fattura ' + (inv.invoice_number || inv.id.slice(0, 8)) +
            ' del ' + formatDateIT(inv.invoice_date) +
            ', scaduta il ' + formatDateIT(dueDate) + (stima ? ' (stima)' : '') +
            ', importo ' + formatAmount(parseFloat(inv.amount_tax_excluded) || 0) + ' €';
    }).join('\n');

    const total = invoices.reduce((s, i) => s + (parseFloat(i.amount_tax_excluded) || 0), 0);

    try {
        const resp = await chat({
            feature: 'cfo_sollecito',
            model: AI_MODELS.default,
            messages: [{
                role: 'user',
                content: 'Sei l\'assistente di Gleeye, agenzia di comunicazione italiana.' +
                    ' Scrivi un\'email di sollecito professionale ma cordiale per il cliente ' + clientName + '.' +
                    ' Fatture scadute:\n' + list +
                    '\nTotale: ' + formatAmount(total) + ' €.' +
                    ' Tono: professionale, non aggressivo, lascia aperta la possibilità di un accordo.' +
                    ' Lunghezza: max 120 parole. Solo il corpo dell\'email, no oggetto.',
            }],
            max_tokens: 300,
            temperature: 0.4,
            feature_context: { entity_type: 'aging_sollecito' },
        });

        const text = extractText(resp);
        const outputId = 'sollecito-' + clientName.replace(/\s+/g, '-');
        let outputEl = document.getElementById(outputId);
        if (!outputEl) {
            outputEl = document.createElement('div');
            outputEl.id = outputId;
            outputEl.style.cssText = 'margin-top:0.75rem;padding:0.875rem;background:var(--card-bg);border:1px solid var(--glass-border);border-radius:8px;font-size:0.85rem;line-height:1.6;white-space:pre-wrap;';
            btnEl.parentElement.appendChild(outputEl);
        }
        outputEl.textContent = text;
    } catch (e) {
        console.error('[aging] sollecito error', e);
    } finally {
        btnEl.disabled = false;
        btnEl.textContent = original;
    }
}

// ─── render rows ─────────────────────────────────────────────────────────────

// Calcola la scadenza effettiva: usa due_date se disponibile, altrimenti stima invoice_date + 30gg
function effectiveDueDate(inv) {
    if (inv.due_date) return { date: inv.due_date, stima: false };
    if (!inv.invoice_date) return { date: null, stima: false };
    const d = new Date(inv.invoice_date);
    d.setDate(d.getDate() + 30);
    return { date: d.toISOString().split('T')[0], stima: true };
}

function buildBucketRows(invoices) {
    if (!invoices.length) {
        return '<tr><td colspan="5" style="padding:1.5rem;text-align:center;color:var(--text-secondary);font-size:0.875rem;">Nessuna fattura scaduta in questo intervallo.</td></tr>';
    }
    return invoices.map(inv => {
        const { date: dueDate, stima } = effectiveDueDate(inv);
        const days = daysSince(dueDate);
        const amt = formatAmount(parseFloat(inv.amount_tax_excluded) || 0);
        const client = (inv.clients && inv.clients.business_name) ? inv.clients.business_name : '—';
        const stimaBadge = stima ? '<span style="font-size:0.68rem;color:var(--text-secondary);margin-left:4px;">(stima)</span>' : '';
        return '<tr style="border-bottom:1px solid var(--glass-border);">' +
            '<td style="padding:0.5rem 0.75rem;font-size:0.8rem;color:var(--text-secondary);">' + (inv.invoice_number || '—') + '</td>' +
            '<td style="padding:0.5rem 0.75rem;font-size:0.875rem;">' + client + '</td>' +
            '<td style="padding:0.5rem 0.75rem;font-size:0.8rem;color:var(--text-secondary);">' + formatDateIT(dueDate) + stimaBadge + '</td>' +
            '<td style="padding:0.5rem 0.75rem;text-align:right;font-size:0.875rem;font-weight:500;">' + amt + ' €</td>' +
            '<td style="padding:0.5rem 0.75rem;text-align:right;font-size:0.8rem;font-weight:600;color:' + BUCKETS[bucketOf(days)].color + ';">' + days + 'gg</td>' +
            '</tr>';
    }).join('');
}

function buildClientSolleciti(bucket2plus) {
    // Group by client
    const byClient = {};
    bucket2plus.forEach(inv => {
        const key = (inv.clients && inv.clients.business_name) ? inv.clients.business_name : 'Cliente sconosciuto';
        if (!byClient[key]) byClient[key] = [];
        byClient[key].push(inv);
    });

    if (!Object.keys(byClient).length) return '';

    const items = Object.entries(byClient).map(([clientName, invs]) => {
        const total = invs.reduce((s, i) => s + (parseFloat(i.amount_tax_excluded) || 0), 0);
        const safeName = clientName.replace(/'/g, '&#39;');
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0;border-bottom:1px solid var(--glass-border);">' +
            '<div>' +
            '<span style="font-size:0.875rem;font-weight:500;">' + safeName + '</span>' +
            '<span style="font-size:0.8rem;color:var(--text-secondary);margin-left:0.75rem;">' + invs.length + ' fattura/e — ' + formatAmount(total) + ' €</span>' +
            '</div>' +
            '<button class="sollecito-btn" data-client="' + safeName + '" style="background:var(--brand-blue);color:#fff;border:none;border-radius:6px;padding:0.3rem 0.75rem;font-size:0.78rem;cursor:pointer;">Genera sollecito</button>' +
            '</div>';
    }).join('');

    return '<div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;padding:1.25rem;margin-bottom:1.5rem;">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:0.875rem;">' +
        '<span class="material-icons-round" style="color:var(--brand-blue);font-size:1.1rem;">auto_awesome</span>' +
        '<span style="font-size:0.875rem;font-weight:600;">Solleciti AI — clienti con scaduto 60+ giorni</span>' +
        '</div>' +
        items +
        '</div>';
}

// ─── main render ─────────────────────────────────────────────────────────────

export async function renderCFOAging(container) {
    const thisId = ++currentRenderId;
    const el = container || document.getElementById('content-area');
    if (!el) return;

    el.innerHTML = '<div style="display:flex;align-items:center;gap:12px;padding:1.5rem 1.5rem 1rem;">' +
        '<span class="material-icons-round" style="color:var(--brand-blue);">schedule</span>' +
        '<h2 style="margin:0;font-size:1.25rem;font-weight:600;">Aging Fatture Clienti</h2>' +
        '</div>' +
        '<div id="aging-body" style="padding:0 1.5rem 2rem;">' +
        '<div style="display:flex;align-items:center;gap:8px;color:var(--text-secondary);font-size:0.9rem;">' +
        '<span class="material-icons-round" style="font-size:1.1rem;animation:spin 1s linear infinite;">sync</span>' +
        'Caricamento...' +
        '</div></div>';

    // Fetch tutte le fatture non pagate (status != Pagato/Pagata/Saldata)
    const { data: unpaid, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, invoice_date, due_date, amount_tax_excluded, status, client_id, clients(business_name)')
        .not('status', 'in', '("Pagato","Pagata","Saldata")')
        .order('invoice_date', { ascending: true });

    if (thisId !== currentRenderId) return;

    const body = document.getElementById('aging-body');
    if (!body) return;

    if (error) {
        body.innerHTML = '<p style="color:#dc2626;">Errore caricamento: ' + error.message + '</p>';
        return;
    }

    // Solo fatture scadute (scadenza effettiva < oggi). Se manca due_date stima invoice_date + 30gg.
    const overdue = (unpaid || []).filter(inv => {
        const { date } = effectiveDueDate(inv);
        const days = daysSince(date);
        return days !== null && days > 0;
    });

    // Split into buckets usando scadenza effettiva
    const buckets = [[], [], [], []];
    overdue.forEach(inv => {
        const { date } = effectiveDueDate(inv);
        const days = daysSince(date);
        buckets[bucketOf(days)].push(inv);
    });

    const totals = buckets.map(b => b.reduce((s, i) => s + (parseFloat(i.amount_tax_excluded) || 0), 0));
    const grandTotal = totals.reduce((s, t) => s + t, 0);

    // KPI cards
    let kpiHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:1.5rem;">';
    BUCKETS.forEach((b, i) => {
        kpiHtml += '<div style="background:' + b.bg + ';border:1px solid ' + b.border + ';border-radius:12px;padding:1rem 1.25rem;">' +
            '<div style="font-size:0.75rem;color:' + b.color + ';font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">' + b.label + '</div>' +
            '<div style="font-size:1.3rem;font-weight:700;color:' + b.color + ';">' + formatAmount(totals[i]) + ' €</div>' +
            '<div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">' + buckets[i].length + ' fattura/e</div>' +
            '</div>';
    });
    kpiHtml += '<div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;padding:1rem 1.25rem;">' +
        '<div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Totale scaduto</div>' +
        '<div style="font-size:1.3rem;font-weight:700;color:#dc2626;">' + formatAmount(grandTotal) + ' €</div>' +
        '<div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">' + overdue.length + ' fatture totali</div>' +
        '</div></div>';

    // AI solleciti (bucket 61-90 + 90+)
    const critici = [...buckets[2], ...buckets[3]];
    const sollecitiHtml = buildClientSolleciti(critici);

    // Bucket tables
    let tablesHtml = '';
    BUCKETS.forEach((b, i) => {
        tablesHtml += '<details style="margin-bottom:1rem;" ' + (i <= 1 ? 'open' : '') + '>' +
            '<summary style="list-style:none;cursor:pointer;background:var(--card-bg);border:1px solid ' + b.border + ';border-radius:10px;padding:0.75rem 1.25rem;display:flex;align-items:center;justify-content:space-between;">' +
            '<span style="font-size:0.875rem;font-weight:600;color:' + b.color + ';">' + b.label + '</span>' +
            '<span style="font-size:0.875rem;color:' + b.color + ';font-weight:700;">' + formatAmount(totals[i]) + ' € (' + buckets[i].length + ')</span>' +
            '</summary>' +
            '<div style="border:1px solid ' + b.border + ';border-top:none;border-radius:0 0 10px 10px;overflow:hidden;">' +
            '<table style="width:100%;border-collapse:collapse;">' +
            '<thead><tr style="background:' + b.bg + ';">' +
            '<th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">N° Fattura</th>' +
            '<th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Cliente</th>' +
            '<th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Scadenza</th>' +
            '<th style="padding:0.5rem 0.75rem;text-align:right;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Importo</th>' +
            '<th style="padding:0.5rem 0.75rem;text-align:right;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Ritardo</th>' +
            '</tr></thead>' +
            '<tbody>' + buildBucketRows(buckets[i]) + '</tbody>' +
            '</table></div></details>';
    });

    body.innerHTML = kpiHtml + sollecitiHtml + tablesHtml;

    // Attach sollecito handlers
    body.querySelectorAll('.sollecito-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const clientName = btn.dataset.client;
            const clientInvs = critici.filter(inv =>
                (inv.clients && inv.clients.business_name) === clientName ||
                (!inv.clients && clientName === 'Cliente sconosciuto')
            );
            generateSollecito(clientName, clientInvs, btn);
        });
    });
}
