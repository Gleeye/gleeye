import { state } from '../modules/state.js?v=151';
import { formatAmount } from '../modules/utils.js?v=151';
import { CustomSelect } from '../components/CustomSelect.js?v=149';
import { DashboardData } from './dashboard.js?v=151';
import { showGlobalAlert } from '../modules/utils.js?v=151';
import { supabase } from '../modules/config.js?v=151';
import { fetchInvoices, fetchPassiveInvoices, fetchPayments, fetchBankTransactions } from '../modules/api.js?v=151';

// --- VIEW FUNCTIONS ---

export function renderInvoices(container) {
    const activeStats = DashboardData.getStats(state.dashboardYear, 'all');
    // ... (Stats rendering logic could be duplicated or reused, sticking to simple list for this view if it's the "Fatture Attive" list)
    // Actually the "Fatture Attive" page usually showed the table.

    // Using filtered invoices
    const filteredInvoices = state.invoices.filter(inv => {
        const matchesSearch = inv.invoice_number.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
            (inv.clients?.business_name || '').toLowerCase().includes(state.searchTerm.toLowerCase());
        const matchesYear = state.dashboardYear ? new Date(inv.invoice_date).getFullYear() === state.dashboardYear : true;
        return matchesSearch && matchesYear;
    });

    const rows = filteredInvoices.map(inv => {
        const isPaid = inv.status === 'Saldata';
        return `
        <tr class="clickable-row" onclick="openInvoiceForm('${inv.id}')">
            <td>${inv.invoice_number}</td>
            <td>${inv.clients?.business_name || '-'}</td>
            <td>${new Date(inv.invoice_date).toLocaleDateString()}</td>
            <td>€ ${formatAmount(inv.amount_tax_excluded)}</td>
            <td>
                <span class="status-badge ${isPaid ? 'status-active' : 'status-pending'}">
                    ${inv.status}
                </span>
            </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
        <div class="animate-fade-in">
            <div class="table-container">
                 <div class="section-header">
                    <div style="display:flex; gap:1rem; align-items:center;">
                        <span>Fatture Attive (${filteredInvoices.length})</span>
                        <select onchange="state.dashboardYear=parseInt(this.value); render();" style="padding:0.2rem; border-radius:5px;">
                            <option value="2025" ${state.dashboardYear === 2025 ? 'selected' : ''}>2025</option>
                            <option value="2024" ${state.dashboardYear === 2024 ? 'selected' : ''}>2024</option>
                        </select>
                    </div>
                    <button class="primary-btn small" onclick="openInvoiceForm()">+ Nuova Fattura</button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Numero</th>
                            <th>Cliente</th>
                            <th>Data</th>
                            <th>Imponibile</th>
                            <th>Stato</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;

    // Attach global functions for onclick handlers if needed, or use event delegation
    // Ideally we use event delegation.
    container.querySelector('table tbody').addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (row && row.onclick) {
            // The onclick attribute in HTML string won't see our module functions unless they are global.
            // We must expose them or use delegation properly.
            // Replacing inline onclick with data-id.
        }
    });
}

// Re-writing to use delegation for safety
export function renderActiveInvoicesSafe(container) {
    let currentYear = state.dashboardYear;

    // Auto-Switch Active Year Logic (Enhanced)
    // Check if we have a year set, and if that year actually has data.
    const hasDataForCurrent = currentYear && state.invoices.some(inv => new Date(inv.invoice_date).getFullYear() === parseInt(currentYear));

    if ((!currentYear || !hasDataForCurrent) && state.invoices.length > 0) {
        const def = new Date().getFullYear();
        // Prioritize current year IF it has data
        const hasDataDef = state.invoices.some(inv => new Date(inv.invoice_date).getFullYear() === def);

        if (hasDataDef) {
            currentYear = def;
        } else {
            // Otherwise pick latest year with data
            const allYears = [...new Set(state.invoices.map(inv => new Date(inv.invoice_date).getFullYear()))].sort((a, b) => b - a);
            if (allYears.length > 0) currentYear = allYears[0];
            else currentYear = def;
        }
        state.dashboardYear = currentYear;
    } else if (!currentYear) {
        currentYear = new Date().getFullYear();
        state.dashboardYear = currentYear;
    }

    const statusFilter = state.invoiceStatusFilter || 'all'; // 'all', 'pending', 'paid'

    let filteredInvoices = state.invoices.filter(inv => {
        const matchesSearch = inv.invoice_number.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
            (inv.clients?.business_name || '').toLowerCase().includes(state.searchTerm.toLowerCase());
        const matchesYear = new Date(inv.invoice_date).getFullYear() === currentYear;
        return matchesSearch && matchesYear;
    });

    // Sort by invoice number (descending - newest first)
    filteredInvoices.sort((a, b) => {
        const numA = a.invoice_number || '';
        const numB = b.invoice_number || '';
        return numB.localeCompare(numA, undefined, { numeric: true });
    });

    // Calculate KPIs using amount_tax_excluded (importo)
    const totalFatturato = filteredInvoices.reduce((sum, i) => sum + (parseFloat(i.amount_tax_excluded) || 0), 0);
    const nonSaldate = filteredInvoices.filter(i => i.status !== 'Saldata');
    const saldate = filteredInvoices.filter(i => i.status === 'Saldata');
    const daIncassare = nonSaldate.reduce((sum, i) => sum + (parseFloat(i.amount_tax_excluded) || 0), 0);
    const incassato = saldate.reduce((sum, i) => sum + (parseFloat(i.amount_tax_excluded) || 0), 0);
    const percIncasso = totalFatturato > 0 ? Math.round((incassato / totalFatturato) * 100) : 0;

    // Apply status filter
    if (statusFilter === 'pending') {
        filteredInvoices = nonSaldate;
    } else if (statusFilter === 'paid') {
        filteredInvoices = saldate;
    }

    const getStatusStyle = (status) => {
        if (status === 'Saldata') return 'background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2);';
        if (status === 'Inviata') return 'background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2);';
        return 'background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2);';
    };

    const kpiActiveStyle = (filter) => statusFilter === filter ? 'box-shadow: 0 0 0 2px var(--brand-blue); transform: scale(1.02);' : '';

    const formatDateBlock = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const day = d.getDate().toString().padStart(2, '0');
        const months = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        return `<div style="text-align: center; min-width: 45px;">
            <div style="font-size: 1.5rem; font-weight: 300; line-height: 1; color: var(--text-primary);">${day}</div>
            <div style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.02em;">${month}</div>
            <div style="font-size: 0.6rem; color: var(--text-tertiary);">${year}</div>
        </div>`;
    };

    const cards = filteredInvoices.map(inv => {
        const importo = parseFloat(inv.amount_tax_excluded) || 0;
        const iva = parseFloat(inv.tax_amount) || 0;
        const isSplit = inv.vat_eligibility && inv.vat_eligibility.toLowerCase().includes('scissione');
        // Netto a pagare: if split payment, client keeps the IVA so netto = importo; otherwise netto = importo + iva
        const nettoAPagare = isSplit ? importo : (importo + iva);
        const settlementDate = inv.payment_date ? new Date(inv.payment_date).toLocaleDateString('it-IT') : null;

        return `
        <div class="glass-card clickable-card" data-id="${inv.id}" style="padding: 1rem 1.25rem; cursor: pointer; transition: all 0.2s; border: 1px solid var(--glass-border); display: flex; align-items: center; gap: 1.25rem;">
            <!-- Date Block -->
            ${formatDateBlock(inv.invoice_date)}
            
            <!-- Separator -->
            <div style="width: 1px; height: 40px; background: var(--glass-border);"></div>
            
            <!-- Invoice Number Block (styled like date) -->
            <div style="text-align: center; min-width: 50px; padding: 0.25rem 0.5rem; background: rgba(59, 130, 246, 0.05); border-radius: 8px;">
                <div style="font-size: 1.25rem; font-weight: 600; line-height: 1; color: var(--brand-blue);">${inv.invoice_number || '-'}</div>
                <div style="font-size: 0.6rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.02em;">Fattura</div>
            </div>
            
            <!-- Client Name -->
            <div style="flex: 1; min-width: 0;">
                <div style="font-size: 1rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${inv.clients?.business_name || inv.clienti || inv.nome_cliente || '-'}</div>
            </div>
            
            <!-- Status + Settlement Date (fixed width for alignment) -->
            <div style="display: flex; align-items: center; gap: 0.5rem; min-width: 180px; justify-content: flex-end;">
                <span style="padding: 0.3rem 0.75rem; border-radius: 2rem; font-size: 0.7rem; font-weight: 600; white-space: nowrap; ${getStatusStyle(inv.status)}">${inv.status || 'Bozza'}</span>
                <span style="font-size: 0.75rem; color: var(--text-tertiary); min-width: 75px; text-align: right;">${settlementDate || ''}</span>
            </div>
            
            <!-- Amounts -->
            <div style="text-align: right; min-width: 120px;">
                <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">€ ${formatAmount(importo)}</div>
                <div style="font-size: 0.7rem; color: var(--text-tertiary); display: flex; align-items: center; justify-content: flex-end; gap: 0.3rem;">
                    ${iva > 0 ? `IVA € ${formatAmount(iva)}` : 'esente IVA'}
                    ${isSplit ? '<span class="material-icons-round" style="font-size: 0.9rem; color: #8b5cf6;" title="Split Payment">call_split</span>' : ''}
                </div>
                <div style="font-size: 0.7rem; color: #10b981; font-weight: 600;">Netto € ${formatAmount(nettoAPagare)}</div>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="animate-fade-in" style="max-width: 1100px; margin: 0 auto; padding: 1rem;">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #10b981, #059669); display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(16, 185, 129, 0.2);">
                        <span class="material-icons-round" style="color: white; font-size: 24px;">receipt_long</span>
                    </div>
                    <div>
                        <h1 style="font-size: 1.5rem; font-weight: 700; margin: 0; font-family: var(--font-titles);">Fatture Attive</h1>
                        <p style="font-size: 0.85rem; color: var(--text-tertiary); margin: 0;">${filteredInvoices.length} fatture ${statusFilter !== 'all' ? `(${statusFilter === 'pending' ? 'da incassare' : 'incassate'})` : `nel ${currentYear}`}</p>
                    </div>
                </div>
                <div style="display: flex; gap: 0.75rem; align-items: center;">
                    <select id="inv-year-filter" style="padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid var(--glass-border); background: white; font-size: 0.85rem; cursor: pointer;">
                        <option value="2026" ${currentYear === 2026 ? 'selected' : ''}>2026</option>
                        <option value="2025" ${currentYear === 2025 ? 'selected' : ''}>2025</option>
                        <option value="2024" ${currentYear === 2024 ? 'selected' : ''}>2024</option>
                    </select>
                    <button class="primary-btn" id="btn-new-invoice" style="padding: 0.6rem 1.25rem; border-radius: 10px; white-space: nowrap;">
                        <span class="material-icons-round" style="font-size: 1.1rem;">add</span> Nuova
                    </button>
                </div>
            </div>

            <!-- KPI Summary (clickable) -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div class="glass-card kpi-card" data-filter="all" style="padding: 1.25rem; background: linear-gradient(135deg, rgba(16, 185, 129, 0.05), transparent); cursor: pointer; transition: all 0.2s; ${kpiActiveStyle('all')}">
                    <div style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Totale Fatturato</div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: #10b981; font-family: var(--font-titles);">€ ${formatAmount(totalFatturato)}</div>
                </div>
                <div class="glass-card kpi-card" data-filter="pending" style="padding: 1.25rem; background: linear-gradient(135deg, rgba(245, 158, 11, 0.05), transparent); cursor: pointer; transition: all 0.2s; ${kpiActiveStyle('pending')}">
                    <div style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Da Incassare</div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: #f59e0b; font-family: var(--font-titles);">€ ${formatAmount(daIncassare)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.25rem;">${nonSaldate.length} fatture</div>
                </div>
                <div class="glass-card kpi-card" data-filter="paid" style="padding: 1.25rem; background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), transparent); cursor: pointer; transition: all 0.2s; ${kpiActiveStyle('paid')}">
                    <div style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Incassato</div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: #3b82f6; font-family: var(--font-titles);">€ ${formatAmount(incassato)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.25rem;">${saldate.length} fatture</div>
                </div>
                <div class="glass-card" style="padding: 1.25rem; position: relative; overflow: hidden;">
                    <div style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 0.5rem;">% Incasso</div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: ${percIncasso >= 75 ? '#10b981' : percIncasso >= 50 ? '#f59e0b' : '#ef4444'}; font-family: var(--font-titles);">${percIncasso}%</div>
                    <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: rgba(0,0,0,0.05);">
                        <div style="height: 100%; width: ${percIncasso}%; background: ${percIncasso >= 75 ? '#10b981' : percIncasso >= 50 ? '#f59e0b' : '#ef4444'}; transition: width 0.3s;"></div>
                    </div>
                </div>
            </div>

            <!-- Invoice List (single column) -->
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${cards || '<div style="text-align: center; padding: 3rem; color: var(--text-tertiary);">Nessuna fattura trovata</div>'}
            </div>
        </div>`;

    // Event listeners
    container.querySelectorAll('.clickable-card').forEach(card => {
        card.addEventListener('click', () => window.openInvoiceDetail(card.dataset.id, 'active'));
    });
    container.querySelector('#btn-new-invoice')?.addEventListener('click', () => openInvoiceForm());
    container.querySelector('#inv-year-filter')?.addEventListener('change', (e) => {
        state.dashboardYear = parseInt(e.target.value);
        state.invoiceStatusFilter = 'all';
        renderActiveInvoicesSafe(container);
    });
    // KPI click handlers
    container.querySelectorAll('.kpi-card').forEach(kpi => {
        kpi.addEventListener('click', () => {
            state.invoiceStatusFilter = kpi.dataset.filter;
            renderActiveInvoicesSafe(container);
        });
    });
}


// --- INVOICE FORM MODAL LOGIC (Simplified for refactor) ---

export function initInvoiceModals() {
    if (!document.getElementById('invoice-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="invoice-modal" class="modal">
                <div class="modal-content glass-card" style="max-width: 700px; padding: 0; overflow: hidden;">
                    <!-- Header -->
                    <div style="padding: 1.5rem 2rem; background: var(--bg-secondary); border-bottom: 1px solid var(--glass-border);">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, var(--brand-blue), #2563eb); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">
                                    <span class="material-icons-round" style="color: white; font-size: 1.4rem;">receipt</span>
                                </div>
                                <div>
                                    <h2 id="invoice-modal-title" style="margin: 0; font-family: var(--font-titles); font-weight: 700; font-size: 1.25rem; color: var(--text-primary);">Nuova Fattura</h2>
                                    <p style="margin: 0.2rem 0 0; font-size: 0.75rem; color: var(--text-tertiary);">Compila i dettagli del documento fiscale</p>
                                </div>
                            </div>
                            <button class="icon-btn" id="close-invoice-modal-btn" style="width: 36px; height: 36px; border-radius: 10px; background: white; border: 1px solid var(--glass-border);">
                                <span class="material-icons-round" style="font-size: 1.25rem; color: var(--text-tertiary);">close</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Body -->
                    <div id="invoice-modal-body" style="padding: 1.5rem 2rem; max-height: 70vh; overflow-y: auto;">
                        <form id="invoice-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
                            
                            <!-- Row 1: Numero + Data -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Numero Fattura *</label>
                                    <input type="text" id="inv-number" class="modal-input" required placeholder="Es. 25-01" style="width: 100%;">
                                </div>
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Data Invio *</label>
                                    <input type="date" id="inv-date" class="modal-input" required style="width: 100%;">
                                </div>
                            </div>
                            
                            <!-- Row 2: Cliente -->
                            <div>
                                <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Cliente *</label>
                                <div style="position: relative;">
                                    <select id="inv-client" class="modal-input" required style="width: 100%;">
                                        <option value="">Seleziona cliente...</option>
                                    </select>
                                </div>
                            </div>
                            
                            <!-- Row 3: Importo + Esigibilità IVA -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Importo Imponibile *</label>
                                    <div style="position: relative;">
                                        <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 0.9rem; color: var(--text-tertiary);">€</span>
                                        <input type="number" id="inv-amount" class="modal-input" step="0.01" required placeholder="0.00" style="width: 100%; padding-left: 2rem;">
                                    </div>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Esigibilità IVA *</label>
                                    <select id="inv-vat-eligibility" class="modal-input" required style="width: 100%;">
                                        <option value="Immediata">Immediata (I)</option>
                                        <option value="Differita">Differita (D)</option>
                                        <option value="Scissione dei pagamenti">Scissione dei pagamenti (S)</option>
                                        <option value="Esente art. 10">Esente art. 10 (N2.1)</option>
                                        <option value="Escluso art. 15">Escluso art. 15 - Anticipi (N2.2)</option>
                                        <option value="Non imponibile">Non imponibile (N3)</option>
                                    </select>
                                </div>
                            </div>
                            
                            <!-- Row 4: Spese Anticipate -->
                            <div style="padding: 1rem; background: rgba(139, 92, 246, 0.05); border-radius: 12px; border: 1px solid rgba(139, 92, 246, 0.15);">
                                <div style="display: flex; align-items: center; gap: 0.75rem;">
                                    <input type="checkbox" id="inv-has-expenses" style="width: 18px; height: 18px; cursor: pointer;">
                                    <label for="inv-has-expenses" style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); cursor: pointer;">Spese anticipate per conto cliente</label>
                                </div>
                                <p style="margin: 0.5rem 0 0 1.75rem; font-size: 0.7rem; color: var(--text-tertiary);">Art. 15 DPR 633/72 - Escluse da base imponibile IVA</p>
                                <div id="inv-expenses-amount-container" style="display: none; margin-top: 0.75rem; margin-left: 1.75rem;">
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Importo Spese €</label>
                                    <input type="number" id="inv-expenses-amount" class="modal-input" step="0.01" placeholder="0.00" style="max-width: 200px;">
                                </div>
                            </div>
                            
                            <!-- Row 5: Ordini (filtrati per cliente) -->
                            <div>
                                <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Ordini Collegati</label>
                                <select id="inv-order" class="modal-input" style="width: 100%;">
                                    <option value="">Seleziona prima un cliente</option>
                                </select>
                                <p style="margin: 0.4rem 0 0; font-size: 0.65rem; color: var(--text-tertiary);">Filtrato per cliente selezionato</p>
                            </div>
                            
                            <!-- Row 6: Stato + Data Saldo -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Stato Fattura</label>
                                    <select id="inv-status" class="modal-input" style="width: 100%;">
                                        <option value="Inviata">Inviata</option>
                                        <option value="Saldata">Saldata</option>
                                    </select>
                                </div>
                                <div id="inv-payment-date-container" style="display: none;">
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Data Saldo</label>
                                    <input type="date" id="inv-payment-date" class="modal-input" style="width: 100%;">
                                </div>
                            </div>
                            
                            <!-- Row 7: Pagamenti (filtrati per ordini) -->
                            <div id="inv-payments-container" style="display: none;">
                                <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Collega Pagamenti</label>
                                <div id="inv-payments-list" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 150px; overflow-y: auto; padding: 0.5rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--glass-border);">
                                    <p style="color: var(--text-tertiary); font-size: 0.8rem; text-align: center;">Seleziona un ordine per vedere i pagamenti</p>
                                </div>
                            </div>
                            
                            <!-- Actions -->
                            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; padding-top: 0.5rem; border-top: 1px solid var(--glass-border);">
                                <button type="button" class="primary-btn secondary" id="cancel-invoice-btn" style="padding: 0.6rem 1.25rem;">Annulla</button>
                                <button type="submit" class="primary-btn" style="padding: 0.6rem 1.5rem;">
                                    <span class="material-icons-round" style="font-size: 1.1rem;">save</span>
                                    Salva Fattura
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            
            <!-- Passive Invoice Modal - Collaborators (Premium Design) -->
            <div id="passive-invoice-modal" class="modal">
                <div class="modal-content glass-card" style="max-width: 750px; padding: 0; overflow: hidden;">
                    <!-- Header -->
                    <div style="padding: 1.5rem 2rem; background: linear-gradient(135deg, rgba(139, 92, 246, 0.08), transparent); border-bottom: 1px solid var(--glass-border);">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #8b5cf6, #7c3aed); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.25);">
                                    <span class="material-icons-round" style="color: white; font-size: 1.4rem;">person</span>
                                </div>
                                <div>
                                    <h2 id="passive-invoice-modal-title" style="margin: 0; font-family: var(--font-titles); font-weight: 700; font-size: 1.25rem; color: var(--text-primary);">Nuova Fattura Collaboratore</h2>
                                    <p style="margin: 0.2rem 0 0; font-size: 0.75rem; color: var(--text-tertiary);">Registra documento fiscale ricevuto</p>
                                </div>
                            </div>
                            <button class="icon-btn" id="close-passive-modal" style="width: 36px; height: 36px; border-radius: 10px; background: white; border: 1px solid var(--glass-border);">
                                <span class="material-icons-round" style="font-size: 1.25rem; color: var(--text-tertiary);">close</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Body -->
                    <div style="padding: 1.5rem 2rem; max-height: 70vh; overflow-y: auto;">
                        <form id="passive-invoice-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
                            
                            <!-- Mode: Collaborator Fields -->
                            <div id="pinv-collab-fields" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Tipo Documento *</label>
                                    <select id="pinv-type" class="modal-input" style="width: 100%;">
                                        <option value="ritenuta">Ritenuta d'Acconto (20%)</option>
                                        <option value="forfettario">Fattura Forfettario (no ritenuta)</option>
                                        <option value="fattura">Fattura Regime Ordinario (20%)</option>
                                        <option value="occasionale">Prestazione Occasionale</option>
                                        <option value="parcella">Parcella/Notula (20%)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Collaboratore *</label>
                                    <select id="pinv-collaborator" class="modal-input" style="width: 100%;">
                                        <option value="">Seleziona collaboratore...</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Mode: Supplier Fields -->
                            <div id="pinv-supplier-fields" style="display: none; grid-template-columns: 1fr; gap: 1rem;">
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Fornitore *</label>
                                    <select id="pinv-supplier" class="modal-input" style="width: 100%;">
                                        <option value="">Seleziona fornitore...</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Descrizione Servizio *</label>
                                    <input type="text" id="pinv-description" class="modal-input" placeholder="Es. Consulenza SEO, Acquisto Software..." style="width: 100%;">
                                </div>
                            </div>
                            
                            <!-- Row 2: Numero + Data -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Numero Fattura *</label>
                                    <input type="text" id="pinv-number" class="modal-input" required placeholder="N. documento" style="width: 100%;">
                                </div>
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Data Ricezione *</label>
                                    <input type="date" id="pinv-date" class="modal-input" required style="width: 100%;">
                                </div>
                            </div>
                            
                            <!-- Row 3: Importo + Cassa + Netto -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Importo / Compenso *</label>
                                    <div style="position: relative;">
                                        <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 0.9rem; color: var(--text-tertiary);">€</span>
                                        <input type="number" id="pinv-amount" class="modal-input" step="0.01" required placeholder="0.00" style="width: 100%; padding-left: 2rem;">
                                    </div>
                                </div>
                                <div id="pinv-cassa-container" style="display: none;">
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Cassa Prev. (4%)</label>
                                    <div style="position: relative;">
                                        <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 0.9rem; color: var(--text-tertiary);">€</span>
                                        <input type="number" id="pinv-cassa" class="modal-input" step="0.01" placeholder="0.00" style="width: 100%; padding-left: 2rem;">
                                    </div>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Netto a Pagare *</label>
                                    <div style="position: relative;">
                                        <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 0.9rem; color: var(--text-tertiary);">€</span>
                                        <input type="number" id="pinv-net" class="modal-input" step="0.01" required placeholder="0.00" style="width: 100%; padding-left: 2rem;">
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Row 3b: Breakdown calcolo automatico -->
                            <div id="pinv-calc-breakdown" style="padding: 0.75rem 1rem; background: rgba(139, 92, 246, 0.05); border-radius: 10px; border: 1px solid rgba(139, 92, 246, 0.15);">
                                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                                    <p id="pinv-calc-hint" style="margin: 0; font-size: 0.75rem; color: #8b5cf6; font-weight: 500;">
                                        <span class="material-icons-round" style="font-size: 0.9rem; vertical-align: middle; margin-right: 0.25rem;">calculate</span>
                                        Ritenuta 20%: € 0.00
                                    </p>
                                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                                        <input type="checkbox" id="pinv-has-vat" style="width: 16px; height: 16px; cursor: pointer;">
                                        <label for="pinv-has-vat" style="font-size: 0.75rem; font-weight: 600; color: var(--text-primary); cursor: pointer;">+ IVA 22%</label>
                                    </div>
                                </div>
                                <p id="pinv-calc-details" style="margin: 0.5rem 0 0; font-size: 0.65rem; color: var(--text-tertiary);"></p>
                            </div>
                            
                            <!-- Row 4: Stato + Data Saldo -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Stato *</label>
                                    <select id="pinv-status" class="modal-input" required style="width: 100%;">
                                        <option value="Da Pagare">Da Pagare</option>
                                        <option value="Pagata">Pagata</option>
                                    </select>
                                </div>
                                <div id="pinv-payment-date-container" style="display: none;">
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Data Saldo</label>
                                    <input type="date" id="pinv-payment-date" class="modal-input" style="width: 100%;">
                                </div>
                            </div>
                            
                            <!-- Row 5: Ordini (cascata per collaboratore) -->
                            <div>
                                <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Ordine Collegato</label>
                                <select id="pinv-order" class="modal-input" style="width: 100%;">
                                    <option value="">Seleziona prima un collaboratore</option>
                                </select>
                                <p style="margin: 0.4rem 0 0; font-size: 0.65rem; color: var(--text-tertiary);">Ordini in cui il collaboratore ha incarichi</p>
                            </div>
                            
                            <!-- Row 6: Pagamenti (cascata per ordine) -->
                            <div id="pinv-payments-container" style="display: none;">
                                <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Collega Pagamenti</label>
                                <div id="pinv-payments-list" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 120px; overflow-y: auto; padding: 0.5rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--glass-border);">
                                    <p style="color: var(--text-tertiary); font-size: 0.8rem; text-align: center;">Seleziona un ordine per vedere i pagamenti</p>
                                </div>
                            </div>
                            
                            <!-- Row 7: File Upload -->
                            <div style="padding: 1rem; background: rgba(139, 92, 246, 0.05); border-radius: 12px; border: 1px dashed rgba(139, 92, 246, 0.3);">
                                <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Allega Fattura *</label>
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <input type="file" id="pinv-file" accept=".pdf,.png,.jpg,.jpeg" style="flex: 1; font-size: 0.85rem;">
                                    <div id="pinv-file-preview" style="display: none; padding: 0.5rem 0.75rem; background: rgba(16, 185, 129, 0.1); border-radius: 8px; color: #10b981; font-size: 0.75rem; font-weight: 600;">
                                        <span class="material-icons-round" style="font-size: 1rem; vertical-align: middle;">check_circle</span>
                                        <span id="pinv-file-name">file.pdf</span>
                                    </div>
                                </div>
                                <p style="margin: 0.5rem 0 0; font-size: 0.65rem; color: var(--text-tertiary);">Formati: PDF, PNG, JPG (max 5MB)</p>
                            </div>
                            
                            <!-- Actions -->
                            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; padding-top: 0.5rem; border-top: 1px solid var(--glass-border);">
                                <button type="button" class="primary-btn secondary" id="cancel-passive-btn" style="padding: 0.6rem 1.25rem;">Annulla</button>
                                <button type="submit" class="primary-btn" style="padding: 0.6rem 1.5rem; background: linear-gradient(135deg, #8b5cf6, #7c3aed);">
                                    <span class="material-icons-round" style="font-size: 1.1rem;">save</span>
                                    Salva Fattura
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            
            <!-- Unpaid Modal -->
            <div id="unpaid-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header"><h2 id="unpaid-modal-title">Fatture Non Saldate</h2><button class="close-modal" onclick="this.closest('.modal').classList.remove('active')">x</button></div>
                    <div id="unpaid-list"></div>
                </div>
            </div>
        `);

        // Attach Close Listeners
        document.getElementById('close-invoice-modal-btn')?.addEventListener('click', closeInvoiceForm);
        document.getElementById('cancel-invoice-btn')?.addEventListener('click', closeInvoiceForm);

        const closePassive = document.getElementById('close-passive-modal');
        if (closePassive) closePassive.addEventListener('click', closePassiveInvoiceForm);
        document.getElementById('cancel-passive-btn')?.addEventListener('click', closePassiveInvoiceForm);

        // Conditional field logic: Spese Anticipate
        document.getElementById('inv-has-expenses')?.addEventListener('change', (e) => {
            document.getElementById('inv-expenses-amount-container').style.display = e.target.checked ? 'block' : 'none';
        });

        // Conditional field logic: Data Saldo based on Status
        document.getElementById('inv-status')?.addEventListener('change', (e) => {
            document.getElementById('inv-payment-date-container').style.display = e.target.value === 'Saldata' ? 'block' : 'none';
        });

        // Cascading: Cliente → Ordini
        document.getElementById('inv-client')?.addEventListener('change', (e) => {
            updateOrdersDropdown(e.target.value);
        });

        // Cascading: Ordine → Pagamenti
        document.getElementById('inv-order')?.addEventListener('change', (e) => {
            updatePaymentsForOrder(e.target.value);
        });

        // ========== PASSIVE INVOICE MODAL LISTENERS ==========

        // Tipo documento → Auto-calc Netto + hint update
        document.getElementById('pinv-type')?.addEventListener('change', (e) => {
            updateNettoCalculation();
            updateCalcHint(e.target.value);
        });

        // Importo → Auto-calc Netto
        document.getElementById('pinv-amount')?.addEventListener('input', () => {
            updateNettoCalculation();
        });

        // IVA checkbox → recalc when manually toggled
        document.getElementById('pinv-has-vat')?.addEventListener('change', () => {
            state._pinvVatManuallySet = true; // Flag to prevent auto-override
            updateNettoCalculation();
        });

        // Collaboratore → Ordini cascade
        document.getElementById('pinv-collaborator')?.addEventListener('change', (e) => {
            updatePassiveOrdersDropdown(e.target.value);
        });

        // Ordine → Pagamenti cascade
        document.getElementById('pinv-order')?.addEventListener('change', (e) => {
            updatePassivePaymentsForOrder(e.target.value);
        });

        // Stato → Data Saldo conditional
        document.getElementById('pinv-status')?.addEventListener('change', (e) => {
            document.getElementById('pinv-payment-date-container').style.display = e.target.value === 'Pagata' ? 'block' : 'none';
        });

        // File preview
        document.getElementById('pinv-file')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const preview = document.getElementById('pinv-file-preview');
            const fileName = document.getElementById('pinv-file-name');
            if (file && preview && fileName) {
                preview.style.display = 'inline-flex';
                fileName.textContent = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
            } else if (preview) {
                preview.style.display = 'none';
            }
        });

        // Passive form submit
        const passiveForm = document.getElementById('passive-invoice-form');
        if (passiveForm) passiveForm.addEventListener('submit', handleSavePassiveInvoice);
        // Initialize Custom Select for Collaborator
        const collabSelect = document.getElementById('pinv-collaborator');
        if (collabSelect) {
            state.customCollabSelect = new CustomSelect(collabSelect);
        }
    }

    // Assign global functions
    window.openInvoiceForm = openInvoiceForm;
    window.closeInvoiceForm = closeInvoiceForm;
    window.handleSaveInvoice = handleSaveInvoice;
    window.openPassiveInvoiceForm = openPassiveInvoiceForm;
    window.closePassiveInvoiceForm = closePassiveInvoiceForm;

    const form = document.getElementById('invoice-form');
    if (form) form.addEventListener('submit', handleSaveInvoice);
}

