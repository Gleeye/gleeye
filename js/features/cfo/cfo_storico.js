import { formatAmount } from '/js/modules/utils.js?v=8000';
import { supabase } from '/js/modules/config.js?v=8000';

let currentRenderId = 0;

// ─── helpers ─────────────────────────────────────────────────────────────────

function normalizeTerms(days) {
    if (days <= 10) return 0;
    if (days <= 45) return 30;
    if (days <= 75) return 60;
    if (days <= 105) return 90;
    return 120;
}

function termsLabel(t) {
    return t === 0 ? 'Immediato' : t + 'gg';
}

// Quanti mesi fa è avvenuta la data?
function monthsAgo(dateStr) {
    if (!dateStr) return 999;
    return (Date.now() - new Date(dateStr)) / (1000 * 60 * 60 * 24 * 30.4);
}

// Soglia "attivo" per ogni frequenza: se l'ultima fattura è più vecchia di questa, il costo è probabilmente interrotto
const ACTIVE_THRESHOLD_MONTHS = {
    monthly: 3,
    quarterly: 5,
    biannual: 8,
    annual: 15,
};

function guessFrequency(n, primaStr, ultimaStr) {
    if (n < 2) return 'annual';
    const giorni = (new Date(ultimaStr) - new Date(primaStr)) / (1000 * 60 * 60 * 24);
    const intervalloMedio = giorni / (n - 1); // giorni tra fatture consecutive in media
    if (intervalloMedio <= 45) return 'monthly';
    if (intervalloMedio <= 110) return 'quarterly';
    if (intervalloMedio <= 220) return 'biannual';
    return 'annual';
}

const FREQ_LABEL = {
    monthly: 'Mensile',
    quarterly: 'Trimestrale',
    biannual: 'Semestrale',
    annual: 'Annuale',
};

const FREQ_MULT = { monthly: 12, quarterly: 4, biannual: 2, annual: 1 };

// Coefficiente di variazione: std/media. >0.5 = importi troppo irregolari per essere "fisso"
function coefficienteVariazione(amounts) {
    if (amounts.length < 2) return 0;
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    if (mean === 0) return 0;
    const variance = amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length;
    return Math.sqrt(variance) / mean;
}

const SUPPLIER_CATEGORY = {
    notion: 'software', google: 'software', dropbox: 'software',
    keliweb: 'software', aruba: 'software', 'tms plugins': 'software',
    workspace: 'ufficio', regus: 'ufficio',
    'studio dondero': 'amministrativo', dondero: 'amministrativo',
};

function guessCategory(name) {
    const lower = (name || '').toLowerCase();
    for (const [k, v] of Object.entries(SUPPLIER_CATEGORY)) {
        if (lower.includes(k)) return v;
    }
    return 'altro';
}

// ─── tab 1: payment terms ────────────────────────────────────────────────────

async function loadPaymentTermsData() {
    const { data: rows, error } = await supabase
        .from('invoices')
        .select(`
            id, invoice_date, status, amount_tax_excluded,
            client_id,
            clients(id, business_name, payment_terms),
            bank_transactions!active_invoice_id(date, type)
        `)
        .gte('invoice_date', new Date(Date.now() - 730 * 86400000).toISOString().split('T')[0])
        .in('status', ['Pagato', 'Pagata']);

    if (error) throw error;

    const byClient = {};
    (rows || []).forEach(inv => {
        const c = inv.clients;
        if (!c) return;
        const bt = (inv.bank_transactions || []).find(b => b.type === 'entrata');
        if (!bt?.date) return;
        const giorni = Math.round((new Date(bt.date) - new Date(inv.invoice_date)) / 86400000);
        if (giorni < 0) return;
        if (!byClient[c.id]) {
            byClient[c.id] = { id: c.id, nome: c.business_name, termineAttuale: c.payment_terms, giorni: [], totale: 0 };
        }
        byClient[c.id].giorni.push(giorni);
        byClient[c.id].totale += parseFloat(inv.amount_tax_excluded) || 0;
    });

    return Object.values(byClient)
        .map(c => ({
            ...c,
            mediaGiorni: Math.round(c.giorni.reduce((s, g) => s + g, 0) / c.giorni.length),
            nFatture: c.giorni.length,
        }))
        .sort((a, b) => b.totale - a.totale);
}

