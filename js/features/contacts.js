import { state } from '../modules/state.js?v=148';

export function renderContacts(container) {
    console.log("renderContacts called. Container:", container);
    console.log("Current contacts in state:", state.contacts);

    const renderGrid = () => {
        const filtered = state.contacts.filter(contact => {
            const searchTerm = state.searchTerm.toLowerCase();
            const fullName = (contact.full_name || '').toLowerCase();
            const email = (contact.email || '').toLowerCase();
            const clientName = (contact.clients?.business_name || '').toLowerCase();

            return fullName.includes(searchTerm) ||
                email.includes(searchTerm) ||
                clientName.includes(searchTerm);
        }).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

        if (filtered.length === 0) {
            return `
                <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; color: var(--text-tertiary); text-align: center;">
                    <span class="material-icons-round" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">contact_phone</span>
                    <h3 style="font-size: 1.2rem; font-weight: 500; margin: 0; color: var(--text-secondary);">Nessun referente trovato</h3>
                    <p style="font-size: 0.95rem; margin-top: 0.5rem; max-width: 300px;">
                        I referenti potrebbero non essere stati ancora importati.<br><br>
                        <strong style="color: var(--brand-blue);">Azione richiesta:</strong><br>
                        Esegui il file <code>import_contacts.sql</code> nel SQL Editor di Supabase per caricare i dati.
                    </p>
                </div>
            `;
        }

        return filtered.map(contact => `
            <div class="card contact-card" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 12px; background: var(--bg-secondary); display: flex; align-items: center; justify-content: center; color: var(--brand-blue);">
                        <span class="material-icons-round">person</span>
                    </div>
                    <div>
                        <h3 style="margin: 0; font-size: 1rem; font-weight: 400; color: var(--text-primary);">${contact.full_name}</h3>
                        <p style="margin: 0; font-size: 0.85rem; color: var(--brand-blue); font-weight: 500;">${contact.role || 'Referente'}</p>
                    </div>
                </div>
                
                <div style="margin-top: 0.25rem; display: flex; flex-direction: column; gap: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">
                        <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary);">business</span>
                        <span style="font-weight: 500; color: var(--text-primary);">${contact.clients?.business_name || 'Nessun Cliente'}</span>
                    </div>
                    
                    ${contact.email ? `
                        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">
                            <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary);">email</span>
                            <a href="mailto:${contact.email}" style="color: var(--text-secondary); text-decoration: none;">${contact.email}</a>
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
        `).join('');
    };

    container.innerHTML = `
        <div class="animate-fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div>
                    <h2 style="margin: 0; font-size: 1.5rem; font-weight: 400; color: var(--text-primary);">Anagrafica Referenti</h2>
                    <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary); font-size: 0.9rem;" id="contacts-count">Caricamento...</p>
                </div>
            </div>

            <div id="contacts-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">
                ${renderGrid()}
            </div>
        </div>
    `;

    const updateCount = () => {
        const countEl = document.getElementById('contacts-count');
        if (countEl) {
            countEl.textContent = `${state.contacts.length} referenti in totale`;
        }
    };

    updateCount();
}
