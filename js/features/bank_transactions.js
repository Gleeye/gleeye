import { state } from '../modules/state.js?v=157';
import { formatAmount } from '../modules/utils.js?v=157';
import {
    upsertBankTransaction,
    fetchBankTransactions,
    approveBankTransaction,
    rejectBankTransaction,
    deleteBankTransaction,
    fetchClients,
    fetchSuppliers,
    fetchCollaborators,
    fetchInvoices,
    fetchPassiveInvoices,
    fetchTransactionCategories
} from '../modules/api.js?v=157';
import { renderReadOnlyView, switchToEditMode } from './bank_transaction_readonly.js?v=157';

// Render ID for atomic updates
let currentRenderId = 0;
let pendingTransactions = [];

/**
 * --- RENDER PRINCIPALE CON SIDEBAR ANALYTICS (Style Screenshot) ---
 */
export async function renderBankTransactions(container) {
    const renderId = ++currentRenderId;

    // Standardize re-render container lookup
    const contentArea = container || document.getElementById('content-area');
    if (!contentArea) return;

    const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    const monthShort = ["GEN", "FEB", "MAR", "APR", "MAG", "GIU", "LUG", "AGO", "SET", "OTT", "NOV", "DIC"];

    // Data synchronization
    // Abort if a newer render has started while we were fetching
    const pending = await fetchBankTransactions('pending');
    if (renderId !== currentRenderId) return;
    pendingTransactions = pending;

    await fetchBankTransactions('posted');
    if (renderId !== currentRenderId) return;

    if (!state.transactionCategories || state.transactionCategories.length === 0) {
        await fetchTransactionCategories();
        if (renderId !== currentRenderId) return;
    }

    // ENSURE INVOICES ARE FETCHED FOR LOOKUP
    if (!state.invoices || state.invoices.length === 0) {
        await fetchInvoices();
        if (renderId !== currentRenderId) return;
    }
    if (!state.passiveInvoices || state.passiveInvoices.length === 0) {
        await fetchPassiveInvoices();
        if (renderId !== currentRenderId) return;
    }

    const year = state.bankTransactionsYear || new Date().getFullYear();
    const currentType = state.bankTransactionsType || 'tutti';

    let movements = state.bankTransactions.filter(t => t.status !== 'pending' && new Date(t.date).getFullYear() === parseInt(year));
    if (currentType !== 'tutti') movements = movements.filter(t => t.type === currentType);

    const totalOps = movements.length;

    // Sidebar Category Analysis
    const categoryTotals = {};
    movements.forEach(t => {
        if (t.type === 'uscita') {
            const cat = t.transaction_categories?.name || 'Uscita Generica';
            categoryTotals[cat] = (categoryTotals[cat] || 0) + (parseFloat(t.amount) || 0);
        }
    });
    const sortedCats = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

    // Final Atomic Render
    if (renderId !== currentRenderId) return;

    contentArea.innerHTML = `
        <div class="bank-dashboard-container" style="max-width: 1600px; width: 100%; margin: 0 auto; padding: 1rem 2rem 5rem; box-sizing: border-box;">
            
            <!-- TOP SECTION: KPI WIDGETS (Full Width) -->
            <div class="bank-kpi-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2.5rem;">
                <!-- Card: Entrate -->
                <div style="background: white; border-radius: 20px; padding: 1.5rem; display: flex; align-items: center; gap: 1.5rem; border: 1px solid rgba(0,0,0,0.03); position: relative; overflow: hidden; box-shadow: var(--shadow-sm);">
                    <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #22c55e;"></div>
                    <div style="width: 50px; height: 50px; border-radius: 12px; background: #f0fdf4; display: flex; align-items: center; justify-content: center; color: #16a34a;">
                        <span class="material-icons-round" style="font-size: 26px;">trending_up</span>
                    </div>
                    <div>
                        <div style="font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.2rem;">Entrate Totali</div>
                        <div style="font-size: 1.6rem; font-weight: 500; color: var(--text-primary); letter-spacing: -0.02em;">
                            ${formatAmount(movements.filter(t => t.type === 'entrata').reduce((s, t) => s + parseFloat(t.amount), 0))} €
                        </div>
                    </div>
                </div>

                 <!-- Card: Uscite -->
                <div style="background: white; border-radius: 20px; padding: 1.5rem; display: flex; align-items: center; gap: 1.5rem; border: 1px solid rgba(0,0,0,0.03); position: relative; overflow: hidden; box-shadow: var(--shadow-sm);">
                    <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #ef4444;"></div>
                    <div style="width: 50px; height: 50px; border-radius: 12px; background: #fef2f2; display: flex; align-items: center; justify-content: center; color: #dc2626;">
                        <span class="material-icons-round" style="font-size: 26px;">trending_down</span>
                    </div>
                    <div>
                        <div style="font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.2rem;">Uscite Totali</div>
                        <div style="font-size: 1.6rem; font-weight: 500; color: var(--text-primary); letter-spacing: -0.02em;">
                            ${formatAmount(movements.filter(t => t.type === 'uscita').reduce((s, t) => s + parseFloat(t.amount), 0))} €
                        </div>
                    </div>
                </div>

                <!-- Card: Saldo -->
                <div style="background: white; border-radius: 20px; padding: 1.5rem; display: flex; align-items: center; gap: 1.5rem; border: 1px solid rgba(0,0,0,0.03); position: relative; overflow: hidden; box-shadow: var(--shadow-sm);">
                    <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #3b82f6;"></div>
                    <div style="width: 50px; height: 50px; border-radius: 12px; background: #eff6ff; display: flex; align-items: center; justify-content: center; color: #2563eb;">
                        <span class="material-icons-round" style="font-size: 26px;">account_balance_wallet</span>
                    </div>
                    <div>
                        <div style="font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.2rem;">Saldo Periodo</div>
                         <div style="font-size: 1.6rem; font-weight: 500; color: var(--text-primary); letter-spacing: -0.02em;">
                            ${formatAmount(movements.reduce((s, t) => s + (t.type === 'entrata' ? parseFloat(t.amount) : -parseFloat(t.amount)), 0))} €
                        </div>
                    </div>
                </div>
            </div>

            <!-- MAIN CONTENT GRID -->
            <div class="bank-content-grid" style="display: grid; grid-template-columns: 1fr 360px; gap: 3rem; align-items: start;">
                
                <!-- LEFT CONTENT AREA -->
                <div class="bank-list-side">
                    
                    <!-- REFINED HEADER -->
                    <div class="bank-header-actions" style="background: white; padding: 1.25rem 2rem; border-radius: 24px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; box-shadow: var(--shadow-sm); border: 1px solid rgba(0,0,0,0.02);">
                        <div>
                            <h1 style="font-family: var(--font-titles); font-weight: 700; margin: 0; font-size: 1.5rem; letter-spacing: -0.02em; color: var(--text-primary);">Registro Movimenti</h1>
                            <div style="color: var(--text-tertiary); font-size: 0.8rem; margin-top: 0.2rem; font-weight: 500;">
                                ${totalOps} operazioni nel ${year}
                            </div>
                        </div>

                        <div style="display: flex; align-items: center; gap: 1.25rem;">
                            <!-- Type Filter -->
                            <div class="segmented-control glass" style="background: #f1f5f9; padding: 4px; border-radius: 50px; display: flex; align-items: center;">
                                <label class="hidden-radio" style="padding: 6px 14px; border-radius: 50px; cursor: pointer; font-size: 0.8rem; font-weight: 600; ${currentType === 'tutti' ? 'background:white; color:black; box-shadow:0 2px 6px rgba(0,0,0,0.06);' : 'color:var(--text-tertiary);'}" onclick="setBankTransactionsType('tutti')">
                                    <input type="radio" name="view-type" style="display:none" ${currentType === 'tutti' ? 'checked' : ''}> Tutti
                                </label>
                                <label class="hidden-radio" style="padding: 6px 14px; border-radius: 50px; cursor: pointer; font-size: 0.8rem; font-weight: 600; ${currentType === 'entrata' ? 'background:white; color:black; box-shadow:0 2px 6px rgba(0,0,0,0.06);' : 'color:var(--text-tertiary);'}" onclick="setBankTransactionsType('entrata')">
                                    <input type="radio" name="view-type" style="display:none" ${currentType === 'entrata' ? 'checked' : ''}> Entrate
                                </label>
                                <label class="hidden-radio" style="padding: 6px 14px; border-radius: 50px; cursor: pointer; font-size: 0.8rem; font-weight: 600; ${currentType === 'uscita' ? 'background:white; color:black; box-shadow:0 2px 6px rgba(0,0,0,0.06);' : 'color:var(--text-tertiary);'}" onclick="setBankTransactionsType('uscita')">
                                    <input type="radio" name="view-type" style="display:none" ${currentType === 'uscita' ? 'checked' : ''}> Uscite
                                </label>
                            </div>

                            <!-- Year Selector -->
                             <div class="segmented-control glass" style="background: #f1f5f9; padding: 4px; border-radius: 12px; display: flex;">
                                <div onclick="setBankTransactionsYear(2026)" style="padding: 6px 12px; border-radius: 10px; cursor: pointer; font-size: 0.8rem; font-weight: 600; ${year == 2026 ? 'background: #3b82f6; color:white; box-shadow:0 3px 8px rgba(59,130,246,0.3);' : 'color:var(--text-tertiary);'}">2026</div>
                                <div onclick="setBankTransactionsYear(2025)" style="padding: 6px 12px; border-radius: 10px; cursor: pointer; font-size: 0.8rem; font-weight: 600; ${year == 2025 ? 'background: #3b82f6; color:white; box-shadow:0 3px 8px rgba(59,130,246,0.3);' : 'color:var(--text-tertiary);'}">2025</div>
                                <div onclick="setBankTransactionsYear(2024)" style="padding: 6px 12px; border-radius: 10px; cursor: pointer; font-size: 0.8rem; font-weight: 600; ${year == 2024 ? 'background: #3b82f6; color:white; box-shadow:0 3px 8px rgba(59,130,246,0.3);' : 'color:var(--text-tertiary);'}">2024</div>
                            </div>

                            <div style="display: flex; gap: 0.5rem; align-items: center;">
                                <button class="primary-btn secondary" onclick="openImportModal()" style="border-radius: 12px; padding: 0.5rem 1rem; border: 1px solid #e2e8f0; background: white; font-weight: 600; font-size: 0.8rem;">
                                     <span class="material-icons-round" style="font-size: 1rem; margin-right: 0.4rem;">upload_file</span> Importa
                                </button>
                                <button class="primary-btn" onclick="openBankTransactionModal()" style="border-radius: 12px; width: 38px; height: 38px; padding: 0; background: #4f46e5; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.25);">
                                    <span class="material-icons-round" style="font-size: 20px;">add</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- PENDING TRANSACTIONS (Fits inside left column) -->
                    ${renderPendingSection()}

                    <!-- REGISTRY LIST -->
                    <div class="registry-container">
                        ${renderMonthGroups(movements, monthNames, monthShort)}
                    </div>
                </div>

                <!-- SIDEBAR: ANALYSIS -->
                <div class="bank-analytics-side">
                    <div class="glass-card" style="padding: 1.75rem; border-radius: 24px; background: white; border: 1px solid rgba(0,0,0,0.02); box-shadow: var(--shadow-sm);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.75rem;">
                             <h3 style="font-family: var(--font-titles); margin: 0; font-size: 1rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; color: var(--text-primary);">
                                <div style="width: 26px; height: 26px; background: #3b82f6; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center;"><span class="material-icons-round" style="font-size: 16px;">pie_chart</span></div>
                                Analisi Uscite
                             </h3>
                             <span class="material-icons-round" style="color: var(--text-tertiary); cursor: pointer; font-size: 1.1rem;">settings</span>
                        </div>
                        
                        <div class="cat-list-clean" style="display: flex; flex-direction: column; gap: 1rem;">
                            ${sortedCats.slice(0, 10).map(([name, val]) => `
                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; border-bottom: 1px solid #f8f9fa; padding-bottom: 0.6rem;">
                                    <span style="font-weight: 500; color: var(--text-secondary);">${name}</span>
                                    <span style="font-weight: 700; color: var(--text-primary);">${formatAmount(val)} €</span>
                                </div>
                            `).join('')}
                        </div>

                        <div style="margin-top: 2rem;">
                            <button class="primary-btn secondary" style="width: 100%; justify-content: center; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0.75rem; background: white; color: var(--text-secondary); font-weight: 600; font-size: 0.85rem;" onclick="openCategoryManager()">
                                Gestisci Categorie
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Global Handlers
    window.setBankTransactionsYear = (y) => {
        state.bankTransactionsYear = y;
        renderBankTransactions(document.getElementById('content-area'));
    };

    window.setBankTransactionsType = (t) => {
        state.bankTransactionsType = t;
        renderBankTransactions(document.getElementById('content-area'));
    };

    function renderPendingSection() {
        if (pendingTransactions.length === 0) return '';
        return `
            <div class="pending-overview-card" style="background: #fffbeb; border-radius: 24px; padding: 1.5rem; margin-bottom: 2rem; border: 1px solid #ffeeba; box-shadow: var(--shadow-sm);">
                <h3 style="margin: 0 0 1rem 0; font-size: 0.95rem; color: #b45309; display: flex; align-items: center; gap: 0.5rem; font-weight: 700;">
                    <span class="material-icons-round" style="font-size: 20px;">warning</span> ${pendingTransactions.length} Movimenti da Riconciliare
                </h3>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                     ${pendingTransactions.map(t => renderRow(t, true, monthShort)).join('')}
                </div>
            </div>`;
    }

    function renderMonthGroups(movements, monthNames, monthShort) {
        const groups = {};
        movements.forEach(t => { const m = new Date(t.date).getMonth(); if (!groups[m]) groups[m] = []; groups[m].push(t); });
        const sortedMonths = Object.keys(groups).sort((a, b) => b - a);

        return sortedMonths.map(m => `
            <div class="month-block" style="margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-left: 0.5rem;">
                     <h3 style="font-size: 1.2rem; font-weight: 800; color: #111827; margin: 0; letter-spacing: -0.02em;">${monthNames[m]} ${year}</h3>
                     <div style="font-size: 0.9rem; font-weight: 700;">
                         <span style="color: #16a34a; margin-right: 1rem;">+${formatAmount(groups[m].filter(t => t.type === 'entrata').reduce((s, t) => s + parseFloat(t.amount), 0))} €</span>
                         <span style="color: #ef4444;">-${formatAmount(groups[m].filter(t => t.type === 'uscita').reduce((s, t) => s + parseFloat(t.amount), 0))} €</span>
                     </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.8rem;">
                    ${groups[m].sort((a, b) => new Date(b.date) - new Date(a.date)).map(t => renderRow(t, false, monthShort)).join('')}
                </div>
            </div>
        `).join('');
    }

    function renderRow(t, isPending, monthShortArray) {
        const d = new Date(t.date);
        const day = d.getDate();
        const month = monthShortArray ? monthShortArray[d.getMonth()] : (d.getMonth() + 1);
        const catName = t.transaction_categories?.name || (t.type === 'uscita' ? 'Uscita Generica' : 'Entrata Generica');
        const entityName = t.counterparty_name || t.suppliers?.name || t.clients?.business_name || 'Altra Operazione';

        let invoiceBadge = '';
        if (t.active_invoice_match || t.passive_invoice_match) {
            invoiceBadge = `<span style="background: #eff6ff; color: #3b82f6; padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; font-weight: 500; white-space: nowrap;">Fatt. #${(t.active_invoice_match || t.passive_invoice_match).invoice_number}</span>`;
        } else if (t.linked_invoices && t.linked_invoices.length > 0) {
            const firstId = t.linked_invoices[0];
            const allInvoices = [...(state.invoices || []), ...(state.passiveInvoices || [])];
            const linkedInv = allInvoices.find(inv => inv.id == firstId);
            const invDisplay = linkedInv ? `#${linkedInv.invoice_number}` : 'collegata';
            invoiceBadge = `<span style="background: #eff6ff; color: #3b82f6; padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; font-weight: 500; white-space: nowrap;">Fatt. ${invDisplay}</span>`;
        }

        // Category Badge Style - NEW BOLD STYLE
        let catBadgeStyle = `background: #f3f4f6; color: #4b5563; border: 1px solid rgba(0,0,0,0.05);`;
        let icon = 'horizontal_rule';

        if (t.type === 'uscita') {
            // Soft Pink/Red for Expenses
            catBadgeStyle = `background: #fff1f2; color: #e11d48; border: 1px solid #ffe4e6;`;
            icon = 'remove_circle_outline';
            if (catName.toLowerCase().includes('f24')) {
                catBadgeStyle = `background: #fff1f2; color: #be123c; border: 1px solid #ffe4e6;`;
            }
        } else {
            // Soft Green for Income
            catBadgeStyle = `background: #f0fdf4; color: #15803d; border: 1px solid #dcfce7;`;
            icon = 'add_circle_outline';
        }

        return `
        <div class="transaction-card" onclick="openBankTransactionModal('${t.id}')" style="background: white; border-radius: 20px; padding: 1.25rem 1.75rem; display: flex; align-items: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02); border: 1px solid rgba(0,0,0,0.04); transition: all 0.2s; cursor: pointer; margin-bottom: 0.8rem;">
            <!-- Date -->
            <div style="display: flex; flex-direction: column; align-items: center; margin-right: 2rem; min-width: 45px;">
                <span style="font-size: 1.3rem; font-weight: 500; line-height: 1; color: #111827;">${day}</span>
                <span style="font-size: 0.7rem; font-weight: 400; text-transform: uppercase; color: #9ca3af; margin-top: 4px;">${month}</span>
            </div>

            <!-- Description & Sub -->
            <div style="flex: 0 1 450px; min-width: 0; padding-right: 2rem;">
                <div style="font-weight: 400; font-size: 0.95rem; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; display: block; text-transform: uppercase; letter-spacing: 0.01em; margin-bottom: 0.35rem;">${t.description}</div>
                <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #6b7280; font-weight: 400;">
                    <span class="material-icons-round" style="font-size: 16px; color: #9ca3af;">folder_open</span> ${entityName}
                </div>
            </div>

            <!-- Spacer to push elements to the right -->
            <div style="flex: 1;"></div>

            <!-- Category Pill -->
            <div style="display: flex; align-items: center; gap: 0.5rem; padding: 5px 12px; border-radius: 50px; font-size: 0.8rem; font-weight: 400; margin-right: 1.5rem; flex-shrink: 0; ${catBadgeStyle}">
                <span class="material-icons-round" style="font-size: 16px;">${icon}</span> ${catName}
            </div>

            <!-- Invoice Pill -->
             <div style="margin-right: 2rem; flex-shrink: 0;">${invoiceBadge}</div>

            <!-- Amount -->
            <div style="text-align: right; min-width: 110px; flex-shrink: 0;">
                <div style="font-weight: 500; font-size: 1.15rem; color: ${t.type === 'entrata' ? '#16a34a' : '#dc2626'}; letter-spacing: -0.02em;">
                    ${t.type === 'entrata' ? '+' : '-'} ${formatAmount(Math.abs(t.amount))} €
                </div>
            </div>

            <!-- Arrow or Actions -->
            <div style="margin-left: 1.5rem; flex-shrink: 0;">
                ${isPending ? `
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="icon-btn success" onclick="event.stopPropagation(); handleApproveTx('${t.id}')" title="Approva" style="width: 32px; height: 32px; background: #dcfce7; color: #16a34a;">
                            <span class="material-icons-round" style="font-size: 18px;">check</span>
                        </button>
                        <button class="icon-btn danger" onclick="event.stopPropagation(); handleRejectTx('${t.id}')" title="Scarta" style="width: 32px; height: 32px; background: #fee2e2; color: #dc2626;">
                            <span class="material-icons-round" style="font-size: 18px;">close</span>
                        </button>
                    </div>
                ` : `
                    <span class="material-icons-round" style="font-size: 24px; color: #d1d5db;">chevron_right</span>
                `}
            </div>
        </div>
        `;
    }

    // Attach Handlers
    window.setBankTransactionsYear = (y) => { state.bankTransactionsYear = y; renderBankTransactions(container); };
    window.setBankTransactionsType = (t) => { state.bankTransactionsType = t; renderBankTransactions(container); };

    // Approve/Reject Handlers
    window.handleApproveTx = async (id) => {
        try {
            // Find the transaction object to check for pre-calculated matches
            const t = state.bankTransactions.find(x => x.id == id) || pendingTransactions.find(x => x.id == id);

            const overrides = {};
            if (t) {
                if (t.active_invoice_match) overrides.active_invoice_id = t.active_invoice_match.id;
                else if (t.passive_invoice_match) overrides.passive_invoice_id = t.passive_invoice_match.id;
            }

            await approveBankTransaction(id, overrides);
            window.showAlert('Movimento approvato!', 'success');
            await renderBankTransactions(container);
        } catch (e) {
            window.showAlert('Errore approvazione: ' + e.message, 'error');
        }
    };

    window.handleRejectTx = async (id) => {
        if (!await window.showConfirm("Sei sicuro di voler scartare questo movimento?")) return;
        try {
            await rejectBankTransaction(id);
            window.showAlert('Movimento scartato.', 'success');
            await renderBankTransactions(container);
        } catch (e) {
            window.showAlert('Errore scarto: ' + e.message, 'error');
        }
    };
}

