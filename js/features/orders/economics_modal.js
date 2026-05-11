// Order economics modal (open/save totale lordo/netto della commessa).
// Extracted from orders.js. Side effects on import:
//   - window.editOrderEconomics(orderId)
//
// Public exports:
//   - initOrderEconomicsModal()

import { state } from '/js/modules/state.js?v=8000';
import { supabase } from '../../modules/config.js?v=8000';
import { formatAmount, showGlobalAlert, showConfirm, renderAvatar } from '../../modules/utils.js?v=8000';
import { updateOrder, deleteOrder, updateOrderEconomics, fetchOrders, fetchCollaborators, fetchPayments, fetchAssignments, fetchServices, upsertOrder, generateNextOrderNumber } from '../../modules/api.js?v=8000';
import { CustomSelect } from '../../components/CustomSelect.js?v=8000';

window.editOrderEconomics = function (orderId) {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;
    state.currentOrderId = orderId;
    const modal = document.getElementById('economics-modal');
    document.getElementById('eco-price').value = order.price_final || 0;
    document.getElementById('eco-cost').value = order.cost_final || 0;
    modal.classList.add('active');
};

export function initOrderEconomicsModal() {
    const existing = document.getElementById('economics-modal');
    if (existing) return;
    document.body.insertAdjacentHTML('beforeend', `
        <div id="economics-modal" class="modal">
            <div class="modal-content" style="max-width: 450px; padding: 2rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2rem;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(16, 185, 129, 0.1); display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons-round" style="color: #10b981;">account_balance_wallet</span>
                    </div>
                    <h2 style="margin: 0; font-family: var(--font-titles); font-weight: 700;">Dati Economici</h2>
                </div>

                <div style="display: flex; flex-direction: column; gap: 1.5rem; margin-bottom: 2rem;">
                    <div>
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Prezzo Finale (€)</label>
                        <div style="position: relative;">
                            <span class="material-icons-round" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); font-size: 1.2rem; color: #10b981;">trending_up</span>
                            <input type="number" id="eco-price" class="modal-input" style="width: 100%; padding-left: 3rem;" placeholder="0.00">
                        </div>
                        <p style="font-size: 0.65rem; color: var(--text-tertiary); margin-top: 0.4rem;">Il prezzo definitivo concordato con il cliente.</p>
                    </div>

                    <div>
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Costo Finale (€)</label>
                        <div style="position: relative;">
                            <span class="material-icons-round" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); font-size: 1.2rem; color: #ef4444;">trending_down</span>
                            <input type="number" id="eco-cost" class="modal-input" style="width: 100%; padding-left: 3rem;" placeholder="0.00">
                        </div>
                        <p style="font-size: 0.65rem; color: var(--text-tertiary); margin-top: 0.4rem;">Il costo totale effettivo sostenuto per la commessa.</p>
                    </div>
                </div>

                <div class="flex-end" style="gap: 1rem;">
                    <button class="primary-btn secondary" onclick="document.getElementById('economics-modal').classList.remove('active')">Annulla</button>
                    <button class="primary-btn" id="btn-save-economics">Salva Modifiche</button>
                </div>
            </div>
        </div>
    `);

    document.getElementById('btn-save-economics').addEventListener('click', async () => {
        const orderId = state.currentOrderId;
        try {
            await updateOrderEconomics(orderId, { price_final: parseFloat(document.getElementById('eco-price').value), cost_final: parseFloat(document.getElementById('eco-cost').value) });
            showGlobalAlert('Aggiornato');
            document.getElementById('economics-modal').classList.remove('active');
            renderOrderDetail(document.getElementById('content-area'), orderId);
            await fetchOrders();
        } catch (e) { showGlobalAlert('Errore', 'error'); }
    });
}