async function applyPaymentTerms(clientId, terms, btn) {
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = '...';
    const { error } = await supabase.from('clients').update({ payment_terms: terms }).eq('id', clientId);
    if (error) {
        alert('Errore: ' + error.message);
        btn.disabled = false;
        btn.textContent = orig;
    } else {
        btn.textContent = '✓ Applicato';
        btn.style.background = '#16a34a';
    }
}

function renderPaymentTermsTab(container, clients) {
    if (!clients.length) {
        container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:2rem;">Nessun incasso collegato a fattura trovato. Collega i movimenti bancari dalla vista Cassa.</p>';
        return;
    }

    const rows = clients.map(c => {
        const suggested = normalizeTerms(c.mediaGiorni);
        const alreadySet = c.termineAttuale === suggested;
        return '<tr style="border-bottom:1px solid var(--glass-border);">' +
            '<td style="padding:0.6rem 0.75rem;font-size:0.875rem;font-weight:500;">' + c.nome + '</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:center;font-size:0.8rem;color:var(--text-secondary);">' + c.nFatture + '</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:right;font-size:0.875rem;">' + c.mediaGiorni + 'gg</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:center;">' +
            '<span style="background:rgba(59,130,246,0.1);color:#3b82f6;border-radius:6px;padding:2px 8px;font-size:0.8rem;font-weight:600;">' + termsLabel(suggested) + '</span>' +
            '</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:center;font-size:0.8rem;color:var(--text-secondary);">' +
            (c.termineAttuale != null ? termsLabel(c.termineAttuale) : '—') +
            '</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:right;">' +
            (alreadySet
                ? '<span style="font-size:0.78rem;color:#16a34a;">✓ già ok</span>'
                : '<button class="pt-apply-btn" data-id="' + c.id + '" data-terms="' + suggested + '" style="background:var(--brand-blue);color:#fff;border:none;border-radius:6px;padding:0.3rem 0.75rem;font-size:0.78rem;cursor:pointer;">Applica</button>') +
            '</td></tr>';
    }).join('');

    container.innerHTML =
        '<p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:1rem;">Calcolato da ' +
        clients.reduce((s, c) => s + c.nFatture, 0) +
        ' incassi abbinati a fattura negli ultimi 24 mesi. Normalizzato ai valori standard (0/30/60/90/120gg).</p>' +
        '<div style="overflow-x:auto;">' +
        '<table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="background:var(--card-bg);border-bottom:2px solid var(--glass-border);">' +
        thCell('Cliente', 'left') + thCell('Fatture', 'center') + thCell('Media giorni reali', 'right') +
        thCell('Suggerito', 'center') + thCell('Attuale', 'center') + thCell('', 'right') +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>';

    container.querySelectorAll('.pt-apply-btn').forEach(btn => {
        btn.addEventListener('click', () => applyPaymentTerms(btn.dataset.id, parseInt(btn.dataset.terms), btn));
    });
}

// ─── tab 2: costi fissi da storico ───────────────────────────────────────────

