import { formatAmount } from '/js/modules/utils.js?v=8000';
import { supabase } from '/js/modules/config.js?v=8000';

let currentRenderId = 0;

// ─── normalizza giorni → payment_terms standard ────────────────────────────

function normalizeTerms(days) {
    if (days <= 5)  return 0;
    if (days <= 20) return 0;
    if (days <= 45) return 30;
    if (days <= 75) return 60;
    if (days <= 105) return 90;
    return 120;
}

function termsLabel(days) {
    const t = normalizeTerms(days);
    return t === 0 ? 'Immediato' : t + 'gg';
}

// ─── categorie suggerite per fornitore ─────────────────────────────────────

const SUPPLIER_CATEGORY_HINTS = {
    'notion': 'software',
    'google': 'software',
    'dropbox': 'software',
    'keliweb': 'software',
    'aruba': 'software',
    'workspace': 'ufficio',
    'regus': 'ufficio',
    'studio dondero': 'amministrativo',
    'dondero': 'amministrativo',
};

function guessCategory(name) {
    const lower = (name || '').toLowerCase();
    for (const [key, cat] of Object.entries(SUPPLIER_CATEGORY_HINTS)) {
        if (lower.includes(key)) return cat;
    }
    return 'altro';
}

function guessFrequency(nFatture, primaFattura, ultimaFattura) {
    if (nFatture < 2) return 'annual';
    const mesi = Math.max(1,
        (new Date(ultimaFattura) - new Date(primaFattura)) / (1000 * 60 * 60 * 24 * 30)
    );
    const perMese = nFatture / mesi;
    if (perMese >= 0.8) return 'monthly';
    if (perMese >= 0.4) return 'quarterly';
    if (perMese >= 0.2) return 'biannual';
    return 'annual';
}

const FREQ_LABEL = {
    monthly: 'Mensile',
    quarterly: 'Trimestrale',
    biannual: 'Semestrale',
    annual: 'Annuale',
    once: 'Una tantum',
};

const FREQ_MULT = { monthly: 12, quarterly: 4, biannual: 2, annual: 1, once: 1 };

// ─── tab 1: payment terms clienti ──────────────────────────────────────────

