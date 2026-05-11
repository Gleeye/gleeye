// Order edit modal (edita campi base ordine: titolo, cliente, importi, ecc.).
// Extracted from orders.js. Side effects on import:
//   - window.editOrder(orderId)
//
// Public exports:
//   - initOrderModal()

import { state } from '/js/modules/state.js?v=8000';
import { supabase } from '../../modules/config.js?v=8000';
import { formatAmount, showGlobalAlert, showConfirm, renderAvatar } from '../../modules/utils.js?v=8000';
import { updateOrder, deleteOrder, updateOrderEconomics, fetchOrders, fetchCollaborators, fetchPayments, fetchAssignments, fetchServices, upsertOrder, generateNextOrderNumber } from '../../modules/api.js?v=8000';
import { CustomSelect } from '../../components/CustomSelect.js?v=8000';

window.editOrder = (orderId) => {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;
    state.currentOrderId = orderId;
    const modal = document.getElementById('order-modal');
    if (!modal) return;

    document.getElementById('ord-title').value = order.title || '';
    document.getElementById('ord-number').value = order.order_number || '';
    document.getElementById('ord-date').value = order.order_date ? new Date(order.order_date).toISOString().split('T')[0] : '';
    document.getElementById('ord-status').value = order.status_works || 'in_svolgimento';
    document.getElementById('ord-offer-status').value = order.offer_status || 'in_lavorazione';

    modal.classList.add('active');
};

export function initOrderModal() {
    const existing = document.getElementById('order-modal');
    if (existing) return;

    document.body.insertAdjacentHTML('beforeend', `
        <div id="order-modal" class="modal">
            <div class="modal-content" style="max-width: 550px; padding: 2rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2rem;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(59, 130, 246, 0.1); display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons-round" style="color: var(--brand-blue);">edit_note</span>
                    </div>
                    <h2 style="margin: 0; font-family: var(--font-titles); font-weight: 700;">Modifica Ordine</h2>
                </div>

                <div style="display: flex; flex-direction: column; gap: 1.25rem; margin-bottom: 2rem;">
                    <div>
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Titolo Commessa</label>
                        <input type="text" id="ord-title" class="modal-input" style="width: 100%;" placeholder="Es: Logo Design Rebranding">
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">N. Ordine</label>
                            <input type="text" id="ord-number" class="modal-input" style="width: 100%;">
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Data Ordine</label>
                            <input type="date" id="ord-date" class="modal-input" style="width: 100%;">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Stato Offerta</label>
                            <select id="ord-offer-status" class="modal-input" style="width: 100%;">
                                <option value="in_lavorazione">In Lavorazione</option>
                                <option value="invio_programmato">Invio Programmato</option>
                                <option value="inviata">Inviata</option>
                                <option value="accettata">Offerta Accettata</option>
                                <option value="rifiutata">Offerta Rifiutata</option>
                            </select>
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Stato Lavori</label>
                            <select id="ord-status" class="modal-input" style="width: 100%;">
                                <option value="in_svolgimento">In Svolgimento</option>
                                <option value="da_iniziare">In Attesa</option>
                                <option value="completato">Completato</option>
                                <option value="annullato">Annullato</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="flex-end" style="gap: 1rem;">
                    <button class="primary-btn secondary" onclick="document.getElementById('order-modal').classList.remove('active')">Annulla</button>
                    <button class="primary-btn" id="btn-save-order">Aggiorna Ordine</button>
                </div>
            </div>
        </div>
    `);

    document.getElementById('btn-save-order').addEventListener('click', async () => {
        const orderId = state.currentOrderId;
        const updates = {
            title: document.getElementById('ord-title').value,
            order_number: document.getElementById('ord-number').value,
            order_date: document.getElementById('ord-date').value,
            offer_status: document.getElementById('ord-offer-status').value,
            status_works: document.getElementById('ord-status').value
        };

        try {
            await updateOrder(orderId, updates);
            showGlobalAlert('Ordine aggiornato con successo');
            document.getElementById('order-modal').classList.remove('active');
            await fetchOrders();
            renderOrderDetail(document.getElementById('content-area'), orderId);
        } catch (e) {
            showGlobalAlert('Errore durante l\'aggiornamento', 'error');
        }
    });
}
