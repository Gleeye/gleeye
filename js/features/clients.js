import { state } from '/js/modules/state.js?v=8000';
import { formatAmount } from '../modules/utils.js?v=8000';
// Import dependencies similar to collaborators.js
// We assume fetch functions are available in api.js if needed, but we rely on state mostly
import { fetchOrders, fetchInvoices, fetchPayments, upsertClient, fetchClients } from '../modules/api.js?v=8000';
import { showGlobalAlert } from '../modules/utils.js?v=8000';
import { activityTranslate } from '../modules/pm_activity_helper.js?v=8000';
import { glossaryTip } from '../modules/help_tooltip.js?v=8002';
import { inlineHelpButton, attachInlineHelp } from '../modules/help_inline_ai.js?v=8001';
import { initClientFilesTab } from './pm/components/hub/files_tab.js?v=8019';
// Caricato on-demand: side-effect installa window.openReminderModal
import './clients/reminder_compose.js?v=8008';

// ── Account responsabile helpers ──────────────────────────────────────────────
function _parseTags(tags) {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags;
    if (typeof tags === 'string') {
        const s = tags.trim();
        if (!s) return [];
        if (s.startsWith('[')) {
            try { return JSON.parse(s); } catch { /* fall through */ }
        }
        return s.split(',').map(t => t.trim()).filter(Boolean);
    }
    return [];
}

export function getAccountCollaborators() {
    return (state.collaborators || []).filter(c => {
        const tags = _parseTags(c.tags).map(t => t.toLowerCase());
        return tags.includes('account');
    });
}

export function findAccountResponsible(client) {
    if (!client || !client.account_responsible_id) return null;
    return (state.collaborators || []).find(c => c.id === client.account_responsible_id) || null;
}

function _accountInitials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function _accountColor(id) {
    // hash deterministico → palette tenue
    if (!id) return '#94a3b8';
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
    return palette[Math.abs(h) % palette.length];
}

// ── Credit risk: detection clienti che stanno per diventare un problema ──────
// Soglie:
//   - Sofferenza (rosso): 2+ fatture overdue, OPPURE 1 fattura overdue > 90gg
//   - Ritardo (ambra): 1 fattura overdue 30-90gg
//   - OK: nessuna fattura scaduta o ritardo < 30gg
export function computeClientCreditRisk(client) {
    if (!client || !client.id) return { level: 'ok', count: 0, totalDue: 0, maxDays: 0 };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueInvoices = (state.invoices || []).filter(i => {
        if (i.client_id !== client.id) return false;
        if (i.status === 'Saldata' || i.status === 'Annullata') return false;
        const dueRaw = i.due_date || i.invoice_date;
        if (!dueRaw) return false;
        const due = new Date(dueRaw);
        return due < today;
    });

    if (overdueInvoices.length === 0) {
        return { level: 'ok', count: 0, totalDue: 0, maxDays: 0 };
    }

    let totalDue = 0;
    let maxDays = 0;
    overdueInvoices.forEach(i => {
        const lordo = parseFloat(i.amount_tax_included) || parseFloat(i.amount_tax_excluded) || 0;
        const paid = parseFloat(i.amount_paid) || 0;
        totalDue += Math.max(0, lordo - paid);
        const dueRaw = i.due_date || i.invoice_date;
        const days = Math.floor((today - new Date(dueRaw)) / (1000 * 60 * 60 * 24));
        if (days > maxDays) maxDays = days;
    });

    // Sofferenza: 2+ fatture overdue OR 1 sola ma vecchia di più di 90gg
    if (overdueInvoices.length >= 2 || maxDays > 90) {
        return { level: 'distress', count: overdueInvoices.length, totalDue, maxDays };
    }
    // Ritardo: 1 fattura 30-90gg overdue
    if (maxDays >= 30) {
        return { level: 'late', count: overdueInvoices.length, totalDue, maxDays };
    }
    return { level: 'ok', count: overdueInvoices.length, totalDue, maxDays };
}

function _renderCreditRiskBadge(client, opts = {}) {
    const r = computeClientCreditRisk(client);
    if (r.level === 'ok') return '';
    const compact = opts.compact === true;
    const baseStyle = 'display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;';
    const fontSize = compact ? 'font-size: 0.62rem;' : 'font-size: 0.7rem;';
    if (r.level === 'distress') {
        const title = `${r.count} fattur${r.count === 1 ? 'a' : 'e'} scadut${r.count === 1 ? 'a' : 'e'} per €${formatAmount(r.totalDue)}, max ${r.maxDays}gg di ritardo. Valuta blocco nuovi ordini finché non rientra.`;
        return `<span class="credit-risk-badge" title="${title}" style="${baseStyle} ${fontSize} background: rgba(220, 38, 38, 0.12); color: #b91c1c; border: 1px solid rgba(220, 38, 38, 0.35);">⚠️ Sofferenza credito</span>`;
    }
    // late
    const title = `${r.count} fattura scaduta da ${r.maxDays}gg per €${formatAmount(r.totalDue)}. Segnale di attenzione.`;
    return `<span class="credit-risk-badge" title="${title}" style="${baseStyle} ${fontSize} background: rgba(245, 158, 11, 0.12); color: #b45309; border: 1px solid rgba(245, 158, 11, 0.35);">🟡 Pagamento in ritardo</span>`;
}

