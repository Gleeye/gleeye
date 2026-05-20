import { state } from '/js/modules/state.js?v=8000';
import { fetchContacts } from '../modules/api.js?v=8000';
import { openClientContactModal } from './clients.js?v=8000';

export function renderContacts(container) {
    if (typeof state.contactsRelationFilter === 'undefined') state.contactsRelationFilter = 'all';

    const renderGrid = () => {
        const term = (state.searchTerm || '').toLowerCase();
        const filtered = (state.contacts || []).filter(contact => {
            const fullName = (contact.full_name || '').toLowerCase();
            const email = (contact.email || '').toLowerCase();
            const clientName = (contact.clients?.business_name || '').toLowerCase();
            const matchesSearch = fullName.includes(term) || email.includes(term) || clientName.includes(term);
            if (!matchesSearch) return false;
            if (state.contactsRelationFilter !== 'all' && contact.relation_type !== state.contactsRelationFilter) return false;
            return true;
        }).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

        if (filtered.length === 0) {
            return `
                <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; color: var(--text-tertiary); text-align: center;">
                    <span class="material-icons-round" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">contact_phone</span>
                    <h3 style="font-size: 1.2rem; font-weight: 500; margin: 0; color: var(--text-secondary);">Nessun referente trovato</h3>
                    <p style="font-size: 0.95rem; margin-top: 0.5rem; max-width: 320px;">
                        Nessun match con il filtro corrente.<br>
                        Aggiungi un referente da qui o dal dettaglio del cliente/partner/fornitore.
                    </p>
                </div>
            `;
        }

        return filtered.map(contact => {
            const relMap = {
                client: { label: 'Cliente', color: '#3b82f6' },
                partner_wl: { label: 'Partner WL', color: '#8b5cf6' },
                supplier: { label: 'Fornitore', color: '#f59e0b' },
            };
            const rel = relMap[contact.relation_type] || relMap.client;
            const editable = contact.client_id; // solo i client contact sono editabili da qui (modal client)
            return `
            <div class="card contact-card" data-contact-id="${contact.id}" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; ${editable ? 'cursor:pointer;' : 'cursor:default;'}">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 12px; background: ${rel.color}15; display: flex; align-items: center; justify-content: center; color: ${rel.color};">
                        <span class="material-icons-round">person</span>
                    </div>
                    <div style="flex:1; min-width: 0;">
                        <h3 style="margin: 0; font-size: 1rem; font-weight: 400; color: var(--text-primary); text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${contact.full_name}</h3>
                        <p style="margin: 0; font-size: 0.85rem; color: var(--brand-blue); font-weight: 500;">${contact.role || 'Referente'}</p>
                    </div>
                    <span style="padding: 2px 8px; border-radius: 999px; background: ${rel.color}18; color: ${rel.color}; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">${rel.label}</span>
                </div>
                <div style="margin-top: 0.25rem; display: flex; flex-direction: column; gap: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">
                        <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary);">business</span>
                        <span style="font-weight: 500; color: var(--text-primary);">${contact.clients?.business_name || '—'}</span>
                    </div>
                    ${contact.email ? `
                        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">
                            <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary);">email</span>
                            <a href="mailto:${contact.email}" onclick="event.stopPropagation()" style="color: var(--text-secondary); text-decoration: none;">${contact.email}</a>
                        </div>
                    ` : ''}
                    ${(contact.phone || contact.mobile) ? `
                        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">
                            <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary);">phone</span>
                            <span>${contact.phone || contact.mobile}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        }).join('');
    };

    // Conteggi per chip filtro
    const counts = { all: 0, client: 0, partner_wl: 0, supplier: 0 };
    (state.contacts || []).forEach(c => {
        counts.all++;
        if (counts[c.relation_type] !== undefined) counts[c.relation_type]++;
    });

    const chipsHTML = [
        { k: 'all',        label: 'Tutti',     color: '#64748b' },
        { k: 'client',     label: 'Clienti',   color: '#3b82f6' },
        { k: 'partner_wl', label: 'Partner WL', color: '#8b5cf6' },
        { k: 'supplier',   label: 'Fornitori', color: '#f59e0b' },
    ].map(ch => {
        const active = state.contactsRelationFilter === ch.k;
        return `<button data-relation-filter="${ch.k}" style="padding: 6px 14px; border-radius: 999px; font-size: 0.78rem; font-weight: 600; cursor: pointer; border: 1px solid ${ch.color}${active ? '' : '30'}; background: ${active ? ch.color : ch.color + '15'}; color: ${active ? 'white' : ch.color};">${ch.label} ${counts[ch.k] || 0}</button>`;
    }).join('');

    container.innerHTML = `
        <div class="animate-fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap;">
                <div>
                    <h2 style="margin: 0; font-size: 1.5rem; font-weight: 400; color: var(--text-primary);">Anagrafica Referenti</h2>
                    <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary); font-size: 0.9rem;">${counts.all} referenti — clicca un cliente per modificare</p>
                </div>
                <button id="new-contact-btn" class="primary-btn" style="display:flex; align-items:center; gap:0.4rem;">
                    <span class="material-icons-round">person_add</span> Nuovo referente
                </button>
            </div>

            <div style="display:flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
                ${chipsHTML}
            </div>

            <div id="contacts-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">
                ${renderGrid()}
            </div>
        </div>
    `;

    // Chip filter handlers
    container.querySelectorAll('[data-relation-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            state.contactsRelationFilter = btn.dataset.relationFilter;
            renderContacts(container);
        });
    });

    // Click su card → edit (solo se client_id presente)
    container.querySelectorAll('.contact-card[data-contact-id]').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.contactId;
            const contact = (state.contacts || []).find(c => c.id === id);
            if (!contact || !contact.client_id) return;
            openClientContactModal(contact.client_id, contact, async () => {
                await fetchContacts(true);
                renderContacts(container);
            });
        });
    });

    // Bottone "+ Nuovo referente" → prompt selector cliente
    const newBtn = container.querySelector('#new-contact-btn');
    if (newBtn) {
        newBtn.addEventListener('click', () => {
            const clients = (state.clients || []).slice().sort((a, b) => (a.business_name || '').localeCompare(b.business_name || ''));
            if (clients.length === 0) {
                (window.showAlert || alert)('Nessun cliente disponibile', 'warning');
                return;
            }
            // Mini picker inline
            let picker = document.getElementById('contact-client-picker');
            if (picker) picker.remove();
            picker = document.createElement('div');
            picker.id = 'contact-client-picker';
            picker.className = 'modal active';
            picker.innerHTML = `
                <div class="modal-content" style="max-width: 480px; width: 90vw;">
                    <div class="modal-header">
                        <h2>A quale cliente?</h2>
                        <button class="close-modal material-icons-round" id="close-contact-client-picker">close</button>
                    </div>
                    <div class="modal-body">
                        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">Seleziona il cliente per il quale aggiungere il referente.</p>
                        <input type="text" id="contact-client-picker-search" placeholder="Cerca cliente…" style="width:100%; padding:0.6rem 0.8rem; border: 1px solid var(--glass-border); border-radius: 8px; margin-bottom: 1rem;">
                        <div id="contact-client-picker-list" style="max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.3rem;"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(picker);
            picker.onclick = e => { if (e.target === picker) picker.remove(); };
            document.getElementById('close-contact-client-picker').onclick = () => picker.remove();
            const listEl = document.getElementById('contact-client-picker-list');
            const renderList = (q = '') => {
                const filtered = clients.filter(c => (c.business_name || '').toLowerCase().includes(q.toLowerCase())).slice(0, 50);
                listEl.innerHTML = filtered.map(c => `<button data-cid="${c.id}" style="padding: 0.6rem 0.9rem; text-align: left; background: white; border: 1px solid var(--glass-border); border-radius: 8px; cursor: pointer; font-size: 0.9rem;">${c.business_name}</button>`).join('');
                listEl.querySelectorAll('[data-cid]').forEach(b => {
                    b.addEventListener('click', () => {
                        const cid = b.dataset.cid;
                        picker.remove();
                        openClientContactModal(cid, null, async () => {
                            await fetchContacts(true);
                            renderContacts(container);
                        });
                    });
                });
            };
            renderList();
            document.getElementById('contact-client-picker-search').addEventListener('input', e => renderList(e.target.value));
        });
    }
}