async function loadPaymentTermsData() {
    const { data, error } = await supabase.rpc
        ? null
        : null;

    // Query diretta: invoice → bank_transaction entrata collegata
    const { data: rows, error: err } = await supabase
        .from('invoices')
        .select('id, invoice_date, status, amount_tax_excluded, client_id, clients(id, business_name, payment_terms), bank_transactions!active_invoice_id(date, type)')
        .gte('invoice_date', new Date(Date.now() - 730 * 86400000).toISOString().split('T')[0])
        .in('status', ['Pagato', 'Pagata']);

    if (err) throw err;

    // Aggrega per cliente
    const byClient = {};
    (rows || []).forEach(inv => {
        const c = inv.clients;
        if (!c) return;
        const bt = (inv.bank_transactions || []).find(b => b.type === 'entrata');
        if (!bt || !bt.date) return;
        const giorni = Math.round((new Date(bt.date) - new Date(inv.invoice_date)) / 86400000);
        if (giorni < 0) return;
        if (!byClient[c.id]) {
            byClient[c.id] = {
                id: c.id,
                nome: c.business_name,
                termineAttuale: c.payment_terms,
                giorni: [],
                totale: 0,
            };
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
        .filter(c => c.nFatture >= 1)
        .sort((a, b) => b.totale - a.totale);
}

async function applyPaymentTerms(clientId, terms, btn) {
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = '...';
    const { error } = await supabase.from('clients').update({ payment_terms: terms }).eq('id', clientId);
    if (error) {
        alert('Errore: ' + error.message);
    } else {
        btn.textContent = '✓ Applicato';
        btn.style.background = '#16a34a';
        btn.disabled = true;
        return;
    }
    btn.disabled = false;
    btn.textContent = orig;
}

function renderPaymentTermsTab(container, clients) {
    if (!clients.length) {
        container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:2rem;">Nessun dato: collega le fatture ai movimenti bancari dalla vista Cassa.</p>';
        return;
    }

    const rows = clients.map(c => {
        const suggested = normalizeTerms(c.mediaGiorni);
        const alreadySet = c.termineAttuale === suggested;
        return '<tr style="border-bottom:1px solid var(--glass-border);">' +
            '<td style="padding:0.6rem 0.75rem;font-size:0.875rem;font-weight:500;">' + c.nome + '</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:center;font-size:0.875rem;">' + c.nFatture + '</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:right;font-size:0.875rem;">' + c.mediaGiorni + 'gg</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:center;">' +
            '<span style="background:rgba(59,130,246,0.1);color:#3b82f6;border-radius:6px;padding:2px 8px;font-size:0.8rem;font-weight:600;">' + termsLabel(c.mediaGiorni) + '</span>' +
            '</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:center;font-size:0.8rem;color:var(--text-secondary);">' +
            (c.termineAttuale != null ? (c.termineAttuale === 0 ? 'Immediato' : c.termineAttuale + 'gg') : '—') +
            '</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:right;">' +
            (alreadySet
                ? '<span style="font-size:0.78rem;color:#16a34a;">✓ già impostato</span>'
                : '<button class="pt-apply-btn" data-id="' + c.id + '" data-terms="' + suggested + '" style="background:var(--brand-blue);color:#fff;border:none;border-radius:6px;padding:0.3rem 0.75rem;font-size:0.78rem;cursor:pointer;">Applica</button>') +
            '</td>' +
            '</tr>';
    }).join('');

    container.innerHTML =
        '<p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:1rem;">Calcolato da ' +
        clients.reduce((s, c) => s + c.nFatture, 0) +
        ' incassi negli ultimi 24 mesi. Il valore suggerito è normalizzato agli standard (0/30/60/90/120gg).</p>' +
        '<div style="overflow-x:auto;">' +
        '<table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="background:var(--card-bg);border-bottom:2px solid var(--glass-border);">' +
        '<th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Cliente</th>' +
        '<th style="padding:0.5rem 0.75rem;text-align:center;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Fatture</th>' +
        '<th style="padding:0.5rem 0.75rem;text-align:right;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Media giorni reali</th>' +
        '<th style="padding:0.5rem 0.75rem;text-align:center;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Suggerito</th>' +
        '<th style="padding:0.5rem 0.75rem;text-align:center;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Attuale</th>' +
        '<th style="padding:0.5rem 0.75rem;text-align:right;font-size:0.75rem;color:var(--text-secondary);font-weight:600;"></th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>';

    container.querySelectorAll('.pt-apply-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const terms = parseInt(btn.dataset.terms);
            applyPaymentTerms(btn.dataset.id, terms, btn);
        });
    });
}

// ─── tab 2: costi fissi da storico ────────────────────────────────────────

async function loadFixedCostsCandidates() {
    // Solo fatture passive con supplier (non collaboratori)
    const { data, error } = await supabase
        .from('passive_invoices')
        .select('id, issue_date, amount_tax_excluded, supplier_id, collaborator_id, supplier_name, suppliers(name)')
        .gte('issue_date', new Date(Date.now() - 730 * 86400000).toISOString().split('T')[0])
        .is('collaborator_id', null)
        .not('supplier_id', 'is', null);

    if (error) throw error;

    // Aggrega per fornitore
    const bySupplier = {};
    (data || []).forEach(pi => {
        const name = (pi.suppliers && pi.suppliers.name) || pi.supplier_name || 'Sconosciuto';
        if (!bySupplier[name]) {
            bySupplier[name] = { name, amounts: [], dates: [], supplierId: pi.supplier_id };
        }
        bySupplier[name].amounts.push(parseFloat(pi.amount_tax_excluded) || 0);
        bySupplier[name].dates.push(pi.issue_date);
    });

    return Object.values(bySupplier)
        .filter(s => s.amounts.length >= 2)
        .map(s => {
            const sorted = s.dates.slice().sort();
            const freq = guessFrequency(s.amounts.length, sorted[0], sorted[sorted.length - 1]);
            const media = s.amounts.reduce((a, b) => a + b, 0) / s.amounts.length;
            const annuale = media * FREQ_MULT[freq];
            return {
                name: s.name,
                nFatture: s.amounts.length,
                media,
                annuale,
                frequency: freq,
                category: guessCategory(s.name),
                prima: sorted[0],
                ultima: sorted[sorted.length - 1],
            };
        })
        .sort((a, b) => b.annuale - a.annuale);
}