export async function renderClients(container) {
    // Ensure we have orders for analytics
    const { fetchOrders, fetchCollaborators } = await import('../modules/api.js?v=8000');
    if (!state.orders || state.orders.length === 0) {
        await fetchOrders();
    }
    if (!state.collaborators || state.collaborators.length === 0) {
        await fetchCollaborators();
    }

    // Filtro per account (state.clientsAccountFilter = 'all' | '<collab_id>' | 'unassigned')
    if (typeof state.clientsAccountFilter === 'undefined') state.clientsAccountFilter = 'all';

    const filteredClients = state.clients.filter(c => {
        const matchesSearch =
            (c.business_name || '').toLowerCase().includes(state.searchTerm.toLowerCase()) ||
            (c.client_code || '').toLowerCase().includes(state.searchTerm.toLowerCase()) ||
            (c.city || '').toLowerCase().includes(state.searchTerm.toLowerCase());
        if (!matchesSearch) return false;
        if (state.clientsAccountFilter === 'all') return true;
        if (state.clientsAccountFilter === 'unassigned') return !c.account_responsible_id;
        return c.account_responsible_id === state.clientsAccountFilter;
    });

    // ANALYTICS LOGIC
    const processAnalytics = () => {
        const stats = {
            total: state.clients.length,
            active: 0,
            activeClientsCount: 0,
            growthData: {}, // month -> cumulative count
            activityData: {}, // month -> order count
            geoData: {} // city -> count
        };

        // 1. Calc Active Status and First Dates
        const clientFirstOrder = {};

        // Tracking active clients based on the same logic as the indicator
        const activeClientsIds = new Set();

        state.orders.forEach(o => {
            const date = new Date(o.created_at || o.order_date);
            const monthStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

            // Stats 2: Order Activity
            stats.activityData[monthStr] = (stats.activityData[monthStr] || 0) + 1;

            if (!clientFirstOrder[o.client_id] || date < clientFirstOrder[o.client_id]) {
                clientFirstOrder[o.client_id] = date;
            }

            // Logic for active stats
            const offStatus = (o.offer_status || '').toLowerCase();
            const workStatus = (o.status_works || '').toLowerCase();
            
            const isOfferPending = ['in_lavorazione', 'invio_programmato', 'inviata', 'offerta'].includes(offStatus);
            const isAccepted = offStatus === 'accettata';
            const isRefused = offStatus === 'rifiutata';
            const isWorking = !['completato', 'chiuso'].includes(workStatus);

            if (isOfferPending || (isAccepted && isWorking)) {
                activeClientsIds.add(o.client_id);
            }
        });

        stats.activeClientsCount = activeClientsIds.size;

        // 2. Growth Data (Cumulative)
        const sortedMonths = Object.keys(stats.activityData).sort();
        let cumulative = 0;
        sortedMonths.forEach(m => {
            // Approximation: new clients are those whose first order month is M
            const newThisMonth = Object.values(clientFirstOrder).filter(d => {
                const ds = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
                return ds === m;
            }).length;
            cumulative += newThisMonth;
            stats.growthData[m] = cumulative;
        });

        // 3. Geo Stats
        state.clients.forEach(c => {
            if (c.city) stats.geoData[c.city] = (stats.geoData[c.city] || 0) + 1;
        });

        return stats;
    };

    const analytics = processAnalytics();

    const getActiveStatus = (client) => {
        if (!state.orders) return false;
        return state.orders.some(o => {
            if (o.client_id !== client.id) return false;

            const offStatus = (o.offer_status || '').toLowerCase();
            const workStatus = (o.status_works || '').toLowerCase();

            // Case 1: Pending Offer
            const isOfferPending = ['in_lavorazione', 'invio_programmato', 'inviata', 'offerta'].includes(offStatus);
            if (isOfferPending) return true;

            // Case 2: Accepted Offer but work is not completed
            const isAccepted = offStatus === 'accettata';
            const isWorking = !['completato', 'chiuso'].includes(workStatus);
            if (isAccepted && isWorking) return true;

            return false;
        });
    };

    const clientsHTML = filteredClients.length > 0 ? filteredClients.map(client => {
        const isActive = getActiveStatus(client);
        const status = computeClientStatus(client);
        const creditBadge = _renderCreditRiskBadge(client, { compact: true });
        const acc = findAccountResponsible(client);
        const accBadge = acc
            ? `<div class="v7-acc-badge" title="Account: ${acc.full_name}" style="width: 22px; height: 22px; border-radius: 50%; background: ${_accountColor(acc.id)}22; color: ${_accountColor(acc.id)}; display:flex; align-items:center; justify-content:center; font-size: 0.65rem; font-weight: 700; border: 1px solid ${_accountColor(acc.id)}55;">${_accountInitials(acc.full_name)}</div>`
            : `<div class="v7-acc-badge v7-acc-unassigned" title="Account non assegnato" style="width: 22px; height: 22px; border-radius: 50%; background: rgba(148,163,184,0.1); color: #94a3b8; display:flex; align-items:center; justify-content:center; border: 1px dashed #cbd5e1;"><span class="material-icons-round" style="font-size: 14px;">person_off</span></div>`;

        return `
            <div class="v7-rubrica-item animate-fade-in" onclick="window.location.hash='client-detail/${client.id}'">
                <div class="v7-item-main">
                    <div class="v7-id-row">
                        <span class="v7-id">${client.client_code || '---'}</span>
                        <span class="v7-status-pill" style="background:${status.color}18; color:${status.color}; border:1px solid ${status.color}30;">${status.label}</span>
                        ${creditBadge}
                    </div>
                    <div class="v7-name">${client.business_name}</div>
                    <div class="v7-city-mini">${client.city || '-'}</div>
                </div>
                <div class="v7-item-contacts">
                    ${accBadge}
                    <a href="mailto:${client.email || '#'}" onclick="event.stopPropagation()" class="v7-contact-icon" title="${client.email || 'Nessuna mail'}">
                        <span class="material-icons-round">alternate_email</span>
                    </a>
                    <a href="tel:${client.phone || '#'}" onclick="event.stopPropagation()" class="v7-contact-icon" title="${client.phone || 'Nessun telefono'}">
                        <span class="material-icons-round">phone_iphone</span>
                    </a>
                </div>
            </div>
        `;
    }).join('') : `
        <div class="v7-empty">Nessun record trovato</div>
    `;

    // Conta clienti per ogni account per il dropdown filtro
    const accountCounts = {};
    (state.clients || []).forEach(c => {
        const key = c.account_responsible_id || '__unassigned__';
        accountCounts[key] = (accountCounts[key] || 0) + 1;
    });
    const accountFilterOptions = getAccountCollaborators()
        .map(a => `<option value="${a.id}" ${state.clientsAccountFilter === a.id ? 'selected' : ''}>${a.full_name} (${accountCounts[a.id] || 0})</option>`)
        .join('');

    // Globalize for inline event handlers
    window.renderClients = renderClients;

    container.innerHTML = `
        <style>
            :root {
                --crm-bg: radial-gradient(at 0% 0%, rgba(248, 250, 255, 1) 0%, rgba(239, 243, 249, 1) 100%),
                          linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(255, 255, 255, 0) 100%);
            }
            .crm-page {
                display: grid;
                grid-template-columns: 320px 1fr;
                grid-template-rows: 100%;
                height: calc(100vh - 80px); /* Fixed height to match main content area minus topbar */
                background: var(--crm-bg);
                overflow: hidden;
                position: relative;
                margin: 0 -3rem -3rem -3rem; /* Inverse the padding of .content-area to take full space */
            }
            
            /* Decorative shapes for background depth */
            .crm-page::before {
                content: '';
                position: absolute;
                top: -10%;
                right: -10%;
                width: 40%;
                height: 40%;
                background: radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%);
                filter: blur(100px);
                z-index: 0;
                pointer-events: none;
            }

            /* RUBRICA SIDEBAR */
            .crm-sidebar {
                background: rgba(255, 255, 255, 0.5);
                backdrop-filter: blur(30px) saturate(180%);
                -webkit-backdrop-filter: blur(30px) saturate(180%);
                border-right: 1px solid rgba(0,0,0,0.06);
                display: flex;
                flex-direction: column;
                z-index: 10;
                position: relative;
                height: 100%;
                min-height: 0;
            }
            .crm-sidebar-header {
                padding: 1.5rem;
                border-bottom: 1px solid rgba(0,0,0,0.05);
                flex-shrink: 0;
            }
            .v7-search-box {
                background: white;
                border-radius: 12px;
                padding: 8px 12px;
                display: flex;
                align-items: center;
                gap: 10px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.03);
                margin-top: 1.25rem;
                border: 1px solid rgba(0,0,0,0.02);
            }
            .v7-search-box input {
                border: none;
                outline: none;
                font-size: 0.9rem;
                width: 100%;
                color: var(--text-primary);
            }
            
            .crm-sidebar-list {
                flex: 1;
                overflow-y: auto;
                padding: 1rem 0.75rem;
                min-height: 0;
            }
            .v7-rubrica-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 14px 1rem;
                border-radius: 14px;
                margin-bottom: 6px;
                cursor: pointer;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .v7-rubrica-item:hover {
                background: white;
                box-shadow: 0 10px 25px -10px rgba(0,0,0,0.1);
                transform: translateX(6px);
            }
            .v7-id-row { display: flex; align-items: center; gap: 8px; }
            .v7-id { font-weight: 700; font-size: 1rem; color: var(--brand-blue); font-family: 'Questrial'; letter-spacing: -0.2px; }
            .v7-active-dot { width: 7px; height: 7px; background: #10b981; border-radius: 50%; box-shadow: 0 0 10px rgba(16, 185, 129, 0.5); }
            .v7-status-pill { font-size: 0.62rem; font-weight: 700; padding: 1px 7px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.04em; flex-shrink: 0; }
            .v7-name { font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px;}
            .v7-city-mini { font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 3px; font-weight: 600; }
            
            .v7-item-contacts { display: flex; gap: 10px; opacity: 0; transition: all 0.2s; transform: translateX(10px); }
            .v7-rubrica-item:hover .v7-item-contacts { opacity: 1; transform: translateX(0); }
            .v7-contact-icon { 
                width: 32px; 
                height: 32px; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                border-radius: 8px; 
                background: var(--bg-secondary);
                color: var(--text-tertiary); 
                text-decoration: none; 
                transition: all 0.2s;
            }
            .v7-contact-icon:hover { color: white; background: var(--brand-blue); }
            .v7-contact-icon .material-icons-round { font-size: 1.1rem; }

            /* DASHBOARD MAIN AREA */
            .crm-dashboard {
                padding: 2.5rem;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 2.5rem;
                height: 100%;
                min-height: 0;
            }
            .v7-stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                gap: 2rem;
            }
            .v7-card {
                background: white;
                border-radius: 24px;
                padding: 1.75rem;
                box-shadow: 0 20px 40px -15px rgba(0,0,0,0.05);
                border: 1px solid rgba(255,255,255,0.8);
                transition: transform 0.3s;
            }
            .v7-card:hover { transform: translateY(-5px); }
            .v7-card-title { font-size: 0.95rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 2rem; display: flex; align-items: center; gap: 10px; text-transform: uppercase; letter-spacing: 0.5px;}
            .v7-chart-container { height: 280px; position: relative; }

            .v7-hero-stats {
                display: flex;
                gap: 3rem;
                margin-bottom: 1rem;
            }
            .hero-stat-item {
                display: flex;
                flex-direction: column;
            }
            .hero-stat-val { font-size: 3rem; font-weight: 800; color: var(--text-primary); letter-spacing: -2px; line-height: 1; }
            .hero-stat-label { font-size: 0.85rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; margin-top: 8px; letter-spacing: 1px; }
            
            .v7-empty { padding: 3rem; text-align: center; color: var(--text-tertiary); font-style: italic; opacity: 0.5; }

            @media (max-width: 1024px) {
                .crm-page { grid-template-columns: 1fr; }
                .crm-sidebar { display: none; }
            }
        </style>

        <div class="crm-page animate-fade-in">
            <!-- MASTER: RUBRICA -->
            <div class="crm-sidebar">
                <div class="crm-sidebar-header">
                    <div style="display:flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin:0; font-size: 1.4rem; font-weight: 700; color: var(--text-primary);">Rubrica Clients</h3>
                        <button class="primary-btn" onclick="openNewClientModal()" style="padding: 0.5rem; border-radius: 10px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
                            <span class="material-icons-round">add</span>
                        </button>
                    </div>
                    <div class="v7-search-box">
                        <span class="material-icons-round" style="font-size: 1.2rem; color: var(--text-tertiary);">search</span>
                        <input type="text" placeholder="Scansione istantanea..." value="${state.searchTerm}"
                               oninput="state.searchTerm = this.value; renderClients(document.getElementById('content-area'))">
                    </div>
                    <div style="margin-top: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span class="material-icons-round" style="font-size: 1rem; color: var(--text-tertiary);">supervisor_account</span>
                        <select onchange="state.clientsAccountFilter = this.value; renderClients(document.getElementById('content-area'))"
                            style="flex: 1; padding: 0.4rem 0.6rem; border: 1px solid var(--glass-border); border-radius: 8px; background: white; font-size: 0.82rem; color: var(--text-primary);">
                            <option value="all" ${state.clientsAccountFilter === 'all' ? 'selected' : ''}>Tutti gli account</option>
                            <option value="unassigned" ${state.clientsAccountFilter === 'unassigned' ? 'selected' : ''}>Non assegnati (${accountCounts['__unassigned__'] || 0})</option>
                            ${accountFilterOptions}
                        </select>
                    </div>
                </div>
                <div class="crm-sidebar-list">
                    ${clientsHTML}
                </div>
            </div>

            <!-- DETAIL: DASHBOARD -->
            <div class="crm-dashboard">
                <div class="animate-slide-up">
                    <div class="v7-hero-stats">
                        <div class="hero-stat-item">
                            <span class="hero-stat-val">${analytics.total}</span>
                            <span class="hero-stat-label">Stock Totale</span>
                        </div>
                        <div class="hero-stat-item">
                            <span class="hero-stat-val" style="color: #10b981;">${analytics.activeClientsCount}</span>
                            <span class="hero-stat-label">Active Hub</span>
                        </div>
                    </div>
                    <p style="color: var(--text-tertiary); font-size: 1rem; max-width: 600px; line-height: 1.5;">Benvenuto nella centrale operativa. Qui puoi monitorare la crescita e la vitalità del tuo network commerciale.</p>
                </div>

                <div class="v7-stats-grid">
                    <div class="v7-card animate-slide-up" style="animation-delay: 0.1s;">
                        <div class="v7-card-title">
                            <span class="material-icons-round" style="color: var(--brand-blue)">insights</span>
                            Acquisizione Parco Clienti
                        </div>
                        <div class="v7-chart-container">
                            <canvas id="growthChart"></canvas>
                        </div>
                    </div>
                    
                    <div class="v7-card animate-slide-up" style="animation-delay: 0.2s;">
                        <div class="v7-card-title">
                            <span class="material-icons-round" style="color: #f59e0b">speed</span>
                            Volume Transato (Ordini)
                        </div>
                        <div class="v7-chart-container">
                            <canvas id="activityChart"></canvas>
                        </div>
                    </div>

                    <div class="v7-card animate-slide-up" style="animation-delay: 0.3s;">
                        <div class="v7-card-title">
                            <span class="material-icons-round" style="color: #ef4444">place</span>
                            Geolocalizzazione Cluster
                        </div>
                        <div class="v7-chart-container">
                            <canvas id="geoChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // INITIALIZE CHARTS
    setTimeout(() => {
        const ctxGrowth = document.getElementById('growthChart');
        const ctxActivity = document.getElementById('activityChart');
        const ctxGeo = document.getElementById('geoChart');

        if (ctxGrowth) {
            const existing = Chart.getChart(ctxGrowth);
            if (existing) existing.destroy();

            new Chart(ctxGrowth, {
                type: 'line',
                data: {
                    labels: Object.keys(analytics.growthData),
                    datasets: [{
                        label: 'Clienti Cumulativi',
                        data: Object.values(analytics.growthData),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.05)',
                        fill: true,
                        tension: 0.45,
                        borderWidth: 4,
                        pointRadius: 4,
                        pointBackgroundColor: '#fff',
                        pointBorderColor: '#3b82f6',
                        pointBorderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            display: true,
                            grid: { color: 'rgba(0,0,0,0.03)' },
                            ticks: { font: { size: 10 } }
                        },
                        x: {
                            display: true,
                            grid: { display: false },
                            ticks: { font: { size: 10 }, maxRotation: 0 }
                        }
                    }
                }
            });
        }

        if (ctxActivity) {
            const existing = Chart.getChart(ctxActivity);
            if (existing) existing.destroy();

            new Chart(ctxActivity, {
                type: 'bar',
                data: {
                    labels: Object.keys(analytics.activityData),
                    datasets: [{
                        data: Object.values(analytics.activityData),
                        backgroundColor: '#f59e0b',
                        borderRadius: 10,
                        hoverBackgroundColor: '#d97706'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { display: true, grid: { color: 'rgba(0,0,0,0.03)' }, ticks: { font: { size: 10 } } },
                        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0 } }
                    }
                }
            });
        }

        if (ctxGeo) {
            const existing = Chart.getChart(ctxGeo);
            if (existing) existing.destroy();

            const sortedGeo = Object.entries(analytics.geoData).sort((a, b) => b[1] - a[1]).slice(0, 6);
            new Chart(ctxGeo, {
                type: 'doughnut',
                data: {
                    labels: sortedGeo.map(g => g[0]),
                    datasets: [{
                        data: sortedGeo.map(g => g[1]),
                        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9'],
                        borderWidth: 4,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%',
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true, font: { size: 11 } } }
                    }
                }
            });
        }
    }, 100);
}

export function renderClientDetail(container) {
    const id = state.currentId;
    const client = state.clients.find(c => c.id == id);

    if (!client) {
        container.innerHTML = '<div style="padding:2rem; text-align:center;">Cliente non trovato</div>';
        return;
    }

    // Ensure state data is loaded
    if ((!state.payments || state.payments.length === 0) && typeof fetchPayments !== 'undefined') {
        fetchPayments().then(() => renderClientDetail(container));
        return; // Rerender after fetch
    }
    if (!state.contacts) {
        import('../modules/api.js?v=8000').then(api => api.fetchContacts()).then(() => renderClientDetail(container));
        return;
    }
    if (!state.collaborators || state.collaborators.length === 0) {
        import('../modules/api.js?v=8000').then(api => api.fetchCollaborators()).then(() => renderClientDetail(container));
        return;
    }

    // Filter Data
    const clientOrders = state.orders ? state.orders.filter(o => o.client_id === client.id) : [];
    const clientInvoices = state.invoices ? state.invoices.filter(i => i.client_id === client.id) : []; // Active invoices
    const clientPayments = state.payments ? state.payments.filter(p => p.payment_type === 'Cliente' && p.client_id === client.id) : [];
    const clientContacts = state.contacts ? state.contacts.filter(c => c.client_id === client.id) : [];

    // Calculate KPI
    const totalInvoiced = clientInvoices.reduce((sum, i) => sum + (parseFloat(i.amount_tax_excluded) || 0), 0);
    const totalPaid = clientPayments.filter(p => p.status === 'Done' || p.status === 'Saldato').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const totalDue = totalInvoiced - totalPaid; // Approximate logic

    container.innerHTML = `
        <div class="animate-fade-in">
            <button class="btn-link" onclick="window.location.hash='sales'" style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); padding: 0;">
                <span class="material-icons-round">arrow_back</span> Torna alla lista
            </button>

            <!-- Header Profile -->
            <div class="glass-card" style="padding: 2.5rem; display: flex; gap: 2.5rem; align-items: flex-start; margin-bottom: 2rem;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem;">
                    <div style="width: 120px; height: 120px; border-radius: 50%; background: var(--brand-gradient); display: flex; align-items: center; justify-content: center; color: white; font-size: 3rem; font-weight: 400; box-shadow: var(--shadow-premium);">
                        ${client.business_name ? client.business_name[0].toUpperCase() : 'C'}
                    </div>
                     <!-- Code Badge -->
                    ${client.client_code ? `<span style="font-size: 0.85rem; color: var(--text-tertiary); font-family: monospace; letter-spacing: 1px; background: rgba(0,0,0,0.05); padding: 2px 8px; border-radius: 4px;">${client.client_code}</span>` : ''}
                </div>
                
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
                                <h1 style="margin: 0; font-size: 2.2rem; letter-spacing: -0.5px; color: var(--text-primary);">${client.business_name}</h1>
                                ${(() => { const s = computeClientStatus(client); return `<span style="display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px; border-radius: 999px; background:${s.color}18; color:${s.color}; border: 1px solid ${s.color}30; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;"><span style="width: 7px; height: 7px; border-radius: 50%; background:${s.color};"></span>${s.label}</span>`; })()}
                                ${_renderCreditRiskBadge(client)}
                            </div>
                            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; margin-bottom: 1rem;">
                                <span style="font-size: 1rem; color: var(--brand-blue); font-weight: 400;">Cliente</span>
                                <div style="width: 4px; height: 4px; border-radius: 50%; background: var(--text-tertiary);"></div>
                                <span style="font-size: 0.85rem; color: var(--text-secondary); background: var(--bg-secondary); padding: 2px 10px; border-radius: 12px;">${client.city ? `${client.city}${client.province ? ` (${client.province})` : ''}` : 'N/A'}</span>
                                ${inlineHelpButton({ id: client.id, contextType: 'client', label: 'Spiegami', icon: 'auto_awesome' })}
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            ${(() => {
                                const r = computeClientCreditRisk(client);
                                if (r.level === 'ok') return '';
                                return `<button onclick="window.openReminderModal('${client.id}')" class="primary-btn" style="background: ${r.level === 'distress' ? '#dc2626' : '#d97706'}; color: white; padding: 0.5rem 0.85rem; border-radius: 10px; font-size: 0.82rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; border: none;">
                                    <span class="material-icons-round" style="font-size: 18px;">mail</span> Sollecita €${formatAmount(r.totalDue)}
                                </button>`;
                            })()}
                            <button class="icon-btn" style="background: var(--bg-secondary); width: 42px; height: 42px;" onclick='window.openNewClientModal(${JSON.stringify(client).replace(/'/g, "&apos;")})' title="Modifica">
                                <span class="material-icons-round" style="color: var(--text-primary);">edit</span>
                            </button>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-top: 2rem; padding-top: 2rem; border-top: 1px solid var(--glass-border);">
                        <div>
                            <span style="display: block; font-size: 0.75rem; font-weight: 400; color: var(--text-tertiary); margin-bottom: 0.4rem; letter-spacing: 0.5px;">CONTATTI</span>
                            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                <a href="mailto:${client.email}" style="display: flex; gap: 0.6rem; align-items: center; color: var(--text-primary); text-decoration: none; font-weight: 500;">
                                    <span class="material-icons-round" style="font-size: 1.1rem; color: var(--brand-blue);">email</span>
                                    ${client.email || '-'}
                                </a>
                                ${client.pec ? `
                                <a href="mailto:${client.pec}" style="display: flex; gap: 0.6rem; align-items: center; color: var(--text-primary); text-decoration: none; font-weight: 500;">
                                    <span class="material-icons-round" style="font-size: 1.1rem; color: var(--brand-blue);">verified_user</span>
                                    ${client.pec}
                                </a>` : ''}
                                <a href="tel:${client.phone}" style="display: flex; gap: 0.6rem; align-items: center; color: var(--text-primary); text-decoration: none; font-weight: 500;">
                                    <span class="material-icons-round" style="font-size: 1.1rem; color: var(--brand-blue);">call</span>
                                    ${client.phone || '-'}
                                </a>
                            </div>
                        </div>
                        
                         <div>
                            <span style="display: block; font-size: 0.75rem; font-weight: 400; color: var(--text-tertiary); margin-bottom: 0.4rem; letter-spacing: 0.5px;">INDIRIZZO</span>
                            <div style="display: flex; gap: 0.6rem; align-items: flex-start; color: var(--text-primary); font-weight: 500;">
                                <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary); margin-top: 1px;">place</span>
                                <div>
                                    <div style="margin-bottom: 2px;">${client.address || '-'}</div>
                                    <div style="font-size: 0.9rem; color: var(--text-secondary); font-weight: 400;">
                                        ${client.cap ? `${client.cap} ` : ''}${client.city || ''}${client.province ? ` (${client.province})` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <span style="display: block; font-size: 0.75rem; font-weight: 400; color: var(--text-tertiary); margin-bottom: 0.4rem; letter-spacing: 0.5px;">DATI FISCALI</span>
                            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                                <div style="display:flex; justify-content: space-between; gap: 1rem;">
                                    <span style="color: var(--text-secondary); font-size: 0.85rem;">P.IVA</span>
                                    <span style="font-family: monospace; font-size: 0.9rem;">${client.vat_number || '-'}</span>
                                </div>
                                <div style="display:flex; justify-content: space-between; gap: 1rem;">
                                    <span style="color: var(--text-secondary); font-size: 0.85rem;">C.F.</span>
                                    <span style="font-family: monospace; font-size: 0.9rem;">${client.fiscal_code || '-'}</span>
                                </div>
                                <div style="display:flex; justify-content: space-between; gap: 1rem;">
                                    <span style="color: var(--text-secondary); font-size: 0.85rem;">SDI</span>
                                    <span style="font-family: monospace; font-size: 0.9rem; color: var(--brand-blue);">${client.sdi_code || '-'}</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <span style="display: block; font-size: 0.75rem; font-weight: 400; color: var(--text-tertiary); margin-bottom: 0.4rem; letter-spacing: 0.5px;">ACCOUNT RESPONSABILE</span>
                            ${(() => {
                                const acc = findAccountResponsible(client);
                                if (acc) {
                                    const color = _accountColor(acc.id);
                                    return `
                                        <div style="display: flex; align-items: center; gap: 0.6rem;">
                                            <div style="width: 32px; height: 32px; border-radius: 50%; background: ${color}22; color: ${color}; display:flex; align-items:center; justify-content:center; font-size: 0.78rem; font-weight: 700; border: 1px solid ${color}55;">${_accountInitials(acc.full_name)}</div>
                                            <div style="flex: 1; min-width: 0;">
                                                <div style="font-weight: 600; color: var(--text-primary); font-size: 0.92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${acc.full_name}</div>
                                                <button class="btn-link" onclick="window.openClientAccountPicker('${client.id}')" style="padding: 0; font-size: 0.72rem; color: var(--brand-blue); background: none; border: none; cursor: pointer;">Cambia</button>
                                            </div>
                                        </div>`;
                                }
                                return `
                                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                                        <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(148, 163, 184, 0.15); color: #94a3b8; display:flex; align-items:center; justify-content:center;">
                                            <span class="material-icons-round" style="font-size: 18px;">person_add</span>
                                        </div>
                                        <button class="btn-link" onclick="window.openClientAccountPicker('${client.id}')" style="padding: 0.4rem 0.6rem; font-size: 0.85rem; color: var(--brand-blue); background: rgba(59, 130, 246, 0.08); border: 1px dashed var(--brand-blue); border-radius: 8px; cursor: pointer;">Assegna account</button>
                                    </div>`;
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tabs Controls -->
            <div class="tabs-container" style="margin-bottom: 1.5rem; border-bottom: 1px solid var(--glass-border); display: flex; gap: 1.5rem;">
                <button class="tab-btn active" data-tab="overview" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 2px solid var(--brand-blue); color: var(--brand-blue); font-weight: 400; cursor: pointer;">Panoramica</button>
                <button class="tab-btn" data-tab="contacts" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer;">Referenti (${clientContacts.length})</button>
                <button class="tab-btn" data-tab="orders" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer;">Commesse (${clientOrders.length})</button>
                <button class="tab-btn" data-tab="invoices" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer;">Fatture (${clientInvoices.length})</button>
                <button class="tab-btn" data-tab="payments" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer;">Pagamenti (${clientPayments.length})</button>
                <button class="tab-btn" data-tab="files-client" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer;">📂 File</button>
            </div>

            <!-- Tab Content: Overview -->
            <div id="tab-overview" class="tab-content">
                <div class="card-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 2rem;">
                    <div class="stats-card">
                        <div class="stats-header"><span>Totale Fatturato</span></div>
                        <div class="stats-value">€ ${formatAmount(totalInvoiced)}</div>
                        <div class="stats-trend">Imponibile</div>
                    </div>
                    <div class="stats-card">
                        <div class="stats-header"><span>Incassato</span></div>
                        <div class="stats-value">€ ${formatAmount(totalPaid)}</div>
                        <div class="stats-trend trend-up">Totale</div>
                    </div>
                     <div class="stats-card">
                        <div class="stats-header"><span>Da Incassare</span></div>
                        <div class="stats-value">€ ${formatAmount(totalDue)}</div>
                        <div class="stats-trend trend-down">Residuo</div>
                    </div>
                     <div class="stats-card">
                        <div class="stats-header"><span>Commesse</span></div>
                        <div class="stats-value">${clientOrders.length}</div>
                        <div class="stats-trend">Totali</div>
                    </div>
                </div>
            </div>

            <!-- Tab Content: Referenti -->
            <div id="tab-contacts" class="tab-content hidden">
                ${clientContacts.length === 0 ? `
                    <div style="text-align: center; padding: 4rem 2rem; background: var(--glass-bg); border-radius: 24px; border: 2px dashed var(--glass-border);">
                        <div style="width: 80px; height: 80px; background: rgba(78, 146, 216, 0.05); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                            <span class="material-icons-round" style="font-size: 3rem; color: var(--text-tertiary);">contact_phone</span>
                        </div>
                        <h3 style="font-family: var(--font-titles); font-weight: 400; margin-bottom: 0.5rem;">Nessun referente</h3>
                        <p style="color: var(--text-secondary); margin-bottom: 0; max-width: 400px; margin-inline: auto; font-size: 0.9rem;">
                            Non ci sono ancora referenti per questo cliente. I referenti si gestiscono in DB (tabella <code>contacts</code>) o tramite l'app Booking.
                        </p>
                    </div>
                ` : `
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
                        ${clientContacts.map(c => _renderContactCard(c)).join('')}
                    </div>
                `}
            </div>

            <!-- Tab Content: Orders -->
            <div id="tab-orders" class="tab-content hidden">
                 <div class="table-container">
                    <table>
                        <thead><tr><th>N. Ordine</th><th>Data</th><th>Titolo</th><th>Stato</th></tr></thead>
                        <tbody>
                            ${clientOrders.length ? clientOrders.map(o => `
                                 <tr onclick="window.location.hash='order-detail/${o.id}'" style="cursor:pointer; transition: background 0.15s;" class="hover-row">
                                     <td>${o.order_number}</td>
                                     <td>${new Date(o.order_date).toLocaleDateString('it-IT')}</td>
                                     <td>${o.title}</td>
                                     <td><span class="status-badge">${activityTranslate(o.status_works) || 'In Corso'}</span></td>
                                 </tr>
                             `).join('') : '<tr><td colspan="4" style="text-align:center; padding:1rem; opacity:0.6;">Nessuna commessa registrata.</td></tr>'}
                        </tbody>
                    </table>
                 </div>
            </div>

            <!-- Tab Content: Invoices -->
            <div id="tab-invoices" class="tab-content hidden">
                 <div class="table-container">
                    <table>
                        <thead><tr><th>Numero</th><th>Data</th><th>Imponibile</th><th>Stato</th></tr></thead>
                        <tbody>
                            ${clientInvoices.length ? clientInvoices.map(i => `
                                 <tr style="cursor: default;">
                                     <td>${i.invoice_number}</td>
                                     <td>${new Date(i.issue_date).toLocaleDateString('it-IT')}</td>
                                     <td>€ ${formatAmount(i.amount_tax_excluded)}</td>
                                     <td><span class="status-badge ${i.status === 'Pagato' ? 'status-active' : 'status-pending'}">${i.status}</span></td>
                                 </tr>
                             `).join('') : '<tr><td colspan="4" style="text-align:center; padding:1rem; opacity:0.6;">Nessuna fattura attiva.</td></tr>'}
                        </tbody>
                    </table>
                 </div>
            </div>

            <!-- Tab Content: Payments -->
            <div id="tab-payments" class="tab-content hidden">
                 <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th style="color: var(--text-secondary); font-weight: 500; font-size: 0.85rem;"><span style="display:flex; align-items:center; gap:4px;">Data <span class="material-icons-round" style="font-size:14px">arrow_downward</span></span></th>
                                <th style="color: var(--text-secondary); font-weight: 500; font-size: 0.85rem;">Causale</th>
                                <th style="color: var(--text-secondary); font-weight: 500; font-size: 0.85rem;">Incarico</th>
                                <th style="color: var(--text-secondary); font-weight: 500; font-size: 0.85rem;">Importo</th>
                                <th style="color: var(--text-secondary); font-weight: 500; font-size: 0.85rem; text-align:right;">Stato</th>
                            </tr>
                        </thead>
                         <tbody>
                            ${clientPayments.length ? clientPayments.map(p => `
                                <tr onclick="openPaymentModal('${p.id}')" style="cursor: pointer; transition: background 0.2s;">
                                    <td style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${new Date(p.due_date).toLocaleDateString('it-IT')}</td>
                                    <td><span style="font-size: 0.9rem; color: var(--text-primary);">${p.title || '-'}</span></td>
                                    <td>
                                        ${p.orders?.order_number ?
            `<span style="border: 1px solid var(--glass-border); padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; color: var(--text-primary); background: white;">${p.orders.order_number}</span>`
            : '-'}
                                    </td>
                                    <td style="font-family: 'Outfit', sans-serif; font-weight: 500; color: var(--text-primary);">€ ${formatAmount(p.amount)}</td>
                                    <td style="text-align:right;">
                                        ${p.status === 'Done' || p.status === 'Completato' || p.status === 'Saldato' ?
            `<span style="display: inline-flex; align-items: center; gap: 4px; color: var(--success); font-weight: 500; font-size: 0.85rem;"><span class="material-icons-round" style="font-size: 16px;">check_circle</span> Saldato</span>` :
            `<span style="display: inline-flex; align-items: center; gap: 4px; color: var(--warning); font-weight: 500; font-size: 0.85rem;"><span class="material-icons-round" style="font-size: 16px;">schedule</span> ${p.status || 'In attesa'}</span>`
        }
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="5" style="text-align:center; padding:2rem; color: var(--text-tertiary);">Nessun pagamento registrato.</td></tr>'}
                        </tbody>
                    </table>
                 </div>
            </div>
            <!-- Tab Content: File cliente -->
            <div id="tab-files-client" class="tab-content hidden"></div>
        </div>
    `;

    // Tabs Logic
    const tabs = container.querySelectorAll('.tab-btn');
    const contents = container.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.classList.remove('active');
                t.style.borderBottom = '2px solid transparent';
                t.style.color = 'var(--text-secondary)';
            });
            contents.forEach(c => c.classList.add('hidden'));

            tab.classList.add('active');
            tab.style.borderBottom = '2px solid var(--brand-blue)';
            tab.style.color = 'var(--brand-blue)';
            const targetId = `tab-${tab.dataset.tab}`;
            const targetEl = document.getElementById(targetId);
            targetEl.classList.remove('hidden');
            if (tab.dataset.tab === 'files-client' && !targetEl.dataset.initialized) {
                targetEl.dataset.initialized = '1';
                initClientFilesTab(targetEl, client.id);
            }
        });
    });

    // Help inline AI: "Spiegami questo cliente"
    attachInlineHelp(container, _buildClientHelpContext);
}

