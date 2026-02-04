import { state } from '../modules/state.js?v=156';
import { formatAmount, showGlobalAlert } from '../modules/utils.js?v=156';
import { upsertPayment, deletePayment, upsertBankTransaction, fetchPayments } from '../modules/api.js?v=156';

export function renderPaymentsDashboard(container) {
    // Ensure global assignment on load/render
    if (typeof window !== 'undefined') {
        window.openPaymentModal = openPaymentModal;
        console.log("openPaymentModal assigned to window from renderPaymentsDashboard");
    }

    if (!state.payments) state.payments = [];

    // Setup state filters if not exists
    if (!state.paymentsFilterType) state.paymentsFilterType = 'all';

    const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

    const updateUI = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Filter: Status not completed (show all pending states)
        let items = state.payments.filter(p => p.status !== 'Completato' && p.status !== 'Done');

        // Filter by Type (Entrate vs Uscite)
        if (state.paymentsFilterType === 'entrate') {
            items = items.filter(p => p.payment_type === 'Cliente');
        } else if (state.paymentsFilterType === 'uscite') {
            items = items.filter(p => p.payment_type !== 'Cliente');
        }

        // Calculate Overview Metrics
        const allToDo = state.payments.filter(p => p.status !== 'Completato' && p.status !== 'Done');
        const entrateTotal = allToDo.filter(p => p.payment_type === 'Cliente').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const usciteTotal = allToDo.filter(p => p.payment_type !== 'Cliente').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const nettoTotal = entrateTotal - usciteTotal;


        // Grouping
        const overdue = [];
        const nodate = [];
        const scheduled = [];

        items.forEach(p => {
            if (!p.due_date) {
                nodate.push(p);
            } else {
                const d = new Date(p.due_date);
                if (d < today) overdue.push(p);
                else scheduled.push(p);
            }
        });

        // Sort scheduled by date
        scheduled.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
        overdue.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

        const renderCard = (p) => {
            const dateObj = p.due_date ? new Date(p.due_date) : null;
            const isOverdue = dateObj && dateObj < today;
            const isIncoming = p.payment_type === 'Cliente';

            // Determine entity based on payment_type (Active = Client, Passive = Collab/Supplier)
            let entity = '';
            if (p.payment_type === 'Cliente') {
                entity = p.clients?.business_name || 'Cliente';
            } else if (p.payment_type === 'Collaboratore') {
                entity = p.collaborators?.full_name || 'Collaboratore';
            } else if (p.payment_type === 'Fornitore') {
                entity = p.suppliers?.name || 'Fornitore';
            } else {
                // Fallback for other types or missing data
                entity = p.clients?.business_name || p.collaborators?.full_name || p.suppliers?.name || '';
            }

            const description = p.title || 'Pagamento';
            const orderCode = p.orders?.order_number || '';

            // Minimal color approach: subtle indicators only
            const statusDotColor = isIncoming ? 'rgba(16, 185, 129, 0.4)' : 'rgba(220, 38, 38, 0.4)';
            const sign = isIncoming ? '+' : '-';
            const amountColor = 'var(--text-primary)'; // Neutral color for amounts

            // Neutral date badge - no strong colors
            const dateBgColor = 'var(--glass-highlight)';
            const dateTextColor = 'var(--text-primary)';

            let dateBadgeHTML = '';
            if (dateObj) {
                const day = dateObj.getDate();
                const month = monthNames[dateObj.getMonth()].toUpperCase();
                const year = dateObj.getFullYear();

                dateBadgeHTML = `
                    <div style="
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        padding: 0.5rem 0.65rem;
                        border-radius: 12px;
                        background: ${dateBgColor};
                        border: 1px solid var(--glass-border);
                        min-width: 52px;
                    ">
                        <div style="font-size: 1.3rem; font-weight: 700; line-height: 1; color: ${dateTextColor};">${day}</div>
                        <div style="font-size: 0.7rem; font-weight: 600; line-height: 1.2; color: ${dateTextColor}; margin-top: 2px;">${month}</div>
                        <div style="font-size: 0.65rem; font-weight: 500; line-height: 1; color: var(--text-tertiary); margin-top: 3px; opacity: 0.7;">${year}</div>
                    </div>
                `;
            } else {
                dateBadgeHTML = `
                    <div style="
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        padding: 0.5rem 0.65rem;
                        border-radius: 12px;
                        background: ${dateBgColor};
                        border: 1px solid var(--glass-border);
                        min-width: 52px;
                        font-size: 0.7rem;
                    ">
                        <div style="font-size: 1.3rem; font-weight: 700; line-height: 1; color: ${dateTextColor};">--</div>
                        <div style="font-size: 0.7rem; font-weight: 600; line-height: 1.2; color: ${dateTextColor}; margin-top: 2px;">N/D</div>
                        <div style="font-size: 0.65rem; font-weight: 500; line-height: 1; color: var(--text-tertiary); margin-top: 3px; opacity: 0.7;">----</div>
                    </div>
                `;
            }

            // Tooltip content for order code
            const orderTooltip = p.orders ? `
                <div style="font-weight: 600; margin-bottom: 0.25rem;">${p.orders.title || 'N/A'}</div>
                <div style="font-size: 0.85rem; opacity: 0.8;">${p.clients?.business_name || 'N/A'}</div>
            ` : '';

            return `
                <div class="glass-card clickable-card" style="padding: 1rem 1.25rem; margin-bottom: 0.75rem; display: flex; gap: 1rem; align-items: center;" onclick="openPaymentModal('${p.id}')">
                    
                    <!-- Date Badge -->
                    ${dateBadgeHTML}
                    
                    <!-- Content: Entity (PRIMARY), Description, Order -->
                    <div class="flex-column" style="flex: 1; min-width: 0; gap: 0.35rem;">
                        <div class="text-body text-truncate" style="font-weight: 600; font-size: 1rem; color: var(--text-primary);" title="${entity}">${entity}</div>
                        <div class="text-caption text-truncate" style="opacity: 0.65; font-size: 0.85rem;">${description}</div>
                        ${orderCode ? `
                            <div class="payment-order-code" style="position: relative; width: fit-content;">
                                <div class="text-caption" style="opacity: 0.6; font-size: 0.75rem; cursor: help;">Ordine: ${orderCode}</div>
                                ${orderTooltip ? `
                                    <div class="order-tooltip" style="
                                        position: absolute;
                                        bottom: calc(100% + 8px);
                                        left: 0;
                                        background: var(--card-bg);
                                        border: 1px solid var(--glass-border);
                                        border-radius: 12px;
                                        padding: 0.75rem 1rem;
                                        box-shadow: var(--shadow-premium);
                                        backdrop-filter: blur(20px);
                                        opacity: 0;
                                        visibility: hidden;
                                        transition: all 0.2s ease;
                                        pointer-events: none;
                                        z-index: 1000;
                                        min-width: 200px;
                                        white-space: normal;
                                    ">
                                        ${orderTooltip}
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>

                    <!-- Amount with subtle dot indicator -->
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                        <div style="width: 6px; height: 6px; background: ${statusDotColor}; border-radius: 50%;"></div>
                        <div style="font-weight: 600; font-size: 1rem; color: ${amountColor};">${sign} € ${formatAmount(p.amount)}</div>
                    </div>

                </div>
            `;
        };

        const renderSection = (title, icon, color, items) => {
            if (items.length === 0) return '';
            return `
                <div class="flex-column" style="background: var(--card-bg); border-radius: 16px; padding: 1.5rem; border: 1px solid var(--glass-border); gap: 1rem; height: 100%;">
                    <h3 class="flex-start" style="gap: 0.5rem; font-size: 1rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem;">
                        <span class="material-icons-round" style="color: ${color}; font-size: 1.2rem;">${icon}</span> ${title} <span class="badge badge-neutral" style="margin-left: auto;">${items.length}</span>
                    </h3>
                    <div style="overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; padding-right: 4px;">
                        ${items.map(renderCard).join('')}
                    </div>
                </div>
             `;
        };

        container.innerHTML = `
            <div class="animate-fade-in p-3" style="max-width: 1400px; margin: 0 auto; padding-bottom: 4rem;">
                <div class="flex-between mb-4">
                    <div>
                        <h2 class="text-display">Scadenziario</h2>
                        <span class="text-caption">Gestione flussi finanziari</span>
                    </div>
                    
                    <div class="pill-group">
                        <button class="pill-item ${state.paymentsFilterType === 'all' ? 'active' : ''}" data-type="all">Tutti</button>
                        <button class="pill-item ${state.paymentsFilterType === 'entrate' ? 'active' : ''}" data-type="entrate">Entrate</button>
                        <button class="pill-item ${state.paymentsFilterType === 'uscite' ? 'active' : ''}" data-type="uscite">Uscite</button>
                    </div>
                </div>

                <div class="grid-3 mb-4">
                    <div class="glass-card flex-column" style="gap: 1rem;">
                        <div class="flex-start" style="gap: 1rem;">
                            <div class="icon-container icon-success icon-container-sm">
                                <span class="material-icons-round">trending_up</span>
                            </div>
                            <div class="flex-column">
                                <div class="text-caption">Entrate Attese</div>
                                <div class="text-title" style="color: var(--text-primary); font-weight: 600;">€ ${formatAmount(entrateTotal)}</div>
                            </div>
                        </div>
                    </div>

                    <div class="glass-card flex-column" style="gap: 1rem;">
                        <div class="flex-start" style="gap: 1rem;">
                            <div class="icon-container icon-error icon-container-sm">
                                <span class="material-icons-round">trending_down</span>
                            </div>
                            <div class="flex-column">
                                <div class="text-caption">Uscite Attese</div>
                                <div class="text-title" style="color: var(--text-primary); font-weight: 600;">€ ${formatAmount(usciteTotal)}</div>
                            </div>
                        </div>
                    </div>

                    <div class="glass-card flex-column" style="gap: 1rem;">
                        <div class="flex-start" style="gap: 1rem;">
                            <div class="icon-container icon-info icon-container-sm">
                                <span class="material-icons-round">account_balance</span>
                            </div>
                            <div class="flex-column">
                                <div class="text-caption">Flusso Netto</div>
                                <div class="text-title" style="color: var(--text-primary); font-weight: 600;">${nettoTotal >= 0 ? '+' : ''} € ${formatAmount(nettoTotal)}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="grid-3" style="align-items: start;">
                    ${renderSection('In Ritardo', 'warning', 'var(--error-soft)', overdue)}
                    ${renderSection('Senza Data', 'help_outline', 'var(--text-tertiary)', nodate)}
                    ${renderSection('In Programma', 'event_available', 'var(--success-soft)', scheduled)}
                </div>
            </div>
        `;

        container.querySelectorAll('.pill-item').forEach(btn => {
            btn.addEventListener('click', () => {
                state.paymentsFilterType = btn.dataset.type;
                updateUI();
            });
        });
    };

    updateUI();
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
                        <div class="flex-between" style="align-items: flex-start; gap: 2rem;">
                            <div class="flex-column" style="gap: 0.75rem; flex: 1;">
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
                            
                            <div class="grid-2" style="gap: 1.5rem;">
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
                            
                            <div class="grid-2" style="gap: 1.5rem;">
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
            console.log("Saving payment updates...", updates);
            await upsertPayment(updates);
            console.log("Payment updated successfully.");

            // 1. Close edit sub-modal
            editModal.classList.remove('active');

            // 2. Refresh info modal content (underneath)
            openPaymentModal(p.id);

            // 3. Global background refresh
            window.dispatchEvent(new HashChangeEvent("hashchange"));

            showGlobalAlert('Pagamento aggiornato');
        } catch (e) {
            console.error("Error saving payment update:", e);
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

    // document.getElementById('pm-btn-delete').addEventListener('click', async () => await handlePaymentDelete());
}