/**
 * --- MODAL COMPONENT (Dettaglio + Sistema Categorie Affianco) ---
 */
export async function openBankTransactionModal(id = null) {
    if (!state.clients) await fetchClients();
    if (!state.suppliers) await fetchSuppliers();
    if (!state.collaborators) await fetchCollaborators();
    if (!state.transactionCategories) await fetchTransactionCategories();
    if (!state.invoices) await fetchInvoices();
    if (!state.passiveInvoices) await fetchPassiveInvoices();

    if (!document.getElementById('bank-transaction-modal')) {
        initBankTransactionModals();
    }

    const modal = document.getElementById('bank-transaction-modal');
    const form = document.getElementById('bank-transaction-form');

    let t = id ? (state.bankTransactions.find(x => x.id == id) || pendingTransactions.find(x => x.id == id)) : null;

    // Reset Form State
    form.reset();
    document.getElementById('bt-id').value = id || '';

    // DETERMINE MODE: READ-ONLY vs EDIT
    const isRecorded = t && t.status !== 'pending';

    if (isRecorded) {
        // --- READ ONLY MODE ---
        document.getElementById('bt-read-only-view').style.display = 'block';
        document.getElementById('bt-edit-view').style.display = 'none';
        document.getElementById('bt-footer-read').style.display = 'flex';
        document.getElementById('bt-footer-edit').style.display = 'none';

        document.getElementById('bt-modal-title').textContent = 'Dettaglio Movimento';
        renderReadOnlyView(t);

        // Prepare hidden form in background case user switches to edit
        populateBankTransactionForm(t);
    } else {
        // --- EDIT / NEW MODE ---
        document.getElementById('bt-read-only-view').style.display = 'none';
        document.getElementById('bt-edit-view').style.display = 'grid';
        document.getElementById('bt-footer-read').style.display = 'none';
        document.getElementById('bt-footer-edit').style.display = 'flex';

        if (t) {
            document.getElementById('bt-modal-title').textContent = 'Riconcilia Movimento';
            populateBankTransactionForm(t);
        } else {
            document.getElementById('bt-modal-title').textContent = 'Nuovo Movimento Manuale';
            document.getElementById('bt-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('bt-type-in').checked = true;
            updateBankModalUI();
            toggleCounterpartyManual(false);
            document.getElementById('bt-original-data').style.display = 'none';
            document.getElementById('bt-delete-btn').style.display = 'none';
        }
    }

    modal.classList.add('active');
}

/**
 * --- FORM POPULATION HELPER ---
 */
function populateBankTransactionForm(t) {
    document.getElementById('bt-delete-btn').style.display = 'flex';
    document.getElementById('bt-date').value = t.date;
    document.getElementById('bt-amount').value = t.amount;
    document.getElementById('bt-description').value = t.description;

    const type = (t.type || 'entrata').toLowerCase();
    document.querySelector(`input[name="bt-type"][value="${type}"]`).checked = true;

    updateBankModalUI();

    const entitySelect = document.getElementById('bt-entity-select');
    let entityFound = false;
    if (type === 'entrata' && t.client_id) { entitySelect.value = t.client_id; entityFound = true; }
    else if (type === 'uscita') {
        if (t.supplier_id) { entitySelect.value = `S_${t.supplier_id}`; entityFound = true; }
        else if (t.collaborator_id) { entitySelect.value = `C_${t.collaborator_id}`; entityFound = true; }
    }

    if (!entityFound && t.counterparty_name) {
        toggleCounterpartyManual(true);
        document.getElementById('bt-counterparty-text').value = t.counterparty_name;
    } else {
        toggleCounterpartyManual(false);
    }

    if (type === 'uscita') document.getElementById('bt-category').value = t.category_id || '';

    let linked = t.linked_invoices || [];
    if (t.active_invoice_id) linked.push(t.active_invoice_id);
    if (t.passive_invoice_id) linked.push(t.passive_invoice_id);
    updateInvoiceOptions(linked);

    if (t.raw) {
        populateOriginalBankData(t.raw);
        document.getElementById('bt-original-data').style.display = 'block';
    } else {
        document.getElementById('bt-original-data').style.display = 'none';
    }
}

/**
 * --- INIZIALIZZAZIONE MODAL (Struttura 2 Colonne Richiesta) ---
 */
export function initBankTransactionModals() {
    if (document.getElementById('bank-transaction-modal')) return;
    document.body.insertAdjacentHTML('beforeend', `
        <div id="bank-transaction-modal" class="modal">
            <div class="modal-content glass-card" style="max-width: 1100px; padding: 0; display: flex; flex-direction: column; max-height: 92vh; overflow: hidden;">
                <div class="modal-header" style="padding: 1.5rem 2rem; border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; background: #fff;">
                    <h2 id="bt-modal-title" style="margin:0; font-family: var(--font-titles); font-weight: 500;">Dettaglio Movimento</h2>
                    <button class="close-modal material-icons-round" onclick="closeBankTransactionModal()">close</button>
                </div>

                <!-- READ ONLY VIEW CONTAINER -->
                <div id="bt-read-only-view" class="custom-scrollbar" style="display: none; flex: 1; overflow-y: auto; padding: 2rem;">
                    <!-- Content injected via JS -->
                </div>

                <!-- EDIT VIEW CONTAINER (The existing form structure) -->
                <div id="bt-edit-view" class="modal-body custom-scrollbar" style="flex: 1; overflow-y: auto; padding: 0; display: grid; grid-template-columns: 1fr 380px;">
                    
                    <!-- LATO SINISTRO: FORM E CAMPI -->
                    <div style="padding: 2.5rem; background: #fff; border-right: 1px solid var(--glass-border);">
                        <form id="bank-transaction-form" style="display: flex; flex-direction: column; gap: 2rem;">
                            <input type="hidden" id="bt-id">
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                                <div class="form-group">
                                    <label class="bt-section-label" style="display: block; margin-bottom: 0.75rem; font-weight: 500; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase;">Tipo Movimento</label>
                                    <div class="segmented-control">
                                        <input type="radio" name="bt-type" value="entrata" id="bt-type-in" checked onchange="updateBankModalUI()">
                                        <label for="bt-type-in">Entrata</label>
                                        <input type="radio" name="bt-type" value="uscita" id="bt-type-out" onchange="updateBankModalUI()">
                                        <label for="bt-type-out">Uscita</label>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="bt-section-label" style="display: block; margin-bottom: 0.75rem; font-weight: 500; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase;">Data Esecuzione</label>
                                    <input type="date" id="bt-date" class="modal-input" required>
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                                <div class="form-group">
                                    <label class="bt-section-label" style="display: block; margin-bottom: 0.75rem; font-weight: 500; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase;">Importo (€)</label>
                                    <input type="number" id="bt-amount" class="modal-input" step="0.01" required style="font-size: 1.25rem; font-weight: 600;">
                                </div>
                                <div class="form-group">
                                    <label class="bt-section-label" style="display: block; margin-bottom: 0.75rem; font-weight: 500; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase;">Controparte</label>
                                    <div style="display: flex; gap: 0.5rem;">
                                        <select id="bt-entity-select" class="modal-input" style="flex:1;" onchange="updateInvoiceOptions()"></select>
                                        <button type="button" class="icon-btn" onclick="toggleCounterpartyManual()"><span class="material-icons-round">edit_note</span></button>
                                    </div>
                                    <input type="text" id="bt-counterparty-text" class="modal-input" style="display: none; margin-top: 0.75rem;" placeholder="Inserisci nome libero...">
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="bt-section-label" style="display: block; margin-bottom: 0.75rem; font-weight: 500; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase;">Descrizione Operazione</label>
                                <input type="text" id="bt-description" class="modal-input" required placeholder="Causale movimento...">
                            </div>

                            <div class="form-group">
                                <label class="bt-section-label" style="display: block; margin-bottom: 0.75rem; font-weight: 500; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase;">Associa a Fatture</label>
                                <div id="bt-invoice-list" class="bt-invoice-list-container custom-scrollbar" style="max-height: 250px; overflow-y: auto; border: 1px solid var(--glass-border); border-radius: 12px; background: #fafafa;"></div>
                            </div>
                        </form>
                    </div>

                    <!-- LATO DESTRO: SISTEMA CATEGORIE E DATI BANCA -->
                    <div style="padding: 2.5rem; background: var(--bg-secondary); display: flex; flex-direction: column; gap: 2.5rem;">
                        
                        <div id="bt-category-group" class="form-group">
                            <label class="bt-section-label" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; font-weight: 500; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase;">
                                Categoria Uscita 
                                <span class="material-icons-round" style="font-size: 1.25rem; cursor: pointer; color: var(--brand-blue);" onclick="openCategoryManager()" title="Gestisci albero categorie">auto_stories</span>
                            </label>
                            <select id="bt-category" class="modal-input" style="background: white; border-color: rgba(0,0,0,0.1);"></select>
                        </div>

                        <div id="bt-original-data" class="glass-card" style="padding: 1.5rem; border: 1px dashed rgba(0,0,0,0.15); background: #fff; border-radius: 18px;">
                            <h4 style="margin: 0 0 1rem 0; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-tertiary); display: flex; align-items: center; gap: 0.5rem;">
                                <span class="material-icons-round" style="font-size: 1rem;">account_balance</span> Dati Originali Banca
                            </h4>
                            <div style="font-size: 0.85rem; display: flex; flex-direction: column; gap: 0.8rem;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid #f1f5f9;">
                                    <div>
                                        <small style="color: var(--text-tertiary); font-size: 0.65rem; text-transform: uppercase;">DATA</small><br>
                                        <span id="bt-orig-data-contabile" style="font-weight: 600; font-family: monospace;">-</span>
                                    </div>
                                    <div style="text-align: right;">
                                        <small style="color: var(--text-tertiary); font-size: 0.65rem; text-transform: uppercase;">IMPORTO</small><br>
                                        <span id="bt-orig-importo" style="font-weight: 700; font-size: 1rem; font-family: monospace;">-</span>
                                    </div>
                                </div>
                                <div>
                                    <small style="color: var(--text-tertiary); font-size: 0.65rem; text-transform: uppercase;">DESCRIZIONE BREVE</small><br>
                                    <div id="bt-orig-desc-short" style="font-weight: 500; color: var(--text-primary); margin-top: 2px;">-</div>
                                </div>
                                <div>
                                    <small style="color: var(--text-tertiary); font-size: 0.65rem; text-transform: uppercase;">DETTAGLIO ESTESO</small><br>
                                    <div id="bt-orig-descrizione" style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4; margin-top: 4px; font-style: italic; font-family: monospace; word-break: break-all;">-</div>
                                </div>
                            </div>
                        </div>

                        <div style="margin-top: auto; padding: 1.25rem; background: #e3f2fd; border: 1px solid #bbdefb; border-radius: 16px; font-size: 0.85rem; color: #1976d2; line-height: 1.5;">
                            <div style="display: flex; align-items: center; gap: 0.6rem; font-weight: 600; margin-bottom: 0.5rem;">
                                <span class="material-icons-round" style="font-size: 1.1rem;">verified</span> Riconciliazione
                            </div>
                            Saldando questo movimento con una fattura, lo stato del documento passerà automaticamente a <b style="color: #1565c0;">Pagata</b>.
                        </div>
                    </div>
                </div>

                <div class="modal-footer" style="padding: 1.5rem 2rem; border-top: 1px solid var(--glass-border); display: flex; justify-content: space-between; background: #fff;">
                    <!-- READ ONLY BUTTONS -->
                    <div id="bt-footer-read" style="display: none; width: 100%; justify-content: space-between;">
                        <button class="primary-btn secondary danger" id="bt-delete-btn-read" onclick="handleDeleteBT()">Elimina</button>
                        <div style="display: flex; gap: 1rem;">
                            <button class="primary-btn secondary" onclick="closeBankTransactionModal()">Chiudi</button>
                            <button class="primary-btn" onclick="switchToEditMode()">Modifica</button>
                        </div>
                    </div>

                    <!-- EDIT BUTTONS -->
                    <div id="bt-footer-edit" style="display: flex; width: 100%; justify-content: space-between;">
                         <button class="primary-btn secondary danger" id="bt-delete-btn" onclick="handleDeleteBT()">Elimina Movimento</button>
                         <div style="display: flex; gap: 1rem; margin-left: auto;">
                            <button class="primary-btn secondary" onclick="closeBankTransactionModal()">Annulla</button>
                            <button class="primary-btn" onclick="submitBankTransaction()">Conferma e Salva</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `);
}

/**
 * --- MODAL UI HELPERS ---
 */
export function updateBankModalUI() {
    const type = document.querySelector('input[name="bt-type"]:checked').value;
    const isIncome = type === 'entrata';
    document.getElementById('bt-category-group').style.display = isIncome ? 'none' : 'block';

    const select = document.getElementById('bt-entity-select');
    select.innerHTML = '<option value="">Seleziona...</option>';
    if (isIncome) {
        state.clients.forEach(c => select.add(new Option(c.business_name, c.id)));
    } else {
        const sGrp = document.createElement('optgroup'); sGrp.label = 'Fornitori';
        state.suppliers.forEach(s => sGrp.appendChild(new Option(s.name, `S_${s.id}`)));
        select.appendChild(sGrp);
        const cGrp = document.createElement('optgroup'); cGrp.label = 'Collaboratori';
        state.collaborators.filter(c => c.is_active !== false && c.active !== false).forEach(c => cGrp.appendChild(new Option(c.full_name, `C_${c.id}`)));
        select.appendChild(cGrp);
    }

    if (!isIncome) {
        const catSelect = document.getElementById('bt-category');
        catSelect.innerHTML = '<option value="">Seleziona categoria...</option>';
        state.transactionCategories.filter(c => c.type === 'uscita' && !c.parent_id).forEach(p => {
            const opt = new Option(p.name.toUpperCase(), p.id); opt.style.fontWeight = 'bold';
            catSelect.add(opt);
            state.transactionCategories.filter(c => c.parent_id === p.id).forEach(sub => catSelect.add(new Option(`— ${sub.name}`, sub.id)));
        });
    }
    updateInvoiceOptions();
}

export function updateInvoiceOptions(preselected = []) {
    const type = document.querySelector('input[name="bt-type"]:checked').value;
    const entityVal = document.getElementById('bt-entity-select').value;
    const list = document.getElementById('bt-invoice-list');

    let invoices = [];
    if (entityVal) {
        if (type === 'entrata') invoices = state.invoices.filter(i => i.client_id == entityVal && (i.status !== 'Saldata' || preselected.includes(i.id)));
        else {
            const [pref, id] = entityVal.split('_');
            invoices = state.passiveInvoices.filter(i => ((pref === 'S' && i.supplier_id == id) || (pref === 'C' && i.collaborator_id == id)) && (i.status !== 'Pagata' || preselected.includes(i.id)));
        }
    }

    if (invoices.length === 0) { list.innerHTML = '<div style="text-align: center; padding: 1.5rem; color: var(--text-tertiary); font-size: 0.85rem;">Nessun documento disponibile per questa controparte.</div>'; return; }
    list.innerHTML = invoices.map(i => `
        <label class="bt-invoice-item" style="display: flex; align-items: center; gap: 1rem; padding: 1rem; border-bottom: 1px solid var(--glass-border); cursor: pointer;">
            <input type="checkbox" name="bt-invoices" value="${i.id}" ${preselected.includes(i.id) ? 'checked' : ''}>
            <div style="flex:1;">
                <div style="font-weight: 500; font-size: 0.9rem;">Fattura #${i.invoice_number}</div>
                <div style="font-size: 0.75rem; color: var(--text-tertiary);">${i.status}</div>
            </div>
            <div style="font-weight: 600; font-size: 0.95rem;">€ ${formatAmount(i.amount_tax_included || i.amount_gross || 0)}</div>
        </label>
    `).join('');
}

export function toggleCounterpartyManual(force) {
    const select = document.getElementById('bt-entity-select'), text = document.getElementById('bt-counterparty-text');
    const showing = force !== undefined ? !force : text.style.display === 'block';
    if (showing) { text.style.display = 'none'; select.style.display = 'block'; }
    else { text.style.display = 'block'; select.style.display = 'none'; select.value = ''; }
}

export function closeBankTransactionModal() { document.getElementById('bank-transaction-modal').classList.remove('active'); }

export async function submitBankTransaction() {
    const form = document.getElementById('bank-transaction-form');
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const type = document.querySelector('input[name="bt-type"]:checked').value;
    const isManual = document.getElementById('bt-counterparty-text').style.display === 'block';
    const entityVal = document.getElementById('bt-entity-select').value;
    const checkedInv = Array.from(document.querySelectorAll('input[name="bt-invoices"]:checked')).map(cb => cb.value);

    let clientId = null, supplierId = null, collaboratorId = null;
    if (!isManual && entityVal) {
        if (type === 'entrata') clientId = entityVal;
        else { const [p, id] = entityVal.split('_'); if (p === 'S') supplierId = id; else collaboratorId = id; }
    }

    const payload = {
        id: document.getElementById('bt-id').value || undefined,
        date: document.getElementById('bt-date').value,
        amount: parseFloat(document.getElementById('bt-amount').value),
        description: document.getElementById('bt-description').value,
        type: type,
        category_id: type === 'uscita' ? document.getElementById('bt-category').value : null,
        counterparty_name: isManual ? document.getElementById('bt-counterparty-text').value : null,
        client_id: clientId, supplier_id: supplierId, collaborator_id: collaboratorId,
        linked_invoices: checkedInv,
        active_invoice_id: (type === 'entrata' && checkedInv.length > 0) ? checkedInv[0] : null,
        passive_invoice_id: (type === 'uscita' && checkedInv.length > 0) ? checkedInv[0] : null
    };

    try {
        await upsertBankTransaction(payload);
        closeBankTransactionModal();
        renderBankTransactions(document.getElementById('content-area'));
        window.showAlert('Dati aggiornati con successo!');
    } catch (e) { window.showAlert(e.message, 'error'); }
}

export async function handleDeleteBT() {
    const id = document.getElementById('bt-id').value;
    if (!id || !await window.showConfirm("Eliminare definitivamente questo movimento dal registro?", { type: 'danger' })) return;
    try { await deleteBankTransaction(id); closeBankTransactionModal(); renderBankTransactions(document.getElementById('content-area')); } catch (e) { window.showAlert(e.message, 'error'); }
}

function populateOriginalBankData(raw) {
    const src = raw.source || {};

    // Date: favor contabile_date
    document.getElementById('bt-orig-data-contabile').textContent = src.contabile_date || src.data_contabile || raw.row?.['__EMPTY'] || '-';

    // Amount: favor amount_signed
    let amtDisplay = '-';
    if (src.amount_signed !== undefined) {
        amtDisplay = (src.amount_signed > 0 ? '+' : '') + formatAmount(src.amount_signed);
    } else {
        amtDisplay = formatAmount(src.amount || 0);
    }
    document.getElementById('bt-orig-importo').textContent = amtDisplay + ' €';

    // Descriptions
    document.getElementById('bt-orig-desc-short').textContent = src.description || '-';
    document.getElementById('bt-orig-descrizione').textContent = src.extended_description || src.descrizione || raw.row?.['__EMPTY_2'] || '-';
}

/**
 * --- CATEGORY MANAGER MODAL ---
 */
export function initCategoryManagerModal() {
    if (document.getElementById('category-manager-modal')) return;
    document.body.insertAdjacentHTML('beforeend', `
        <div id="category-manager-modal" class="modal">
            <div class="modal-content glass-card" style="max-width: 550px;">
                <div class="modal-header">
                    <h2 style="font-family: var(--font-titles);">Albero Categorie Uscite</h2>
                    <button class="close-modal material-icons-round" onclick="document.getElementById('category-manager-modal').classList.remove('active')">close</button>
                </div>
                <div class="modal-body custom-scrollbar" style="max-height: 550px; overflow-y: auto;">
                    <div id="cat-manager-list" style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 2.5rem;"></div>
                    <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 20px; border: 1px solid rgba(0,0,0,0.05);">
                        <h4 style="margin: 0 0 1.25rem 0; color: var(--text-secondary);">Aggiungi Nuova</h4>
                        <form id="new-category-form" style="display: grid; grid-template-columns: 1fr 140px auto; gap: 0.5rem;">
                            <input type="text" id="new-cat-name" placeholder="Nome..." required class="modal-input">
                            <select id="new-cat-parent" class="modal-input"><option value="">Principale</option></select>
                            <button type="submit" class="primary-btn small">+</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `);
    document.getElementById('new-category-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const n = document.getElementById('new-cat-name'), p = document.getElementById('new-cat-parent');
        try {
            const { upsertTransactionCategory } = await import('../modules/api.js?v=157');
            await upsertTransactionCategory({ name: n.value, type: 'uscita', parent_id: p.value || null });
            n.value = ''; reloadCatList();
        } catch (err) { window.showAlert(err.message, 'error'); }
    });
}