// Help AI context loader per il cliente
async function _buildClientHelpContext(clientId, contextType) {
    if (contextType !== 'client') return null;
    const client = state.clients?.find(c => c.id == clientId);
    if (!client) return null;

    const orders = (state.orders || []).filter(o => o.client_id === client.id);
    const invoices = (state.invoices || []).filter(i => i.client_id === client.id);
    const payments = (state.payments || []).filter(p => p.payment_type === 'Cliente' && p.client_id === client.id);
    const contacts = (state.contacts || []).filter(c => c.client_id === client.id);

    const revenue = invoices.reduce((s, i) => s + (parseFloat(i.amount_tax_excluded) || 0), 0);
    const open = invoices.filter(i => i.status !== 'Pagato' && i.status !== 'Saldata');
    const today = new Date().toISOString().slice(0, 10);
    const overdue = open.filter(i => i.due_date && i.due_date < today);
    const overdueTotal = overdue.reduce((s, i) => s + (parseFloat(i.amount_tax_included || i.amount_tax_excluded) || 0), 0);
    const activeOrders = orders.filter(o => {
        const off = (o.offer_status || '').toLowerCase();
        const works = (o.status_works || '').toLowerCase();
        return ['in_lavorazione', 'invio_programmato', 'inviata'].includes(off)
            || (off === 'accettata' && !['completato', 'chiuso'].includes(works));
    });

    const text = `
Sto guardando il cliente:

- Ragione sociale: ${client.business_name}
- Codice: ${client.client_code || '-'}
- Città: ${client.city || '-'}${client.province ? ' (' + client.province + ')' : ''}
- Email: ${client.email || '-'}
- P.IVA: ${client.vat_number || '-'}

Storia con noi:
- Commesse totali: ${orders.length} (${activeOrders.length} attive)
- Fatture emesse: ${invoices.length}
- Fatturato totale: € ${revenue.toFixed(2)}
- Fatture aperte: ${open.length} (di cui ${overdue.length} scadute per € ${overdueTotal.toFixed(2)})
- Referenti registrati: ${contacts.length}

Ultime commesse attive:
${activeOrders.slice(0, 5).map(o => `  - ${o.order_number} · ${o.short_name || o.title || ''} · ${o.offer_status || ''} / ${o.status_works || ''} · € ${o.total_price || 0}`).join('\n')}

Spiegami in 4 frasi:
1. Chi è questo cliente in sintesi (settore, frequenza, dimensione)
2. Quanto vale per noi (storia fatturato)
3. Allarmi attuali (scaduti, abbandono, ecc.)
4. Suggerimento azione se evidente

Italiano colloquiale, niente bullet point.
`.trim();

    return { text };
}

