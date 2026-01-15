import { state } from '../modules/state.js?v=123';
import { formatAmount } from '../modules/utils.js?v=123';
import { openDepartmentManager } from './settings.js?v=123';
import { upsertCollaborator, fetchPayments, fetchAssignments, fetchPassiveInvoices, fetchAvailabilityRules, saveAvailabilityRules, fetchAvailabilityOverrides, upsertAvailabilityOverride, deleteAvailabilityOverride, fetchCollaboratorServices, fetchBookingItemCollaborators } from '../modules/api.js?v=123';

export function renderCollaborators(container) {
    const renderGrid = () => {
        const filtered = state.collaborators.filter(c => {
            const matchesSearch = c.full_name.toLowerCase().includes(state.searchTerm.toLowerCase());
            const tags = Array.isArray(c.tags) ? c.tags : (typeof c.tags === 'string' ? c.tags.split(',') : []);
            const matchesDept = !state.selectedDepartment || tags.includes(state.selectedDepartment);
            // Filter by active status: show inactive only if toggle is on
            const isActive = c.is_active !== false; // Default to true if not set
            const matchesActive = state.showInactiveCollaborators || isActive;
            return matchesSearch && matchesDept && matchesActive;
        }).sort((a, b) => {
            const nameA = (a.last_name || a.full_name.trim().split(' ').pop() || '').toLowerCase();
            const nameB = (b.last_name || b.full_name.trim().split(' ').pop() || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });

        const html = filtered.map(c => {
            const isInactive = c.is_active === false;
            return `
        <div class="card collaborator-card ${isInactive ? 'inactive' : ''}" onclick="window.location.hash='collaborator-detail/${c.id}'" style="cursor:pointer; padding: 1.25rem; display: flex; flex-direction: column; align-items: start; text-align: left; gap: 0.75rem; position: relative; overflow: hidden; height: 100%; ${isInactive ? 'opacity: 0.6;' : ''}">
            
            ${isInactive ? `<span style="position: absolute; top: 0.75rem; right: 0.75rem; background: var(--text-tertiary); color: white; font-size: 0.7rem; padding: 2px 8px; border-radius: 4px; font-weight: 500;">INATTIVO</span>` : ''}
            
            <div style="display: flex; width: 100%; justify-content: space-between; align-items: flex-start;">
                 <div style="width: 56px; height: 56px; border-radius: 50%; background: ${isInactive ? 'var(--text-tertiary)' : 'var(--brand-gradient)'}; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.4rem; font-weight: 400; box-shadow: var(--shadow-soft); flex-shrink: 0;">
                    ${c.avatar_url ? `<img src="${c.avatar_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover; border: 2px solid white; ${isInactive ? 'filter: grayscale(100%);' : ''}">` : c.full_name[0]}
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
    `;
        }).join('');
        return html;
    };

    if (!container.querySelector('.pills-container')) {
        container.innerHTML = `
        <div class="animate-fade-in">
            <div class="section-header" style="display:block; margin-bottom: 2rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="font-size: 1.1rem; font-weight: 400; color: var(--text-primary);">Membri Attivi</span>
                        <span id="collab-count-badge" style="background: var(--brand-blue); color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.9rem; font-weight: 400;">${state.collaborators.filter(c => c.is_active !== false).length}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <button class="secondary-btn" id="toggle-inactive-btn" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border: 1px solid var(--glass-border); background: ${state.showInactiveCollaborators ? 'var(--bg-secondary)' : 'white'}; color: var(--text-secondary); border-radius: 8px;">
                            <span class="material-icons-round" style="font-size: 1rem;">${state.showInactiveCollaborators ? 'visibility' : 'visibility_off'}</span>
                            ${state.showInactiveCollaborators ? 'Nascondi Inattivi' : 'Mostra Inattivi'}
                            ${!state.showInactiveCollaborators ? `<span style="background: var(--text-tertiary); color: white; padding: 1px 6px; border-radius: 8px; font-size: 0.75rem; margin-left: 0.25rem;">${state.collaborators.filter(c => c.is_active === false).length}</span>` : ''}
                        </button>
                        <button class="primary-btn" onclick="openCollaboratorModal()">
                            <span class="material-icons-round">add</span>
                            Nuovo
                        </button>
                    </div>
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

        // Toggle inactive collaborators button
        const toggleInactiveBtn = container.querySelector('#toggle-inactive-btn');
        if (toggleInactiveBtn) {
            toggleInactiveBtn.addEventListener('click', () => {
                state.showInactiveCollaborators = !state.showInactiveCollaborators;
                // Re-render the entire view to update button state and grid
                container.innerHTML = '';
                renderCollaborators(container);
            });
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
                const isActive = c.is_active !== false;
                const matchesActive = state.showInactiveCollaborators || isActive;
                return matchesSearch && matchesDept && matchesActive;
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
        const deleteBtn = document.getElementById('delete-collab-btn');

        // Toggle elements
        const hiddenInput = document.getElementById('collab-is-active');
        const toggleEl = document.getElementById('collab-active-toggle');
        const knob = toggleEl?.querySelector('.toggle-knob');
        const label = document.getElementById('collab-active-label');

        // Helper to set toggle state
        const setToggleState = (isActive) => {
            if (hiddenInput) hiddenInput.value = isActive ? 'true' : 'false';
            if (toggleEl) toggleEl.style.background = isActive ? 'var(--brand-blue)' : '#ccc';
            if (knob) knob.style.left = isActive ? '27px' : '3px';
            if (label) label.textContent = isActive ? 'Attivo' : 'Inattivo';
        };

        if (collaboratorId) {
            title.textContent = 'Modifica Collaboratore';
            // Show delete button for existing collaborators
            if (deleteBtn) {
                deleteBtn.style.display = 'flex';
                deleteBtn.dataset.collabId = collaboratorId;
            }
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

                // Handle is_active - set visual state
                setToggleState(c.is_active !== false);

                // Handle Tags
                let tags = c.tags;
                if (typeof tags === 'string') {
                    try { tags = JSON.parse(tags); } catch (e) { tags = tags.split(',').map(t => t.trim()); }
                }
                if (!Array.isArray(tags)) tags = [];
                document.getElementById('collab-tags').value = JSON.stringify(tags);
                if (window.renderSelectedTags) window.renderSelectedTags(tags);
            }
        } else {
            title.textContent = 'Nuovo Collaboratore';
            idInput.value = '';
            // Hide delete button for new collaborators
            if (deleteBtn) {
                deleteBtn.style.display = 'none';
            }
            // Default is_active to true for new collaborators
            setToggleState(true);
            document.getElementById('collab-tags').value = '[]';
            if (window.renderSelectedTags) window.renderSelectedTags([]);
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
                                        <div id="dept-multiselect" class="dept-multiselect" style="position: relative;">
                                            <div id="collab-tags-field" class="tag-field" tabindex="0" style="min-height: 42px; padding: 8px 12px; border: 1px solid var(--border-light); border-radius: 8px; cursor: pointer; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; background: white;">
                                                <span class="placeholder" style="color: var(--text-tertiary);">Seleziona reparti...</span>
                                            </div>
                                            <div id="dept-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid var(--border-light); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000; max-height: 250px; overflow-y: auto; margin-top: 4px;">
                                                <!-- Options will be rendered here -->
                                            </div>
                                        </div>
                                        <input type="hidden" id="collab-tags">
                                    </div>
                                    <div class="form-group full-width"><label>P.IVA</label><input type="text" id="collab-vat-number"></div>
                                </div>
                            </div>
                            <div class="modal-section full-width">
                                <div class="section-title"><span class="material-icons-round">toggle_on</span><h4>Stato</h4></div>
                                <div class="form-grid">
                                    <div class="form-group" style="display: flex; align-items: center; gap: 1rem;">
                                        <div id="collab-active-toggle" class="active-toggle" style="width: 52px; height: 28px; border-radius: 14px; background: var(--brand-blue); cursor: pointer; position: relative; transition: background 0.3s; flex-shrink: 0;">
                                            <div class="toggle-knob" style="width: 22px; height: 22px; border-radius: 50%; background: white; position: absolute; top: 3px; left: 27px; transition: left 0.3s; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"></div>
                                        </div>
                                        <input type="hidden" id="collab-is-active" value="true">
                                        <div>
                                            <span id="collab-active-label" style="font-weight: 500; color: var(--text-primary);">Attivo</span>
                                            <p style="margin: 0; font-size: 0.8rem; color: var(--text-tertiary);">Gli inattivi non appaiono nella lista</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="form-actions" style="margin-top:2rem; padding-top:1rem; border-top:1px solid #eee; display: flex; justify-content: space-between;">
                            <button type="button" class="primary-btn danger" id="delete-collab-btn" style="display: none; background: #dc3545; border-color: #dc3545;">
                                <span class="material-icons-round">delete</span>
                                Elimina
                            </button>
                            <div style="display: flex; gap: 0.75rem; margin-left: auto;">
                                <button type="button" class="primary-btn secondary" id="cancel-collab-modal-btn">Annulla</button>
                                <button type="submit" class="primary-btn">Salva</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        `);

        // Close logic
        const close = () => document.getElementById('collaborator-modal').classList.remove('active');
        document.getElementById('close-collab-modal-btn')?.addEventListener('click', close);
        document.getElementById('cancel-collab-modal-btn')?.addEventListener('click', close);

        // Active toggle click handler
        document.getElementById('collab-active-toggle')?.addEventListener('click', function () {
            const hiddenInput = document.getElementById('collab-is-active');
            const knob = this.querySelector('.toggle-knob');
            const label = document.getElementById('collab-active-label');
            const isCurrentlyActive = hiddenInput.value === 'true';

            if (isCurrentlyActive) {
                // Switch to inactive
                hiddenInput.value = 'false';
                this.style.background = '#ccc';
                knob.style.left = '3px';
                label.textContent = 'Inattivo';
            } else {
                // Switch to active
                hiddenInput.value = 'true';
                this.style.background = 'var(--brand-blue)';
                knob.style.left = '27px';
                label.textContent = 'Attivo';
            }
        });

        // Submit Logic
        document.getElementById('collaborator-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = {
                id: document.getElementById('collab-id').value || undefined,
                first_name: document.getElementById('collab-first-name').value,
                last_name: document.getElementById('collab-last-name').value,
                birth_date: document.getElementById('collab-birth-date').value || null,
                birth_place: document.getElementById('collab-birth-place').value || null,
                fiscal_code: document.getElementById('collab-fiscal-code').value || null,
                email: document.getElementById('collab-email').value || null, // null instead of empty string
                phone: document.getElementById('collab-phone').value || null,
                address: document.getElementById('collab-address').value || null,
                pec: document.getElementById('collab-pec').value || null,
                name: document.getElementById('collab-name').value,
                role: document.getElementById('collab-role').value,
                vat_number: document.getElementById('collab-vat-number').value || null,
                tags: JSON.parse(document.getElementById('collab-tags').value || '[]'),
                full_name: `${document.getElementById('collab-first-name').value} ${document.getElementById('collab-last-name').value}`,
                is_active: document.getElementById('collab-is-active').value === 'true'
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

        // Delete button handler
        document.getElementById('delete-collab-btn')?.addEventListener('click', async () => {
            const collabId = document.getElementById('delete-collab-btn').dataset.collabId;
            const c = state.collaborators.find(x => x.id == collabId);
            if (!c) return;

            if (await window.showConfirm(`Sei sicuro di voler eliminare ${c.full_name}? Questa azione è irreversibile.`)) {
                try {
                    const { deleteCollaborator } = await import('../modules/api.js?v=123');
                    await deleteCollaborator(collabId);
                    close();
                    window.showAlert('Collaboratore eliminato con successo', 'success');
                    // Navigate back to list
                    window.location.hash = 'employees';
                } catch (err) {
                    window.showAlert('Errore durante l\'eliminazione: ' + err.message, 'error');
                    console.error(err);
                }
            }
        });

        // Initialize department multiselect
        window.initDeptMultiselect();
    }
}

// Department Multi-Select Logic
window.initDeptMultiselect = () => {
    const field = document.getElementById('collab-tags-field');
    const dropdown = document.getElementById('dept-dropdown');
    const hiddenInput = document.getElementById('collab-tags');

    if (!field || !dropdown) return;

    // Toggle dropdown on click
    field.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.style.display !== 'none';

        if (isOpen) {
            dropdown.style.display = 'none';
        } else {
            renderDeptOptions();
            dropdown.style.display = 'block';
        }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#dept-multiselect')) {
            dropdown.style.display = 'none';
        }
    });

    function renderDeptOptions() {
        const selectedTags = JSON.parse(hiddenInput.value || '[]');
        const departments = state.departments || [];

        // If no departments in state, use unique tags from collaborators
        let options = departments.map(d => d.name);
        if (options.length === 0) {
            const allTags = new Set();
            state.collaborators.forEach(c => {
                const tags = Array.isArray(c.tags) ? c.tags : (typeof c.tags === 'string' ? c.tags.split(',').map(t => t.trim()) : []);
                tags.forEach(t => allTags.add(t));
            });
            options = Array.from(allTags).filter(Boolean).sort();
        }

        dropdown.innerHTML = options.map(opt => `
            <label style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer; transition: background 0.15s; border-bottom: 1px solid var(--border-light);"
                   onmouseover="this.style.background='var(--bg-secondary)'" 
                   onmouseout="this.style.background='white'">
                <input type="checkbox" value="${opt}" ${selectedTags.includes(opt) ? 'checked' : ''} 
                       style="width: 16px; height: 16px; accent-color: var(--brand-blue);">
                <span style="font-size: 0.95rem;">${opt}</span>
            </label>
        `).join('') || `<div style="padding: 14px; color: var(--text-tertiary); text-align: center;">Nessun reparto disponibile</div>`;

        // Add listeners to checkboxes
        dropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => updateSelectedTags());
        });
    }

    function updateSelectedTags() {
        const checked = Array.from(dropdown.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        hiddenInput.value = JSON.stringify(checked);
        renderSelectedTags(checked);
    }

    window.renderSelectedTags = (tags) => {
        const placeholder = field.querySelector('.placeholder');

        // Remove old tags but keep placeholder
        field.querySelectorAll('.dept-tag').forEach(t => t.remove());

        if (tags.length === 0) {
            if (placeholder) placeholder.style.display = 'inline';
            return;
        }

        if (placeholder) placeholder.style.display = 'none';

        tags.forEach(tag => {
            const tagEl = document.createElement('span');
            tagEl.className = 'dept-tag';
            tagEl.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: var(--brand-blue); color: white; border-radius: 20px; font-size: 0.85rem; font-weight: 500;';
            tagEl.innerHTML = `${tag}<span class="remove-tag" data-tag="${tag}" style="cursor: pointer; margin-left: 4px; font-size: 1rem; opacity: 0.8;">&times;</span>`;
            field.appendChild(tagEl);
        });

        // Add remove listeners
        field.querySelectorAll('.remove-tag').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tagToRemove = btn.dataset.tag;
                const current = JSON.parse(hiddenInput.value || '[]');
                const updated = current.filter(t => t !== tagToRemove);
                hiddenInput.value = JSON.stringify(updated);
                renderSelectedTags(updated);
                // Update dropdown checkboxes if open
                const cb = dropdown.querySelector(`input[value="${tagToRemove}"]`);
                if (cb) cb.checked = false;
            });
        });
    };
};

