// Order payment configuration UI + state.
// Extracted from orders.js (Fase split-monstro su orders).
//
// Public exports:
//   - formatPaymentMode(mode)              maps DB enum to italian label
//   - calculateProposedOrderPayments(order, config)
//   - renderOrderPaymentConfigUI(order)    dispatcher display vs edit
//   - renderOrderPaymentConfigDisplay(order)
//   - renderOrderPaymentConfigEdit(order)
//
// Side effects on import:
//   - window.orderConfigEditState = {}
//   - window.toggleOrderConfigFields(orderId)
//   - window.toggleOrderConfigEdit(orderId, isEdit)
//   - window.saveOrderConfig(orderId)
//
// External deps:
//   - state, supabase, formatAmount, showGlobalAlert
//   - updateOrder, fetchOrders from api.js
//   - CustomSelect from components

import { state } from '/js/modules/state.js?v=8000';
import { supabase } from '../../modules/config.js?v=8000';
import { formatAmount, showGlobalAlert } from '../../modules/utils.js?v=8000';
import { updateOrder, fetchOrders } from '../../modules/api.js?v=8000';
import { CustomSelect } from '../../components/CustomSelect.js?v=8000';

// Order Payment Config
window.orderConfigEditState = {};

export function formatPaymentMode(mode) {
    const map = {
        'saldo': 'Saldo Completo',
        'rate': 'Rate',
        'anticipo_rate': 'Anticipo + Rate',
        'anticipo_saldo': 'Anticipo + Saldo',
        'as_rate': 'Anticipo + Rate + Saldo'
    };
    return map[mode] || mode || 'Non configurato';
}

export function calculateProposedOrderPayments(order, config) {
    const startDate = config.startDate ? new Date(config.startDate) : new Date();
    const mode = config.mode || order.payment_mode || 'saldo';
    const total = parseFloat(order.price_final || order.total_price) || 0;
    const payments = [];

    const getDueDate = (index, freq = 'Mensile') => {
        const d = new Date(startDate);
        let monthsToAdd = 1;
        if (freq === 'Bimestrale') monthsToAdd = 2;
        if (freq === 'Trimestrale') monthsToAdd = 3;
        if (freq === 'Semestrale') monthsToAdd = 6;
        if (freq === 'Annuale') monthsToAdd = 12;

        d.setMonth(d.getMonth() + (index * monthsToAdd));
        return d.toISOString().split('T')[0];
    };

    if (mode === 'saldo') {
        payments.push({
            title: 'Saldo Complessivo',
            amount: total,
            due_date: getDueDate(0),
            status: 'Da Fare',
            payment_type: 'Cliente',
            order_id: order.id,
            client_id: order.client_id
        });
    } else if (mode === 'anticipo_saldo') {
        const pct = config.deposit_percentage || order.deposit_percentage || 30;
        const deposit = total * (pct / 100);
        payments.push({
            title: `Anticipo(${pct} %)`,
            amount: deposit,
            due_date: getDueDate(0),
            status: 'Da Fare',
            payment_type: 'Cliente',
            order_id: order.id,
            client_id: order.client_id
        });
        payments.push({
            title: 'Saldo Finale',
            amount: total - deposit,
            due_date: getDueDate(1),
            status: 'Da Fare',
            payment_type: 'Cliente',
            order_id: order.id,
            client_id: order.client_id
        });
    } else if (mode === 'rate') {
        const n = config.installments_count || order.installments_count || 3;
        const val = total / n;
        for (let i = 0; i < n; i++) {
            payments.push({
                title: `Rata ${i + 1}/${n}`,
                amount: val,
                due_date: getDueDate(i, config.installment_type || order.installment_type),
                status: 'Da Fare',
                payment_type: 'Cliente',
                order_id: order.id,
                client_id: order.client_id
            });
        }
    } else if (mode === 'anticipo_rate') {
        const pct = config.deposit_percentage || order.deposit_percentage || 30;
        const deposit = total * (pct / 100);
        const rest = total - deposit;
        const n = config.installments_count || order.installments_count || 3;
        const val = rest / n;

        payments.push({
            title: `Anticipo (${pct}%)`,
            amount: deposit,
            due_date: getDueDate(0),
            status: 'Da Fare',
            payment_type: 'Cliente',
            order_id: order.id,
            client_id: order.client_id
        });

        for (let i = 0; i < n; i++) {
            payments.push({
                title: `Rata ${i + 1}/${n}`,
                amount: val,
                due_date: getDueDate(i + 1, config.installment_type || order.installment_type),
                status: 'Da Fare',
                payment_type: 'Cliente',
                order_id: order.id,
                client_id: order.client_id
            });
        }
    } else if (mode === 'as_rate') {
        const pct = config.deposit_percentage || order.deposit_percentage || 20;
        const balPct = config.balance_percentage || order.balance_percentage || 20;
        const deposit = total * (pct / 100);
        const balance = total * (balPct / 100);
        const rest = total - deposit - balance;
        const n = config.installments_count || order.installments_count || 3;
        const val = rest / n;

        payments.push({
            title: `Anticipo (${pct}%)`,
            amount: deposit,
            due_date: getDueDate(0),
            status: 'Da Fare',
            payment_type: 'Cliente',
            order_id: order.id,
            client_id: order.client_id
        });

        for (let i = 0; i < n; i++) {
            payments.push({
                title: `Rata ${i + 1}/${n}`,
                amount: val,
                due_date: getDueDate(i + 1, config.installment_type || order.installment_type),
                status: 'Da Fare',
                payment_type: 'Cliente',
                order_id: order.id,
                client_id: order.client_id
            });
        }

        payments.push({
            title: `Saldo Finale (${balPct}%)`,
            amount: balance,
            due_date: getDueDate(n + 1),
            status: 'Da Fare',
            payment_type: 'Cliente',
            order_id: order.id,
            client_id: order.client_id
        });
    }
    return payments;
}

