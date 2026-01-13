import { state } from '../modules/state.js?v=116';
import { formatAmount } from '../modules/utils.js?v=116';
import { openDepartmentManager } from './settings.js?v=116';
import { upsertCollaborator, fetchPayments, fetchAvailabilityRules, saveAvailabilityRules, fetchAvailabilityOverrides, upsertAvailabilityOverride, deleteAvailabilityOverride, fetchCollaboratorServices, fetchBookingItemCollaborators } from '../modules/api.js?v=116';

export function renderCollaborators(container) {
    const renderGrid = () => {
        const filtered = state.collaborators.filter(c => {
            const matchesSearch = c.full_name.toLowerCase().includes(state.searchTerm.toLowerCase());
            const tags = Array.isArray(c.tags) ? c.tags : (typeof c.tags === 'string' ? c.tags.split(',') : []);
            const matchesDept = !state.selectedDepartment || tags.includes(state.selectedDepartment);
            return matchesSearch && matchesDept;
        }).sort((a, b) => {
            const nameA = (a.last_name || a.full_name.trim().split(' ').pop() || '').toLowerCase();
            const nameB = (b.last_name || b.full_name.trim().split(' ').pop() || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });

        const html = filtered.map(c => `
        <div class="card collaborator-card" onclick="window.location.hash='collaborator-detail/${c.id}'" style="cursor:pointer; padding: 1.25rem; display: flex; flex-direction: column; align-items: start; text-align: left; gap: 0.75rem; position: relative; overflow: hidden; height: 100%;">
            
            <div style="display: flex; width: 100%; justify-content: space-between; align-items: flex-start;">
                 <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--brand-gradient); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.4rem; font-weight: 400; box-shadow: var(--shadow-soft); flex-shrink: 0;">
                    ${c.avatar_url ? `<img src="${c.avatar_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover; border: 2px solid white;">` : c.full_name[0]}
                </div>
            </div>
            
            <div style="width: 100%; margin-top: 0.25rem;">
                <h3 style="margin: 0; font-size: 1.05rem; font-weight: 400; color: var(--text-primary); text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${c.full_name}</h3>
                <p style="margin: 0.25rem 0 0.75rem 0; color: var(--brand-blue); font-size: 0.85rem; font-weight: 500;">${c.role || 'Collaboratore'}</p>
                
                <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
                    ${(() => {
                let tags = c.tags;
                if (typeof tags === 'string') {
                    try { tags = JSON.parse(tags); } catch (e) { tags = tags.split(',').map(t => t.trim()); }
                }
                if (!Array.isArray(tags)) tags = [];
                return tags.slice(0, 3).map(tag => `<span style="font-size: 0.75rem; color: var(--text-secondary); background: var(--bg-secondary); padding: 2px 8px; border-radius: 4px; font-weight: 500;">${tag}</span>`).join('');
            })()}
                    ${(state.tags && state.tags.length > 3) ? `<span style="font-size: 0.75rem; color: var(--text-tertiary);">+${state.tags.length - 3}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
        return html;
    };

    if (!container.querySelector('.pills-container')) {
        container.innerHTML = `
        <div class="animate-fade-in">
            <div class="section-header" style="display:block; margin-bottom: 2rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="font-size: 1.1rem; font-weight: 400; color: var(--text-primary);">Totale Membri</span>
                        <span id="collab-count-badge" style="background: var(--brand-blue); color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.9rem; font-weight: 400;">${state.collaborators.length}</span>
                    </div>
                    <button class="primary-btn" onclick="openCollaboratorModal()">
                        <span class="material-icons-round">add</span>
                        Nuovo
                    </button>
                </div>
                
                <div class="pills-container">
                    <button class="pill-filter ${!state.selectedDepartment ? 'active' : ''}" data-dept="">Tutti</button>
                    ${state.departments.map(d => `<button class="pill-filter ${state.selectedDepartment === d.name ? 'active' : ''}" data-dept="${d.name}">${d.name}</button>`).join('')}
                    
                    <div style="width: 1px; height: 24px; background: var(--glass-border); margin: 0 0.5rem;"></div>
                    
                    <button class="pill-filter" id="open-dept-manager-btn" style="background: transparent; border: 1px dashed var(--glass-border); color: var(--text-secondary); display: flex; align-items: center; gap: 0.25rem;">
                        <span class="material-icons-round" style="font-size:1rem;">settings</span>
                        Gestisci
                    </button>
                </div>
            </div>
            
            <div class="card-grid" id="collaborators-grid" style="grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem;">
                <!-- Content will be injected -->
            </div>
        </div>
        `;

        const pillsContainer = container.querySelector('.pills-container');
        pillsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('pill-filter') && e.target.hasAttribute('data-dept')) {
                state.selectedDepartment = e.target.dataset.dept;
                pillsContainer.querySelectorAll('.pill-filter').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById('collaborators-grid').innerHTML = renderGrid();
                updateCount();
            }
        });

        const deptBtn = container.querySelector('#open-dept-manager-btn');
        if (deptBtn) {
            deptBtn.addEventListener('click', openDepartmentManager);
        }
    }

    const grid = document.getElementById('collaborators-grid');
    if (grid) {
        const content = renderGrid();
        if (content.trim() === '') {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; color: var(--text-tertiary); text-align: center;">
                    <span class="material-icons-round" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">people_outline</span>
                    <h3 style="font-size: 1.2rem; font-weight: 500; margin: 0; color: var(--text-secondary);">Nessun collaboratore trovato</h3>
                    <p style="font-size: 0.95rem; margin-top: 0.5rem; max-width: 300px;">Prova a modificare i filtri o la ricerca.</p>
                </div>
            `;
        } else {
            grid.innerHTML = content;
        }
        updateCount();
    }

    function updateCount() {
        const countBadge = document.getElementById('collab-count-badge');
        if (countBadge) {
            const count = state.collaborators.filter(c => {
                const matchesSearch = c.full_name.toLowerCase().includes(state.searchTerm.toLowerCase());
                const tags = Array.isArray(c.tags) ? c.tags : (typeof c.tags === 'string' ? c.tags.split(',') : []);
                const matchesDept = !state.selectedDepartment || tags.includes(state.selectedDepartment);
                return matchesSearch && matchesDept;
            }).length;
            countBadge.textContent = count;
        }
    }

    if (!window.hasDeptUpdateListener) {
        window.addEventListener('departments-updated', () => {
            if (state.currentPage === 'employees') {
                container.innerHTML = '';
                renderCollaborators(container);
            }
        });
        window.hasDeptUpdateListener = true;
    }
}

// Global open function linked to Logic
window.openCollaboratorModal = (collaboratorId = null) => {
    const modal = document.getElementById('collaborator-modal');
    if (modal) {
        modal.classList.add('active');
        const form = document.getElementById('collaborator-form');
        form.reset();

        const title = document.getElementById('modal-title');
        const idInput = document.getElementById('collab-id');

        if (collaboratorId) {
            title.textContent = 'Modifica Collaboratore';
            // Find collaborator logic needs to handle string IDs if passed from URL or onclick
            const c = state.collaborators.find(x => x.id == collaboratorId);
            if (c) {
                idInput.value = c.id;
                document.getElementById('collab-first-name').value = c.first_name || '';
                document.getElementById('collab-last-name').value = c.last_name || '';
                document.getElementById('collab-birth-date').value = c.birth_date || '';
                document.getElementById('collab-birth-place').value = c.birth_place || '';
                document.getElementById('collab-fiscal-code').value = c.fiscal_code || '';

                document.getElementById('collab-email').value = c.email || '';
                document.getElementById('collab-phone').value = c.phone || '';
                document.getElementById('collab-pec').value = c.pec || '';
                document.getElementById('collab-address').value = c.address || '';

                document.getElementById('collab-name').value = c.name || '';
                document.getElementById('collab-role').value = c.role || '';
                document.getElementById('collab-vat-number').value = c.vat_number || '';

                // Handle Tags
                let tags = c.tags;
                if (typeof tags === 'string') {
                    try { tags = JSON.parse(tags); } catch (e) { tags = tags.split(',').map(t => t.trim()); }
                }
                if (!Array.isArray(tags)) tags = [];
                document.getElementById('collab-tags').value = JSON.stringify(tags);
                document.getElementById('collab-tags-field').querySelector('span').textContent = tags.length ? tags.join(', ') : 'Seleziona...';
            }
        } else {
            title.textContent = 'Nuovo Collaboratore';
            idInput.value = '';
            document.getElementById('collab-tags').value = '[]';
            document.getElementById('collab-tags-field').querySelector('span').textContent = 'Seleziona...';
        }
    }
};

export function initCollaboratorModals() {
    if (!document.getElementById('collaborator-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="collaborator-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <div>
                            <h2 id="modal-title">Nuovo Collaboratore</h2>
                            <p style="font-size: 0.85rem; opacity: 0.6; margin-top: 0.25rem;">Compila i dettagli del profilo.</p>
                        </div>
                        <button class="close-modal material-icons-round" id="close-collab-modal-btn">close</button>
                    </div>
                    <form id="collaborator-form">
                        <input type="hidden" id="collab-id">
                        <div class="modal-sections">
                            <div class="modal-section">
                                <div class="section-title"><span class="material-icons-round">person</span><h4>Dati Anagrafici</h4></div>
                                <div class="form-grid">
                                    <div class="form-group"><label>Nome *</label><input type="text" id="collab-first-name" required></div>
                                    <div class="form-group"><label>Cognome *</label><input type="text" id="collab-last-name" required></div>
                                    <div class="form-group"><label>Data di Nascita</label><input type="date" id="collab-birth-date"></div>
                                    <div class="form-group"><label>Luogo di Nascita</label><input type="text" id="collab-birth-place"></div>
                                    <div class="form-group full-width"><label>Codice Fiscale</label><input type="text" id="collab-fiscal-code"></div>
                                </div>
                            </div>
                             <div class="modal-section">
                                <div class="section-title"><span class="material-icons-round">contact_page</span><h4>Recapiti</h4></div>
                                <div class="form-grid">
                                    <div class="form-group"><label>Email</label><input type="email" id="collab-email"></div>
                                    <div class="form-group"><label>Telefono</label><input type="text" id="collab-phone"></div>
                                    <div class="form-group full-width"><label>Indirizzo</label><input type="text" id="collab-address" placeholder="Via, Città, CAP..."></div>
                                    <div class="form-group full-width"><label>PEC</label><input type="text" id="collab-pec"></div>
                                </div>
                            </div>
                             <div class="modal-section full-width">
                                <div class="section-title"><span class="material-icons-round">work</span><h4>Dati Professionali</h4></div>
                                <div class="form-grid">
                                    <div class="form-group"><label>Codice *</label><input type="text" id="collab-name" required placeholder="Codice Univoco/Shorthand"></div>
                                    <div class="form-group"><label>Ruolo *</label><input type="text" id="collab-role" required></div>
                                    <div class="form-group full-width">
                                        <label>Reparto *</label>
                                        <div class="tag-input-container" onclick="openDeptSelector()"><div id="collab-tags-field" class="tag-field" tabindex="0"><span>Seleziona...</span></div></div>
                                        <input type="hidden" id="collab-tags">
                                    </div>
                                    <div class="form-group full-width"><label>P.IVA</label><input type="text" id="collab-vat-number"></div>
                                </div>
                            </div>
                        </div>
                        <div class="form-actions" style="margin-top:2rem; padding-top:1rem; border-top:1px solid #eee;">
                            <button type="button" class="primary-btn secondary" id="cancel-collab-modal-btn">Annulla</button>
                            <button type="submit" class="primary-btn">Salva</button>
                        </div>
                    </form>
                </div>
            </div>
        `);

        // Close logic
        const close = () => document.getElementById('collaborator-modal').classList.remove('active');
        document.getElementById('close-collab-modal-btn')?.addEventListener('click', close);
        document.getElementById('cancel-collab-modal-btn')?.addEventListener('click', close);

        // Submit Logic
        document.getElementById('collaborator-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = {
                id: document.getElementById('collab-id').value || undefined,
                first_name: document.getElementById('collab-first-name').value,
                last_name: document.getElementById('collab-last-name').value,
                birth_date: document.getElementById('collab-birth-date').value || null,
                birth_place: document.getElementById('collab-birth-place').value,
                fiscal_code: document.getElementById('collab-fiscal-code').value,
                email: document.getElementById('collab-email').value,
                phone: document.getElementById('collab-phone').value,
                address: document.getElementById('collab-address').value,
                pec: document.getElementById('collab-pec').value,
                name: document.getElementById('collab-name').value,
                role: document.getElementById('collab-role').value,
                vat_number: document.getElementById('collab-vat-number').value,
                tags: JSON.parse(document.getElementById('collab-tags').value || '[]'),
                full_name: `${document.getElementById('collab-first-name').value} ${document.getElementById('collab-last-name').value}`
            };

            try {
                await upsertCollaborator(formData);
                close();
                // Refresh Detail if open or Grid
                if (window.location.hash.includes('collaborator-detail') && state.currentId == formData.id) {
                    // Need to update local state fully first or wait for re-fetch? 
                    // upsertCollaborator already updates state.collaborators
                    const container = document.getElementById('content-area');
                    if (container) renderCollaboratorDetail(container);
                } else if (state.currentPage === 'employees') {
                    const grid = document.getElementById('collaborators-grid');
                    if (grid) renderCollaborators(document.getElementById('content-area'));
                }
            } catch (err) {
                window.showAlert('Errore durante il salvataggio: ' + err.message, 'error');
                console.error(err);
            }
        });
    }
}

