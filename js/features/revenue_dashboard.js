import { state } from '../modules/state.js?v=151';
import { formatAmount, showGlobalAlert } from '../modules/utils.js?v=151';
import { supabase } from '../modules/config.js?v=151';

// State local to this dashboard
let dashboardState = {
    period: '12M', // MTD, QTD, YTD, 12M, CUSTOM
    year: new Date().getFullYear(),
    customStart: null,
    customEnd: null,
    clientId: null,
    isGross: true, // Default to Gross (Totale) as per feedback
    vatFilter: 'all', // all, vat_only, no_vat
    groupBy: 'month', // month, quarter
    isLoading: false,
    data: {
        kpis: { issued: 0, collected: 0, outstanding: 0, avg_days: 0 },
        prevKpis: { issued: 0, collected: 0, outstanding: 0 },
        chartData: [],
        topClients: [],
        outstandingList: []
    }
};

// Access Supabase client
const sb = supabase;

export async function renderRevenueDashboard(container) {
    // Basic Layout Structure
    container.innerHTML = `
        <div class="revenue-dashboard animate-fade-in" style="padding-bottom: 4rem;">
            <!-- Header & Filters -->
            <div class="dashboard-header glass-card" style="margin-bottom: 2rem; position: sticky; top: 0; z-index: 10;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h2 style="font-family: var(--font-titles); font-size: 1.5rem; margin: 0;">Dashboard Fatturato</h2>
                    <div class="actions" style="display: flex; gap: 0.5rem; align-items: center;">
                         <div class="toggle-container" title="Mostra importi lordi (IVA inclusa)">
                            <label class="switch-label" style="font-size: 0.85rem; font-weight: 500; margin-right: 0.5rem;">Lordo</label>
                            <label class="switch">
                                <input type="checkbox" id="gross-toggle" checked>
                                <span class="slider round"></span>
                            </label>
                         </div>
                         <button id="refresh-btn" class="icon-btn" title="Aggiorna"><span class="material-icons-round">refresh</span></button>
                    </div>
                </div>

                <div class="filters-row" style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;">
                    <!-- Period Presets -->
                    <div class="segmented-control">
                        <button class="segment" data-period="MTD">Mese</button>
                        <button class="segment" data-period="QTD">Trimestre</button>
                        <button class="segment" data-period="YTD">Anno</button>
                        <button class="segment active" data-period="12M">12 Mesi</button>
                        <!-- <button class="segment" data-period="CUSTOM">Custom</button> -->
                    </div>

                    <!-- Year Selector (visible if needed) -->
                    <select id="year-select" class="glass-input" style="width: auto; padding: 0.5rem 1rem;">
                        ${generateYearOptions()}
                    </select>
                    
                    <!-- Client Selector -->
                    <select id="client-select" class="glass-input" style="width: 200px;">
                        <option value="">Tutti i Clienti</option>
                        <!-- Populated dynamically -->
                    </select>

                    <div style="flex: 1;"></div>

                    <!-- VAT Toggle -->
                    <!-- <div class="toggle-group">...</div> (Saving for V1.1) -->
                </div>
            </div>

            <!-- Loading State -->
            <div id="dashboard-loader" class="loader-overlay hidden">
                <span class="loader"></span>
            </div>

            <!-- KPI Cards -->
            <div class="kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                ${renderKPICard('Emesso', 'issued', 'account_balance_wallet', 'var(--brand-viola)')}
                ${renderKPICard('Incassato', 'collected', 'savings', '#4caf50')}
                ${renderKPICard('Da Incassare', 'outstanding', 'pending', '#ff9800')}
                ${renderKPICard('Tempo Incasso', 'avg_days', 'timer', '#2196f3', false)}
            </div>

            <!-- Main Chart -->
            <div class="glass-card" style="margin-bottom: 2rem; min-height: 400px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="margin: 0;">Andamento Temporale</h3>
                    <div class="segmented-control small">
                        <button class="segment active" data-group="month">Mensile</button>
                        <button class="segment" data-group="quarter">Trimestrale</button>
                    </div>
                </div>
                <div style="height: 350px;">
                    <canvas id="revenue-chart"></canvas>
                </div>
            </div>

            <!-- Bottom Section: Top Clients & Outstanding List -->
            <div class="bottom-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <!-- Top Clients -->
                <div class="glass-card">
                    <h3 style="margin-bottom: 1rem;">Top Clienti</h3>
                    <div style="overflow-x: auto;">
                        <table class="data-table" id="top-clients-table">
                            <thead>
                                <tr>
                                    <th>Cliente</th>
                                    <th style="text-align: right;">Emesso</th>
                                    <th style="text-align: right;">Incassato</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>

                <!-- Outstanding List -->
                <div class="glass-card">
                    <h3 style="margin-bottom: 1rem;">Da Incassare (Top 50)</h3>
                    <div style="overflow-x: auto;">
                        <table class="data-table" id="outstanding-table">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Cliente</th>
                                    <th>Importo</th>
                                    <th>Giorni</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <style>
            .segmented-control {
                background: var(--bg-secondary);
                padding: 4px;
                border-radius: 12px;
                display: inline-flex;
                gap: 4px;
            }
            .segment {
                background: none;
                border: none;
                padding: 6px 16px;
                border-radius: 8px;
                font-size: 0.85rem;
                font-weight: 500;
                color: var(--text-secondary);
                cursor: pointer;
                transition: all 0.2s;
            }
            .segment:hover { color: var(--text-primary); }
            .segment.active {
                background: white;
                color: var(--brand-viola);
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                font-weight: 600;
            }
            .kpi-card {
                padding: 1.5rem;
                position: relative;
                overflow: hidden;
            }
            .kpi-value {
                font-size: 2rem;
                font-weight: 700;
                font-family: var(--font-titles);
                margin: 0.5rem 0;
            }
            .kpi-label {
                font-size: 0.85rem;
                color: var(--text-secondary);
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            .data-table { width: 100%; border-collapse: collapse; }
            .data-table th { 
                text-align: left; padding: 0.75rem 1rem; 
                font-size: 0.75rem; color: var(--text-tertiary); 
                text-transform: uppercase; letter-spacing: 0.05em;
            }
            .data-table td { 
                padding: 0.75rem 1rem; font-size: 0.9rem; 
                border-bottom: 1px solid var(--glass-border); 
            }
            .loader-overlay {
                position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(255,255,255,0.7);
                backdrop-filter: blur(2px);
                z-index: 50;
                display: flex; align-items: center; justify-content: center;
                border-radius: 1rem;
            }
            .hidden { display: none !important; }
            /* Switch Toggle */
            .switch { position: relative; display: inline-block; width: 40px; height: 22px; }
            .switch input { opacity: 0; width: 0; height: 0; }
            .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px; }
            .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
            input:checked + .slider { background-color: var(--brand-viola); }
            input:checked + .slider:before { transform: translateX(18px); }
        </style>
    `;

    // Initialize logic
    populateSelectors(container);
    setupEventListeners(container);
    await fetchData(container);
    renderCharts(container);
}