export function renderOrderPaymentConfigUI(order) {
    if (window.orderConfigEditState[order.id]) return renderOrderPaymentConfigEdit(order);
    return renderOrderPaymentConfigDisplay(order);
}

export function renderOrderPaymentConfigDisplay(order) {
    return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: rgba(0,0,0,0.02); border-radius: 8px;">
            <div style="font-size: 0.75rem; font-weight: 600;">${formatPaymentMode(order.payment_mode)}</div>
            <button onclick="window.toggleOrderConfigEdit('${order.id}', true)" style="background:none; border:none; cursor:pointer;"><span class="material-icons-round" style="font-size: 1rem;">edit</span></button>
        </div>
        <button onclick="window.openPaymentGenerationModal('${order.id}', '${order.price_final || order.total_price}')" style="width: 100%; margin-top: 0.5rem; padding: 0.5rem; background: var(--brand-gradient); color: white; border: none; border-radius: 8px; font-size: 0.75rem; cursor: pointer;">Genera Piano</button>
    `;
}

export function renderOrderPaymentConfigEdit(order) {
    const currentMode = order.payment_mode || 'saldo';
    return `
        <div style="background: var(--bg-secondary); padding: 0.75rem; border-radius: 8px; border: 1px solid var(--brand-blue);">
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                <div>
                    <label style="font-size: 0.65rem; text-transform: uppercase; color: var(--text-tertiary); font-weight: 700; display: block; margin-bottom: 0.25rem;">Modalità</label>
                    <select id="ord-pay-mode-${order.id}" class="modal-input small" style="font-size: 0.75rem; width: 100%;" onchange="window.toggleOrderConfigFields('${order.id}')">
                        <option value="saldo" ${currentMode === 'saldo' ? 'selected' : ''}>Saldo Completo</option>
                        <option value="anticipo_saldo" ${currentMode === 'anticipo_saldo' ? 'selected' : ''}>Anticipo + Saldo</option>
                        <option value="anticipo_rate" ${currentMode === 'anticipo_rate' ? 'selected' : ''}>Anticipo + Rate</option>
                        <option value="rate" ${currentMode === 'rate' ? 'selected' : ''}>Rate</option>
                        <option value="as_rate" ${currentMode === 'as_rate' ? 'selected' : ''}>Anticipo + Rate + Saldo</option>
                    </select>
                </div>

                <div id="ord-config-dep-cnt-${order.id}" style="display: none;">
                    <label style="font-size: 0.65rem; text-transform: uppercase; color: var(--text-tertiary); font-weight: 700; display: block; margin-bottom: 0.25rem;">Anticipo (%)</label>
                    <input type="number" id="ord-pay-dep-${order.id}" class="modal-input small" value="${(order.deposit_percentage !== undefined && order.deposit_percentage !== null) ? order.deposit_percentage : 30}" style="width: 100%;">
                </div>

                <div id="ord-config-bal-cnt-${order.id}" style="display: none;">
                    <label style="font-size: 0.65rem; text-transform: uppercase; color: var(--text-tertiary); font-weight: 700; display: block; margin-bottom: 0.25rem;">Saldo (%)</label>
                    <input type="number" id="ord-pay-bal-${order.id}" class="modal-input small" value="${(order.balance_percentage !== undefined && order.balance_percentage !== null) ? order.balance_percentage : 20}" style="width: 100%;">
                </div>

                <div id="ord-config-rate-cnt-${order.id}" style="display: none; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                    <div>
                        <label style="font-size: 0.65rem; text-transform: uppercase; color: var(--text-tertiary); font-weight: 700; display: block; margin-bottom: 0.25rem;">N. Rate</label>
                        <input type="number" id="ord-pay-rate-count-${order.id}" class="modal-input small" value="${order.installments_count || 3}" style="width: 100%;">
                    </div>
                    <div>
                        <label style="font-size: 0.65rem; text-transform: uppercase; color: var(--text-tertiary); font-weight: 700; display: block; margin-bottom: 0.25rem;">Freq.</label>
                        <select id="ord-pay-rate-type-${order.id}" class="modal-input small" style="width: 100%;">
                            <option value="Mensile" ${order.installment_type === 'Mensile' ? 'selected' : ''}>Mensile</option>
                            <option value="Bimestrale" ${order.installment_type === 'Bimestrale' ? 'selected' : ''}>Bimestrale</option>
                            <option value="Trimestrale" ${order.installment_type === 'Trimestrale' ? 'selected' : ''}>Trimestrale</option>
                            <option value="Quadrimestrale" ${order.installment_type === 'Quadrimestrale' ? 'selected' : ''}>Quadrimestrale</option>
                            <option value="Semestrale" ${order.installment_type === 'Semestrale' ? 'selected' : ''}>Semestrale</option>
                            <option value="Annuale" ${order.installment_type === 'Annuale' ? 'selected' : ''}>Annuale</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="flex-end" style="gap: 0.5rem; margin-top: 1rem;">
                <button class="primary-btn secondary small" onclick="window.toggleOrderConfigEdit('${order.id}', false)">Annulla</button>
                <button class="primary-btn small" onclick="window.saveOrderConfig('${order.id}')">Salva</button>
            </div>
        </div>
    `;
}

window.toggleOrderConfigFields = (orderId) => {
    const mode = document.getElementById(`ord-pay-mode-${orderId}`).value;
    const depCnt = document.getElementById(`ord-config-dep-cnt-${orderId}`);
    const balCnt = document.getElementById(`ord-config-bal-cnt-${orderId}`);
    const rateCnt = document.getElementById(`ord-config-rate-cnt-${orderId}`);
    if (depCnt) depCnt.style.display = (mode.includes('anticipo') || mode === 'as_rate') ? 'block' : 'none';
    if (balCnt) balCnt.style.display = (mode === 'as_rate') ? 'block' : 'none';
    if (rateCnt) rateCnt.style.display = mode.includes('rate') ? 'grid' : 'none';
};

window.toggleOrderConfigEdit = (orderId, isEdit) => {
    window.orderConfigEditState[orderId] = isEdit;
    const container = document.getElementById(`order-payment-config-container-${orderId}`);
    const order = state.orders.find(o => o.id == orderId);
    if (container && order) {
        container.innerHTML = renderOrderPaymentConfigUI(order);
        if (isEdit) {
            setTimeout(() => {
                // Initialize Custom Selects
                const selects = container.querySelectorAll('select');
                import('../../components/CustomSelect.js?v=8000').then(({ CustomSelect }) => {
                    selects.forEach(s => new CustomSelect(s));
                });

                window.toggleOrderConfigFields(orderId);
            }, 0);
        }
    }
};

window.saveOrderConfig = async (orderId) => {
    try {
        const mode = document.getElementById(`ord-pay-mode-${orderId}`).value;
        const depEl = document.getElementById(`ord-pay-dep-${orderId}`);
        const rateCountEl = document.getElementById(`ord-pay-rate-count-${orderId}`);
        const rateTypeEl = document.getElementById(`ord-pay-rate-type-${orderId}`);
        const balEl = document.getElementById(`ord-pay-bal-${orderId}`);

        const rawDeposit = depEl ? (parseFloat(depEl.value) || 0) : 0;
        const rawInstallments = rateCountEl ? (parseInt(rateCountEl.value) || 1) : 1;
        const instType = rateTypeEl ? rateTypeEl.value : 'Mensile';
        const rawBalance = balEl ? (parseFloat(balEl.value) || 0) : 0;

        let finalDeposit = 0;
        let finalBalance = 0;
        let finalInstallments = null;
        let finalInstType = null;

        switch (mode) {
            case 'saldo':
                finalDeposit = 0;
                finalBalance = 100;
                finalInstallments = null;
                finalInstType = null;
                break;
            case 'anticipo_saldo':
                finalDeposit = rawDeposit;
                finalBalance = 100 - rawDeposit;
                finalInstallments = null;
                finalInstType = null;
                break;
            case 'anticipo_rate':
                finalDeposit = rawDeposit;
                finalBalance = 0;
                finalInstallments = rawInstallments;
                finalInstType = instType;
                break;
            case 'rate':
                finalDeposit = 0;
                finalBalance = 0;
                finalInstallments = rawInstallments;
                finalInstType = instType;
                break;
            case 'as_rate':
                finalDeposit = rawDeposit;
                finalBalance = rawBalance;
                finalInstallments = rawInstallments;
                finalInstType = instType;
                break;
            default:
                finalBalance = 100;
        }

        const updates = {
            payment_mode: mode,
            deposit_percentage: finalDeposit,
            balance_percentage: finalBalance,
            installments_count: finalInstallments,
            installment_type: finalInstType
        };

        console.log("Saving order config for", orderId, updates);
        const updated = await updateOrder(orderId, updates);
        console.log("Update database result:", updated);

        await fetchOrders();
        window.toggleOrderConfigEdit(orderId, false);
        showGlobalAlert('Configurazione salvata con successo', 'success');

        renderOrderDetail(document.getElementById('content-area'), orderId);
    } catch (e) {
        console.error("Error in saveOrderConfig:", e);
        showGlobalAlert('Errore nel salvataggio: ' + e.message, 'error');
    }
};