window.handlePaymentDelete = handlePaymentDelete;

export function openPaymentModal(id) {
    console.log("openPaymentModal called with ID:", id);
    if (typeof window !== 'undefined') window.openPaymentModal = openPaymentModal;

    // Debug state
    console.log("Current state.payments count:", state.payments ? state.payments.length : 0);

    state.currentPaymentId = id;
    const p = state.payments.find(x => x.id === id);

    if (!p) {
        console.error("Payment not found in state:", id, state.payments);
        return;
    }
    console.log("Payment found:", p);

    const modal = document.getElementById('payment-modal');
    if (!modal) {
        console.error("Payment modal element not found!");
        return;
    }

    // Construct Full Payment Code (Name from CSV: e.g., "Saldo 25-0025 WILLY")
    let paymentCode = p.title || 'Pagamento';
    if (p.orders?.order_number) {
        paymentCode += ` ${p.orders.order_number}`;
    }
    // Add entity name
    let entityName = '';
    if (p.payment_type === 'Cliente' && p.clients?.business_name) {
        entityName = p.clients.business_name;
    } else if (p.payment_type === 'Collaboratore' && p.collaborators?.full_name) {
        entityName = p.collaborators.full_name;
    } else if (p.payment_type === 'Fornitore' && p.suppliers?.name) {
        entityName = p.suppliers.name;
    }
    if (entityName) {
        paymentCode += ` ${entityName}`;
    }

    document.getElementById('pm-code-badge').textContent = paymentCode;

    // Subject & Icon
    let subject = 'N/A';
    let icon = 'help_outline';
    if (p.payment_type === 'Cliente') {
        subject = p.clients?.business_name || 'Cliente';
        icon = 'business';
    } else if (p.payment_type === 'Collaboratore') {
        subject = p.collaborators?.full_name || 'Collaboratore';
        icon = 'person';
    } else if (p.payment_type === 'Fornitore') {
        subject = p.suppliers?.name || 'Fornitore';
        icon = 'local_shipping';
    }
    document.getElementById('pm-subject').textContent = subject;
    document.getElementById('pm-subject-icon').textContent = icon;

    // Amount
    const isIncoming = p.payment_type === 'Cliente';
    const amountVal = formatAmount(p.amount);
    document.getElementById('pm-amount').textContent = `${isIncoming ? '+' : '-'} € ${amountVal}`;
    document.getElementById('pm-amount').style.color = isIncoming ? 'var(--success-soft)' : 'var(--error-soft)';

    // Invoicing Action
    const actionDiv = document.getElementById('pm-invoice-action');
    if (isIncoming) {
        if (p.invoices?.id || p.invoice_id) {
            actionDiv.innerHTML = `<button class="badge badge-success" style="cursor: pointer; border: 1px solid rgba(16, 185, 129, 0.2);"><span class="material-icons-round text-small">receipt</span> Fattura ${p.invoices?.invoice_number || ''}</button>`;
        } else {
            actionDiv.innerHTML = `<button class="primary-btn" style="padding: 0.5rem 1rem; font-size: 0.8rem; border-radius: 8px;"><span class="material-icons-round" style="font-size: 1rem;">add</span> Emetti Fattura</button>`;
        }
    } else {
        // Passive payment flow
        if (p.passive_invoices?.id || p.passive_invoice_id || p.invoice_id) {
            // Invoice linked - show badge
            actionDiv.innerHTML = `<button class="badge badge-warning" style="cursor: pointer; border: 1px solid rgba(245, 158, 11, 0.2);"><span class="material-icons-round text-small">receipt_long</span> Fattura ${p.passive_invoices?.invoice_number || ''}</button>`;
        } else if (p.status === 'Da Fare' || p.status === 'To Do' || !p.status) {
            // No invite sent yet - show "Invia Invito" button
            actionDiv.innerHTML = `<button class="primary-btn" id="btn-send-invite" style="padding: 0.5rem 1rem; font-size: 0.8rem; border-radius: 8px; background: #f59e0b;"><span class="material-icons-round" style="font-size: 1rem;">send</span> Invia Invito a Fatturare</button>`;
            setTimeout(() => {
                const inviteBtn = document.getElementById('btn-send-invite');
                if (inviteBtn) {
                    inviteBtn.addEventListener('click', async () => {
                        try {
                            const { supabase } = await import('../modules/config.js?v=156');
                            await supabase.rpc('send_payment_invite', { p_payment_id: p.id });
                            // Refresh payments and reopen modal
                            await fetchPayments();
                            openPaymentModal(p.id);
                            showGlobalAlert('Invito inviato al collaboratore!', 'success');
                        } catch (e) {
                            showGlobalAlert('Errore invio invito: ' + e.message, 'error');
                        }
                    });
                }
            }, 0);
        } else if (p.status === 'Invito Inviato') {
            // Waiting for collaborator to send invoice
            actionDiv.innerHTML = `<button class="badge" style="background: #fef3c7; color: #b45309; cursor: default; border: 1px solid rgba(245, 158, 11, 0.2);"><span class="material-icons-round text-small">hourglass_top</span> In attesa fattura</button>`;
        } else {
            actionDiv.innerHTML = `<button class="primary-btn" style="padding: 0.5rem 1rem; font-size: 0.8rem; border-radius: 8px;"><span class="material-icons-round" style="font-size: 1rem;">upload</span> Registra Fattura</button>`;
        }
    }

    // Info Content
    document.getElementById('info-desc').textContent = p.title || '-';
    document.getElementById('info-date').textContent = p.due_date ? new Date(p.due_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Nessuna data';
    document.getElementById('info-mode').textContent = p.payment_mode || 'Rata';
    document.getElementById('info-type').textContent = p.payment_type || '-';
    // Status badge with color
    const statusEl = document.getElementById('info-status');
    const statusMap = {
        'Da Fare': { label: 'Da Fare', color: '#6b7280' },
        'Invito Inviato': { label: 'Invito Inviato', color: '#f59e0b' },
        'In Attesa': { label: 'In Attesa', color: '#3b82f6' },
        'Completato': { label: 'Completato', color: '#22c55e' },
        'Done': { label: 'Completato', color: '#22c55e' },
        'To Do': { label: 'Da Fare', color: '#6b7280' }
    };
    const statusInfo = statusMap[p.status] || { label: p.status || 'N/A', color: '#6b7280' };
    statusEl.innerHTML = `<span style="display: inline-flex; align-items: center; gap: 0.4rem;"><span style="width: 8px; height: 8px; border-radius: 50%; background: ${statusInfo.color};"></span>${statusInfo.label}</span>`;

    // Details Content
    document.getElementById('det-order-num').textContent = p.orders?.order_number || 'N/A';
    document.getElementById('det-client').textContent = p.clients?.business_name || '-';
    document.getElementById('det-order-title').textContent = p.orders?.title || 'N/A';

    // Notes Content
    document.getElementById('pm-notes-input').value = p.notes || '';

    modal.classList.add('active');
}

async function handlePaymentDelete() {
    console.log("[Payments] handlePaymentDelete triggered. state.currentPaymentId:", state.currentPaymentId);
    if (!state.currentPaymentId) {
        console.warn("[Payments] No currentPaymentId found");
        return;
    }

    try {
        const confirmed = await window.showConfirm('Eliminare definitivamente questo pagamento?', { type: 'danger' });
        console.log("[Payments] Confirmation result:", confirmed);

        if (!confirmed) return;

        await deletePayment(state.currentPaymentId);
        document.getElementById('payment-modal').classList.remove('active');
        showGlobalAlert('Pagamento eliminato');
    } catch (err) {
        showGlobalAlert('Errore eliminazione', 'error');
    }
}
// Make available globally for onclick handlers
if (typeof window !== 'undefined') {
    window.openPaymentModal = openPaymentModal;
}
