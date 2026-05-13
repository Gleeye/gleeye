import { state } from '/js/modules/state.js?v=8000';
import { formatAmount } from '/js/modules/utils.js?v=8000';
import {
    fetchOrders,
    fetchInvoices,
    fetchPayments,
} from '/js/modules/api.js?v=8000';
import { chat, extractText, AI_MODELS } from '/js/modules/ai_client.js?v=8000';

let currentRenderId = 0;
let currentSort = { key: 'margin_pct', dir: 'asc' };

// ─── P&L calculation ─────────────────────────────────────────────────────────

function computePnl(orders, invoices, payments) {
    // Group invoices by order_id
    const invoicesByOrder = {};
    (invoices || []).forEach(inv => {
        if (!inv.order_id) return;
        if (!invoicesByOrder[inv.order_id]) invoicesByOrder[inv.order_id] = [];
        invoicesByOrder[inv.order_id].push(inv);
    });

    // Group outgoing payments by order_id (collab + supplier costs)
    const costsByOrder = {};
    (payments || []).forEach(p => {
        if (!p.order_id) return;
        if (p.payment_type === 'Cliente') return; // incoming — not a cost
        if (!costsByOrder[p.order_id]) costsByOrder[p.order_id] = [];
        costsByOrder[p.order_id].push(p);
    });

    return orders.map(order => {
        const orderInvoices = invoicesByOrder[order.id] || [];
        const orderCosts = costsByOrder[order.id] || [];

        const ricavi = orderInvoices.reduce((s, inv) =>
            s + (parseFloat(inv.amount_tax_excluded) || 0), 0);
        const costi = orderCosts.reduce((s, p) =>
            s + (parseFloat(p.amount) || 0), 0);
        const margine = ricavi - costi;
        const margine_pct = ricavi > 0 ? (margine / ricavi) * 100 : null;

        return {
            id: order.id,
            order_number: order.order_number || '—',
            title: order.title || 'Senza titolo',
            client: order.clients?.business_name || '—',
            status: order.status_works || order.status_sales || '—',
            ricavi,
            costi,
            margine,
            margine_pct,
            invoice_count: orderInvoices.length,
            cost_count: orderCosts.length,
        };
    });
}

// ─── margin color ─────────────────────────────────────────────────────────────

function marginColor(pct) {
    if (pct === null) return 'var(--text-secondary)';
    if (pct < 0) return '#dc2626';
    if (pct < 10) return '#f97316';
    if (pct < 30) return '#ca8a04';
    return '#16a34a';
}

function marginBadge(pct) {
    if (pct === null) return '<span style="color:var(--text-secondary);font-size:0.8rem;">N/D</span>';
    const color = marginColor(pct);
    const bg = pct < 0 ? 'rgba(220,38,38,0.08)' : pct < 10 ? 'rgba(249,115,22,0.08)' : pct < 30 ? 'rgba(202,138,4,0.08)' : 'rgba(22,163,74,0.08)';
    return `<span style="display:inline-block;padding:2px 8px;border-radius:20px;background:${bg};color:${color};font-size:0.8rem;font-weight:600;">${pct.toFixed(1)}%</span>`;
}

// ─── distribution chart ───────────────────────────────────────────────────────

function buildDistributionChart(rows) {
    const buckets = [
        { label: '< 0%', color: '#dc2626', count: 0, key: 'loss' },
        { label: '0–15%', color: '#f97316', count: 0, key: 'low' },
        { label: '15–30%', color: '#ca8a04', count: 0, key: 'mid' },
        { label: '> 30%', color: '#16a34a', count: 0, key: 'good' },
    ];

    rows.forEach(r => {
        if (r.margine_pct === null) return;
        if (r.margine_pct < 0) buckets[0].count++;
        else if (r.margine_pct < 15) buckets[1].count++;
        else if (r.margine_pct < 30) buckets[2].count++;
        else buckets[3].count++;
    });

    const total = buckets.reduce((s, b) => s + b.count, 0) || 1;

    const bars = buckets.map(b => {
        const pct = (b.count / total) * 100;
        return `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:0.6rem;">
                <div style="width:64px;text-align:right;font-size:0.78rem;color:var(--text-secondary);flex-shrink:0;">${b.label}</div>
                <div style="flex:1;background:var(--glass-border);border-radius:4px;height:18px;overflow:hidden;">
                    <div style="width:${pct.toFixed(1)}%;height:100%;background:${b.color};border-radius:4px;transition:width .4s ease;"></div>
                </div>
                <div style="width:32px;font-size:0.8rem;font-weight:600;color:${b.color};">${b.count}</div>
            </div>`;
    }).join('');

    return `
        <div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;padding:1.25rem;margin-bottom:1.5rem;">
            <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:1rem;font-weight:500;">Distribuzione margini (${total} commesse con dati)</div>
            ${bars}
        </div>`;
}