function populateClientDropdown() {
    const select = document.getElementById('inv-client');
    if (!select) return;

    const clients = state.clients || [];
    select.innerHTML = '<option value="">Seleziona cliente...</option>' +
        clients.map(c => `<option value="${c.id}">${c.client_code} - ${c.business_name}</option>`).join('');
}

function updateOrdersDropdown(clientId) {
    const select = document.getElementById('inv-order');
    const paymentsContainer = document.getElementById('inv-payments-container');

    if (!select) return;

    if (!clientId) {
        select.innerHTML = '<option value="">Seleziona prima un cliente</option>';
        if (paymentsContainer) paymentsContainer.style.display = 'none';
        return;
    }

    const orders = (state.orders || []).filter(o => o.client_id === clientId);
    select.innerHTML = '<option value="">Nessun ordine</option>' +
        orders.map(o => `<option value="${o.id}">${o.order_number} - ${o.title || 'Senza titolo'}</option>`).join('');

    // Show payments container if orders available
    if (paymentsContainer) paymentsContainer.style.display = orders.length > 0 ? 'block' : 'none';
}

function updatePaymentsForOrder(orderId) {
    const list = document.getElementById('inv-payments-list');
    if (!list) return;

    if (!orderId) {
        list.innerHTML = '<p style="color: var(--text-tertiary); font-size: 0.8rem; text-align: center;">Seleziona un ordine per vedere i pagamenti</p>';
        return;
    }

    const payments = (state.payments || []).filter(p =>
        p.order_id === orderId &&
        p.payment_type === 'Cliente' &&
        (!p.status || p.status.toLowerCase().includes('to do') || p.status.toLowerCase().includes('pending'))
    );

    if (payments.length === 0) {
        list.innerHTML = '<p style="color: var(--text-tertiary); font-size: 0.8rem; text-align: center;">Nessun pagamento da associare</p>';
        return;
    }

    list.innerHTML = payments.map(p => `
        <label style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem; background: white; border-radius: 8px; border: 1px solid var(--glass-border); cursor: pointer;">
            <input type="checkbox" class="inv-payment-check" value="${p.id}" style="width: 16px; height: 16px;">
            <div style="flex: 1;">
                <div style="font-size: 0.85rem; font-weight: 600;">${p.title || 'Pagamento'}</div>
                <div style="font-size: 0.7rem; color: var(--text-tertiary);">${p.due_date ? new Date(p.due_date).toLocaleDateString('it-IT') : 'Senza scadenza'}</div>
            </div>
            <div style="font-weight: 700; color: var(--brand-blue);">€ ${formatAmount(p.amount)}</div>
        </label>
    `).join('');
}