function renderKPICard(label, key, icon, color, isCurrency = true) {
    return `
        <div class="glass-card kpi-card">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div class="kpi-label">${label}</div>
                <span class="material-icons-round" style="color: ${color}; opacity: 0.8;">${icon}</span>
            </div>
            <div class="kpi-value" id="kpi-${key}">-</div>
            <div style="font-size: 0.8rem; color: var(--text-tertiary);">
                <span id="kpi-delta-${key}"></span> vs periodo prec.
            </div>
        </div>
    `;
}

function generateYearOptions() {
    const current = new Date().getFullYear();
    let opts = '';
    for (let i = current; i >= 2020; i--) {
        opts += `<option value="${i}">${i}</option>`;
    }
    return opts;
}

function populateSelectors(container) {
    const clientSelect = container.querySelector('#client-select');
    // Using state.utils.clients if available, or fetch
    // Assuming state.clients exists from app bootstrap
    const clients = state.clients || [];
    const sorted = [...clients].sort((a, b) => a.business_name.localeCompare(b.business_name));

    sorted.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.business_name;
        clientSelect.appendChild(opt);
    });
}

function setupEventListeners(container) {
    // Period Toggles
    container.querySelectorAll('.segmented-control button[data-period]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            container.querySelectorAll('.segmented-control button[data-period]').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            dashboardState.period = e.target.dataset.period;

            // Toggle Year Selector Visibility
            const yearSelect = container.querySelector('#year-select');
            if (dashboardState.period === '12M') {
                yearSelect.classList.add('hidden');
            } else {
                yearSelect.classList.remove('hidden');
            }

            fetchData(container);
        });
    });

    // Initial State Check for Year Selector
    const yearSelect = container.querySelector('#year-select');
    if (dashboardState.period === '12M') {
        yearSelect.classList.add('hidden');
    }

    // Group By Toggles
    container.querySelectorAll('.segmented-control button[data-group]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            container.querySelectorAll('.segmented-control button[data-group]').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            dashboardState.groupBy = e.target.dataset.group;
            fetchData(container, true); // Partial update if possible, but fetch needed for chart
        });
    });

    // Year Change
    container.querySelector('#year-select').addEventListener('change', (e) => {
        dashboardState.year = parseInt(e.target.value);
        fetchData(container);
    });

    // Client Change
    container.querySelector('#client-select').addEventListener('change', (e) => {
        dashboardState.clientId = e.target.value || null;
        fetchData(container);
    });

    // Gross Toggle
    container.querySelector('#gross-toggle').addEventListener('change', (e) => {
        dashboardState.isGross = e.target.checked;
        fetchData(container);
    });

    // Refresh
    container.querySelector('#refresh-btn').addEventListener('click', () => fetchData(container));
}

