import { state } from '../modules/state.js?v=119';
import { formatAmount } from '../modules/utils.js?v=119';

export const DashboardData = {
    getStats: (year, passiveFilter = 'all') => {
        let activeTotal = 0;
        let activeIncassato = 0;
        let passiveTotal = 0;
        let passivePagato = 0;

        state.invoices.filter(inv => {
            const invYear = inv.invoice_date ? new Date(inv.invoice_date).getFullYear() : null;
            return invYear === year && inv.status !== 'Annullata';
        }).forEach(inv => {
            activeTotal += parseFloat(inv.amount_tax_excluded) || 0;
            if (inv.status === 'Saldata') {
                activeIncassato += parseFloat(inv.amount_tax_excluded) || 0;
            } else if (inv.amount_paid) {
                const ratio = (parseFloat(inv.amount_tax_included) || 1) !== 0 ? (parseFloat(inv.amount_tax_excluded) || 0) / (parseFloat(inv.amount_tax_included) || 1) : 1;
                activeIncassato += (parseFloat(inv.amount_paid) || 0) * ratio;
            }
        });

        state.passiveInvoices.filter(inv => {
            const invYear = inv.issue_date ? new Date(inv.issue_date).getFullYear() : null;
            const isCollaborator = inv.collaborator_id !== null;
            const isSupplier = inv.supplier_id !== null;

            let filterMatch = true;
            if (passiveFilter === 'collaborators') filterMatch = isCollaborator;
            else if (passiveFilter === 'suppliers') filterMatch = isSupplier;

            return invYear === year && inv.status !== 'Annullato' && filterMatch;
        }).forEach(inv => {
            passiveTotal += parseFloat(inv.amount_tax_excluded) || 0;
            if (inv.status === 'Pagato') {
                passivePagato += parseFloat(inv.amount_tax_excluded) || 0;
            } else if (inv.amount_paid) {
                const ratio = (parseFloat(inv.amount_tax_included) || 1) !== 0 ? (parseFloat(inv.amount_tax_excluded) || 0) / (parseFloat(inv.amount_tax_included) || 1) : 1;
                passivePagato += (parseFloat(inv.amount_paid) || 0) * ratio;
            }
        });

        return { activeTotal, activeIncassato, passiveTotal, passivePagato };
    },

    getMonthlyTrend: (year, type, passiveFilter = 'all') => {
        const monthlyData = Array(12).fill(0).map(() => ({ total: 0, collected: 0 }));

        if (type === 'active') {
            state.invoices.filter(inv => {
                const invDate = inv.invoice_date ? new Date(inv.invoice_date) : null;
                return invDate && invDate.getFullYear() === year && inv.status !== 'Annullata';
            }).forEach(inv => {
                const month = new Date(inv.invoice_date).getMonth();
                monthlyData[month].total += parseFloat(inv.amount_tax_excluded) || 0;

                if (inv.status === 'Saldata') {
                    monthlyData[month].collected += parseFloat(inv.amount_tax_excluded) || 0;
                } else if (inv.amount_paid) {
                    const ratio = (parseFloat(inv.amount_tax_included) || 1) !== 0 ? (parseFloat(inv.amount_tax_excluded) || 0) / (parseFloat(inv.amount_tax_included) || 1) : 1;
                    monthlyData[month].collected += (parseFloat(inv.amount_paid) || 0) * ratio;
                }
            });
        } else { // passive
            state.passiveInvoices.filter(inv => {
                const invDate = inv.issue_date ? new Date(inv.issue_date) : null;
                const isCollaborator = inv.collaborator_id !== null;
                const isSupplier = inv.supplier_id !== null;

                let filterMatch = true;
                if (passiveFilter === 'collaborators') filterMatch = isCollaborator;
                else if (passiveFilter === 'suppliers') filterMatch = isSupplier;

                return invDate && invDate.getFullYear() === year && inv.status !== 'Annullato' && filterMatch;
            }).forEach(inv => {
                const month = new Date(inv.issue_date).getMonth();
                monthlyData[month].total += parseFloat(inv.amount_tax_excluded) || 0;

                if (inv.status === 'Pagato') {
                    monthlyData[month].collected += parseFloat(inv.amount_tax_excluded) || 0;
                } else if (inv.amount_paid) {
                    const ratio = (parseFloat(inv.amount_tax_included) || 1) !== 0 ? (parseFloat(inv.amount_tax_excluded) || 0) / (parseFloat(inv.amount_tax_included) || 1) : 1;
                    monthlyData[month].collected += (parseFloat(inv.amount_paid) || 0) * ratio;
                }
            });
        }
        return monthlyData;
    },

    getQuarterlyTrend: (year, type, passiveFilter = 'all') => {
        const quarterlyData = Array(4).fill(0).map(() => ({ total: 0, collected: 0 }));
        const monthly = DashboardData.getMonthlyTrend(year, type, passiveFilter);

        monthly.forEach((data, index) => {
            const quarter = Math.floor(index / 3);
            quarterlyData[quarter].total += data.total;
            quarterlyData[quarter].collected += data.collected;
        });
        return quarterlyData;
    },

    getInvoicesByStatus: (type, year, filterType, passiveFilter = 'all') => {
        let invoices = [];
        if (type === 'active') {
            invoices = state.invoices.filter(inv => {
                const invYear = inv.invoice_date ? new Date(inv.invoice_date).getFullYear() : null;
                return invYear === year && inv.status !== 'Annullata';
            });
            if (filterType === 'collected') {
                return invoices.filter(inv => inv.status === 'Saldata' || (inv.amount_paid && inv.amount_paid > 0));
            } else if (filterType === 'pending') {
                return invoices.filter(inv => inv.status !== 'Saldata' && inv.status !== 'Annullata');
            }
        } else { // passive
            invoices = state.passiveInvoices.filter(inv => {
                const invYear = inv.issue_date ? new Date(inv.issue_date).getFullYear() : null;
                const isCollaborator = inv.collaborator_id !== null;
                const isSupplier = inv.supplier_id !== null;

                let filterMatch = true;
                if (passiveFilter === 'collaborators') filterMatch = isCollaborator;
                else if (passiveFilter === 'suppliers') filterMatch = isSupplier;

                return invYear === year && inv.status !== 'Annullato' && filterMatch;
            });
            if (filterType === 'collected') {
                return invoices.filter(inv => inv.status === 'Pagato' || (inv.amount_paid && inv.amount_paid > 0));
            } else if (filterType === 'pending') {
                return invoices.filter(inv => inv.status !== 'Pagato' && inv.status !== 'Annullato');
            }
        }
        return invoices;
    },

    getMultiYearTrend: () => {
        const years = new Set();
        state.invoices.forEach(inv => { if (inv.invoice_date) years.add(new Date(inv.invoice_date).getFullYear()); });
        state.passiveInvoices.forEach(inv => { if (inv.issue_date) years.add(new Date(inv.issue_date).getFullYear()); });
        const sortedYears = Array.from(years).sort((a, b) => a - b).slice(-5);
        return sortedYears.map(year => {
            const activeInv = state.invoices.filter(inv => new Date(inv.invoice_date).getFullYear() === year && inv.status !== 'Annullata');
            const passiveInv = state.passiveInvoices.filter(inv => new Date(inv.issue_date).getFullYear() === year && inv.status !== 'Annullato');

            const activeTotal = activeInv.reduce((sum, inv) => sum + (parseFloat(inv.amount_tax_excluded) || 0), 0);
            const passiveTotal = passiveInv.reduce((sum, inv) => sum + (parseFloat(inv.amount_tax_excluded) || 0), 0);

            const activeQuarters = DashboardData.getQuarterlyTrend(year, 'active');
            const passiveQuarters = DashboardData.getQuarterlyTrend(year, 'passive');

            return { year, active: activeTotal, passive: passiveTotal, activeQuarters, passiveQuarters };
        });
    },

    getCustomerBreakdown: (year) => {
        const breakdown = {};
        state.invoices.filter(inv => {
            const invYear = inv.invoice_date ? new Date(inv.invoice_date).getFullYear() : null;
            return invYear === year && inv.status !== 'Annullata';
        }).forEach(inv => {
            const name = inv.clients?.business_name || 'Altro';
            breakdown[name] = (breakdown[name] || 0) + (parseFloat(inv.amount_tax_excluded) || 0);
        });
        return Object.entries(breakdown).sort((a, b) => b[1] - a[1]).slice(0, 10);
    },

    getPassiveBreakdown: (year, passiveFilter = 'all') => {
        let passiveBase = state.passiveInvoices;
        if (passiveFilter === 'collaborators') {
            passiveBase = passiveBase.filter(i => i.collaborator_id !== null);
            const breakdown = {};
            passiveBase.filter(inv => {
                const invYear = inv.issue_date ? new Date(inv.issue_date).getFullYear() : null;
                return invYear === year && inv.status !== 'Annullato';
            }).forEach(inv => {
                const name = inv.collaborators?.full_name || 'Altro';
                breakdown[name] = (breakdown[name] || 0) + (parseFloat(inv.amount_tax_excluded) || 0);
            });
            return Object.entries(breakdown).sort((a, b) => b[1] - a[1]).slice(0, 10);
        } else if (passiveFilter === 'suppliers') {
            passiveBase = passiveBase.filter(i => i.supplier_id !== null);
            const breakdown = {};
            passiveBase.filter(inv => {
                const invYear = inv.issue_date ? new Date(inv.issue_date).getFullYear() : null;
                return invYear === year && inv.status !== 'Annullato';
            }).forEach(inv => {
                const name = inv.suppliers?.name || 'Altro';
                breakdown[name] = (breakdown[name] || 0) + (parseFloat(inv.amount_tax_excluded) || 0);
            });
            return Object.entries(breakdown).sort((a, b) => b[1] - a[1]).slice(0, 10);
        } else {
            const breakdown = { 'Collaboratori': 0, 'Fornitori': 0 };
            passiveBase.filter(inv => {
                const invYear = inv.issue_date ? new Date(inv.issue_date).getFullYear() : null;
                return invYear === year && inv.status !== 'Annullato';
            }).forEach(inv => {
                if (inv.collaborator_id) breakdown['Collaboratori'] += (parseFloat(inv.amount_tax_excluded) || 0);
                else breakdown['Fornitori'] += (parseFloat(inv.amount_tax_excluded) || 0);
            });
            return Object.entries(breakdown);
        }
    }
};

