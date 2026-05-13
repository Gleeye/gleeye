import { formatAmount } from '/js/modules/utils.js?v=8000';
import { supabase } from '/js/modules/config.js?v=8000';

let currentRenderId = 0;

// ─── helpers ─────────────────────────────────────────────────────────────────

function monthsAgo(dateStr) {
    if (!dateStr) return 999;
    return (Date.now() - new Date(dateStr)) / (1000 * 60 * 60 * 24 * 30.4);
}

function coefficienteVariazione(amounts) {
    if (amounts.length < 2) return 0;
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    if (!mean) return 0;
    const variance = amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length;
    return Math.sqrt(variance) / mean;
}

function guessFrequency(n, prima, ultima) {
    if (n < 2) return 'annual';
    const giorni = (new Date(ultima) - new Date(prima)) / (1000 * 60 * 60 * 24);
    const intervallo = giorni / (n - 1);
    if (intervallo <= 45) return 'monthly';
    if (intervallo <= 110) return 'quarterly';
    if (intervallo <= 220) return 'biannual';
    return 'annual';
}

const FREQ_LABEL = { monthly: 'Mensile', quarterly: 'Trimestrale', biannual: 'Semestrale', annual: 'Annuale' };
const FREQ_MULT = { monthly: 12, quarterly: 4, biannual: 2, annual: 1 };

const ACTIVE_MONTHS = { monthly: 3, quarterly: 5, biannual: 8, annual: 15 };

// ─── tab 1: payment terms ─────────────────────────────────────────────────────

// Inferisce il payment term standard dalla tipologia del cliente
function suggestTerms(businessName) {
    const n = (businessName || '').toLowerCase();
    // PA e enti pubblici: in Italia pagano lentamente per legge (D.Lgs. 231/2002 → 30gg ma nella pratica 60-90)
    if (/comune|regione|provincia|ministero|prefettura|questura|agenzia delle|inps|inail/.test(n)) return { terms: 60, motivo: 'PA — di legge max 30gg ma in pratica 60' };
    if (/università|universita|cnr|inaf|irccs|asl|aou|policlinico/.test(n)) return { terms: 90, motivo: 'Ente pubblico ricerca/sanità — tempi lunghi' };
    if (/camera di commercio|centro di competenza|start 4\.0/.test(n)) return { terms: 60, motivo: 'Ente pubblico/finanziato — 60gg standard' };
    if (/palazzo ducale|fondazione|museo/.test(n)) return { terms: 30, motivo: 'Fondazione culturale — 30gg standard' };
    if (/associazione|aiga|ordine degli|confindustria|confederazione|federazione/.test(n)) return { terms: 30, motivo: 'Associazione — 30gg standard' };
    if (/partito|gruppo consiliare|sindaco|politico|pd |lega |m5s/.test(n)) return { terms: 30, motivo: 'Committente politico — paga a 30gg' };
    if (/srl|spa|snc|sas|società|s\.r\.l|s\.p\.a/.test(n)) return { terms: 30, motivo: 'Società privata — 30gg standard' };
    return { terms: 30, motivo: 'Default B2B — 30gg' };
}

async function loadTopClients() {
    const { data, error } = await supabase
        .from('invoices')
        .select('client_id, amount_tax_excluded, invoice_date, clients(id, business_name, payment_terms)')
        .gte('invoice_date', new Date(Date.now() - 730 * 86400000).toISOString().split('T')[0]);

    if (error) throw error;

    const byClient = {};
    (data || []).forEach(inv => {
        const c = inv.clients;
        if (!c) return;
        if (!byClient[c.id]) byClient[c.id] = { id: c.id, nome: c.business_name, termineAttuale: c.payment_terms, totale: 0, n: 0 };
        byClient[c.id].totale += parseFloat(inv.amount_tax_excluded) || 0;
        byClient[c.id].n++;
    });

    return Object.values(byClient).sort((a, b) => b.totale - a.totale);
}

async function applyPaymentTerms(clientId, terms, btn) {
    btn.disabled = true;
    btn.textContent = '...';
    const { error } = await supabase.from('clients').update({ payment_terms: terms }).eq('id', clientId);
    if (error) { alert('Errore: ' + error.message); btn.disabled = false; btn.textContent = 'Salva'; return; }
    btn.textContent = '✓';
    btn.style.background = '#16a34a';
}