// Ensure Department Selector Logic
window.openDeptSelector = () => {
    const current = JSON.parse(document.getElementById('collab-tags').value || '[]');
    // Simple prompt for now, can be upgraded to department modal selector later
    const newTags = prompt("Inserisci reparti separati da virgola (es. Design, Marketing):", current.join(', '));
    if (newTags !== null) {
        const tags = newTags.split(',').map(t => t.trim()).filter(Boolean);
        document.getElementById('collab-tags').value = JSON.stringify(tags);
        document.getElementById('collab-tags-field').querySelector('span').textContent = tags.length ? tags.join(', ') : 'Seleziona...';
    }
};

window.impersonateCollaborator = async (collaboratorId) => {
    const c = state.collaborators.find(x => x.id == collaboratorId);
    if (!c) return;

    if (await window.showConfirm(`Vuoi impersonare ${c.full_name}? Vedrai l'interfaccia come se fossi questo collaboratore.`)) {
        state.impersonatedRole = 'collaborator';
        state.impersonatedCollaboratorId = c.id;

        // Update Sidebar
        import('./layout.js').then(({ updateSidebarVisibility, renderSidebarProfile }) => {
            updateSidebarVisibility();
            renderSidebarProfile(); // Update avatar

            // Redirect to a safe page
            window.location.hash = 'booking';
            window.showAlert(`Stai vedendo l'app come: ${c.full_name}`, 'success');
        });
    }
};