export function renderDashboard(container) {
    let currentFilter = null;

    const funnelStates = [
        { key: 'In Lavorazione', label: 'In Lavorazione', icon: 'pending_actions', color: '#e3f2fd', textColor: '#1976d2' },
        { key: 'In Attesa Di Risposta', label: 'In Attesa Di Risposta', icon: 'hourglass_empty', color: '#e1f5fe', textColor: '#0288d1' },
        { key: 'Invio Progammato', label: 'Invio Programmato', icon: 'schedule', color: '#e0f2f1', textColor: '#00796b' },
        { key: 'Offerta Accettata', label: 'Offerta Accettata', icon: 'check_circle', color: '#e8f5e9', textColor: '#388e3c' },
        { key: 'Offerta Rifiutata', label: 'Offerta Rifiutata', icon: 'cancel', color: '#fce4ec', textColor: '#c2185b' }
    ];

    const stats = funnelStates.map(stateInfo => {
        const filteredOrders = state.orders.filter(o =>
            o.offer_status?.toLowerCase() === stateInfo.key.toLowerCase()
        );
        const count = filteredOrders.length;
        const totalValue = filteredOrders.reduce((sum, o) => {
            const val = parseFloat(o.price_planned) || parseFloat(o.price_actual) || parseFloat(o.total_price) || parseFloat(o.price_final) || 0;
            return sum + val;
        }, 0);
        return { ...stateInfo, count, totalValue };
    });

    const renderTableRows = (filteredOrders) => {
        if (filteredOrders.length === 0) {
            return '<tr><td colspan="6" style="text-align:center; padding: 4rem; opacity: 0.5;">Nessun ordine trovato per questa categoria.</td></tr>';
        }

        return filteredOrders.map(order => {
            const displayPrice = parseFloat(order.price_actual) || parseFloat(order.price_planned) || parseFloat(order.total_price) || parseFloat(order.price_final) || 0;
            const displayCost = parseFloat(order.cost_actual) || parseFloat(order.cost_planned) || parseFloat(order.cost_final) || 0;
            const displayRevenue = parseFloat(order.revenue_actual) || parseFloat(order.revenue_planned) || (displayPrice - displayCost);

            return `
                <tr class="clickable-row" data-id="${order.id}" style="transition: all 0.2s ease; border-bottom: 1px solid var(--glass-border);">
                    <td style="padding: 1rem 1.5rem; font-weight: 600; font-size: 0.85rem; color: var(--text-primary); white-space: nowrap;">${order.order_number}</td>
                    <td style="padding: 1rem 1.5rem;">
                        <div style="font-weight: 500; font-size: 0.9rem; color: var(--text-primary); margin-bottom: 0.25rem;">${order.title || 'N/D'}</div>
                        <div style="font-size: 0.7rem; color: var(--text-tertiary); font-weight: 400;">${order.offer_status || (order.status_works ? 'Lavori: ' + order.status_works : '-')}</div>
                    </td>
                    <td style="padding: 1rem 1.5rem; font-size: 0.85rem; color: var(--text-secondary); font-weight: 400;">${order.clients?.business_name || 'N/D'}</td>
                    <td style="padding: 1rem 1.5rem; text-align: right; font-weight: 600; font-size: 0.85rem; white-space: nowrap; font-variant-numeric: tabular-nums;">€ ${formatAmount(displayPrice)}</td>
                    <td style="padding: 1rem 1.5rem; text-align: right; font-weight: 600; font-size: 0.85rem; color: var(--text-secondary); white-space: nowrap; font-variant-numeric: tabular-nums;">€ ${formatAmount(displayCost)}</td>
                    <td style="padding: 1rem 1.5rem; text-align: right; font-weight: 700; font-size: 0.85rem; color: var(--brand-viola); white-space: nowrap; font-variant-numeric: tabular-nums;">€ ${formatAmount(displayRevenue)}</td>
                </tr>
            `;
        }).join('');
    };

    const statsHTML = stats.map(stat => `
        <div class="glass-card funnel-card" data-status="${stat.key}" style="
            padding: 1.5rem;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border-left: 4px solid ${stat.textColor};
            position: relative;
            overflow: hidden;
        ">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                <div style="flex: 1;">
                    <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); font-weight: 600; margin-bottom: 0.5rem;">${stat.label}</div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--text-primary); line-height: 1; font-family: var(--font-titles);">${stat.count}</div>
                </div>
                <div style="
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    background: ${stat.color};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 12px ${stat.textColor}20;
                ">
                    <span class="material-icons-round" style="color: ${stat.textColor}; font-size: 24px;">${stat.icon}</span>
                </div>
            </div>
            <div style="
                font-size: 0.85rem;
                font-weight: 600;
                color: ${stat.textColor};
                display: flex;
                align-items: center;
                gap: 0.25rem;
                font-variant-numeric: tabular-nums;
            ">
                <span style="opacity: 0.7;">€</span>
                <span>${formatAmount(stat.totalValue)}</span>
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div style="max-width: 1400px; margin: 0 auto; padding: 0 1.5rem 3rem;">
            <div style="margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <h2 style="font-size: 1.5rem; font-weight: 700; margin: 0; font-family: var(--font-titles); color: var(--text-primary);">Funnel Commerciale</h2>
                    <span id="active-filter-badge" style="display: none; font-size: 0.7rem; background: var(--brand-viola); color: white; padding: 4px 10px; border-radius: 12px; font-weight: 600;">Filtro Attivo</span>
                </div>
                <span style="font-size: 0.75rem; font-weight: 400; color: var(--text-tertiary);">Clicca su una card per filtrare</span>
            </div>
            
            <div id="funnel-container" style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: 1.25rem;
                margin-bottom: 2.5rem;
            ">
                ${statsHTML}
            </div>

            <div class="glass-card" style="padding: 0; overflow: hidden;">
                <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--glass-border); background: var(--bg-secondary); display: flex; justify-content: space-between; align-items: center;">
                    <h3 id="table-title" style="margin: 0; font-size: 1.1rem; font-weight: 700; font-family: var(--font-titles); color: var(--text-primary);">Elenco Ordini e Offerte</h3>
                    <button id="reset-filter" style="display: none; border: none; background: none; color: var(--brand-viola); font-size: 0.8rem; font-weight: 600; cursor: pointer; padding: 0.5rem 1rem; border-radius: 8px; transition: all 0.2s;">Mostra Tutti</button>
                </div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: var(--bg-tertiary);">
                                <th style="text-align: left; padding: 1rem 1.5rem; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); white-space: nowrap; width: 100px;">N. Ordine</th>
                                <th style="text-align: left; padding: 1rem 1.5rem; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary);">Titolo / Stato</th>
                                <th style="text-align: left; padding: 1rem 1.5rem; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); min-width: 180px;">Cliente</th>
                                <th style="text-align: right; padding: 1rem 1.5rem; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); white-space: nowrap; width: 110px;">Prezzo</th>
                                <th style="text-align: right; padding: 1rem 1.5rem; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); white-space: nowrap; width: 110px;">Costi</th>
                                <th style="text-align: right; padding: 1rem 1.5rem; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); white-space: nowrap; width: 110px;">Ricavo</th>
                            </tr>
                        </thead>
                        <tbody id="orders-table-body" style="background: white;">
                            ${renderTableRows([...state.orders].sort((a, b) => (b.order_number || "").localeCompare(a.order_number || "")))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    const tableBody = container.querySelector('#orders-table-body');
    const tableTitle = container.querySelector('#table-title');
    const resetBtn = container.querySelector('#reset-filter');
    const filterBadge = container.querySelector('#active-filter-badge');
    const cards = container.querySelectorAll('.funnel-card');

    const updateView = (filter) => {
        currentFilter = filter;

        // Update Table
        const filtered = filter
            ? state.orders.filter(o => o.offer_status?.toLowerCase() === filter.toLowerCase())
            : state.orders;

        const sorted = [...filtered].sort((a, b) => (b.order_number || "").localeCompare(a.order_number || ""));
        tableBody.innerHTML = renderTableRows(sorted);
        tableTitle.textContent = filter ? `Ordini: ${filter}` : 'Elenco Ordini e Offerte';
        resetBtn.style.display = filter ? 'block' : 'none';
        filterBadge.style.display = filter ? 'block' : 'none';

        // Add event listeners to new rows
        tableBody.querySelectorAll('.clickable-row').forEach(row => {
            row.addEventListener('click', () => {
                if (row.dataset.id) window.location.hash = `order-detail/${row.dataset.id}`;
            });
            // Add hover effect
            row.addEventListener('mouseenter', () => {
                row.style.background = 'var(--bg-secondary)';
                row.style.cursor = 'pointer';
            });
            row.addEventListener('mouseleave', () => {
                row.style.background = 'white';
            });
        });

        // Update Cards UI
        cards.forEach(card => {
            if (filter && card.dataset.status === filter) {
                card.style.transform = 'translateY(-4px) scale(1.02)';
                card.style.boxShadow = '0 12px 24px rgba(0,0,0,0.12)';
            } else {
                card.style.transform = 'none';
                card.style.boxShadow = '';
            }
        });
    };

    // Initial event listeners for rows
    tableBody.querySelectorAll('.clickable-row').forEach(row => {
        row.addEventListener('click', () => {
            if (row.dataset.id) window.location.hash = `order-detail/${row.dataset.id}`;
        });
        // Add hover effect
        row.addEventListener('mouseenter', () => {
            row.style.background = 'var(--bg-secondary)';
            row.style.cursor = 'pointer';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = 'white';
        });
    });

    // Card hover effects
    cards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            if (currentFilter !== card.dataset.status) {
                card.style.transform = 'translateY(-2px)';
                card.style.boxShadow = '0 8px 16px rgba(0,0,0,0.08)';
            }
        });
        card.addEventListener('mouseleave', () => {
            if (currentFilter !== card.dataset.status) {
                card.style.transform = 'none';
                card.style.boxShadow = '';
            }
        });
        card.addEventListener('click', () => {
            const status = card.dataset.status;
            if (currentFilter === status) {
                updateView(null);
            } else {
                updateView(status);
            }
        });
    });

    // Reset filter button hover
    resetBtn.addEventListener('mouseenter', () => {
        resetBtn.style.background = 'rgba(139, 92, 246, 0.1)';
    });
    resetBtn.addEventListener('mouseleave', () => {
        resetBtn.style.background = 'none';
    });

    resetBtn.addEventListener('click', () => updateView(null));
}

export function renderInvoicesDashboard(container) {
    const activeStats = DashboardData.getStats(state.dashboardYear, 'all');
    const passiveStats = DashboardData.getStats(state.dashboardYear, state.dashboardPassiveFilter || 'all');

    container.innerHTML = `
        <div class="animate-fade-in dashboard-container">
            <div class="dashboard-stats-grid">
                <div class="stats-card">
                    <div class="stats-header"><span>Fatturato Attivo (${state.dashboardYear})</span></div>
                    <div class="stats-value">€ ${formatAmount(activeStats.activeTotal)}</div>
                    <div class="stats-trend trend-up">Incassato: € ${formatAmount(activeStats.activeIncassato)}</div>
                </div>
                <div class="stats-card">
                    <div class="stats-header"><span>Fatturato Passivo (${state.dashboardYear})</span></div>
                    <div class="stats-value">€ ${formatAmount(activeStats.passiveTotal)}</div>
                    <div class="stats-trend trend-down">Pagato: € ${formatAmount(activeStats.passivePagato)}</div>
                </div>
            </div>
            <div style="padding:2rem; text-align:center; opacity:0.6;">Grafici di dettaglio in caricamento...</div>
        </div>
     `;
}