// Helpers for Date Ranges
function getDateRange(period, year) {
    const today = new Date();
    let start, end;

    const m = today.getMonth();
    const q = Math.floor(m / 3);

    if (period === 'MTD') {
        start = new Date(year, m, 1);
        end = new Date(year, m + 1, 0); // Last day of month
    } else if (period === 'QTD') {
        start = new Date(year, q * 3, 1);
        end = new Date(year, (q + 1) * 3, 0);
    } else if (period === 'YTD') {
        start = new Date(year, 0, 1);
        end = (year === today.getFullYear()) ? today : new Date(year, 11, 31);
    } else if (period === '12M') {
        end = today;
        start = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    }

    return {
        start: start && start instanceof Date && !isNaN(start) ? start.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        end: end && end instanceof Date && !isNaN(end) ? end.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    };
}

async function fetchData(container, chartOnly = false) {
    const loader = container.querySelector('#dashboard-loader');
    loader.classList.remove('hidden');

    try {
        const { start, end } = getDateRange(dashboardState.period, dashboardState.year);
        const { start: prevStart, end: prevEnd } = getPrevDateRange(start, end, dashboardState.period);

        const commonParams = {
            p_start_date: start,
            p_end_date: end,
            p_client_id: dashboardState.clientId,
            p_is_gross: dashboardState.isGross
        };

        const promises = [];

        // 1. Chart Data
        promises.push(
            sb.rpc('get_revenue_chart_data', {
                ...commonParams,
                p_interval: dashboardState.groupBy
            })
        );

        if (!chartOnly) {
            // 2. KPIs Current
            promises.push(sb.rpc('get_revenue_kpis', commonParams));

            // 3. KPIs Previous (for delta)
            promises.push(sb.rpc('get_revenue_kpis', {
                p_start_date: prevStart,
                p_end_date: prevEnd,
                p_client_id: dashboardState.clientId,
                p_is_gross: dashboardState.isGross
            }));

            // 4. Top Clients
            promises.push(sb.rpc('get_top_clients_revenue', {
                p_start_date: start,
                p_end_date: end,
                p_is_gross: dashboardState.isGross
            }));

            // 5. Outstanding List
            promises.push(sb.rpc('get_outstanding_invoices_list', {
                p_client_id: dashboardState.clientId,
                p_limit: 50,
                p_offset: 0
            }));
        }

        const results = await Promise.all(promises);

        if (chartOnly) {
            dashboardState.data.chartData = results[0].data || [];
        } else {
            dashboardState.data.chartData = results[0].data || [];
            dashboardState.data.kpis = results[1].data || { issued: 0, collected: 0, outstanding: 0, avg_days: 0 };
            dashboardState.data.prevKpis = results[2].data || { issued: 0, collected: 0, outstanding: 0 };
            dashboardState.data.topClients = results[3].data || [];
            dashboardState.data.outstandingList = results[4].data || [];
        }

        updateUI(container, chartOnly);

    } catch (err) {
        console.error('Dashboard Fetch Error:', err);
        showGlobalAlert('Errore nel caricamento dati dashboard', 'error');
    } finally {
        loader.classList.add('hidden');
    }
}

