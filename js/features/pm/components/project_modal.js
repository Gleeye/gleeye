import { createInternalSpace, createCluster, createProjectInCluster, fetchInternalSpaces, assignUserToSpace } from '../../../modules/pm_api.js';
import { state } from '../../../modules/state.js';
import { supabase } from '../../../modules/config.js';
import { renderUserPicker } from './picker_utils.js';

const COMPANY_AREAS = [
    { id: 'amministrazione', label: 'Amministrazione', color: '#3b82f6', bg: '#eff6ff', icon: 'account_balance' },
    { id: 'marketing', label: 'Marketing', color: '#f59e0b', bg: '#fffbeb', icon: 'campaign' },
    { id: 'produzione', label: 'Produzione', color: '#10b981', bg: '#ecfdf5', icon: 'factory' },
    { id: 'ricerca_sviluppo', label: 'Ricerca e Sviluppo', color: '#8b5cf6', bg: '#f5f3ff', icon: 'biotech' },
    { id: 'risorse_umane', label: 'Risorse Umane', color: '#f97316', bg: '#fff7ed', icon: 'groups' },
    { id: 'servizi', label: 'Servizi', color: '#64748b', bg: '#f1f5f9', icon: 'cleaning_services' },
    { id: 'vendite', label: 'Vendite', color: '#ef4444', bg: '#fef2f2', icon: 'shopping_cart' }
];

const MANAGER_TAGS = ['Partner', 'Account', 'Amministrazione', 'Project Manager'];

