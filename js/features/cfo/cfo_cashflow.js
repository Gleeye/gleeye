import { state } from '/js/modules/state.js?v=8000';
import { formatAmount } from '/js/modules/utils.js?v=8000';
import {
    fetchBankTransactions,
    fetchInvoices,
    fetchPassiveInvoices,
    fetchPayments,
} from '/js/modules/api.js?v=8000';

let currentRenderId = 0;

// ─── helpers ─────────────────────────────────────────────────────────────────

function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

function isoDate(d) {
    return d.toISOString().split('T')[0];
}

function formatDateIT(iso) {
    const [y, m, dd] = iso.split('-');
    return `${dd}/${m}/${y}`;
}

// ─── data aggregation ────────────────────────────────────────────────────────

function buildCashflowProjection({ bankTxs, payments, invoices, passiveInvoices }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = addDays(today, 90);

    // Saldo attuale = posted bank transactions
    const currentBalance = bankTxs
        .filter(t => t.status === 'posted')
        .reduce((sum, t) => {
            const amt = parseFloat(t.amount) || 0;
            return sum + (t.type === 'entrata' ? amt : -amt);
        }, 0);

    // Bucket future flows by date string
    const flows = {}; // { 'YYYY-MM-DD': { in: [], out: [] } }

    function addFlow(dateStr, amount, label, isIn) {
        if (!dateStr) return;
        const d = new Date(dateStr);
        if (d < today || d > horizon) return;
        const key = isoDate(d);
        if (!flows[key]) flows[key] = { in: [], out: [] };
        const bucket = isIn ? flows[key].in : flows[key].out;
        bucket.push({ amount: Math.abs(parseFloat(amount) || 0), label });
    }

    // Pagamenti attivi (Cliente = entrata)
    (payments || []).forEach(p => {
        if (p.status === 'Completato') return;
        const isIn = p.payment_type === 'Cliente';
        const label = isIn
            ? (p.clients?.business_name || 'Cliente')
            : (p.collaborators?.full_name || p.suppliers?.name || p.payment_type || 'Uscita');
        addFlow(p.due_date, p.amount, label, isIn);
    });

    // Fatture attive non saldate (entrate previste)
    (invoices || []).forEach(inv => {
        if (inv.status === 'Saldata') return;
        const amt = parseFloat(inv.amount_tax_excluded) || 0;
        if (!amt) return;
        const label = inv.clients?.business_name || inv.invoice_number || 'Fattura';
        addFlow(inv.due_date, amt, `Fattura ${inv.invoice_number || ''} – ${label}`, true);
    });

    // Fatture passive non pagate (uscite previste)
    (passiveInvoices || []).forEach(pi => {
        if (pi.status === 'Pagato') return;
        const amt = parseFloat(pi.amount_tax_excluded || pi.amount) || 0;
        if (!amt) return;
        const label = pi.suppliers?.name || pi.collaborators?.full_name || pi.invoice_number || 'Fattura passiva';
        addFlow(pi.due_date, amt, label, false);
    });

    // Build timeline (only days with movements)
    const sortedDays = Object.keys(flows).sort();
    let runningBalance = currentBalance;
    const timeline = [];

    sortedDays.forEach(day => {
        const { in: ins, out: outs } = flows[day];
        const totalIn = ins.reduce((s, e) => s + e.amount, 0);
        const totalOut = outs.reduce((s, e) => s + e.amount, 0);
        runningBalance += totalIn - totalOut;
        timeline.push({
            date: day,
            entries: [
                ...ins.map(e => ({ ...e, isIn: true })),
                ...outs.map(e => ({ ...e, isIn: false })),
            ],
            totalIn,
            totalOut,
            balance: runningBalance,
            isNegative: runningBalance < 0,
        });
    });

    const totalFutureIn = timeline.reduce((s, d) => s + d.totalIn, 0);
    const totalFutureOut = timeline.reduce((s, d) => s + d.totalOut, 0);
    const negativeDays = timeline.filter(d => d.isNegative);

    return { currentBalance, timeline, totalFutureIn, totalFutureOut, negativeDays };
}

// ─── SVG chart ───────────────────────────────────────────────────────────────

