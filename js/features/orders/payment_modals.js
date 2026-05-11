// Order payment modals: init payment generation modal + manual payment modal.
// Extracted from orders.js.
//
// Public exports:
//   - initOrderPaymentModals()
//   - renderManualPaymentModal()

import { state } from '/js/modules/state.js?v=8000';
import { supabase } from '../../modules/config.js?v=8000';
import { formatAmount, showGlobalAlert, showConfirm, renderAvatar } from '../../modules/utils.js?v=8000';
import { updateOrder, fetchOrders, fetchPayments, fetchCollaborators, fetchServices, addOrderAccount, removeOrderAccount, fetchOrderAccounts, addOrderContact, removeOrderContact, fetchOrderContacts, upsertPayment, deletePayment, updateOrderCloudLinks } from '../../modules/api.js?v=8000';
import { CustomSelect } from '../../components/CustomSelect.js?v=8000';

import { calculateProposedOrderPayments } from './payment_config.js?v=8000';

export function initOrderPaymentModals() {
    const existing = document.getElementById('payment-gen-modal');
    if (existing) return;
    document.body.insertAdjacentHTML('beforeend', `
        <div id="payment-gen-modal" class="modal">
            <div class="modal-content" style="max-width: 500px; padding: 2rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2rem;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(59, 130, 246, 0.1); display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons-round" style="color: var(--brand-blue);">payment</span>
                    </div>
                    <h2 style="margin: 0; font-family: var(--font-titles); font-weight: 700;">Genera Piano Pagamenti</h2>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 1.25rem; margin-bottom: 2rem;">
                    <div>
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform: uppercase;">Modalità</label>
                        <select id="pg-mode" class="modal-input" style="width: 100%;">
                            <option value="saldo">Saldo Completo</option>
                            <option value="anticipo_saldo">Anticipo e Saldo</option>
                            <option value="anticipo_rate">Anticipo + Rate</option>
                            <option value="rate">Rate</option>
                            <option value="as_rate">Anticipo + Saldo + Rate</option>
                        </select>
                    </div>

                    <div id="pg-field-deposit" style="display: none;">
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform: uppercase;">Anticipo (%)</label>
                        <input type="number" id="pg-deposit" class="modal-input" value="30" style="width: 100%;">
                    </div>

                    <div id="pg-field-balance" style="display: none;">
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform: uppercase;">Saldo (%)</label>
                        <input type="number" id="pg-balance" class="modal-input" value="20" style="width: 100%;">
                    </div>

                    <div id="pg-field-rate" style="display: none; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform: uppercase;">N. Rate</label>
                            <input type="number" id="pg-rate-count" class="modal-input" value="3" style="width: 100%;">
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform: uppercase;">Frequenza</label>
                            <select id="pg-rate-type" class="modal-input" style="width: 100%;">
                                <option value="Mensile">Mensile</option>
                                <option value="Bimestrale">Bimestrale</option>
                                <option value="Trimestrale">Trimestrale</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform: uppercase;">Data Primo Pagamento</label>
                        <input type="date" id="pg-start-date" class="modal-input" style="width: 100%;">
                    </div>
                </div>

                <div class="flex-end" style="gap: 1rem;">
                    <button class="primary-btn secondary" onclick="document.getElementById('payment-gen-modal').classList.remove('active')">Annulla</button>
                    <button class="primary-btn" id="pg-btn-confirm">Genera Ora</button>
                </div>
            </div>
        </div>
    `);

    const modal = document.getElementById('payment-gen-modal');

    // Toggle fields based on mode
    document.getElementById('pg-mode').addEventListener('change', (e) => {
        const mode = e.target.value;
        document.getElementById('pg-field-deposit').style.display = mode.includes('anticipo') || mode === 'as_rate' ? 'block' : 'none';
        document.getElementById('pg-field-balance').style.display = mode === 'as_rate' ? 'block' : 'none';
        document.getElementById('pg-field-rate').style.display = mode.includes('rate') ? 'grid' : 'none';
    });

    window.openPaymentGenerationModal = (orderId, total) => {
        state.currentOrderId = orderId;
        state.currentTotal = parseFloat(total);

        const order = state.orders.find(o => o.id === orderId);
        if (order) {
            document.getElementById('pg-mode').value = order.payment_mode || 'saldo';
            document.getElementById('pg-deposit').value = order.deposit_percentage || 30;
            document.getElementById('pg-balance').value = order.balance_percentage || 20;
            document.getElementById('pg-rate-count').value = order.installments_count || 3;
            document.getElementById('pg-rate-type').value = order.installment_type || 'Mensile';
            // Trigger change to update visibility
            document.getElementById('pg-mode').dispatchEvent(new Event('change'));
        }

        document.getElementById('pg-start-date').value = new Date().toISOString().split('T')[0];
        modal.classList.add('active');
    };

    document.getElementById('pg-btn-confirm').addEventListener('click', async () => {
        const orderId = state.currentOrderId;
        const order = state.orders.find(o => o.id === orderId);
        if (!order) return;

        const config = {
            mode: document.getElementById('pg-mode').value,
            deposit_percentage: parseFloat(document.getElementById('pg-deposit').value),
            balance_percentage: parseFloat(document.getElementById('pg-balance').value),
            installments_count: parseInt(document.getElementById('pg-rate-count').value),
            installment_type: document.getElementById('pg-rate-type').value,
            startDate: document.getElementById('pg-start-date').value
        };

        try {
            const payments = calculateProposedOrderPayments(order, config);

            for (const p of payments) {
                await upsertPayment(p);
            }

            modal.classList.remove('active');
            // Re-render via hash to avoid cyclic import with orders.js
            window.location.hash = '#order-detail/' + orderId;
            showGlobalAlert(`Piano generato con ${payments.length} pagamenti!`, 'success');
        } catch (e) {
            console.error('Generation error:', e);
            showGlobalAlert('Errore generazione', 'error');
        }
    });
}