// ─── AI recommendations ───────────────────────────────────────────────────────

async function loadAiRecommendations(rows, container) {
    container.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;color:var(--text-secondary);font-size:0.875rem;">
            <span class="material-icons-round" style="font-size:1rem;animation:spin 1s linear infinite;">sync</span>
            Analisi AI in corso...
        </div>`;

    const losers = rows
        .filter(r => r.margine_pct !== null && r.margine_pct < 15 && r.ricavi > 0)
        .sort((a, b) => a.margine_pct - b.margine_pct)
        .slice(0, 5);

    const summary = rows.map(r =>
        `- ${r.order_number} "${r.title}" (${r.client}): Ricavi ${r.ricavi.toFixed(0)}€, Costi ${r.costi.toFixed(0)}€, Margine ${r.margine.toFixed(0)}€ (${r.margine_pct !== null ? r.margine_pct.toFixed(1) + '%' : 'N/D'})`
    ).join('\n');

    const prompt = `Sei il CFO virtuale di Gleeye, un'agenzia di comunicazione italiana.

Ecco il P&L delle commesse attive:
${summary}

Le commesse a maggior rischio (margine < 15%):
${losers.map(r => `- "${r.title}" (${r.client}): margine ${r.margine_pct?.toFixed(1)}%`).join('\n') || 'Nessuna'}

Fornisci:
1. Le top 3 commesse in perdita o a rischio con motivazione concisa (1 riga per commessa)
2. Esattamente 3 azioni concrete e specifiche per migliorare la redditività complessiva

Formato risposta (JSON):
{
  "losers": [
    {"order": "nome", "issue": "motivazione breve"},
    ...
  ],
  "actions": [
    "azione 1 concreta",
    "azione 2 concreta",
    "azione 3 concreta"
  ]
}`;

    try {
        const resp = await chat({
            feature: 'cfo_insights',
            model: 'anthropic/claude-sonnet-4-6',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            max_tokens: 512,
            temperature: 0.3,
            feature_context: { entity_type: 'cfo_pnl', entity_id: null },
        });

        const text = extractText(resp);
        let parsed;
        try { parsed = JSON.parse(text); } catch { parsed = null; }

        if (!parsed) {
            container.innerHTML = `<p style="color:var(--text-secondary);font-size:0.875rem;">${text}</p>`;
            return;
        }

        const losersHtml = (parsed.losers || []).map(l => `
            <div style="display:flex;align-items:flex-start;gap:8px;padding:0.5rem 0;border-bottom:1px solid var(--glass-border);">
                <span class="material-icons-round" style="font-size:1rem;color:#ef4444;flex-shrink:0;margin-top:2px;">trending_down</span>
                <span style="font-size:0.875rem;"><strong>${l.order}</strong> — ${l.issue}</span>
            </div>`).join('');

        const actionsHtml = (parsed.actions || []).map((a, i) => `
            <div style="display:flex;align-items:flex-start;gap:8px;padding:0.5rem 0;${i > 0 ? 'border-top:1px solid var(--glass-border);' : ''}">
                <span style="background:var(--brand-blue);color:#fff;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;flex-shrink:0;margin-top:2px;">${i + 1}</span>
                <span style="font-size:0.875rem;">${a}</span>
            </div>`).join('');

        container.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                <div>
                    <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:.04em;color:var(--text-secondary);font-weight:600;margin-bottom:0.5rem;">Commesse a rischio</div>
                    ${losersHtml || '<p style="font-size:0.875rem;color:var(--text-secondary);">Nessuna commessa critica rilevata.</p>'}
                </div>
                <div>
                    <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:.04em;color:var(--text-secondary);font-weight:600;margin-bottom:0.5rem;">3 azioni suggerite</div>
                    ${actionsHtml}
                </div>
            </div>`;
    } catch (err) {
        console.error('[CFO P&L] AI error', err);
        container.innerHTML = `<p style="color:var(--text-secondary);font-size:0.875rem;">Errore analisi AI: ${err.message}</p>`;
    }
}

