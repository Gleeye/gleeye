import { formatAmount } from '/js/modules/utils.js?v=8000';
import { supabase } from '/js/modules/config.js?v=8000';

let currentRenderId = 0;

// ─── helpers ─────────────────────────────────────────────────────────────────

function monthKey(dateStr) {
    // Returns 'YYYY-MM'
    return dateStr ? dateStr.slice(0, 7) : null;
}

function monthLabel(key) {
    // 'YYYY-MM' → 'Gen 2026'
    const MONTHS = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
    const [y, m] = key.split('-');
    return MONTHS[parseInt(m) - 1] + ' ' + y;
}

function last12Months() {
    const result = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        result.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    }
    return result;
}

function daysBetween(dateA, dateB) {
    if (!dateA || !dateB) return null;
    const diff = new Date(dateB) - new Date(dateA);
    return Math.round(diff / 86400000);
}

// ─── compute DSO / DPO ───────────────────────────────────────────────────────

function computeMonthlyMetrics(invoices, passiveInvoices) {
    const months = last12Months();

    // DSO: avg(payment_date - invoice_date) for invoices paid in that month
    const dsoBuckets = {};
    months.forEach(m => { dsoBuckets[m] = []; });

    (invoices || []).forEach(inv => {
        if (!inv.payment_date || !inv.invoice_date) return;
        const m = monthKey(inv.payment_date);
        if (!dsoBuckets[m]) return;
        const days = daysBetween(inv.invoice_date, inv.payment_date);
        if (days !== null && days >= 0) dsoBuckets[m].push(days);
    });

    // DPO: avg(payment_date - issue_date) for passive invoices paid in that month
    const dpoBuckets = {};
    months.forEach(m => { dpoBuckets[m] = []; });

    (passiveInvoices || []).forEach(pi => {
        if (!pi.payment_date || !pi.issue_date) return;
        const m = monthKey(pi.payment_date);
        if (!dpoBuckets[m]) return;
        const days = daysBetween(pi.issue_date, pi.payment_date);
        if (days !== null && days >= 0) dpoBuckets[m].push(days);
    });

    return months.map(m => {
        const dsoArr = dsoBuckets[m];
        const dpoArr = dpoBuckets[m];
        const dso = dsoArr.length ? Math.round(dsoArr.reduce((s, v) => s + v, 0) / dsoArr.length) : null;
        const dpo = dpoArr.length ? Math.round(dpoArr.reduce((s, v) => s + v, 0) / dpoArr.length) : null;
        return { month: m, label: monthLabel(m), dso, dpo, dsoN: dsoArr.length, dpoN: dpoArr.length };
    });
}

function currentAvg(metrics, key) {
    const recent = metrics.slice(-3).map(m => m[key]).filter(v => v !== null);
    if (!recent.length) return null;
    return Math.round(recent.reduce((s, v) => s + v, 0) / recent.length);
}

// ─── SVG chart ───────────────────────────────────────────────────────────────