export function renderManualPaymentModal() {
    const existing = document.getElementById('payment-manual-modal');
    if (existing) return;
    document.body.insertAdjacentHTML('beforeend', `
        <div id="payment-manual-modal" class="modal">
            <div class="modal-content" style="max-width: 450px; padding: 2rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2rem;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(59, 130, 246, 0.1); display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons-round" style="color: var(--brand-blue);">add_card</span>
                    </div>
                    <h2 style="margin: 0; font-family: var(--font-titles); font-weight: 700;">Nuovo Pagamento</h2>
                </div>

                <div style="display: flex; flex-direction: column; gap: 1.25rem; margin-bottom: 2rem;">
                    <div>
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Descrizione</label>
                        <input type="text" id="pm-desc" class="modal-input" placeholder="Es: Acconto 30%" style="width: 100%;">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Importo (€)</label>
                            <input type="number" id="pm-amount" class="modal-input" placeholder="0.00" style="width: 100%;">
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Scadenza</label>
                            <input type="date" id="pm-date" class="modal-input" style="width: 100%;">
                        </div>
                    </div>
                </div>

                <div class="flex-end" style="gap: 1rem;">
                    <button class="primary-btn secondary" onclick="document.getElementById('payment-manual-modal').classList.remove('active')">Annulla</button>
                    <button class="primary-btn" id="pm-btn-save">Registra Pagamento</button>
                </div>
            </div>
        </div>
    `);

    let currentOrder, currentClient;
    window.openManualPaymentModal = (oid, cid) => { currentOrder = oid; currentClient = cid; document.getElementById('payment-manual-modal').classList.add('active'); };
    document.getElementById('pm-btn-save').addEventListener('click', async () => {
        try {
            await upsertPayment({ title: document.getElementById('pm-desc').value, amount: parseFloat(document.getElementById('pm-amount').value), due_date: document.getElementById('pm-date').value, status: 'To Do', payment_type: 'Cliente', order_id: currentOrder, client_id: currentClient });
            document.getElementById('payment-manual-modal').classList.remove('active');
            // Re-render via hash to avoid cyclic import with orders.js
            window.location.hash = '#order-detail/' + currentOrder;
            showGlobalAlert('Aggiunto!');
        } catch (e) { showGlobalAlert('Errore', 'error'); }
    });
}