window.openCategoryManager = () => { initCategoryManagerModal(); document.getElementById('category-manager-modal').classList.add('active'); reloadCatList(); };

async function reloadCatList() {
    const list = document.getElementById('cat-manager-list'), sel = document.getElementById('new-cat-parent');
    if (!state.transactionCategories) await fetchTransactionCategories();
    const cats = state.transactionCategories.filter(c => c.type === 'uscita');
    const parents = cats.filter(c => !c.parent_id).sort((a, b) => a.name.localeCompare(b.name));
    sel.innerHTML = '<option value="">Principale</option>';
    parents.forEach(p => sel.appendChild(new Option(p.name, p.id)));
    list.innerHTML = parents.map(p => {
        const children = cats.filter(c => c.parent_id === p.id).sort((a, b) => a.name.localeCompare(b.name));
        return `
            <div style="background: white; border: 1px solid var(--glass-border); border-radius: 12px; overflow: hidden; box-shadow: var(--shadow-sm);">
                <div style="padding: 0.85rem 1rem; display: flex; justify-content: space-between; align-items: center; font-weight: 600;">
                    <span>${p.name}</span> 
                    <button class="icon-btn danger small" onclick="deleteCategory('${p.id}')"><span class="material-icons-round" style="font-size: 1.1rem;">delete_outline</span></button>
                </div>
                ${children.map(c => `
                    <div style="padding: 0.65rem 1rem 0.65rem 2.5rem; border-top: 1px solid rgba(0,0,0,0.03); display: flex; justify-content: space-between; align-items: center; background: #fafafa; font-size: 0.9rem;">
                        <span>${c.name}</span> 
                        <button class="icon-btn danger small" onclick="deleteCategory('${c.id}')"><span class="material-icons-round" style="font-size: 1rem;">delete_sweep</span></button>
                    </div>`).join('')}
            </div>`;
    }).join('');
}

