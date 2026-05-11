// People modal — manage Account collaborators and Contacts on an order.
// Extracted from orders.js. Side effects on import:
//   - window.openAddOrderAccountModal(orderId)
//   - window.openAddOrderContactModal(orderId)
//   - window.filterAccountList / filterContactList
//   - window.confirmAddAccount / confirmAddContact
//   - window.removeOrderAccount / removeOrderContact
//
// Public exports:
//   - initOrderPeopleModals()

import { state } from '/js/modules/state.js?v=8000';
import { supabase } from '../../modules/config.js?v=8000';
import { formatAmount, showGlobalAlert, showConfirm, renderAvatar } from '../../modules/utils.js?v=8000';
import { updateOrder, fetchOrders, fetchPayments, fetchCollaborators, fetchServices, addOrderAccount, removeOrderAccount, fetchOrderAccounts, addOrderContact, removeOrderContact, fetchOrderContacts, upsertPayment, deletePayment, updateOrderCloudLinks } from '../../modules/api.js?v=8000';
import { CustomSelect } from '../../components/CustomSelect.js?v=8000';

export function initOrderPeopleModals() {
    if (!document.getElementById('add-account-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="add-account-modal" class="modal">
                <div class="modal-content" style="max-width: 500px; padding: 2rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(59, 130, 246, 0.1); display: flex; align-items: center; justify-content: center;">
                                <span class="material-icons-round" style="color: var(--brand-blue); font-size: 1.25rem;">person_add</span>
                            </div>
                            <h2 style="margin: 0; font-family: var(--font-titles); font-weight: 700; font-size: 1.25rem;">Assegna Account</h2>
                        </div>
                        <button class="icon-btn" onclick="document.getElementById('add-account-modal').classList.remove('active')">
                            <span class="material-icons-round">close</span>
                        </button>
                    </div>
                    
                    <div style="position: relative; margin-bottom: 1rem;">
                        <span class="material-icons-round" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 1.1rem; color: var(--text-tertiary);">search</span>
                        <input type="text" id="acc-search" class="modal-input" placeholder="Cerca account..." style="width: 100%; padding-left: 2.5rem;" oninput="window.filterAccountList()">
                    </div>

                    <div id="sea-list" style="max-height: 350px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; padding-right: 0.25rem;">
                        <!-- List populated via JS -->
                    </div>
                </div>
            </div>
        `);
    }

    if (!document.getElementById('add-contact-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="add-contact-modal" class="modal">
                <div class="modal-content" style="max-width: 500px; padding: 2rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(139, 92, 246, 0.1); display: flex; align-items: center; justify-content: center;">
                                <span class="material-icons-round" style="color: #8b5cf6; font-size: 1.25rem;">contact_page</span>
                            </div>
                            <h2 style="margin: 0; font-family: var(--font-titles); font-weight: 700; font-size: 1.25rem;">Aggiungi Referente</h2>
                        </div>
                        <button class="icon-btn" onclick="document.getElementById('add-contact-modal').classList.remove('active')">
                            <span class="material-icons-round">close</span>
                        </button>
                    </div>

                    <div style="position: relative; margin-bottom: 1rem;">
                        <span class="material-icons-round" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 1.1rem; color: var(--text-tertiary);">search</span>
                        <input type="text" id="cont-search" class="modal-input" placeholder="Cerca referente..." style="width: 100%; padding-left: 2.5rem;" oninput="window.filterContactList()">
                    </div>

                    <div id="sec-list" style="max-height: 350px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; padding-right: 0.25rem;">
                        <!-- List populated via JS -->
                    </div>
                </div>
            </div>
        `);
    }
}

window.openAddOrderAccountModal = (orderId) => {
    state.currentOrderId = orderId;
    document.getElementById('acc-search').value = '';
    window.filterAccountList();
    document.getElementById('add-account-modal').classList.add('active');
};