function buildDsoDpoChart(metrics) {
    const W = 700, H = 200;
    const PAD = { top: 16, right: 24, bottom: 40, left: 48 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const n = metrics.length;

    const dsoVals = metrics.map(m => m.dso);
    const dpoVals = metrics.map(m => m.dpo);
    const allVals = [...dsoVals, ...dpoVals].filter(v => v !== null);
    if (!allVals.length) {
        return '<p style="text-align:center;color:var(--text-secondary);padding:2rem;font-size:0.875rem;">Dati insufficienti per il grafico (nessuna fattura con data pagamento).</p>';
    }

    const maxVal = Math.max(...allVals, 1);
    const scaleX = i => PAD.left + (i / (n - 1)) * plotW;
    const scaleY = v => PAD.top + plotH - (v / maxVal) * plotH;

    function polyline(vals, color) {
        const pts = vals.map((v, i) => v !== null ? scaleX(i) + ',' + scaleY(v) : null).filter(Boolean);
        if (pts.length < 2) return '';
        // Build path with gaps for null values
        let path = '';
        let inLine = false;
        vals.forEach((v, i) => {
            if (v === null) { inLine = false; return; }
            if (!inLine) { path += 'M ' + scaleX(i) + ' ' + scaleY(v) + ' '; inLine = true; }
            else { path += 'L ' + scaleX(i) + ' ' + scaleY(v) + ' '; }
        });
        return '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round"/>';
    }

    function dots(vals, color) {
        return vals.map((v, i) => v !== null
            ? '<circle cx="' + scaleX(i) + '" cy="' + scaleY(v) + '" r="3" fill="' + color + '"/>'
            : ''
        ).join('');
    }

    // X labels every 3 months
    const xLabels = metrics.map((m, i) => {
        if (i % 3 !== 0 && i !== n - 1) return '';
        return '<text x="' + scaleX(i) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="9" fill="var(--text-secondary)">' + m.label + '</text>';
    }).join('');

    // Y labels
    const ySteps = [0, Math.round(maxVal / 2), maxVal];
    const yLabels = ySteps.map(v =>
        '<text x="' + (PAD.left - 6) + '" y="' + (scaleY(v) + 3) + '" text-anchor="end" font-size="9" fill="var(--text-secondary)">' + v + '</text>'
    ).join('');

    // Grid lines
    const gridLines = ySteps.map(v =>
        '<line x1="' + PAD.left + '" y1="' + scaleY(v) + '" x2="' + (W - PAD.right) + '" y2="' + scaleY(v) + '" stroke="var(--glass-border)" stroke-width="1"/>'
    ).join('');

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:' + H + 'px;display:block;" preserveAspectRatio="none">' +
        gridLines +
        polyline(dsoVals, '#3b82f6') +
        polyline(dpoVals, '#8b5cf6') +
        dots(dsoVals, '#3b82f6') +
        dots(dpoVals, '#8b5cf6') +
        xLabels + yLabels +
        '</svg>';
}

// ─── main render ─────────────────────────────────────────────────────────────

export async function renderCFODsoDpo(container) {
    const thisId = ++currentRenderId;
    const el = container || document.getElementById('content-area');
    if (!el) return;

    el.innerHTML = '<div style="display:flex;align-items:center;gap:12px;padding:1.5rem 1.5rem 1rem;">' +
        '<span class="material-icons-round" style="color:var(--brand-blue);">speed</span>' +
        '<h2 style="margin:0;font-size:1.25rem;font-weight:600;">DSO / DPO — Velocità incassi e pagamenti</h2>' +
        '</div>' +
        '<div id="dso-body" style="padding:0 1.5rem 2rem;">' +
        '<div style="display:flex;align-items:center;gap:8px;color:var(--text-secondary);font-size:0.9rem;">' +
        '<span class="material-icons-round" style="font-size:1.1rem;animation:spin 1s linear infinite;">sync</span>Caricamento...</div></div>';

    const [invResult, piResult] = await Promise.all([
        supabase.from('invoices').select('invoice_date, payment_date').eq('status', 'Saldata').not('payment_date', 'is', null),
        supabase.from('passive_invoices').select('issue_date, payment_date').eq('status', 'Pagato').not('payment_date', 'is', null),
    ]);

    if (thisId !== currentRenderId) return;
    const body = document.getElementById('dso-body');
    if (!body) return;

    const invoices = invResult.data || [];
    const passiveInvoices = piResult.data || [];
    const metrics = computeMonthlyMetrics(invoices, passiveInvoices);

    const avgDso = currentAvg(metrics, 'dso');
    const avgDpo = currentAvg(metrics, 'dpo');

    const dsoColor = avgDso === null ? 'var(--text-secondary)' : avgDso <= 30 ? '#16a34a' : avgDso <= 60 ? '#ca8a04' : '#dc2626';
    const dpoColor = avgDpo === null ? 'var(--text-secondary)' : avgDpo >= 45 ? '#16a34a' : '#ca8a04';

    // Table rows
    const tableRows = metrics.map(m => {
        const dsoCell = m.dso !== null
            ? '<span style="font-weight:600;color:' + (m.dso <= 30 ? '#16a34a' : m.dso <= 60 ? '#ca8a04' : '#dc2626') + ';">' + m.dso + ' gg</span> <span style="font-size:0.75rem;color:var(--text-secondary);">(' + m.dsoN + ')</span>'
            : '<span style="color:var(--text-secondary);">—</span>';
        const dpoCell = m.dpo !== null
            ? '<span style="font-weight:600;color:#8b5cf6;">' + m.dpo + ' gg</span> <span style="font-size:0.75rem;color:var(--text-secondary);">(' + m.dpoN + ')</span>'
            : '<span style="color:var(--text-secondary);">—</span>';
        return '<tr style="border-bottom:1px solid var(--glass-border);">' +
            '<td style="padding:0.5rem 0.75rem;font-size:0.875rem;font-weight:500;">' + m.label + '</td>' +
            '<td style="padding:0.5rem 0.75rem;text-align:center;">' + dsoCell + '</td>' +
            '<td style="padding:0.5rem 0.75rem;text-align:center;">' + dpoCell + '</td>' +
            '</tr>';
    }).join('');

    body.innerHTML =
        // KPI
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:1.5rem;">' +
        '<div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);border-radius:12px;padding:1.25rem;">' +
        '<div style="font-size:0.75rem;color:#3b82f6;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">DSO — Days Sales Outstanding</div>' +
        '<div style="font-size:1.6rem;font-weight:700;color:' + dsoColor + ';">' + (avgDso !== null ? avgDso + ' giorni' : 'N/D') + '</div>' +
        '<div style="font-size:0.78rem;color:var(--text-secondary);margin-top:4px;">Media ultimi 3 mesi · Clienti impiegano in media X gg a pagare</div>' +
        '<div style="font-size:0.75rem;margin-top:6px;color:var(--text-secondary);">✓ &lt;30gg ottimo · 30-60gg normale · &gt;60gg critico</div>' +
        '</div>' +
        '<div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.25);border-radius:12px;padding:1.25rem;">' +
        '<div style="font-size:0.75rem;color:#8b5cf6;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">DPO — Days Payable Outstanding</div>' +
        '<div style="font-size:1.6rem;font-weight:700;color:' + dpoColor + ';">' + (avgDpo !== null ? avgDpo + ' giorni' : 'N/D') + '</div>' +
        '<div style="font-size:0.78rem;color:var(--text-secondary);margin-top:4px;">Media ultimi 3 mesi · Gleeye impiega in media X gg a pagare fornitori</div>' +
        '<div style="font-size:0.75rem;margin-top:6px;color:var(--text-secondary);">✓ &gt;45gg buon cashflow · &lt;30gg paghi troppo veloce</div>' +
        '</div>' +
        '</div>' +

        // Chart
        '<div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;padding:1.25rem;margin-bottom:1.5rem;">' +
        '<div style="display:flex;align-items:center;gap:1.5rem;margin-bottom:0.75rem;">' +
        '<span style="font-size:0.8rem;color:var(--text-secondary);font-weight:500;">Trend 12 mesi</span>' +
        '<span style="display:flex;align-items:center;gap:4px;font-size:0.78rem;"><span style="width:16px;height:3px;background:#3b82f6;display:inline-block;border-radius:2px;"></span>DSO</span>' +
        '<span style="display:flex;align-items:center;gap:4px;font-size:0.78rem;"><span style="width:16px;height:3px;background:#8b5cf6;display:inline-block;border-radius:2px;"></span>DPO</span>' +
        '</div>' +
        buildDsoDpoChart(metrics) +
        '</div>' +

        // Table
        '<div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;overflow:hidden;">' +
        '<div style="padding:0.875rem 1.25rem;border-bottom:1px solid var(--glass-border);font-size:0.85rem;font-weight:600;">Dettaglio mensile</div>' +
        '<table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="background:var(--table-header-bg,rgba(0,0,0,0.03));">' +
        '<th style="padding:0.6rem 0.75rem;text-align:left;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Mese</th>' +
        '<th style="padding:0.6rem 0.75rem;text-align:center;font-size:0.75rem;color:#3b82f6;font-weight:600;">DSO (fatture pagate)</th>' +
        '<th style="padding:0.6rem 0.75rem;text-align:center;font-size:0.75rem;color:#8b5cf6;font-weight:600;">DPO (passive pagate)</th>' +
        '</tr></thead>' +
        '<tbody>' + tableRows + '</tbody>' +
        '</table></div>';
}
