import { state } from '/js/modules/state.js';
import { formatAmount, showGlobalAlert } from '../modules/utils.js?v=1000';
import { upsertPayment, deletePayment, upsertBankTransaction, fetchPayments } from '../modules/api.js';

let cashFlowChartInstance = null;

export function renderPaymentsDashboard(container) {
    if (typeof window !== 'undefined') {
        window.openPaymentModal = openPaymentModal;
    }

    if (!state.payments) state.payments = [];
    if (!state.paymentsFilterType) state.paymentsFilterType = 'all';
    if (!state.activePaymentsTab) state.activePaymentsTab = 'overdue';

    const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

    const updateUI = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const allPending = state.payments.filter(p => p.status !== 'Completato' && p.status !== 'Done');

        const categorize = (itemsList) => {
            const overdue = [];
            const nodate = [];
            const scheduled = [];
            const waiting = [];

            itemsList.forEach(p => {
                if (p.status === 'Invito Inviato') {
                    waiting.push(p);
                } else if (!p.due_date) {
                    nodate.push(p);
                } else {
                    const d = new Date(p.due_date);
                    if (d < today) overdue.push(p);
                    else scheduled.push(p);
                }
            });
            return { overdue, nodate, scheduled, waiting };
        };

        const entrateRaw = allPending.filter(p => p.payment_type === 'Cliente');
        const usciteRaw = allPending.filter(p => p.payment_type !== 'Cliente');

        const entrateData = categorize(entrateRaw);
        const usciteData = categorize(usciteRaw);

        const entrateTotal = entrateRaw.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const usciteTotal = usciteRaw.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const nettoTotal = entrateTotal - usciteTotal;

        const renderKpiRow = (label, icon, color, items, type) => {
            const total = items.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
            if (items.length === 0) return '';
            return `
                <div class="kpi-sub-row clickable-row" data-type="${type}" data-category='${JSON.stringify(items.map(i => i.id))}' data-title="${label}" style="display: flex; align-items: center; justify-content: space-between; width: 100%; border-radius: 10px; padding: 0.75rem 0.5rem; transition: all 0.2s;">
                    <div style="display: flex; align-items: center; min-width: 0; flex-shrink: 1;">
                        <span class="material-icons-round" style="font-size: 1.1rem; color: ${color}; margin-right: 0.75rem; flex-shrink: 0;">${icon}</span>
                        <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${label}</span>
                    </div>
                    <div style="display: flex; align-items: center; flex-shrink: 0; margin-left: 0.5rem;">
                        <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); background: rgba(0,0,0,0.06); padding: 0.15rem 0.6rem; border-radius: 20px; min-width: 24px; text-align: center; margin-right: 0.5rem; flex-shrink: 0;">${items.length}</span>
                        <span style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary); white-space: nowrap;">€ ${formatAmount(total)}</span>
                    </div>
                </div>
            `;
        };

        container.innerHTML = `
            <div class="animate-fade-in payments-container" style="width: 100%; max-width: 100%; margin: 0; padding: 1.5rem 2rem;">
                
                <div class="dashboard-grid-layout" style="display: grid; grid-template-columns: 340px 1fr; gap: 1.25rem; align-items: stretch; height: calc(100vh - 130px);">
                    
                    <!-- LEFT COLUMN: KPIs -->
                    <div class="flex-column custom-scrollbar" style="gap: 1.25rem; overflow-y: auto; padding-right: 4px;">
                        
                        <!-- FLUSSO NETTO -->
                        <div class="glass-card flex-column" style="padding: 1.25rem; gap: 1rem; border-top: 4px solid var(--brand-blue); transition: transform 0.2s;">
                            <div class="flex-between">
                                <div class="flex-start" style="gap: 1rem;">
                                    <div class="icon-container icon-info icon-container-sm" style="border-radius: 12px; background: rgba(0, 102, 255, 0.1); color: var(--brand-blue);">
                                        <span class="material-icons-round">account_balance</span>
                                    </div>
                                    <div class="flex-column">
                                        <span style="font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">Flusso Netto Previsto</span>
                                        <span style="font-size: 1.5rem; font-weight: 800; color: ${nettoTotal >= 0 ? 'var(--brand-blue)' : 'var(--error-soft)'};">
                                            ${nettoTotal >= 0 ? '+' : ''} € ${formatAmount(nettoTotal)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- ENTRATE -->
                        <div class="glass-card flex-column clickable-header" data-type="entrate" style="padding: 1.25rem; gap: 1rem; border-top: 4px solid var(--success-soft); cursor: pointer; transition: transform 0.2s;">
                            <div class="flex-between">
                                <div class="flex-start" style="gap: 1rem;">
                                    <div class="icon-container icon-success icon-container-sm" style="border-radius: 12px;">
                                        <span class="material-icons-round">trending_up</span>
                                    </div>
                                    <div class="flex-column">
                                        <span style="font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">Entrate Attese</span>
                                        <span style="font-size: 1.3rem; font-weight: 800; color: var(--text-primary);">€ ${formatAmount(entrateTotal)}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="flex-column kpi-rows-wrapper" style="gap: 0.1rem; background: rgba(0,0,0,0.02); padding: 0.4rem; border-radius: 12px;" onclick="event.stopPropagation()">
                                ${renderKpiRow('In Ritardo', 'warning', 'var(--error-soft)', entrateData.overdue, 'entrate')}
                                ${renderKpiRow('Senza Data', 'help_outline', 'var(--text-tertiary)', entrateData.nodate, 'entrate')}
                                ${renderKpiRow('In Programma', 'event_available', 'var(--success-soft)', entrateData.scheduled, 'entrate')}
                            </div>
                        </div>

                        <!-- USCITE -->
                        <div class="glass-card flex-column clickable-header" data-type="uscite" style="padding: 1.25rem; gap: 1rem; border-top: 4px solid var(--error-soft); cursor: pointer; transition: transform 0.2s;">
                            <div class="flex-between">
                                <div class="flex-start" style="gap: 1rem;">
                                    <div class="icon-container icon-error icon-container-sm" style="border-radius: 12px;">
                                        <span class="material-icons-round">trending_down</span>
                                    </div>
                                    <div class="flex-column">
                                        <span style="font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">Uscite Attese</span>
                                        <span style="font-size: 1.3rem; font-weight: 800; color: var(--text-primary);">€ ${formatAmount(usciteTotal)}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="flex-column kpi-rows-wrapper" style="gap: 0.1rem; background: rgba(0,0,0,0.02); padding: 0.4rem; border-radius: 12px;" onclick="event.stopPropagation()">
                                ${renderKpiRow('In Ritardo', 'warning', 'var(--error-soft)', usciteData.overdue, 'uscite')}
                                ${renderKpiRow('Senza Data', 'help_outline', 'var(--text-tertiary)', usciteData.nodate, 'uscite')}
                                ${renderKpiRow('In Programma', 'event_available', 'var(--success-soft)', usciteData.scheduled, 'uscite')}
                                ${renderKpiRow('In Attesa Fattura', 'mail', '#f59e0b', usciteData.waiting, 'uscite')}
                            </div>
                        </div>
                    </div>

                    <!-- RIGHT COLUMN: DYNAMIC CONTENT -->
                    <div id="payments-right-panel" class="glass-card flex-column" style="padding: 1.25rem; gap: 1.25rem; height: 100%; position: relative; overflow: hidden;">
                        <div id="chart-content-view" class="flex-column" style="height: 100%;">
                            <div class="flex-between" style="margin-bottom: 1.5rem; flex-shrink: 0;">
                                <div class="flex-start" style="gap: 1rem;">
                                    <div class="icon-container icon-container-sm" style="background: var(--glass-highlight); color: var(--text-secondary); border-radius: 12px;">
                                        <span class="material-icons-round">show_chart</span>
                                    </div>
                                    <div class="flex-column">
                                        <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px;">Andamento Flussi di Cassa</span>
                                    </div>
                                </div>
                            </div>
                            <!-- Scrollable Wrapper for Chart -->
                            <div class="custom-scrollbar" style="flex: 1; width: 100%; overflow-x: auto; position: relative;">
                                <div id="chart-scroll-canvas" style="height: 100%; position: relative;">
                                    <canvas id="cashflow-chart"></canvas>
                                </div>
                            </div>
                        </div>
                        <div id="list-content-view" style="display: none; height: 100%; flex-direction: column;">
                            <div class="flex-between" style="margin-bottom: 1.5rem;">
                                <div class="flex-start" style="gap: 1rem;">
                                    <button id="btn-back-to-chart" class="icon-container icon-container-sm" style="background: var(--glass-highlight); color: var(--text-secondary); border-radius: 12px; border: none; cursor: pointer;">
                                        <span class="material-icons-round">arrow_back</span>
                                    </button>
                                    <div class="flex-column">
                                        <span id="list-view-subtitle" style="font-size: 0.75rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px;">Dettaglio Pagamenti</span>
                                        <span id="list-view-title" style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">---</span>
                                    </div>
                                </div>
                                <div id="list-view-total" style="font-weight: 700; font-size: 1.1rem; color: var(--brand-blue);">€ 0,00</div>
                            </div>
                            <div id="dashboard-payments-list" style="flex: 1; overflow-y: auto; padding-right: 0.5rem;">
                                <!-- Cards will be injected here -->
                            </div>
                        </div>
                    </div>
                </div>

                <style>
                    @media (max-width: 1024px) {
                        .payments-container {
                            padding: 1rem !important;
                        }
                        .dashboard-grid-layout {
                            grid-template-columns: 1fr !important;
                            height: auto !important;
                            gap: 1.5rem !important;
                        }
                        .dashboard-grid-layout > .custom-scrollbar {
                            overflow-y: visible !important;
                        }
                        #payments-right-panel {
                            min-height: 500px;
                        }
                    }
                    .kpi-sub-row {
                        display: grid;
                        grid-template-columns: 24px 1fr auto;
                        align-items: center;
                        gap: 0.75rem;
                        padding: 0.75rem 0.5rem;
                        border-radius: 10px;
                        transition: all 0.2s;
                        cursor: pointer;
                        width: 100%;
                    }
                    .kpi-sub-row .row-icon {
                        font-size: 1.1rem;
                    }
                    .kpi-sub-row .row-label {
                        font-size: 0.85rem;
                        font-weight: 500;
                        color: var(--text-secondary);
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .kpi-sub-row .row-values {
                        display: flex;
                        align-items: center;
                        gap: 0.75rem;
                    }
                    .kpi-sub-row .row-total {
                        font-weight: 600;
                        font-size: 0.85rem;
                        color: var(--text-primary);
                        white-space: nowrap;
                    }
                    .kpi-sub-row:hover {
                        background: white;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                        transform: translateX(4px);
                    }
                    .kpi-sub-row:not(:last-child) {
                        border-bottom: 1px solid rgba(0,0,0,0.03);
                    }
                </style>
            </div>
        `;

        container.querySelectorAll('.clickable-row').forEach(row => {
            row.addEventListener('click', (e) => {
                e.stopPropagation();
                const title = row.dataset.title;
                const type = row.dataset.type;

                if (window.innerWidth <= 1024) {
                    // Switch tab
                    if (title.includes('Ritardo')) state.activePaymentsTab = 'overdue';
                    else if (title.includes('Data')) state.activePaymentsTab = 'nodate';
                    else if (title.includes('Programma')) state.activePaymentsTab = 'scheduled';
                    else if (title.includes('Attesa')) state.activePaymentsTab = 'waiting';

                    const data = type === 'entrate' ? entrateData : usciteData;
                    const viewTitle = type === 'entrate' ? 'Riepilogo Entrate' : 'Riepilogo Uscite';
                    renderCombinedSummary(viewTitle, data);
                } else {
                    const ids = JSON.parse(row.dataset.category);
                    const filtered = state.payments.filter(p => ids.includes(p.id));
                    const total = filtered.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

                    container.querySelector('#chart-content-view').style.display = 'none';
                    const listView = container.querySelector('#list-content-view');
                    listView.style.display = 'flex';
                    listView.querySelector('#list-view-title').textContent = title;
                    listView.querySelector('#list-view-total').textContent = `€ ${formatAmount(total)}`;

                    const listContainer = listView.querySelector('#dashboard-payments-list');
                    listContainer.style.display = 'block';
                    listContainer.innerHTML = filtered.map(p => renderCard(p)).join('');

                    // Smooth scroll to list on mobile
                    if (window.innerWidth <= 1024) {
                        setTimeout(() => {
                            container.querySelector('#payments-right-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 50);
                    }
                }
            });
        });

        const renderCombinedSummary = (title, categorized, isBulk = false) => {
            const isUscite = title.includes('Uscite');
            container.querySelector('#chart-content-view').style.display = 'none';
            const listView = container.querySelector('#list-content-view');
            listView.style.display = 'flex';
            listView.querySelector('#list-view-title').textContent = title;

            const totalArea = listView.querySelector('#list-view-total');
            const listContainer = listView.querySelector('#dashboard-payments-list');

            const isMobile = window.innerWidth <= 1024;

            // Initialize Switcher State if missing or invalid
            const tabList = [
                { id: 'overdue', label: 'In Ritardo', icon: 'warning', color: 'var(--error-soft)', items: categorized.overdue || [] },
                { id: 'nodate', label: 'Senza Data', icon: 'help_outline', color: 'var(--text-tertiary)', items: categorized.nodate || [] },
                { id: 'scheduled', label: 'In Programma', icon: 'event_available', color: 'var(--success-soft)', items: categorized.scheduled || [] }
            ];
            if (isUscite && (categorized.waiting?.length > 0 || !isBulk)) {
                tabList.push({ id: 'waiting', label: 'In Attesa Fattura', icon: 'mail', color: '#f59e0b', items: categorized.waiting || [] });
            }

            if (!state.activePaymentsTab || !tabList.find(t => t.id === state.activePaymentsTab)) {
                state.activePaymentsTab = 'overdue';
            }

            if (isBulk) {
                const selected = state.payments.filter(p => state.selectedPaymentIds.includes(p.id));
                const count = selected.length;
                const total = selected.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

                if (isMobile) {
                    totalArea.innerHTML = ''; // Clear header area on mobile
                    let floatingBar = container.querySelector('#mobile-bulk-floating-bar');
                    if (!floatingBar) {
                        floatingBar = document.createElement('div');
                        floatingBar.id = 'mobile-bulk-floating-bar';
                        container.appendChild(floatingBar);
                    }
                    floatingBar.innerHTML = `
                        <div style="position: fixed; bottom: 30px; left: 1rem; right: 1rem; z-index: 1000; animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);">
                            <div class="glass-card" style="padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(245, 158, 11, 0.4); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15); border-radius: 24px;">
                                <div class="flex-column" style="gap: 2px;">
                                    <div class="flex-start" style="gap: 0.4rem; align-items: center;">
                                        <span class="material-icons-round" style="font-size: 0.9rem; color: #f59e0b;">check_circle</span>
                                        <span style="font-size: 0.7rem; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px;">${count} Selezionati</span>
                                    </div>
                                    <span style="font-size: 1.2rem; font-weight: 800; color: var(--text-primary);">€ ${formatAmount(total)}</span>
                                </div>
                                <div class="flex-start" style="gap: 0.5rem;">
                                    <button id="btn-bulk-cancel-mob" class="icon-container" style="width: 42px; height: 42px; background: rgba(0,0,0,0.05); color: var(--text-secondary); border: none; border-radius: 50%; cursor: pointer;">
                                        <span class="material-icons-round">close</span>
                                    </button>
                                    <button id="btn-bulk-confirm-mob" class="primary-btn" style="padding: 0.75rem 1.25rem; background: #f59e0b; border: none; font-weight: 700; border-radius: 16px; color: white; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);" ${count === 0 ? 'disabled' : ''}>
                                        Invita Ora
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                    floatingBar.querySelector('#btn-bulk-cancel-mob').onclick = (e) => {
                        e.stopPropagation();
                        state.isBulkInviteMode = false;
                        state.selectedPaymentIds = [];
                        renderCombinedSummary(title, isUscite ? usciteData : entrateData, false);
                    };
                    floatingBar.querySelector('#btn-bulk-confirm-mob').onclick = (e) => {
                        e.stopPropagation();
                        handleBulkInvite();
                    };
                } else {
                    // Desktop Bar
                    totalArea.innerHTML = `
                        <div class="flex-start" style="gap: 1.25rem; align-items: center; background: rgba(245, 158, 11, 0.08); padding: 0.5rem 1rem; border-radius: 12px; border: 1px solid rgba(245, 158, 11, 0.3); animation: fadeIn 0.3s ease;">
                            <div class="flex-column" style="line-height: 1;">
                                <span style="font-size: 0.6rem; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px;">Selezionati</span>
                                <span style="font-size: 0.9rem; font-weight: 800; color: var(--text-primary); mt-1;">${count}</span>
                            </div>
                            <div class="flex-column" style="line-height: 1; border-left: 1px solid rgba(245, 158, 11, 0.2); padding-left: 1.25rem;">
                                <span style="font-size: 0.6rem; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px;">Totale</span>
                                <span style="font-size: 0.9rem; font-weight: 800; color: #d97706; mt-1;">€ ${formatAmount(total)}</span>
                            </div>
                            <div class="flex-start" style="gap: 0.5rem; margin-left: 0.75rem;">
                                <button id="btn-bulk-cancel" class="primary-btn secondary" style="padding: 0.4rem 0.75rem; font-size: 0.7rem; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); background: white;">Annulla</button>
                                <button id="btn-bulk-confirm" class="primary-btn" style="padding: 0.4rem 1rem; font-size: 0.7rem; background: #f59e0b; border: none; font-weight: 700; border-radius: 8px; color: white;" ${count === 0 ? 'disabled' : ''}>Invita Ora</button>
                            </div>
                        </div>
                    `;
                    totalArea.querySelector('#btn-bulk-cancel').onclick = () => {
                        state.isBulkInviteMode = false;
                        state.selectedPaymentIds = [];
                        renderCombinedSummary(title, isUscite ? usciteData : entrateData, false);
                    };
                    totalArea.querySelector('#btn-bulk-confirm').onclick = () => handleBulkInvite();
                }
            } else {
                // Not bulk mode
                const floatingBar = container.querySelector('#mobile-bulk-floating-bar');
                if (floatingBar) floatingBar.remove();

                if (isUscite) {
                    totalArea.innerHTML = `
                        <button id="btn-dashboard-bulk" class="primary-btn" style="padding: 0.5rem 1rem; font-size: 0.8rem; border-radius: 10px; background: #f59e0b; border: none; font-weight: 600; color: white;">
                            <span class="material-icons-round" style="font-size: 1rem; margin-right: 0.3rem;">library_add</span> Genera Invito Multiplo
                        </button>
                    `;
                    totalArea.querySelector('#btn-dashboard-bulk').onclick = () => {
                        state.isBulkInviteMode = true;
                        state.selectedPaymentIds = [];
                        renderCombinedSummary(title, usciteData, true);
                    };
                } else {
                    totalArea.innerHTML = '';
                }
            }

            if (isMobile) {
                // Layout Mobile: TABS + SINGLE LIST
                listContainer.style.display = 'flex';
                listContainer.style.flexDirection = 'column';
                listContainer.style.gridTemplateColumns = 'none';
                listContainer.style.gap = '1.5rem';

                const tabsHtml = `
                    <div class="flex-between" style="gap: 0.5rem; flex-shrink: 0; margin-bottom: 0.5rem;">
                        ${tabList.map(t => {
                    const isActive = state.activePaymentsTab === t.id;
                    return `
                                <div class="payment-tab-btn ${isActive ? 'active' : ''}" 
                                     data-tab-id="${t.id}"
                                     style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0.7rem 0.2rem; border-radius: 12px; border: 2px solid ${isActive ? 'var(--brand-blue)' : 'var(--glass-border)'}; background: ${isActive ? 'var(--brand-blue)' : 'white'}; cursor: pointer; transition: all 0.2s; min-width: 0;">
                                    <span class="material-icons-round" style="font-size: 1rem; color: ${isActive ? 'white' : t.color}; margin-bottom: 0.2rem;">${t.icon}</span>
                                    <span style="font-size: 0.55rem; font-weight: 700; color: ${isActive ? 'white' : 'var(--text-tertiary)'}; text-transform: uppercase; white-space: nowrap;">${t.label.includes('Attesa') ? 'ATTESA' : t.label.toUpperCase()}</span>
                                    <span style="font-size: 1.1rem; font-weight: 800; color: ${isActive ? 'white' : 'var(--text-primary)'}; line-height: 1; margin-top: 2px;">${t.items.length}</span>
                                </div>
                            `;
                }).join('')}
                    </div>
                `;

                const activeTab = tabList.find(t => t.id === state.activePaymentsTab);
                const listHtml = `
                    <div class="flex-column" style="gap: 0.75rem;">
                        ${activeTab.items.map(p => renderCard(p, isBulk)).join('')}
                        ${activeTab.items.length === 0 ? '<div style="padding: 3rem 1.5rem; text-align: center; color: var(--text-tertiary); font-style: italic; font-size: 0.85rem; background: var(--glass-highlight); border-radius: 16px;">Nessun pagamento in questa categoria</div>' : ''}
                    </div>
                `;

                listContainer.innerHTML = tabsHtml + listHtml;

                // Tab Event Listeners
                listContainer.querySelectorAll('.payment-tab-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        state.activePaymentsTab = btn.dataset.tabId;
                        renderCombinedSummary(title, categorized, isBulk);
                    });
                });

            } else {
                // Layout Desktop: MULTI-COLUMN GRID
                listContainer.style.display = 'grid';
                listContainer.style.gridAutoFlow = 'column';
                const colCount = (isUscite && (categorized.waiting?.length > 0 || !isBulk)) ? 4 : 3;
                listContainer.style.gridTemplateColumns = `repeat(${colCount}, minmax(240px, 1fr))`;
                listContainer.style.gap = '1.25rem';
                listContainer.style.overflow = 'hidden';

                const renderColumn = (label, icon, color, items) => `
                    <div class="flex-column" style="gap: 0.75rem; min-width: 0; height: 100%; overflow: hidden;">
                        <div class="flex-between" style="padding: 0.5rem 0.75rem; background: var(--glass-highlight); border-radius: 12px; flex-shrink: 0; border: 1px solid var(--glass-border);">
                            <div class="flex-start" style="gap: 0.5rem;">
                                <span class="material-icons-round" style="font-size: 1.1rem; color: ${color};">${icon}</span>
                                <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">${label}</span>
                            </div>
                            <span class="badge badge-neutral" style="font-size: 0.75rem; padding: 0.2rem 0.5rem; background: white; font-weight: 700;">${items.length}</span>
                        </div>
                        <div class="flex-column custom-scrollbar" style="gap: 0.6rem; overflow-y: auto; flex: 1; padding-right: 4px;">
                            ${items.map(p => renderCard(p, isBulk)).join('')}
                            ${items.length === 0 ? '<div style="padding: 2rem; text-align: center; color: var(--text-tertiary); font-style: italic; font-size: 0.85rem;">Nessun pagamento</div>' : ''}
                        </div>
                    </div>
                `;

                let html = `
                    ${renderColumn('In Ritardo', 'warning', 'var(--error-soft)', categorized.overdue)}
                    ${renderColumn('Senza Data', 'help_outline', 'var(--text-tertiary)', categorized.nodate)}
                    ${renderColumn('In Programma', 'event_available', 'var(--success-soft)', categorized.scheduled)}
                `;

                if (isUscite && (categorized.waiting?.length > 0 || !isBulk)) {
                    html += renderColumn('In Attesa Fattura', 'mail', '#f59e0b', categorized.waiting || []);
                }
                listContainer.innerHTML = html;
            }

            // Sync Bulk Listeners
            if (isBulk) {
                listContainer.querySelectorAll('.payment-modal-checkbox').forEach(cb => {
                    cb.onchange = () => {
                        const id = cb.dataset.id;
                        if (cb.checked) {
                            if (state.selectedPaymentIds.length === 0) {
                                const first = state.payments.find(p => p.id === id);
                                const entityId = first.collaborator_id || first.supplier_id;
                                state.selectedPaymentIds.push(id);
                                const rawList = (isUscite ? usciteRaw : entrateRaw).filter(p => (p.collaborator_id || p.supplier_id) === entityId);
                                renderCombinedSummary(title, categorize(rawList), true);
                            } else {
                                if (!state.selectedPaymentIds.includes(id)) state.selectedPaymentIds.push(id);
                                renderCombinedSummary(title, categorized, true);
                            }
                        } else {
                            state.selectedPaymentIds = state.selectedPaymentIds.filter(x => x !== id);
                            if (state.selectedPaymentIds.length === 0) {
                                renderCombinedSummary(title, isUscite ? usciteData : entrateData, true);
                            } else {
                                renderCombinedSummary(title, categorized, true);
                            }
                        }
                    };
                });
            }

            // Smooth scroll to list on mobile
            if (isMobile) {
                setTimeout(() => {
                    const panel = container.querySelector('#payments-right-panel');
                    if (panel && panel.style.display !== 'none') {
                        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 50);
            }
        };

        container.querySelectorAll('.clickable-header').forEach(header => {
            header.addEventListener('click', () => {
                const type = header.dataset.type;
                const title = type === 'entrate' ? 'Riepilogo Entrate' : 'Riepilogo Uscite';
                const data = type === 'entrate' ? entrateData : usciteData;
                renderCombinedSummary(title, data);
            });
        });


        const backBtn = container.querySelector('#btn-back-to-chart');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                container.querySelector('#list-content-view').style.display = 'none';
                container.querySelector('#chart-content-view').style.display = 'flex';
                state.isBulkInviteMode = false;
                state.selectedPaymentIds = [];

                // Smooth scroll back to top on mobile
                if (window.innerWidth <= 1024) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
                renderCashFlowChart();
            });
        }
        const enterBulkModeBtn = container.querySelector('#btn-enter-bulk-mode');
        if (enterBulkModeBtn) {
            enterBulkModeBtn.addEventListener('click', () => {
                state.isBulkInviteMode = true;
                state.paymentsFilterType = 'uscite';
                state.selectedPaymentIds = [];
                showPaymentListModal("Seleziona Pagamenti per Invito", usciteRaw.map(p => p.id), true);
            });
        }
    };

    const renderCard = (p, isSelectable = false) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dateObj = p.due_date ? new Date(p.due_date) : null;
        const isIncoming = p.payment_type === 'Cliente';
        const isSelected = state.selectedPaymentIds.includes(p.id);

        let entity = '';
        if (p.payment_type === 'Cliente') entity = p.clients?.business_name || 'Cliente';
        else if (p.payment_type === 'Collaboratore') entity = p.collaborators?.full_name || 'Collaboratore';
        else if (p.payment_type === 'Fornitore') entity = p.suppliers?.name || 'Fornitore';

        const dateBadge = p.due_date ? `
            <div style="padding: 0.2rem; border-radius: 6px; background: var(--glass-highlight); text-align: center; min-width: 40px; border: 1px solid var(--glass-border); display: flex; flex-direction: column; justify-content: center; height: 100%;">
                <div style="font-size: 0.85rem; font-weight: 700; line-height: 1; margin-bottom: 2px;">${dateObj.getDate()}</div>
                <div style="font-size: 0.55rem; font-weight: 700; text-transform: uppercase; color: var(--text-tertiary); line-height: 1;">${monthNames[dateObj.getMonth()]}</div>
                <div style="font-size: 0.45rem; font-weight: 500; color: var(--text-tertiary); line-height: 1; margin-top: 1px; opacity: 0.8;">${dateObj.getFullYear()}</div>
            </div>
        ` : `<div style="padding: 0.25rem; border-radius: 6px; background: var(--glass-highlight); text-align: center; min-width: 40px; border: 1px solid var(--glass-border); display: flex; align-items: center; justify-content: center; height: 100%;"><span class="material-icons-round" style="font-size: 1rem; color: var(--text-tertiary);">help_outline</span></div>`;

        return `
            <div class="glass-card payment-item-card ${isSelected ? 'selected' : ''}" 
                 style="padding: 0.75rem 1rem; margin-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; cursor: pointer; border: 1px solid ${isSelected ? 'var(--brand-blue)' : 'var(--glass-border)'}; border-radius: 14px; transition: all 0.2s ease; background: white;" 
                 onclick="if(event.target.type !== 'checkbox') { if(${isSelectable}) { let cb = this.querySelector('.payment-modal-checkbox'); if(cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); } } else { openPaymentModal('${p.id}'); } }">
                
                <div class="flex-between" style="align-items: center; width: 100%;">
                    <div class="flex-start" style="gap: 0.85rem; flex: 1; min-width: 0;">
                        <div style="flex-shrink: 0;">
                            ${dateBadge}
                        </div>
                        <div class="flex-column" style="flex: 1; min-width: 0; gap: 0.1rem;">
                            <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary); line-height: 1.2;" class="text-truncate">${entity}</div>
                            <div style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: 500;" class="text-truncate">${p.title || 'Pagamento'}</div>
                        </div>
                    </div>
                    ${isSelectable ? `
                        <div style="padding-left: 0.5rem;">
                            <input type="checkbox" class="payment-modal-checkbox" data-id="${p.id}" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation()" style="width: 16px; height: 16px; cursor: pointer;">
                        </div>
                    ` : ''}
                </div>

                <div class="flex-between" style="align-items: center; width: 100%; padding-top: 0.5rem; border-top: 1px dashed rgba(0,0,0,0.06);">
                    <div style="font-size: 0.6rem; color: var(--text-tertiary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">
                        ${p.orders?.order_number ? `ORDINE: ${p.orders.order_number}` : ''}
                    </div>
                    <div style="font-weight: 800; font-size: 0.95rem; color: ${isIncoming ? 'var(--success-soft)' : 'var(--error-soft)'}; letter-spacing: -0.3px; line-height: 1;">
                        ${isIncoming ? '+' : '-'} € ${formatAmount(p.amount)}
                    </div>
                </div>
            </div>
        `;
    };

    const showPaymentListModal = (title, ids, isBulk = false) => {
        const filtered = state.payments.filter(p => ids.includes(p.id));
        const modalId = 'payment-list-modal';
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        document.body.insertAdjacentHTML('beforeend', `
            <div id="${modalId}" class="modal active" style="z-index: 100000; backdrop-filter: blur(8px);">
                <div class="modal-content animate-slide-up" style="max-width: 700px; padding: 0; background: var(--bg-primary); border-radius: 24px;">
                    <div style="padding: 1.5rem 2rem; border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center;">
                        <h2 style="font-size: 1.25rem;">${title}</h2>
                        <button class="close-modal-btn" style="background: none; border: none; cursor: pointer;"><span class="material-icons-round">close</span></button>
                    </div>
                    <div style="padding: 1.5rem 2rem; max-height: 70vh; overflow-y: auto;" id="modal-payment-list">
                        ${filtered.map(p => renderCard(p, isBulk)).join('')}
                    </div>
                    ${isBulk ? `
                    <div style="padding: 1.5rem 2rem; border-top: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; background: var(--glass-highlight); border-radius: 0 0 24px 24px;">
                        <div class="flex-column">
                            <span id="bulk-modal-count" style="font-weight: 600;">0 selezionati</span>
                            <span id="bulk-modal-total" style="font-size: 0.85rem; color: var(--text-tertiary);">€ 0,00</span>
                        </div>
                        <div class="flex-start" style="gap: 1rem;">
                            <button class="primary-btn secondary" id="btn-modal-cancel">Annulla</button>
                            <button class="primary-btn" id="btn-modal-bulk-go" style="background: #f59e0b;" disabled>Invita Selezionati</button>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `);

        const m = document.getElementById(modalId);
        m.querySelector('.close-modal-btn').onclick = () => { m.classList.remove('active'); state.isBulkInviteMode = false; };

        if (isBulk) {
            const updateBulkSummary = () => {
                const selected = state.payments.filter(p => state.selectedPaymentIds.includes(p.id));
                const count = selected.length;
                const total = selected.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                document.getElementById('bulk-modal-count').textContent = `${count} selezionati`;
                document.getElementById('bulk-modal-total').textContent = `€ ${formatAmount(total)}`;
                document.getElementById('btn-modal-bulk-go').disabled = count === 0;
            };

            m.querySelectorAll('.payment-modal-checkbox').forEach(cb => {
                cb.onchange = (e) => {
                    const id = cb.dataset.id;
                    if (cb.checked) {
                        // Check single entity constraint
                        if (state.selectedPaymentIds.length > 0) {
                            const first = state.payments.find(p => p.id === state.selectedPaymentIds[0]);
                            const current = state.payments.find(p => p.id === id);
                            if ((first.collaborator_id || first.supplier_id) !== (current.collaborator_id || current.supplier_id)) {
                                cb.checked = false;
                                showGlobalAlert('Seleziona pagamenti dello stesso destinatario', 'warning');
                                return;
                            }
                        }
                        if (!state.selectedPaymentIds.includes(id)) state.selectedPaymentIds.push(id);
                    } else {
                        state.selectedPaymentIds = state.selectedPaymentIds.filter(x => x !== id);
                    }
                    updateBulkSummary();
                };
            });

            document.getElementById('btn-modal-cancel').onclick = () => {
                state.selectedPaymentIds = [];
                state.isBulkInviteMode = false;
                m.classList.remove('active');
            };

            document.getElementById('btn-modal-bulk-go').onclick = () => {
                m.classList.remove('active');
                handleBulkInvite();
            };

            updateBulkSummary();
        }

    };

    function renderCashFlowChart() {
        const ctx = document.getElementById('cashflow-chart');
        const scrollCanvas = document.getElementById('chart-scroll-canvas');
        if (!ctx || !scrollCanvas) return;

        if (cashFlowChartInstance) cashFlowChartInstance.destroy();

        Chart.defaults.font.family = "'Outfit', sans-serif";

        const labels = [];
        const monthKeys = [];
        const now = new Date();
        now.setDate(1);
        now.setHours(0, 0, 0, 0);

        // ALWAYS include at least -6 to +6 months
        let minOffset = -6;
        let maxOffset = 6;

        // Expand based on payments if they go beyond -6 or +6
        state.payments.forEach(p => {
            if (!p.due_date) return;
            const pd = new Date(p.due_date);
            const monthsDiff = (pd.getFullYear() - now.getFullYear()) * 12 + (pd.getMonth() - now.getMonth());
            minOffset = Math.min(minOffset, monthsDiff);
            maxOffset = Math.max(maxOffset, monthsDiff);
        });

        for (let i = minOffset; i <= maxOffset; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            labels.push(monthNames[d.getMonth()] + ' ' + d.getFullYear().toString().slice(-2));
            const yyyyMm = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
            monthKeys.push(yyyyMm);
        }

        const size = labels.length;
        const minWidthPerMonth = 80;
        const totalWidth = Math.max(scrollCanvas.parentElement.clientWidth, size * minWidthPerMonth);
        scrollCanvas.style.width = `${totalWidth}px`;

        const entrateData = new Array(size).fill(0);
        const usciteRawData = new Array(size).fill(0);
        const saldoData = new Array(size).fill(0);

        state.payments.forEach(p => {
            if (!p.due_date) return;
            const d = new Date(p.due_date);
            const yyyyMm = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
            const idx = monthKeys.indexOf(yyyyMm);
            if (idx !== -1) {
                const amount = parseFloat(p.amount) || 0;
                if (p.payment_type === 'Cliente') entrateData[idx] += amount;
                else usciteRawData[idx] += amount;
            }
        });

        let runningBalance = 0;
        for (let i = 0; i < size; i++) {
            runningBalance += entrateData[i] - usciteRawData[i];
            saldoData[i] = runningBalance;
        }

        const usciteDisplayData = usciteRawData.map(v => -v);

        try {
            cashFlowChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            type: 'line',
                            label: 'Saldo Progressivo',
                            data: saldoData,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.08)',
                            borderWidth: 2.5,
                            tension: 0.3,
                            pointBackgroundColor: '#3b82f6',
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            fill: true,
                            order: 0
                        },
                        {
                            label: 'Entrate',
                            data: entrateData,
                            backgroundColor: 'rgba(16, 185, 129, 0.8)',
                            borderRadius: 4,
                            barPercentage: 0.6,
                            categoryPercentage: 0.8,
                            order: 1
                        },
                        {
                            label: 'Uscite',
                            data: usciteDisplayData,
                            backgroundColor: 'rgba(239, 68, 68, 0.8)',
                            borderRadius: 4,
                            barPercentage: 0.6,
                            categoryPercentage: 0.8,
                            order: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(255, 255, 255, 0.96)',
                            titleColor: '#1e293b',
                            bodyColor: '#475569',
                            borderColor: 'rgba(0,0,0,0.08)',
                            borderWidth: 1,
                            padding: 14,
                            boxPadding: 6,
                            usePointStyle: true,
                            titleFont: { weight: '600' },
                            callbacks: {
                                label: function (context) {
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    const val = Math.abs(context.parsed.y);
                                    label += new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            stacked: true,
                            grid: { display: false },
                            ticks: { maxRotation: 0 }
                        },
                        y: {
                            stacked: true,
                            grid: {
                                color: 'rgba(0,0,0,0.04)',
                                drawBorder: false,
                            },
                            ticks: {
                                callback: function (value) {
                                    const abs = Math.abs(value);
                                    const sign = value < 0 ? '-' : '';
                                    if (abs >= 1000) {
                                        const kVal = abs / 1000;
                                        return sign + '€' + (kVal % 1 === 0 ? kVal : kVal.toFixed(1)) + 'k';
                                    }
                                    return sign + '€' + abs;
                                }
                            }
                        }
                    }
                }
            });

            // SCROLL TO CURRENT MONTH - REFINED
            setTimeout(() => {
                const currentMonthLabel = monthNames[now.getMonth()] + ' ' + now.getFullYear().toString().slice(-2);
                const currentIndex = labels.indexOf(currentMonthLabel);
                if (currentIndex !== -1) {
                    const scrollContainer = scrollCanvas.parentElement;
                    const monthWidth = totalWidth / size;
                    // Center the current month: (pos - half_container + half_month)
                    const scrollPos = (currentIndex * monthWidth) - (scrollContainer.clientWidth / 2) + (monthWidth / 2);
                    scrollContainer.scrollTo({
                        left: Math.max(0, scrollPos),
                        behavior: 'smooth'
                    });
                }
            }, 300); // Robust delay for rendering
        } catch (e) {
            console.error("Critical Chart.js Error:", e);
        }
    }

    updateUI();
    setTimeout(() => renderCashFlowChart(), 100);
}