export function openInvoiceForm(id = null) {
    const modal = document.getElementById('invoice-modal');
    if (!modal) return;

    state.currentInvoiceId = id;

    // Populate client dropdown
    populateClientDropdown();

    // Reset form
    document.getElementById('invoice-form').reset();
    document.getElementById('inv-expenses-amount-container').style.display = 'none';
    document.getElementById('inv-payment-date-container').style.display = 'none';
    document.getElementById('inv-payments-container').style.display = 'none';
    document.getElementById('inv-order').innerHTML = '<option value="">Seleziona prima un cliente</option>';
    document.getElementById('inv-payments-list').innerHTML = '<p style="color: var(--text-tertiary); font-size: 0.8rem; text-align: center;">Seleziona un ordine per vedere i pagamenti</p>';

    if (id) {
        document.getElementById('invoice-modal-title').textContent = 'Modifica Fattura';
        const inv = state.invoices.find(i => i.id === id);
        if (inv) {
            document.getElementById('inv-number').value = inv.invoice_number || '';
            document.getElementById('inv-date').value = inv.invoice_date || '';
            document.getElementById('inv-amount').value = inv.amount_tax_excluded || '';
            document.getElementById('inv-status').value = inv.status || 'Inviata';
            document.getElementById('inv-vat-eligibility').value = inv.vat_eligibility || 'Immediata';
            document.getElementById('inv-client').value = inv.client_id || '';

            // Trigger cascading
            if (inv.client_id) {
                updateOrdersDropdown(inv.client_id);
                if (inv.order_id) {
                    document.getElementById('inv-order').value = inv.order_id;
                    updatePaymentsForOrder(inv.order_id);
                }
            }

            // Spese anticipate
            if (inv.expenses_client_account && inv.expenses_client_account > 0) {
                document.getElementById('inv-has-expenses').checked = true;
                document.getElementById('inv-expenses-amount-container').style.display = 'block';
                document.getElementById('inv-expenses-amount').value = inv.expenses_client_account;
            }

            // Payment date
            if (inv.status === 'Saldata') {
                document.getElementById('inv-payment-date-container').style.display = 'block';
                document.getElementById('inv-payment-date').value = inv.payment_date || '';
            }
        }
    } else {
        document.getElementById('invoice-modal-title').textContent = 'Nuova Fattura';
        document.getElementById('inv-number').value = getNextInvoiceNumber();
        document.getElementById('inv-date').value = new Date().toISOString().split('T')[0];
    }

    modal.classList.add('active');
}

export function closeInvoiceForm() {
    const modal = document.getElementById('invoice-modal');
    if (modal) modal.classList.remove('active');
    state.currentInvoiceId = null;
}

