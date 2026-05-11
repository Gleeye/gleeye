// New Order modal — wizard to create a new order from scratch.
// Extracted from orders.js. Used by both orders.js (#order-detail) and
// dashboard.js (the orders dashboard "New Order" button).
//
// Public exports:
//   - initNewOrderModal()

import { state } from '/js/modules/state.js?v=8000';
import { supabase } from '../../modules/config.js?v=8000';
import { formatAmount, showGlobalAlert, showConfirm, renderAvatar } from '../../modules/utils.js?v=8000';
import { upsertOrder, fetchOrders, fetchClients, fetchCollaborators, generateNextOrderNumber } from '../../modules/api.js?v=8000';
import { CustomSelect } from '../../components/CustomSelect.js?v=8000';

export function initNewOrderModal() {
    const existing = document.getElementById('new-order-modal');
    if (existing) existing.remove(); // always re-create to get fresh state

    // Internal wizard state
    const newOrderState = {
        selectedAccounts: [],   // { id, full_name }
        selectedClient: null,   // { id, business_name }
        selectedContacts: [],   // { id, full_name }
    };

    // Insert animation keyframes if not present
    if (!document.getElementById('new-ord-animations')) {
        document.head.insertAdjacentHTML('beforeend', `
            <style id="new-ord-animations">
                @keyframes dropdownSlide {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .new-ord-item:hover {
                    background: rgba(var(--brand-blue-rgb, 59, 130, 246), 0.05) !important;
                }
            </style>
        `);
    }

    document.body.insertAdjacentHTML('beforeend', `
        <div id="new-order-modal" class="modal">
            <div class="modal-content" style="max-width: 600px; padding: 2rem; overflow: visible !important;">

                <!-- Header -->
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(16, 185, 129, 0.1); display: flex; align-items: center; justify-content: center;">
                            <span class="material-icons-round" style="color: #10b981;">add_circle</span>
                        </div>
                        <h2 style="margin: 0; font-family: var(--font-titles); font-weight: 700;">Nuovo Ordine</h2>
                    </div>
                    <button class="icon-btn" onclick="document.getElementById('new-order-modal').classList.remove('active')">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>

                <div style="display: flex; flex-direction: column; gap: 1.5rem; margin-bottom: 2rem;">

                    <!-- 1) Titolo Commessa -->
                    <div>
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Titolo Commessa</label>
                        <input type="text" id="new-ord-title" class="modal-input" style="width: 100%;" placeholder="Es: Campagna Social Estate 2026">
                    </div>

                    <!-- 2) Account (multiselect) -->
                    <div style="position: relative;">
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Account</label>
                        <div style="position: relative;">
                            <span class="material-icons-round" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 1.1rem; color: var(--text-tertiary); pointer-events: none;">search</span>
                            <input type="text" id="new-ord-acc-search" class="modal-input" placeholder="Cerca account..." style="width: 100%; padding-left: 2.5rem;" autocomplete="off">
                        </div>
                        <div id="new-ord-acc-dropdown" style="position: absolute; top: 100%; left: 0; right: 0; z-index: 999; max-height: 300px; overflow-y: auto; display: none; background: rgba(255, 255, 255, 0.95); border: 1px solid var(--glass-border); border-radius: 16px; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.3); margin-top: 0.6rem; backdrop-filter: blur(20px); animation: dropdownSlide 0.2s ease-out;"></div>
                        <div id="new-ord-acc-chips" style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem;"></div>
                    </div>

                    <!-- 3) Cliente (single select) -->
                    <div style="position: relative;">
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Cliente</label>
                        <div style="position: relative;">
                            <span class="material-icons-round" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 1.1rem; color: var(--text-tertiary); pointer-events: none;">business</span>
                            <input type="text" id="new-ord-client-search" class="modal-input" placeholder="Cerca cliente..." style="width: 100%; padding-left: 2.5rem;" autocomplete="off">
                        </div>
                        <div id="new-ord-client-dropdown" style="position: absolute; top: 100%; left: 0; right: 0; z-index: 999; max-height: 300px; overflow-y: auto; display: none; background: rgba(255, 255, 255, 0.95); border: 1px solid var(--glass-border); border-radius: 16px; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.3); margin-top: 0.6rem; backdrop-filter: blur(20px); animation: dropdownSlide 0.2s ease-out;"></div>
                        <div id="new-ord-client-selected" style="display: none; margin-top: 0.5rem;"></div>
                    </div>

                    <!-- 4) Referente (multiselect, hidden until client selected) -->
                    <div id="new-ord-contact-section" style="display: none; position: relative;">
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Referente</label>
                        <div style="position: relative;">
                            <span class="material-icons-round" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 1.1rem; color: var(--text-tertiary); pointer-events: none;">contact_page</span>
                            <input type="text" id="new-ord-contact-search" class="modal-input" placeholder="Cerca referente..." style="width: 100%; padding-left: 2.5rem;" autocomplete="off">
                        </div>
                        <div id="new-ord-contact-dropdown" style="position: absolute; top: 100%; left: 0; right: 0; z-index: 999; max-height: 300px; overflow-y: auto; display: none; background: rgba(255, 255, 255, 0.95); border: 1px solid var(--glass-border); border-radius: 16px; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.3); margin-top: 0.6rem; backdrop-filter: blur(20px); animation: dropdownSlide 0.2s ease-out;"></div>
                        <div id="new-ord-contact-chips" style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem;"></div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="flex-end" style="gap: 1rem;">
                    <button class="primary-btn secondary" onclick="document.getElementById('new-order-modal').classList.remove('active')">Annulla</button>
                    <button class="primary-btn" id="new-ord-btn-save">
                        <span class="material-icons-round" style="font-size: 1.1rem;">save</span>
                        Crea Ordine
                    </button>
                </div>
            </div>
        </div>
    `);

    // ── Helper: render account chips ──
    const renderAccChips = () => {
        const container = document.getElementById('new-ord-acc-chips');
        container.innerHTML = newOrderState.selectedAccounts.map((a, i) => `
            <span style="display: inline-flex; align-items: center; gap: 0.35rem; background: rgba(59, 130, 246, 0.1); color: var(--brand-blue); border: 1px solid rgba(59, 130, 246, 0.2); padding: 0.3rem 0.6rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">
                ${a.full_name}
                <span class="material-icons-round" style="font-size: 0.9rem; cursor: pointer; opacity: 0.7;" data-remove-acc="${i}">close</span>
            </span>
        `).join('');
        container.querySelectorAll('[data-remove-acc]').forEach(btn => {
            btn.addEventListener('click', () => {
                newOrderState.selectedAccounts.splice(parseInt(btn.dataset.removeAcc), 1);
                renderAccChips();
            });
        });
    };

    // ── Helper: render contact chips ──
    const renderContactChips = () => {
        const container = document.getElementById('new-ord-contact-chips');
        container.innerHTML = newOrderState.selectedContacts.map((c, i) => `
            <span style="display: inline-flex; align-items: center; gap: 0.35rem; background: rgba(139, 92, 246, 0.1); color: #8b5cf6; border: 1px solid rgba(139, 92, 246, 0.2); padding: 0.3rem 0.6rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">
                ${c.full_name}
                <span class="material-icons-round" style="font-size: 0.9rem; cursor: pointer; opacity: 0.7;" data-remove-contact="${i}">close</span>
            </span>
        `).join('');
        container.querySelectorAll('[data-remove-contact]').forEach(btn => {
            btn.addEventListener('click', () => {
                newOrderState.selectedContacts.splice(parseInt(btn.dataset.removeContact), 1);
                renderContactChips();
            });
        });
    };

    // ── Account search & dropdown ──
    const accSearch = document.getElementById('new-ord-acc-search');
    const accDropdown = document.getElementById('new-ord-acc-dropdown');

    const filterAccounts = () => {
        const term = accSearch.value.toLowerCase();
        const accounts = (state.collaborators || []).filter(c => {
            if (c.is_active === false || c.active === false) return false;

            // Check in tags (array or string)
            const tags = Array.isArray(c.tags) ? c.tags : (c.tags || '').split(',');
            const hasAccountTag = tags.some(t => t.trim().toLowerCase().includes('account'));

            // Also check in role for safety
            const hasAccountRole = (c.role || '').toLowerCase().includes('account');

            const matches = c.full_name.toLowerCase().includes(term);
            const alreadySelected = newOrderState.selectedAccounts.some(a => a.id === c.id);
            return (hasAccountTag || hasAccountRole) && matches && !alreadySelected;
        });

        if (accounts.length === 0) {
            accDropdown.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--text-tertiary); font-size: 0.85rem;">Nessun account trovato</div>`;
        } else {
            accDropdown.innerHTML = accounts.map((c, i) => `
                <div class="new-ord-acc-item new-ord-item" data-id="${c.id}" data-name="${c.full_name}" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.8rem 1rem; cursor: pointer; transition: all 0.2s; ${i === accounts.length - 1 ? '' : 'border-bottom: 1px solid var(--glass-border);'}">
                    ${renderAvatar(c, { size: 32, borderRadius: '50%', fontSize: '0.7rem' })}
                    <div style="flex: 1;">
                        <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">${c.full_name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-tertiary);">${c.role || 'Collaboratore'}</div>
                    </div>
                </div>
            `).join('');
        }
        accDropdown.style.display = 'block';

        accDropdown.querySelectorAll('.new-ord-acc-item').forEach(item => {
            item.addEventListener('click', () => {
                newOrderState.selectedAccounts.push({ id: item.dataset.id, full_name: item.dataset.name });
                accSearch.value = '';
                accDropdown.style.display = 'none';
                renderAccChips();
            });
        });
    };

    accSearch.addEventListener('input', filterAccounts);
    accSearch.addEventListener('focus', filterAccounts);
    document.addEventListener('click', (e) => {
        if (!accSearch.contains(e.target) && !accDropdown.contains(e.target)) {
            accDropdown.style.display = 'none';
        }
    });

    // ── Client search & dropdown ──
    const clientSearch = document.getElementById('new-ord-client-search');
    const clientDropdown = document.getElementById('new-ord-client-dropdown');
    const clientSelected = document.getElementById('new-ord-client-selected');
    const contactSection = document.getElementById('new-ord-contact-section');

    const filterClients = () => {
        const term = clientSearch.value.toLowerCase();
        const clients = (state.clients || []).filter(c =>
            (c.business_name || '').toLowerCase().includes(term)
        );

        if (clients.length === 0) {
            clientDropdown.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--text-tertiary); font-size: 0.85rem;">Nessun cliente trovato</div>`;
        } else {
            clientDropdown.innerHTML = clients.map((c, i) => `
                <div class="new-ord-client-item new-ord-item" data-id="${c.id}" data-name="${c.business_name}" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.8rem 1rem; cursor: pointer; transition: all 0.2s; ${i === clients.length - 1 ? '' : 'border-bottom: 1px solid var(--glass-border);'}">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(16, 185, 129, 0.1); color: #10b981; display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons-round" style="font-size: 1.2rem;">business</span>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">${c.business_name}</div>
                        ${c.client_code ? `<div style="font-size: 0.75rem; color: var(--text-tertiary);">${c.client_code}</div>` : ''}
                    </div>
                </div>
            `).join('');
        }
        clientDropdown.style.display = 'block';

        clientDropdown.querySelectorAll('.new-ord-client-item').forEach(item => {
            item.addEventListener('click', () => {
                newOrderState.selectedClient = { id: item.dataset.id, business_name: item.dataset.name };
                clientSearch.style.display = 'none';
                clientDropdown.style.display = 'none';
                clientSelected.style.display = 'flex';
                clientSelected.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 12px;">
                        <span class="material-icons-round" style="color: #10b981; font-size: 1.2rem;">business</span>
                        <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary); flex: 1;">${item.dataset.name}</span>
                        <span class="material-icons-round" id="new-ord-clear-client" style="font-size: 1rem; cursor: pointer; color: var(--text-tertiary);">close</span>
                    </div>
                `;
                document.getElementById('new-ord-clear-client').addEventListener('click', () => {
                    newOrderState.selectedClient = null;
                    newOrderState.selectedContacts = [];
                    clientSearch.style.display = 'block';
                    clientSearch.value = '';
                    clientSelected.style.display = 'none';
                    contactSection.style.display = 'none';
                    renderContactChips();
                });

                // Show referente section
                contactSection.style.display = 'block';
                newOrderState.selectedContacts = [];
                renderContactChips();
            });
        });
    };

    clientSearch.addEventListener('input', filterClients);
    clientSearch.addEventListener('focus', filterClients);
    document.addEventListener('click', (e) => {
        if (!clientSearch.contains(e.target) && !clientDropdown.contains(e.target)) {
            clientDropdown.style.display = 'none';
        }
    });

    // ── Contact search & dropdown ──
    const contactSearch = document.getElementById('new-ord-contact-search');
    const contactDropdown = document.getElementById('new-ord-contact-dropdown');

    const filterContacts = () => {
        const term = contactSearch.value.toLowerCase();
        const clientId = newOrderState.selectedClient?.id;
        if (!clientId) return;

        const contacts = (state.contacts || []).filter(c => {
            if (c.client_id !== clientId) return false;
            const matches = (c.full_name || '').toLowerCase().includes(term);
            const alreadySelected = newOrderState.selectedContacts.some(s => s.id === c.id);
            return matches && !alreadySelected;
        });

        if (contacts.length === 0) {
            contactDropdown.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--text-tertiary); font-size: 0.85rem;">Nessun referente trovato per questo cliente</div>`;
        } else {
            contactDropdown.innerHTML = contacts.map((c, i) => `
                <div class="new-ord-contact-item new-ord-item" data-id="${c.id}" data-name="${c.full_name}" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.8rem 1rem; cursor: pointer; transition: all 0.2s; ${i === contacts.length - 1 ? '' : 'border-bottom: 1px solid var(--glass-border);'}">
                    ${renderAvatar(c, { size: 32, borderRadius: '50%', fontSize: '0.8rem' })}
                    <div style="flex: 1;">
                        <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">${c.full_name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-tertiary);">${c.role || 'Referente'}</div>
                    </div>
                </div>
            `).join('');
        }
        contactDropdown.style.display = 'block';

        contactDropdown.querySelectorAll('.new-ord-contact-item').forEach(item => {
            item.addEventListener('click', () => {
                newOrderState.selectedContacts.push({ id: item.dataset.id, full_name: item.dataset.name });
                contactSearch.value = '';
                contactDropdown.style.display = 'none';
                renderContactChips();
            });
        });
    };

    contactSearch.addEventListener('input', filterContacts);
    contactSearch.addEventListener('focus', filterContacts);
    document.addEventListener('click', (e) => {
        if (!contactSearch.contains(e.target) && !contactDropdown.contains(e.target)) {
            contactDropdown.style.display = 'none';
        }
    });

    // ── Save button ──
    document.getElementById('new-ord-btn-save').addEventListener('click', async () => {
        const title = document.getElementById('new-ord-title').value.trim();
        if (!title) {
            showGlobalAlert('Inserisci un titolo per la commessa', 'error');
            return;
        }

        const saveBtn = document.getElementById('new-ord-btn-save');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="loader" style="width:20px;height:20px;"></span> Creazione...';

        try {
            // 0. Generate Order Number
            const nextNumber = await generateNextOrderNumber();
            const today = new Date().toISOString().split('T')[0];

            // 1. Create the order
            const orderData = {
                title,
                order_number: nextNumber,
                order_date: today,
                offer_status: 'in_lavorazione',
                status_works: 'da_iniziare',
                status_sales: null // Prevent DB DEFAULT 'draft' from violating the check constraint
            };
            if (newOrderState.selectedClient) {
                orderData.client_id = newOrderState.selectedClient.id;
            }

            const newOrder = await upsertOrder(orderData);

            // 2. Link accounts
            for (const acc of newOrderState.selectedAccounts) {
                try { await addOrderAccount(newOrder.id, acc.id); } catch (e) { console.warn('Error adding account:', e); }
            }

            // 3. Link contacts (referenti)
            for (const cont of newOrderState.selectedContacts) {
                try { await addOrderContact(newOrder.id, cont.id); } catch (e) { console.warn('Error adding contact:', e); }
            }

            // 4. Refresh & navigate
            await fetchOrders();
            document.getElementById('new-order-modal').classList.remove('active');
            showGlobalAlert('Ordine creato con successo!', 'success');
            window.location.hash = `order-detail/${newOrder.id}`;
        } catch (e) {
            console.error('Error creating order:', e);
            showGlobalAlert('Errore durante la creazione dell\'ordine: ' + (e.message || e), 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<span class="material-icons-round" style="font-size: 1.1rem;">save</span> Crea Ordine';
        }
    });

    // ── Open helper ──
    window.openNewOrderModal = async () => {
        // Ensure data is loaded
        if (!state.collaborators || state.collaborators.length === 0) fetchCollaborators();
        if (!state.clients || state.clients.length === 0) fetchClients();
        if (!state.contacts || state.contacts.length === 0) fetchContacts();

        // Reset state
        newOrderState.selectedAccounts = [];
        newOrderState.selectedClient = null;
        newOrderState.selectedContacts = [];

        document.getElementById('new-ord-title').value = '';
        document.getElementById('new-ord-acc-search').value = '';
        document.getElementById('new-ord-acc-chips').innerHTML = '';
        document.getElementById('new-ord-client-search').value = '';
        document.getElementById('new-ord-client-search').style.display = 'block';
        document.getElementById('new-ord-client-selected').style.display = 'none';
        document.getElementById('new-ord-client-dropdown').style.display = 'none';
        document.getElementById('new-ord-acc-dropdown').style.display = 'none';
        document.getElementById('new-ord-contact-section').style.display = 'none';
        document.getElementById('new-ord-contact-search').value = '';
        document.getElementById('new-ord-contact-chips').innerHTML = '';

        const saveBtn = document.getElementById('new-ord-btn-save');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span class="material-icons-round" style="font-size: 1.1rem;">save</span> Crea Ordine';

        document.getElementById('new-order-modal').classList.add('active');
    };
}
