import { state } from '/js/modules/state.js';
import { formatAmount } from '../modules/utils.js?v=1000';
import { upsertCollaboratorService, deleteCollaboratorService } from '../modules/api.js';

export function renderCollaboratorServices(container) {
    const render = () => {
        // ... (Same sorting/filtering logic as before) ...
        const availableYears = [...new Set(state.collaboratorServices.map(s => {
            if (s.legacy_order_id && s.legacy_order_id.match(/^\d{2}/)) {
                return 2000 + parseInt(s.legacy_order_id.substring(0, 2));
            }
            return new Date(s.created_at).getFullYear();
        }))].sort((a, b) => b - a);

        if (!state.collaboratorServicesYear) {
            state.collaboratorServicesYear = availableYears.length > 0 ? availableYears[0] : new Date().getFullYear();
        }

        const selectedYear = state.collaboratorServicesYear;
        const selectedDept = state.collaboratorServicesDept || 'all';

        let filtered = state.collaboratorServices.filter(s => {
            let year = selectedYear;
            if (s.legacy_order_id && s.legacy_order_id.match(/^\d{2}/)) {
                year = 2000 + parseInt(s.legacy_order_id.substring(0, 2));
            } else {
                year = new Date(s.created_at).getFullYear();
            }
            if (year !== parseInt(selectedYear)) return false;
            if (selectedDept !== 'all' && s.department !== selectedDept) return false;
            if (state.searchTerm) {
                const term = state.searchTerm.toLowerCase();
                return (
                    (s.name && s.name.toLowerCase().includes(term)) ||
                    (s.legacy_service_name && s.legacy_service_name.toLowerCase().includes(term)) ||
                    (s.legacy_collaborator_name && s.legacy_collaborator_name.toLowerCase().includes(term)) ||
                    (s.legacy_order_id && s.legacy_order_id.toLowerCase().includes(term))
                );
            }
            return true;
        });

        // KPIs
        const totalServices = filtered.length;
        const totalCost = filtered.reduce((sum, s) => sum + (parseFloat(s.total_cost) || 0), 0);
        const totalRevenue = filtered.reduce((sum, s) => sum + (parseFloat(s.total_price) || 0), 0);
        const totalMargin = totalRevenue - totalCost;
        const marginPercent = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;
        const departments = ['all', ...new Set(state.collaboratorServices.map(s => s.department).filter(d => d))];

        const groups = {};
        filtered.forEach(s => {
            const orderId = s.legacy_order_id || 'Senza Ordine';
            if (!groups[orderId]) {
                groups[orderId] = { services: [], totalCost: 0, totalRevenue: 0 };
            }
            groups[orderId].services.push(s);
            groups[orderId].totalCost += parseFloat(s.total_cost) || 0;
            groups[orderId].totalRevenue += parseFloat(s.total_price) || 0;
        });

        const sortedOrders = Object.keys(groups).sort((a, b) => {
            if (a === 'Senza Ordine') return 1;
            if (b === 'Senza Ordine') return -1;
            return b.localeCompare(a);
        });

        const collabStats = {};
        filtered.forEach(s => {
            const collabName = s.collaborators?.full_name || s.legacy_collaborator_name || 'Non assegnato';
            if (!collabStats[collabName]) collabStats[collabName] = { revenue: 0, cost: 0, count: 0 };
            collabStats[collabName].revenue += parseFloat(s.total_price) || 0;
            collabStats[collabName].cost += parseFloat(s.total_cost) || 0;
            collabStats[collabName].count++;
        });
        const topCollabs = Object.entries(collabStats)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .slice(0, 5);

        let bodyContent = '';
        if (filtered.length === 0) {
            bodyContent = `
                <div style="text-align:center; padding: 6rem 2rem; background: var(--glass-bg); border-radius: 24px; border: 2px dashed var(--glass-border);">
                    <div style="width: 80px; height: 80px; background: rgba(78, 146, 216, 0.05); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                        <span class="material-icons-round" style="font-size: 3rem; color: var(--text-tertiary);">inventory_2</span>
                    </div>
                    <h2 style="font-family: var(--font-titles); font-weight: 400; margin-bottom: 0.5rem;">Nessun servizio trovato</h2>
                    <p style="color: var(--text-secondary); margin-bottom: 2rem; max-width: 400px; margin-inline: auto;">Non abbiamo trovato servizi per l'anno o reparto selezionato.</p>
                </div>
            `;
        } else {
            bodyContent = sortedOrders.map(orderId => {
                const group = groups[orderId];
                const orderMargin = group.totalRevenue - group.totalCost;
                const orderMarginPercent = group.totalRevenue > 0 ? (orderMargin / group.totalRevenue) * 100 : 0;

                return `
                    <div class="month-group">
                        <div class="month-group-header">
                            <span style="display:flex; align-items:center; gap:0.75rem;">
                                <span class="material-icons-round" style="color: var(--brand-blue);">work_outline</span>
                                Ordine ${orderId}
                            </span>
                            <div style="display: flex; gap: 1.5rem; margin-left: auto; font-size: 0.85rem; font-weight: 400;">
                                <span style="color: var(--text-secondary);">${group.services.length} servizi</span>
                                <span style="color: #ef4444;">Costo: ${formatAmount(group.totalCost)} €</span>
                                <span style="color: #22c55e;">Ricavo: ${formatAmount(group.totalRevenue)} €</span>
                                <span style="color: ${orderMarginPercent >= 0 ? 'var(--success-color)' : 'var(--error-color)'};">Margine: ${Math.round(orderMarginPercent)}%</span>
                            </div>
                        </div>
                        <div class="transactions-list">
                            ${group.services.map(s => {
                    const margin = (parseFloat(s.total_price) || 0) - (parseFloat(s.total_cost) || 0);
                    const marginP = s.total_price > 0 ? Math.round((margin / s.total_price) * 100) : 0;
                    const collabName = s.collaborators?.full_name || s.legacy_collaborator_name || 'N/A';
                    const serviceName = s.services?.name || s.legacy_service_name || s.name;

                    return `
                                    <div class="transaction-row card" onclick="openCollaboratorServiceDetail('${s.id}')" style="cursor: pointer; grid-template-columns: 2fr 1.5fr 1fr 1fr 1fr 1fr 1fr 0.8fr;">
                                        <div style="min-width: 0;">
                                            <div style="font-weight: 400; font-size: 0.95rem; margin-bottom: 0.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${serviceName}</div>
                                            <div style="font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.4rem;">
                                                <span class="material-icons-round" style="font-size: 0.9rem; color: var(--brand-blue);">person</span>
                                                ${collabName}
                                            </div>
                                        </div>
                                        <div>
                                            ${s.department ? `<span class="cat-badge" style="background: rgba(var(--brand-blue-rgb), 0.1); color: var(--brand-blue);">${s.department}</span>` : '<span style="color: var(--text-tertiary);">-</span>'}
                                        </div>
                                        <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                            ${s.tariff_type || '-'}
                                        </div>
                                        <div style="font-size: 0.85rem; text-align: right;">
                                            ${s.hours ? `${s.hours}h` : s.months ? `${s.months}m` : s.spot_quantity ? s.spot_quantity : '-'}
                                        </div>
                                        <div style="text-align: right; font-size: 0.9rem; color: var(--text-secondary);">
                                            ${formatAmount(s.unit_cost)} €
                                        </div>
                                        <div style="text-align: right; font-size: 0.9rem; color: var(--text-secondary);">
                                            ${formatAmount(s.unit_price)} €
                                        </div>
                                        <div style="text-align: right; font-weight: 400; font-size: 1rem;">
                                            ${formatAmount(s.total_price)} €
                                        </div>
                                        <div style="text-align: right; font-weight: 400; font-size: 1rem; color: ${marginP >= 0 ? '#16a34a' : '#dc2626'};">
                                            ${marginP}%
                                        </div>
                                    </div>
                                `;
                }).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        }

        return `
            <div class="animate-fade-in" style="max-width: 1400px; margin: 0 auto; padding-bottom: 4rem;">
                <div class="bank-kpi-grid">
                    <div class="bank-kpi-card" style="background: linear-gradient(135deg, rgba(78, 146, 216, 0.1) 0%, rgba(78, 146, 216, 0.05) 100%);">
                        <div class="icon-box"><span class="material-icons-round">inventory_2</span></div>
                        <div class="content">
                            <span class="label">Servizi Totali</span>
                            <span class="value">${totalServices}</span>
                        </div>
                    </div>
                    <div class="bank-kpi-card expense">
                        <div class="icon-box"><span class="material-icons-round">payments</span></div>
                        <div class="content">
                            <span class="label">Costo Totale</span>
                            <span class="value">${formatAmount(totalCost)} €</span>
                        </div>
                    </div>
                    <div class="bank-kpi-card income">
                        <div class="icon-box"><span class="material-icons-round">account_balance_wallet</span></div>
                        <div class="content">
                            <span class="label">Ricavo Totale</span>
                            <span class="value">${formatAmount(totalRevenue)} €</span>
                        </div>
                    </div>
                    <div class="bank-kpi-card balance">
                        <div class="icon-box"><span class="material-icons-round">trending_up</span></div>
                        <div class="content">
                            <span class="label">Margine Complessivo</span>
                            <span class="value" style="color: ${marginPercent >= 0 ? '#16a34a' : '#dc2626'}">${Math.round(marginPercent)}%</span>
                        </div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 350px; gap: 2rem; align-items: start;">
                    <div class="main-column">
                        <div class="section-header" style="background: var(--card-bg); padding: 1.25rem 1.5rem; border-radius: 20px; border: 1px solid var(--glass-border); margin-bottom: 1.5rem; backdrop-filter: blur(10px);">
                            <div>
                                <h2 style="font-family: var(--font-titles); font-weight: 400; margin: 0; font-size: 1.5rem;">Registro Servizi</h2>
                                <span style="font-size: 0.85rem; color: var(--text-secondary);">${filtered.length} servizi nel ${selectedYear}</span>
                            </div>
                            <div style="display: flex; gap: 1.25rem; align-items: center;">
                                <select id="dept-filter" style="padding: 0.5rem 1rem; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--bg-primary); font-size: 0.85rem; font-weight: 400;">
                                    ${departments.map(d => `<option value="${d}" ${d === selectedDept ? 'selected' : ''}>${d === 'all' ? 'Tutti i Reparti' : d}</option>`).join('')}
                                </select>
                                <div class="year-selector" style="display:flex; background: rgba(0,0,0,0.03); padding: 0.25rem; border-radius: 12px; border: 1px solid var(--glass-border);">
                                    ${availableYears.map(y => `
                                        <button class="pill-filter ${y == selectedYear ? 'active' : ''}" style="padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 400;" onclick="window.setCollabServicesYear(${y})">${y}</button>
                                    `).join('')}
                                </div>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 2fr 1.5fr 1fr 1fr 1fr 1fr 1fr 0.8fr; gap: 1rem; padding: 0.75rem 1.5rem; background: var(--bg-secondary); border-radius: 12px; margin-bottom: 1rem; font-size: 0.75rem; font-weight: 400; color: var(--text-secondary); text-transform: uppercase;">
                            <div>Servizio</div>
                            <div>Reparto</div>
                            <div>Tipo</div>
                            <div style="text-align: right;">Qtà</div>
                            <div style="text-align: right;">Costo Unit.</div>
                            <div style="text-align: right;">Prezzo Unit.</div>
                            <div style="text-align: right;">Totale</div>
                            <div style="text-align: right;">Margine</div>
                        </div>

                        ${bodyContent}
                    </div>

                    <div class="side-column" style="position: sticky; top: 1.5rem;">
                        <div class="card analytics-card">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
                                <h3 style="font-family: var(--font-titles); font-weight: 400; font-size: 1.1rem; display: flex; align-items: center; gap: 0.75rem; margin:0;">
                                    <span class="material-icons-round" style="color: var(--brand-blue);">leaderboard</span>
                                    Top Collaboratori
                                </h3>
                            </div>
                            
                            <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                                ${topCollabs.length > 0 ? topCollabs.map(([name, stats]) => {
            const margin = stats.revenue - stats.cost;
            const marginP = stats.revenue > 0 ? (margin / stats.revenue * 100).toFixed(0) : 0;
            return `
                                        <div>
                                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.5rem;">
                                                <span style="font-weight: 500; color: var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px;">${name}</span>
                                                <span style="font-weight: 400;">${formatAmount(stats.revenue)} €</span>
                                            </div>
                                            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">
                                                <span>${stats.count} servizi</span>
                                                <span style="color: ${marginP >= 0 ? 'var(--success-color)' : 'var(--error-color)'};">Margine: ${marginP}%</span>
                                            </div>
                                            <div class="analytics-bar-bg">
                                                <div class="analytics-bar-fill" style="width: ${(stats.revenue / totalRevenue * 100).toFixed(0)}%; background: var(--brand-blue);"></div>
                                            </div>
                                        </div>
                                    `;
        }).join('') : '<div style="text-align:center; color:var(--text-tertiary); font-size:0.85rem;">Nessun dato disponibile.</div>'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    container.innerHTML = render();

    const deptFilter = document.getElementById('dept-filter');
    if (deptFilter) {
        deptFilter.addEventListener('change', (e) => {
            state.collaboratorServicesDept = e.target.value;
            container.innerHTML = render();
        });
    }

    window.setCollabServicesYear = (year) => {
        state.collaboratorServicesYear = year;
        container.innerHTML = render();
    };
}

export function initCollaboratorServiceModals() {
    // Inject Modals if not present
    if (!document.getElementById('collab-service-detail-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="collab-service-detail-modal" class="modal">
                <div class="modal-content" style="max-width: 500px;">
                    <button class="close-modal material-icons-round" onclick="closeCollabServiceDetail()">close</button>
                    <!-- Content injected via JS -->
                    <div id="collab-service-detail-content"></div>
                </div>
            </div>

            <div id="collab-service-edit-modal" class="modal">
                <div class="modal-content" style="max-width: 580px; padding: 0; background: var(--card-bg); border-radius: 16px; overflow: hidden; border: 1px solid var(--glass-border); box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                    <div class="modal-header" style="padding: 0.75rem 1.25rem; background: var(--bg-color); border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; margin-bottom: 0;">
                        <div style="display: flex; align-items: center; gap: 0.6rem;">
                            <div style="width: 32px; height: 32px; border-radius: 8px; background: var(--brand-gradient); display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(var(--brand-blue-rgb), 0.2);">
                                <span class="material-icons-round" style="color: white; font-size: 1.1rem;">edit_note</span>
                            </div>
                            <div>
                                <h2 id="cs-edit-title" style="margin: 0; font-family: var(--font-titles); font-weight: 700; font-size: 1.1rem; color: var(--text-primary); background: none; -webkit-text-fill-color: initial;">Aggiungi Servizio</h2>
                            </div>
                        </div>
                        <button class="close-modal material-icons-round" onclick="closeCollabServiceEdit()" style="background: none; border: none; padding: 0.4rem; cursor: pointer; color: var(--text-secondary); position: static; width: auto; height: auto;">close</button>
                    </div>

                    <form id="collab-service-edit-form" style="display: flex; flex-direction: column; max-height: 82vh;">
                        <div class="modal-scroll-area" style="padding: 1.25rem; overflow-y: auto; flex: 1;">
                            <input type="hidden" id="cs-id">
                            <input type="hidden" id="cs-order-id">
                            <input type="hidden" id="cs-name"> 
                            <input type="hidden" id="cs-service-id-ref">

                            <div class="form-grid" style="display: flex; flex-direction: column; gap: 0.85rem;">
                                <!-- Selection Section -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div class="form-group">
                                        <label style="display: flex; align-items: center; gap: 0.35rem; color: var(--text-secondary); font-weight: 600; font-size: 0.65rem; text-transform: uppercase; margin-bottom: 0.35rem; letter-spacing: 0.02em;">
                                            <span class="material-icons-round" style="font-size: 0.85rem; color: var(--brand-blue);">business_center</span> Reparto
                                        </label>
                                        <div class="custom-select-container" id="cs-dept-container" style="position: relative;">
                                            <div class="custom-select-trigger" onclick="window.toggleCsDropdown('dept')" style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; background: var(--bg-color); border: 1px solid var(--glass-border); border-radius: 8px; cursor: pointer;">
                                                <span id="cs-dept-label" style="color: var(--text-primary); font-weight: 500; font-size: 0.8rem;">Seleziona...</span>
                                                <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary);">expand_more</span>
                                                <input type="hidden" id="cs-dept" required>
                                            </div>
                                            <div class="custom-select-options" id="cs-dept-dropdown" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 100; background: var(--card-bg); border: 1px solid var(--glass-border); box-shadow: var(--shadow-xl); border-radius: 8px;">
                                                <div style="padding: 0.4rem; border-bottom: 1px solid var(--glass-border);">
                                                    <input type="text" placeholder="Cerca..." oninput="window.filterCsOptions('dept', this.value)" style="padding: 0.4rem 0.6rem; font-size: 0.75rem; border-radius: 6px; width: 100%; border: 1px solid var(--glass-border); background: var(--bg-color); color: var(--text-primary);">
                                                </div>
                                                <div class="options-list" id="cs-dept-options" style="padding: 0.25rem; max-height: 160px; overflow-y: auto;"></div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="form-group">
                                        <label style="display: flex; align-items: center; gap: 0.35rem; color: var(--text-secondary); font-weight: 600; font-size: 0.65rem; text-transform: uppercase; margin-bottom: 0.35rem; letter-spacing: 0.02em;">
                                            <span class="material-icons-round" style="font-size: 0.85rem; color: var(--brand-blue);">person</span> Collaboratore
                                        </label>
                                        <div class="custom-select-container" id="cs-collab-container" style="position: relative;">
                                            <div class="custom-select-trigger" onclick="window.toggleCsDropdown('collab')" style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; background: var(--bg-color); border: 1px solid var(--glass-border); border-radius: 8px; cursor: pointer;">
                                                <span id="cs-collab-label" style="color: var(--text-primary); font-weight: 500; font-size: 0.8rem;">Seleziona...</span>
                                                <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary);">expand_more</span>
                                                <input type="hidden" id="cs-collaborator">
                                            </div>
                                            <div class="custom-select-options" id="cs-collab-dropdown" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 100; background: var(--card-bg); border: 1px solid var(--glass-border); box-shadow: var(--shadow-xl); border-radius: 8px;">
                                                <div style="padding: 0.4rem; border-bottom: 1px solid var(--glass-border);">
                                                    <input type="text" placeholder="Cerca..." oninput="window.filterCsOptions('collab', this.value)" style="padding: 0.4rem 0.6rem; font-size: 0.75rem; border-radius: 6px; width: 100%; border: 1px solid var(--glass-border); background: var(--bg-color); color: var(--text-primary);">
                                                </div>
                                                <div class="options-list" id="cs-collab-options" style="padding: 0.25rem; max-height: 160px; overflow-y: auto;"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label style="display: flex; align-items: center; gap: 0.35rem; color: var(--text-secondary); font-weight: 600; font-size: 0.65rem; text-transform: uppercase; margin-bottom: 0.35rem; letter-spacing: 0.02em;">
                                        <span class="material-icons-round" style="font-size: 0.85rem; color: var(--brand-blue);">category</span> Servizio
                                    </label>
                                    <div class="custom-select-container" id="cs-service-container" style="position: relative;">
                                        <div class="custom-select-trigger" id="cs-service-trigger" onclick="window.toggleCsDropdown('service')" style="display: flex; align-items: center; justify-content: space-between; opacity: 0.6; pointer-events: none; padding: 0.5rem 0.75rem; background: var(--bg-color); border: 1px solid var(--glass-border); border-radius: 8px; cursor: pointer;">
                                            <span id="cs-service-label" style="color: var(--text-primary); font-weight: 500; font-size: 0.8rem;">Seleziona prima un reparto</span>
                                            <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary);">expand_more</span>
                                            <input type="hidden" id="cs-service-id-ref">
                                        </div>
                                        <div class="custom-select-options" id="cs-service-dropdown" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 100; background: var(--card-bg); border: 1px solid var(--glass-border); box-shadow: var(--shadow-xl); border-radius: 8px;">
                                            <div style="padding: 0.4rem; border-bottom: 1px solid var(--glass-border);">
                                                <input type="text" placeholder="Cerca..." oninput="window.filterCsOptions('service', this.value)" style="padding: 0.4rem 0.6rem; font-size: 0.75rem; border-radius: 6px; width: 100%; border: 1px solid var(--glass-border); background: var(--bg-color); color: var(--text-primary);">
                                            </div>
                                            <div class="options-list" id="cs-service-options" style="padding: 0.25rem; max-height: 160px; overflow-y: auto;"></div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Economic Details -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; background: var(--bg-color); padding: 0.85rem; border-radius: 12px; border: 1px solid var(--glass-border);">
                                    <div class="form-group">
                                        <label style="font-size: 0.6rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; margin-bottom: 0.35rem; display: block;">Quantità</label>
                                        <div style="position: relative;">
                                            <span class="material-icons-round" style="position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%); font-size: 0.9rem; color: var(--brand-blue);">layers</span>
                                            <input type="number" id="cs-quantity" step="0.5" required style="padding: 0.4rem 0.6rem 0.4rem 2rem; background: var(--card-bg); border: 1px solid var(--glass-border); border-radius: 6px; color: var(--text-primary); width: 100%; font-weight: 600; font-size: 0.8rem;">
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label style="font-size: 0.6rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; margin-bottom: 0.35rem; display: block;">Costo Un. (€)</label>
                                        <div style="position: relative;">
                                            <span class="material-icons-round" style="position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%); font-size: 0.9rem; color: var(--brand-blue);">payments</span>
                                            <input type="number" id="cs-unit-cost" step="0.01" required style="padding: 0.4rem 0.6rem 0.4rem 2rem; background: var(--card-bg); border: 1px solid var(--glass-border); border-radius: 6px; color: var(--text-primary); width: 100%; font-weight: 600; font-size: 0.8rem;">
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label style="font-size: 0.6rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; margin-bottom: 0.35rem; display: block;">Prezzo Un. (€)</label>
                                        <div style="position: relative;">
                                            <span class="material-icons-round" style="position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%); font-size: 0.9rem; color: var(--brand-blue);">sell</span>
                                            <input type="number" id="cs-unit-price" step="0.01" required style="padding: 0.4rem 0.6rem 0.4rem 2rem; background: var(--card-bg); border: 1px solid var(--glass-border); border-radius: 6px; color: var(--text-primary); width: 100%; font-weight: 600; font-size: 0.8rem;">
                                        </div>
                                    </div>
                                </div>

                                <!-- Result Card -->
                                <div style="background: var(--brand-gradient); padding: 1rem 1.25rem; border-radius: 12px; color: white;">
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: center;">
                                        <div style="border-right: 1px solid rgba(255,255,255,0.2);">
                                            <span style="font-size: 0.55rem; color: rgba(255,255,255,0.85); text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; display: block; margin-bottom: 0.3rem;">Piano Tariffario</span>
                                            <div style="display: flex; align-items: center; gap: 0.4rem;">
                                                <span class="material-icons-round" style="font-size: 0.9rem; opacity: 0.8;">history_toggle_off</span>
                                                <span id="cs-tariff-display" style="font-weight: 700; color: white; font-size: 0.85rem;">-</span>
                                                <input type="hidden" id="cs-tariff-type">
                                            </div>
                                        </div>
                                        <div style="display: flex; gap: 1.5rem; justify-content: space-around;">
                                            <div>
                                                <span style="font-size: 0.55rem; color: rgba(255,255,255,0.85); font-weight: 800; text-transform: uppercase; display: block;">Costo Totale</span>
                                                <div style="font-size: 1.1rem; font-weight: 800; color: white; margin-top: 0.1rem;"><span id="cs-total-cost-preview">0,00</span> €</div>
                                            </div>
                                            <div>
                                                <span style="font-size: 0.55rem; color: rgba(255,255,255,0.85); font-weight: 800; text-transform: uppercase; display: block;">Margine Totale</span>
                                                <div style="font-size: 1.1rem; font-weight: 800; color: white; margin-top: 0.1rem;"><span id="cs-total-price-preview">0,00</span> €</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="form-actions" style="padding: 0.85rem 1.25rem; background: var(--bg-color); border-top: 1px solid var(--glass-border); display: flex; gap: 0.6rem; align-items: center;">
                            <button type="button" id="cs-delete-btn" onclick="deleteCollabService()" style="margin-right: auto; background: transparent; border: 1px solid #ff4d4d; color: #ff4d4d; padding: 0.4rem 0.75rem; border-radius: 8px; font-weight: 700; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 0.3rem;">
                                <span class="material-icons-round" style="font-size: 0.9rem;">delete_outline</span> Elimina
                            </button>
                            <button type="button" class="primary-btn secondary" onclick="closeCollabServiceEdit()" style="border-radius: 8px; font-weight: 700; padding: 0.4rem 1rem; font-size: 0.8rem; background: var(--card-bg); border: 1px solid var(--glass-border); color: var(--text-primary);">Annulla</button>
                            <button type="submit" class="primary-btn" style="border-radius: 8px; font-weight: 800; padding: 0.4rem 1.5rem; font-size: 0.8rem; background: var(--brand-gradient); color: white; border: none; box-shadow: 0 4px 10px rgba(var(--brand-blue-rgb), 0.2);">Salva</button>
                        </div>
                    </form>
                </div>
            </div>
        `);
    }

    // --- Event Listeners for Dynamic Logic ---
    // We attach them to document body (delegated) or re-attach in open? 
    // Re-attaching in open is safer to ensure elements exist, BUT here we are inside init function which runs once. 
    // The modal HTML is injected now, so we can attach listeners here if elements exist. 
    // But since this function might be called when modal is already there (id check), let's assume we can attach.

    // --- Improved Custom Select Logic ---
    window.toggleCsDropdown = (key) => {
        const container = document.getElementById(`cs-${key}-container`);
        const isOpen = container.classList.contains('open');

        // Close all others
        document.querySelectorAll('.custom-select-container').forEach(c => c.classList.remove('open'));
        document.querySelectorAll('.custom-select-options').forEach(o => o.style.display = 'none');

        if (!isOpen) {
            container.classList.add('open');
            const dropdown = document.getElementById(`cs-${key}-dropdown`);
            dropdown.style.display = 'block';
            // Focus search
            const search = dropdown.querySelector('input');
            if (search) {
                search.value = '';
                search.focus();
                window.filterCsOptions(key, ''); // Reset filter
            }
        }
    };

    window.filterCsOptions = (key, term) => {
        const list = document.getElementById(`cs-${key}-options`);
        const options = list.querySelectorAll('.custom-option');
        const searchLower = (term || '').toLowerCase();

        let found = 0;
        options.forEach(opt => {
            const text = opt.textContent.toLowerCase();
            if (text.includes(searchLower)) {
                opt.style.display = 'flex';
                found++;
            } else {
                opt.style.display = 'none';
            }
        });

        const noResults = list.querySelector('.no-results');
        if (found === 0 && term) {
            if (!noResults) {
                list.insertAdjacentHTML('beforeend', `<div class="no-results" style="padding: 1.5rem; text-align: center; color: var(--text-secondary); font-size: 0.9rem; font-weight: 500;">Nessun risultato</div>`);
            }
        } else if (noResults) {
            noResults.remove();
        }
    };

    window.selectCsOption = (key, value, label, metadata = {}) => {
        const hidden = document.getElementById(`cs-${key}`);
        const labelEl = document.getElementById(`cs-${key}-label`);

        // Handle hidden input ID variation
        const targetInput = hidden || document.getElementById(key === 'service' ? 'cs-service-id-ref' : (key === 'collab' ? 'cs-collaborator' : 'cs-dept'));

        if (targetInput) targetInput.value = value;
        if (labelEl) {
            labelEl.textContent = label;
            labelEl.style.color = 'var(--text-primary)';
        }

        // Specific Logic per key
        if (key === 'dept') {
            window.csUpdateServiceList(value);
            window.csUpdateCollabList(value);
            // Reset service selection
            window.selectCsOption('service', '', 'Seleziona un servizio...', {});
        } else if (key === 'service') {
            const { cost, price, type } = metadata;
            document.getElementById('cs-name').value = label;
            if (cost) document.getElementById('cs-unit-cost').value = cost;
            if (price) document.getElementById('cs-unit-price').value = price;

            const finalType = type || 'tariffa oraria';
            document.getElementById('cs-tariff-type').value = finalType;
            document.getElementById('cs-tariff-display').textContent = finalType;

            document.getElementById('cs-unit-cost').dispatchEvent(new Event('input'));
        }

        // Close
        const container = document.getElementById(`cs-${key}-container`);
        if (container) container.classList.remove('open');
        const dropdown = document.getElementById(`cs-${key}-dropdown`);
        if (dropdown) dropdown.style.display = 'none';
    };

    // Helper to populate services based on dept
    window.csUpdateServiceList = (dept) => {
        const optionsList = document.getElementById('cs-service-options');
        const trigger = document.getElementById('cs-service-trigger');
        const currentServiceId = document.getElementById('cs-service-id-ref').value;

        if (!dept) {
            optionsList.innerHTML = '';
            trigger.style.opacity = '0.6';
            trigger.style.pointerEvents = 'none';
            document.getElementById('cs-service-label').textContent = 'Seleziona prima un reparto';
            return;
        }

        const filteredServices = (state.services || []).filter(s => {
            const tags = Array.isArray(s.tags) ? s.tags : (typeof s.tags === 'string' ? s.tags.split(',') : []);
            return tags.includes(dept);
        }).sort((a, b) => a.name.localeCompare(b.name));

        trigger.style.opacity = '1';
        trigger.style.pointerEvents = 'auto';
        document.getElementById('cs-service-label').textContent = 'Seleziona un servizio...';

        if (filteredServices.length === 0) {
            optionsList.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary); font-size: 0.9rem; font-weight: 500;">Nessun servizio in questo reparto</div>';
        } else {
            optionsList.innerHTML = filteredServices.map(s => `
                <div class="custom-option" onclick="window.selectCsOption('service', '${s.id}', '${s.name}', {cost: ${s.cost || 0}, price: ${s.price || 0}, type: '${s.type || ''}'})" style="padding: 0.75rem 1rem; display: flex; align-items: center; gap: 0.75rem; border-radius: 10px; transition: all 0.2s;">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(var(--brand-blue-rgb), 0.05); color: var(--brand-blue); display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons-round" style="font-size: 1.1rem;">category</span>
                    </div>
                    <div>
                        <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem; margin-bottom: 2px;">${s.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 500; text-transform: uppercase; letter-spacing: 0.02em;">${s.type || 'prestazione'}</div>
                    </div>
                </div>
            `).join('');
        }
    };

    // Helper to populate collaborators based on dept
    window.csUpdateCollabList = (dept) => {
        const optionsList = document.getElementById('cs-collab-options');

        let filteredCollabs = (state.collaborators || []).filter(c => c.is_active !== false && c.active !== false);

        if (dept) {
            const deptLower = dept.toLowerCase();
            filteredCollabs = filteredCollabs.filter(c => {
                const tags = Array.isArray(c.tags) ? c.tags : (typeof c.tags === 'string' ? c.tags.split(',') : []);
                const normalizedTags = tags.map(t => t.trim().toLowerCase());
                const role = (c.role || '').toLowerCase();
                return normalizedTags.includes(deptLower) || role.includes(deptLower) || normalizedTags.some(t => deptLower.includes(t));
            });
        }

        if (filteredCollabs.length === 0) {
            optionsList.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary); font-size: 0.9rem; font-weight: 500;">Nessun collaboratore trovato</div>';
            return;
        }

        optionsList.innerHTML = filteredCollabs.map(c => `
            <div class="custom-option" onclick="window.selectCsOption('collab', '${c.id}', '${c.full_name}')" style="padding: 0.75rem 1rem; display: flex; align-items: center; gap: 0.75rem; border-radius: 10px; transition: all 0.2s;">
                <div style="width: 32px; height: 32px; border-radius: 10px; background: var(--bg-secondary); color: var(--brand-blue); display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; border: 1px solid var(--glass-border);">
                    ${c.full_name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                    <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem; margin-bottom: 2px;">${c.full_name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 500; text-transform: uppercase; letter-spacing: 0.02em;">${c.role || 'Collaboratore'}</div>
                </div>
            </div>
        `).join('');
    };

    // Global Click Listener for Custom Selects
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-select-container')) {
            document.querySelectorAll('.custom-select-container').forEach(c => c.classList.remove('open'));
            document.querySelectorAll('.custom-select-options').forEach(o => o.style.display = 'none');
        }
    });

    // Modal Operations
    window.closeCollabServiceDetail = () => document.getElementById('collab-service-detail-modal').classList.remove('active');
    window.closeCollabServiceEdit = () => document.getElementById('collab-service-edit-modal').classList.remove('active');

    window.openCollaboratorServiceDetail = (id) => {
        const s = state.collaboratorServices.find(x => x.id === id);
        if (!s) return;

        const content = document.getElementById('collab-service-detail-content');
        const serviceName = s.services?.name || s.legacy_service_name || s.name;
        const collabName = s.collaborators?.full_name || s.legacy_collaborator_name || 'Non assegnato';
        const qty = s.hours || s.months || s.spot_quantity || s.quantity || 0;

        content.innerHTML = `
            <div style="text-align: center; margin-bottom: 2rem;">
                <div style="font-size: 0.85rem; color: var(--text-tertiary); margin-bottom: 0.5rem;">${s.name}</div>
                <h2 style="font-family: var(--font-titles); font-weight: 400; font-size: 1.5rem; margin-bottom: 0.5rem; line-height: 1.2;">
                    ${serviceName}
                </h2>
                <div style="display: inline-flex; align-items: center; gap: 0.5rem; background: var(--bg-secondary); padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.9rem; font-weight: 400; color: var(--text-secondary);">
                    <span class="material-icons-round" style="font-size: 1rem;">person</span>
                    ${collabName}
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                <div>
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-tertiary); font-weight: 400; margin-bottom: 0.25rem;">Quantità</div>
                    <div style="font-size: 1rem; color: var(--text-primary); font-weight: 500;">${qty}</div>
                </div>
                <div>
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-tertiary); font-weight: 400; margin-bottom: 0.25rem;">Costo Base</div>
                    <div style="font-size: 1rem; color: var(--text-primary); font-weight: 500;">${formatAmount(s.unit_cost)} €</div>
                </div>
                <div>
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-tertiary); font-weight: 400; margin-bottom: 0.25rem;">Prezzo Base</div>
                    <div style="font-size: 1rem; color: var(--text-primary); font-weight: 500;">${formatAmount(s.unit_price)} €</div>
                </div>
                <div>
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-tertiary); font-weight: 400; margin-bottom: 0.25rem;">Tipo Tariffa</div>
                    <div style="font-size: 1rem; color: var(--text-primary); font-weight: 500;">${s.tariff_type || '-'}</div>
                </div>
                <div>
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-tertiary); font-weight: 400; margin-bottom: 0.25rem;">Costo Totale</div>
                    <div style="font-size: 1.2rem; color: var(--error-color); font-weight: 400;">${formatAmount(s.total_cost)} €</div>
                </div>
                <div>
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-tertiary); font-weight: 400; margin-bottom: 0.25rem;">Prezzo Totale</div>
                    <div style="font-size: 1.2rem; color: var(--success-color); font-weight: 400;">${formatAmount(s.total_price)} €</div>
                </div>
            </div>

            <div class="form-actions" style="justify-content: flex-end; gap: 1rem; border-top: 1px solid var(--glass-border); padding-top: 1.5rem;">
                <button class="primary-btn secondary danger" onclick="window.confirmDeleteCollabService('${s.id}')">Elimina</button>
                <button class="primary-btn secondary" onclick="window.goToAssignment('${s.order_id}', '${s.collaborator_id}')">Vedi Incarico</button>
                <button class="primary-btn" onclick="window.openCollaboratorServiceEdit('${s.id}')">Modifica</button>
            </div>
        `;

        document.getElementById('collab-service-detail-modal').classList.add('active');
    };

    window.openCollaboratorServiceEdit = async (id = null, prefillOrderId = null) => {
        window.closeCollabServiceDetail(); // Close detail if open
        const modal = document.getElementById('collab-service-edit-modal');
        const form = document.getElementById('collab-service-edit-form');
        form.reset();

        // Ensure Data Loaded
        if (!state.departments || !state.services) {
            const { fetchServices } = await import('../modules/api.js?v=1000');
            // We assume departments are loaded in main state, but if not we might need to refresh them.
            // Usually dashboard loads them.
            await fetchServices();
        }

        // Populate Depts 
        const deptOptions = document.getElementById('cs-dept-options');
        const depts = state.departments || [];
        deptOptions.innerHTML = depts.map(d => `
            <div class="custom-option" onclick="window.selectCsOption('dept', '${d.name}', '${d.name}')" style="padding: 0.75rem 1rem; display: flex; align-items: center; gap: 0.75rem; border-radius: 10px; transition: all 0.2s;">
                <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(var(--brand-blue-rgb), 0.1); color: var(--brand-blue); display: flex; align-items: center; justify-content: center;">
                    <span class="material-icons-round" style="font-size: 1.1rem;">business_center</span>
                </div>
                <span style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${d.name}</span>
            </div>
        `).join('');

        if (id) {
            document.getElementById('cs-edit-title').textContent = 'Modifica Servizio';
            document.getElementById('cs-delete-btn').style.display = 'block';
            window.currentEditingServiceId = id; // Temp store

            const s = state.collaboratorServices.find(x => x.id === id);
            if (s) {
                document.getElementById('cs-id').value = s.id;
                document.getElementById('cs-order-id').value = s.order_id || '';

                // Set Department UI manually to avoid resets in selectCsOption
                const dept = s.department || '';
                document.getElementById('cs-dept').value = dept;
                const deptLabel = document.getElementById('cs-dept-label');
                if (deptLabel) {
                    deptLabel.textContent = dept || 'Seleziona...';
                    deptLabel.style.color = dept ? 'var(--text-primary)' : 'var(--text-tertiary)';
                }

                // Populate Service and Collab lists based on dept
                window.csUpdateServiceList(dept);
                window.csUpdateCollabList(dept);

                // Set Service UI
                if (s.service_id) {
                    const sObj = state.services?.find(x => x.id === s.service_id);
                    if (sObj) {
                        document.getElementById('cs-service-id-ref').value = sObj.id;
                        const sLabel = document.getElementById('cs-service-label');
                        if (sLabel) {
                            sLabel.textContent = sObj.name;
                            sLabel.style.color = 'var(--text-primary)';
                        }
                    }
                }

                document.getElementById('cs-name').value = s.legacy_service_name || s.name;

                // Set Tariff Display
                const tType = s.tariff_type || 'tariffa oraria';
                document.getElementById('cs-tariff-type').value = tType;
                document.getElementById('cs-tariff-display').textContent = tType;

                // Set Collaborator UI
                const cId = s.collaborator_id || '';
                document.getElementById('cs-collaborator').value = cId;
                if (cId) {
                    const cObj = state.collaborators.find(c => c.id == cId);
                    if (cObj) {
                        const cLabel = document.getElementById('cs-collab-label');
                        if (cLabel) {
                            cLabel.textContent = cObj.full_name;
                            cLabel.style.color = 'var(--text-primary)';
                        }
                    }
                } else {
                    const cLabel = document.getElementById('cs-collab-label');
                    if (cLabel) {
                        cLabel.textContent = 'Seleziona...';
                        cLabel.style.color = 'var(--text-tertiary)';
                    }
                }


                const qty = s.hours || s.months || s.spot_quantity || s.quantity || 0;
                document.getElementById('cs-quantity').value = qty;
                document.getElementById('cs-unit-cost').value = s.unit_cost;
                document.getElementById('cs-unit-price').value = s.unit_price;

                updatePreviews(qty, s.unit_cost, s.unit_price);
            }
        } else {
            document.getElementById('cs-edit-title').textContent = 'Aggiungi Servizio';
            document.getElementById('cs-id').value = '';
            document.getElementById('cs-delete-btn').style.display = 'none';
            document.getElementById('cs-service-id-ref').value = '';

            // Reset UI labels
            window.selectCsOption('dept', '', 'Seleziona...', {});
            window.selectCsOption('service', '', 'Seleziona un reparto prima', {});
            window.selectCsOption('collab', '', 'Seleziona...', {});

            document.getElementById('cs-tariff-display').textContent = '-';

            if (prefillOrderId) document.getElementById('cs-order-id').value = prefillOrderId;
        }

        modal.classList.add('active');
    };

    window.confirmDeleteCollabService = async (id) => {
        if (await window.showConfirm("Sei sicuro di voler eliminare questo servizio?", { type: 'danger' })) {
            try {
                await deleteCollaboratorService(id);
                window.closeCollabServiceDetail();
                window.closeCollabServiceEdit();
                refreshPage();
            } catch (e) {
                window.showAlert("Errore eliminazione: " + e.message, 'error');
            }
        }
    };

    window.deleteCollabService = () => {
        const id = document.getElementById('cs-id').value;
        if (id) window.confirmDeleteCollabService(id);
    };

    // Auto-calc logic
    const updatePreviews = (q, cost, price) => {
        document.getElementById('cs-total-cost-preview').textContent = formatAmount(q * cost);
        document.getElementById('cs-total-price-preview').textContent = formatAmount(q * price);
    };

    ['cs-quantity', 'cs-unit-cost', 'cs-unit-price'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            const q = parseFloat(document.getElementById('cs-quantity').value) || 0;
            const c = parseFloat(document.getElementById('cs-unit-cost').value) || 0;
            const p = parseFloat(document.getElementById('cs-unit-price').value) || 0;
            updatePreviews(q, c, p);
        });
    });

    // Submit Logic
    document.getElementById('collab-service-edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const tariffType = document.getElementById('cs-tariff-type').value;
        const q = parseFloat(document.getElementById('cs-quantity').value) || 0;
        const cost = parseFloat(document.getElementById('cs-unit-cost').value) || 0;
        const price = parseFloat(document.getElementById('cs-unit-price').value) || 0;

        // Determine quantity field based on type
        const qtyFields = {
            quantity: q,
            hours: (tariffType === 'tariffa oraria') ? q : null,
            months: (tariffType === 'tariffa mensile' || tariffType === 'tariffa annuale') ? q : null,
            spot_quantity: (tariffType === 'tariffa spot') ? q : null,
        };

        const formData = {
            id: document.getElementById('cs-id').value || undefined,
            order_id: document.getElementById('cs-order-id').value || null,
            legacy_service_name: document.getElementById('cs-name').value,
            name: document.getElementById('cs-name').value,
            service_id: document.getElementById('cs-service-id-ref').value || null, // Capture catalog ID
            department: document.getElementById('cs-dept').value,
            tariff_type: tariffType,
            collaborator_id: document.getElementById('cs-collaborator').value || null, // Grab from hidden input

            ...qtyFields,
            unit_cost: cost,
            unit_price: price,
            total_cost: q * cost,
            total_price: q * price
        };

        try {
            await upsertCollaboratorService(formData);
            window.closeCollabServiceEdit();
            refreshPage();
        } catch (err) {
            window.showAlert('Errore salvataggio: ' + err.message, 'error');
        }
    });

    async function refreshPage() {
        // If in main registry
        if (state.currentPage === 'collaborator-services') {
            const { fetchCollaboratorServices } = await import('../modules/api.js?v=1000');
            await fetchCollaboratorServices();
            renderCollaboratorServices(document.getElementById('content-area'));
            return;
        }

        // If in order detail (check hash or state)
        const hash = window.location.hash;
        if (hash.includes('order-detail')) {
            const parts = hash.split('/');
            const orderId = parts[parts.length - 1] || state.currentOrderId;

            if (orderId) {
                const { fetchCollaboratorServices, fetchAssignments } = await import('../modules/api.js?v=1000');
                const { renderOrderDetail } = await import('./orders.js?v=1000');

                await fetchCollaboratorServices();
                await fetchAssignments();
                renderOrderDetail(document.getElementById('content-area'), orderId);
            }
        }
    }

    window.goToAssignment = (orderId, collabId) => {
        const assignment = state.assignments.find(a => a.order_id === orderId && a.collaborator_id === collabId);
        if (assignment) {
            window.location.hash = `#assignment-detail/${assignment.id}`;
            window.closeCollabServiceDetail();
        } else {
            window.showAlert("Nessun incarico formale trovato per questa coppia ordine/collaboratore.", 'warning');
        }
    };
}