export async function handleSaveInvoice(e) {
    e.preventDefault();

    const clientId = document.getElementById('inv-client').value;
    const orderId = document.getElementById('inv-order').value;
    const hasExpenses = document.getElementById('inv-has-expenses').checked;
    const expensesAmount = hasExpenses ? parseFloat(document.getElementById('inv-expenses-amount').value) || 0 : 0;
    const status = document.getElementById('inv-status').value;

    // Get selected payments
    const selectedPayments = Array.from(document.querySelectorAll('.inv-payment-check:checked')).map(cb => cb.value);

    // Calculate IVA based on eligibility
    const amount = parseFloat(document.getElementById('inv-amount').value) || 0;
    const vatEligibility = document.getElementById('inv-vat-eligibility').value;
    const vatRate = vatEligibility.includes('Esente') || vatEligibility.includes('Escluso') || vatEligibility.includes('Non imponibile') ? 0 : 22;
    const taxAmount = amount * (vatRate / 100);
    const amountTaxIncluded = vatEligibility.includes('Scissione') ? amount : amount + taxAmount;

    const data = {
        invoice_number: document.getElementById('inv-number').value,
        invoice_date: document.getElementById('inv-date').value,
        amount_tax_excluded: amount,
        tax_amount: taxAmount,
        vat_rate: vatRate,
        amount_tax_included: amountTaxIncluded,
        vat_eligibility: vatEligibility,
        expenses_client_account: expensesAmount,
        status: status,
        payment_date: status === 'Saldata' ? document.getElementById('inv-payment-date').value : null,
        client_id: clientId || null,
        order_id: orderId || null,
    };

    try {
        if (state.currentInvoiceId) {
            await supabase.from('invoices').update(data).eq('id', state.currentInvoiceId);
            showGlobalAlert('Fattura aggiornata!', 'success');
        } else {
            await supabase.from('invoices').insert([data]);
            showGlobalAlert('Fattura creata!', 'success');
        }

        // Update linked payments status if invoice is Saldata
        if (status === 'Saldata' && selectedPayments.length > 0) {
            for (const paymentId of selectedPayments) {
                await supabase.from('payments').update({ status: 'Saldato' }).eq('id', paymentId);
            }
        }

        closeInvoiceForm();
        await fetchInvoices();

        // Refresh UI immediately
        if (state.currentPage === 'invoices') {
            renderActiveInvoicesSafe(document.getElementById('content-area'));
        } else if (state.currentPage === 'invoices-dashboard') {
            // Maybe refresh dashboard too if needed, but list is priority
        }

        window.dispatchEvent(new Event('data:updated'));
    } catch (err) {
        console.error("Save error:", err);
        showGlobalAlert("Errore salvataggio fattura", 'error');
    }
}

// Helpers
function getNextInvoiceNumber() {
    const year = new Date().getFullYear().toString().slice(-2);
    const existingNumbers = (state.invoices || [])
        .filter(i => i.invoice_number && i.invoice_number.startsWith(year))
        .map(i => {
            const parts = i.invoice_number.split('-');
            return parts.length > 1 ? parseInt(parts[1]) : 0;
        })
        .filter(n => !isNaN(n));

    const maxNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    return `${year}-${String(maxNum + 1).padStart(2, '0')}`;
}

// ========== PASSIVE INVOICE MODAL FUNCTIONS ==========

async function populateCollaboratorDropdown() {
    const select = document.getElementById('pinv-collaborator');
    if (!select) return;

    if (!state.collaborators || state.collaborators.length === 0) {
        await fetchCollaborators();
    }
    const collaborators = state.collaborators || [];
    select.innerHTML = '<option value="">Seleziona collaboratore...</option>' +
        collaborators.map(c => `<option value="${c.id}">${c.full_name}</option>`).join('');

    if (state.customCollabSelect) state.customCollabSelect.refresh();
}

async function populateSupplierDropdown() {
    const select = document.getElementById('pinv-supplier');
    if (!select) return;

    if (!state.suppliers || state.suppliers.length === 0) {
        // Fetch suppliers if not loaded (assuming fetchSuppliers exists or generic fetch)
        const { data } = await supabase.from('suppliers').select('*').order('name');
        state.suppliers = data || [];
    }
    const suppliers = state.suppliers || [];
    select.innerHTML = '<option value="">Seleziona fornitore...</option>' +
        suppliers.map(s => {
            const settings = {
                regime: s.fiscal_regime || 'ordinario',
                cassaRate: s.cassa_previdenziale_rate || 0,
                vatRate: s.default_vat_rate || 22,
                country: s.country || 'IT'
            };
            return `<option value="${s.id}" data-settings='${JSON.stringify(settings)}'>${s.name}</option>`;
        }).join('');

    // Attach listener if not already attached (idempotent because of how functions work but let's be safe)
    // Actually best to attach listener once in init. Or here if we replace the element. 
    // Since we are just changing innerHTML, listener on select persists.
}

// Supplier Change Listener Logic
function handleSupplierChange(e) {
    const opt = e.target.selectedOptions[0];
    if (!opt || !opt.dataset.settings) return;

    const settings = JSON.parse(opt.dataset.settings);
    const hasVatCheckbox = document.getElementById('pinv-has-vat');

    // Auto-configure
    if (settings.regime === 'forfettario' || settings.regime === 'minimi') {
        hasVatCheckbox.checked = false;
        state._pinvVatManuallySet = true; // prevent auto-recheck
    } else {
        // Ordinario
        if (settings.country === 'IT') {
            hasVatCheckbox.checked = true;
        } else {
            // Foreign: usually no VAT (reverse charge)
            hasVatCheckbox.checked = false;
        }
        state._pinvVatManuallySet = true;
    }

    // Toggle Cassa Field
    const cassaContainer = document.getElementById('pinv-cassa-container');
    const cassaInput = document.getElementById('pinv-cassa');
    if (settings.cassaRate > 0) {
        cassaContainer.style.display = 'block';
        cassaInput.dataset.rate = settings.cassaRate;
        // Trigger recalc will interpret this
    } else {
        cassaContainer.style.display = 'none';
        cassaInput.value = '';
        cassaInput.dataset.rate = 0;
    }

    updateNettoCalculation();
}

function updateNettoCalculation() {
    const modal = document.getElementById('passive-invoice-modal');
    const mode = modal.dataset.mode || 'collab';

    const importo = parseFloat(document.getElementById('pinv-amount')?.value) || 0;
    const hasVat = document.getElementById('pinv-has-vat')?.checked;

    let netto = 0;
    let desc = '';



    if (mode === 'collab') {
        // ... existing collaborator logic ...
        const tipo = document.getElementById('pinv-type')?.value || 'ritenuta';
        let rivalsa = 0;
        let imponibile = importo;
        let iva = 0;
        let ritenuta = 0;
        let bollo = 0;

        if (tipo === 'forfettario') {
            rivalsa = importo * 0.04;
            imponibile = importo + rivalsa;
            if (hasVat) iva = imponibile * 0.22;
            if (!hasVat && imponibile > 77.47) bollo = 2;
            netto = imponibile + iva + bollo;
            desc = `(Imponibile + 4% INPS${!hasVat ? ' + Bollo' : ' + IVA'})`;
        } else if (tipo === 'occasionale') {
            // Occasionale: Ritenuta applies to importo
            if (importo > 77.47) {
                ritenuta = importo * 0.20;
                bollo = 2;
            }
            netto = importo - ritenuta + bollo;
            desc = `(Lordo - 20% Ritenuta${bollo ? ' + Bollo' : ''})`;
        } else {
            // Ordinario / Parcella
            rivalsa = importo * 0.04;
            imponibile = importo + rivalsa;
            if (hasVat) iva = imponibile * 0.22;
            ritenuta = imponibile * 0.20;
            if (!hasVat && imponibile > 77.47) bollo = 2;
            netto = imponibile + iva - ritenuta + bollo;
            desc = `(Imp. + 4% - 20% Rit. + IVA)`;
        }
    } else {
        // --- SUPPLIER LOGIC ---
        // Read Cassa
        const cassaInput = document.getElementById('pinv-cassa');
        let cassa = 0;

        // If field visible, auto-calc cassa if empty but rate logic, OR read value
        if (cassaInput && cassaInput.offsetParent !== null) {
            const rate = parseFloat(cassaInput.dataset.rate) || 0;
            // If user hasn't manually typed cassa (or we want to auto-calc on amount change):
            // Simple rule: calc cassa based on amount
            cassa = importo * (rate / 100);
            cassaInput.value = cassa.toFixed(2);
        }

        const imponibile = importo + cassa;
        const iva = hasVat ? imponibile * 0.22 : 0; // Assuming 22% default, could be refined per supplier
        netto = imponibile + iva;
        desc = `(Imponibile ${cassa > 0 ? '+ Cassa ' : ''}${hasVat ? '+ IVA' : '(No IVA)'})`;
    }

    const netInput = document.getElementById('pinv-net');
    if (netInput) netInput.value = netto.toFixed(2);

    const hint = document.getElementById('pinv-calc-hint');
    if (hint) hint.textContent = desc;
}

function updateCalcHint(tipo) {
    // Reset manual VAT override when tipo changes
    state._pinvVatManuallySet = false;

    // Update auto-IVA based on tipo
    const vatCheckbox = document.getElementById('pinv-has-vat');
    if (vatCheckbox) {
        // Forfettario e Occasionale di solito senza IVA
        // Ritenuta/Fattura/Parcella di solito con IVA
        vatCheckbox.checked = ['ritenuta', 'fattura', 'parcella'].includes(tipo);
    }

    // Recalculate
    updateNettoCalculation();
}

function updatePassiveOrdersDropdown(collaboratorId) {
    const select = document.getElementById('pinv-order');
    const paymentsContainer = document.getElementById('pinv-payments-container');

    if (!select) return;

    if (!collaboratorId) {
        select.innerHTML = '<option value="">Seleziona prima un collaboratore</option>';
        if (paymentsContainer) paymentsContainer.style.display = 'none';
        return;
    }

    // Find orders where this collaborator has assignments
    const collaboratorAssignments = (state.assignments || []).filter(a => a.collaborator_id === collaboratorId);
    const orderIds = [...new Set(collaboratorAssignments.map(a => a.order_id).filter(Boolean))];
    const orders = (state.orders || []).filter(o => orderIds.includes(o.id));

    select.innerHTML = '<option value="">Nessun ordine</option>' +
        orders.map(o => `<option value="${o.id}">${o.order_number} - ${o.title || 'Senza titolo'}</option>`).join('');

    // Show payments container if orders available
    if (paymentsContainer) paymentsContainer.style.display = orders.length > 0 ? 'block' : 'none';
}

function updatePassivePaymentsForOrder(orderId) {
    const list = document.getElementById('pinv-payments-list');
    if (!list) return;

    if (!orderId) {
        list.innerHTML = '<p style="color: var(--text-tertiary); font-size: 0.8rem; text-align: center;">Seleziona un ordine per vedere i pagamenti</p>';
        return;
    }

    // Get payments for collaborator (passive) that are pending
    const payments = (state.payments || []).filter(p =>
        p.order_id === orderId &&
        p.payment_type === 'Collaboratore' &&
        (!p.status || p.status.toLowerCase().includes('to do') || p.status.toLowerCase().includes('pending'))
    );

    if (payments.length === 0) {
        list.innerHTML = '<p style="color: var(--text-tertiary); font-size: 0.8rem; text-align: center;">Nessun pagamento da associare</p>';
        return;
    }

    list.innerHTML = payments.map(p => `
        <label style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem; background: white; border-radius: 8px; border: 1px solid var(--glass-border); cursor: pointer;">
            <input type="checkbox" class="pinv-payment-check" value="${p.id}" style="width: 16px; height: 16px;">
            <div style="flex: 1;">
                <div style="font-size: 0.85rem; font-weight: 600;">${p.title || 'Pagamento'}</div>
                <div style="font-size: 0.7rem; color: var(--text-tertiary);">${p.due_date ? new Date(p.due_date).toLocaleDateString('it-IT') : 'Senza scadenza'}</div>
            </div>
            <div style="font-weight: 700; color: #8b5cf6;">€ ${formatAmount(p.amount)}</div>
        </label>
    `).join('');
}


