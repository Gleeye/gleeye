import { state } from '/js/modules/state.js';
import { formatAmount, renderModal, closeModal } from '../modules/utils.js?v=1000';
import { initNewOrderModal } from './orders.js?v=1000';

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
    const renderContent = () => {
        let currentFunnelFilter = null;
        let currentYearFilter = null;
        let currentClientFilter = null;
        let currentStatusFilter = null;
        let activeRole = state.impersonatedRole || state.profile?.role;
        let myCollabId = state.impersonatedCollaboratorId || state.profile?.collaborator_id;
        let tagsToUse = state.profile?.tags || [];

        if (state.impersonatedRole === 'collaborator' && state.impersonatedCollaboratorId) {
            const c = state.collaborators?.find(x => x.id == state.impersonatedCollaboratorId);
            if (c) {
                let tags = c.tags;
                if (typeof tags === 'string') {
                    try { tags = JSON.parse(tags); } catch (e) { tags = tags.split(',').map(t => t.trim()); }
                }
                tagsToUse = Array.isArray(tags) ? tags : [];
            }
        }

        const userTags = tagsToUse.map(t => typeof t === 'string' ? t.trim().toLowerCase() : '');
        const isPrivileged = userTags.some(t => t === 'partner' || t === 'amministrazione');
        let baseOrders = state.orders;
        if (!isPrivileged && activeRole !== 'admin') {
            baseOrders = state.orders.filter(o => {
                return o.order_collaborators?.some(oc =>
                    (oc.collaborator_id == myCollabId || oc.collaborators?.id == myCollabId)
                );
            });
            console.log(`[Dashboard] Non-privileged Filter applied: orders=${baseOrders.length}/${state.orders.length}`);
        }

        // Commercial Funnel - only first 3 stages
        const funnelStates = [
            { key: 'In Lavorazione', label: 'In Lavorazione', icon: 'pending_actions', color: '#e3f2fd', textColor: '#1976d2' },
            { key: 'Invio Programmato', label: 'Invio Programmato', icon: 'schedule', color: '#e0f2f1', textColor: '#00796b' },
            { key: 'In Attesa Di Risposta', label: 'In Attesa Di Risposta', icon: 'hourglass_empty', color: '#e1f5fe', textColor: '#0288d1' }
        ];

        // Process funnel stats
        const funnelStats = funnelStates.map(stateInfo => {
            const filteredOrders = baseOrders.filter(o =>
                o.offer_status?.toLowerCase() === stateInfo.key.toLowerCase()
            );
            const count = filteredOrders.length;
            const totalValue = filteredOrders.reduce((sum, o) => {
                const val = parseFloat(o.price_planned) || parseFloat(o.price_actual) || parseFloat(o.total_price) || parseFloat(o.price_final) || 0;
                return sum + val;
            }, 0);
            return { ...stateInfo, count, totalValue };
        });

        // Special Stats for Side Box
        const acceptedInProgress = baseOrders.filter(o =>
            (o.offer_status || '').toLowerCase() === 'offerta accettata' &&
            (o.status_works || '').toLowerCase() !== 'completato'
        );

        const acceptedAll = baseOrders.filter(o => (o.offer_status || '').toLowerCase() === 'offerta accettata');
        const rejectedAll = baseOrders.filter(o => (o.offer_status || '').toLowerCase() === 'offerta rifiutata');

        // YTD Stats
        const currentYear = new Date().getFullYear();
        const acceptedYTD = acceptedAll.filter(o => {
            const date = o.order_date || o.created_at;
            return date && new Date(date).getFullYear() === currentYear;
        });
        const acceptedValueYTD = acceptedYTD.reduce((s, o) => s + (parseFloat(o.price_final) || 0), 0);

        const rejectedYTD = rejectedAll.filter(o => {
            const date = o.order_date || o.created_at;
            return date && new Date(date).getFullYear() === currentYear;
        });
        const rejectedValueYTD = rejectedYTD.reduce((s, o) => s + (parseFloat(o.price_final) || 0), 0);

        // Derivate Filter Options
        const uniqueYears = [...new Set(baseOrders.map(o => {
            const d = o.order_date || o.created_at;
            return d ? new Date(d).getFullYear() : null;
        }).filter(y => y))].sort((a, b) => b - a);

        const uniqueClients = [...new Set(baseOrders.map(o => o.clients?.business_name || o.client_code).filter(c => c))].sort();

        const uniqueStatuses = [...new Set(baseOrders.map(o => o.offer_status || o.status_works).filter(s => s))].sort();

        const renderDropdown = (id, label, icon, options, current) => {
            return `
                <div class="custom-dropdown" id="${id}-dropdown" style="position: relative; min-width: 140px;">
                    <button class="dropdown-trigger" style="
                        width: 100%; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--glass-border);
                        background: white; color: ${current ? 'var(--brand-viola)' : 'var(--text-secondary)'};
                        font-size: 0.8rem; font-weight: ${current ? '700' : '600'}; cursor: pointer;
                        display: flex; align-items: center; justify-content: space-between; transition: all 0.2s;
                    " onmouseover="this.style.borderColor='var(--brand-viola)'" onmouseout="if(!this.parentElement.classList.contains('open')) this.style.borderColor='var(--glass-border)'">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="material-icons-round" style="font-size: 1.1rem; opacity: 0.7;">${icon}</span>
                            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">${current || label}</span>
                        </div>
                        <span class="material-icons-round" style="font-size: 1.1rem; opacity: 0.5;">expand_more</span>
                    </button>
                    <div class="dropdown-menu" style="
                        display: none; position: absolute; top: 100%; left: 0; right: 0; z-index: 100;
                        margin-top: 6px; background: white; border-radius: 12px; border: 1px solid var(--glass-border);
                        box-shadow: 0 10px 25px rgba(0,0,0,0.1); max-height: 250px; overflow-y: auto;
                        padding: 6px;
                    ">
                        <div class="dropdown-item" data-value="" style="
                            padding: 8px 12px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;
                            color: var(--text-tertiary); font-weight: 600;
                        " onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">Tutti</div>
                        ${options.map(opt => `
                            <div class="dropdown-item" data-value="${opt}" style="
                                padding: 8px 12px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;
                                color: var(--text-primary); font-weight: 500;
                                ${opt === current ? 'background: rgba(97, 74, 162, 0.05); color: var(--brand-viola); font-weight: 700;' : ''}
                            " onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='${opt === current ? 'rgba(97, 74, 162, 0.05)' : 'transparent'}'">${opt}</div>
                        `).join('')}
                    </div>
                </div>
            `;
        };

        const renderTableRows = (filteredOrders) => {
            if (filteredOrders.length === 0) {
                if (state.isFetching) {
                    return '<tr><td colspan="6" style="text-align:center; padding: 4rem; opacity: 0.5;">Caricamento dati...</td></tr>';
                }
                return '<tr><td colspan="6" style="text-align:center; padding: 4rem; opacity: 0.5;">Nessun ordine trovato.</td></tr>';
            }

            return filteredOrders.map(order => {
                const displayPrice = parseFloat(order.price_actual) || parseFloat(order.price_planned) || parseFloat(order.total_price) || parseFloat(order.price_final) || 0;
                const displayCost = parseFloat(order.cost_actual) || parseFloat(order.cost_planned) || parseFloat(order.cost_final) || 0;
                const displayRevenue = parseFloat(order.revenue_actual) || parseFloat(order.revenue_planned) || (displayPrice - displayCost);

                return `
                    <tr class="clickable-row" data-id="${order.id}" style="transition: all 0.2s ease; border-bottom: 1px solid var(--glass-border);">
                        <td style="padding: 1rem 1.5rem; font-weight: 600; font-size: 0.85rem; color: var(--text-primary); white-space: nowrap;">${order.order_number}</td>
                        <td style="padding: 1rem 1.5rem;">
                            <div style="font-weight: 500; font-size: 0.9rem; color: var(--text-primary); margin-bottom: 0.25rem;">${order.title || 'Senza Titolo'}</div>
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

        const funnelHTML = funnelStats.map(stat => `
            <div class="glass-card funnel-card" data-status="${stat.key}" style="
                padding: 1.25rem;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                border-left: 4px solid ${stat.textColor};
                position: relative;
                overflow: hidden;
            ">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                    <div style="flex: 1;">
                        <div style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); font-weight: 600; margin-bottom: 0.25rem;">${stat.label}</div>
                        <div style="font-size: 1.75rem; font-weight: 700; color: var(--text-primary); line-height: 1; font-family: var(--font-titles);">${stat.count}</div>
                    </div>
                    <div style="width: 36px; height: 36px; border-radius: 10px; background: ${stat.color}; display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons-round" style="color: ${stat.textColor}; font-size: 20px;">${stat.icon}</span>
                    </div>
                </div>
                <div style="font-size: 0.8rem; font-weight: 600; color: ${stat.textColor}; font-variant-numeric: tabular-nums; opacity: 0.8;">
                    € ${formatAmount(stat.totalValue)}
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <style>
                .dashboard-main-grid {
                    display: grid;
                    grid-template-columns: 360px 1fr;
                    gap: 2rem;
                    align-items: start;
                }

                @media (max-width: 1200px) {
                    .dashboard-main-grid { grid-template-columns: 300px 1fr; gap: 1.5rem; }
                }

                @media (max-width: 1100px) {
                    .dashboard-main-grid { grid-template-columns: 1fr; gap: 1.5rem; }
                    .dashboard-side-col { order: 2; }
                    .dashboard-main-col { order: 1; }
                    .dashboard-funnel-grid { grid-template-columns: repeat(3,1fr) !important; }
                    .funnel-card { padding: 1rem 0.5rem !important; text-align: center; }
                    .funnel-card .material-icons-round { margin: 0 auto 0.5rem !important; }
                    .funnel-card div[style*="font-size: 1.75rem"] { font-size: 1.25rem !important; }
                }

                @media (max-width: 768px) {
                    .dashboard-main-grid { padding: 0.5rem !important; gap: 1rem; }
                    .dashboard-funnel-grid { gap: 0.5rem !important; }
                    .funnel-card { border-radius: 12px !important; border-left-width: 3px !important; }
                    .funnel-card div[style*="font-size: 0.65rem"] { font-size: 0.55rem !important; }
                    .funnel-card div[style*="font-size: 1.75rem"] { font-size: 1.1rem !important; }
                    .funnel-card div[style*="font-size: 0.8rem"] { font-size: 0.7rem !important; }
                    
                    .filter-bar-container { padding: 1rem !important; gap: 0.75rem !important; }
                    .filter-bar-container > div:first-child { display: none !important; } /* Hide "Filtra per" label */
                    .filter-bar-container > div:last-child { flex-wrap: wrap; gap: 0.5rem !important; }
                    .custom-dropdown { flex: 1 1 calc(50% - 0.25rem); min-width: 0 !important; }
                    .dropdown-trigger { padding: 6px 8px !important; font-size: 0.7rem !important; }
                    .dropdown-trigger span[style*="max-width: 120px"] { max-width: 70px !important; }

                    .dashboard-header-actions { padding: 1rem !important; flex-direction: column; align-items: flex-start !important; gap: 1rem; }
                    .dashboard-header-actions h3 { font-size: 1.1rem !important; }
                    .dashboard-header-actions > div:last-child { width: 100%; justify-content: space-between; }
                    #btn-new-order-main { padding: 0.5rem 1rem !important; font-size: 0.75rem !important; }

                    /* TABLE TO CARDS */
                    .table-container { overflow: hidden !important; }
                    .table-container table, .table-container thead, .table-container tbody, .table-container tr, .table-container td {
                        display: block; width: 100%; box-sizing: border-box;
                    }
                    .table-container thead { display: none; }
                    
                    .table-container tr {
                        background: white;
                        border-bottom: 4px solid var(--bg-secondary) !important;
                        padding: 1.25rem 1rem;
                        position: relative;
                        display: flex;
                        flex-direction: column;
                        gap: 0.5rem;
                    }
                    
                    .table-container td {
                        padding: 0 !important;
                        border: none !important;
                        text-align: left !important;
                        display: flex;
                        align-items: center;
                        white-space: normal !important;
                    }

                    /* ID Row */
                    .table-container td:nth-child(1) { 
                        font-size: 0.8rem !important; 
                        color: var(--brand-viola) !important; 
                        font-weight: 800 !important; 
                        display: inline-block; 
                        width: auto !important; 
                        margin-bottom: 2px; 
                        padding: 2px 8px !important; 
                        background: rgba(97, 74, 162, 0.05); 
                        border-radius: 6px; 
                    }

                    /* Project Title */
                    .table-container td:nth-child(2) { 
                        flex-direction: column; 
                        align-items: flex-start; 
                        gap: 4px; 
                        margin-bottom: 0.5rem; 
                    }
                    .table-container td:nth-child(2) div[style*="font-size: 0.9rem"] { 
                        font-size: 1.05rem !important; 
                        font-weight: 700 !important; 
                        line-height: 1.25; 
                        color: var(--text-primary) !important;
                    }
                    .table-container td:nth-child(2) div[style*="font-size: 0.7rem"] { 
                        font-size: 0.75rem !important; 
                    }

                    /* Cliente */
                    .table-container td:nth-child(3) { font-size: 0.85rem !important; margin-bottom: 0.75rem; color: var(--text-secondary) !important; }
                    .table-container td:nth-child(3)::before { content: "Cliente: "; font-weight: 700; color: var(--text-tertiary); margin-right: 6px; font-size: 0.7rem; text-transform: uppercase; }

                    /* Values */
                    .table-container td:nth-child(4), .table-container td:nth-child(5), .table-container td:nth-child(6) {
                        justify-content: space-between !important;
                        font-size: 0.85rem !important;
                        padding: 4px 0 !important;
                        border-top: 1px dashed var(--glass-border) !important;
                    }
                    .table-container td:nth-child(4)::before { content: "Fatturato"; font-size: 0.7rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; }
                    .table-container td:nth-child(5)::before { content: "Costi"; font-size: 0.7rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; }
                    .table-container td:nth-child(6)::before { content: "Ricavo"; font-size: 0.7rem; font-weight: 800; color: var(--brand-viola); text-transform: uppercase; }
                    .table-container td:nth-child(6) { border-top: 1px solid var(--glass-border) !important; padding-top: 8px !important; margin-top: 4px !important; }
                    /* General Mobile Container Fix */
                    .dashboard-root { padding: 0.5rem !important; overflow-x: hidden !important; width: 100% !important; box-sizing: border-box !important; display: block !important; }
                    .dashboard-root * { box-sizing: border-box !important; }
                    
                    /* Grid and Sequencing */
                    .dashboard-root .dashboard-main-grid { display: block !important; }
                    .dashboard-root .dashboard-side-col { order: 2; width: 100% !important; display: flex !important; flex-direction: column !important; gap: 1rem !important; margin-top: 1.5rem; }
                    .dashboard-root .dashboard-main-col { order: 1; width: 100% !important; display: flex !important; flex-direction: column !important; gap: 1rem !important; }
                    
                    /* Vertical Scroll Fix - Remove all nested scrolls and fixed heights */
                    .dashboard-root .dashboard-side-col, 
                    .dashboard-root .dashboard-main-col, 
                    .dashboard-root .glass-card, 
                    .dashboard-root .table-container, 
                    .dashboard-root .active-order-list { 
                        max-height: none !important; 
                        height: auto !important; 
                        overflow: visible !important; 
                        width: 100% !important;
                        min-width: 0 !important;
                    }

                    /* Funnel Layout */
                    .dashboard-root .dashboard-funnel-grid { 
                        display: grid !important;
                        grid-template-columns: repeat(3, 1fr) !important;
                        gap: 0.5rem !important; 
                        width: 100% !important;
                    }
                    .dashboard-root .funnel-card { 
                        padding: 0.75rem 0.25rem !important; 
                        text-align: center; 
                        border-left-width: 3px !important;
                        border-radius: 12px !important;
                        min-width: 0 !important;
                    }
                    .dashboard-root .funnel-card .material-icons-round { margin: 0 auto 0.25rem !important; font-size: 1.1rem !important; }
                    .dashboard-root .funnel-card div[style*="font-size: 0.65rem"] { font-size: 0.55rem !important; line-height: 1.1; }
                    .dashboard-root .funnel-card div[style*="font-size: 1.75rem"] { font-size: 1rem !important; margin: 2px 0 !important; }
                    .dashboard-root .funnel-card div[style*="font-size: 0.8rem"] { font-size: 0.65rem !important; }
                    
                    /* Filters */
                    .dashboard-root .filter-bar-container { padding: 0.75rem !important; gap: 0.5rem !important; flex-wrap: wrap !important; }
                    .dashboard-root .filter-bar-container > div:first-child { display: none !important; }
                    .dashboard-root .filter-bar-container > div:last-child { width: 100% !important; display: flex !important; flex-wrap: wrap !important; gap: 0.5rem !important; }
                    .dashboard-root .custom-dropdown { flex: 1 1 calc(50% - 0.25rem); min-width: 0 !important; max-width: 50%; }
                    .dashboard-root .dropdown-trigger { padding: 6px 8px !important; font-size: 0.65rem !important; }
                    .dashboard-root .dropdown-trigger span { max-width: 65px !important; }

                    /* Header and Table Title */
                    .dashboard-root .dashboard-header-actions { padding: 1rem !important; flex-direction: column !important; align-items: stretch !important; gap: 0.75rem !important; }
                    .dashboard-root #table-title { font-size: 1rem !important; }
                    .dashboard-root .dashboard-header-actions > div:last-child { display: flex !important; justify-content: space-between !important; align-items: center !important; }
                    .dashboard-root #btn-new-order-main { padding: 0.5rem 0.75rem !important; font-size: 0.7rem !important; }

                    /* Table to Cards Conversion */
                    .dashboard-root .table-container { width: 100% !important; margin: 0 !important; padding: 0 !important; }
                    .dashboard-root .table-container table, 
                    .dashboard-root .table-container thead, 
                    .dashboard-root .table-container tbody, 
                    .dashboard-root .table-container tr, 
                    .dashboard-root .table-container td {
                        display: block !important; 
                        width: 100% !important; 
                    }
                    .dashboard-root .table-container thead { display: none !important; }
                    
                    .dashboard-root .table-container tr {
                        background: white !important;
                        border-bottom: 4px solid var(--bg-secondary) !important;
                        padding: 1rem !important;
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 0.4rem !important;
                    }
                    
                    .dashboard-root .table-container td {
                        padding: 0 !important;
                        border: none !important;
                        text-align: left !important;
                        display: flex !important;
                        align-items: center !important;
                        white-space: normal !important;
                        min-height: auto !important;
                    }

                    .dashboard-root .table-container td:nth-child(1) { 
                        font-size: 0.75rem !important; 
                        color: var(--brand-viola) !important; 
                        font-weight: 800 !important; 
                        padding: 2px 6px !important; 
                        background: rgba(97, 74, 162, 0.05) !important; 
                        border-radius: 4px !important; 
                        width: auto !important; 
                        display: inline-flex !important;
                    }

                    .dashboard-root .table-container td:nth-child(2) { flex-direction: column !important; align-items: flex-start !important; gap: 2px !important; margin: 0.25rem 0 !important; }
                    .dashboard-root .table-container td:nth-child(2) div:first-child { font-size: 0.95rem !important; font-weight: 800 !important; color: var(--text-primary) !important; }
                    .dashboard-root .table-container td:nth-child(2) div:last-child { font-size: 0.7rem !important; opacity: 0.7; }

                    .dashboard-root .table-container td:nth-child(3) { font-size: 0.8rem !important; color: var(--text-secondary) !important; margin-bottom: 0.5rem !important; }
                    .dashboard-root .table-container td:nth-child(3)::before { content: "CLIENTE: "; font-weight: 900; color: var(--text-tertiary); font-size: 0.6rem; margin-right: 6px; }

                    .dashboard-root .table-container td:nth-child(4), 
                    .dashboard-root .table-container td:nth-child(5), 
                    .dashboard-root .table-container td:nth-child(6) {
                        justify-content: space-between !important;
                        font-size: 0.8rem !important;
                        padding: 6px 0 !important;
                        border-top: 1px dashed var(--glass-border) !important;
                    }
                    .dashboard-root .table-container td:nth-child(4)::before { content: "FATTURATO"; font-size: 0.6rem; font-weight: 800; color: var(--text-tertiary); }
                    .dashboard-root .table-container td:nth-child(5)::before { content: "COSTI"; font-size: 0.6rem; font-weight: 800; color: var(--text-tertiary); }
                    .dashboard-root .table-container td:nth-child(6)::before { content: "RICAVO"; font-size: 0.6rem; font-weight: 900; color: var(--brand-viola); }
                }
            </style>
            <div class="dashboard-root" style="padding: 1.5rem; max-width: 1600px; margin: 0 auto; width: 100%; box-sizing: border-box;">
                
                <div class="dashboard-main-grid">
                    
                    <!-- Side Column: Active Box & Stats -->
                    <div class="dashboard-side-col" style="display: flex; flex-direction: column; gap: 1.5rem;">
                        
                        <!-- Ordini Attivi: Versione Brand Gleeye (Blue/Viola) -->
                        <div class="glass-card" style="padding: 0; border-radius: 12px; background: white; border: 1px solid var(--glass-border); box-shadow: var(--shadow-sm); overflow: hidden; display: flex; flex-direction: column;">
                            <!-- Header con il gradiente ufficiale Brand Gleeye -->
                            <div style="padding: 0.85rem 1rem; background: var(--brand-gradient); color: white;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
                                    <h3 style="margin: 0; font-size: 0.78rem; font-weight: 800; color: white; display: flex; align-items: center; gap: 6px; font-family: var(--font-titles); text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.9;">
                                        <span class="material-icons-round" style="font-size: 0.95rem;">rocket_launch</span>
                                        Ordini Attivi
                                    </h3>
                                    <div style="background: white; color: var(--brand-viola); padding: 1px 7px; border-radius: 4px; font-weight: 900; font-size: 0.75rem; min-width: 22px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                        ${acceptedInProgress.length}
                                    </div>
                                </div>
                                <div style="font-size: 1.25rem; font-weight: 900; letter-spacing: -0.01em; line-height: 1; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                                    € ${formatAmount(acceptedInProgress.reduce((sum, o) => sum + (parseFloat(o.price_final) || 0), 0))}
                                </div>
                                <div style="font-size: 0.58rem; font-weight: 700; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 3px;">Valore Totale Comperato</div>
                            </div>
                            
                            <!-- Lista con più "respiro" -->
                            <div class="active-order-list" style="padding: 0.75rem; display: flex; flex-direction: column; gap: 0.65rem; max-height: 400px; overflow-y: auto; custom-scrollbar">
                                ${acceptedInProgress.length === 0 ? `
                                    <div style="text-align: center; padding: 1.5rem 1rem; color: var(--text-tertiary); font-size: 0.75rem; opacity: 0.6;">
                                        Nessun ordine attivo
                                    </div>
                                ` : acceptedInProgress.slice(0, 15).map(o => `
                                    <div class="active-order-item" onclick="window.location.hash='order-detail/${o.id}'" style="
                                        padding: 0.8rem 1rem; background: #f8fafc; border-radius: 10px; border: 1px solid #f1f5f9; cursor: pointer; transition: all 0.2s ease;
                                        display: flex; flex-direction: column; gap: 6px; border-left: 4px solid var(--brand-viola);
                                    " onmouseover="this.style.background='white'; this.style.borderColor='var(--brand-viola)'; this.style.transform='translateX(3px)';" onmouseout="this.style.background='#f8fafc'; this.style.borderColor='#f1f5f9'; this.style.transform='none';">
                                        <!-- Top Row: ID and Client -->
                                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
                                            <span style="font-size: 0.55rem; color: var(--text-tertiary); font-weight: 800; text-transform: uppercase;">${o.order_number}</span>
                                            <span style="font-size: 0.65rem; color: var(--text-secondary); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: right; flex: 1;">${o.clients?.business_name || o.client_code || 'N/D'}</span>
                                        </div>
                                        <!-- Bottom Row: Title and Price -->
                                        <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 12px;">
                                            <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">${o.title || 'Senza Titolo'}</div>
                                            <div style="font-size: 0.88rem; font-weight: 800; color: var(--brand-viola); white-space: nowrap;">€ ${formatAmount(parseFloat(o.price_final) || 0)}</div>
                                        </div>
                                    </div>
                                `).join('')}
                                ${acceptedInProgress.length > 15 ? `<div style="text-align:center; font-size: 0.6rem; color: var(--text-tertiary); padding: 0.3rem; font-weight: 700;">+ ${acceptedInProgress.length - 15} ALTRI</div>` : ''}
                            </div>
                        </div>

                        <!-- YTD Performance Simplified -->
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.1em; display: flex; align-items: center; gap: 8px; margin-top: 0.5rem;">
                                <div style="height: 1px; flex: 1; background: var(--glass-border);"></div>
                                Dashboard ${currentYear}
                                <div style="height: 1px; flex: 1; background: var(--glass-border);"></div>
                            </div>
                            
                            <!-- Accepted Combined Box -->
                            <div id="btn-show-accepted" class="glass-card" style="
                                padding: 1.25rem; border-radius: 16px; background: #f0fdf4; border: 1px solid #bcf0da; cursor: pointer; transition: all 0.2s;
                            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.1)'" onmouseout="this.style.transform='none'; this.style.boxShadow='none'">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                                    <div style="font-size: 0.65rem; font-weight: 700; color: #065f46; text-transform: uppercase;">Offerte Accettate</div>
                                    <span class="material-icons-round" style="font-size: 1.1rem; color: #059669;">open_in_new</span>
                                </div>
                                <div style="display: flex; align-items: baseline; gap: 8px;">
                                    <span style="font-size: 1.5rem; font-weight: 800; color: #047857;">${acceptedYTD.length}</span>
                                    <span style="font-size: 0.9rem; font-weight: 600; color: #047857; opacity: 0.8;">€ ${formatAmount(acceptedValueYTD)}</span>
                                </div>
                            </div>

                            <!-- Rejected Combined Box -->
                            <div id="btn-show-rejected" class="glass-card" style="
                                padding: 1.25rem; border-radius: 16px; background: #fef2f2; border: 1px solid #fecaca; cursor: pointer; transition: all 0.2s;
                            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(239, 68, 68, 0.1)'" onmouseout="this.style.transform='none'; this.style.boxShadow='none'">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                                    <div style="font-size: 0.65rem; font-weight: 700; color: #991b1b; text-transform: uppercase;">Offerte Rifiutate</div>
                                    <span class="material-icons-round" style="font-size: 1.1rem; color: #dc2626;">open_in_new</span>
                                </div>
                                <div style="display: flex; align-items: baseline; gap: 8px;">
                                    <span style="font-size: 1.5rem; font-weight: 800; color: #b91c1c;">${rejectedYTD.length}</span>
                                    <span style="font-size: 0.9rem; font-weight: 600; color: #b91c1c; opacity: 0.8;">€ ${formatAmount(rejectedValueYTD)}</span>
                                </div>
                            </div>
                        </div>

                    </div>

                    <!-- Main Column: Funnel & Table -->
                    <div class="dashboard-main-col" style="display: flex; flex-direction: column; gap: 2rem;">
                        <div id="funnel-container" class="dashboard-funnel-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem;">
                            ${funnelHTML}
                        </div>

                        <div class="glass-card main-table-card" style="padding: 0; overflow: hidden; border-radius: 16px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; max-height: 600px;">
                            <div class="dashboard-header-actions" style="padding: 1.5rem; border-bottom: 1px solid var(--glass-border); background: var(--bg-secondary); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <h3 id="table-title" style="margin: 0; font-size: 1.2rem; font-weight: 800; font-family: var(--font-titles); color: var(--text-primary);">Elenco Ordini</h3>
                                    <span id="active-filter-badge" style="display: none; font-size: 0.7rem; background: var(--brand-viola); color: white; padding: 3px 12px; border-radius: 20px; font-weight: 700; letter-spacing: 0.05em;">FILTRO ATTIVO</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <button id="reset-filter" style="display: none; border: 1px solid var(--brand-viola); background: white; color: var(--brand-viola); font-size: 0.8rem; font-weight: 700; cursor: pointer; padding: 6px 16px; border-radius: 8px; transition: all 0.2s;" onmouseover="this.style.background='var(--brand-viola)'; this.style.color='white'">Rimuovi Filtro</button>
                                    <button id="btn-new-order-main" class="primary-btn" style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; padding: 0.6rem 1.2rem;">
                                        <span class="material-icons-round" style="font-size: 1.1rem;">add</span>
                                        Nuovo Ordine
                                    </button>
                                </div>
                            </div>

                            <!-- Filter Bar -->
                            <div id="table-filter-bar" class="filter-bar-container" style="padding: 1rem 1.5rem; background: #fcfcfd; border-bottom: 1px solid var(--glass-border); display: flex; align-items: center; gap: 1.5rem;">
                                <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px;">
                                    <span class="material-icons-round" style="font-size: 1rem;">filter_list</span>
                                    Filtra per:
                                </div>
                                <div style="display: flex; align-items: center; gap: 1rem; flex: 1;">
                                    ${renderDropdown('year', 'Anno', 'calendar_today', uniqueYears, currentYearFilter)}
                                    ${renderDropdown('client', 'Cliente', 'person', uniqueClients, currentClientFilter)}
                                    ${renderDropdown('status', 'Stato', 'flag', uniqueStatuses, currentStatusFilter)}
                                </div>
                            </div>
                            <div class="table-container" style="overflow-x: auto; overflow-y: auto; flex: 1; position: relative;">
                                <table style="width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed;">
                                    <thead style="position: sticky; top: 0; z-index: 10;">
                                        <tr>
                                            <th style="position: sticky; top: 0; background: white; text-align: left; padding: 1rem; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.05em; width: 90px; border-bottom: 1px solid var(--glass-border); z-index: 10;">ID</th>
                                            <th style="position: sticky; top: 0; background: white; text-align: left; padding: 1rem; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.05em; border-bottom: 1px solid var(--glass-border); z-index: 10;">Progetto</th>
                                            <th style="position: sticky; top: 0; background: white; text-align: left; padding: 1rem; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.05em; min-width: 160px; border-bottom: 1px solid var(--glass-border); z-index: 10;">Cliente</th>
                                            <th style="position: sticky; top: 0; background: white; text-align: right; padding: 1rem; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.05em; width: 100px; border-bottom: 1px solid var(--glass-border); z-index: 10;">Prezzo</th>
                                            <th style="position: sticky; top: 0; background: white; text-align: right; padding: 1rem; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.05em; width: 100px; border-bottom: 1px solid var(--glass-border); z-index: 10;">Costi</th>
                                            <th style="position: sticky; top: 0; background: white; text-align: right; padding: 1rem; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.05em; width: 100px; border-bottom: 1px solid var(--glass-border); z-index: 10;">Ricavo</th>
                                        </tr>
                                    </thead>
                                    <tbody id="orders-table-body" style="background: white;">
                                        ${renderTableRows([...baseOrders].sort((a, b) => (b.order_number || "").localeCompare(a.order_number || "")))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        `;

        // Update helper functions
        const tableBody = container.querySelector('#orders-table-body');
        const tableTitle = container.querySelector('#table-title');
        const resetBtn = container.querySelector('#reset-filter');
        const filterBadge = container.querySelector('#active-filter-badge');
        const funnelCards = container.querySelectorAll('.funnel-card');
        const btnNewOrderMain = container.querySelector('#btn-new-order-main');

        if (btnNewOrderMain) {
            btnNewOrderMain.addEventListener('click', () => {
                window.openNewOrderModal();
            });
        }

        if (!tableBody) return;

        const handleRowInteractions = (body) => {
            body.querySelectorAll('.clickable-row').forEach(row => {
                row.addEventListener('click', () => {
                    if (row.dataset.id) window.location.hash = `order - detail / ${row.dataset.id} `;
                });
                row.addEventListener('mouseenter', () => { row.style.background = 'var(--bg-secondary)'; row.style.cursor = 'pointer'; });
                row.addEventListener('mouseleave', () => { row.style.background = 'white'; });
            });
        };

        handleRowInteractions(tableBody);

        const updateView = (funnel, year, client, status) => {
            currentFunnelFilter = funnel !== undefined ? funnel : currentFunnelFilter;
            currentYearFilter = year !== undefined ? year : currentYearFilter;
            currentClientFilter = client !== undefined ? client : currentClientFilter;
            currentStatusFilter = status !== undefined ? status : currentStatusFilter;

            const filtered = baseOrders.filter(o => {
                let match = true;
                if (currentFunnelFilter) {
                    match = match && o.offer_status?.toLowerCase() === currentFunnelFilter.toLowerCase();
                }
                if (currentYearFilter) {
                    const d = o.order_date || o.created_at;
                    match = match && d && new Date(d).getFullYear() == currentYearFilter;
                }
                if (currentClientFilter) {
                    match = match && (o.clients?.business_name === currentClientFilter || o.client_code === currentClientFilter);
                }
                if (currentStatusFilter) {
                    match = match && (o.offer_status === currentStatusFilter || o.status_works === currentStatusFilter);
                }
                return match;
            });

            const sorted = [...filtered].sort((a, b) => (b.order_number || "").localeCompare(a.order_number || ""));
            tableBody.innerHTML = renderTableRows(sorted);

            // UI elements for the dropdowns
            const updateDropdownUI = (type, value, label) => {
                const drop = container.querySelector(`#${type} -dropdown`);
                if (!drop) return;
                const trigger = drop.querySelector('.dropdown-trigger');
                const menu = drop.querySelector('.dropdown-menu');
                trigger.querySelector('span:nth-child(2)').textContent = value || label;
                trigger.style.color = value ? 'var(--brand-viola)' : 'var(--text-secondary)';
                trigger.style.fontWeight = value ? '700' : '600';

                menu.querySelectorAll('.dropdown-item').forEach(item => {
                    item.style.background = item.dataset.value === value ? 'rgba(97, 74, 162, 0.05)' : 'transparent';
                    item.style.color = item.dataset.value === value ? 'var(--brand-viola)' : 'var(--text-primary)';
                    item.style.fontWeight = item.dataset.value === value ? '700' : '500';
                });
            };

            updateDropdownUI('year', currentYearFilter, 'Anno');
            updateDropdownUI('client', currentClientFilter, 'Cliente');
            updateDropdownUI('status', currentStatusFilter, 'Stato');

            const hasAnyFilter = currentFunnelFilter || currentYearFilter || currentClientFilter || currentStatusFilter;
            tableTitle.textContent = currentFunnelFilter ? `Ordini: ${currentFunnelFilter} ` : 'Elenco Ordini';
            resetBtn.style.display = hasAnyFilter ? 'block' : 'none';
            filterBadge.style.display = hasAnyFilter ? 'block' : 'none';

            // Special case: hide advanced filters if funnel is active (as per user request "solo modalità non filtrata")
            // Actually I'll just gray them out or keep them but highlight that they are combined.
            // User said: "(solo ovviamente nella modalità non filtrata da altre cose)"
            // I'll hide the bar if funnel filter is active.
            const filterBar = container.querySelector('#table-filter-bar');
            if (filterBar) filterBar.style.display = currentFunnelFilter ? 'none' : 'flex';

            handleRowInteractions(tableBody);

            funnelCards.forEach(card => {
                if (currentFunnelFilter && card.dataset.status === currentFunnelFilter) {
                    card.style.transform = 'translateY(-4px) scale(1.02)';
                    card.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)';
                } else {
                    card.style.transform = 'none';
                    card.style.boxShadow = '';
                }
            });
        };

        const setupDropdownEvents = (type) => {
            const drop = container.querySelector(`#${type} -dropdown`);
            if (!drop) return;
            const trigger = drop.querySelector('.dropdown-trigger');
            const menu = drop.querySelector('.dropdown-menu');

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = menu.style.display === 'block';
                // Close all other menus
                container.querySelectorAll('.dropdown-menu').forEach(m => m.style.display = 'none');
                container.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));

                if (!isOpen) {
                    menu.style.display = 'block';
                    drop.classList.add('open');
                }
            });

            menu.querySelectorAll('.dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const val = item.dataset.value || null;
                    if (type === 'year') updateView(undefined, val, undefined, undefined);
                    else if (type === 'client') updateView(undefined, undefined, val, undefined);
                    else if (type === 'status') updateView(undefined, undefined, undefined, val);
                    menu.style.display = 'none';
                    drop.classList.remove('open');
                });
            });
        };

        setupDropdownEvents('year');
        setupDropdownEvents('client');
        setupDropdownEvents('status');

        document.addEventListener('click', () => {
            container.querySelectorAll('.dropdown-menu').forEach(m => m.style.display = 'none');
            container.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
        });

        funnelCards.forEach(card => {
            card.addEventListener('click', () => {
                const status = card.dataset.status;
                const nextStatus = currentFunnelFilter === status ? null : status;
                updateView(nextStatus, null, null, null); // Clear other filters when funnel is clicked
            });
        });

        resetBtn.addEventListener('click', () => updateView(null, null, null, null));

        // Modal triggers
        container.querySelector('#btn-show-accepted').addEventListener('click', () => {
            showOrdersListModal(acceptedAll, 'Tutte le Offerte Accettate');
        });

        container.querySelector('#btn-show-rejected').addEventListener('click', () => {
            showOrdersListModal(rejectedAll, 'Tutte le Offerte Rifiutate');
        });
    };

    /**
     * Modal to show a list of orders with year filters
     */
    function showOrdersListModal(orders, title) {
        const modalId = 'orders-list-modal';
        const currentYear = new Date().getFullYear();
        let selectedYear = currentYear; // Default to current year

        const getYears = () => {
            const years = [...new Set(orders.map(o => {
                const date = o.order_date || o.created_at;
                return date ? new Date(date).getFullYear() : null;
            }).filter(y => y !== null))];
            return years.sort((a, b) => b - a);
        };

        const renderModalContent = (yearFilter) => {
            const filtered = yearFilter === 'all'
                ? orders
                : orders.filter(o => {
                    const date = o.order_date || o.created_at;
                    return date && new Date(date).getFullYear() == yearFilter;
                });

            const sorted = [...filtered].sort((a, b) => (b.order_number || "").localeCompare(a.order_number || ""));

            const rows = sorted.map(o => `
            < tr class="modal-clickable-row" data - id="${o.id}" style = "border-bottom: 1px solid var(--glass-border); cursor: pointer; transition: background 0.2s;" >
                    <td style="padding: 1rem; font-size: 0.85rem; font-weight: 600;">${o.order_number}</td>
                    <td style="padding: 1rem; font-size: 0.85rem;">${o.title || 'Senza Titolo'}</td>
                    <td style="padding: 1rem; font-size: 0.85rem; color: var(--text-secondary);">${o.clients?.business_name || 'N/D'}</td>
                    <td style="padding: 1rem; font-size: 0.85rem; text-align: right; font-weight: 700;">€ ${formatAmount(o.price_final || 0)}</td>
                </tr >
        `).join('');

            const years = getYears();
            const yearTabs = `
        < div style = "display: flex; gap: 8px; margin-bottom: 1.5rem; overflow-x: auto; padding-bottom: 4px;" >
            <button class="year-tab ${yearFilter === 'all' ? 'active' : ''}" data-year="all" style="
                        padding: 6px 14px; border-radius: 20px; border: 1px solid var(--glass-border); background: ${yearFilter === 'all' ? 'var(--brand-viola)' : 'white'}; color: ${yearFilter === 'all' ? 'white' : 'var(--text-secondary)'}; font-size: 0.75rem; font-weight: 600; cursor: pointer; white-space: nowrap;
                    ">Tutti</button>
                    ${years.map(y => `
                        <button class="year-tab ${yearFilter == y ? 'active' : ''}" data-year="${y}" style="
                            padding: 6px 14px; border-radius: 20px; border: 1px solid var(--glass-border); background: ${yearFilter == y ? 'var(--brand-viola)' : 'white'}; color: ${yearFilter == y ? 'white' : 'var(--text-secondary)'}; font-size: 0.75rem; font-weight: 600; cursor: pointer; white-space: nowrap;
                        ">${y}</button>
                    `).join('')
                }
                </div >
        `;

            return `
        < div style = "padding: 1.5rem; min-width: 850px; max-width: 95vw;" >
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <div>
                    <h2 style="margin: 0; font-family: var(--font-titles); font-weight: 700; color: var(--text-primary);">${title}</h2>
                    <div style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 4px;">Risultati trovati: ${filtered.length}</div>
                </div>
                <button class="icon-btn close-modal" onclick="window.closeModal('${modalId}')">
                    <span class="material-icons-round">close</span>
                </button>
            </div>

                    ${yearTabs}

    <div style="max-height: 450px; overflow-y: auto; border: 1px solid var(--glass-border); border-radius: 12px; background: white;">
        <table style="width: 100%; border-collapse: collapse;">
            <thead style="position: sticky; top: 0; background: var(--bg-tertiary); z-index: 10;">
                <tr style="border-bottom: 1px solid var(--glass-border);">
                    <th style="text-align: left; padding: 1rem; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: var(--text-tertiary);">N. Ordine</th>
                    <th style="text-align: left; padding: 1rem; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: var(--text-tertiary);">Titolo</th>
                    <th style="text-align: left; padding: 1rem; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: var(--text-tertiary);">Cliente</th>
                    <th style="text-align: right; padding: 1rem; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: var(--text-tertiary);">Prezzo</th>
                </tr>
            </thead>
            <tbody id="modal-orders-body">
                ${rows || '<tr><td colspan="4" style="padding: 3rem; text-align: center; color: var(--text-tertiary);">Nessun ordine presente per questo periodo</td></tr>'}
            </tbody>
        </table>
    </div>
                </div >
        `;
        };

        const attachModalEvents = () => {
            const modal = document.getElementById(modalId);
            if (!modal) return;

            // Row clicks
            modal.querySelectorAll('.modal-clickable-row').forEach(row => {
                row.addEventListener('click', () => {
                    closeModal(modalId);
                    window.location.hash = `order - detail / ${row.dataset.id} `;
                });
                row.addEventListener('mouseenter', () => { row.style.background = 'var(--bg-secondary)'; });
                row.addEventListener('mouseleave', () => { row.style.background = 'white'; });
            });

            // Tab clicks
            modal.querySelectorAll('.year-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    selectedYear = tab.dataset.year;
                    modal.querySelector('.modal-content').innerHTML = renderModalContent(selectedYear);
                    attachModalEvents(); // Re-attach
                });
            });
        };

        renderModal(modalId, renderModalContent(selectedYear));
        attachModalEvents();
    }

    // Initialize new order modal
    initNewOrderModal();

    // Initial Render
    renderContent();

    // Listen for data updates
    const onDataLoaded = () => {
        if (document.body.contains(container)) {
            renderContent();
        } else {
            window.removeEventListener('data:loaded', onDataLoaded);
        }
    };

    window.addEventListener('data:loaded', onDataLoaded);
}

export function renderInvoicesDashboard(container) {
    const activeStats = DashboardData.getStats(state.dashboardYear, 'all');
    const passiveStats = DashboardData.getStats(state.dashboardYear, state.dashboardPassiveFilter || 'all');

    container.innerHTML = `
        < div class="animate-fade-in dashboard-container" >
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
        </div >
        `;
}