async function loadFixedCostsCandidates() {
    const { data, error } = await supabase
        .from('passive_invoices')
        .select('id, issue_date, amount_tax_excluded, supplier_id, collaborator_id, supplier_name, suppliers(name)')
        .gte('issue_date', new Date(Date.now() - 730 * 86400000).toISOString().split('T')[0])
        .is('collaborator_id', null)
        .not('supplier_id', 'is', null);

    if (error) throw error;

    const bySupplier = {};
    (data || []).forEach(pi => {
        const name = (pi.suppliers?.name) || pi.supplier_name || 'Sconosciuto';
        if (!bySupplier[name]) bySupplier[name] = { name, amounts: [], dates: [] };
        bySupplier[name].amounts.push(parseFloat(pi.amount_tax_excluded) || 0);
        bySupplier[name].dates.push(pi.issue_date);
    });

    return Object.values(bySupplier)
        .filter(s => s.amounts.length >= 2)
        .map(s => {
            const sortedDates = s.dates.slice().sort();
            const prima = sortedDates[0];
            const ultima = sortedDates[sortedDates.length - 1];
            const freq = guessFrequency(s.amounts.length, prima, ultima);
            const cv = coefficienteVariazione(s.amounts);
            const media = s.amounts.reduce((a, b) => a + b, 0) / s.amounts.length;

            // Stima annua = media × frequenza/anno — basata sull'importo tipico, non sul totale storico
            const stimaAnnua = media * FREQ_MULT[freq];

            // Attivo: ultima fattura dentro la soglia per quella frequenza
            const mesesDallUltima = monthsAgo(ultima);
            const isAttivo = mesesDallUltima <= ACTIVE_THRESHOLD_MONTHS[freq];

            // Irregolare: CV alto o importi troppo diversi → probabilmente non costo fisso
            const isIrregolare = cv > 0.5;

            return {
                name: s.name, nFatture: s.amounts.length, media, stimaAnnua,
                frequency: freq, category: guessCategory(s.name),
                prima, ultima, isAttivo, isIrregolare, cv,
                mesesDallUltima: Math.round(mesesDallUltima),
            };
        })
        .sort((a, b) => {
            // Prima gli attivi non irregolari, poi gli altri
            if (a.isAttivo !== b.isAttivo) return a.isAttivo ? -1 : 1;
            if (a.isIrregolare !== b.isIrregolare) return a.isIrregolare ? 1 : -1;
            return b.stimaAnnua - a.stimaAnnua;
        });
}

async function addFixedCost(c, btn) {
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = '...';
    const { error } = await supabase.from('cfo_global_fixed_costs').insert({
        name: c.name,
        amount: Math.round(c.media * 100) / 100,
        frequency: c.frequency,
        category: c.category,
        year: new Date().getFullYear(),
        is_active: true,
    });
    if (error) {
        alert('Errore: ' + error.message);
        btn.disabled = false;
        btn.textContent = orig;
    } else {
        btn.textContent = '✓ Aggiunto';
        btn.style.background = '#16a34a';
        btn.disabled = true;
    }
}

function thCell(txt, align) {
    return '<th style="padding:0.5rem 0.75rem;text-align:' + align + ';font-size:0.75rem;color:var(--text-secondary);font-weight:600;">' + txt + '</th>';
}