function renderPaymentTermsTab(container, clients) {
    const introHtml =
        '<div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:12px;padding:1rem 1.25rem;margin-bottom:1.25rem;">' +
        '<div style="font-size:0.875rem;font-weight:600;margin-bottom:4px;">Come funzionano i payment terms nel PEF</div>' +
        '<div style="font-size:0.82rem;color:var(--text-secondary);line-height:1.6;">Il <strong>payment term</strong> (giorni di dilazione) definisce quando incassi una fattura emessa. ' +
        'Nel break-even e nel cash flow, un cliente a 90gg vale meno di uno a 0gg perché il denaro arriva tardi. ' +
        'Per le PA italiane il limite legale è 30gg ma <em>nella pratica</em> pagano a 60-90gg. ' +
        'Non puoi calcolarlo automaticamente dallo storico perché nel DB manca il collegamento incasso↔fattura — ' +
        'ti mostro i tuoi clienti principali con un suggerimento basato sulla tipologia, tu confermi o correggi.</div>' +
        '</div>';

    const rows = clients.map(c => {
        const { terms: suggested, motivo } = suggestTerms(c.nome);
        const alreadySet = c.termineAttuale != null;
        const displayTerms = alreadySet ? c.termineAttuale : suggested;
        const termsLabel = (t) => t === 0 ? 'Immediato' : t + 'gg';

        return '<tr style="border-bottom:1px solid var(--glass-border);">' +
            '<td style="padding:0.6rem 0.75rem;font-size:0.85rem;font-weight:500;">' + c.nome + '</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:right;font-size:0.85rem;">' + formatAmount(c.totale) + ' €</td>' +
            '<td style="padding:0.6rem 0.75rem;font-size:0.75rem;color:var(--text-secondary);">' + motivo + '</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:center;">' +
            '<select class="pt-select" data-id="' + c.id + '" style="border:1px solid var(--glass-border);border-radius:6px;padding:3px 6px;font-size:0.8rem;background:var(--card-bg);color:var(--text-primary);">' +
            [0, 30, 60, 90, 120].map(t => '<option value="' + t + '"' + (t === displayTerms ? ' selected' : '') + '>' + termsLabel(t) + '</option>').join('') +
            '</select></td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:right;">' +
            '<button class="pt-save-btn" data-id="' + c.id + '" style="background:' + (alreadySet ? '#16a34a' : 'var(--brand-blue)') + ';color:#fff;border:none;border-radius:6px;padding:0.3rem 0.6rem;font-size:0.78rem;cursor:pointer;">' +
            (alreadySet ? '✓' : 'Salva') + '</button>' +
            '</td></tr>';
    }).join('');

    container.innerHTML = introHtml +
        '<div style="overflow-x:auto;">' +
        '<table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="background:var(--card-bg);border-bottom:2px solid var(--glass-border);">' +
        th('Cliente', 'left') + th('Fatturato 24m', 'right') + th('Perché questo termine', 'left') + th('Giorni', 'center') + th('', 'right') +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>';

    container.querySelectorAll('.pt-save-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sel = container.querySelector('.pt-select[data-id="' + btn.dataset.id + '"]');
            applyPaymentTerms(btn.dataset.id, parseInt(sel.value), btn);
        });
    });
}

// ─── tab 2: costi fissi — mentor mode ────────────────────────────────────────

// Costi noti che NON appaiono nel DB ma ogni agenzia ha
const COSTI_MANUALI = [
    { name: 'INPS / contributi titolare', note: 'Obbligatorio. Per SRL: almeno €3.500/anno di contributi fissi IVS artigiani/commercianti. Chiedi allo Studio Dondero l\'importo esatto.', category: 'personale', freq: 'annual', urgency: 'high' },
    { name: 'Banca — canone conto corrente', note: 'Ogni banca addebita un canone fisso mensile. Guarda il tuo estratto: di solito €5-20/mese.', category: 'amministrativo', freq: 'monthly', urgency: 'medium' },
    { name: 'Assicurazione RC professionale', note: 'Fortemente consigliata per agenzie di comunicazione. Copre errori su campagne/contenuti. Tipicamente €300-800/anno.', category: 'amministrativo', freq: 'annual', urgency: 'medium' },
    { name: 'Telefono / internet aziendale', note: 'Se hai una SIM o ADSL intestata all\'azienda. Tipicamente €30-80/mese.', category: 'ufficio', freq: 'monthly', urgency: 'low' },
    { name: 'Adobe Creative Cloud', note: 'Se usi Adobe (Premiere, Photoshop, After Effects) — €65-80/mese all\'anno per team. Controlla se è già in "Abbonamenti software".', category: 'software', freq: 'monthly', urgency: 'low' },
];

