import { formatAmount } from '/js/modules/utils.js?v=8000';
import { supabase } from '/js/modules/config.js?v=8000';

let currentRenderId = 0;

// ─── helpers ─────────────────────────────────────────────────────────────────

function monthKey(dateStr) {
    return dateStr ? dateStr.slice(0, 7) : null;
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

function next6Months() {
    const result = [];
    const now = new Date();
    for (let i = 1; i <= 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        result.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    }
    return result;
}

function monthLabel(key) {
    const MONTHS = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
    const [y, m] = key.split('-');
    return MONTHS[parseInt(m) - 1] + ' ' + y;
}

// ─── data fetch ───────────────────────────────────────────────────────────────

async function fetchActualByMonth(months) {
    const from = months[0] + '-01';
    const to = months[months.length - 1] + '-31';
    const { data } = await supabase
        .from('invoices')
        .select('invoice_date, amount_tax_excluded')
        .gte('invoice_date', from)
        .lte('invoice_date', to);

    const map = {};
    (data || []).forEach(inv => {
        const m = monthKey(inv.invoice_date);
        if (!map[m]) map[m] = 0;
        map[m] += parseFloat(inv.amount_tax_excluded) || 0;
    });
    return map;
}

async function fetchPipelineByMonth(futureMonths) {
    // Orders in pipeline: status_sales not in final states
    const { data } = await supabase
        .from('orders')
        .select('price_planned, revenue_planned, order_date, status_sales, status_works')
        .not('status_works', 'eq', 'completato')
        .not('status_sales', 'eq', 'perso');

    // Distribute pipeline revenue across future months evenly
    const total = (data || []).reduce((s, o) => {
        const val = parseFloat(o.revenue_planned || o.price_planned) || 0;
        return s + val;
    }, 0);

    const perMonth = futureMonths.length > 0 ? total / futureMonths.length : 0;
    const map = {};
    futureMonths.forEach(m => { map[m] = perMonth; });
    return map;
}

async function fetchTargets(allMonths) {
    const years = [...new Set(allMonths.map(m => parseInt(m.split('-')[0])))];
    const { data } = await supabase
        .from('cfo_budget_targets')
        .select('*')
        .in('year', years);

    const map = {};
    (data || []).forEach(t => {
        const key = t.year + '-' + String(t.month).padStart(2, '0');
        map[key] = { id: t.id, value: parseFloat(t.target_revenue) || 0 };
    });
    return map;
}

async function upsertTarget(year, month, value) {
    await supabase.from('cfo_budget_targets').upsert(
        { year, month, target_revenue: parseFloat(value) || 0 },
        { onConflict: 'year,month' }
    );
}

// ─── forecast (moving avg) ────────────────────────────────────────────────────

function computeForecast(actualMap, months12, futureMonths) {
    // 3-month moving average of last 3 actual months as base
    const lastActuals = months12.slice(-3).map(m => actualMap[m] || 0);
    const avg = lastActuals.reduce((s, v) => s + v, 0) / 3;

    const forecastMap = {};
    futureMonths.forEach((m, i) => {
        // Slight growth: +2% per month
        forecastMap[m] = avg * Math.pow(1.02, i + 1);
    });
    return forecastMap;
}

// ─── SVG bar chart ────────────────────────────────────────────────────────────

function buildForecastChart(rows) {
    const allValues = rows.flatMap(r => [r.actual || 0, r.target || 0, r.forecast || 0]).filter(v => v > 0);
    if (!allValues.length) return '<p style="text-align:center;color:var(--text-secondary);padding:2rem;font-size:0.875rem;">Nessun dato disponibile per il grafico.</p>';

    const maxVal = Math.max(...allValues) * 1.15;
    const W = 700, H = 180;
    const PAD = { top: 16, right: 16, bottom: 40, left: 56 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const n = rows.length;
    const slotW = plotW / n;
    const barW = Math.max(6, slotW * 0.35);
    const scaleY = v => PAD.top + plotH - (v / maxVal) * plotH;
    const barH = v => (v / maxVal) * plotH;

    let bars = '';
    rows.forEach((r, i) => {
        const cx = PAD.left + slotW * i + slotW / 2;
        // Actual bar
        if (r.actual > 0) {
            bars += '<rect x="' + (cx - barW - 2) + '" y="' + scaleY(r.actual) + '" width="' + barW + '" height="' + barH(r.actual) + '" fill="#3b82f6" opacity="0.8" rx="2"/>';
        }
        // Target bar (outline)
        if (r.target > 0) {
            bars += '<rect x="' + (cx + 2) + '" y="' + scaleY(r.target) + '" width="' + barW + '" height="' + barH(r.target) + '" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3 2" rx="2"/>';
        }
        // Forecast dot/line
        if (r.forecast > 0) {
            bars += '<circle cx="' + cx + '" cy="' + scaleY(r.forecast) + '" r="3" fill="#f97316"/>';
        }
        // X label
        const lbl = r.label.replace(' ', '\n');
        bars += '<text x="' + cx + '" y="' + (H - 20) + '" text-anchor="middle" font-size="8" fill="var(--text-secondary)">' + r.label.split(' ')[0] + '</text>';
        bars += '<text x="' + cx + '" y="' + (H - 10) + '" text-anchor="middle" font-size="8" fill="var(--text-secondary)">' + r.label.split(' ')[1] + '</text>';
    });

    // Y labels
    const ySteps = [0, maxVal / 2, maxVal];
    const yLabels = ySteps.map(v =>
        '<text x="' + (PAD.left - 6) + '" y="' + (scaleY(v) + 3) + '" text-anchor="end" font-size="9" fill="var(--text-secondary)">' + Math.round(v / 1000) + 'k</text>'
    ).join('');
    const gridLines = ySteps.map(v =>
        '<line x1="' + PAD.left + '" y1="' + scaleY(v) + '" x2="' + (W - PAD.right) + '" y2="' + scaleY(v) + '" stroke="var(--glass-border)" stroke-width="1"/>'
    ).join('');

    // Forecast line connecting dots
    const forecastPts = rows.map((r, i) => {
        if (!r.forecast) return null;
        return (PAD.left + slotW * i + slotW / 2) + ',' + scaleY(r.forecast);
    }).filter(Boolean);
    const forecastLine = forecastPts.length > 1
        ? '<polyline points="' + forecastPts.join(' ') + '" fill="none" stroke="#f97316" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.8"/>'
        : '';

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:' + H + 'px;display:block;" preserveAspectRatio="none">' +
        gridLines + bars + forecastLine + yLabels + '</svg>';
}

// ─── main render ─────────────────────────────────────────────────────────────

export async function renderCFOForecast(container) {
    const thisId = ++currentRenderId;
    const el = container || document.getElementById('content-area');
    if (!el) return;

    el.innerHTML = '<div style="display:flex;align-items:center;gap:12px;padding:1.5rem 1.5rem 1rem;">' +
        '<span class="material-icons-round" style="color:var(--brand-blue);">trending_up</span>' +
        '<h2 style="margin:0;font-size:1.25rem;font-weight:600;">Piano Economico Annuale</h2>' +
        '</div>' +
        '<div id="fc-body" style="padding:0 1.5rem 2rem;">' +
        '<div style="display:flex;align-items:center;gap:8px;color:var(--text-secondary);font-size:0.9rem;">' +
        '<span class="material-icons-round" style="font-size:1.1rem;animation:spin 1s linear infinite;">sync</span>Caricamento...</div></div>';

    const months12 = last12Months();
    const future6 = next6Months();
    const allMonths = [...months12, ...future6];

    const [actualMap, pipelineMap, targetsMap] = await Promise.all([
        fetchActualByMonth(months12),
        fetchPipelineByMonth(future6),
        fetchTargets(allMonths),
    ]);

    if (thisId !== currentRenderId) return;
    const body = document.getElementById('fc-body');
    if (!body) return;

    const forecastMap = computeForecast(actualMap, months12, future6);

    // Combine pipeline into forecast
    future6.forEach(m => {
        forecastMap[m] = (forecastMap[m] || 0) * 0.6 + (pipelineMap[m] || 0) * 0.4;
    });

    // Build rows for table + chart
    const rows = allMonths.map(m => {
        const isFuture = future6.includes(m);
        const actual = isFuture ? null : (actualMap[m] || 0);
        const forecast = isFuture ? (forecastMap[m] || null) : null;
        const target = targetsMap[m] ? targetsMap[m].value : null;
        const delta = (actual !== null && target !== null && target > 0) ? ((actual - target) / target * 100) : null;
        return { month: m, label: monthLabel(m), actual, forecast, target, delta, isFuture };
    });

    // KPI
    const totalActual = months12.reduce((s, m) => s + (actualMap[m] || 0), 0);
    const totalTarget = months12.reduce((s, m) => s + (targetsMap[m] ? targetsMap[m].value : 0), 0);
    const totalForecast = future6.reduce((s, m) => s + (forecastMap[m] || 0), 0);
    const ytdDelta = totalTarget > 0 ? ((totalActual - totalTarget) / totalTarget * 100) : null;

    const kpiHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:1rem;margin-bottom:1.5rem;">' +
        '<div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;padding:1rem 1.25rem;">' +
        '<div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Fatturato 12 mesi</div>' +
        '<div style="font-size:1.3rem;font-weight:700;color:#3b82f6;">' + formatAmount(totalActual) + ' €</div></div>' +
        '<div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;padding:1rem 1.25rem;">' +
        '<div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Target 12 mesi</div>' +
        '<div style="font-size:1.3rem;font-weight:700;color:#94a3b8;">' + (totalTarget > 0 ? formatAmount(totalTarget) + ' €' : 'Non impostato') + '</div></div>' +
        '<div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;padding:1rem 1.25rem;">' +
        '<div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Delta vs Target</div>' +
        '<div style="font-size:1.3rem;font-weight:700;color:' + (ytdDelta === null ? 'var(--text-secondary)' : ytdDelta >= 0 ? '#16a34a' : '#dc2626') + ';">' +
        (ytdDelta !== null ? (ytdDelta >= 0 ? '+' : '') + ytdDelta.toFixed(1) + '%' : '—') + '</div></div>' +
        '<div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;padding:1rem 1.25rem;">' +
        '<div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Forecast 6 mesi</div>' +
        '<div style="font-size:1.3rem;font-weight:700;color:#f97316;">' + formatAmount(totalForecast) + ' €</div>' +
        '<div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">Trend + pipeline</div></div>' +
        '</div>';

    // Chart
    const chartHtml = '<div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;padding:1.25rem;margin-bottom:1.5rem;">' +
        '<div style="display:flex;align-items:center;gap:1.5rem;margin-bottom:0.75rem;">' +
        '<span style="font-size:0.8rem;color:var(--text-secondary);font-weight:500;">12 mesi actual + 6 forecast</span>' +
        '<span style="display:flex;align-items:center;gap:4px;font-size:0.78rem;"><span style="width:14px;height:10px;background:#3b82f6;display:inline-block;border-radius:2px;opacity:0.8;"></span>Actual</span>' +
        '<span style="display:flex;align-items:center;gap:4px;font-size:0.78rem;"><span style="width:14px;height:10px;border:1.5px dashed #94a3b8;display:inline-block;border-radius:2px;"></span>Target</span>' +
        '<span style="display:flex;align-items:center;gap:4px;font-size:0.78rem;"><span style="width:10px;height:10px;background:#f97316;display:inline-block;border-radius:50%;"></span>Forecast</span>' +
        '</div>' +
        buildForecastChart(rows) +
        '</div>';

    // Table
    const tableRows = rows.map(r => {
        const actualCell = r.actual !== null
            ? '<span style="font-weight:500;">' + formatAmount(r.actual) + ' €</span>'
            : '<span style="color:var(--text-secondary);">—</span>';

        const targetCell = '<input class="target-input" data-month="' + r.month + '" type="number" min="0" step="100" ' +
            'value="' + (r.target !== null ? r.target : '') + '" placeholder="—" ' +
            'style="width:90px;padding:0.3rem 0.5rem;border:1px solid var(--glass-border);border-radius:6px;background:var(--card-bg);color:var(--text-primary);font-size:0.85rem;text-align:right;">';

        const forecastCell = r.forecast !== null
            ? '<span style="color:#f97316;font-weight:500;">' + formatAmount(r.forecast) + ' €</span>'
            : '<span style="color:var(--text-secondary);">—</span>';

        const deltaCell = r.delta !== null
            ? '<span style="font-weight:600;color:' + (r.delta >= 0 ? '#16a34a' : '#dc2626') + ';">' + (r.delta >= 0 ? '+' : '') + r.delta.toFixed(1) + '%</span>'
            : '<span style="color:var(--text-secondary);">—</span>';

        const rowBg = r.isFuture ? 'background:rgba(249,115,22,0.03);' : '';

        return '<tr style="border-bottom:1px solid var(--glass-border);' + rowBg + '">' +
            '<td style="padding:0.5rem 0.75rem;font-size:0.875rem;font-weight:' + (r.isFuture ? '400' : '500') + ';color:' + (r.isFuture ? '#f97316' : 'var(--text-primary)') + ';">' +
            r.label + (r.isFuture ? ' <span style="font-size:0.7rem;color:#f97316;">(forecast)</span>' : '') + '</td>' +
            '<td style="padding:0.5rem 0.75rem;text-align:right;">' + actualCell + '</td>' +
            '<td style="padding:0.5rem 0.75rem;text-align:right;">' + targetCell + '</td>' +
            '<td style="padding:0.5rem 0.75rem;text-align:right;">' + forecastCell + '</td>' +
            '<td style="padding:0.5rem 0.75rem;text-align:right;">' + deltaCell + '</td>' +
            '</tr>';
    }).join('');

    const tableHtml = '<div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;overflow:hidden;">' +
        '<div style="padding:0.875rem 1.25rem;border-bottom:1px solid var(--glass-border);display:flex;align-items:center;justify-content:space-between;">' +
        '<span style="font-size:0.85rem;font-weight:600;">Dettaglio mensile</span>' +
        '<span style="font-size:0.78rem;color:var(--text-secondary);">Clicca fuori dal campo target per salvare</span>' +
        '</div>' +
        '<div style="overflow-x:auto;">' +
        '<table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="background:var(--table-header-bg,rgba(0,0,0,0.03));">' +
        '<th style="padding:0.6rem 0.75rem;text-align:left;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Mese</th>' +
        '<th style="padding:0.6rem 0.75rem;text-align:right;font-size:0.75rem;color:#3b82f6;font-weight:600;">Actual</th>' +
        '<th style="padding:0.6rem 0.75rem;text-align:right;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Target (editabile)</th>' +
        '<th style="padding:0.6rem 0.75rem;text-align:right;font-size:0.75rem;color:#f97316;font-weight:600;">Forecast</th>' +
        '<th style="padding:0.6rem 0.75rem;text-align:right;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Delta %</th>' +
        '</tr></thead>' +
        '<tbody>' + tableRows + '</tbody>' +
        '</table></div></div>';

    body.innerHTML = kpiHtml + chartHtml + tableHtml;

    // Save target on blur
    body.querySelectorAll('.target-input').forEach(input => {
        input.addEventListener('blur', async () => {
            const m = input.dataset.month;
            const [y, mo] = m.split('-').map(Number);
            await upsertTarget(y, mo, input.value);
        });
    });
}