/**
 * Initialize the New Client Modal in the document
 */
export function initNewClientModal() {
    if (document.getElementById('new-client-modal')) return;

    // Insert animation styles if not present
    if (!document.getElementById('new-client-animations')) {
        document.head.insertAdjacentHTML('beforeend', `
            <style id="new-client-animations">
                @keyframes modalFadeIn {
                    from { opacity: 0; transform: scale(0.95) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .mobile-col-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
                .mobile-inline-grid { display: grid; grid-template-columns: 1fr 70px 100px; gap: 0.75rem; }
                @media (max-width: 768px) {
                    .mobile-col-grid { grid-template-columns: 1fr; gap: 1rem; }
                    .mobile-inline-grid { grid-template-columns: 1fr 1fr 1fr; }
                }
            </style>
        `);
    }

    document.body.insertAdjacentHTML('beforeend', `
        <div id="new-client-modal" class="modal">
            <div class="modal-content" style="max-width: 800px; padding: 2.5rem; border-radius: 24px; animation: modalFadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);">
                
                <!-- Header -->
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(59, 130, 246, 0.1); display: flex; align-items: center; justify-content: center;">
                            <span class="material-icons-round" style="color: var(--brand-blue); font-size: 1.4rem;">business</span>
                        </div>
                        <div>
                            <h2 style="margin: 0; font-size: 1.5rem; font-weight: 600; color: var(--text-primary);">Nuovo Cliente</h2>
                            <p style="margin: 0; font-size: 0.85rem; color: var(--text-tertiary);">Inserisci i dati dell'anagrafica cliente</p>
                        </div>
                    </div>
                    <button class="close-modal" id="close-new-client-modal">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>

                <!-- Form Body -->
                <div class="mobile-col-grid" style="margin-bottom: 2.5rem;">
                    
                    <!-- Left Column: Anagrafica & Contatti -->
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        <div class="form-group">
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase;">Anagrafica Base</label>
                            <div style="display: flex; flex-direction: column; gap: 1rem;">
                                <div style="position: relative;">
                                    <input type="text" id="new-cli-name" class="modal-input" placeholder="Denominazione / Ragione Sociale*" style="width: 100%; border-radius: 12px; padding: 0.75rem 1rem;">
                                </div>
                                <div style="position: relative;">
                                    <input type="text" id="new-cli-code" class="modal-input" placeholder="Codice Cliente (es: CLI-001)*" style="width: 100%; border-radius: 12px; padding: 0.75rem 1rem;">
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase;">Contatti</label>
                            <div style="display: flex; flex-direction: column; gap: 1rem;">
                                <input type="email" id="new-cli-email" class="modal-input" placeholder="Email ordinaria" style="width: 100%; border-radius: 12px; padding: 0.75rem 1rem;">
                                <input type="email" id="new-cli-pec" class="modal-input" placeholder="Email PEC" style="width: 100%; border-radius: 12px; padding: 0.75rem 1rem;">
                                <input type="tel" id="new-cli-phone" class="modal-input" placeholder="Telefono" style="width: 100%; border-radius: 12px; padding: 0.75rem 1rem;">
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: Sede & Fisco -->
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                         <div class="form-group">
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase;">Sede Legale</label>
                            <div style="display: flex; flex-direction: column; gap: 1rem;">
                                <input type="text" id="new-cli-address" class="modal-input" placeholder="Indirizzo e n. civico" style="width: 100%; border-radius: 12px; padding: 0.75rem 1rem;">
                                <div class="mobile-inline-grid">
                                    <input type="text" id="new-cli-city" class="modal-input" placeholder="Città" style="width: 100%; border-radius: 12px;">
                                    <input type="text" id="new-cli-prov" class="modal-input" placeholder="Provincia" maxlength="2" title="Sigla provincia, 2 lettere (es. GE)" style="width: 100%; border-radius: 12px; text-align: center; padding-left: 0.25rem; padding-right: 0.25rem;">
                                    <input type="text" id="new-cli-cap" class="modal-input" placeholder="CAP (5 cifre)" maxlength="5" title="Codice di Avviamento Postale" style="width: 100%; border-radius: 12px; text-align: center; padding-left: 0.25rem; padding-right: 0.25rem;">
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase;">Dati Fiscali ${glossaryTip('dati_fiscali_overview')}</label>
                            <div style="display: flex; flex-direction: column; gap: 1rem;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                                    <input type="text" id="new-cli-vat" class="modal-input" placeholder="Partita IVA" style="width: 100%; border-radius: 12px;">
                                    <input type="text" id="new-cli-fiscal" class="modal-input" placeholder="Codice Fiscale" style="width: 100%; border-radius: 12px;">
                                </div>
                                <input type="text" id="new-cli-sdi" class="modal-input" placeholder="Codice SDI (7 caratteri, oppure PEC)" maxlength="7" style="width: 100%; border-radius: 12px; padding: 0.75rem 1rem;">
                                <div style="display: flex; align-items: center; gap: 0.75rem;">
                                    <label style="font-size: 0.85rem; color: var(--text-secondary); white-space: nowrap; min-width: 130px;">Termini di pagamento</label>
                                    <select id="new-cli-payment-terms" class="modal-input" style="width: 100%; border-radius: 12px; padding: 0.75rem 1rem;">
                                        <option value="">Non definito</option>
                                        <option value="0">Immediato</option>
                                        <option value="30">30 giorni</option>
                                        <option value="60">60 giorni</option>
                                        <option value="90">90 giorni</option>
                                        <option value="120">120 giorni</option>
                                    </select>
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.75rem;">
                                    <label style="font-size: 0.85rem; color: var(--text-secondary); white-space: nowrap; min-width: 130px;">Account responsabile</label>
                                    <select id="new-cli-account" class="modal-input" style="width: 100%; border-radius: 12px; padding: 0.75rem 1rem;">
                                        <option value="">Non assegnato</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer Actions -->
                <div style="display: flex; justify-content: flex-end; gap: 1rem; padding-top: 1.5rem; border-top: 1px solid var(--glass-border);">
                    <button id="new-cli-btn-cancel" class="primary-btn secondary" style="min-width: 120px; border-radius: 12px;">Annulla</button>
                    <button id="new-cli-btn-save" class="primary-btn" style="min-width: 160px; height: 48px; border-radius: 14px; box-shadow: 0 10px 20px -5px rgba(59, 130, 246, 0.4);">
                        <span class="material-icons-round" style="font-size: 1.2rem;">save</span>
                        Salva Cliente
                    </button>
                </div>
            </div>
        </div>
    `);

    // Event Listeners
    const modal = document.getElementById('new-client-modal');
    const closeBtn = document.getElementById('close-new-client-modal');
    const cancelBtn = document.getElementById('new-cli-btn-cancel');
    const saveBtn = document.getElementById('new-cli-btn-save');

    const closeModal = () => modal.classList.remove('active');

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    saveBtn.addEventListener('click', async () => {
        const business_name = document.getElementById('new-cli-name').value.trim();
        const client_code = document.getElementById('new-cli-code').value.trim();

        if (!business_name || !client_code) {
            showGlobalAlert('Ragione Sociale e Codice Cliente sono obbligatori', 'error');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="loader" style="width:20px;height:20px;"></span> Salvataggio...';

        try {
            const clientData = {
                business_name,
                client_code,
                email: document.getElementById('new-cli-email').value.trim(),
                pec: document.getElementById('new-cli-pec').value.trim(),
                phone: document.getElementById('new-cli-phone').value.trim(),
                address: document.getElementById('new-cli-address').value.trim(),
                city: document.getElementById('new-cli-city').value.trim(),
                province: document.getElementById('new-cli-prov').value.trim().toUpperCase(),
                cap: document.getElementById('new-cli-cap').value.trim(),
                vat_number: document.getElementById('new-cli-vat').value.trim(),
                fiscal_code: document.getElementById('new-cli-fiscal').value.trim(),
                sdi_code: document.getElementById('new-cli-sdi').value.trim().toUpperCase(),
                payment_terms: document.getElementById('new-cli-payment-terms').value !== ''
                    ? parseInt(document.getElementById('new-cli-payment-terms').value, 10)
                    : null,
                account_responsible_id: document.getElementById('new-cli-account').value || null
            };

            // Add ID if editing
            if (saveBtn.dataset.clientId) {
                clientData.id = saveBtn.dataset.clientId;
            }

            const result = await upsertClient(clientData);

            await fetchClients(); // Refresh local state

            showGlobalAlert(saveBtn.dataset.clientId ? 'Cliente aggiornato!' : 'Cliente salvato con successo!', 'success');
            closeModal();

            // Refresh the current view if we are on the clients list or detail
            if (window.location.hash.includes('sales')) {
                const container = document.getElementById('content-area');
                if (container) {
                    if (window.location.hash.includes('client-detail')) {
                        renderClientDetail(container);
                    } else {
                        renderClients(container);
                    }
                }
            }
        } catch (e) {
            console.error("Error saving client:", e);
            showGlobalAlert('Errore durante il salvataggio: ' + (e.message || 'Controlla i dati'), 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<span class="material-icons-round" style="font-size: 1.2rem;">save</span> Salva Cliente';
        }
    });
}

/**
 * Open the New Client Modal (for creation or edit)
 */
window.openNewClientModal = (client = null) => {
    initNewClientModal(); // Lazy init

    const titleEl = document.querySelector('#new-client-modal h2');
    const descEl = document.querySelector('#new-client-modal p');
    const saveBtn = document.getElementById('new-cli-btn-save');

    // Popola dropdown account responsabile
    const accSelect = document.getElementById('new-cli-account');
    if (accSelect) {
        accSelect.innerHTML = '<option value="">Non assegnato</option>'
            + getAccountCollaborators().map(a => `<option value="${a.id}">${a.full_name}</option>`).join('');
    }

    if (client) {
        titleEl.textContent = 'Modifica Cliente';
        descEl.textContent = 'Aggiorna i dati dell\'anagrafica';
        saveBtn.dataset.clientId = client.id;

        // Fill fields
        document.getElementById('new-cli-name').value = client.business_name || '';
        document.getElementById('new-cli-code').value = client.client_code || '';
        document.getElementById('new-cli-email').value = client.email || '';
        document.getElementById('new-cli-pec').value = client.pec || '';
        document.getElementById('new-cli-phone').value = client.phone || '';
        document.getElementById('new-cli-address').value = client.address || '';
        document.getElementById('new-cli-city').value = client.city || '';
        document.getElementById('new-cli-prov').value = client.province || '';
        document.getElementById('new-cli-cap').value = client.cap || '';
        document.getElementById('new-cli-vat').value = client.vat_number || '';
        document.getElementById('new-cli-fiscal').value = client.fiscal_code || '';
        document.getElementById('new-cli-sdi').value = client.sdi_code || '';
        document.getElementById('new-cli-payment-terms').value = client.payment_terms != null ? String(client.payment_terms) : '';
        document.getElementById('new-cli-account').value = client.account_responsible_id || '';
    } else {
        titleEl.textContent = 'Nuovo Cliente';
        descEl.textContent = 'Inserisci i dati dell\'anagrafica cliente';
        delete saveBtn.dataset.clientId;

        // Reset fields
        document.getElementById('new-cli-name').value = '';
        document.getElementById('new-cli-code').value = '';
        document.getElementById('new-cli-email').value = '';
        document.getElementById('new-cli-pec').value = '';
        document.getElementById('new-cli-phone').value = '';
        document.getElementById('new-cli-address').value = '';
        document.getElementById('new-cli-city').value = '';
        document.getElementById('new-cli-prov').value = '';
        document.getElementById('new-cli-cap').value = '';
        document.getElementById('new-cli-vat').value = '';
        document.getElementById('new-cli-fiscal').value = '';
        document.getElementById('new-cli-sdi').value = '';
        document.getElementById('new-cli-payment-terms').value = '';
        document.getElementById('new-cli-account').value = '';
    }

    saveBtn.disabled = false;
    saveBtn.innerHTML = `<span class="material-icons-round" style="font-size: 1.2rem;">save</span> ${client ? 'Salva Modifiche' : 'Salva Cliente'}`;

    document.getElementById('new-client-modal').classList.add('active');
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab Referenti — card visiva (sostituisce la tabella, feedback Davide 14/5)
// ─────────────────────────────────────────────────────────────────────────────
function _renderContactCard(c) {
    const name = (c.full_name || 'Senza nome').replace(/</g, '&lt;');
    const role = c.role ? c.role.replace(/</g, '&lt;') : '';
    const initials = (c.full_name || '?')
        .split(' ')
        .filter(Boolean)
        .map(s => s[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    // Color hash from name → consistent avatar color per persona
    let hash = 0;
    for (let i = 0; i < (c.full_name || '').length; i++) {
        hash = c.full_name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'];
    const color = palette[Math.abs(hash) % palette.length];

    const emailSafe = c.email ? c.email.replace(/"/g, '&quot;') : '';
    const phoneSafe = c.phone ? c.phone.replace(/"/g, '&quot;') : '';

    return `
        <div style="
            background: white;
            border: 1px solid var(--glass-border);
            border-radius: 14px;
            padding: 1.1rem 1.15rem;
            display: flex;
            flex-direction: column;
            gap: 0.65rem;
            transition: all 0.2s;
        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 22px rgba(0,0,0,0.08)'; this.style.borderColor='${color}40';"
           onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'; this.style.borderColor='var(--glass-border)';">
            <!-- Top row: avatar + name + role -->
            <div style="display: flex; align-items: center; gap: 0.7rem;">
                <div style="
                    width: 42px; height: 42px; border-radius: 50%;
                    background: ${color}; color: white;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 0.95rem; font-weight: 700;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    flex-shrink: 0;
                ">${initials}</div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary); line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
                    ${role ? `<div style="font-size: 0.72rem; color: ${color}; font-weight: 600; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.04em;">${role}</div>` : '<div style="font-size: 0.72rem; color: var(--text-tertiary); font-style: italic; margin-top: 2px;">ruolo non specificato</div>'}
                </div>
            </div>

            <!-- Contact info rows -->
            ${c.email ? `
                <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.55rem; background: var(--bg-secondary); border-radius: 8px; font-size: 0.78rem;">
                    <span class="material-icons-round" style="font-size: 16px; color: ${color};">mail</span>
                    <a href="mailto:${emailSafe}" style="color: var(--text-primary); text-decoration: none; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.email}</a>
                </div>
            ` : ''}
            ${c.phone ? `
                <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.55rem; background: var(--bg-secondary); border-radius: 8px; font-size: 0.78rem;">
                    <span class="material-icons-round" style="font-size: 16px; color: ${color};">phone</span>
                    <a href="tel:${phoneSafe}" style="color: var(--text-primary); text-decoration: none; flex: 1;">${c.phone}</a>
                </div>
            ` : ''}

            <!-- Quick action bar -->
            <div style="display: flex; gap: 0.4rem; margin-top: 0.2rem;">
                ${c.email ? `
                    <a href="mailto:${emailSafe}" title="Email" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.3rem; padding: 0.4rem; background: ${color}15; color: ${color}; border-radius: 8px; text-decoration: none; font-size: 0.7rem; font-weight: 700; transition: background 0.15s;" onmouseover="this.style.background='${color}25'" onmouseout="this.style.background='${color}15'">
                        <span class="material-icons-round" style="font-size: 14px;">alternate_email</span> Email
                    </a>
                ` : ''}
                ${c.phone ? `
                    <a href="tel:${phoneSafe}" title="Chiama" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.3rem; padding: 0.4rem; background: ${color}15; color: ${color}; border-radius: 8px; text-decoration: none; font-size: 0.7rem; font-weight: 700;" onmouseover="this.style.background='${color}25'" onmouseout="this.style.background='${color}15'">
                        <span class="material-icons-round" style="font-size: 14px;">phone</span> Chiama
                    </a>
                ` : ''}
                ${c.phone ? `
                    <a href="https://wa.me/${phoneSafe.replace(/[^0-9+]/g, '').replace(/^\+/, '')}" target="_blank" title="WhatsApp" style="display: flex; align-items: center; justify-content: center; padding: 0.4rem 0.7rem; background: #25D36615; color: #25D366; border-radius: 8px; text-decoration: none; font-size: 0.7rem; font-weight: 700;" onmouseover="this.style.background='#25D36625'" onmouseout="this.style.background='#25D36615'">
                        <span class="material-icons-round" style="font-size: 14px;">chat</span>
                    </a>
                ` : ''}
            </div>
        </div>
    `;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeClientStatus — auto-classifica un cliente in 5 stati
// (mina dal giro UX Clienti 12/5/26)
// ─────────────────────────────────────────────────────────────────────────────
// Stati:
//   - lead:        nessun ordine mai
//   - potenziale:  offer in lavorazione/inviata/programmata (offerta aperta)
//   - attivo:      offerta accettata in corso O fatturato negli ultimi 12 mesi
//   - dormante:    ha avuto ordini/fatturato in passato ma niente negli ultimi 12 mesi
//   - perso:       tutti gli ordini sono rifiutati (e nessuno aperto/in corso)
//
// Logica esposta in window per debug + uso in altri file (es. Cmd+K client_summary)
export function computeClientStatus(client) {
    const clientOrders = (state.orders || []).filter(o => o.client_id === client.id);

    // Helper: data più recente di attività
    const now = new Date();
    const twelveMonthsAgo = new Date(now); twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    // Nessun ordine → Lead
    if (clientOrders.length === 0) {
        return { key: 'lead', label: 'Lead', color: '#3b82f6', emoji: '🔵' };
    }

    // Offer aperta (in lavorazione / inviata / programmata) → Potenziale
    const openOffer = clientOrders.some(o => {
        const off = (o.offer_status || '').toLowerCase();
        return ['in_lavorazione', 'invio_programmato', 'inviata'].includes(off);
    });

    // Accettata e in corso → Attivo
    const activeWork = clientOrders.some(o => {
        const off = (o.offer_status || '').toLowerCase();
        const works = (o.status_works || '').toLowerCase();
        return off === 'accettata' && !['completato', 'chiuso'].includes(works);
    });

    if (activeWork) {
        return { key: 'attivo', label: 'Attivo', color: '#10b981', emoji: '🟢' };
    }

    // Fatturato negli ultimi 12 mesi → Attivo (anche se non c'è work in corso)
    const recentInvoices = (state.invoices || []).some(i => {
        if (i.client_id !== client.id) return false;
        if (!i.issue_date) return false;
        return new Date(i.issue_date) >= twelveMonthsAgo;
    });
    if (recentInvoices) {
        return { key: 'attivo', label: 'Attivo', color: '#10b981', emoji: '🟢' };
    }

    if (openOffer) {
        return { key: 'potenziale', label: 'Potenziale', color: '#f59e0b', emoji: '🟡' };
    }

    // Da qui in giù: non ha offerte aperte, non ha activeWork, non ha fatturato recente
    // Controlliamo se ha avuto qualcosa in passato (orders accepted o invoices)
    const hasHistory = clientOrders.some(o => {
        const off = (o.offer_status || '').toLowerCase();
        return ['accettata', 'completato'].includes(off);
    }) || (state.invoices || []).some(i => i.client_id === client.id);

    if (hasHistory) {
        return { key: 'dormante', label: 'Dormante', color: '#94a3b8', emoji: '⚪' };
    }

    // Tutti gli ordini rifiutati → Perso
    const allRefused = clientOrders.every(o => (o.offer_status || '').toLowerCase() === 'rifiutata');
    if (allRefused) {
        return { key: 'perso', label: 'Perso', color: '#ef4444', emoji: '🔴' };
    }

    // Fallback: nessuna categoria chiara → Lead
    return { key: 'lead', label: 'Lead', color: '#3b82f6', emoji: '🔵' };
}

if (typeof window !== 'undefined') {
    window.computeClientStatus = computeClientStatus;
    window.getAccountCollaborators = getAccountCollaborators;
    window.findAccountResponsible = findAccountResponsible;
    window.computeClientCreditRisk = computeClientCreditRisk;
}

// ── Inline picker per assegnare/cambiare l'account responsabile ──────────────
async function openClientAccountPicker(clientId) {
    const client = (state.clients || []).find(c => c.id === clientId);
    if (!client) return;

    const accounts = getAccountCollaborators();
    if (accounts.length === 0) {
        showGlobalAlert('Nessun collaboratore ha il tag "Account". Aggiungilo prima dal modulo Collaboratori.', 'error');
        return;
    }

    const existing = document.getElementById('client-account-picker-modal');
    if (existing) existing.remove();

    const currentId = client.account_responsible_id || '';
    document.body.insertAdjacentHTML('beforeend', `
        <div id="client-account-picker-modal" class="modal active" style="z-index: 10000;">
            <div class="modal-content glass-card" style="max-width: 480px; width: 100%; padding: 1.75rem;">
                <div style="display:flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <div>
                        <h2 style="margin: 0 0 0.25rem; font-size: 1.25rem;">Account responsabile</h2>
                        <p style="margin: 0; color: var(--text-secondary); font-size: 0.85rem;">${client.business_name}</p>
                    </div>
                    <button class="icon-btn" onclick="document.getElementById('client-account-picker-modal').remove()">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 320px; overflow-y: auto; margin-bottom: 1rem;">
                    <button class="cap-option" data-acc-id="" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border: 1px solid ${!currentId ? 'var(--brand-blue)' : 'var(--glass-border)'}; background: ${!currentId ? 'rgba(59,130,246,0.08)' : 'white'}; border-radius: 10px; cursor: pointer; text-align: left;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(148,163,184,0.15); color: #94a3b8; display:flex; align-items:center; justify-content:center;">
                            <span class="material-icons-round">person_off</span>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: var(--text-primary);">Nessuno</div>
                            <div style="font-size: 0.78rem; color: var(--text-tertiary);">Cliente non assegnato</div>
                        </div>
                    </button>
                    ${accounts.map(acc => {
                        const color = _accountColor(acc.id);
                        const selected = acc.id === currentId;
                        return `
                            <button class="cap-option" data-acc-id="${acc.id}" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border: 1px solid ${selected ? 'var(--brand-blue)' : 'var(--glass-border)'}; background: ${selected ? 'rgba(59,130,246,0.08)' : 'white'}; border-radius: 10px; cursor: pointer; text-align: left;">
                                <div style="width: 36px; height: 36px; border-radius: 50%; background: ${color}22; color: ${color}; display:flex; align-items:center; justify-content:center; font-weight: 700; font-size: 0.85rem; border: 1px solid ${color}55;">${_accountInitials(acc.full_name)}</div>
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-weight: 600; color: var(--text-primary);">${acc.full_name}</div>
                                    <div style="font-size: 0.78rem; color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${acc.email || '-'}</div>
                                </div>
                                ${selected ? '<span class="material-icons-round" style="color: var(--brand-blue);">check_circle</span>' : ''}
                            </button>`;
                    }).join('')}
                </div>
                <div style="display:flex; justify-content: flex-end; gap: 0.5rem;">
                    <button class="primary-btn secondary" onclick="document.getElementById('client-account-picker-modal').remove()">Annulla</button>
                </div>
            </div>
        </div>
    `);

    document.querySelectorAll('#client-account-picker-modal .cap-option').forEach(btn => {
        btn.addEventListener('click', async () => {
            const accId = btn.getAttribute('data-acc-id') || null;
            btn.disabled = true;
            try {
                await upsertClient({ id: client.id, account_responsible_id: accId });
                await fetchClients(true);
                document.getElementById('client-account-picker-modal')?.remove();
                showGlobalAlert(accId ? 'Account responsabile aggiornato' : 'Account responsabile rimosso', 'success');
                // Re-render detail se siamo lì
                const contentArea = document.getElementById('content-area');
                if (contentArea && location.hash.startsWith('#client-detail/')) {
                    const updated = (state.clients || []).find(c => c.id === client.id);
                    if (updated) renderClientDetail(contentArea);
                }
            } catch (err) {
                console.error('Account picker save failed:', err);
                showGlobalAlert('Errore nel salvataggio', 'error');
                btn.disabled = false;
            }
        });
    });
}

if (typeof window !== 'undefined') {
    window.openClientAccountPicker = openClientAccountPicker;
}