async function addFixedCost(candidate, btn) {
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = '...';
    const { error } = await supabase.from('cfo_global_fixed_costs').insert({
        name: candidate.name,
        amount: Math.round(candidate.media * 100) / 100,
        frequency: candidate.frequency,
        category: candidate.category,
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

function renderFixedCostsTab(container, candidates) {
    if (!candidates.length) {
        container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:2rem;">Nessun fornitore ricorrente trovato negli ultimi 24 mesi.</p>';
        return;
    }

    const totalAnnuale = candidates.reduce((s, c) => s + c.annuale, 0);

    const rows = candidates.map(c => {
        const catColors = {
            software: { bg: 'rgba(99,102,241,0.1)', color: '#6366f1' },
            ufficio: { bg: 'rgba(16,185,129,0.1)', color: '#10b981' },
            amministrativo: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
            altro: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280' },
        };
        const cc = catColors[c.category] || catColors.altro;
        return '<tr style="border-bottom:1px solid var(--glass-border);">' +
            '<td style="padding:0.6rem 0.75rem;font-size:0.875rem;font-weight:500;">' + c.name + '</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:center;font-size:0.8rem;color:var(--text-secondary);">' + c.nFatture + '</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:right;font-size:0.875rem;">' + formatAmount(c.media) + ' €</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:center;">' +
            '<span style="background:rgba(59,130,246,0.1);color:#3b82f6;border-radius:6px;padding:2px 8px;font-size:0.78rem;font-weight:600;">' + FREQ_LABEL[c.frequency] + '</span>' +
            '</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:right;font-size:0.875rem;">' + formatAmount(c.annuale) + ' €/anno</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:center;">' +
            '<span style="background:' + cc.bg + ';color:' + cc.color + ';border-radius:6px;padding:2px 8px;font-size:0.78rem;">' + c.category + '</span>' +
            '</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:right;">' +
            '<button class="fc-add-btn" style="background:var(--brand-blue);color:#fff;border:none;border-radius:6px;padding:0.3rem 0.75rem;font-size:0.78rem;cursor:pointer;" ' +
            'data-name="' + c.name.replace(/"/g, '&quot;') + '" ' +
            'data-media="' + c.media + '" data-freq="' + c.frequency + '" data-cat="' + c.category + '">' +
            'Aggiungi</button>' +
            '</td>' +
            '</tr>';
    }).join('');

    container.innerHTML =
        '<div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:10px;padding:0.875rem 1.25rem;margin-bottom:1.25rem;display:flex;align-items:center;justify-content:space-between;">' +
        '<div>' +
        '<div style="font-size:0.75rem;color:#6366f1;font-weight:600;text-transform:uppercase;letter-spacing:.04em;">Stima costi fissi annui da storico</div>' +
        '<div style="font-size:1.4rem;font-weight:700;color:#6366f1;margin-top:2px;">' + formatAmount(totalAnnuale) + ' €</div>' +
        '</div>' +
        '<div style="font-size:0.8rem;color:var(--text-secondary);">Solo fornitori ricorrenti (collaboratori esclusi)</div>' +
        '</div>' +
        '<p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:1rem;">Clicca "Aggiungi" per inserire il costo nella tabella Costi Fissi Aziendali (visibile in Break-even). Puoi modificare importo e frequenza dopo l\'aggiunta.</p>' +
        '<div style="overflow-x:auto;">' +
        '<table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="background:var(--card-bg);border-bottom:2px solid var(--glass-border);">' +
        '<th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Fornitore</th>' +
        '<th style="padding:0.5rem 0.75rem;text-align:center;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Fatture</th>' +
        '<th style="padding:0.5rem 0.75rem;text-align:right;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Importo medio</th>' +
        '<th style="padding:0.5rem 0.75rem;text-align:center;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Frequenza</th>' +
        '<th style="padding:0.5rem 0.75rem;text-align:right;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Stima annua</th>' +
        '<th style="padding:0.5rem 0.75rem;text-align:center;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Categoria</th>' +
        '<th style="padding:0.5rem 0.75rem;text-align:right;font-size:0.75rem;color:var(--text-secondary);font-weight:600;"></th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>';

    container.querySelectorAll('.fc-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const candidate = {
                name: btn.dataset.name,
                media: parseFloat(btn.dataset.media),
                frequency: btn.dataset.freq,
                category: btn.dataset.cat,
            };
            addFixedCost(candidate, btn);
        });
    });
}