async function loadCostiFissiData() {
    const { data, error } = await supabase
        .from('passive_invoices')
        .select('issue_date, amount_tax_excluded, supplier_id, collaborator_id, supplier_name, suppliers(name)')
        .gte('issue_date', new Date(Date.now() - 730 * 86400000).toISOString().split('T')[0])
        .is('collaborator_id', null)
        .not('supplier_id', 'is', null);

    if (error) throw error;

    const bySupplier = {};
    (data || []).forEach(pi => {
        const name = pi.suppliers?.name || pi.supplier_name || 'Sconosciuto';
        if (!bySupplier[name]) bySupplier[name] = { name, amounts: [], dates: [] };
        bySupplier[name].amounts.push(parseFloat(pi.amount_tax_excluded) || 0);
        bySupplier[name].dates.push(pi.issue_date);
    });

    return Object.values(bySupplier).filter(s => s.amounts.length >= 2).map(s => {
        const sorted = s.dates.slice().sort();
        const prima = sorted[0];
        const ultima = sorted[sorted.length - 1];
        const freq = guessFrequency(s.amounts.length, prima, ultima);
        const media = s.amounts.reduce((a, b) => a + b, 0) / s.amounts.length;
        const cv = coefficienteVariazione(s.amounts);
        return {
            name: s.name, n: s.amounts.length, media, cv,
            stimaAnnua: media * FREQ_MULT[freq],
            freq, prima, ultima,
            isAttivo: monthsAgo(ultima) <= ACTIVE_MONTHS[freq],
            isIrregolare: cv > 0.5,
        };
    });
}

async function addFixedCost(row, btn) {
    btn.disabled = true; btn.textContent = '...';
    const { error } = await supabase.from('cfo_global_fixed_costs').insert({
        name: row.name, amount: Math.round(row.media * 100) / 100,
        frequency: row.freq, category: row.category || 'altro',
        year: new Date().getFullYear(), is_active: true,
    });
    if (error) { alert('Errore: ' + error.message); btn.disabled = false; btn.textContent = 'Aggiungi'; return; }
    btn.textContent = '✓ Aggiunto'; btn.style.background = '#16a34a';
}