function getPrevDateRange(startStr, endStr, period) {
    // Simple logic: same duration shifted back
    // MTD -> Prev Month
    // YTD -> Same dates last year
    const start = new Date(startStr);
    const end = new Date(endStr);

    if (period === 'YTD' || period === '12M') {
        start.setFullYear(start.getFullYear() - 1);
        end.setFullYear(end.getFullYear() - 1);
    } else {
        // Shift back by (End - Start) days
        const duration = end - start; // ms
        // For MTD, shift back 1 month exactly to align months?
        // Let's use simple logic:
        start.setMonth(start.getMonth() - 1);
        end.setMonth(end.getMonth() - 1);
        // Fix end of month overflow
    }

    return {
        start: start && !isNaN(start) ? start.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        end: end && !isNaN(end) ? end.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    };
}

function updateUI(container, chartOnly) {
    if (!chartOnly) {
        // Update KPIs
        const k = dashboardState.data.kpis;
        const p = dashboardState.data.prevKpis;

        updateKpiValue(container, 'issued', k.issued, p.issued);
        updateKpiValue(container, 'collected', k.collected, p.collected);
        updateKpiValue(container, 'outstanding', k.outstanding, p.outstanding); // Delta outstanding? Maybe vs last month's outstanding?

        // Avg Days: special case, no sum
        const elVal = container.querySelector('#kpi-avg_days');
        const elDelta = container.querySelector('#kpi-delta-avg_days');
        elVal.textContent = k.avg_days + ' gg';
        elDelta.textContent = (k.avg_days - p.avg_days).toFixed(1);
        elDelta.style.color = (k.avg_days < p.avg_days) ? 'green' : (k.avg_days > p.avg_days ? 'red' : 'gray'); // Lower is better

        // Top Clients
        const tbodyClients = container.querySelector('#top-clients-table tbody');
        tbodyClients.innerHTML = dashboardState.data.topClients.map(c => `
            <tr>
                <td style="font-weight:500;">${c.business_name}</td>
                <td style="text-align:right;">€ ${formatAmount(c.issued)}</td>
                <td style="text-align:right; color:var(--text-secondary);">€ ${formatAmount(c.collected)}</td>
            </tr>
        `).join('');

        // Outstanding List
        const tbodyOut = container.querySelector('#outstanding-table tbody');
        tbodyOut.innerHTML = dashboardState.data.outstandingList.map(i => `
            <tr>
                <td>${new Date(i.invoice_date).toLocaleDateString()}</td>
                <td>${i.client_name}</td>
                <td style="font-weight:600;">€ ${formatAmount(i.amount_tax_excluded)}</td>
                <td><span class="badge ${i.days_open > 60 ? 'badge-red' : (i.days_open > 30 ? 'badge-yellow' : 'badge-gray')}">${i.days_open} gg</span></td>
            </tr>
        `).join('');
    }

    renderCharts(container);
}

function updateKpiValue(container, key, current, prev) {
    const elVal = container.querySelector(`#kpi-${key}`);
    const elDelta = container.querySelector(`#kpi-delta-${key}`);

    elVal.textContent = '€ ' + formatAmount(current);

    let diff = current - prev;
    let pct = prev > 0 ? ((diff / prev) * 100).toFixed(1) + '%' : (diff > 0 ? '+∞' : '-');
    let color = diff >= 0 ? 'green' : 'red';

    if (key === 'outstanding') color = diff > 0 ? 'red' : 'green'; // Less outstanding is better? Usually.

    elDelta.textContent = (diff > 0 ? '+' : '') + formatAmount(diff) + ' (' + pct + ')';
    elDelta.style.color = color;
}

// Chart Instance
let revenueChart = null;

function renderCharts(container) {
    const ctx = container.querySelector('#revenue-chart').getContext('2d');
    const data = dashboardState.data.chartData || [];

    const labels = data.map(d => d.label);
    const issued = data.map(d => d.issued);
    const collected = data.map(d => d.collected);

    if (revenueChart) revenueChart.destroy();

    revenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Emesso',
                    data: issued,
                    backgroundColor: 'rgba(124, 58, 237, 0.7)',
                    borderColor: 'rgba(124, 58, 237, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Incassato',
                    data: collected,
                    backgroundColor: 'rgba(76, 175, 80, 0.7)',
                    borderColor: 'rgba(76, 175, 80, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: { callback: (value) => '€ ' + value }
                },
                x: {
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) label += '€ ' + formatAmount(context.parsed.y);
                            return label;
                        }
                    }
                }
            }
        }
    });
}
