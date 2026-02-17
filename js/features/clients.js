import { state } from '/js/modules/state.js';
import { formatAmount } from '../modules/utils.js?v=317';
// Import dependencies similar to collaborators.js
// We assume fetch functions are available in api.js if needed, but we rely on state mostly
import { fetchOrders, fetchInvoices, fetchPayments, upsertClient, fetchClients } from '../modules/api.js';
import { showGlobalAlert } from '../modules/utils.js?v=317';

export async function renderClients(container) {
    // Ensure we have orders for analytics
    const { fetchOrders } = await import('../modules/api.js');
    if (!state.orders || state.orders.length === 0) {
        await fetchOrders();
    }

    const filteredClients = state.clients.filter(c =>
        (c.business_name || '').toLowerCase().includes(state.searchTerm.toLowerCase()) ||
        (c.client_code || '').toLowerCase().includes(state.searchTerm.toLowerCase()) ||
        (c.city || '').toLowerCase().includes(state.searchTerm.toLowerCase())
    );

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
            const isOffer = (o.offer_status === 'Offerta' || o.status === 'Offerta');
            const isRefused = (o.offer_status === 'Rifiutata' || o.status === 'Rifiutata' || o.offer_status === 'Persa');
            const isAccepted = (o.offer_status === 'Accettata' || o.offer_status === 'Offerta Accettata');
            const isWorking = o.status_works !== 'Completato' && o.status_works !== 'Chiuso';

            if ((isOffer && !isRefused) || (isAccepted && isWorking)) {
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

            // Case 1: Pending Offer (neither accepted nor rejected)
            const isOffer = (o.offer_status === 'Offerta' || o.status === 'Offerta');
            const isRefused = (o.offer_status === 'Rifiutata' || o.status === 'Rifiutata' || o.offer_status === 'Persa');
            if (isOffer && !isRefused) return true;

            // Case 2: Accepted Offer but work is not completed
            const isAccepted = (o.offer_status === 'Accettata' || o.offer_status === 'Offerta Accettata');
            const isWorking = o.status_works !== 'Completato' && o.status_works !== 'Chiuso';
            if (isAccepted && isWorking) return true;

            return false;
        });
    };

    const clientsHTML = filteredClients.length > 0 ? filteredClients.map(client => {
        const isActive = getActiveStatus(client);

        return `
            <div class="v7-rubrica-item animate-fade-in" onclick="window.location.hash='client-detail/${client.id}'">
                <div class="v7-item-main">
                    <div class="v7-id-row">
                        <span class="v7-id">${client.client_code || '---'}</span>
                        ${isActive ? '<span class="v7-active-dot"></span>' : ''}
                    </div>
                    <div class="v7-name">${client.business_name}</div>
                    <div class="v7-city-mini">${client.city || '-'}</div>
                </div>
                <div class="v7-item-contacts">
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

    // Filter Data
    const clientOrders = state.orders ? state.orders.filter(o => o.client_id === client.id) : [];
    const clientInvoices = state.invoices ? state.invoices.filter(i => i.client_id === client.id) : []; // Active invoices
    const clientPayments = state.payments ? state.payments.filter(p => p.payment_type === 'Cliente' && p.client_id === client.id) : [];

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
                            <h1 style="margin: 0 0 0.5rem 0; font-size: 2.2rem; letter-spacing: -0.5px; color: var(--text-primary);">${client.business_name}</h1>
                            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; margin-bottom: 1rem;">
                                <span style="font-size: 1rem; color: var(--brand-blue); font-weight: 400;">Cliente</span>
                                <div style="width: 4px; height: 4px; border-radius: 50%; background: var(--text-tertiary);"></div>
                                <span style="font-size: 0.85rem; color: var(--text-secondary); background: var(--bg-secondary); padding: 2px 10px; border-radius: 12px;">${client.city ? `${client.city}${client.province ? ` (${client.province})` : ''}` : 'N/A'}</span>
                            </div>
                        </div>
                        
                        <button class="icon-btn" style="background: var(--bg-secondary); width: 42px; height: 42px;" onclick='window.openNewClientModal(${JSON.stringify(client).replace(/'/g, "&apos;")})' title="Modifica">
                            <span class="material-icons-round" style="color: var(--text-primary);">edit</span>
                        </button>
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
                    </div>
                </div>
            </div>

            <!-- Tabs Controls -->
            <div class="tabs-container" style="margin-bottom: 1.5rem; border-bottom: 1px solid var(--glass-border); display: flex; gap: 1.5rem;">
                <button class="tab-btn active" data-tab="overview" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 2px solid var(--brand-blue); color: var(--brand-blue); font-weight: 400; cursor: pointer;">Panoramica</button>
                <button class="tab-btn" data-tab="orders" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer;">Commesse (${clientOrders.length})</button>
                <button class="tab-btn" data-tab="invoices" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer;">Fatture (${clientInvoices.length})</button>
                <button class="tab-btn" data-tab="payments" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer;">Pagamenti (${clientPayments.length})</button>
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

            <!-- Tab Content: Orders -->
            <div id="tab-orders" class="tab-content hidden">
                 <div class="table-container">
                    <table>
                        <thead><tr><th>N. Ordine</th><th>Data</th><th>Titolo</th><th>Stato</th></tr></thead>
                        <tbody>
                            ${clientOrders.length ? clientOrders.map(o => `
                                 <tr onclick="window.location.hash='order-detail/${o.id}'" style="cursor:pointer; transition: background 0.15s;" class="hover-row">
                                     <td>${o.order_number}</td>
                                     <td>${new Date(o.order_date).toLocaleDateString()}</td>
                                     <td>${o.title}</td>
                                     <td><span class="status-badge">${o.status_works || 'In corso'}</span></td>
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
                                     <td>${new Date(i.issue_date).toLocaleDateString()}</td>
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
                                    <td style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${new Date(p.due_date).toLocaleDateString()}</td>
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
            document.getElementById(targetId).classList.remove('hidden');
        });
    });
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
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2.5rem;">
                    
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
                                <div style="display: grid; grid-template-columns: 1fr 70px 100px; gap: 0.75rem;">
                                    <input type="text" id="new-cli-city" class="modal-input" placeholder="Città" style="width: 100%; border-radius: 12px;">
                                    <input type="text" id="new-cli-prov" class="modal-input" placeholder="PR" maxlength="2" style="width: 100%; border-radius: 12px; text-align: center; padding-left: 0.25rem; padding-right: 0.25rem;">
                                    <input type="text" id="new-cli-cap" class="modal-input" placeholder="CAP" maxlength="5" style="width: 100%; border-radius: 12px; text-align: center; padding-left: 0.25rem; padding-right: 0.25rem;">
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase;">Dati Fiscali</label>
                            <div style="display: flex; flex-direction: column; gap: 1rem;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                                    <input type="text" id="new-cli-vat" class="modal-input" placeholder="Partita IVA" style="width: 100%; border-radius: 12px;">
                                    <input type="text" id="new-cli-fiscal" class="modal-input" placeholder="Codice Fiscale" style="width: 100%; border-radius: 12px;">
                                </div>
                                <input type="text" id="new-cli-sdi" class="modal-input" placeholder="Codice SDI (7 caratteri)" maxlength="7" style="width: 100%; border-radius: 12px; padding: 0.75rem 1rem;">
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
                sdi_code: document.getElementById('new-cli-sdi').value.trim().toUpperCase()
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
    }

    saveBtn.disabled = false;
    saveBtn.innerHTML = `<span class="material-icons-round" style="font-size: 1.2rem;">save</span> ${client ? 'Salva Modifiche' : 'Salva Cliente'}`;

    document.getElementById('new-client-modal').classList.add('active');
};