// ─── main render ──────────────────────────────────────────────────────────

export async function renderCFOStorico(container) {
    const thisId = ++currentRenderId;
    const el = container || document.getElementById('content-area');
    if (!el) return;

    el.innerHTML =
        '<div style="display:flex;align-items:center;gap:12px;padding:1.5rem 1.5rem 1rem;">' +
        '<span class="material-icons-round" style="color:var(--brand-blue);">history_edu</span>' +
        '<div>' +
        '<h2 style="margin:0;font-size:1.25rem;font-weight:600;">Popola da Storico</h2>' +
        '<p style="margin:2px 0 0;font-size:0.8rem;color:var(--text-secondary);">Analisi automatica degli ultimi 24 mesi — suggerisce payment terms e costi fissi reali</p>' +
        '</div></div>' +
        '<div style="padding:0 1.5rem;">' +
        '<div style="display:flex;gap:0;border-bottom:2px solid var(--glass-border);margin-bottom:1.5rem;">' +
        '<button id="tab-pt" style="padding:0.6rem 1.25rem;font-size:0.875rem;font-weight:600;border:none;background:transparent;cursor:pointer;border-bottom:2px solid var(--brand-blue);color:var(--brand-blue);margin-bottom:-2px;">Tempi Pagamento Clienti</button>' +
        '<button id="tab-fc" style="padding:0.6rem 1.25rem;font-size:0.875rem;font-weight:600;border:none;background:transparent;cursor:pointer;color:var(--text-secondary);">Costi Fissi Reali</button>' +
        '</div>' +
        '<div id="storico-panel" style="min-height:200px;">' +
        '<div style="display:flex;align-items:center;gap:8px;color:var(--text-secondary);font-size:0.9rem;">' +
        '<span class="material-icons-round" style="font-size:1.1rem;animation:spin 1s linear infinite;">sync</span>Analisi in corso...</div>' +
        '</div></div>';

    let activeTab = 'pt';
    let ptData = null;
    let fcData = null;

    async function showTab(tab) {
        activeTab = tab;
        const panel = document.getElementById('storico-panel');
        const btnPt = document.getElementById('tab-pt');
        const btnFc = document.getElementById('tab-fc');
        if (!panel || !btnPt || !btnFc) return;

        btnPt.style.borderBottomColor = tab === 'pt' ? 'var(--brand-blue)' : 'transparent';
        btnPt.style.color = tab === 'pt' ? 'var(--brand-blue)' : 'var(--text-secondary)';
        btnFc.style.borderBottomColor = tab === 'fc' ? 'var(--brand-blue)' : 'transparent';
        btnFc.style.color = tab === 'fc' ? 'var(--brand-blue)' : 'var(--text-secondary)';

        panel.innerHTML = '<div style="display:flex;align-items:center;gap:8px;color:var(--text-secondary);font-size:0.9rem;"><span class="material-icons-round" style="font-size:1.1rem;animation:spin 1s linear infinite;">sync</span>Analisi in corso...</div>';

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
            if (panel) panel.innerHTML = '<p style="color:#dc2626;">Errore: ' + e.message + '</p>';
        }
    }

    // aspetta che il DOM sia pronto
    setTimeout(() => {
        const btnPt = document.getElementById('tab-pt');
        const btnFc = document.getElementById('tab-fc');
        if (btnPt) btnPt.addEventListener('click', () => showTab('pt'));
        if (btnFc) btnFc.addEventListener('click', () => showTab('fc'));
        showTab('pt');
    }, 0);
}