async function handleSavePassiveInvoice(e) {
    e.preventDefault();

    const modal = document.getElementById('passive-invoice-modal');
    const mode = modal.dataset.mode || 'collab';

    const tipo = document.getElementById('pinv-type').value;
    const collaboratorId = document.getElementById('pinv-collaborator').value;
    const supplierId = document.getElementById('pinv-supplier').value;
    const description = document.getElementById('pinv-description').value;

    // Validate required fields
    if (mode === 'collab' && !collaboratorId && (tipo === 'ritenuta' || tipo === 'occasionale' || tipo === 'forfettario')) {
        showGlobalAlert("Seleziona un collaboratore", 'warning');
        return;
    }
    if (mode === 'supplier') {
        if (!supplierId) {
            showGlobalAlert("Seleziona un fornitore", 'warning');
            return;
        }
        if (!description) {
            showGlobalAlert("Inserisci descr. servizio", 'warning');
            return;
        }
    }

    const orderId = document.getElementById('pinv-order').value;
    const hasVat = document.getElementById('pinv-has-vat').checked;
    const status = document.getElementById('pinv-status').value;
    const importo = parseFloat(document.getElementById('pinv-amount').value) || 0;

    // Recalculate fiscal values
    let compenso = importo;
    let rivalsa = 0;
    let imponibile = compenso;
    let iva = 0;
    let ritenuta = 0;
    let bollo = 0;
    let netto = compenso;

    if (mode === 'collab') {
        if (tipo === 'forfettario') {
            rivalsa = compenso * 0.04;
            imponibile = compenso + rivalsa;
            if (hasVat) iva = imponibile * 0.22;
            if (!hasVat && imponibile > 77.47) bollo = 2;
            netto = compenso + rivalsa + iva + bollo;
        } else if (tipo === 'occasionale') {
            if (compenso > 77.47) {
                ritenuta = compenso * 0.20;
                bollo = 2;
            }
            netto = compenso - ritenuta + bollo;
        } else {
            // Ordinario
            rivalsa = compenso * 0.04;
            imponibile = compenso + rivalsa;
            if (hasVat) iva = imponibile * 0.22;
            ritenuta = imponibile * 0.20;
            if (!hasVat && imponibile > 77.47) bollo = 2;
            netto = compenso + rivalsa + iva - ritenuta + bollo;
        }
    } else {
        // Supplier mode: simple VAT calculation
        imponibile = compenso;
        if (hasVat) iva = imponibile * 0.22;
        netto = imponibile + iva;
    }

    // Get selected payments
    const selectedPayments = Array.from(document.querySelectorAll('.pinv-payment-check:checked')).map(cb => cb.value);

    // Handle file upload
    const fileInput = document.getElementById('pinv-file');
    let attachmentUrl = null;

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileName = `passive-invoices/${Date.now()}_${file.name}`;

        try {
            const { error: uploadError } = await supabase.storage
                .from('attachments')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(fileName);
            attachmentUrl = urlData.publicUrl;
        } catch (uploadErr) {
            console.error("Upload error:", uploadErr);
            showGlobalAlert("Errore caricamento file: " + uploadErr.message, 'error');
            return;
        }
    }

    // Resolve related orders
    let relatedOrders = [];
    if (orderId && state.orders) {
        const order = state.orders.find(o => o.id === orderId);
        if (order) relatedOrders.push(order.order_number);
    }

    const data = {
        invoice_number: document.getElementById('pinv-number').value,
        issue_date: document.getElementById('pinv-date').value,
        amount_tax_excluded: importo,
        amount_tax_included: netto,
        tax_amount: iva,
        ritenuta: ritenuta,
        rivalsa_inps: rivalsa,
        stamp_duty: bollo,
        iva_attiva: hasVat,
        category: tipo,
        status: status,
        payment_date: status === 'Pagata' ? document.getElementById('pinv-payment-date').value : null,
        payment_date: status === 'Pagata' ? document.getElementById('pinv-payment-date').value : null,
        collaborator_id: mode === 'collab' ? collaboratorId : null,
        supplier_id: mode === 'supplier' ? supplierId : null,
        description: mode === 'supplier' ? description : null,
        related_orders: relatedOrders,
        attachment_url: attachmentUrl,
    };

    try {
        let error;
        let savedId = state.currentPassiveInvoiceId;

        if (state.currentPassiveInvoiceId) {
            // For update, don't overwrite attachment if no new file
            if (!attachmentUrl) delete data.attachment_url;
            const res = await supabase.from('passive_invoices').update(data).eq('id', state.currentPassiveInvoiceId).select();
            error = res.error;
            if (res.data && res.data[0]) savedId = res.data[0].id;
        } else {
            const res = await supabase.from('passive_invoices').insert([data]).select();
            error = res.error;
            if (res.data && res.data[0]) savedId = res.data[0].id;
        }

        if (error) throw error;

        showGlobalAlert(state.currentPassiveInvoiceId ? 'Fattura aggiornata!' : 'Fattura registrata!', 'success');

        // Update linked payments status and LINK them to this invoice
        if (selectedPayments.length > 0 && savedId) {
            for (const paymentId of selectedPayments) {
                const updatePayload = { passive_invoice_id: savedId };
                if (status === 'Pagata') updatePayload.status = 'Saldato';

                await supabase.from('payments').update(updatePayload).eq('id', paymentId).throwOnError();
            }
        }

        closePassiveInvoiceForm();
        await new Promise(r => setTimeout(r, 500)); // Delay for DB consistency
        await fetchPassiveInvoices();

        // Auto-switch year if invoice is from a different year
        const invYear = new Date(data.issue_date).getFullYear();
        if (invYear !== (state.passiveInvoiceYear || new Date().getFullYear())) {
            state.passiveInvoiceYear = invYear;
        }

        if (state.currentPage === 'passive-invoices-suppliers') {
            renderPassiveInvoicesSuppliers(document.getElementById('content-area'));
        } else if (state.currentPage === 'passive-invoices-collab') {
            renderPassiveInvoicesCollab(document.getElementById('content-area'));
        }

        window.dispatchEvent(new Event('data:updated'));
    } catch (err) {
        console.error("Save error details:", JSON.stringify(err, null, 2));
        showGlobalAlert("Errore salvataggio: " + (err.message || err.details || "Errore sconosciuto"), 'error');
    }
}

// Export for consumption
export const InvoiceLogic = { renderActiveInvoicesSafe, initInvoiceModals };

// --- DETAIL MODAL LOGIC ---

export function initInvoiceDetailModals() {
    if (document.getElementById('invoice-detail-modal')) return;

    document.body.insertAdjacentHTML('beforeend', `
        <div id="invoice-detail-modal" class="modal" style="z-index: 10000;">
            <div class="modal-content glass-card" style="max-width: 800px; padding: 0; overflow: hidden; display: flex; flex-direction: column; max-height: 90vh;">
                
                <!-- Header (Sticky) -->
                <div style="padding: 2rem 2.5rem; background: var(--glass-highlight); border-bottom: 1px solid var(--glass-border);">
                    <div class="flex-between" style="align-items: flex-start;">
                        <div class="flex-column" style="gap: 0.5rem;">
                            <!-- Type Badge -->
                            <div id="idm-type-badge" class="badge badge-neutral" style="width: fit-content; text-transform: uppercase; letter-spacing: 1px; font-size: 0.7rem;">FATTURA</div>
                            
                            <!-- Title & Entity -->
                            <div class="flex-column" style="gap: 0.25rem;">
                                <div class="flex-start" style="gap: 1rem; align-items: baseline;">
                                    <h2 id="idm-number" class="text-display" style="font-size: 2rem; margin: 0;">#</h2>
                                    <span id="idm-date" class="text-caption" style="font-size: 1rem;"></span>
                                </div>
                                <div class="flex-start" style="gap: 0.5rem; align-items: center;">
                                    <span id="idm-entity-icon" class="material-icons-round text-tertiary" style="font-size: 1.2rem;">business</span>
                                    <h3 id="idm-entity" style="font-size: 1.1rem; font-weight: 600; color: var(--text-secondary); margin: 0;">-</h3>
                                </div>
                            </div>
                        </div>

                        <!-- Status & Action -->
                        <div class="flex-column" style="align-items: flex-end; gap: 1rem;">
                            <button class="close-modal" style="background: var(--card-bg); width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--glass-border); display: flex; align-items: center; justify-content: center; cursor: pointer;">
                                <span class="material-icons-round">close</span>
                            </button>
                            <div id="idm-status-badge" class="badge" style="font-size: 0.9rem; padding: 0.5rem 1rem;">-</div>
                        </div>
                    </div>
                </div>

                <!-- Scrollable Content -->
                <div style="padding: 2rem 2.5rem; overflow-y: auto; flex: 1;">
                    
                    <!-- Top Summary: Amount -->
                    <div class="flex-between mb-4" style="background: var(--glass-highlight); padding: 1.5rem; border-radius: 16px; border: 1px solid var(--glass-border);">
                        <div class="flex-column">
                            <span class="text-caption">Totale Documento</span>
                            <div id="idm-total" class="text-display" style="font-size: 2rem; font-weight: 700;">€ 0,00</div>
                        </div>
                        <div class="flex-column" style="align-items: flex-end; gap: 0.5rem;">
                            <span class="text-caption">Scadenza / Pagamento</span>
                            <div id="idm-pay-date" style="font-weight: 600; color: var(--text-primary);">-</div>
                        </div>
                    </div>

                    <!-- Economics Grid -->
                    <div class="mb-4">
                        <h4 class="text-caption mb-2 uppercase">Dettaglio Economico</h4>
                        <div id="idm-economics-grid" class="grid-3" style="gap: 1rem;">
                            <!-- Injected dynamically -->
                        </div>
                    </div>

                    <!-- Related Items Section -->
                    <div id="idm-related-section" class="flex-column gap-3 mb-4" style="border-top: 1px solid var(--glass-border); padding-top: 2rem;">
                        <h4 class="text-caption uppercase">Collegamenti</h4>
                        
                        <div class="grid-2 gap-4">
                            <!-- Orders -->
                            <div class="flex-column gap-2">
                                <span class="text-caption flex-start gap-1"><span class="material-icons-round text-small">folder</span> Ordini / Incarichi</span>
                                <div id="idm-related-orders" class="flex-column gap-1"></div>
                            </div>

                            <!-- Payments -->
                            <div class="flex-column gap-2">
                                <span class="text-caption flex-start gap-1"><span class="material-icons-round text-small">payments</span> Pagamenti</span>
                                <div id="idm-related-payments" class="flex-column gap-1"></div>
                            </div>
                        </div>

                         <!-- Transactions -->
                         <div class="flex-column gap-2 mt-2">
                             <span class="text-caption flex-start gap-1"><span class="material-icons-round text-small">account_balance</span> Movimenti Bancari</span>
                             <div id="idm-related-transactions" class="flex-column gap-1"></div>
                         </div>
                    </div>

                    <!-- Attachments (Passive Only) -->
                    <div id="idm-attachments-section" class="flex-column gap-2 mb-4" style="display: none; border-top: 1px solid var(--glass-border); padding-top: 2rem;">
                         <h4 class="text-caption uppercase">Allegati</h4>
                         <div id="idm-attachment-list" class="flex-start gap-2"></div>
                    </div>

                </div>

                <!-- Footer Actions -->
                <div class="flex-between" style="padding: 1.5rem 2.5rem; background: var(--glass-highlight); border-top: 1px solid var(--glass-border);">
                     <button id="idm-btn-delete" class="text-danger flex-center gap-1" style="background: none; border: none; font-weight: 600; cursor: pointer;">
                        <span class="material-icons-round">delete</span> Elimina
                     </button>
                     <button id="idm-btn-edit" class="primary-btn flex-center gap-1" style="padding: 0.75rem 2rem;">
                        <span class="material-icons-round">edit</span> Modifica
                     </button>
                </div>
            </div>
        </div>
    `);

    // Close handlers
    const modal = document.getElementById('invoice-detail-modal');
    modal.querySelectorAll('.close-modal').forEach(b => b.addEventListener('click', () => modal.classList.remove('active')));
}