// Legacy function - now just opens the dropdown
window.openDeptSelector = () => {
    const field = document.getElementById('collab-tags-field');
    if (field) field.click();
};

window.impersonateCollaborator = async (collaboratorId) => {
    const c = state.collaborators.find(x => x.id == collaboratorId);
    if (!c) return;

    if (await window.showConfirm(`Vuoi impersonare ${c.full_name}? Vedrai l'interfaccia come se fossi questo collaboratore.`)) {
        state.impersonatedRole = 'collaborator';
        state.impersonatedCollaboratorId = c.id;

        // Update Sidebar
        import('./layout.js?v=123').then(({ updateSidebarVisibility, renderSidebarProfile }) => {
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
            const { supabase } = await import('../modules/config.js?v=123');
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

    // Ensure payments and other data are loaded
    if (!state.payments || !state.assignments || !state.passiveInvoices) {
        Promise.all([fetchPayments(), fetchAssignments(), fetchPassiveInvoices()]).then(() => renderCollaboratorDetail(container));
        return;
    }

    const collabOrders = state.orders.filter(o =>
        o.order_collaborators && o.order_collaborators.some(oc => oc.collaborators && oc.collaborators.id === c.id)
    );
    const collabInvoices = state.passiveInvoices.filter(i => i.collaborator_id === c.id);
    const collabPayments = state.payments.filter(p => p.collaborator_id === c.id);
    const collabAssignments = state.assignments ? state.assignments.filter(a => a.collaborator_id === c.id) : [];

    // Calculations
    const totalInvoiced = collabInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount_tax_excluded) || 0), 0);
    const totalPaid = collabInvoices
        .filter(inv => inv.status === 'Pagato')
        .reduce((sum, inv) => sum + (parseFloat(inv.amount_tax_excluded) || 0), 0);

    // Status color
    const isActive = c.is_active !== false;
    const statusColor = isActive ? '#10b981' : '#ef4444';
    const statusText = isActive ? 'Attivo' : 'Inattivo';

    // Initials & Avatar Color
    const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
    const getAvatarColor = (name) => {
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
        let hash = 0;
        for (let i = 0; i < (name || '').length; i++) { hash = (name || '').charCodeAt(i) + ((hash << 5) - hash); }
        return colors[Math.abs(hash) % colors.length];
    };
    const avatarColor = getAvatarColor(c.full_name);

    // Tags
    let tags = [];
    if (Array.isArray(c.tags)) {
        tags = c.tags;
    } else if (typeof c.tags === 'string') {
        try {
            const parsed = JSON.parse(c.tags);
            if (Array.isArray(parsed)) tags = parsed;
            else tags = c.tags.split(',');
        } catch (e) {
            tags = c.tags.split(',');
        }
    }
    tags = tags.map(t => t.trim()).filter(Boolean);

    container.innerHTML = `
        <div class="animate-fade-in" style="max-width: 1400px; margin: 0 auto; padding: 1rem;">
            
            <!-- Header Section -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; background: var(--bg-secondary); padding: 1.5rem 2rem; border-radius: 16px; border: 1px solid var(--glass-border);">
                <div style="display: flex; align-items: center; gap: 1.5rem;">
                    <!-- Avatar -->
                    <div style="width: 64px; height: 64px; border-radius: 18px; background: linear-gradient(135deg, ${avatarColor}, ${avatarColor}dd); display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px ${avatarColor}40; font-size: 1.5rem; color: white; font-weight: 600;">
                        ${c.avatar_url ? `<img src="${c.avatar_url}" style="width:100%; height:100%; border-radius:18px; object-fit:cover;">` : getInitials(c.full_name)}
                    </div>
                    
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.4rem;">
                             <h1 style="font-size: 2rem; font-weight: 700; margin: 0; color: var(--text-primary); font-family: var(--font-titles); letter-spacing: -0.02em;">${c.full_name}</h1>
                             <span class="status-badge" style="display: inline-flex; align-items: center; gap: 4px; background: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}30; font-size: 0.75rem; padding: 4px 10px; border-radius: 2rem; font-weight: 600;">
                                <span style="width: 6px; height: 6px; border-radius: 50%; background: ${statusColor};"></span>
                                ${statusText}
                             </span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 1rem; color: var(--text-tertiary); font-size: 0.9rem;">
                            <span style="display: flex; align-items: center; gap: 0.4rem; font-weight: 500;">
                                ${c.role || 'Ruolo non definito'}
                            </span>
                            ${c.name ? `<span style="display: flex; align-items: center; gap: 0.4rem; padding: 2px 8px; background: rgba(0,0,0,0.05); border-radius: 6px; font-family: monospace; font-size: 0.8rem;">${c.name}</span>` : ''}
                        </div>
                    </div>
                </div>

                <div style="display: flex; gap: 0.75rem;">
                    <button class="primary-btn secondary" onclick="window.history.back()" style="padding: 0.6rem 1.25rem; border-radius: 10px;">
                        <span class="material-icons-round">arrow_back</span> Indietro
                    </button>
                    ${state.profile?.role === 'admin' ? `
                        <button class="primary-btn secondary" onclick="impersonateCollaborator('${c.id}')" title="Vedi come ${c.first_name || 'Utente'}" style="padding: 0.6rem; border-radius: 10px;">
                            <span class="material-icons-round">visibility</span>
                        </button>
                    ` : ''}
                    <button class="primary-btn secondary" onclick="sendMagicLink('${c.email || ''}')" title="Invia Magic Link" style="padding: 0.6rem 1.25rem; border-radius: 10px; display: flex; align-items: center; gap: 0.5rem;">
                        <span class="material-icons-round">auto_fix_high</span> Magic Link
                    </button>
                    <button class="primary-btn" onclick="openCollaboratorModal('${c.id}')" style="padding: 0.6rem 1.25rem; border-radius: 10px;">
                        <span class="material-icons-round">edit</span> Modifica
                    </button>
                </div>
            </div>

            <!-- Stats Row -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
                 <div class="glass-card" style="padding: 1.25rem;">
                    <div style="color: var(--text-tertiary); font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Totale Compenso</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); font-family: var(--font-titles);">€ ${formatAmount(totalInvoiced)}</div>
                </div>
                <div class="glass-card" style="padding: 1.25rem;">
                    <div style="color: var(--text-tertiary); font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Saldato</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: #10b981; font-family: var(--font-titles);">€ ${formatAmount(totalPaid)}</div>
                </div>
                <div class="glass-card" style="padding: 1.25rem;">
                    <div style="color: var(--text-tertiary); font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Da Saldare</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: #f59e0b; font-family: var(--font-titles);">€ ${formatAmount(totalInvoiced - totalPaid)}</div>
                </div>
                <div class="glass-card" style="padding: 1.25rem;">
                    <div style="color: var(--text-tertiary); font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Commesse Attive</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--brand-blue); font-family: var(--font-titles);">${collabAssignments.filter(a => a.status !== 'Completed').length}</div>
                </div>
            </div>

            <!-- Main Content Grid -->
            <div style="display: grid; grid-template-columns: 320px 1fr; gap: 1.5rem; align-items: start;">
                
                <!-- Left Column: Profile Info -->
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    
                    <!-- Contacts Card -->
                     <div class="glass-card" style="padding: 1.25rem;">
                        <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span class="material-icons-round" style="color: var(--brand-blue); font-size: 1.1rem;">badge</span> Dati Personali
                        </h3>
                        
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            ${tags.length > 0 ? `
                                <div>
                                    <div style="font-size: 0.7rem; color: var(--text-tertiary); font-weight: 600; margin-bottom: 0.4rem;">Reparti</div>
                                    <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
                                        ${tags.map(t => `<span style="font-size: 0.75rem; color: var(--brand-blue); background: rgba(59, 130, 246, 0.1); padding: 2px 8px; border-radius: 6px; font-weight: 500;">${t}</span>`).join('')}
                                    </div>
                                </div>
                            ` : ''}

                            <div>
                                <div style="font-size: 0.7rem; color: var(--text-tertiary); font-weight: 600; margin-bottom: 0.4rem;">Contatti</div>
                                <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                                    <a href="mailto:${c.email}" style="display: flex; gap: 0.6rem; align-items: center; color: var(--text-primary); text-decoration: none; font-size: 0.9rem;">
                                        <span class="material-icons-round" style="font-size: 1rem; color: var(--text-tertiary);">email</span>
                                        <span style="overflow: hidden; text-overflow: ellipsis;">${c.email || '-'}</span>
                                    </a>
                                    <a href="tel:${c.phone}" style="display: flex; gap: 0.6rem; align-items: center; color: var(--text-primary); text-decoration: none; font-size: 0.9rem;">
                                        <span class="material-icons-round" style="font-size: 1rem; color: var(--text-tertiary);">call</span>
                                        ${c.phone || '-'}
                                    </a>
                                    <div style="display: flex; gap: 0.6rem; align-items: center; color: var(--text-primary); font-size: 0.9rem;">
                                        <span class="material-icons-round" style="font-size: 1rem; color: var(--text-tertiary);">place</span>
                                        <span style="line-height: 1.3;">${c.address || '-'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Fiscal Data Card -->
                     <div class="glass-card" style="padding: 1.25rem;">
                        <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span class="material-icons-round" style="color: var(--brand-blue); font-size: 1.1rem;">account_balance</span> Dati Fiscali
                        </h3>
                         <div style="display: flex; flex-direction: column; gap: 0.8rem;">
                             <div style="display: flex; justify-content: space-between; align-items: center;">
                                 <span style="font-size: 0.8rem; color: var(--text-secondary);">P.IVA</span>
                                 <span style="font-size: 0.85rem; font-weight: 500; font-family: monospace;">${c.vat_number || '-'}</span>
                             </div>
                             <div style="display: flex; justify-content: space-between; align-items: center;">
                                 <span style="font-size: 0.8rem; color: var(--text-secondary);">Cod. Fiscale</span>
                                 <span style="font-size: 0.85rem; font-weight: 500; font-family: monospace;">${c.fiscal_code || '-'}</span>
                             </div>
                             ${c.pec ? `
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                     <span style="font-size: 0.8rem; color: var(--text-secondary);">PEC</span>
                                     <span style="font-size: 0.85rem; font-weight: 500;">${c.pec}</span>
                                 </div>
                             ` : ''}
                         </div>
                    </div>
                </div>

                <!-- Right Column: Activity Tabs -->
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                    
                    <!-- Tabs Navigation -->
                    <div style="display: flex; gap: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem;">
                        <button class="tab-btn active" data-tab="assignments" id="btn-tab-assignments" style="padding: 0.5rem 0; background: none; border: none; font-size: 0.95rem; font-weight: 600; color: var(--brand-blue); cursor: pointer; border-bottom: 2px solid var(--brand-blue); transition: all 0.2s;">Incarichi (${collabAssignments.length})</button>
                        <button class="tab-btn" data-tab="payments" id="btn-tab-payments" style="padding: 0.5rem 0; background: none; border: none; font-size: 0.95rem; font-weight: 500; color: var(--text-tertiary); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s;">Pagamenti (${collabPayments.length})</button>
                        <button class="tab-btn" data-tab="invoices" id="btn-tab-invoices" style="padding: 0.5rem 0; background: none; border: none; font-size: 0.95rem; font-weight: 500; color: var(--text-tertiary); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s;">Fatture (${collabInvoices.length})</button>
                        <button class="tab-btn" data-tab="availability" id="btn-tab-availability" style="padding: 0.5rem 0; background: none; border: none; font-size: 0.95rem; font-weight: 500; color: var(--text-tertiary); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s;">Disponibilità</button>
                    </div>

                    <!-- Assignments Tab -->
                    <div id="tab-assignments" class="tab-content">
                        ${collabAssignments.length > 0 ? `
                            <div class="glass-card" style="padding: 0; overflow: hidden;">
                                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                                    <thead style="background: var(--bg-secondary); color: var(--text-tertiary); font-size: 0.75rem; text-transform: uppercase;">
                                        <tr>
                                            <th style="padding: 1rem;">Commessa</th>
                                            <th style="padding: 1rem;">Ruolo/Servizio</th>
                                            <th style="padding: 1rem;">Importo</th>
                                            <th style="padding: 1rem;">Stato</th>
                                            <th style="padding: 1rem;"></th>
                                        </tr>
                                    </thead>
                                    <tbody style="font-size: 0.9rem;">
                                        ${collabAssignments.map(a => `
                                            <tr style="border-bottom: 1px solid var(--glass-border); cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'" onclick="window.location.hash='assignment-detail/${a.id}'">
                                                <td style="padding: 1rem; font-weight: 500;">
                                                    ${a.orders ? a.orders.order_number : (a.legacy_order_id || '-')}
                                                    <div style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: 400;">${a.orders?.clients?.business_name || '-'}</div>
                                                </td>
                                                <td style="padding: 1rem; color: var(--text-secondary);">${a.role || 'Collaboratore'}</td>
                                                <td style="padding: 1rem; font-weight: 600;">${formatAmount(a.total_amount)}€</td>
                                                <td style="padding: 1rem;">
                                                    <span class="status-badge" style="background: ${a.status === 'Completed' ? '#10b98115' : '#3b82f615'}; color: ${a.status === 'Completed' ? '#10b981' : '#3b82f6'}; border: 1px solid ${a.status === 'Completed' ? '#10b98130' : '#3b82f630'}; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem;">${a.status || 'Active'}</span>
                                                </td>
                                                 <td style="padding: 1rem; text-align: right;"><span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary);">chevron_right</span></td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `<div style="text-align: center; padding: 3rem; background: var(--bg-secondary); border-radius: 12px; color: var(--text-tertiary); font-size: 0.9rem;">Nessun incarico presente</div>`}
                    </div>

                     <!-- Payments Tab -->
                    <div id="tab-payments" class="tab-content hidden">
                        ${collabPayments.length > 0 ? `
                             <div class="glass-card" style="padding: 0; overflow: hidden;">
                                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                                    <thead style="background: var(--bg-secondary); color: var(--text-tertiary); font-size: 0.75rem; text-transform: uppercase;">
                                        <tr>
                                            <th style="padding: 1rem;">Titolo</th>
                                            <th style="padding: 1rem;">Scadenza</th>
                                            <th style="padding: 1rem;">Importo</th>
                                            <th style="padding: 1rem;">Stato</th>
                                        </tr>
                                    </thead>
                                    <tbody style="font-size: 0.9rem;">
                                        ${collabPayments.map(p => `
                                            <tr style="border-bottom: 1px solid var(--glass-border); transition: background 0.2s;">
                                                <td style="padding: 1rem; font-weight: 500; color: var(--text-primary);">
                                                    ${p.title || 'Pagamento'}
                                                    <div style="font-size: 0.75rem; color: var(--text-tertiary);">Ord. ${p.orders?.order_number || '-'}</div>
                                                </td>
                                                <td style="padding: 1rem; color: var(--text-secondary);">${p.due_date ? new Date(p.due_date).toLocaleDateString() : '-'}</td>
                                                <td style="padding: 1rem; font-weight: 600;">${formatAmount(p.amount)}€</td>
                                                <td style="padding: 1rem;">
                                                    <span class="status-badge" style="background: ${p.status === 'Saldato' || p.status === 'Pagato' ? '#10b98115' : '#f59e0b15'}; color: ${p.status === 'Saldato' || p.status === 'Pagato' ? '#10b981' : '#f59e0b'}; border: 1px solid ${p.status === 'Saldato' || p.status === 'Pagato' ? '#10b98130' : '#f59e0b30'}; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem;">${p.status}</span>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `<div style="text-align: center; padding: 3rem; background: var(--bg-secondary); border-radius: 12px; color: var(--text-tertiary); font-size: 0.9rem;">Nessun pagamento registrato</div>`}
                    </div>
                    
                    <!-- Invoices Tab -->
                    <div id="tab-invoices" class="tab-content hidden">
                        ${collabInvoices.length > 0 ? `
                            <div class="glass-card" style="padding: 0; overflow: hidden;">
                                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                                    <thead style="background: var(--bg-secondary); color: var(--text-tertiary); font-size: 0.75rem; text-transform: uppercase;">
                                        <tr>
                                            <th style="padding: 1rem;">Numero</th>
                                            <th style="padding: 1rem;">Data Invio</th>
                                            <th style="padding: 1rem;">Data Saldo</th>
                                            <th style="padding: 1rem;">Importo</th>
                                            <th style="padding: 1rem;">Stato</th>
                                        </tr>
                                    </thead>
                                    <tbody style="font-size: 0.9rem;">
                                        ${collabInvoices.map(inv => `
                                            <tr style="border-bottom: 1px solid var(--glass-border); transition: background 0.2s;">
                                                <td style="padding: 1rem; font-weight: 500; color: var(--text-primary);">
                                                    ${inv.invoice_number || '-'}
                                                </td>
                                                <td style="padding: 1rem; color: var(--text-secondary);">
                                                    ${inv.issue_date ? new Date(inv.issue_date).toLocaleDateString() : '-'}
                                                </td>
                                                <td style="padding: 1rem; color: var(--text-secondary);">
                                                    ${inv.payment_date ? new Date(inv.payment_date).toLocaleDateString() : '-'}
                                                </td>
                                                <td style="padding: 1rem; font-weight: 600;">€ ${formatAmount(inv.amount_tax_excluded || inv.amount)}</td>
                                                <td style="padding: 1rem;">
                                                    <span class="status-badge" style="background: ${inv.status === 'Approvata' || inv.status === 'Pagato' ? '#10b98115' : 'rgba(0,0,0,0.05)'}; color: ${inv.status === 'Approvata' || inv.status === 'Pagato' ? '#10b981' : 'var(--text-secondary)'}; border: 1px solid ${inv.status === 'Approvata' || inv.status === 'Pagato' ? '#10b98130' : 'var(--glass-border)'}; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem;">${inv.status || 'Bozza'}</span>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `<div style="text-align: center; padding: 3rem; background: var(--bg-secondary); border-radius: 12px; color: var(--text-tertiary); font-size: 0.9rem;">Nessuna fattura presente</div>`}
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
        const dateDisplay = endDate ? `${startDate} - ${endDate} ` : startDate;

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