window.sendMagicLink = async (email) => {
    if (!email) {
        window.showAlert('Email non presente per questo collaboratore', 'error');
        return;
    }

    if (await window.showConfirm(`Vuoi inviare un Magic Link di accesso a ${email}?`)) {
        try {
            const { supabase } = await import('../modules/config.js?v=116');
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: true,
                    emailRedirectTo: window.location.origin
                }
            });
            if (error) throw error;
            window.showAlert('Magic Link inviato con successo!', 'success');
        } catch (err) {
            console.error('Error sending magic link:', err);
            window.showAlert('Errore durante l\'invio: ' + err.message, 'error');
        }
    }
};

export function renderCollaboratorDetail(container) {
    const id = state.currentId;
    const c = state.collaborators.find(x => x.id == id);

    if (!c) {
        container.innerHTML = '<div style="padding:2rem; text-align:center;">Collaboratore non trovato</div>';
        return;
    }

    // Ensure payments are loaded
    if (!state.payments) {
        fetchPayments().then(() => renderCollaboratorDetail(container));
        return;
    }

    const collabOrders = state.orders.filter(o =>
        o.order_collaborators && o.order_collaborators.some(oc => oc.collaborators && oc.collaborators.id === c.id)
    );
    const collabInvoices = state.passiveInvoices.filter(i => i.collaborator_id === c.id);
    // Filter payments for this collaborator
    const collabPayments = state.payments.filter(p => p.collaborator_id === c.id);

    const totalInvoiced = collabInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount_tax_excluded) || 0), 0);
    const totalPaid = collabInvoices
        .filter(inv => inv.status === 'Pagato')
        .reduce((sum, inv) => sum + (parseFloat(inv.amount_tax_excluded) || 0), 0);

    container.innerHTML = `
        <div class="animate-fade-in">
            <button class="btn-link" onclick="window.location.hash='employees'" style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary);">
                <span class="material-icons-round">arrow_back</span> Torna alla lista
            </button>

            <!-- Header Profile -->
            <div class="glass-card" style="padding: 2.5rem; display: flex; gap: 2.5rem; align-items: flex-start; margin-bottom: 2rem;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem;">
                    <div style="width: 120px; height: 120px; border-radius: 50%; background: var(--brand-gradient); display: flex; align-items: center; justify-content: center; color: white; font-size: 3rem; font-weight: 400; box-shadow: var(--shadow-premium);">
                        ${c.avatar_url ? `<img src="${c.avatar_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : c.full_name[0]}
                    </div>
                     <!-- Soft Code/Shorthand Display -->
                    ${c.name ? `<span style="font-size: 0.85rem; color: var(--text-tertiary); font-family: monospace; letter-spacing: 1px; background: rgba(0,0,0,0.05); padding: 2px 8px; border-radius: 4px;">${c.name}</span>` : ''}
                </div>
                
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <h1 style="margin: 0 0 0.5rem 0; font-size: 2.2rem; letter-spacing: -0.5px;">${c.full_name}</h1>
                            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; margin-bottom: 1rem;">
                                <span style="font-size: 1rem; color: var(--brand-blue); font-weight: 400;">${c.role || '-'}</span>
                                <div style="width: 4px; height: 4px; border-radius: 50%; background: var(--text-tertiary);"></div>
                                ${(Array.isArray(c.tags) ? c.tags : (typeof c.tags === 'string' ? c.tags.split(',') : [])).map(t => `<span style="font-size: 0.85rem; color: var(--text-secondary); background: var(--bg-secondary); padding: 2px 10px; border-radius: 12px;">${t.trim ? t.trim() : t}</span>`).join('')}
                            </div>
                            
                            <!-- Birth Info -->
                             ${(c.birth_date || c.birth_place) ? `
                                <div style="display: flex; gap: 0.5rem; align-items: center; color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.5rem;">
                                    <span class="material-icons-round" style="font-size: 1rem;">cake</span>
                                    <span>Nato il ${c.birth_date ? new Date(c.birth_date).toLocaleDateString() : '-'} ${c.birth_place ? 'a ' + c.birth_place : ''}</span>
                                </div>
                            ` : ''}
                        </div>
                        
                        <div style="display: flex; gap: 0.5rem;">
                            <!-- Impersonate Button (Admin Only) -->
                            ${state.profile?.role === 'admin' ? `
                                <button class="secondary-btn small" onclick="impersonateCollaborator('${c.id}')" title="Vedi come ${c.first_name}" style="background: white; border: 1px solid var(--glass-border); padding: 0.5rem 1rem; display: flex; align-items: center; gap: 0.5rem;">
                                    <span class="material-icons-round" style="font-size: 18px; color: var(--brand-blue);">visibility</span>
                                    Vedi come
                                </button>
                            ` : ''}

                            <!-- Invia Magic Link Button -->
                            <button class="secondary-btn small" onclick="sendMagicLink('${c.email}')" title="Invia invito" style="background: white; border: 1px solid var(--glass-border); padding: 0.5rem 1rem; display: flex; align-items: center; gap: 0.5rem;">
                                <span class="material-icons-round" style="font-size: 18px; color: var(--brand-blue);">magic_button</span>
                                Invia Magic Link
                            </button>

                            <button class="icon-btn" style="background: var(--bg-secondary); width: 42px; height: 42px;" onclick="openCollaboratorModal('${c.id}')" title="Modifica">
                                <span class="material-icons-round" style="color: var(--text-primary);">edit</span>
                            </button>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-top: 2rem; padding-top: 2rem; border-top: 1px solid var(--glass-border);">
                        <div>
                            <span style="display: block; font-size: 0.75rem; font-weight: 400; color: var(--text-tertiary); margin-bottom: 0.4rem; letter-spacing: 0.5px;">CONTATTI</span>
                            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                <a href="mailto:${c.email}" style="display: flex; gap: 0.6rem; align-items: center; color: var(--text-primary); text-decoration: none; font-weight: 500;">
                                    <span class="material-icons-round" style="font-size: 1.1rem; color: var(--brand-blue);">email</span>
                                    ${c.email || '-'}
                                </a>
                                <a href="tel:${c.phone}" style="display: flex; gap: 0.6rem; align-items: center; color: var(--text-primary); text-decoration: none; font-weight: 500;">
                                    <span class="material-icons-round" style="font-size: 1.1rem; color: var(--brand-blue);">call</span>
                                    ${c.phone || '-'}
                                </a>
                            </div>
                        </div>
                        
                         <div>
                            <span style="display: block; font-size: 0.75rem; font-weight: 400; color: var(--text-tertiary); margin-bottom: 0.4rem; letter-spacing: 0.5px;">INDIRIZZO</span>
                            <div style="display: flex; gap: 0.6rem; align-items: flex-start; color: var(--text-primary); font-weight: 500;">
                                <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary); margin-top: 1px;">place</span>
                                <span>${c.address || '-'}</span>
                            </div>
                        </div>

                        <div>
                            <span style="display: block; font-size: 0.75rem; font-weight: 400; color: var(--text-tertiary); margin-bottom: 0.4rem; letter-spacing: 0.5px;">DATI FISCALI</span>
                            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                                <div style="display:flex; justify-content: space-between;">
                                    <span style="color: var(--text-secondary); font-size: 0.85rem;">CF</span>
                                    <span style="font-family: monospace; font-size: 0.9rem;">${c.fiscal_code || '-'}</span>
                                </div>
                                <div style="display:flex; justify-content: space-between;">
                                    <span style="color: var(--text-secondary); font-size: 0.85rem;">P.IVA</span>
                                    <span style="font-family: monospace; font-size: 0.9rem;">${c.vat_number || '-'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tabs Controls -->
            <div class="tabs-container" style="margin-bottom: 1.5rem; border-bottom: 1px solid var(--glass-border); display: flex; gap: 1.5rem;">
                <button class="tab-btn active" data-tab="overview" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 2px solid var(--brand-blue); color: var(--brand-blue); font-weight: 400; cursor: pointer;">Panoramica</button>
                <button class="tab-btn" data-tab="orders" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer;">Commesse (${collabOrders.length})</button>
                <button class="tab-btn" data-tab="invoices" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer;">Fatture (${collabInvoices.length})</button>
                <button class="tab-btn" data-tab="payments" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer;">Pagamenti (${collabPayments.length})</button>
                <button class="tab-btn" data-tab="availability" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer;">Disponibilità</button>
            </div>

            <!-- Tab Content: Overview -->
            <div id="tab-overview" class="tab-content">
                <div class="card-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 2rem;">
                    <div class="stats-card">
                        <div class="stats-header"><span>Totale Compenso</span></div>
                        <div class="stats-value">€ ${formatAmount(totalInvoiced)}</div>
                        <div class="stats-trend">Lordo</div>
                    </div>
                    <div class="stats-card">
                        <div class="stats-header"><span>Pagato</span></div>
                        <div class="stats-value">€ ${formatAmount(totalPaid)}</div>
                        <div class="stats-trend trend-up">Saldato</div>
                    </div>
                     <div class="stats-card">
                        <div class="stats-header"><span>Da Saldare</span></div>
                        <div class="stats-value">€ ${formatAmount(totalInvoiced - totalPaid)}</div>
                        <div class="stats-trend trend-down">Residuo</div>
                    </div>
                     <div class="stats-card">
                        <div class="stats-header"><span>Attività</span></div>
                        <div class="stats-value">${collabOrders.length}</div>
                        <div class="stats-trend">Commesse</div>
                    </div>
                </div>
            </div>

            <!-- Tab Content: Orders -->
            <div id="tab-orders" class="tab-content hidden">
                 <div class="table-container">
                    <table>
                        <thead><tr><th>N. Ordine</th><th>Data</th><th>Ruolo</th><th>Stato</th></tr></thead>
                        <tbody>
                            ${collabOrders.length ? collabOrders.map(o => `
                                <tr onclick="window.location.hash='order-detail/${o.id}'" style="cursor:pointer;">
                                    <td>${o.order_number}</td>
                                    <td>${new Date(o.order_date).toLocaleDateString()}</td>
                                    <td>${o.order_collaborators.find(oc => oc.collaborators.id === c.id)?.role_in_order || '-'}</td>
                                    <td><span class="status-badge">${o.status_works || 'In corso'}</span></td>
                                </tr>
                            `).join('') : '<tr><td colspan="4" style="text-align:center; padding:1rem;">Nessuna commessa attiva.</td></tr>'}
                        </tbody>
                    </table>
                 </div>
            </div>

            <!-- Tab Content: Invoices -->
            <div id="tab-invoices" class="tab-content hidden">
                 <div class="section-header">
                    <span>Storico Fatture</span>
                    <!-- <button class="primary-btn small" onclick="openPassiveInvoiceModalV2()">+ Registra Fattura</button> -->
                 </div>
                 <div class="table-container">
                    <table>
                        <thead><tr><th>Numero</th><th>Data</th><th>Imponibile</th><th>Stato</th></tr></thead>
                        <tbody>
                            ${collabInvoices.length ? collabInvoices.map(i => `
                                <tr>
                                    <td>${i.invoice_number}</td>
                                    <td>${new Date(i.issue_date).toLocaleDateString()}</td>
                                    <td>€ ${formatAmount(i.amount_tax_excluded)}</td>
                                    <td><span class="status-badge ${i.status === 'Pagato' ? 'status-active' : 'status-pending'}">${i.status}</span></td>
                                </tr>
                            `).join('') : '<tr><td colspan="4" style="text-align:center; padding:1rem;">Nessuna fattura registrata.</td></tr>'}
                        </tbody>
                    </table>
                 </div>
            </div>

            <!-- Tab Content: Payments -->
            <div id="tab-payments" class="tab-content hidden">
                 <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th style="color: var(--text-secondary); font-weight: 500; font-size: 0.85rem;"><span style="display:flex; align-items:center; gap:4px;">Data <span class="material-icons-round" style="font-size:14px">arrow_downward</span></span></th>
                                <th style="color: var(--text-secondary); font-weight: 500; font-size: 0.85rem;">Causale</th>
                                <th style="color: var(--text-secondary); font-weight: 500; font-size: 0.85rem;">Incarico</th>
                                <th style="color: var(--text-secondary); font-weight: 500; font-size: 0.85rem;">Cliente</th>
                                <th style="color: var(--text-secondary); font-weight: 500; font-size: 0.85rem;">Titolo Commessa</th>
                                <th style="color: var(--text-secondary); font-weight: 500; font-size: 0.85rem;">Importo</th>
                                <th style="color: var(--text-secondary); font-weight: 500; font-size: 0.85rem;">Stato</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${collabPayments.length ? collabPayments.map(p => `
                                <tr onclick="openPaymentModal('${p.id}')" style="cursor: pointer; transition: background 0.2s;">
                                    <td style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${new Date(p.due_date).toLocaleDateString()}</td>
                                    <td><span style="font-size: 0.9rem; color: var(--text-primary);">${p.title || '-'}</span></td>
                                    <td>
                                        ${p.orders?.order_number ?
            `<span style="border: 1px solid var(--glass-border); padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; color: var(--text-primary); background: white;">${p.orders.order_number}</span>`
            : '-'
        }
                                    </td>
                                    <td>
                                        ${p.clients?.business_name ?
            `<span style="border: 1px solid var(--glass-border); padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; color: var(--text-primary); background: white;">${p.clients.business_name}</span>`
            : '-'
        }
                                    </td>
                                    <td style="font-size: 0.9rem; color: var(--text-primary); max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.orders?.title || ''}">${p.orders?.title ? `"${p.orders.title}"` : '-'}</td>
                                    <td style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">€ ${formatAmount(p.amount)}</td>
                                    <td><span style="border: 1px solid var(--glass-border); padding: 4px 12px; border-radius: 12px; font-size: 0.8rem; color: var(--text-secondary); background: white;">${p.status || 'To Do'}</span></td>
                                </tr>
                            `).join('') : '<tr><td colspan="7" style="text-align:center; padding:2rem; color: var(--text-tertiary);">Nessun pagamento trovato.</td></tr>'}
                        </tbody>
                    </table>
                 </div>
            </div>

            <!-- Tab Content: Availability -->
            <div id="tab-availability" class="tab-content hidden">
                 <div class="card-grid" style="grid-template-columns: 1fr; gap: 1.5rem;">
                    <!-- Availability UI will be rendered here -->
                    <div id="availability-loading" style="padding: 2rem; text-align: center; color: var(--text-secondary);">Caricamento disponibilità...</div>
                    <div id="availability-container" class="hidden"></div>
                 </div>
            </div>
        </div>
    `;

    const tabs = container.querySelectorAll('.tab-btn');
    const contents = container.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.classList.remove('active');
                t.style.borderBottomColor = 'transparent';
                t.style.color = 'var(--text-secondary)';
            });
            contents.forEach(c => c.classList.add('hidden'));

            tab.classList.add('active');
            tab.style.borderBottomColor = 'var(--brand-blue)';
            tab.style.color = 'var(--brand-blue)';

            const targetId = 'tab-' + tab.dataset.tab;
            document.getElementById(targetId)?.classList.remove('hidden');

            if (tab.dataset.tab === 'availability') {
                initAvailabilityTab(c.id);
            }
        });
    });
}

// Function to handle Availability Tab Logic
async function initAvailabilityTab(collaboratorId) {
    const container = document.getElementById('availability-container');
    const loading = document.getElementById('availability-loading');

    // Check if already loaded
    if (container.dataset.loaded === 'true') {
        loading.style.display = 'none';
        container.classList.remove('hidden');
        return;
    }

    try {
        const [rules, extraSlots, allServices, bookingAssignments] = await Promise.all([
            fetchAvailabilityRules(collaboratorId),
            fetchAvailabilityOverrides(collaboratorId),
            fetchCollaboratorServices(),
            fetchBookingItemCollaborators(collaboratorId)
        ]);

        // Filter services for this collaborator (Legacy + Booking)
        const orderServices = allServices
            .filter(cs => cs.collaborator_id === collaboratorId)
            .map(cs => ({
                id: cs.service_id,
                name: cs.services?.name || 'Servizio'
            }));

        const bookingServices = bookingAssignments.map(ba => ({
            id: ba.booking_item_id,
            name: ba.booking_items?.name || 'Servizio Booking'
        }));

        const myServices = [...orderServices, ...bookingServices];

        renderAvailabilityEditor(container, collaboratorId, rules, extraSlots, myServices);
        container.dataset.loaded = 'true';
        loading.style.display = 'none';
        container.classList.remove('hidden');
    } catch (err) {
        console.error(err);
        loading.innerHTML = '<span style="color:red">Errore caricamento. Riprova.</span>';
    }
}

function renderAvailabilityEditor(container, collaboratorId, existingRules, extraSlots = [], myServices = []) {
    const days = [
        { id: 1, name: 'Lunedì' },
        { id: 2, name: 'Martedì' },
        { id: 3, name: 'Mercoledì' },
        { id: 4, name: 'Giovedì' },
        { id: 5, name: 'Venerdì' },
        { id: 6, name: 'Sabato' },
        { id: 0, name: 'Domenica' }
    ];

    // Helper to get rule for day
    const getRule = (dayId) => existingRules.find(r => r.day_of_week === dayId);

    const html = `
        <div class="glass-card" style="padding: 2rem;">
            <div style="margin-bottom: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 1rem;">
                <h3 style="margin: 0; font-size: 1.2rem;">Orari Settimanali</h3>
                <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary); font-size: 0.9rem;">Imposta gli orari standard di lavoro per questo collaboratore.</p>
            </div>

            <form id="availability-form">
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    ${days.map(day => {
        const rule = getRule(day.id);
        const isActive = !!rule;
        const start = rule ? rule.start_time.slice(0, 5) : '09:00';
        const end = rule ? rule.end_time.slice(0, 5) : '18:00';

        return `
                        <div class="day-row" data-day="${day.id}" style="display: grid; grid-template-columns: 120px 1fr auto; align-items: center; gap: 1rem; padding: 1rem; background: var(--bg-secondary); border-radius: 12px; border: 1px solid transparent; transition: border 0.2s;">
                            
                            <!-- Day Toggle -->
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <label class="switch" style="position: relative; display: inline-block; width: 40px; height: 24px;">
                                    <input type="checkbox" class="day-toggle" ${isActive ? 'checked' : ''} onchange="this.closest('.day-row').classList.toggle('active', this.checked)">
                                    <span class="slider round" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px;"></span>
                                </label>
                                <span style="font-weight: 500; font-size: 0.95rem;">${day.name}</span>
                            </div>

                            <!-- Time Inputs (Visible only if active) -->
                            <div class="time-inputs ${isActive ? '' : 'disabled'}" style="display: flex; align-items: center; gap: 1rem; opacity: ${isActive ? 1 : 0.4}; pointer-events: ${isActive ? 'auto' : 'none'};">
                                <input type="time" class="time-start" value="${start}" style="padding: 0.5rem; border: 1px solid var(--glass-border); border-radius: 8px; font-family: monospace;">
                                <span style="color: var(--text-tertiary);">fino alle</span>
                                <input type="time" class="time-end" value="${end}" style="padding: 0.5rem; border: 1px solid var(--glass-border); border-radius: 8px; font-family: monospace;">
                            </div>

                            <!-- Status Text -->
                            <div style="color: var(--text-tertiary); font-size: 0.85rem; font-style: italic;">
                                ${isActive ? 'Attivo' : 'Non lavorativo'}
                            </div>
                        </div>
                        `;
    }).join('')}
                </div>

                <div style="margin-top: 2rem; display: flex; justify-content: flex-end; gap: 1rem;">
                    <button type="submit" id="save-availability-btn" class="primary-btn">
                        <span class="material-icons-round">save</span>
                        Salva Disponibilità
                    </button>
                </div>
            </form>
        </div>

        <!-- Extra Availability Section -->
        <div class="glass-card" style="padding: 2rem; margin-top: 1.5rem; position: relative; overflow: hidden;">
            <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--brand-blue);"></div>
            <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin: 0; color: var(--brand-blue);">Disponibilità Extra (Date Specifiche)</h3>
                    <p style="margin: 0; opacity: 0.7; font-size: 0.9rem;">Aggiungi date singole in cui il collaboratore è disponibile.</p>
                </div>
                <button class="primary-btn" id="add-extra-slot-btn" style="background: var(--brand-gradient);">
                    <span class="material-icons-round">event_available</span> Aggiungi Data
                </button>
            </div>

            <div id="extra-slots-list" style="display: grid; gap: 0.8rem;">
                 <!-- List injected via JS -->
            </div>
        </div>
        
        <style>
            .switch input:checked + .slider { background-color: var(--brand-blue); }
            .switch input:checked + .slider:before { transform: translateX(16px); }
            .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; }
            .day-row.active { border-color: var(--brand-blue); background: white; box-shadow: var(--shadow-soft); }
        </style>
    `;

    container.innerHTML = html;

    // Handle Form Submit
    const form = container.querySelector('#availability-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('save-availability-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="material-icons-round animate-spin">refresh</span> Salvataggio...';
        btn.disabled = true;

        try {
            // Collect rules
            const rows = container.querySelectorAll('.day-row');
            const newRules = [];

            rows.forEach(row => {
                const dayId = parseInt(row.dataset.day);
                const toggle = row.querySelector('.day-toggle');

                if (toggle.checked) {
                    const start = row.querySelector('.time-start').value;
                    const end = row.querySelector('.time-end').value;

                    if (start && end) {
                        newRules.push({
                            day_of_week: dayId,
                            start_time: start,
                            end_time: end
                        });
                    }
                }
            });

            await saveAvailabilityRules(collaboratorId, newRules);
            window.showAlert('Disponibilità salvata con successo!', 'success');
        } catch (err) {
            console.error(err);
            window.showAlert('Errore salvataggio: ' + err.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    // Handle Toggle Changes for visual feedback
    const toggles = container.querySelectorAll('.day-toggle');
    toggles.forEach(t => {
        t.addEventListener('change', (e) => {
            const row = e.target.closest('.day-row');
            const inputs = row.querySelector('.time-inputs');
            const status = row.querySelector('div:last-child'); // Status text

            if (e.target.checked) {
                row.classList.add('active');
                inputs.style.opacity = '1';
                inputs.style.pointerEvents = 'auto';
                status.textContent = 'Attivo';
            } else {
                row.classList.remove('active');
                inputs.style.opacity = '0.4';
                inputs.style.pointerEvents = 'none';
                status.textContent = 'Non lavorativo';
            }
        });
    });

    // --- EXTRA AVAILABILITY LOGIC ---
    const renderExtraSlot = (slot) => {
        const startDate = new Date(slot.date).toLocaleDateString();
        const endDate = slot.end_date ? new Date(slot.end_date).toLocaleDateString() : null;
        const dateDisplay = endDate ? `${startDate} - ${endDate}` : startDate;

        return `
            <div class="glass-card" style="padding: 1rem; display: flex; justify-content: space-between; align-items: center; background: white; border-left: 3px solid var(--brand-blue); border-radius: 12px; box-shadow: var(--shadow-soft);">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: #E3F2FD; display: flex; align-items: center; justify-content: center; color: var(--brand-blue);">
                        <span class="material-icons-round">event</span>
                    </div>
                    <div>
                        <div style="font-weight: 500; color: var(--text-primary);">
                            ${dateDisplay} 
                            <span style="font-weight:400; color:var(--text-secondary); margin-left: 8px;">(${slot.start_time.slice(0, 5)} - ${slot.end_time.slice(0, 5)})</span>
                        </div>
                        <div style="font-size: 0.8rem; color: var(--brand-blue); font-weight: 500; margin-top: 2px;">
                            ${slot.services?.name || 'Tutti i servizi'}
                        </div>
                    </div>
                </div>
                <button class="icon-btn delete-override-btn" data-id="${slot.id}" title="Elimina" style="background: var(--bg-secondary); border-radius: 50%;">
                    <span class="material-icons-round" style="color: var(--error-color); font-size: 1.2rem;">delete_outline</span>
                </button>
            </div>
        `;
    };

    const extrasList = container.querySelector('#extra-slots-list');
    if (extrasList) {
        if (extraSlots && extraSlots.length > 0) {
            extrasList.innerHTML = extraSlots.map(renderExtraSlot).join('');
        } else {
            extrasList.innerHTML = '<p style="text-align:center; color:var(--text-tertiary); padding: 1rem; font-size: 0.9rem;">Nessuna disponibilità extra aggiunta.</p>';
        }
    }

    // Handlers
    container.querySelectorAll('.delete-override-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (await window.showConfirm('Eliminare questa disponibilità extra?')) {
                try {
                    await deleteAvailabilityOverride(btn.dataset.id);
                    initAvailabilityTab(collaboratorId);
                } catch (err) {
                    window.showAlert('Errore: ' + err.message, 'error');
                }
            }
        });
    });

    const addBtn = container.querySelector('#add-extra-slot-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            openExtraSlotModal(collaboratorId, myServices, () => initAvailabilityTab(collaboratorId));
        });
    }
}

function openExtraSlotModal(collaboratorId, services, onSuccess) {
    const serviceOptions = `
        <option value="">Tutti i servizi</option>
        ${services.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
    `;

    const content = `
        <div class="modal-header-premium" style="margin-bottom: 2rem; position: relative;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                    <span class="material-icons-round">event_available</span>
                </div>
                <div>
                    <h2 style="margin: 0; font-size: 1.3rem; font-weight: 600; color: var(--text-primary);">Aggiungi Disponibilità</h2>
                    <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary); font-weight: 400;">Definisci un giorno o un periodo specifico</p>
                </div>
            </div>
            <button class="icon-btn close-modal" style="position: absolute; top: -0.5rem; right: -0.5rem; background: white; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid var(--glass-border); transition: all 0.2s;">
                <span class="material-icons-round" style="font-size: 20px; color: var(--text-secondary);">close</span>
            </button>
        </div>

        <form id="extra-slot-form" class="premium-form">
            <!-- Periodo -->
            <div style="background: var(--bg-secondary); border-radius: 16px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h3 style="margin: 0 0 1rem 0; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-icons-round" style="font-size: 16px;">date_range</span>
                    Periodo
                </h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label style="font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem; display: block;">Data Inizio</label>
                        <input type="date" name="date" required value="${new Date().toISOString().split('T')[0]}" 
                            style="width: 100%; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 10px; font-size: 0.9rem; background: white; transition: all 0.2s; font-family: inherit;">
                    </div>
                    <div class="form-group">
                        <label style="font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem; display: block;">Data Fine <span style="font-weight: 400; color: var(--text-tertiary);">(Opzionale)</span></label>
                        <input type="date" name="end_date" 
                            style="width: 100%; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 10px; font-size: 0.9rem; background: white; transition: all 0.2s; font-family: inherit;">
                    </div>
                </div>
            </div>

            <!-- Orario -->
            <div style="background: var(--bg-secondary); border-radius: 16px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h3 style="margin: 0 0 1rem 0; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-icons-round" style="font-size: 16px;">schedule</span>
                    Orario
                </h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label style="font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem; display: block;">Dalle</label>
                        <input type="time" name="start_time" value="09:00" required
                            style="width: 100%; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 10px; font-size: 0.9rem; background: white; transition: all 0.2s; font-family: inherit;">
                    </div>
                    <div class="form-group">
                        <label style="font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem; display: block;">Alle</label>
                        <input type="time" name="end_time" value="18:00" required
                            style="width: 100%; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 10px; font-size: 0.9rem; background: white; transition: all 0.2s; font-family: inherit;">
                    </div>
                </div>
            </div>

            <!-- Servizio -->
            <div style="background: var(--bg-secondary); border-radius: 16px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h3 style="margin: 0 0 1rem 0; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-icons-round" style="font-size: 16px;">work_outline</span>
                    Servizio
                </h3>
                <div class="form-group">
                    <label style="font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem; display: block;">Servizio Dedicato <span style="font-weight: 400; color: var(--text-tertiary);">(Opzionale)</span></label>
                    <select name="service_id" 
                        style="width: 100%; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 10px; font-size: 0.9rem; background: white; transition: all 0.2s; cursor: pointer; font-family: inherit;">
                        ${serviceOptions}
                    </select>
                </div>
            </div>
            
            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; padding-top: 0.5rem;">
                <button type="submit" class="primary-btn" style="min-width: 160px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 0.875rem 2rem; border-radius: 12px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3); transition: all 0.2s; border: none; color: white; cursor: pointer; font-size: 0.95rem;">
                    <span style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="material-icons-round" style="font-size: 18px;">check</span>
                        Salva Disponibilità
                    </span>
                </button>
            </div>
        </form>
    `;

    const overlay = document.createElement('div');
    overlay.className = 'modal active';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(12px);
        display: flex; align-items: center; justify-content: center; z-index: 9999;
    `;

    overlay.innerHTML = `
        <div class="modal-content animate-scale-in" style="
            background: white;
            border-radius: 24px;
            padding: 2.5rem;
            width: 100%;
            max-width: 650px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            max-height: 90vh;
            overflow-y: auto;
        ">
            ${content}
        </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', close));

    overlay.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const data = {
            collaborator_id: collaboratorId,
            date: formData.get('date'),
            end_date: formData.get('end_date') || null,
            start_time: formData.get('start_time'),
            end_time: formData.get('end_time'),
            service_id: formData.get('service_id') || null,
            is_available: true
        };

        const btn = overlay.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerText = 'Salvataggio...';

        try {
            await upsertAvailabilityOverride(data);
            window.showAlert('Disponibilità salvata!', 'success');
            close();
            onSuccess();
        } catch (err) {
            console.error(err);
            btn.disabled = false;
            btn.innerText = 'Salva Apertura';
            window.showAlert('Errore: ' + err.message, 'error');
        }
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });
}