// ─── table render ─────────────────────────────────────────────────────────────

function sortRows(rows) {
    const { key, dir } = currentSort;
    return [...rows].sort((a, b) => {
        const va = a[key] ?? -Infinity;
        const vb = b[key] ?? -Infinity;
        return dir === 'asc' ? va - vb : vb - va;
    });
}

function renderTable(rows, tableEl) {
    const sorted = sortRows(rows);
    const tbody = tableEl.querySelector('tbody');
    tbody.innerHTML = sorted.map(r => `
        <tr class="cfo-pnl-row" style="border-bottom:1px solid var(--glass-border);cursor:default;transition:background .15s;"
            onmouseover="this.style.background='var(--row-hover,rgba(0,0,0,0.03))'"
            onmouseout="this.style.background=''">
            <td style="padding:0.6rem 0.75rem;font-size:0.8rem;color:var(--text-secondary);">${r.order_number}</td>
            <td style="padding:0.6rem 0.75rem;font-size:0.875rem;font-weight:500;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.title}">${r.title}</td>
            <td style="padding:0.6rem 0.75rem;font-size:0.875rem;color:var(--text-secondary);white-space:nowrap;">${r.client}</td>
            <td style="padding:0.6rem 0.75rem;text-align:right;font-size:0.875rem;color:#16a34a;font-weight:500;white-space:nowrap;">${r.ricavi > 0 ? formatAmount(r.ricavi) + ' €' : '—'}</td>
            <td style="padding:0.6rem 0.75rem;text-align:right;font-size:0.875rem;color:${r.costi > 0 ? '#ef4444' : 'var(--text-secondary)'};font-weight:500;white-space:nowrap;">${r.costi > 0 ? formatAmount(r.costi) + ' €' : '—'}</td>
            <td style="padding:0.6rem 0.75rem;text-align:right;font-size:0.875rem;font-weight:600;color:${marginColor(r.margine_pct)};white-space:nowrap;">${r.ricavi > 0 || r.costi > 0 ? formatAmount(r.margine) + ' €' : '—'}</td>
            <td style="padding:0.6rem 0.75rem;text-align:right;">${marginBadge(r.margine_pct)}</td>
        </tr>`).join('');
}

function attachSortHandlers(tableEl, rows) {
    tableEl.querySelectorAll('th[data-sort]').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            if (currentSort.key === key) {
                currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort = { key, dir: 'desc' };
            }
            tableEl.querySelectorAll('th[data-sort]').forEach(t => {
                const arrow = t.querySelector('.sort-arrow');
                if (arrow) arrow.textContent = '';
            });
            const arrow = th.querySelector('.sort-arrow');
            if (arrow) arrow.textContent = currentSort.dir === 'asc' ? ' ↑' : ' ↓';
            renderTable(rows, tableEl);
        });
    });
}

// ─── main render ──────────────────────────────────────────────────────────────