window.filterAccountList = () => {
    const list = document.getElementById('sea-list');
    const search = document.getElementById('acc-search').value.toLowerCase();
    const orderId = state.currentOrderId;
    const order = state.orders.find(o => o.id === orderId);

    // Get currently assigned account IDs to exclude them
    const assignedIds = new Set();
    if (order && order.order_collaborators) {
        order.order_collaborators.forEach(oc => {
            if (oc.role_in_order === 'Account' && oc.collaborator_id) {
                assignedIds.add(oc.collaborator_id);
            }
        });
    }

    // Filter by tag "Account", search term, and exclusion of already assigned
    const accounts = (state.collaborators || []).filter(c => {
        // Exclude if already assigned
        if (assignedIds.has(c.id)) return false;
        
        // Filter out inactive
        if (c.is_active === false || c.active === false) return false;

        // Parse tags (can be Array, JSON string, or comma-separated string)
        let tagsArray = [];
        if (Array.isArray(c.tags)) {
            tagsArray = c.tags;
        } else if (typeof c.tags === 'string') {
            const trimmed = c.tags.trim();
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                try { tagsArray = JSON.parse(trimmed); } catch (e) { tagsArray = trimmed.split(','); }
            } else {
                tagsArray = trimmed.split(',');
            }
        }

        const lowerTags = tagsArray.map(t => t.toString().trim().toLowerCase());
        const isEligible = lowerTags.includes('account');
        
        const matchesSearch = c.full_name.toLowerCase().includes(search);
        return isEligible && matchesSearch;
    });

    if (accounts.length === 0) {
        list.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-tertiary); font-size: 0.85rem;">Nessun account trovato${search ? ' per questa ricerca' : ''}</div>`;
        return;
    }

    list.innerHTML = accounts.map(c => `
        <div onclick="window.confirmAddAccount('${c.id}')" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--bg-secondary); border-radius: 10px; cursor: pointer; transition: all 0.2s; border: 1px solid transparent;" onmouseover="this.style.borderColor='var(--brand-blue)'; this.style.background='white';" onmouseout="this.style.borderColor='transparent'; this.style.background='var(--bg-secondary)';">
            ${renderAvatar(c, { size: 32, borderRadius: '50%', fontSize: '0.8rem' })}
            <div style="flex: 1;">
                <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">${c.full_name}</div>
                <div style="font-size: 0.7rem; color: var(--text-tertiary);">${c.role || 'Collaboratore'}</div>
            </div>
            <span class="material-icons-round" style="color: var(--brand-blue); font-size: 1.25rem;">add_circle_outline</span>
        </div>
    `).join('');
};

window.openAddOrderContactModal = (orderId) => {
    state.currentOrderId = orderId;
    document.getElementById('cont-search').value = '';
    window.filterContactList();
    document.getElementById('add-contact-modal').classList.add('active');
};

window.filterContactList = () => {
    const list = document.getElementById('sec-list');
    const search = document.getElementById('cont-search').value.toLowerCase();

    // Get current order to find client_id
    const order = state.orders.find(o => o.id === state.currentOrderId);
    const clientId = order ? order.client_id : null;

    const filtered = (state.contacts || []).filter(c => {
        // Strict filter: Must belong to the filtered client (if order has a client)
        if (clientId && c.client_id !== clientId) return false;

        return c.full_name.toLowerCase().includes(search) ||
            (c.clients?.business_name || '').toLowerCase().includes(search);
    });

    if (filtered.length === 0) {
        list.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-tertiary); font-size: 0.85rem;">Nessun referente trovato${clientId ? ' per questo cliente' : ''}</div>`;
        return;
    }

    list.innerHTML = filtered.map(c => `
        <div onclick="window.confirmAddContact('${c.id}')" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--bg-secondary); border-radius: 10px; cursor: pointer; transition: all 0.2s; border: 1px solid transparent;" onmouseover="this.style.borderColor='#8b5cf6'; this.style.background='white';" onmouseout="this.style.borderColor='transparent'; this.style.background='var(--bg-secondary)';">
            ${renderAvatar(c, { size: 32, borderRadius: '50%', fontSize: '0.8rem' })}
            <div style="flex: 1;">
                <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">${c.full_name}</div>
                <div style="font-size: 0.7rem; color: var(--text-tertiary);">${c.clients?.business_name || 'Referente'}</div>
            </div>
            <span class="material-icons-round" style="color: #8b5cf6; font-size: 1.25rem;">add_circle_outline</span>
        </div>
    `).join('');
};

window.confirmAddAccount = async (cid) => {
    try {
        await addOrderAccount(state.currentOrderId, cid);
        document.getElementById('add-account-modal').classList.remove('active');
        await fetchOrders(true);
        // Re-render via hash to avoid cyclic import with orders.js
        window.location.hash = '#order-detail/' + state.currentOrderId;
        showGlobalAlert('Account assegnato', 'success');
    } catch (e) { showGlobalAlert('Errore', 'error'); }
};

window.removeOrderAccount = async (oid, cid) => {
    try {
        await removeOrderAccount(oid, cid);
        await fetchOrders(true);
        // Re-render via hash to avoid cyclic import with orders.js
        window.location.hash = '#order-detail/' + oid;
        showGlobalAlert('Account rimosso', 'success');
    } catch (e) { showGlobalAlert('Errore', 'error'); }
};

window.confirmAddContact = async (cid) => {
    try {
        await addOrderContact(state.currentOrderId, cid);
        document.getElementById('add-contact-modal').classList.remove('active');
        await fetchOrders(true);
        // Re-render via hash to avoid cyclic import with orders.js
        window.location.hash = '#order-detail/' + state.currentOrderId;
        showGlobalAlert('Referente aggiunto', 'success');
    } catch (e) { showGlobalAlert('Errore', 'error'); }
};

window.removeOrderContact = async (oid, cid) => {
    try {
        await removeOrderContact(oid, cid);
        await fetchOrders(true);
        // Re-render via hash to avoid cyclic import with orders.js
        window.location.hash = '#order-detail/' + oid;
        showGlobalAlert('Referente rimosso', 'success');
    } catch (e) { showGlobalAlert('Errore', 'error'); }
};