function renderFixedCostsTab(container, rawData) {
    // Studio Dondero: è reale ma importo variabile → sezione separata "da valutare"
    const isDondero = (name) => /dondero/i.test(name);
    const isSaas = (name) => /notion|google|dropbox|make\.com|softr|keliweb|aruba|tms/i.test(name);
    const isHardware = (name) => /apple|envato/i.test(name);

    const certi = rawData.filter(r => r.isAttivo && !r.isIrregolare && !isDondero(r.name) && !isHardware(r.name));
    const daValutare = rawData.filter(r => r.isAttivo && (isDondero(r.name) || (r.isIrregolare && !isHardware(r.name) && !isDondero(r.name) && isSaas(r.name))));
    const interrotti = rawData.filter(r => !r.isAttivo);
    const nonFissi = rawData.filter(r => isHardware(r.name) || (r.isIrregolare && !isDondero(r.name) && !isSaas(r.name)));

    const totaleAnno = certi.reduce((s, r) => s + r.stimaAnnua, 0);

    const catColor = (cat) => ({
        software: { bg: 'rgba(99,102,241,.1)', c: '#6366f1' },
        ufficio: { bg: 'rgba(16,185,129,.1)', c: '#10b981' },
        amministrativo: { bg: 'rgba(245,158,11,.1)', c: '#f59e0b' },
        altro: { bg: 'rgba(107,114,128,.1)', c: '#6b7280' },
    }[cat || 'altro'] || { bg: 'rgba(107,114,128,.1)', c: '#6b7280' });

    function guessCategory(name) {
        const n = name.toLowerCase();
        if (/notion|google|dropbox|make|softr|keliweb|aruba|tms/.test(n)) return 'software';
        if (/workspace|regus/.test(n)) return 'ufficio';
        if (/dondero|studio/.test(n)) return 'amministrativo';
        return 'altro';
    }

    function rowCerto(r) {
        const cat = guessCategory(r.name);
        const cc = catColor(cat);
        r.category = cat;
        return '<tr style="border-bottom:1px solid var(--glass-border);">' +
            '<td style="padding:0.6rem 0.75rem;font-size:0.875rem;font-weight:500;">' + r.name + '</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:right;font-size:0.875rem;">' + formatAmount(r.media) + ' €</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:center;">' +
            '<span style="background:rgba(59,130,246,.1);color:#3b82f6;border-radius:6px;padding:2px 8px;font-size:0.78rem;font-weight:600;">' + FREQ_LABEL[r.freq] + '</span></td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:right;font-weight:600;">' + formatAmount(r.stimaAnnua) + ' €/anno</td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:center;">' +
            '<span style="background:' + cc.bg + ';color:' + cc.c + ';border-radius:6px;padding:2px 8px;font-size:0.78rem;">' + cat + '</span></td>' +
            '<td style="padding:0.6rem 0.75rem;text-align:right;">' +
            '<button class="fc-add" data-name="' + r.name.replace(/"/g, '&quot;') + '" data-media="' + r.media + '" data-freq="' + r.freq + '" data-cat="' + cat + '" style="background:var(--brand-blue);color:#fff;border:none;border-radius:6px;padding:0.3rem 0.75rem;font-size:0.78rem;cursor:pointer;">Aggiungi</button></td>' +
            '</tr>';
    }

    function tableWrap(rows) {
        return '<div style="overflow-x:auto;margin-bottom:0.5rem;"><table style="width:100%;border-collapse:collapse;">' +
            '<thead><tr style="background:var(--card-bg);border-bottom:2px solid var(--glass-border);">' +
            th('Fornitore', 'left') + th('Importo medio', 'right') + th('Frequenza', 'center') + th('Stima annua', 'right') + th('Categoria', 'center') + th('', 'right') +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    function sectionTitle(icon, color, title, subtitle) {
        return '<div style="display:flex;align-items:center;gap:8px;margin:1.5rem 0 0.75rem;">' +
            '<span class="material-icons-round" style="color:' + color + ';font-size:1.1rem;">' + icon + '</span>' +
            '<div><div style="font-size:0.9rem;font-weight:700;color:' + color + ';">' + title + '</div>' +
            (subtitle ? '<div style="font-size:0.78rem;color:var(--text-secondary);">' + subtitle + '</div>' : '') +
            '</div></div>';
    }

    let html =
        '<div style="background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.2);border-radius:12px;padding:1rem 1.25rem;margin-bottom:1.25rem;display:flex;align-items:center;justify-content:space-between;">' +
        '<div><div style="font-size:0.75rem;color:#6366f1;font-weight:600;text-transform:uppercase;letter-spacing:.04em;">Stima costi fissi annui certi (dal DB)</div>' +
        '<div style="font-size:1.5rem;font-weight:700;color:#6366f1;">' + formatAmount(totaleAnno) + ' €/anno</div>' +
        '<div style="font-size:0.78rem;color:var(--text-secondary);margin-top:2px;">Solo costi attivi con importo stabile. Mancano INPS, banca, telefono e altri — vedi sotto.</div>' +
        '</div></div>';

    // Sezione 1: certi
    html += sectionTitle('check_circle', '#16a34a', '✅ Aggiungi subito',
        'Attivi, importo stabile, presenti regolarmente nel DB negli ultimi mesi');
    html += certi.length ? tableWrap(certi.map(rowCerto).join('')) :
        '<p style="font-size:0.85rem;color:var(--text-secondary);">Nessun costo fisso certo identificato.</p>';

    // Sezione 2: da valutare (Dondero + irregolari SaaS)
    if (daValutare.length) {
        html += sectionTitle('help', '#f59e0b', '⚠️ Reali ma da valutare',
            'Attivi, ma importo variabile — devi decidere tu quale cifra inserire');

        const dondero = daValutare.find(r => isDondero(r.name));
        if (dondero) {
            const annualeStimato = dondero.media * FREQ_MULT[dondero.freq];
            html += '<div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:1rem 1.25rem;margin-bottom:1rem;">' +
                '<div style="font-weight:600;margin-bottom:4px;">Studio Dondero — Commercialista</div>' +
                '<div style="font-size:0.82rem;color:var(--text-secondary);line-height:1.6;margin-bottom:0.75rem;">' +
                dondero.n + ' fatture in 24 mesi, media €' + formatAmount(dondero.media) + ' ma importo variabile (CV ' + Math.round(dondero.cv * 100) + '%). ' +
                'È un costo fisso reale — ogni agenzia ha un commercialista di fiducia. ' +
                'La variabilità dipende dalle pratiche straordinarie (bilancio, CU, F24 extra). ' +
                '<strong>Nel PEF inseriscilo come costo annuale stimato:</strong> prendi la media annua storica (~' + formatAmount(annualeStimato) + ' €) e aggiungi un 15-20% di buffer per gli straordinari.' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:8px;">' +
                '<input id="dondero-amount" type="number" value="' + Math.round(dondero.media) + '" style="width:100px;border:1px solid var(--glass-border);border-radius:6px;padding:4px 8px;font-size:0.85rem;background:var(--card-bg);color:var(--text-primary);">' +
                '<select id="dondero-freq" style="border:1px solid var(--glass-border);border-radius:6px;padding:4px 8px;font-size:0.82rem;background:var(--card-bg);color:var(--text-primary);">' +
                Object.entries(FREQ_LABEL).map(([k, v]) => '<option value="' + k + '"' + (k === dondero.freq ? ' selected' : '') + '>' + v + '</option>').join('') +
                '</select>' +
                '<button id="dondero-add" style="background:var(--brand-blue);color:#fff;border:none;border-radius:6px;padding:0.3rem 0.75rem;font-size:0.78rem;cursor:pointer;">Aggiungi</button>' +
                '</div></div>';
        }

        const altriValutare = daValutare.filter(r => !isDondero(r.name));
        if (altriValutare.length) html += tableWrap(altriValutare.map(rowCerto).join(''));
    }

    // Sezione 3: non nel DB — checklist manuale
    html += sectionTitle('add_circle_outline', '#6366f1', '📋 Non li vedo nel DB — aggiungi manualmente',
        'Costi fissi tipici di ogni agenzia che non passano da fatture passive nel gestionale');

    html += '<div style="display:flex;flex-direction:column;gap:0.75rem;margin-bottom:1rem;">';
    COSTI_MANUALI.forEach((cm, idx) => {
        const urgencyColor = cm.urgency === 'high' ? '#dc2626' : cm.urgency === 'medium' ? '#f59e0b' : '#6b7280';
        const urgencyLabel = cm.urgency === 'high' ? 'Alta priorità' : cm.urgency === 'medium' ? 'Media' : 'Bassa';
        html += '<div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:10px;padding:0.875rem 1rem;display:flex;align-items:flex-start;gap:12px;">' +
            '<div style="flex:1;">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">' +
            '<span style="font-size:0.875rem;font-weight:600;">' + cm.name + '</span>' +
            '<span style="font-size:0.7rem;color:' + urgencyColor + ';font-weight:600;">' + urgencyLabel + '</span>' +
            '</div>' +
            '<div style="font-size:0.8rem;color:var(--text-secondary);line-height:1.5;">' + cm.note + '</div>' +
            '</div>' +
            '<a href="#cfo-breakeven" style="flex-shrink:0;background:var(--card-bg);border:1px solid var(--glass-border);color:var(--text-primary);text-decoration:none;border-radius:6px;padding:0.3rem 0.75rem;font-size:0.78rem;white-space:nowrap;">→ Aggiungi in Break-even</a>' +
            '</div>';
    });
    html += '</div>';

    // Sezione 4: interrotti
    if (interrotti.length) {
        html += sectionTitle('cancel', '#dc2626', '🔴 Interrotti — non aggiungere',
            'Ultima fattura fuori dalla soglia di frequenza: il costo non è più attivo');
        html += '<div style="opacity:0.6;">' + tableWrap(
            interrotti.map(r => {
                const mfa = Math.round(monthsAgo(r.ultima));
                return '<tr style="border-bottom:1px solid var(--glass-border);">' +
                    '<td style="padding:0.6rem 0.75rem;font-size:0.875rem;">' + r.name +
                    '<span style="font-size:0.72rem;color:#dc2626;margin-left:6px;">interrotto ~' + mfa + ' mesi fa</span></td>' +
                    '<td style="padding:0.6rem 0.75rem;text-align:right;font-size:0.85rem;">' + formatAmount(r.media) + ' €</td>' +
                    '<td style="padding:0.6rem 0.75rem;text-align:center;font-size:0.8rem;">' + FREQ_LABEL[r.freq] + '</td>' +
                    '<td colspan="3" style="padding:0.6rem 0.75rem;font-size:0.78rem;color:var(--text-secondary);">Non incluso nella stima</td>' +
                    '</tr>';
            }).join('')
        ) + '</div>';
    }

    // Sezione 5: non fissi
    if (nonFissi.length) {
        html += sectionTitle('block', '#6b7280', 'Non sono costi fissi',
            'Acquisti occasionali o importi troppo variabili — non appartengono alla distinta base');
        html += '<div style="opacity:0.55;">' + tableWrap(
            nonFissi.map(r =>
                '<tr style="border-bottom:1px solid var(--glass-border);">' +
                '<td style="padding:0.6rem 0.75rem;font-size:0.875rem;">' + r.name + '</td>' +
                '<td style="padding:0.6rem 0.75rem;text-align:right;">' + formatAmount(r.media) + ' €</td>' +
                '<td colspan="4" style="padding:0.6rem 0.75rem;font-size:0.78rem;color:var(--text-secondary);">Acquisti una-tantum o hardware — va nei costi variabili o nella CapEx</td>' +
                '</tr>'
            ).join('')
        ) + '</div>';
    }

    container.innerHTML = html;

    // Handler Aggiungi certi
    container.querySelectorAll('.fc-add').forEach(btn => {
        btn.addEventListener('click', () => addFixedCost({
            name: btn.dataset.name, media: parseFloat(btn.dataset.media),
            freq: btn.dataset.freq, category: btn.dataset.cat,
        }, btn));
    });

    // Handler Dondero custom
    const dBtn = document.getElementById('dondero-add');
    if (dBtn) {
        dBtn.addEventListener('click', () => {
            const amount = parseFloat(document.getElementById('dondero-amount').value) || 800;
            const freq = document.getElementById('dondero-freq').value;
            addFixedCost({ name: 'Studio Dondero (Commercialista)', media: amount, freq, category: 'amministrativo' }, dBtn);
        });
    }
}

// ─── helpers UI ──────────────────────────────────────────────────────────────

function th(txt, align) {
    return '<th style="padding:0.5rem 0.75rem;text-align:' + align + ';font-size:0.75rem;color:var(--text-secondary);font-weight:600;">' + txt + '</th>';
}

function spinner() {
    return '<div style="display:flex;align-items:center;gap:8px;color:var(--text-secondary);font-size:0.9rem;padding:1.5rem 0;"><span class="material-icons-round" style="font-size:1.1rem;animation:spin 1s linear infinite;">sync</span>Analisi in corso...</div>';
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
        '<p style="margin:2px 0 0;font-size:0.8rem;color:var(--text-secondary);">Analisi guidata per compilare payment terms e costi fissi del PEF</p>' +
        '</div></div>' +
        '<div style="padding:0 1.5rem;">' +
        '<div style="display:flex;gap:0;border-bottom:2px solid var(--glass-border);margin-bottom:1.5rem;">' +
        '<button id="tab-pt" style="padding:0.6rem 1.25rem;font-size:0.875rem;font-weight:600;border:none;background:transparent;cursor:pointer;border-bottom:2px solid var(--brand-blue);color:var(--brand-blue);margin-bottom:-2px;">Tempi Pagamento Clienti</button>' +
        '<button id="tab-fc" style="padding:0.6rem 1.25rem;font-size:0.875rem;font-weight:600;border:none;background:transparent;cursor:pointer;color:var(--text-secondary);">Costi Fissi Aziendali</button>' +
        '</div>' +
        '<div id="storico-panel">' + spinner() + '</div></div>';

    let ptData = null;
    let fcData = null;

    async function showTab(tab) {
        const panel = document.getElementById('storico-panel');
        const btnPt = document.getElementById('tab-pt');
        const btnFc = document.getElementById('tab-fc');
        if (!panel) return;
        btnPt.style.cssText += ';border-bottom-color:' + (tab === 'pt' ? 'var(--brand-blue)' : 'transparent') + ';color:' + (tab === 'pt' ? 'var(--brand-blue)' : 'var(--text-secondary)');
        btnFc.style.cssText += ';border-bottom-color:' + (tab === 'fc' ? 'var(--brand-blue)' : 'transparent') + ';color:' + (tab === 'fc' ? 'var(--brand-blue)' : 'var(--text-secondary)');
        panel.innerHTML = spinner();
        try {
            if (tab === 'pt') {
                if (!ptData) ptData = await loadTopClients();
                if (thisId !== currentRenderId) return;
                renderPaymentTermsTab(panel, ptData);
            } else {
                if (!fcData) fcData = await loadCostiFissiData();
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
