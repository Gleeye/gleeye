import { createInternalSpace, createCluster, createProjectInCluster, fetchInternalSpaces, assignUserToSpace } from '../../../modules/pm_api.js?v=331';
import { state } from '../../../modules/state.js?v=331';
import { supabase } from '../../../modules/config.js?v=331';

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

export function openProjectModal({ onSuccess, prefilledParentId = null, forceType = 'project' } = {}) {
    console.log("[ProjectModal] Opening v330 with direct Supabase fetch");
    let modalOverlay = document.getElementById('create-project-modal-overlay');

    if (!modalOverlay) {
        modalOverlay = document.createElement('div');
        modalOverlay.id = 'create-project-modal-overlay';
        modalOverlay.className = 'modal-overlay hidden';
        modalOverlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); z-index: 2000;
            display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: 0.3s;
        `;
        document.body.appendChild(modalOverlay);
    }

    const title = forceType === 'cluster' ? 'Nuovo Cluster Continuativo' : 'Nuovo Progetto Singolo';
    let selectedAssignees = new Set();

    modalOverlay.innerHTML = `
        <div class="modal-content" style="
            background: white; width: 100%; max-width: 520px; border-radius: 20px; padding: 2.5rem;
            transform: translateY(20px); transition: 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            max-height: 90vh; overflow-y: auto;
        ">
            <h2 style="margin: 0 0 1.5rem; font-size: 1.5rem; font-weight: 700; color: #1e293b;">${title}</h2>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #64748b; margin-bottom: 0.5rem;">NOME</label>
                <input type="text" id="new-project-name" placeholder="Es. Campagna Q1 o Marketing Routine..." style="width: 100%; padding: 0.85rem 1rem; border-radius: 12px; border: 1.5px solid #e2e8f0; outline: none; transition: 0.2s;" onfocus="this.style.borderColor='var(--brand-blue)'">
            </div>

            <div id="parent-cluster-container" style="margin-bottom: 1.5rem; display: ${forceType === 'project' && !prefilledParentId ? 'block' : 'none'};">
                <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #64748b; margin-bottom: 0.5rem;">CLUSTER DI APPARTENENZA (Opzionale)</label>
                <select id="parent-cluster-select" style="width: 100%; padding: 0.85rem 1rem; border-radius: 12px; border: 1.5px solid #e2e8f0; outline: none; background: white;">
                    <option value="">Nessuno (Progetto Indipendente)</option>
                </select>
            </div>

            <div style="margin-bottom: 1.5rem;">
                <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #64748b; margin-bottom: 0.5rem;">RESPONSABILE (MANAGER)</label>
                <select id="project-manager-select" style="width: 100%; padding: 0.85rem 1rem; border-radius: 12px; border: 1.5px solid #e2e8f0; outline: none; background: white;">
                    <option value="">Caricamento...</option>
                </select>
            </div>

            <div style="margin-bottom: 1.5rem;">
                <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #64748b; margin-bottom: 0.5rem;">ASSEGNATARI</label>
                <div id="assignees-picker-container" style="
                    border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 0.5rem; 
                    max-height: 150px; overflow-y: auto; display: flex; flex-wrap: wrap; gap: 0.5rem;
                ">
                    <p style="color: #94a3b8; font-size: 0.85rem; padding: 0.5rem; margin: 0;">Caricamento collaboratori...</p>
                </div>
            </div>

            <div style="margin-bottom: 2rem;">
                <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #64748b; margin-bottom: 0.75rem;">AREA AZIENDALE</label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    ${COMPANY_AREAS.map(area => `
                        <label class="area-selectable" style="
                            cursor: pointer; padding: 0.75rem; border-radius: 12px; border: 1.5px solid #e2e8f0;
                            display: flex; align-items: center; gap: 0.75rem; transition: 0.2s;
                        ">
                            <input type="radio" name="area" value="${area.label}" style="display: none;">
                            <div style="width: 24px; height: 24px; border-radius: 6px; background: ${area.bg}; color: ${area.color}; display: flex; align-items: center; justify-content: center;">
                                <span class="material-icons-round" style="font-size: 0.9rem;">${area.icon}</span>
                            </div>
                            <span style="font-size: 0.85rem; font-weight: 600; color: #475569;">${area.label}</span>
                        </label>
                    `).join('')}
                </div>
            </div>

            <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
                <button id="close-modal-btn" class="secondary-btn" style="flex: 1; padding: 0.85rem; border-radius: 12px; font-weight: 600;">Annulla</button>
                <button id="confirm-create" class="primary-btn" style="flex: 1; padding: 0.85rem; border-radius: 12px; font-weight: 600;">Crea</button>
            </div>
            <div id="modal-error-log" style="font-size: 11px; color: #ef4444; background: #fef2f2; padding: 8px; border-radius: 8px; margin-top: 10px; display: none;"></div>
        </div>
        <style>
            .area-selectable:hover { background: #f8fafc; }
            .area-selectable:has(input:checked) { 
                border-color: var(--brand-blue); 
                background: #eff6ff; 
            }
            .assignee-chip {
                display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.75rem;
                background: #f1f5f9; border-radius: 20px; font-size: 0.8rem; font-weight: 600;
                color: #475569; cursor: pointer; border: 1.5px solid transparent; transition: 0.2s;
            }
            .assignee-chip:hover { background: #e2e8f0; }
            .assignee-chip.active {
                background: #eff6ff; color: var(--brand-blue); border-color: var(--brand-blue);
            }
            .modal-overlay:not(.hidden) { opacity: 1 !important; pointer-events: auto !important; }
            .modal-overlay:not(.hidden) .modal-content { transform: translateY(0) !important; }
        </style>
    `;

    setTimeout(() => {
        modalOverlay.classList.remove('hidden');
        modalOverlay.querySelector('#new-project-name').focus();
    }, 10);

    const closeBtn = modalOverlay.querySelector('#close-modal-btn');
    const confirmBtn = modalOverlay.querySelector('#confirm-create');
    const parentSelect = modalOverlay.querySelector('#parent-cluster-select');
    const managerSelect = modalOverlay.querySelector('#project-manager-select');
    const assigneesPicker = modalOverlay.querySelector('#assignees-picker-container');
    const errorLog = modalOverlay.querySelector('#modal-error-log');

    const showError = (msg) => {
        console.error("[ProjectModal Error]", msg);
        errorLog.style.display = 'block';
        errorLog.innerHTML = `<strong>Errore:</strong> ${msg}`;
    };

    const closeModal = () => {
        modalOverlay.classList.add('hidden');
        setTimeout(() => modalOverlay.remove(), 300);
    };

    closeBtn.onclick = closeModal;
    modalOverlay.onclick = (e) => { if (e.target === modalOverlay) closeModal(); };

    // === LOAD DATA (Direct Supabase) ===
    const loadData = async () => {
        try {
            // 1. Clusters (for parent selection)
            if (forceType === 'project' && !prefilledParentId) {
                fetchInternalSpaces().then(spaces => {
                    const allClusters = spaces.filter(s => s.is_cluster);
                    let options = `<option value="">Nessuno (Progetto Indipendente)</option>`;
                    allClusters.forEach(c => {
                        options += `<option value="${c.id}">${c.name}</option>`;
                    });
                    parentSelect.innerHTML = options;
                }).catch(e => console.error("Error fetching clusters:", e));
            }

            // 2. Collaborators (DIRECT from Supabase - bypasses state)
            console.log("[ProjectModal] Fetching collaborators directly from DB...");
            const { data: collabs, error } = await supabase
                .from('collaborators')
                .select('*')
                .order('full_name');

            if (error) {
                throw new Error(`DB Error: ${error.message}`);
            }

            if (!collabs || collabs.length === 0) {
                throw new Error("Nessun collaboratore trovato nel database.");
            }

            console.log(`[ProjectModal] Found ${collabs.length} collaborators`);

            // Fill Manager Select (filtered by tags)
            const managers = collabs.filter(c => {
                let tags = [];
                try {
                    tags = typeof c.tags === 'string' ? JSON.parse(c.tags || '[]') : (c.tags || []);
                } catch (e) {
                    tags = String(c.tags || '').split(',').map(t => t.trim());
                }
                return tags.some(t => MANAGER_TAGS.includes(t));
            }).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

            console.log(`[ProjectModal] Found ${managers.length} managers`);

            if (managers.length === 0) {
                managerSelect.innerHTML = `<option value="">Nessun responsabile disponibile</option>`;
            } else {
                managerSelect.innerHTML = `<option value="">Seleziona responsabile...</option>` +
                    managers.map(m => `<option value="${m.user_id}">${m.full_name}</option>`).join('');
            }

            // Fill Assignees Picker (all active collaborators)
            const activeCollabs = collabs.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

            console.log(`[ProjectModal] Rendering ${activeCollabs.length} assignee chips`);

            assigneesPicker.innerHTML = activeCollabs.map(c => `
                <div class="assignee-chip" data-id="${c.user_id}" data-collab-id="${c.id}">
                    <img src="${c.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.full_name)}&background=random`}" style="width: 20px; height: 20px; border-radius: 50%;">
                    <span>${c.full_name}</span>
                </div>
            `).join('');

            assigneesPicker.querySelectorAll('.assignee-chip').forEach(chip => {
                chip.onclick = () => {
                    const id = chip.dataset.id;
                    if (selectedAssignees.has(id)) {
                        selectedAssignees.delete(id);
                        chip.classList.remove('active');
                    } else {
                        selectedAssignees.add(id);
                        chip.classList.add('active');
                    }
                };
            });

        } catch (e) {
            console.error("[ProjectModal] loadData failed:", e);
            showError(e.message);
            assigneesPicker.innerHTML = `<p style="color: #ef4444; padding: 0.5rem; font-size: 0.85rem;">Errore: ${e.message}</p>`;
            managerSelect.innerHTML = `<option value="">Errore caricamento</option>`;
        }
    };

    // Execute data load
    loadData();

    // === CONFIRM BUTTON ===
    confirmBtn.onclick = async () => {
        const name = modalOverlay.querySelector('#new-project-name').value;
        const area = modalOverlay.querySelector('input[name="area"]:checked')?.value;
        const managerId = managerSelect.value;
        if (!name || !area) return alert("Compila Nome e Area Aziendale");

        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Creazione in corso...';

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
                // Initial Assignments
                if (managerId) {
                    await assignUserToSpace(res.id, managerId, 'pm');
                }

                for (const userId of selectedAssignees) {
                    if (userId === managerId) continue;
                    await assignUserToSpace(res.id, userId, 'assignee');
                }

                closeModal();
                if (onSuccess) onSuccess(res);
                else window.location.hash = `#pm/space/${res.id}`;
            }
        } catch (e) {
            console.error(e);
            alert(e.message);
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Crea';
        }
    };
}
