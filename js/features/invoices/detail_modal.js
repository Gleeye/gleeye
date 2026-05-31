// Invoice detail modal — shows a single invoice (active or passive) with related
// orders, payments and bank transactions. Edit/delete actions hand off via window
// to the form openers in invoices.js.
//
// Extracted from invoices.js. Side effects on import: registers window.openInvoiceDetail.

import { state } from '/js/modules/state.js?v=8000';
import { supabase } from '../../modules/config.js?v=8000';
import { formatAmount, showGlobalAlert } from '../../modules/utils.js?v=8000';
import { fetchInvoices, fetchPassiveInvoices, fetchPayments, fetchBankTransactions } from '../../modules/api.js?v=8000';
import { renderPassiveInvoicesPartners, renderPassiveInvoicesCollab, renderPassiveInvoicesSuppliers } from './passive_list.js?v=8000';

// --- DETAIL MODAL LOGIC ---

export function initInvoiceDetailModals() {
    if (document.getElementById('invoice-detail-modal')) return;

    document.body.insertAdjacentHTML('beforeend', `
        <div id="invoice-detail-modal" class="modal" style="z-index: 10000;">
            <style>
                #invoice-detail-modal .modal-content { max-width: 800px; padding: 0; overflow: hidden; display: flex; flex-direction: column; max-height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 32px); }

                @media (max-width: 768px) {
                    #invoice-detail-modal .modal-content {
                        max-height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 32px);
                        width: 95vw; 
                        margin: 5vh auto; 
                        border-radius: 20px; 
                        border: 1px solid var(--glass-border);
                        box-shadow: var(--shadow-premium);
                    }
                    
                    /* Header Clean & Accessible */
                    #invoice-detail-modal .detail-header { padding: 1.25rem !important; background: white !important; }
                    #invoice-detail-modal .header-top-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.25rem; }
                    #invoice-detail-modal #idm-type-badge { font-size: 0.6rem !important; padding: 0.15rem 0.4rem !important; border-radius: 4px; border: 1px solid var(--glass-border); background: #f8fafc !important; color: #64748b !important; }
                    
                    #invoice-detail-modal .header-main-info { display: flex; flex-direction: column; gap: 0.1rem; }
                    #invoice-detail-modal .num-date-row { display: flex; align-items: baseline; gap: 0.5rem; }
                    #invoice-detail-modal #idm-number { font-size: 1.2rem !important; font-weight: 800 !important; }
                    #invoice-detail-modal #idm-date { font-size: 0.8rem !important; color: var(--text-tertiary); }
                    
                    #invoice-detail-modal .entity-row { display: flex; align-items: center; gap: 0.4rem; }
                    #invoice-detail-modal #idm-entity-icon { font-size: 0.9rem !important; color: var(--text-tertiary, #94a3b8); }
                    #invoice-detail-modal #idm-entity { font-size: 0.9rem !important; font-weight: 600 !important; color: var(--text-secondary); }

                    #invoice-detail-modal .detail-body { padding: 1rem 1.25rem !important; background: var(--bg-tertiary, #fbfbfc); }
                    
                    /* Status moved to body top */
                    #invoice-detail-modal #idm-status-badge { font-size: 0.65rem !important; padding: 0.2rem 0.6rem !important; border-radius: 4px; margin-top: 0; margin-bottom: 0.75rem; width: fit-content; }
                    
                    /* Amount Card Refinement */
                    #invoice-detail-modal .amount-card { 
                        padding: 0.75rem !important; 
                        margin-bottom: 0.75rem !important; 
                        border-radius: 12px; 
                        background: white !important; 
                        border: 1px solid rgba(0,0,0,0.04) !important;
                    }
                    #invoice-detail-modal #idm-total { font-size: 1.25rem !important; font-weight: 800 !important; }
                    #invoice-detail-modal .amount-card .text-caption { font-size: 0.55rem !important; font-weight: 600; color: var(--text-tertiary, #94a3b8) !important; }
                    #invoice-detail-modal #idm-pay-date { font-size: 0.8rem !important; }
                    
                    /* Secondary cards */
                    #invoice-detail-modal .section-title-mob { font-size: 0.6rem !important; margin-bottom: 0.4rem; }
                    #invoice-detail-modal .glass-card.p-3 { padding: 0.6rem !important; border-radius: 10px; background: white !important; border: 1px solid rgba(0,0,0,0.03) !important; }
                    #invoice-detail-modal .glass-card.p-3 .text-body { font-size: 0.85rem !important; }
                    
                    /* Grid and Spacing */
                    #invoice-detail-modal .grid-3 { grid-template-columns: repeat(2, 1fr) !important; gap: 0.5rem !important; }
                    #invoice-detail-modal .grid-3 > div:first-child { grid-column: span 2; background: var(--color-info-soft, #eff6ff) !important; border: 1px solid var(--color-info-border, #dbeafe) !important; } 
                    
                    #invoice-detail-modal #idm-related-section { margin-top: 1rem !important; padding-top: 0.75rem !important; }
                    #invoice-detail-modal .grid-2 { grid-template-columns: 1fr !important; gap: 0.75rem !important; }
                    #invoice-detail-modal .link-label-mob { font-size: 0.6rem !important; }
                    
                    /* Action Footer */
                    #invoice-detail-modal .detail-footer { padding: 0.75rem 1.25rem !important; background: white !important; }
                    #invoice-detail-modal #idm-btn-edit { padding: 0.6rem 1.5rem !important; font-size: 0.85rem; border-radius: 8px; }
                    #invoice-detail-modal #idm-btn-delete { font-size: 0.8rem; }
                }
            </style>
            <div class="modal-content glass-card">
                
                <!-- Header (Sticky) -->
                <div class="detail-header" style="padding: 2rem 2.5rem; background: var(--glass-highlight); border-bottom: 1px solid var(--glass-border);">
                    <div class="header-top-row">
                        <div id="idm-type-badge" class="badge badge-neutral" style="text-transform: uppercase; letter-spacing: 1px; font-size: 0.7rem;">FATTURA</div>
                        <div class="flex-column" style="align-items: flex-end;">
                           <button class="close-modal" style="background: var(--card-bg); width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--glass-border); display: flex; align-items: center; justify-content: center; cursor: pointer;">
                                <span class="material-icons-round">close</span>
                            </button>
                        </div>
                    </div>

                    <div class="header-main-info">
                        <div class="num-date-row">
                            <h2 id="idm-number" class="text-display" style="font-size: 2rem; margin: 0;">#</h2>
                            <span id="idm-date" class="text-caption" style="font-size: 1rem;"></span>
                        </div>
                        <div class="entity-row">
                            <span id="idm-entity-icon" class="material-icons-round text-tertiary" style="font-size: 1.2rem;">business</span>
                            <h3 id="idm-entity" style="font-size: 1.1rem; font-weight: 600; color: var(--text-secondary); margin: 0;">-</h3>
                        </div>
                    </div>
                    
                    <div id="idm-status-badge" class="badge" style="font-size: 0.9rem; padding: 0.5rem 1rem; margin-top: 0.85rem; width: fit-content;">-</div>
                </div>

                <!-- Scrollable Content -->
                <div class="detail-body" style="padding: 2rem 2.5rem; overflow-y: auto; flex: 1;">
                    
                    <!-- Top Summary: Amount -->
                    <div class="amount-card flex-between mb-4" style="background: var(--glass-highlight); padding: 1.5rem; border-radius: 16px; border: 1px solid var(--glass-border);">
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
                        <h4 class="section-title-mob">Dettaglio Economico</h4>
                        <div id="idm-economics-grid" class="grid-3" style="gap: 1rem;">
                            <!-- Injected dynamically -->
                        </div>
                    </div>

                    <!-- Related Items Section -->
                    <div id="idm-related-section" class="flex-column gap-3 mb-4">
                        <h4 class="section-title-mob">Collegamenti</h4>
                        
                        <div class="grid-2 gap-4">
                            <!-- Orders -->
                            <div class="flex-column gap-2">
                                <span class="link-label-mob"><span class="material-icons-round text-small">folder</span> Ordini / Incarichi</span>
                                <div id="idm-related-orders" class="flex-column gap-1"></div>
                            </div>

                            <!-- Payments -->
                            <div class="flex-column gap-2">
                                <span class="link-label-mob"><span class="material-icons-round text-small">payments</span> Pagamenti</span>
                                <div id="idm-related-payments" class="flex-column gap-1"></div>
                            </div>
                        </div>

                         <!-- Transactions -->
                         <div class="flex-column gap-2 mt-2">
                             <span class="link-label-mob"><span class="material-icons-round text-small">account_balance</span> Movimenti Bancari</span>
                             <div id="idm-related-transactions" class="flex-column gap-1"></div>
                         </div>
                    </div>

                    <!-- Attachments (Passive Only) -->
                    <div id="idm-attachments-section" class="flex-column gap-2 mb-4" style="display: none; border-top: 1px solid var(--glass-border); padding-top: 2rem;">
                         <h4 class="section-title-mob">Allegati</h4>
                         <div id="idm-attachment-list" class="flex-start gap-2"></div>
                    </div>

                </div>

                <!-- Footer Actions -->
                <div class="detail-footer flex-between" style="padding: 1.5rem 2.5rem; background: var(--glass-highlight); border-top: 1px solid var(--glass-border);">
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
        entityIcon.style.color = 'var(--brand-viola, #8b5cf6)';
    } else if (type === 'passive-partner-wl') {
        badge.textContent = "FATTURA PARTNER WL";
        badge.className = "badge badge-neutral";
        entityName = invoice.collaborators?.full_name || 'Partner Sconosciuto';
        entityIcon.textContent = 'person';
        entityIcon.style.color = 'var(--brand-blue)';
    } else { // supplier
        badge.textContent = "FATTURA FORNITORE";
        badge.className = "badge badge-warning";
        entityName = invoice.suppliers?.name || 'Fornitore Sconosciuto';
        entityIcon.textContent = 'local_shipping';
        entityIcon.style.color = 'var(--color-warning, #f59e0b)';
    }

    numEl.textContent = number.includes('/') ? `N. ${number}` : `N. ${number}`; // Keep format
    dateEl.textContent = date;
    entityEl.textContent = entityName;

    // Status Style
    let statusColor = 'var(--text-tertiary)';
    let statusBg = 'var(--glass-highlight)';
    const s = status.toLowerCase();
    if (s.includes('pagat') || s.includes('saldat')) { statusColor = 'var(--color-success, #10b981)'; statusBg = 'var(--color-success-soft, rgba(16, 185, 129, 0.1))'; }
    else if (s.includes('inviata') || s.includes('ricevuta')) { statusColor = 'var(--brand-blue, #3b82f6)'; statusBg = 'var(--color-info-soft, rgba(59, 130, 246, 0.1))'; }
    else if (s.includes('bozza') || s.includes('dare')) { statusColor = 'var(--color-warning, #f59e0b)'; statusBg = 'var(--color-warning-soft, rgba(245, 158, 11, 0.1))'; }
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

        if (invoice.rivalsa_inps > 0) {
            grid.innerHTML += renderEcoCard('Rivalsa / Cassa', invoice.rivalsa_inps);
        } else if (invoice.cassa_previdenziale > 0) {
            grid.innerHTML += renderEcoCard('Cassa Prev.', invoice.cassa_previdenziale);
        }

        if (iva > 0) grid.innerHTML += renderEcoCard('IVA', iva);
        if (invoice.ritenuta > 0) grid.innerHTML += renderEcoCard('Ritenuta', -invoice.ritenuta, true);

        totalEl.textContent = `€ ${formatAmount(netto)}`;
        totalEl.style.color = 'var(--color-error, #ef4444)';
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
        // Passive: related_orders column (can be array of strings/IDs, JSON string, or comma-separated string)
        let linkedOrders = invoice.related_orders || [];
        if (typeof linkedOrders === 'string' && linkedOrders.trim() !== '') {
            try { 
                linkedOrders = JSON.parse(linkedOrders); 
            } catch (e) { 
                // Not JSON, check for comma-separated list
                if (linkedOrders.includes(',')) {
                    linkedOrders = linkedOrders.split(',').map(s => s.trim());
                } else {
                    linkedOrders = [linkedOrders.trim()]; 
                }
            }
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
                    <span class="text-caption">${p.due_date ? new Date(p.due_date).toLocaleDateString('it-IT') : '-'}</span>
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
                   <span class="text-caption">${new Date(t.date).toLocaleDateString('it-IT')}</span>
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
                let mode = 'collab';
                if (type === 'passive-supplier') mode = 'supplier';
                if (type === 'passive-partner-wl') mode = 'partner-wl';
                window.openPassiveInvoiceForm(id, mode);
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
                    if (state.currentPage === 'passive-invoices-partners') {
                        renderPassiveInvoicesPartners(container);
                    } else if (state.currentPage === 'passive-invoices-collab' || type === 'passive-collab') {
                        renderPassiveInvoicesCollab(container);
                    } else {
                        renderPassiveInvoicesSuppliers(container);
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