function renderFixedCostsTab(container, candidates) {
    if (!candidates.length) {
        container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:2rem;">Nessun fornitore ricorrente trovato negli ultimi 24 mesi.</p>';
        return;
    }

    const attivi = candidates.filter(c => c.isAttivo && !c.isIrregolare);
    const inattivi = candidates.filter(c => !c.isAttivo);
    const irregolari = candidates.filter(c => c.isAttivo && c.isIrregolare);

    const stimaTotaleAttivi = attivi.reduce((s, c) => s + c.stimaAnnua, 0);

    function buildRow(c) {
        let badgeStr = '';
        if (!c.isAttivo) {
            badgeStr = '<span style="font-size:0.7rem;background:rgba(220,38,38,0.1);color:#dc2626;border-radius:4px;padding:1px 6px;margin-left:6px;">interrotto ' + c.mesesDallUltima + 'm fa</span>';
        } else if (c.isIrregolare) {
            badgeStr = '<span style="font-size:0.7rem;background:rgba(245,158,11,0.1);color:#f59e0b;border-radius:4px;padding:1px 6px;margin-left:6px;">importi variabili</span>';
        }

        const catColor = { software: '#6366f1', ufficio: '#10b981', amministrativo: '#f59e0b', altro: '#6b7280' };
        const col = catColor[c.category] || '#6b7280';

        const canAdd = c.isAttivo && !c.isIrregolare;

        return '<tr style="border-bottom:1px solid var(--glass-border);opacity:' + (c.isAttivo ? '1' : '0.55') + ';">' +
            '<td style="padding:0.6rem 0.75rem;font-size:0.875rem;font-weight:500;">' + c.name + badgeStr + '</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:center;font-size:0.8rem;color:var(--text-secondary);">' + c.nFatture + '</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:right;font-size:0.875rem;">' + formatAmount(c.media) + ' €</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:center;">' +
            '<span style="background:rgba(59,130,246,0.1);color:#3b82f6;border-radius:6px;padding:2px 8px;font-size:0.78rem;font-weight:600;">' + FREQ_LABEL[c.frequency] + '</span>' +
            '</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:right;font-size:0.875rem;font-weight:500;">' + (c.isAttivo ? formatAmount(c.stimaAnnua) + ' €/anno' : '—') + '</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:center;">' +
            '<span style="background:rgba(' + (col === '#6366f1' ? '99,102,241' : col === '#10b981' ? '16,185,129' : col === '#f59e0b' ? '245,158,11' : '107,114,128') + ',0.1);color:' + col + ';border-radius:6px;padding:2px 8px;font-size:0.78rem;">' + c.category + '</span>' +
            '</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:right;">' +
            (canAdd
                ? '<button class="fc-add-btn" data-name="' + c.name.replace(/"/g, '&quot;') + '" data-media="' + c.media + '" data-freq="' + c.frequency + '" data-cat="' + c.category + '" style="background:var(--brand-blue);color:#fff;border:none;border-radius:6px;padding:0.3rem 0.75rem;font-size:0.78rem;cursor:pointer;">Aggiungi</button>'
                : '<span style="font-size:0.75rem;color:var(--text-secondary);">non aggiungere</span>') +
            '</td></tr>';
    }

    const rowsAttivi = attivi.map(buildRow).join('');
    const rowsInattivi = inattivi.map(buildRow).join('');
    const rowsIrregolari = irregolari.map(buildRow).join('');

    const tableHeader =
        '<table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="background:var(--card-bg);border-bottom:2px solid var(--glass-border);">' +
        thCell('Fornitore', 'left') + thCell('Fatture', 'center') +
        thCell('Importo medio', 'right') + thCell('Frequenza', 'center') +
        thCell('Stima annua', 'right') + thCell('Categoria', 'center') + thCell('', 'right') +
        '</tr></thead>';

    let html =
        '<div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:10px;padding:0.875rem 1.25rem;margin-bottom:1.25rem;display:flex;align-items:center;justify-content:space-between;">' +
        '<div><div style="font-size:0.75rem;color:#6366f1;font-weight:600;text-transform:uppercase;letter-spacing:.04em;">Stima costi fissi annui (solo costi attivi)</div>' +
        '<div style="font-size:1.4rem;font-weight:700;color:#6366f1;margin-top:2px;">' + formatAmount(stimaTotaleAttivi) + ' €/anno</div></div>' +
        '<div style="font-size:0.8rem;color:var(--text-secondary);">' + attivi.length + ' costi attivi · ' + inattivi.length + ' interrotti · ' + irregolari.length + ' irregolari</div>' +
        '</div>' +
        '<p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:1rem;">I costi <strong>interrotti</strong> (ultima fattura fuori soglia per la frequenza) e quelli con <strong>importi variabili</strong> (CV &gt; 50%) sono esclusi dalla stima e dal pulsante aggiungi.</p>' +
        '<div style="overflow-x:auto;">' + tableHeader + '<tbody>' + rowsAttivi;

    if (rowsIrregolari) html += rowsIrregolari;
    if (rowsInattivi) html += rowsInattivi;

    html += '</tbody></table></div>';

    container.innerHTML = html;

    container.querySelectorAll('.fc-add-btn').forEach(btn => {
        btn.addEventListener('click', () => addFixedCost({
            name: btn.dataset.name,
            media: parseFloat(btn.dataset.media),
            frequency: btn.dataset.freq,
            category: btn.dataset.cat,
        }, btn));
    });
}

// ─── main render ─────────────────────────────────────────────────────────────

export async function renderCFOStorico(container) {
    const thisId = ++currentRenderId;
    const el = container || document.getElementById('content-area');
    if (!el) return;

    el.innerHTML =
        '<div style="display:flex;align-items:center;gap:12px;padding:1.5rem 1.5rem 1rem;">' +
        '<span class="material-icons-round" style="color:var(--brand-blue);">history_edu</span>' +
        '<div><h2 style="margin:0;font-size:1.25rem;font-weight:600;">Popola da Storico</h2>' +
        '<p style="margin:2px 0 0;font-size:0.8rem;color:var(--text-secondary);">Analisi ultimi 24 mesi — suggerisce payment terms e costi fissi ancora attivi</p>' +
        '</div></div>' +
        '<div style="padding:0 1.5rem;">' +
        '<div style="display:flex;gap:0;border-bottom:2px solid var(--glass-border);margin-bottom:1.5rem;">' +
        '<button id="tab-pt" style="padding:0.6rem 1.25rem;font-size:0.875rem;font-weight:600;border:none;background:transparent;cursor:pointer;border-bottom:2px solid var(--brand-blue);color:var(--brand-blue);margin-bottom:-2px;">Tempi Pagamento Clienti</button>' +
        '<button id="tab-fc" style="padding:0.6rem 1.25rem;font-size:0.875rem;font-weight:600;border:none;background:transparent;cursor:pointer;color:var(--text-secondary);">Costi Fissi Reali</button>' +
        '</div>' +
        '<div id="storico-panel" style="min-height:200px;">' +
        spinner() + '</div></div>';

    let ptData = null;
    let fcData = null;

    async function showTab(tab) {
        const panel = document.getElementById('storico-panel');
        const btnPt = document.getElementById('tab-pt');
        const btnFc = document.getElementById('tab-fc');
        if (!panel) return;

        btnPt.style.borderBottomColor = tab === 'pt' ? 'var(--brand-blue)' : 'transparent';
        btnPt.style.color = tab === 'pt' ? 'var(--brand-blue)' : 'var(--text-secondary)';
        btnFc.style.borderBottomColor = tab === 'fc' ? 'var(--brand-blue)' : 'transparent';
        btnFc.style.color = tab === 'fc' ? 'var(--brand-blue)' : 'var(--text-secondary)';
        panel.innerHTML = spinner();

        try {
            if (tab === 'pt') {
                if (!ptData) ptData = await loadPaymentTermsData();
                if (thisId !== currentRenderId) return;
                renderPaymentTermsTab(panel, ptData);
            } else {
                if (!fcData) fcData = await loadFixedCostsCandidates();
                if (thisId !== currentRenderId) return;
                renderFixedCostsTab(panel, fcData);
            }
        } catch (e) {
            console.error('[storico]', e);
            if (panel) panel.innerHTML = '<p style="color:#dc2626;">Errore: ' + e.message + '</p>';
        }
    }

    setTimeout(() => {
        document.getElementById('tab-pt')?.addEventListener('click', () => showTab('pt'));
        document.getElementById('tab-fc')?.addEventListener('click', () => showTab('fc'));
        showTab('pt');
    }, 0);
}

function spinner() {
    return '<div style="display:flex;align-items:center;gap:8px;color:var(--text-secondary);font-size:0.9rem;"><span class="material-icons-round" style="font-size:1.1rem;animation:spin 1s linear infinite;">sync</span>Analisi in corso...</div>';
}