export function initPaymentModals() {
    if (typeof window !== 'undefined') window.openPaymentModal = openPaymentModal;

    const existing = document.getElementById('payment-modal');
    if (existing) existing.remove();
    const existingEdit = document.getElementById('payment-edit-modal');
    if (existingEdit) existingEdit.remove();

    document.body.insertAdjacentHTML('beforeend', `
            <div id="payment-modal" class="modal">
                <div class="modal-content" style="max-width: 680px; padding: 0; overflow: visible;">
                    
                    <!-- Header -->
                    <div style="padding: 2.5rem 2.5rem 2rem 2.5rem; position: relative; background: var(--glass-highlight); border-radius: 24px 24px 0 0;">
                        <!-- Close Button -->
                        <button class="close-modal" style="position: absolute; top: 1.25rem; right: 1.25rem; background: var(--card-bg); width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--glass-border); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
                            <span class="material-icons-round" style="font-size: 1.2rem; color: var(--text-secondary);">close</span>
                        </button>
                        
                        <!-- Payment Code Badge -->
                        <div id="pm-code-badge" class="badge badge-neutral" style="width: fit-content; margin-bottom: 1rem; font-size: 0.85rem; padding: 0.4rem 0.85rem; text-transform: none; letter-spacing: 0; font-weight: 500;">-</div>
                        
                        <!-- Amount & Entity -->
                        <div class="payment-modal-header-actions flex-between" style="align-items: flex-start; gap: 2rem;">
                            <div class="flex-column payment-header-infos" style="gap: 0.75rem; flex: 1;">
                                <div id="pm-amount" class="text-display" style="font-size: 2.5rem; margin: 0; line-height: 1; font-weight: 700;">€ 0,00</div>
                                <div class="flex-start" style="gap: 0.5rem; align-items: center;">
                                    <span class="material-icons-round" id="pm-subject-icon" style="font-size: 1.1rem; color: var(--text-tertiary);">person</span>
                                    <span id="pm-subject" class="text-body" style="color: var(--text-secondary); font-weight: 500;">-</span>
                                </div>
                            </div>
                            <div id="pm-invoice-action"></div>
                        </div>
                    </div>

                    <!-- Content: Single Scrollable Section -->
                    <div style="padding: 2rem 2.5rem; max-height: 60vh; overflow-y: auto;">
                        
                        <!-- Payment Info Section -->
                        <div class="flex-column" style="gap: 1.5rem; margin-bottom: 2rem;">
                            <h3 style="font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); margin: 0;">Informazioni Pagamento</h3>
                            
                            <div class="payment-modal-grid grid-2" style="gap: 1.5rem;">
                                <div class="flex-column" style="gap: 0.4rem;">
                                    <label class="text-caption" style="font-weight: 500; color: var(--text-tertiary);">Causale</label>
                                    <div id="info-desc" class="text-body" style="font-weight: 500; color: var(--text-primary);">-</div>
                                </div>
                                <div class="flex-column" style="gap: 0.4rem;">
                                    <label class="text-caption" style="font-weight: 500; color: var(--text-tertiary);">Data Scadenza</label>
                                    <div id="info-date" class="text-body" style="font-weight: 500; color: var(--text-primary);">-</div>
                                </div>
                                <div class="flex-column" style="gap: 0.4rem;">
                                    <label class="text-caption" style="font-weight: 500; color: var(--text-tertiary);">Modalità</label>
                                    <div id="info-mode" class="text-body" style="font-weight: 500; color: var(--text-primary);">-</div>
                                </div>
                                <div class="flex-column" style="gap: 0.4rem;">
                                    <label class="text-caption" style="font-weight: 500; color: var(--text-tertiary);">Tipo Flusso</label>
                                    <div id="info-type" class="text-body" style="font-weight: 500; color: var(--text-primary);">-</div>
                                </div>
                                <div class="flex-column" style="gap: 0.4rem;">
                                    <label class="text-caption" style="font-weight: 500; color: var(--text-tertiary);">Stato</label>
                                    <div id="info-status" class="text-body" style="font-weight: 500; color: var(--text-primary);">-</div>
                                </div>
                            </div>
                        </div>

                        <!-- Order Details Section -->
                        <div id="order-details-section" class="flex-column" style="gap: 1.5rem; margin-bottom: 2rem; padding-top: 2rem; border-top: 1px solid var(--glass-border);">
                            <h3 style="font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); margin: 0;">Dettagli Ordine</h3>
                            
                            <div class="payment-modal-grid grid-2" style="gap: 1.5rem;">
                                <div class="flex-column" style="gap: 0.4rem;">
                                    <label class="text-caption" style="font-weight: 500; color: var(--text-tertiary);">N. Ordine</label>
                                    <div id="det-order-num" class="text-body" style="font-weight: 500; color: var(--text-primary);">-</div>
                                </div>
                                <div class="flex-column" style="gap: 0.4rem;">
                                    <label class="text-caption" style="font-weight: 500; color: var(--text-tertiary);">Cliente</label>
                                    <div id="det-client" class="text-body" style="font-weight: 500; color: var(--text-primary);">-</div>
                                </div>
                                <div class="flex-column" style="gap: 0.4rem; grid-column: span 2;">
                                    <label class="text-caption" style="font-weight: 500; color: var(--text-tertiary);">Titolo Ordine</label>
                                    <div id="det-order-title" class="text-body" style="font-weight: 500; color: var(--text-primary);">-</div>
                                </div>
                            </div>
                        </div>

                        <!-- Notes Section -->
                        <div class="flex-column" style="gap: 1rem; padding-top: 2rem; border-top: 1px solid var(--glass-border);">
                            <h3 style="font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); margin: 0;">Note</h3>
                            <textarea id="pm-notes-input" style="width: 100%; height: 120px; padding: 1rem; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--input-bg); resize: none; font-family: inherit; font-size: 0.95rem; color: var(--text-primary); line-height: 1.6;" placeholder="Note interne..."></textarea>
                            <div class="flex-end">
                                <button class="primary-btn secondary" id="btn-save-pm-notes" style="padding: 0.65rem 1.5rem; font-size: 0.9rem;">Salva Note</button>
                            </div>
                        </div>

                    </div>
                    
                    <!-- Footer -->
                    <div class="flex-between" style="padding: 1.5rem 2.5rem; background: var(--glass-highlight); border-top: 1px solid var(--glass-border); border-radius: 0 0 24px 24px;">
                        <button type="button" class="text-danger" id="pm-btn-delete" onclick="window.handlePaymentDelete()" style="background: none; border: none; cursor: pointer; font-size: 0.9rem; font-weight: 500; opacity: 1; transition: opacity 0.2s; position: relative; z-index: 10;">
                            <span class="material-icons-round" style="font-size: 1rem; vertical-align: middle; margin-right: 0.25rem;">delete_outline</span>
                            Elimina
                        </button>
                        <button class="primary-btn" id="btn-open-payment-edit" style="padding: 0.65rem 1.75rem;">
                            <span class="material-icons-round" style="font-size: 1.1rem; vertical-align: middle; margin-right: 0.35rem;">edit</span>
                            Modifica
                        </button>
                    </div>
                </div>
            </div>

            <!-- SUB-MODAL: Edit -->
            <div id="payment-edit-modal" class="modal" style="z-index: 100001;">
                <div class="modal-content" style="max-width: 500px; padding: 2.5rem;">
                    <button class="close-modal close-sub-modal"><span class="material-icons-round">close</span></button>
                    <div class="modal-header" style="margin-bottom: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 1.5rem;">
                        <h2 style="font-size: 1.5rem;">Modifica Info Pagamento</h2>
                    </div>
                    <div class="flex-column" style="gap: 1.5rem;">
                         <div class="flex-column" style="gap: 0.5rem;">
                             <label class="text-caption">Data Scadenza</label>
                             <input type="date" id="pme-date" class="modal-input" style="padding: 0.85rem; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--input-bg); color: var(--text-primary); width: 100%;">
                         </div>
                         <div class="flex-column" style="gap: 0.5rem;">
                             <label class="text-caption">Descrizione</label>
                             <input type="text" id="pme-title" style="padding: 0.85rem; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--input-bg); color: var(--text-primary); width: 100%;">
                         </div>
                         <div class="flex-column" style="gap: 0.5rem;">
                             <label class="text-caption">Importo (€)</label>
                             <input type="number" step="0.01" id="pme-amount" style="padding: 0.85rem; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--input-bg); color: var(--text-primary); width: 100%;">
                         </div>
                         <div class="flex-column" style="gap: 0.5rem;"> 
                             <label class="text-caption">Modalità</label>
                             <select id="pme-mode" style="padding: 0.85rem; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--input-bg); color: var(--text-primary); width: 100%;">
                                <option value="Anticipo">Anticipo</option>
                                <option value="Rata">Rata</option>
                                <option value="Saldo">Saldo</option>
                             </select>
                         </div>
                         <div class="flex-column" style="gap: 0.5rem;">
                             <label class="text-caption">Stato</label>
                             <select id="pme-status" style="padding: 0.85rem; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--input-bg); color: var(--text-primary); width: 100%;">
                                 <option value="Da Fare">Da Fare</option>
                                 <option value="Invito Inviato">Invito Inviato</option>
                                 <option value="In Attesa">In Attesa</option>
                                 <option value="Completato">Completato</option>
                             </select>
                         </div>
                    </div>
                    <div class="flex-end mt-4" style="gap: 1.25rem;">
                        <button class="primary-btn secondary close-sub-modal" style="border: none;">Annulla</button>
                        <button class="primary-btn" id="btn-save-pm-edit">Applica Modifiche</button>
                    </div>
                </div>
            </div>
        `);

    const modal = document.getElementById('payment-modal');
    const editModal = document.getElementById('payment-edit-modal');

    // Close logic
    modal.querySelectorAll('.close-modal').forEach(b => b.addEventListener('click', () => modal.classList.remove('active')));
    editModal.querySelectorAll('.close-sub-modal').forEach(b => b.addEventListener('click', () => editModal.classList.remove('active')));

    // Open Edit
    document.getElementById('btn-open-payment-edit').addEventListener('click', () => {
        const p = state.payments.find(x => x.id === state.currentPaymentId);
        if (!p) return;
        document.getElementById('pme-date').value = p.due_date || '';
        document.getElementById('pme-title').value = p.title || '';
        document.getElementById('pme-amount').value = p.amount || 0;
        document.getElementById('pme-mode').value = p.payment_mode || 'Rata';
        document.getElementById('pme-status').value = p.status || 'To Do';
        editModal.classList.add('active');
    });

    // Save Edit
    document.getElementById('btn-save-pm-edit').addEventListener('click', async () => {
        const p = state.payments.find(x => x.id === state.currentPaymentId);
        if (!p) return;

        const updates = {
            ...p,
            due_date: document.getElementById('pme-date').value || null,
            title: document.getElementById('pme-title').value,
            amount: parseFloat(document.getElementById('pme-amount').value),
            payment_mode: document.getElementById('pme-mode').value,
            status: document.getElementById('pme-status').value,
        };

        try {
            await upsertPayment(updates);
            editModal.classList.remove('active');
            openPaymentModal(p.id);
            window.dispatchEvent(new HashChangeEvent("hashchange"));
            showGlobalAlert('Pagamento aggiornato');
        } catch (e) {
            showGlobalAlert('Errore aggiornamento', 'error');
        }
    });

    // Save Notes
    document.getElementById('btn-save-pm-notes').addEventListener('click', async () => {
        const p = state.payments.find(x => x.id === state.currentPaymentId);
        if (!p) return;

        const newNotes = document.getElementById('pm-notes-input').value;
        try {
            await upsertPayment({ ...p, notes: newNotes });
            showGlobalAlert('Note salvate');
        } catch (e) {
            showGlobalAlert('Errore salvataggio note', 'error');
        }
    });
}