function buildSvgChart(timeline, currentBalance) {
    if (!timeline.length) return '<p style="color:var(--text-secondary);text-align:center;padding:2rem;">Nessun movimento previsto nei prossimi 90 giorni.</p>';

    const W = 700, H = 180, PAD = { top: 16, right: 24, bottom: 32, left: 64 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    const balances = [currentBalance, ...timeline.map(d => d.balance)];
    const minB = Math.min(...balances);
    const maxB = Math.max(...balances);
    const range = maxB - minB || 1;

    const scaleX = idx => PAD.left + (idx / (balances.length - 1)) * plotW;
    const scaleY = val => PAD.top + plotH - ((val - minB) / range) * plotH;

    // Zero line y
    const zeroY = scaleY(0);

    // Polyline points
    const pts = balances.map((b, i) => `${scaleX(i)},${scaleY(b)}`).join(' ');

    // Area fill (split above/below zero)
    const areaAbove = balances.map((b, i) => {
        const x = scaleX(i);
        const y = scaleY(Math.max(b, 0));
        return `${x},${y}`;
    });
    const areaAbovePath = `M ${scaleX(0)},${zeroY} L ${areaAbove.join(' L ')} L ${scaleX(balances.length - 1)},${zeroY} Z`;

    const areaBelowPath = balances.some(b => b < 0)
        ? `M ${scaleX(0)},${zeroY} L ${balances.map((b, i) => `${scaleX(i)},${scaleY(Math.min(b, 0))}`).join(' L ')} L ${scaleX(balances.length - 1)},${zeroY} Z`
        : '';

    // X-axis labels: show first, middle, last
    const labelIdxs = [0, Math.floor((balances.length - 1) / 2), balances.length - 1];
    const allDates = ['Oggi', ...timeline.map(d => formatDateIT(d.date))];
    const xLabels = labelIdxs.map(i =>
        `<text x="${scaleX(i)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="var(--text-secondary)">${allDates[i] || ''}</text>`
    ).join('');

    // Y-axis labels
    const yVals = [minB, 0, maxB].filter((v, i, a) => a.indexOf(v) === i);
    const yLabels = yVals.map(v =>
        `<text x="${PAD.left - 6}" y="${scaleY(v) + 3}" text-anchor="end" font-size="9" fill="${v < 0 ? '#ef4444' : 'var(--text-secondary)'}">${v >= 0 ? '+' : ''}${Math.round(v / 1000)}k</text>`
    ).join('');

    return `
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block;" preserveAspectRatio="none">
            <defs>
                <linearGradient id="gradAbove" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#22c55e" stop-opacity="0.25"/>
                    <stop offset="100%" stop-color="#22c55e" stop-opacity="0.03"/>
                </linearGradient>
                <linearGradient id="gradBelow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#ef4444" stop-opacity="0.05"/>
                    <stop offset="100%" stop-color="#ef4444" stop-opacity="0.25"/>
                </linearGradient>
            </defs>
            <!-- zero line -->
            <line x1="${PAD.left}" y1="${zeroY}" x2="${W - PAD.right}" y2="${zeroY}"
                  stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 3" opacity="0.5"/>
            <!-- area above zero -->
            <path d="${areaAbovePath}" fill="url(#gradAbove)"/>
            <!-- area below zero -->
            ${areaBelowPath ? `<path d="${areaBelowPath}" fill="url(#gradBelow)"/>` : ''}
            <!-- line -->
            <polyline points="${pts}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round"/>
            <!-- today dot -->
            <circle cx="${scaleX(0)}" cy="${scaleY(currentBalance)}" r="4" fill="#3b82f6"/>
            ${xLabels}
            ${yLabels}
        </svg>`;
}

// ─── table row builder ───────────────────────────────────────────────────────

function buildDayRows(day) {
    const rowBg = day.isNegative ? 'background:rgba(239,68,68,0.04);' : '';
    const balanceColor = day.isNegative ? '#dc2626' : '#16a34a';
    const warningIcon = day.isNegative
        ? '<span class="material-icons-round" style="font-size:0.85rem;vertical-align:middle;color:#dc2626;">warning</span>'
        : '';
    const n = day.entries.length;

    return day.entries.map((e, i) => {
        const arrowIcon = e.isIn ? 'arrow_downward' : 'arrow_upward';
        const amtColor = e.isIn ? '#16a34a' : '#ef4444';
        const sign = e.isIn ? '+' : '−';

        const dateTd = i === 0
            ? '<td rowspan="' + n + '" style="vertical-align:top;white-space:nowrap;color:var(--text-secondary);font-size:0.8rem;padding:0.5rem 0.75rem;">' + formatDateIT(day.date) + '</td>'
            : '';

        const balanceTd = i === 0
            ? '<td rowspan="' + n + '" style="vertical-align:middle;text-align:right;padding:0.4rem 0.75rem;font-weight:600;font-size:0.9rem;color:' + balanceColor + ';white-space:nowrap;">' + formatAmount(day.balance) + ' € ' + warningIcon + '</td>'
            : '';

        return '<tr style="' + rowBg + '">'
            + dateTd
            + '<td style="padding:0.4rem 0.75rem;font-size:0.85rem;">'
            + '<span style="display:inline-flex;align-items:center;gap:4px;">'
            + '<span class="material-icons-round" style="font-size:0.85rem;color:' + amtColor + ';">' + arrowIcon + '</span>'
            + e.label
            + '</span></td>'
            + '<td style="padding:0.4rem 0.75rem;text-align:right;font-size:0.85rem;color:' + amtColor + ';font-weight:500;white-space:nowrap;">'
            + sign + ' ' + formatAmount(e.amount) + ' €'
            + '</td>'
            + balanceTd
            + '</tr>';
    }).join('');
}

// ─── render ──────────────────────────────────────────────────────────────────

export async function renderCFOCashflow(container) {
    const thisId = ++currentRenderId;
    const el = container || document.getElementById('content-area');
    if (!el) return;

    el.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;padding:1.5rem 1.5rem 1rem;">
            <span class="material-icons-round" style="color:var(--brand-blue);">waterfall_chart</span>
            <h2 style="margin:0;font-size:1.25rem;font-weight:600;">Cash Flow Forecast — 90 giorni</h2>
        </div>
        <div style="padding:0 1.5rem 2rem;" id="cfo-cf-body">
            <div style="display:flex;align-items:center;gap:8px;color:var(--text-secondary);font-size:0.9rem;">
                <span class="material-icons-round" style="font-size:1.1rem;animation:spin 1s linear infinite;">sync</span>
                Caricamento dati...
            </div>
        </div>`;

    // Load data in parallel
    const [, , , ] = await Promise.all([
        fetchBankTransactions(null, false),
        fetchInvoices(false),
        fetchPassiveInvoices(false),
        fetchPayments(false),
    ]);
    if (thisId !== currentRenderId) return;

    const s = window.state || state;
    const { currentBalance, timeline, totalFutureIn, totalFutureOut, negativeDays } =
        buildCashflowProjection({
            bankTxs: s.bankTransactions || [],
            payments: s.payments || [],
            invoices: s.invoices || [],
            passiveInvoices: s.passiveInvoices || [],
        });

    const balanceColor = currentBalance >= 0 ? '#16a34a' : '#dc2626';
    const alertBanner = negativeDays.length
        ? `<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:0.75rem 1rem;display:flex;align-items:center;gap:10px;margin-bottom:1rem;">
               <span class="material-icons-round" style="color:#ef4444;font-size:1.2rem;">warning</span>
               <span style="font-size:0.875rem;color:#ef4444;font-weight:500;">
                   Attenzione: saldo negativo previsto in <strong>${negativeDays.length}</strong> giorn${negativeDays.length === 1 ? 'o' : 'i'}
                   (primo: <strong>${formatDateIT(negativeDays[0].date)}</strong>)
               </span>
           </div>`
        : '';

    const chartHtml = buildSvgChart(timeline, currentBalance);

    const tableRows = timeline.length
        ? timeline.map(day => buildDayRows(day)).join('')
        : '<tr><td colspan="4" style="padding:2rem;text-align:center;color:var(--text-secondary);">Nessun movimento previsto con date di scadenza nei prossimi 90 giorni.</td></tr>';

    const body = document.getElementById('cfo-cf-body');
    if (!body || thisId !== currentRenderId) return;

    body.innerHTML = `
        ${alertBanner}

        <!-- KPI cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:1.5rem;">
            <div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;padding:1rem 1.25rem;">
                <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em;">Saldo attuale</div>
                <div style="font-size:1.4rem;font-weight:700;color:${balanceColor};">${formatAmount(currentBalance)} €</div>
                <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">Da movimenti confermati</div>
            </div>
            <div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;padding:1rem 1.25rem;">
                <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em;">Entrate previste</div>
                <div style="font-size:1.4rem;font-weight:700;color:#16a34a;">+${formatAmount(totalFutureIn)} €</div>
                <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">Prossimi 90 giorni</div>
            </div>
            <div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;padding:1rem 1.25rem;">
                <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em;">Uscite previste</div>
                <div style="font-size:1.4rem;font-weight:700;color:#dc2626;">−${formatAmount(totalFutureOut)} €</div>
                <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">Prossimi 90 giorni</div>
            </div>
            <div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;padding:1rem 1.25rem;">
                <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em;">Saldo a 90 giorni</div>
                <div style="font-size:1.4rem;font-weight:700;color:${currentBalance + totalFutureIn - totalFutureOut >= 0 ? '#16a34a' : '#dc2626'};">${formatAmount(currentBalance + totalFutureIn - totalFutureOut)} €</div>
                <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">Proiezione cumulativa</div>
            </div>
        </div>

        <!-- Chart -->
        <div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;padding:1.25rem;margin-bottom:1.5rem;">
            <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.75rem;font-weight:500;">Andamento saldo — prossimi 90 giorni</div>
            ${chartHtml}
        </div>

        <!-- Table -->
        <div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;overflow:hidden;">
            <div style="padding:0.875rem 1.25rem;border-bottom:1px solid var(--glass-border);font-size:0.85rem;font-weight:600;color:var(--text-primary);">
                Movimenti previsti con data di scadenza
            </div>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:0.875rem;">
                    <thead>
                        <tr style="background:var(--table-header-bg,rgba(0,0,0,0.03));">
                            <th style="padding:0.6rem 0.75rem;text-align:left;font-size:0.75rem;color:var(--text-secondary);font-weight:600;white-space:nowrap;">Data</th>
                            <th style="padding:0.6rem 0.75rem;text-align:left;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Descrizione</th>
                            <th style="padding:0.6rem 0.75rem;text-align:right;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Importo</th>
                            <th style="padding:0.6rem 0.75rem;text-align:right;font-size:0.75rem;color:var(--text-secondary);font-weight:600;white-space:nowrap;">Saldo cumulativo</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        </div>`;
}