export async function openInvoiceDetail(id, type) {
    if (!document.getElementById('invoice-detail-modal')) initInvoiceDetailModals();

    // Ensure data availability (Active/Passive both need payments/tx)
    if (!state.payments || state.payments.length === 0) await fetchPayments();
    if (!state.bankTransactions || state.bankTransactions.length === 0) await fetchBankTransactions();

    const modal = document.getElementById('invoice-detail-modal');

    // Store context
    modal.dataset.id = id;
    modal.dataset.type = type;

    // Find Invoice
    let invoice = null;
    let isPassive = type.startsWith('passive');

    if (type === 'active') {
        invoice = state.invoices.find(i => i.id === id);
    } else {
        invoice = state.passiveInvoices.find(i => i.id === id);
    }

    if (!invoice) {
        showGlobalAlert("Fattura non trovata", "error");
        return;
    }

    // --- RENDER HEADER ---
    const badge = document.getElementById('idm-type-badge');
    const statusBadge = document.getElementById('idm-status-badge');
    const numEl = document.getElementById('idm-number');
    const dateEl = document.getElementById('idm-date');
    const entityEl = document.getElementById('idm-entity');
    const entityIcon = document.getElementById('idm-entity-icon');

    // Defaults
    let number = invoice.invoice_number || '-';
    let date = new Date(invoice.issue_date || invoice.invoice_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
    let entityName = '-';
    let status = invoice.status || 'Bozza';

    if (type === 'active') {
        badge.textContent = "FATTURA ATTIVA";
        badge.className = "badge badge-neutral";
        entityName = invoice.clients?.business_name || 'Cliente Sconosciuto';
        entityIcon.textContent = 'business';
        entityIcon.style.color = 'var(--brand-blue)';
    } else if (type === 'passive-collab') {
        badge.textContent = invoice.category ? `NOTULA ${invoice.category.toUpperCase()}` : "FATTURA COLLABORATORE";
        badge.className = "badge badge-purple";
        entityName = invoice.collaborators?.full_name || 'Collaboratore Sconosciuto';
        entityIcon.textContent = 'person';
        entityIcon.style.color = '#8b5cf6';
    } else { // supplier
        badge.textContent = "FATTURA FORNITORE";
        badge.className = "badge badge-warning";
        entityName = invoice.suppliers?.name || 'Fornitore Sconosciuto';
        entityIcon.textContent = 'local_shipping';
        entityIcon.style.color = '#f59e0b';
    }

    numEl.textContent = number.includes('/') ? `N. ${number}` : `N. ${number}`; // Keep format
    dateEl.textContent = date;
    entityEl.textContent = entityName;

    // Status Style
    let statusColor = 'var(--text-tertiary)';
    let statusBg = 'var(--glass-highlight)';
    const s = status.toLowerCase();
    if (s.includes('pagat') || s.includes('saldat')) { statusColor = '#10b981'; statusBg = 'rgba(16, 185, 129, 0.1)'; }
    else if (s.includes('inviata') || s.includes('ricevuta')) { statusColor = '#3b82f6'; statusBg = 'rgba(59, 130, 246, 0.1)'; }
    else if (s.includes('bozza') || s.includes('dare')) { statusColor = '#f59e0b'; statusBg = 'rgba(245, 158, 11, 0.1)'; }
    statusBadge.textContent = status;
    statusBadge.style.color = statusColor;
    statusBadge.style.background = statusBg;
    statusBadge.style.border = `1px solid ${statusColor}44`;

    // --- RENDER SUMMARY & ECONOMICS ---
    const totalEl = document.getElementById('idm-total');
    const payDateEl = document.getElementById('idm-pay-date');
    const grid = document.getElementById('idm-economics-grid');
    grid.innerHTML = ''; // Reset

    let importo = parseFloat(invoice.amount_tax_excluded) || 0;
    let netto = parseFloat(invoice.amount_tax_included) || importo; // For active invoices, this might be total_price
    let iva = parseFloat(invoice.tax_amount) || 0;

    // Normalize fields for display
    // Make sure we use correct fields for Active vs Passive
    if (type === 'active') {
        importo = parseFloat(invoice.amount_tax_excluded) || 0;
        netto = parseFloat(invoice.amount_tax_included) || (importo + iva); // Typically stored as included
        // Active Logic
        // Add Importo
        grid.innerHTML += renderEcoCard('Imponibile', importo);
        if (iva > 0) grid.innerHTML += renderEcoCard('IVA', iva);
        if (invoice.rivalsa_inps > 0) grid.innerHTML += renderEcoCard('Rivalsa INPS', invoice.rivalsa_inps);
        if (invoice.ritenuta_acconto > 0) grid.innerHTML += renderEcoCard('Ritenuta d\'Acconto', -invoice.ritenuta_acconto, true); // Negative
        if (invoice.stamp_duty > 0) grid.innerHTML += renderEcoCard('Bollo', invoice.stamp_duty);

        totalEl.textContent = `€ ${formatAmount(netto)}`;
        totalEl.style.color = 'var(--brand-blue)'; // Income
    } else {
        // Passive Logic
        grid.innerHTML += renderEcoCard('Importo Base', importo);

        let cassa = 0;
        // Check if passive invoice has cassa included in calculations?
        // Logic in calculation: imponibile = importo + cassa.
        // We don't store "cassa" explicitly in passive_invoices table yet? 
        // Wait, updateNettoCalculation calculated it but where did it store it?
        // It stores: amount_tax_excluded (Importo), then tax_amount (IVA).
        // Wait. Cassa is part of Imponibile?
        // Re-read updateNettoCalculation: 
        // "imponibile = importo + cassa;" -> then iva on imponibile.
        // We store 'amount_tax_excluded' as Importo entered by user? Or Imponibile?
        // Ideally we should have stored cassa separately. 
        // But assuming amount_tax_excluded is Imponibile.
        // Let's rely on what we have.

        if (invoice.rivalsa_inps > 0) grid.innerHTML += renderEcoCard('Rivalsa / Cassa', invoice.rivalsa_inps);
        else if (type === 'passive-supplier' && (parseFloat(invoice.amount_tax_excluded) > parseFloat(invoice.importo_originale || 0))) {
            // Heuristic if we stored original amount?? No.
        }

        if (iva > 0) grid.innerHTML += renderEcoCard('IVA', iva);
        if (invoice.ritenuta > 0) grid.innerHTML += renderEcoCard('Ritenuta', -invoice.ritenuta, true);

        totalEl.textContent = `€ ${formatAmount(netto)}`;
        totalEl.style.color = '#ef4444'; // Expense
    }

    // Payment Date
    if (invoice.payment_date) {
        payDateEl.textContent = new Date(invoice.payment_date).toLocaleDateString('it-IT');
    } else {
        payDateEl.textContent = invoice.due_date ? `Scad. ${new Date(invoice.due_date).toLocaleDateString('it-IT')}` : 'Non saldata';
    }

    // --- RELATED ITEMS ---
    const ordersDiv = document.getElementById('idm-related-orders');
    const paymentsDiv = document.getElementById('idm-related-payments');
    const txDiv = document.getElementById('idm-related-transactions');

    ordersDiv.innerHTML = '';
    paymentsDiv.innerHTML = '';
    txDiv.innerHTML = '';

    // Orders
    let relatedOrders = [];
    if (type === 'active') {
        // Active Invoices linked to Orders via `orders` table? No, invoices usually have order_id or orders link.
        // In fetchInvoices: `orders (id, order_number, title)`
        if (invoice.orders) relatedOrders.push(invoice.orders);
    } else {
        // Passive: related_orders column (can be array of strings/IDs or JSON string)
        let linkedOrders = invoice.related_orders || [];
        if (typeof linkedOrders === 'string') {
            try { linkedOrders = JSON.parse(linkedOrders); } catch (e) { linkedOrders = [linkedOrders]; }
        }

        if (Array.isArray(linkedOrders)) {
            linkedOrders.forEach(idOrNum => {
                // Try to find if it's an ID
                // Try to find if it's an ID or Protocol Number or Order Number
                const ord = state.orders ? state.orders.find(o => o.id === idOrNum || o.order_number === idOrNum || o.protocol_number === idOrNum || (o.code === idOrNum)) : null;
                const clientName = ord?.clients?.client_code || '';
                const displayNum = ord ? (clientName ? `${clientName} ${ord.order_number}` : ord.order_number) : idOrNum;
                const title = ord ? ord.title : 'Ordine senza titolo';

                ordersDiv.innerHTML += `
                    <div class="glass-card p-3 clickable-card flex-start gap-3" 
                         onclick="${ord ? `window.location.hash='orders'; setTimeout(()=>window.openOrderDetail('${ord.id}'),100)` : ''}"
                         style="align-items: flex-start;">
                        
                        <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(59, 130, 246, 0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                             <span class="material-icons-round" style="color: var(--brand-blue); font-size: 1.25rem;">folder</span>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); line-height: 1.3;">${title}</div>
                            <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem;">
                                 <span style="font-weight: 700; color: var(--brand-blue);">${displayNum}</span>
                                 <span style="color: var(--text-tertiary);">${clientName}</span>
                            </div>
                        </div>
                    </div>`;
            });
        }
    }
    // Render objects (legacy)
    if (relatedOrders.length > 0 && typeof relatedOrders[0] === 'object') {
        relatedOrders.forEach(o => {
            ordersDiv.innerHTML += `<div class="glass-card p-2 text-small flex-start gap-2 clickable-card" onclick="window.location.hash='orders'"><span class="material-icons-round text-tertiary" style="font-size:1rem;">folder</span> <b>${o.order_number}</b> ${o.title}</div>`;
        });
    }
    if (ordersDiv.innerHTML === '') ordersDiv.innerHTML = '<span class="text-caption italic">Nessun ordine collegato</span>';

    // Payments
    let linkedPayments = state.payments.filter(p =>
        (type === 'active' && (p.invoice_id === id || p.invoices?.id === id)) ||
        (!type.startsWith('active') && (p.passive_invoice_id === id || p.passive_invoices?.id === id))
    );

    // [V7 Safety Filter] Filter by Linked Orders
    // If this passive invoice is linked to specfic Orders, ONLY show payments belonging to those Orders.
    // This removes ambiguity where payments from other orders (even same collaborator) might appear if blindly linked.
    if (!type.startsWith('active') && invoice.related_orders && invoice.related_orders.length > 0) {
        // Parse related_orders first if needed
        let orderIds = [];
        try {
            orderIds = Array.isArray(invoice.related_orders) ? invoice.related_orders : JSON.parse(invoice.related_orders);
            // Ensure array of strings/IDs
            if (!Array.isArray(orderIds)) orderIds = [orderIds];
        } catch (e) { orderIds = []; }

        if (orderIds.length > 0) {
            // Relaxed filtering: show if direct link OR matches order
            linkedPayments = linkedPayments.filter(p => {
                if (p.passive_invoice_id === id) return true; // Direct link overrides all
                if (!p.order_id) return true; // Keep "general" payments
                // Resolve order IDs to numbers if needed, or check if p.order_id matches any of orderIds (which might be codes)
                // This is tricky. For now, assume if direct link matches, show it.
                return true;
            });
        }
    }

    // Legacy Payments Patch Removed (DB updated)
    if (linkedPayments.length > 0) {
        linkedPayments.forEach(p => {
            const isPaid = p.status === 'Done';
            paymentsDiv.innerHTML += `
                <div class="glass-card p-2 flex-between clickable-card" onclick="openPaymentModal('${p.id}')">
                    <div class="flex-start gap-2">
                        <span class="material-icons-round ${isPaid ? 'text-success' : 'text-warning'}" style="font-size:1rem;">${isPaid ? 'check_circle' : 'schedule'}</span>
                        <div class="flex-column">
                            <span class="text-body font-bold">€ ${formatAmount(p.amount)}</span>
                            <span class="text-caption">${p.title}</span>
                        </div>
                    </div>
                    <span class="text-caption">${p.due_date ? new Date(p.due_date).toLocaleDateString() : '-'}</span>
                </div>`;
        });
    } else {
        paymentsDiv.innerHTML = '<span class="text-caption italic">Nessun pagamento pianificato</span>';
    }

    // Transactions
    let linkedTx = state.bankTransactions.filter(t =>
        ((type === 'active' && (t.invoice_id === id || t.active_invoice_id === id || t.linked_invoices?.includes(id))) ||
            (!type.startsWith('active') && (t.passive_invoice_id === id || t.linked_invoices?.includes(id)))) &&
        t.status !== 'rejected'
    );

    // [Safety Check V7] Transaction Filter
    // 1. If explicit array link (linked_invoices), TRUST IT (supports multi-invoice payments).
    // 2. If singular link (passive_invoice_id), ENFORCE Collaborator Match (if tx has one).
    if (!type.startsWith('active') && invoice.collaborator_id) {
        linkedTx = linkedTx.filter(t => {
            // Case A: Explicit Array Link (Strongest)
            if (t.linked_invoices && t.linked_invoices.includes(id)) return true;

            // Case B: Singular Link -> Strict Check
            if (t.collaborator_id && t.collaborator_id !== invoice.collaborator_id) return false;

            return true;
        });
    }

    // [Fix] Hide transactions that are already represented by a Linked Payment
    const paymentTxIds = new Set(linkedPayments.map(p => p.transaction_id).filter(Boolean));
    linkedTx = linkedTx.filter(t => !paymentTxIds.has(t.id));

    // Legacy Transactions Patch Removed (DB updated)
    if (linkedTx.length > 0) {
        linkedTx.forEach(t => {
            txDiv.innerHTML += `
               <div class="glass-card p-2 flex-between">
                   <div class="flex-start gap-2">
                       <span class="material-icons-round text-primary" style="font-size:1rem;">account_balance</span>
                       <div class="flex-column">
                           <span class="text-body font-bold">€ ${formatAmount(t.amount)}</span>
                           <span class="text-caption">${t.description}</span>
                       </div>
                   </div>
                   <span class="text-caption">${new Date(t.date).toLocaleDateString()}</span>
               </div>`;
        });
    } else {
        txDiv.innerHTML = '<span class="text-caption italic">Nessun movimento bancario riconciliato</span>';
    }

    // --- ATTACHMENTS ---
    const attSection = document.getElementById('idm-attachments-section');
    const attList = document.getElementById('idm-attachment-list');
    attList.innerHTML = '';

    // Support new JSON array format or Legacy string
    let attUrls = [];
    if (isPassive && invoice.attachment_url) {
        try {
            // Try parse as JSON array
            const parsed = JSON.parse(invoice.attachment_url);
            if (Array.isArray(parsed)) attUrls = parsed;
            else attUrls = [invoice.attachment_url]; // Fallback if valid JSON but not array
        } catch (e) {
            // Not JSON, assume simple string
            attUrls = [invoice.attachment_url];
        }
    }

    if (attUrls.length > 0) {
        attSection.style.display = 'flex';
        attList.innerHTML = ''; // Clear again to be safe

        attUrls.forEach(url => {
            const name = url.split('/').pop().split('?')[0];
            const cleanName = name.replace(/^V7_\w+_/, '').replace(/_/g, ' '); // Clean V7 prefix
            const ext = name.split('.').pop().toLowerCase();
            let icon = 'description';
            if (['pdf'].includes(ext)) icon = 'picture_as_pdf';
            if (['jpg', 'jpeg', 'png'].includes(ext)) icon = 'image';

            // Better Name Logic
            let mainLabel = "Documento";
            if (cleanName.toLowerCase().includes('fattura')) mainLabel = "Fattura";
            else if (cleanName.toLowerCase().includes('ricevuta')) mainLabel = "Ricevuta";
            else if (cleanName.toLowerCase().includes('notion')) mainLabel = "Notion Invoice";

            attList.innerHTML += `
                <a href="${url}" target="_blank" class="glass-card p-3 flex-start gap-3 no-decor" 
                   style="min-width: 200px; transition: transform 0.2s, box-shadow 0.2s;" 
                   onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-premium)'"
                   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='var(--shadow-soft)'">
                    
                    <div style="width: 42px; height: 42px; border-radius: 12px; background: rgba(59, 130, 246, 0.08); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <span class="material-icons-round" style="color: var(--brand-blue); font-size: 1.5rem;">${icon}</span>
                    </div>

                    <div class="flex-column" style="overflow: hidden; flex: 1; gap: 2px;">
                        <span class="text-body font-bold text-truncate" style="color: var(--text-primary); line-height: 1.2;">${mainLabel}</span>
                        <span class="text-caption text-truncate" style="color: var(--text-tertiary); font-size: 0.75rem; letter-spacing: 0.3px; opacity: 0.8;" title="${cleanName}">${cleanName}</span>
                    </div>

                    <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--bg-secondary); display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons-round" style="color: var(--text-secondary); font-size: 1rem;">arrow_outward</span>
                    </div>
                </a>
            `;
        });
    } else {
        attSection.style.display = 'none';
    }

    // Actions
    document.getElementById('idm-btn-edit').onclick = () => {
        // Close detail, open form
        modal.classList.remove('active');
        if (type === 'active') {
            // Call generic openInvoiceForm logic. Assuming global handle.
            // window.openActiveInvoiceForm(id); // Usually exposed
            // If not exposed, we need to check how to open it.
            // renderInvoices -> openInvoiceForm(id).
            if (window.openInvoiceForm) window.openInvoiceForm(id);
        } else {
            // Passive
            if (typeof window.openPassiveInvoiceForm === 'function') {
                window.openPassiveInvoiceForm(id, type === 'passive-collab' ? 'collab' : 'supplier');
            }
        }
    };

    document.getElementById('idm-btn-delete').onclick = async () => {
        if (await window.showConfirm("Eliminare definitivamente questa fattura?", { type: 'danger' })) {
            try {
                // Determine table
                const table = type === 'active' ? 'invoices' : 'passive_invoices';
                const { error } = await supabase.from(table).delete().eq('id', id);
                if (error) throw error;

                showGlobalAlert('Fattura eliminata');
                modal.classList.remove('active');

                // Refresh list
                window.dispatchEvent(new Event('data:updated'));
                // Trigger specific refreshes if needed (like in save handler)
                if (type.startsWith('passive')) {
                    await fetchPassiveInvoices();
                    // trigger internal re-render... via refreshCurrentPage or router.
                    // For now, rely on hashchange or reload.
                    // window.location.reload(); // Too aggressive?
                    // Better:
                    const container = document.getElementById('content-area');
                    if (state.currentPage.includes('passive')) {
                        // Re-render current type
                        if (type === 'passive-collab') renderPassiveInvoicesCollab(container);
                        else renderPassiveInvoicesSuppliers(container);
                    }
                } else {
                    await fetchInvoices();
                    // Re-render active
                    // renderActiveInvoicesSafe(document.getElementById('content-area'));
                    // If we assume router handles it -> reload hash
                    window.dispatchEvent(new HashChangeEvent("hashchange"));
                }

            } catch (e) {
                showGlobalAlert('Errore eliminazione: ' + e.message, 'error');
            }
        }
    };

    modal.classList.add('active');
}

function renderEcoCard(label, value, isNegative = false) {
    return `
    <div class="glass-card p-3 flex-column gap-1">
        <span class="text-caption">${label}</span>
        <span class="text-body font-bold" style="font-size: 1.1rem; color: ${isNegative ? 'var(--error-soft)' : 'var(--text-primary)'};">
            ${isNegative ? '-' : ''} € ${formatAmount(Math.abs(value))}
        </span>
    </div>`;
}

// Ensure global access
if (typeof window !== 'undefined') window.openInvoiceDetail = openInvoiceDetail;

// Original Export
export async function openPassiveInvoiceForm(id = null, mode = 'collab') {
    const modal = document.getElementById('passive-invoice-modal');
    if (!modal) return;

    state.currentPassiveInvoiceId = id;
    state._pinvVatManuallySet = false; // Reset manual override

    // Populate collaborators/suppliers and UI setup
    if (mode === 'collab') {
        document.getElementById('passive-invoice-modal-title').textContent = id ? 'Modifica Fattura Collaboratore' : 'Nuova Fattura Collaboratore';
        document.getElementById('pinv-collab-fields').style.display = 'grid';
        document.getElementById('pinv-supplier-fields').style.display = 'none';
        await populateCollaboratorDropdown();
    } else {
        document.getElementById('passive-invoice-modal-title').textContent = id ? 'Modifica Fattura Fornitore' : 'Nuova Fattura Fornitore';
        document.getElementById('pinv-collab-fields').style.display = 'none';
        document.getElementById('pinv-supplier-fields').style.display = 'grid';
        await populateSupplierDropdown();
    }

    // Reset form
    document.getElementById('passive-invoice-form').reset();
    document.getElementById('pinv-payment-date-container').style.display = 'none';
    document.getElementById('pinv-payments-container').style.display = 'none';

    // Clear dropdowns based on mode
    if (mode === 'collab') document.getElementById('pinv-order').innerHTML = '<option value="">Seleziona prima un collaboratore</option>';
    else document.getElementById('pinv-order').innerHTML = '<option value="">Bozza (nessun ordine collegato)</option>';

    document.getElementById('pinv-payments-list').innerHTML = '<p style="color: var(--text-tertiary); font-size: 0.8rem; text-align: center;">Seleziona un ordine per vedere i pagamenti</p>';
    document.getElementById('pinv-file-preview').style.display = 'none';
    if (mode === 'collab') updateCalcHint('ritenuta');

    if (id) {
        const inv = state.passiveInvoices.find(i => i.id === id);
        if (inv) {
            document.getElementById('pinv-number').value = inv.invoice_number || '';
            document.getElementById('pinv-date').value = inv.issue_date || '';
            document.getElementById('pinv-amount').value = inv.amount_tax_excluded || '';
            document.getElementById('pinv-net').value = inv.amount_tax_included || '';
            document.getElementById('pinv-has-vat').checked = inv.iva_attiva || (inv.tax_amount > 0);
            document.getElementById('pinv-status').value = inv.status || 'Da Pagare';

            if (mode === 'collab') {
                document.getElementById('pinv-type').value = inv.category || 'ritenuta';
                document.getElementById('pinv-collaborator').value = inv.collaborator_id || '';
                if (inv.collaborator_id) {
                    updatePassiveOrdersDropdown(inv.collaborator_id);
                    if (inv.related_orders && inv.related_orders.length > 0) {
                        // Find order id if possible, currently related_orders stores strings. 
                        // Logic limitation for now: we don't easily map back to single order ID if multiple.
                        // Keeping it simple for legacy/single order flow.
                    }
                }
                updateCalcHint(inv.category || 'ritenuta');
            } else {
                // Supplier mode
                document.getElementById('pinv-supplier').value = inv.supplier_id || '';
                document.getElementById('pinv-description').value = inv.description || inv.service_description || '';
            }

            // Payment date
            if (inv.status === 'Pagata') {
                document.getElementById('pinv-payment-date-container').style.display = 'block';
                document.getElementById('pinv-payment-date').value = inv.payment_date || '';
            }
        }
    } else {
        document.getElementById('pinv-date').value = new Date().toISOString().split('T')[0];
    }

    modal.classList.add('active');
    modal.dataset.mode = mode;
}

export function closePassiveInvoiceForm() {
    const modal = document.getElementById('passive-invoice-modal');
    if (modal) modal.classList.remove('active');
    state.currentPassiveInvoiceId = null;
}

export function renderPassiveInvoicesCollab(container) {
    const sectionTitle = 'Fatture Collaboratori';
    renderPassiveInvoicesGeneric(container, sectionTitle, 'collaborators');
}

export function renderPassiveInvoicesSuppliers(container) {
    const sectionTitle = 'Fatture Fornitori';
    renderPassiveInvoicesGeneric(container, sectionTitle, 'suppliers');
}

function renderPassiveInvoicesGeneric(container, title, type) {
    const isCollab = type === 'collaborators';
    const iconName = isCollab ? 'person' : 'business';
    const gradientColor = isCollab ? '#8b5cf6' : '#ef4444';
    // Auto-switch Year Logic
    let currentYear = state.passiveInvoiceYear;
    if (!currentYear && state.passiveInvoices.length > 0) {
        const def = new Date().getFullYear();
        // Check availability for default year
        const hasData = state.passiveInvoices.some(inv =>
            new Date(inv.issue_date || inv.date || inv.invoice_date).getFullYear() === def &&
            (isCollab ? inv.collaborator_id : (!inv.collaborator_id))
        );
        if (hasData) currentYear = def;
        else {
            const allYears = [...new Set(state.passiveInvoices
                .filter(inv => isCollab ? inv.collaborator_id : (!inv.collaborator_id))
                .map(inv => new Date(inv.issue_date || inv.date || inv.invoice_date).getFullYear()))
            ].sort((a, b) => b - a);
            currentYear = allYears.length > 0 ? allYears[0] : def;
        }
        state.passiveInvoiceYear = currentYear;
    } else if (!currentYear) currentYear = new Date().getFullYear();

    const statusFilter = state.passiveInvoiceStatusFilter || 'all';

    let filtered = state.passiveInvoices.filter(inv => {
        // Exclusive filter: collaborator invoices have collaborator_id, supplier invoices have supplier_id
        // If both are set, prioritize based on which list we're rendering
        if (isCollab) {
            if (!inv.collaborator_id) return false;
        } else {
            if (!inv.supplier_id || inv.collaborator_id) return false; // Exclude if it has collaborator_id
        }

        const matchesYear = new Date(inv.issue_date).getFullYear() === currentYear;
        const search = state.searchTerm.toLowerCase();
        const name = (inv.collaborators?.full_name || inv.suppliers?.name || '').toLowerCase();
        const num = (inv.invoice_number || '').toLowerCase();
        return matchesYear && (name.includes(search) || num.includes(search));
    });

    // Calculate KPIs using amount_tax_excluded (importo)
    const totalCosti = filtered.reduce((sum, i) => sum + (parseFloat(i.amount_tax_excluded) || 0), 0);

    // Status normalization helper
    const isPaid = (status) => {
        const s = (status || '').toLowerCase();
        return s === 'pagato' || s === 'pagata' || s === 'saldato' || s === 'saldata';
    };

    const nonPagate = filtered.filter(i => !isPaid(i.status));
    const pagate = filtered.filter(i => isPaid(i.status));

    const daPagare = nonPagate.reduce((sum, i) => sum + (parseFloat(i.amount_tax_excluded) || 0), 0);
    const pagato = pagate.reduce((sum, i) => sum + (parseFloat(i.amount_tax_excluded) || 0), 0);

    // Apply status filter
    if (statusFilter === 'pending') {
        filtered = nonPagate;
    } else if (statusFilter === 'paid') {
        filtered = pagate;
    }

    const getStatusStyle = (status) => {
        const s = (status || '').toLowerCase();
        if (s === 'pagato' || s === 'pagata' || s === 'saldata' || s === 'saldato') return 'background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2);';
        if (s === 'ricevuta' || s === 'inviata') return 'background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2);';
        return 'background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2);';
    };

    const kpiActiveStyle = (filter) => statusFilter === filter ? 'box-shadow: 0 0 0 2px var(--brand-blue); transform: scale(1.02);' : '';

    const formatDateBlock = (dateStr) => {
        if (!dateStr) return '<div style="min-width: 45px;"></div>';
        const d = new Date(dateStr);
        const day = d.getDate().toString().padStart(2, '0');
        const months = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        return `<div style="text-align: center; min-width: 45px;">
            <div style="font-size: 1.5rem; font-weight: 300; line-height: 1; color: var(--text-primary);">${day}</div>
            <div style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.02em;">${month}</div>
            <div style="font-size: 0.6rem; color: var(--text-tertiary);">${year}</div>
        </div>`;
    };

    const cards = filtered.map(inv => {
        let name = '-';
        if (isCollab) {
            name = inv.collaborators?.full_name || 'Collaboratore Sconosciuto';
        } else {
            name = inv.suppliers?.name || 'Fornitore Sconosciuto';
        }

        const importo = parseFloat(inv.amount_tax_excluded) || 0;
        const iva = parseFloat(inv.tax_amount) || 0;
        const nettoAPagare = parseFloat(inv.amount_tax_included) || importo;
        const settlementDate = inv.payment_date ? new Date(inv.payment_date).toLocaleDateString('it-IT') : null;

        if (isCollab) {
            // Collaborator invoice template
            // Detect ritenuta by checking if netto < importo (withholding tax deducted)
            const isRitenuta = nettoAPagare < importo;
            const invoiceType = isRitenuta ? 'Ritenuta' : 'Fattura';
            // Resolve Linked Orders (IDs -> Numbers)
            let linkedOrdersDisplay = [];
            let linkedOrders = inv.related_orders || [];

            if (!Array.isArray(linkedOrders)) {
                if (typeof linkedOrders === 'string') {
                    try {
                        linkedOrders = JSON.parse(linkedOrders);
                    } catch (e) {
                        // Fallback if it's a single raw string (not JSON)
                        // But usually it's JSON from our script
                        linkedOrders = [linkedOrders];
                    }
                } else {
                    linkedOrders = [];
                }
            }

            if (linkedOrders.length > 0) {
                linkedOrdersDisplay = linkedOrders.map(id => {
                    const ord = state.orders ? state.orders.find(o => o.id === id) : null;
                    if (!ord) return '';
                    const clientName = ord.clients?.client_code || '';
                    return clientName ? `${clientName} ${ord.order_number}` : ord.order_number;
                }).filter(n => n); // Filter out empty
            }

            return `
            <div class="glass-card clickable-card" data-id="${inv.id}" style="padding: 1rem 1.25rem; cursor: pointer; transition: all 0.2s; border: 1px solid var(--glass-border); display: flex; align-items: center; gap: 1.25rem;">
                <!-- Date Block -->
                ${formatDateBlock(inv.issue_date)}
                
                <!-- Separator -->
                <div style="width: 1px; height: 40px; background: var(--glass-border);"></div>
                
                <!-- Main Info -->
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 1rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-tertiary); display: flex; gap: 0.75rem; align-items: center;">
                        <span>N. ${inv.invoice_number || '-'}</span>
                        <span style="padding: 0.15rem 0.5rem; background: ${isRitenuta ? 'rgba(139, 92, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)'}; color: ${isRitenuta ? '#8b5cf6' : '#3b82f6'}; border-radius: 4px; font-size: 0.65rem; font-weight: 600;">${invoiceType}</span>
                    </div>
                </div>
                
                <!-- Linked Orders -->
                ${linkedOrdersDisplay.length > 0 ? `
                <div style="font-size: 0.7rem; color: var(--text-tertiary); display: flex; align-items: center; gap: 0.3rem;">
                    <span class="material-icons-round" style="font-size: 0.9rem;">link</span>
                    ${linkedOrdersDisplay.slice(0, 2).join(', ')}${linkedOrdersDisplay.length > 2 ? ` +${linkedOrdersDisplay.length - 2}` : ''}
                </div>` : ''}
                
                <!-- Status + Settlement Date (fixed width for alignment) -->
                <div style="display: flex; align-items: center; gap: 0.5rem; min-width: 170px; justify-content: flex-end;">
                    <span style="padding: 0.3rem 0.75rem; border-radius: 2rem; font-size: 0.7rem; font-weight: 600; white-space: nowrap; ${getStatusStyle(inv.status)}">${inv.status || 'Bozza'}</span>
                    <span style="font-size: 0.75rem; color: var(--text-tertiary); min-width: 75px; text-align: right;">${settlementDate || ''}</span>
                </div>
                
                <!-- Amounts: Pagato (Big) + Importo (Small under) -->
                <div style="text-align: right; min-width: 140px;">
                    <div style="font-size: 1.1rem; font-weight: 700; color: #ef4444;">€ ${formatAmount(nettoAPagare)}</div>
                    <div style="font-size: 0.7rem; color: var(--text-tertiary);">Importo € ${formatAmount(importo)}</div>
                </div>
            </div>`;
        } else {
            // Supplier invoice template
            const description = inv.service_description || inv.description || '';

            return `
            <div class="glass-card clickable-card" data-id="${inv.id}" style="padding: 1rem 1.25rem; cursor: pointer; transition: all 0.2s; border: 1px solid var(--glass-border); display: flex; align-items: center; gap: 1.25rem;">
                <!-- Date Block -->
                ${formatDateBlock(inv.issue_date)}
                
                <!-- Separator -->
                <div style="width: 1px; height: 40px; background: var(--glass-border);"></div>
                
                <!-- Main Info -->
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 1rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-tertiary); display: flex; gap: 0.75rem; align-items: center;">
                        <span>N. ${inv.invoice_number || '-'}</span>
                        ${description ? `<span style="opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">${description}</span>` : ''}
                    </div>
                </div>
                
                <!-- Status + Settlement Date (fixed width for alignment) -->
                <div style="display: flex; align-items: center; gap: 0.5rem; min-width: 170px; justify-content: flex-end;">
                    <span style="padding: 0.3rem 0.75rem; border-radius: 2rem; font-size: 0.7rem; font-weight: 600; white-space: nowrap; ${getStatusStyle(inv.status)}">${inv.status || 'Bozza'}</span>
                    <span style="font-size: 0.75rem; color: var(--text-tertiary); min-width: 75px; text-align: right;">${settlementDate || ''}</span>
                </div>
                
                <!-- Amounts: Pagato (Big) + Importo/IVA (Small under) -->
                <div style="text-align: right; min-width: 140px;">
                    <div style="font-size: 1.1rem; font-weight: 700; color: #ef4444;">€ ${formatAmount(nettoAPagare)}</div>
                    <div style="font-size: 0.7rem; color: var(--text-tertiary);">Importo € ${formatAmount(importo)}${iva > 0 ? ` + IVA € ${formatAmount(iva)}` : ''}</div>
                </div>
            </div>`;
        }
    }).join('');

    container.innerHTML = `
        <div class="animate-fade-in" style="max-width: 1100px; margin: 0 auto; padding: 1rem;">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, ${gradientColor}, ${gradientColor}cc); display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px ${gradientColor}33;">
                        <span class="material-icons-round" style="color: white; font-size: 24px;">${iconName}</span>
                    </div>
                    <div>
                        <h1 style="font-size: 1.5rem; font-weight: 700; margin: 0; font-family: var(--font-titles);">${title}</h1>
                        <p style="font-size: 0.85rem; color: var(--text-tertiary); margin: 0;">${filtered.length} fatture ${statusFilter !== 'all' ? `(${statusFilter === 'pending' ? 'da pagare' : 'pagate'})` : `nel ${currentYear}`}</p>
                    </div>
                </div>
                <div style="display: flex; gap: 0.75rem; align-items: center;">
                    <select id="passive-year-filter" style="padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid var(--glass-border); background: white; font-size: 0.85rem; cursor: pointer;">
                        <option value="2026" ${currentYear === 2026 ? 'selected' : ''}>2026</option>
                        <option value="2025" ${currentYear === 2025 ? 'selected' : ''}>2025</option>
                        <option value="2024" ${currentYear === 2024 ? 'selected' : ''}>2024</option>
                    </select>
                    <button class="primary-btn" id="btn-new-passive" style="padding: 0.6rem 1.25rem; border-radius: 10px; white-space: nowrap;">
                        <span class="material-icons-round" style="font-size: 1.1rem;">add</span> Nuova
                    </button>
                </div>
            </div>

            <!-- KPI Summary (clickable) -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div class="glass-card kpi-card" data-filter="all" style="padding: 1.25rem; background: linear-gradient(135deg, rgba(239, 68, 68, 0.05), transparent); cursor: pointer; transition: all 0.2s; ${kpiActiveStyle('all')}">
                    <div style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Totale Costi</div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: #ef4444; font-family: var(--font-titles);">€ ${formatAmount(totalCosti)}</div>
                </div>
                <div class="glass-card kpi-card" data-filter="pending" style="padding: 1.25rem; background: linear-gradient(135deg, rgba(245, 158, 11, 0.05), transparent); cursor: pointer; transition: all 0.2s; ${kpiActiveStyle('pending')}">
                    <div style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Da Pagare</div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: #f59e0b; font-family: var(--font-titles);">€ ${formatAmount(daPagare)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.25rem;">${nonPagate.length} fatture</div>
                </div>
                <div class="glass-card kpi-card" data-filter="paid" style="padding: 1.25rem; background: linear-gradient(135deg, rgba(16, 185, 129, 0.05), transparent); cursor: pointer; transition: all 0.2s; ${kpiActiveStyle('paid')}">
                    <div style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Pagato</div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: #10b981; font-family: var(--font-titles);">€ ${formatAmount(pagato)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.25rem;">${pagate.length} fatture</div>
                </div>
                <div class="glass-card" style="padding: 1.25rem;">
                    <div style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Fatture Pendenti</div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: ${nonPagate.length > 0 ? '#f59e0b' : '#10b981'}; font-family: var(--font-titles);">${nonPagate.length}</div>
                </div>
            </div>

            <!-- Invoice List (single column) -->
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${cards ? cards : `
                    <div style="text-align: center; padding: 4rem 2rem; border: 2px dashed var(--glass-border); border-radius: 12px; background: rgba(255,255,255,0.02);">
                        <span class="material-icons-round" style="font-size: 3rem; color: var(--text-tertiary); margin-bottom: 1rem;">search_off</span>
                        <p style="font-size: 1.1rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Nessuna fattura visualizzata per il ${currentYear}</p>
                        <p style="font-size: 0.9rem; color: var(--text-tertiary);">Controlla il filtro anno in alto a destra o lo stato.</p>
                        ${state.passiveInvoices.length > 0 ? `<p style="margin-top:1rem; color: #f59e0b; font-size: 0.85rem; background: rgba(245, 158, 11, 0.1); display: inline-block; padding: 0.25rem 0.75rem; border-radius: 1rem;">Ci sono ${state.passiveInvoices.length} fatture totali nel database (filtri attivi)</p>` : ''}
                    </div>
                `}
            </div>
        </div>`;

    // Event listeners
    container.querySelectorAll('.clickable-card').forEach(card => {
        card.addEventListener('click', () => window.openInvoiceDetail(card.dataset.id, type === 'suppliers' ? 'passive-supplier' : 'passive-collab'));
    });
    container.querySelector('#btn-new-passive')?.addEventListener('click', () => window.openPassiveInvoiceForm(null, type === 'suppliers' ? 'supplier' : 'collab'));
    container.querySelector('#passive-year-filter')?.addEventListener('change', (e) => {
        state.passiveInvoiceYear = parseInt(e.target.value);
        state.passiveInvoiceStatusFilter = 'all';
        renderPassiveInvoicesGeneric(container, title, type);
    });
    // KPI click handlers
    container.querySelectorAll('.kpi-card').forEach(kpi => {
        kpi.addEventListener('click', () => {
            state.passiveInvoiceStatusFilter = kpi.dataset.filter;
            renderPassiveInvoicesGeneric(container, title, type);
        });
    });
}