window.deleteCategory = async (id) => { if (await window.showConfirm("Sei sicuro di voler eliminare questa categoria?", { type: 'danger' })) { try { const { deleteTransactionCategory } = await import('../modules/api.js?v=157'); await deleteTransactionCategory(id); reloadCatList(); } catch (e) { window.showAlert(e.message, 'error'); } } };

/**
 * --- MODAL IMPORTAZIONE ---
 */
export function initImportModal() {
    if (document.getElementById('import-transactions-modal')) return;
    document.body.insertAdjacentHTML('beforeend', `
        <div id="import-transactions-modal" class="modal">
            <div class="modal-content glass-card" style="max-width: 800px;">
                <div class="modal-header"><h2>Importazione Movimenti</h2><button class="close-modal material-icons-round" onclick="resetImport(); closeImportModal()">close</button></div>
                <div class="modal-body">
                    <div id="import-step-upload" style="text-align: center; padding: 4rem 2rem;">
                        <input type="file" id="import-file-input" accept=".csv, .xlsx, .xls" style="display: none;" onchange="handleImportFile(this)">
                        <button class="primary-btn" onclick="document.getElementById('import-file-input').click()">Seleziona file bancario (.xlsx)</button>
                        <p style="margin-top: 1rem; color: var(--text-tertiary); font-size: 0.85rem;">Trascina qui o clicca per caricare</p>
                    </div>
                    <div id="import-step-loading" style="display: none; text-align: center; padding: 4rem;">
                        <div class="spinner" style="margin: 0 auto 1.5rem;"></div>
                        <p>Analisi movimenti con AI in corso...</p>
                    </div>
                    <div id="import-step-review" style="display: none;">
                        <div class="table-container" style="max-height: 400px; overflow-y: auto; border: 1px solid var(--glass-border); border-radius: 12px;">
                            <table class="data-table">
                                <thead style="position: sticky; top: 0; background: #fafafa; z-index: 10;"><tr><th>Data</th><th>Descrizione</th><th style="text-align: right;">Importo</th></tr></thead>
                                <tbody id="import-table-body"></tbody>
                            </table>
                        </div>
                        <div class="modal-footer" style="padding: 1.5rem 0 0; display: flex; justify-content: flex-end; gap: 1rem;">
                            <button class="primary-btn secondary" onclick="resetImport()">Cambia File</button>
                            <button class="primary-btn" onclick="confirmImport()">Conferma Importazione</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `);
}
window.openImportModal = () => { initImportModal(); document.getElementById('import-transactions-modal').classList.add('active'); };
window.closeImportModal = () => document.getElementById('import-transactions-modal').classList.remove('active');
window.resetImport = () => { document.getElementById('import-step-upload').style.display = 'block'; document.getElementById('import-step-review').style.display = 'none'; document.getElementById('import-file-input').value = ''; };