window.handlePaymentDelete = handlePaymentDelete;

export function openPaymentModal(id) {
    if (typeof window !== 'undefined') window.openPaymentModal = openPaymentModal;

    state.currentPaymentId = id;
    const p = state.payments.find(x => x.id === id);

    if (!p) return;

    const modal = document.getElementById('payment-modal');
    if (!modal) return;

    let paymentCode = p.title || 'Pagamento';
    if (p.orders?.order_number) paymentCode += ` ${p.orders.order_number}`;

    let entityName = '';
    if (p.payment_type === 'Cliente' && p.clients?.business_name) entityName = p.clients.business_name;
    else if (p.payment_type === 'Collaboratore' && p.collaborators?.full_name) entityName = p.collaborators.full_name;
    else if (p.payment_type === 'Fornitore' && p.suppliers?.name) entityName = p.suppliers.name;
    if (entityName) paymentCode += ` ${entityName}`;

    document.getElementById('pm-code-badge').textContent = paymentCode;

    let subject = 'N/A';
    let icon = 'help_outline';
    if (p.payment_type === 'Cliente') { subject = p.clients?.business_name || 'Cliente'; icon = 'business'; }
    else if (p.payment_type === 'Collaboratore') { subject = p.collaborators?.full_name || 'Collaboratore'; icon = 'person'; }
    else if (p.payment_type === 'Fornitore') { subject = p.suppliers?.name || 'Fornitore'; icon = 'local_shipping'; }

    document.getElementById('pm-subject').textContent = subject;
    document.getElementById('pm-subject-icon').textContent = icon;

    const isIncoming = p.payment_type === 'Cliente';
    const amountVal = formatAmount(p.amount);
    document.getElementById('pm-amount').textContent = `${isIncoming ? '+' : '-'} € ${amountVal}`;
    document.getElementById('pm-amount').style.color = isIncoming ? 'var(--success-soft)' : 'var(--error-soft)';

    const actionDiv = document.getElementById('pm-invoice-action');
    if (isIncoming) {
        if (p.invoices?.id || p.invoice_id) {
            actionDiv.innerHTML = `<button class="badge badge-success" style="cursor: pointer; border: 1px solid rgba(16, 185, 129, 0.2);"><span class="material-icons-round text-small">receipt</span> Fattura ${p.invoices?.invoice_number || ''}</button>`;
        } else {
            actionDiv.innerHTML = `<button class="primary-btn" style="padding: 0.5rem 1rem; font-size: 0.8rem; border-radius: 8px;"><span class="material-icons-round" style="font-size: 1rem;">add</span> Emetti Fattura</button>`;
        }
    } else {
        if (p.passive_invoices?.id || p.passive_invoice_id || p.invoice_id) {
            actionDiv.innerHTML = `<button class="badge badge-warning" style="cursor: pointer; border: 1px solid rgba(245, 158, 11, 0.2);"><span class="material-icons-round text-small">receipt_long</span> Fattura ${p.passive_invoices?.invoice_number || ''}</button>`;
        } else if (p.status === 'Da Fare' || p.status === 'To Do' || !p.status) {
            actionDiv.innerHTML = `<button class="primary-btn" id="btn-send-invite" style="padding: 0.5rem 1rem; font-size: 0.8rem; border-radius: 8px; background: #f59e0b;"><span class="material-icons-round" style="font-size: 1rem;">send</span> Invia Invito</button>`;
            setTimeout(() => {
                const b = document.getElementById('btn-send-invite');
                if (b) b.onclick = () => handleSendInvite(p, b);
            }, 0);
        } else if (p.status === 'Invito Inviato') {
            actionDiv.innerHTML = `
                <div class="flex-column" style="gap: 0.5rem; align-items: flex-end;">
                    <span class="badge" style="background: #fef3c7; color: #b45309; border: 1px solid rgba(245, 158, 11, 0.2);"><span class="material-icons-round text-small">hourglass_top</span> In attesa fattura</span>
                    <button class="text-button" id="btn-resend-invite" style="font-size: 0.75rem; color: #b45309; text-decoration: underline; border: none; background: none; opacity: 0.8;">Reinvia Webhook</button>
                    <button class="text-button" id="btn-reset-invite" style="font-size: 0.75rem; color: var(--text-tertiary); text-decoration: underline; border: none; background: none; opacity: 0.6;">Annulla</button>
                </div>
            `;
            setTimeout(() => {
                document.getElementById('btn-resend-invite')?.addEventListener('click', (e) => handleSendInvite(p, e.currentTarget));
                document.getElementById('btn-reset-invite')?.addEventListener('click', async () => {
                    if (confirm('Annullare lo stato di invito e tornare a "Da Fare"?')) {
                        const { supabase } = await import('../modules/config.js?v=1000');
                        await supabase.from('payments').update({ status: 'Da Fare' }).eq('id', p.id);
                        await fetchPayments(); openPaymentModal(p.id); showGlobalAlert('Ripristinato');
                    }
                });
            }, 0);
        } else {
            actionDiv.innerHTML = `<button class="primary-btn" style="padding: 0.5rem 1rem; font-size: 0.8rem; border-radius: 8px;"><span class="material-icons-round" style="font-size: 1rem;">upload</span> Registra Fattura</button>`;
        }
    }

    document.getElementById('info-desc').textContent = p.title || '-';
    document.getElementById('info-date').textContent = p.due_date ? new Date(p.due_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Nessuna data';
    document.getElementById('info-mode').textContent = p.payment_mode || 'Rata';
    document.getElementById('info-type').textContent = p.payment_type || '-';

    const statusMap = { 'Da Fare': '#6b7280', 'Invito Inviato': '#f59e0b', 'In Attesa': '#3b82f6', 'Completato': '#22c55e', 'Done': '#22c55e', 'To Do': '#6b7280' };
    const color = statusMap[p.status] || '#6b7280';
    document.getElementById('info-status').innerHTML = `<span style="display: inline-flex; align-items: center; gap: 0.4rem;"><span style="width: 8px; height: 8px; border-radius: 50%; background: ${color};"></span>${p.status || 'N/A'}</span>`;

    document.getElementById('det-order-num').textContent = p.orders?.order_number || 'N/A';
    document.getElementById('det-client').textContent = p.clients?.business_name || '-';
    document.getElementById('det-order-title').textContent = p.orders?.title || 'N/A';
    document.getElementById('pm-notes-input').value = p.notes || '';

    modal.classList.add('active');
}

async function handleBulkInvite() {
    if (state.selectedPaymentIds.length === 0) return;
    const selected = state.payments.filter(p => state.selectedPaymentIds.includes(p.id));
    const first = selected[0];
    const entityFullName = first.collaborators?.full_name || first.suppliers?.name || '-';

    try {
        const webhookUrl = 'https://sacred-roughy-renewing.ngrok-free.app/webhook/ba8b70d5-643e-41fa-839a-096697554d19';
        const { supabase } = await import('../modules/config.js?v=1003');
        const sentAt = new Date().toISOString();
        const payload = selected.map(p => ({
            ...p,
            client_name: p.clients?.business_name || p.orders?.clients?.business_name || '-',
            payment_description: p.title || '-',
            entity_name: entityFullName,
            entity_first_name: entityFullName.split(' ')[0],
            entity_email: p.collaborators?.email || '-',
            order_number: p.orders?.order_number || '-',
            action: 'bulk_invite_to_invoice',
            sent_at: sentAt
        }));

        const { error: edgeError } = await supabase.functions.invoke('trigger-webhook', { body: { webhookUrl, payload } });
        if (edgeError) throw edgeError;

        await supabase.from('payments').update({ status: 'Invito Inviato', invited_at: sentAt }).in('id', state.selectedPaymentIds);
        state.selectedPaymentIds = []; state.isBulkInviteMode = false;
        await fetchPayments(); window.dispatchEvent(new HashChangeEvent("hashchange"));
        showGlobalAlert('Invito multiplo inviato correttamente!', 'success');
    } catch (e) { showGlobalAlert(e.message, 'error'); }
}

async function handleSendInvite(p, btn) {
    const original = btn.innerHTML;
    try {
        const webhookUrl = 'https://sacred-roughy-renewing.ngrok-free.app/webhook/ba8b70d5-643e-41fa-839a-096697554d19';
        btn.disabled = true; btn.innerHTML = `Invio...`;
        const { supabase } = await import('../modules/config.js?v=1005');
        const entityFullName = p.collaborators?.full_name || p.suppliers?.name || '-';
        const payload = [{
            ...p,
            client_name: p.clients?.business_name || p.orders?.clients?.business_name || '-',
            entity_name: entityFullName,
            entity_first_name: entityFullName.split(' ')[0],
            entity_email: p.collaborators?.email || '-',
            action: 'invite_to_invoice',
            sent_at: new Date().toISOString()
        }];
        const { error } = await supabase.functions.invoke('trigger-webhook', { body: { webhookUrl, payload } });
        if (error) throw error;
        await supabase.from('payments').update({ status: 'Invito Inviato' }).eq('id', p.id);
        await fetchPayments(); openPaymentModal(p.id); showGlobalAlert('Inviato!');
    } catch (e) { showGlobalAlert(e.message, 'error'); btn.disabled = false; btn.innerHTML = original; }
}

async function handlePaymentDelete() {
    if (!state.currentPaymentId) return;
    if (!await window.showConfirm('Eliminare definitivamente?')) return;
    try {
        await deletePayment(state.currentPaymentId);
        document.getElementById('payment-modal').classList.remove('active');
        showGlobalAlert('Eliminato'); fetchPayments();
    } catch (err) { showGlobalAlert('Errore', 'error'); }
}

if (typeof window !== 'undefined') window.openPaymentModal = openPaymentModal;