export async function renderCFOPnlOrders(container) {
    const thisId = ++currentRenderId;
    const el = container || document.getElementById('content-area');
    if (!el) return;

    el.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;padding:1.5rem 1.5rem 1rem;">
            <span class="material-icons-round" style="color:var(--brand-blue);">stacked_bar_chart</span>
            <h2 style="margin:0;font-size:1.25rem;font-weight:600;">P&amp;L per Commessa</h2>
        </div>
        <div style="padding:0 1.5rem 2rem;" id="cfo-pnl-body">
            <div style="display:flex;align-items:center;gap:8px;color:var(--text-secondary);font-size:0.9rem;">
                <span class="material-icons-round" style="font-size:1.1rem;animation:spin 1s linear infinite;">sync</span>
                Caricamento dati...
            </div>
        </div>`;

    await Promise.all([fetchOrders(false), fetchInvoices(false), fetchPayments(false)]);
    if (thisId !== currentRenderId) return;

    const s = window.state || state;
    const rows = computePnl(s.orders || [], s.invoices || [], s.payments || []);
    const rowsWithData = rows.filter(r => r.ricavi > 0 || r.costi > 0);

    // KPI aggregates
    const totalRicavi = rowsWithData.reduce((s, r) => s + r.ricavi, 0);
    const totalCosti = rowsWithData.reduce((s, r) => s + r.costi, 0);
    const totalMargine = totalRicavi - totalCosti;
    const avgMargine = totalRicavi > 0 ? (totalMargine / totalRicavi) * 100 : null;

    const body = document.getElementById('cfo-pnl-body');
    if (!body || thisId !== currentRenderId) return;

    body.innerHTML = `
        <!-- KPI cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:1.5rem;">
            <div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;padding:1rem 1.25rem;">
                <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em;">Ricavi totali</div>
                <div style="font-size:1.3rem;font-weight:700;color:#16a34a;">${formatAmount(totalRicavi)} €</div>
                <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">${rowsWithData.length} commesse fatturate</div>
            </div>
            <div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;padding:1rem 1.25rem;">
                <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em;">Costi diretti</div>
                <div style="font-size:1.3rem;font-weight:700;color:#ef4444;">${formatAmount(totalCosti)} €</div>
                <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">Collab + fornitori</div>
            </div>
            <div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;padding:1rem 1.25rem;">
                <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em;">Margine totale</div>
                <div style="font-size:1.3rem;font-weight:700;color:${totalMargine >= 0 ? '#16a34a' : '#dc2626'};">${formatAmount(totalMargine)} €</div>
            </div>
            <div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;padding:1rem 1.25rem;">
                <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em;">Margine medio</div>
                <div style="font-size:1.3rem;font-weight:700;color:${marginColor(avgMargine)}">${avgMargine !== null ? avgMargine.toFixed(1) + '%' : '—'}</div>
            </div>
        </div>

        <!-- Distribution chart -->
        ${buildDistributionChart(rowsWithData)}

        <!-- AI recommendations -->
        <div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;padding:1.25rem;margin-bottom:1.5rem;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="material-icons-round" style="color:var(--brand-blue);font-size:1.1rem;">auto_awesome</span>
                    <span style="font-size:0.875rem;font-weight:600;">Raccomandazioni CFO</span>
                </div>
                <button id="cfo-ai-btn" style="background:var(--brand-blue);color:#fff;border:none;border-radius:8px;padding:0.35rem 0.9rem;font-size:0.8rem;cursor:pointer;display:flex;align-items:center;gap:4px;">
                    <span class="material-icons-round" style="font-size:0.9rem;">play_arrow</span> Analizza
                </button>
            </div>
            <div id="cfo-ai-output" style="color:var(--text-secondary);font-size:0.875rem;">
                Clicca "Analizza" per generare le raccomandazioni AI sui margini delle commesse.
            </div>
        </div>

        <!-- Table -->
        <div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;overflow:hidden;">
            <div style="padding:0.875rem 1.25rem;border-bottom:1px solid var(--glass-border);font-size:0.85rem;font-weight:600;color:var(--text-primary);">
                Tutte le commesse (${rows.length})
            </div>
            <div style="overflow-x:auto;">
                <table id="cfo-pnl-table" style="width:100%;border-collapse:collapse;font-size:0.875rem;">
                    <thead>
                        <tr style="background:var(--table-header-bg,rgba(0,0,0,0.03));">
                            <th style="padding:0.6rem 0.75rem;text-align:left;font-size:0.75rem;color:var(--text-secondary);font-weight:600;" data-sort="order_number">N° <span class="sort-arrow"></span></th>
                            <th style="padding:0.6rem 0.75rem;text-align:left;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Titolo</th>
                            <th style="padding:0.6rem 0.75rem;text-align:left;font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Cliente</th>
                            <th style="padding:0.6rem 0.75rem;text-align:right;font-size:0.75rem;color:var(--text-secondary);font-weight:600;" data-sort="ricavi">Ricavi <span class="sort-arrow"></span></th>
                            <th style="padding:0.6rem 0.75rem;text-align:right;font-size:0.75rem;color:var(--text-secondary);font-weight:600;" data-sort="costi">Costi <span class="sort-arrow"></span></th>
                            <th style="padding:0.6rem 0.75rem;text-align:right;font-size:0.75rem;color:var(--text-secondary);font-weight:600;" data-sort="margine">Margine € <span class="sort-arrow"></span></th>
                            <th style="padding:0.6rem 0.75rem;text-align:right;font-size:0.75rem;color:var(--text-secondary);font-weight:600;" data-sort="margine_pct">Margine % ↑ <span class="sort-arrow">↑</span></th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>`;

    const tableEl = body.querySelector('#cfo-pnl-table');
    renderTable(rows, tableEl);
    attachSortHandlers(tableEl, rows);

    document.getElementById('cfo-ai-btn')?.addEventListener('click', () => {
        const output = document.getElementById('cfo-ai-output');
        if (output) loadAiRecommendations(rows, output);
    });
}