window.handleImportFile = async (input) => {
    const file = input.files[0]; if (!file) return;
    document.getElementById('import-step-upload').style.display = 'none';
    document.getElementById('import-step-loading').style.display = 'block';
    const fd = new FormData(); fd.append('file', file);
    try {
        const r = await fetch('https://sacred-roughy-renewing.ngrok-free.app/webhook/bank/import-xlsx', { method: 'POST', body: fd });
        const res = await r.json();
        if (res.rows) showImportReview(res.rows);
        else throw new Error("File non processato correttamente");
    } catch (e) { window.showAlert(e.message, 'error'); resetImport(); }
    document.getElementById('import-step-loading').style.display = 'none';
};

let piList = [];
function showImportReview(rows) {
    piList = rows;
    document.getElementById('import-table-body').innerHTML = rows.map(r => `
        <tr>
            <td>${r.date || '-'}</td>
            <td><div style="font-weight:500;">${r.description || '-'}</div><div style="font-size:0.7rem; color:var(--text-tertiary);">${r.counterparty_name || ''}</div></td>
            <td style="text-align: right; font-weight: 600;">${formatAmount(r.amount)} €</td>
        </tr>`).join('');
    document.getElementById('import-step-review').style.display = 'block';
}

window.confirmImport = async () => {
    if (await window.showConfirm(`Confermi l'importazione di ${piList.length} movimenti?`)) {
        try { for (const r of piList) await upsertBankTransaction(r); closeImportModal(); renderBankTransactions(document.getElementById('content-area')); } catch (e) { window.showAlert(e.message, 'error'); }
    }
};

// Global Bindings
window.openBankTransactionModal = openBankTransactionModal;
window.closeBankTransactionModal = closeBankTransactionModal;
window.submitBankTransaction = submitBankTransaction;
window.handleDeleteBT = handleDeleteBT;
window.toggleCounterpartyManual = toggleCounterpartyManual;
window.updateBankModalUI = updateBankModalUI;
window.updateInvoiceOptions = updateInvoiceOptions;
window.switchToEditMode = switchToEditMode;