export function openProjectModal({ onSuccess, prefilledParentId = null, forceType = 'project', prefilledArea = null } = {}) {
    console.log("[ProjectModal] Opening with custom searchable pickers");
    let modalOverlay = document.getElementById('create-project-modal-overlay');

    if (!modalOverlay) {
        modalOverlay = document.createElement('div');
        modalOverlay.id = 'create-project-modal-overlay';
        modalOverlay.className = 'modal-overlay hidden';
        modalOverlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); z-index: 2000;
            display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: 0.3s;
        `;
        document.body.appendChild(modalOverlay);
    }

    const title = forceType === 'cluster' ? 'Nuovo Cluster Continuativo' : 'Nuovo Progetto Singolo';
    let selectedManagers = new Set();
    let selectedAssignees = new Set();

    modalOverlay.innerHTML = `
        <div class="modal-content animate-scale-in" style="
            background: white; width: 100%; max-width: 580px; border-radius: 24px; padding: 2.5rem;
            box-shadow: 0 20px 50px rgba(0,0,0,0.2); max-height: 90vh; overflow-y: auto;
        ">
            <h2 style="margin: 0 0 1.5rem; font-size: 1.6rem; font-weight: 800; color: #1e293b; letter-spacing: -0.02em;">${title}</h2>
            
            <div style="margin-bottom: 2rem;">
                <label style="display: block; font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">NOME PROGETTO</label>
                <input type="text" id="new-project-name" placeholder="Es. Campagna Q1 o Marketing Routine..." style="width: 100%; padding: 1rem 1.25rem; border-radius: 12px; border: 1.5px solid #e2e8f0; outline: none; transition: 0.2s; font-size: 1rem; font-weight: 500;" onfocus="this.style.borderColor='var(--brand-blue)'; this.style.boxShadow='0 0 0 4px rgba(59, 130, 246, 0.1)'" onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'">
            </div>

            <div id="parent-cluster-container" style="margin-bottom: 2rem; display: ${forceType === 'project' && !prefilledParentId ? 'block' : 'none'};">
                <label style="display: block; font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">CLUSTER DI APPARTENENZA (Opzionale)</label>
                <select id="parent-cluster-select" style="width: 100%; padding: 1rem 1.25rem; border-radius: 12px; border: 1.5px solid #e2e8f0; outline: none; background: white; font-size: 0.95rem; font-weight: 500; appearance: none; background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M7%2010l5%205%205-5z%22/%3E%3C/svg%3E'); background-repeat: no-repeat; background-position: right 1rem center; background-size: 1.2rem;">
                    <option value="">Nessuno (Progetto Indipendente)</option>
                </select>
            </div>

            <div style="margin-bottom: 2rem; position: relative;">
                <label style="display: block; font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">RESPONSABILE (MANAGER)</label>
                <div id="manager-picker-trigger" class="custom-picker-surface">
                    <div id="selected-managers-container" class="selected-chips-container"></div>
                    <input type="text" id="manager-search" placeholder="Cerca responsabile..." style="border:none; outline:none; background:transparent; font-size: 0.95rem; color: #1e293b; padding: 4px; min-width: 150px; flex: 1;">
                    <span class="material-icons-round" style="color: #94a3b8; font-size: 1.25rem;">expand_more</span>
                </div>
                <div id="manager-picker-popover" class="hidden glass-card picker-popover">
                    ${renderUserPicker(prefilledParentId, 'pm', new Set(), new Set(), 'Tutti i responsabili')}
                </div>
            </div>

            <div style="margin-bottom: 2rem; position: relative;">
                <label style="display: block; font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">ASSEGNATARI (TEAM)</label>
                <div id="assignee-picker-trigger" class="custom-picker-surface">
                    <div id="selected-assignees-container" class="selected-chips-container"></div>
                    <input type="text" id="assignee-search" placeholder="Cerca assegnatario..." style="border:none; outline:none; background:transparent; font-size: 0.95rem; color: #1e293b; padding: 4px; min-width: 150px; flex: 1;">
                    <span class="material-icons-round" style="color: #94a3b8; font-size: 1.25rem;">expand_more</span>
                </div>
                <div id="assignee-picker-popover" class="hidden glass-card picker-popover">
                    ${renderUserPicker(prefilledParentId, 'assignee', new Set(), new Set(), 'Tutti i collaboratori')}
                </div>
            </div>

            <div style="margin-bottom: 2rem;">
                <label style="display: block; font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">AREA AZIENDALE</label>
                ${prefilledArea ? `
                    <div style="padding: 1rem 1.25rem; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; color: #475569; font-weight: 600; display: flex; align-items: center; gap: 0.75rem;">
                         <span class="material-icons-round" style="color: #64748b; font-size: 1.25rem;">lock</span>
                         ${prefilledArea}
                         <span style="font-size: 0.75rem; color: #94a3b8; margin-left: auto; font-style: italic;">(Implicita)</span>
                         <input type="hidden" id="prefilled-area-input" value="${prefilledArea}">
                    </div>
                ` : `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    ${COMPANY_AREAS.map(area => `
                        <label class="area-selectable" style="
                            cursor: pointer; padding: 0.85rem 1rem; border-radius: 12px; border: 1.5px solid #e2e8f0;
                            display: flex; align-items: center; gap: 0.75rem; transition: 0.2s;
                        ">
                            <input type="radio" name="area" value="${area.label}" style="display: none;">
                            <div style="width: 28px; height: 28px; border-radius: 8px; background: ${area.bg}; color: ${area.color}; display: flex; align-items: center; justify-content: center;">
                                <span class="material-icons-round" style="font-size: 1.1rem;">${area.icon}</span>
                            </div>
                            <span style="font-size: 0.9rem; font-weight: 600; color: #475569;">${area.label}</span>
                        </label>
                    `).join('')}
                </div>
                `}
            </div>

            <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                <button id="close-modal-btn" class="secondary-btn" style="flex: 1; padding: 1rem; border-radius: 12px; font-weight: 700; font-size: 0.95rem;">Annulla</button>
                <button id="confirm-create" class="primary-btn" style="flex: 1; padding: 1rem; border-radius: 12px; font-weight: 700; font-size: 0.95rem; background: var(--brand-gradient); color: white; border: none; box-shadow: 0 4px 12px rgba(97, 74, 162, 0.2);">Crea Progetto</button>
            </div>
            <div id="modal-error-log" style="font-size: 0.8rem; color: #ef4444; background: #fef2f2; padding: 12px; border-radius: 10px; margin-top: 1.5rem; display: none; border: 1px solid #fee2e2;"></div>
        </div>
        <style>
            .custom-picker-surface {
                display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
                padding: 0.75rem 1rem; min-height: 52px; border: 1.5px solid #e2e8f0; border-radius: 12px;
                background: white; cursor: pointer; transition: 0.2s;
            }
            .custom-picker-surface:hover { border-color: #cbd5e1; }
            .custom-picker-surface.active { 
                border-color: var(--brand-blue); 
                box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
            }
            
            .selected-chips-container { display: flex; flex-wrap: wrap; gap: 6px; }
            .selected-chip {
                display: flex; align-items: center; gap: 6px; background: #f1f5f9;
                padding: 4px 10px; border-radius: 8px; font-size: 0.85rem; font-weight: 600;
                color: #475569; animation: scaleUp 0.2s ease-out; border: 1px solid #e2e8f0;
            }
            .selected-chip img { width: 18px; height: 18px; border-radius: 4px; }
            .selected-chip .close-chip { font-size: 14px; cursor: pointer; color: #94a3b8; margin-left: 2px; }
            .selected-chip .close-chip:hover { color: #ef4444; }
            
            .picker-popover {
                position: absolute; top: calc(100% + 8px); left: 0; width: 320px;
                z-index: 1000; padding: 0; box-shadow: 0 12px 40px rgba(0,0,0,0.15);
                border: 1px solid #e2e8f0; max-height: 400px; display: flex; flex-direction: column;
                background: white; border-radius: 14px; overflow: hidden;
            }
            
            .area-selectable:hover { background: #f8fafc; }
            .area-selectable:has(input:checked) { 
                border-color: var(--brand-blue); 
                background: #eff6ff; 
            }
            .modal-overlay:not(.hidden) { opacity: 1 !important; pointer-events: auto !important; }
            .modal-overlay:not(.hidden) .modal-content { transform: scale(1) !important; opacity: 1 !important; }
            
            @keyframes scaleUp { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        </style>
    `;

    setTimeout(() => {
        modalOverlay.classList.remove('hidden');
        modalOverlay.querySelector('#new-project-name').focus();
    }, 10);

    const closeBtn = modalOverlay.querySelector('#close-modal-btn');
    const confirmBtn = modalOverlay.querySelector('#confirm-create');
    const parentSelect = modalOverlay.querySelector('#parent-cluster-select');
    const errorLog = modalOverlay.querySelector('#modal-error-log');

    // === LOAD DATA ===
    const loadInitialData = async () => {
        try {
            console.log("[ProjectModal] Checking collaborators state...");
            // 1. Fetch Collaborators if missing (ESSENTIAL COLUMNS ONLY)
            if (!state.collaborators || state.collaborators.length === 0) {
                console.log("[ProjectModal] Collaborators missing, fetching directly from Supabase...");
                const { data, error } = await supabase
                    .from('collaborators')
                    .select('id, full_name, role, email, avatar_url, tags, user_id')
                    .order('full_name', { ascending: true });

                if (error) throw error;
                state.collaborators = data || [];
                console.log(`[ProjectModal] Successfully fetched ${state.collaborators.length} collaborators.`);
            }

            // 2. Fetch Clusters if needed
            if (forceType === 'project' && !prefilledParentId) {
                const { data: spaces, error } = await supabase
                    .from('pm_spaces')
                    .select('*')
                    .eq('is_cluster', true)
                    .order('name');

                if (!error && spaces) {
                    let options = `<option value="">Nessuno (Progetto Indipendente)</option>`;
                    spaces.forEach(c => {
                        options += `<option value="${c.id}">${c.name}</option>`;
                    });
                    parentSelect.innerHTML = options;
                }
            }
        } catch (e) {
            console.error("[ProjectModal] Data loading failed:", e);
            errorLog.style.display = 'block';
            errorLog.textContent = "Errore caricamento dati: " + e.message;
        }
    };
    loadInitialData();

    // === PICKER HELPERS ===
    const setupPicker = (triggerId, popoverId, searchId, containerId, selectionSet, targetRole, sectionTitle) => {
        const trigger = modalOverlay.querySelector(`#${triggerId}`);
        const popover = modalOverlay.querySelector(`#${popoverId}`);
        const search = modalOverlay.querySelector(`#${searchId}`);
        const container = modalOverlay.querySelector(`#${containerId}`);

        const renderList = () => {
            // Loading fallback check
            if (!state.collaborators || state.collaborators.length === 0) {
                popover.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: #64748b; font-size: 0.9rem;">
                    <div class="loader" style="width: 20px; height: 20px; border-width: 2px; border-color: var(--brand-blue); border-top-color: transparent; margin: 0 auto 12px; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                    Caricamento collaboratori...
                </div>`;
                return;
            }

            // We pass the selectionSet to renderUserPicker so it can filter out already selected users if we want,
            // but for multi-select it's better to show them and just mark them as picked.
            popover.innerHTML = renderUserPicker(prefilledParentId, targetRole, new Set(), new Set(), sectionTitle);

            // Re-attach listeners to the new HTML
            popover.querySelectorAll('.user-option').forEach(opt => {
                opt.onclick = (e) => {
                    e.stopPropagation();
                    const uid = opt.dataset.uid;
                    if (!uid) return;
                    if (selectionSet.has(uid)) {
                        selectionSet.delete(uid);
                    } else {
                        selectionSet.add(uid);
                    }
                    renderChips();
                    updatePickerStates();
                    // We don't close for multi-select, just clear search
                    search.value = '';
                    handleSearch('');
                };
            });

            const popoverSearch = popover.querySelector('.user-picker-search');
            if (popoverSearch) {
                popoverSearch.oninput = (e) => {
                    search.value = e.target.value;
                    handleSearch(e.target.value);
                };
                popoverSearch.onclick = (e) => e.stopPropagation();
            }
        };

        const renderChips = () => {
            container.innerHTML = Array.from(selectionSet).map(userId => {
                const collab = state.collaborators?.find(c => c.user_id === userId);
                if (!collab) return '';
                return `
                    <div class="selected-chip" data-uid="${userId}">
                        <img src="${collab.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(collab.full_name)}`}">
                        <span>${collab.full_name}</span>
                        <span class="material-icons-round close-chip">close</span>
                    </div>
                `;
            }).join('');

            container.querySelectorAll('.close-chip').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const uid = btn.closest('.selected-chip').dataset.uid;
                    selectionSet.delete(uid);
                    renderChips();
                    updatePickerStates();
                };
            });
        };

        const updatePickerStates = () => {
            popover.querySelectorAll('.user-option').forEach(opt => {
                const uid = opt.dataset.uid;
                const isSelected = selectionSet.has(uid);
                opt.style.background = isSelected ? '#eff6ff' : 'transparent';
                const check = opt.querySelector('.picked-check');
                if (isSelected) {
                    if (!check) opt.insertAdjacentHTML('beforeend', '<span class="material-icons-round picked-check" style="font-size: 1.1rem; color: var(--brand-blue); margin-left: auto;">check_circle</span>');
                } else if (check) check.remove();
            });
        };

        trigger.onclick = (e) => {
            if (e.target === search) return;
            e.stopPropagation();
            const isHidden = popover.classList.contains('hidden');
            modalOverlay.querySelectorAll('.picker-popover').forEach(p => p.classList.add('hidden'));
            modalOverlay.querySelectorAll('.custom-picker-surface').forEach(s => s.classList.remove('active'));

            if (isHidden) {
                renderList(); // Render fresh on open
                popover.classList.remove('hidden');
                trigger.classList.add('active');
                popover.querySelector('.user-picker-search')?.focus();
                updatePickerStates();
            }
        };

        const handleSearch = (q) => {
            q = q.toLowerCase();
            popover.querySelectorAll('.user-option').forEach(opt => {
                const match = opt.dataset.nameSearch.includes(q);
                opt.style.display = match ? 'flex' : 'none';
            });

            popover.querySelectorAll('.picker-section-header').forEach(header => {
                let sibling = header.nextElementSibling;
                let hasVisible = false;
                while (sibling && !sibling.classList.contains('picker-section-header')) {
                    if (sibling.style.display !== 'none') { hasVisible = true; break; }
                    sibling = sibling.nextElementSibling;
                }
                header.style.display = hasVisible ? 'block' : 'none';
            });
        };

        search.oninput = (e) => handleSearch(e.target.value);

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!trigger.contains(e.target) && !popover.contains(e.target)) {
                popover.classList.add('hidden');
                trigger.classList.remove('active');
            }
        });

        // Initial render of chips (if any)
        renderChips();
    };

    setupPicker('manager-picker-trigger', 'manager-picker-popover', 'manager-search', 'selected-managers-container', selectedManagers, 'pm', 'Tutti i responsabili');
    setupPicker('assignee-picker-trigger', 'assignee-picker-popover', 'assignee-search', 'selected-assignees-container', selectedAssignees, 'assignee', 'Tutti i collaboratori');

    // === CLOSE / CANCEL ===
    const closeModal = () => {
        modalOverlay.classList.add('hidden');
        setTimeout(() => modalOverlay.remove(), 300);
    };

    closeBtn.onclick = closeModal;
    modalOverlay.onclick = (e) => { if (e.target === modalOverlay) closeModal(); };

    // === LOAD CLUSTERS (for parenting) ===
    const loadClusters = async () => {
        if (forceType === 'project' && !prefilledParentId) {
            try {
                const spaces = await fetchInternalSpaces();
                const allClusters = spaces.filter(s => s.is_cluster);
                let options = `<option value="">Nessuno (Progetto Indipendente)</option>`;
                allClusters.forEach(c => {
                    options += `<option value="${c.id}">${c.name}</option>`;
                });
                parentSelect.innerHTML = options;
            } catch (e) {
                console.error("Error fetching clusters:", e);
            }
        }
    };
    loadClusters();

    // === CONFIRM BUTTON ===
    confirmBtn.onclick = async () => {
        const name = modalOverlay.querySelector('#new-project-name').value;
        const areaRadio = modalOverlay.querySelector('input[name="area"]:checked');
        const areaHidden = modalOverlay.querySelector('#prefilled-area-input');
        const area = areaRadio ? areaRadio.value : (areaHidden ? areaHidden.value : null);

        if (!name || !area) {
            confirmBtn.classList.add('shake');
            setTimeout(() => confirmBtn.classList.remove('shake'), 400);
            return alert("Compila almeno Nome e Area Aziendale");
        }

        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="loader" style="width: 18px; height: 18px; border-width: 2px;"></span>';

        try {
            let res;
            if (forceType === 'cluster') {
                res = await createCluster(name, area);
            } else {
                const parentId = prefilledParentId || parentSelect.value || null;
                res = parentId
                    ? await createProjectInCluster(name, area, parentId)
                    : await createInternalSpace(name, area);
            }

            if (res) {
                // Assignments
                const allOps = [];
                // Managers (PM)
                for (const uid of selectedManagers) {
                    allOps.push(assignUserToSpace(res.id, uid, 'pm'));
                }
                // Assignees
                for (const uid of selectedAssignees) {
                    if (selectedManagers.has(uid)) continue;
                    allOps.push(assignUserToSpace(res.id, uid, 'assignee'));
                }

                if (allOps.length > 0) await Promise.all(allOps);

                closeModal();
                if (onSuccess) onSuccess(res);
                else window.location.hash = `#pm/space/${res.id}`;
            }
        } catch (e) {
            console.error(e);
            errorLog.style.display = 'block';
            errorLog.textContent = e.message;
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Crea Progetto';
        }
    };
}
