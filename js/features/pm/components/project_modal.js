import { createInternalSpace, createCluster, createProjectInCluster, fetchInternalSpaces } from '../../../modules/pm_api.js?v=317';

const COMPANY_AREAS = [
    { id: 'amministrazione', label: 'Amministrazione', color: '#3b82f6', bg: '#eff6ff', icon: 'account_balance' },
    { id: 'marketing', label: 'Marketing', color: '#f59e0b', bg: '#fffbeb', icon: 'campaign' },
    { id: 'produzione', label: 'Produzione', color: '#10b981', bg: '#ecfdf5', icon: 'factory' },
    { id: 'ricerca_sviluppo', label: 'Ricerca e Sviluppo', color: '#8b5cf6', bg: '#f5f3ff', icon: 'biotech' },
    { id: 'risorse_umane', label: 'Risorse Umane', color: '#f97316', bg: '#fff7ed', icon: 'groups' },
    { id: 'servizi', label: 'Servizi', color: '#64748b', bg: '#f1f5f9', icon: 'cleaning_services' },
    { id: 'vendite', label: 'Vendite', color: '#ef4444', bg: '#fef2f2', icon: 'shopping_cart' }
];

export function openProjectModal({ onSuccess, prefilledParentId = null, forceType = null } = {}) {
    // Check if modal container exists, if not create it
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

    modalOverlay.innerHTML = `
        <div class="modal-content" style="
            background: white; width: 100%; max-width: 480px; border-radius: 20px; padding: 2rem;
            transform: translateY(20px); transition: 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        ">
            <h2 style="margin: 0 0 1.5rem; font-size: 1.5rem; font-weight: 700; color: #1e293b;">Nuovo Elemento</h2>
            
            <!-- Type Switcher -->
            <div id="type-switcher" style="background: #f1f5f9; padding: 4px; border-radius: 12px; display: flex; margin-bottom: 1.5rem;">
                <button class="type-switch active" data-type="project" style="flex: 1; padding: 8px; border-radius: 8px; border: none; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: 0.2s;">Progetto Singolo</button>
                <button class="type-switch" data-type="cluster" style="flex: 1; padding: 8px; border-radius: 8px; border: none; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: 0.2s;">Cluster Continuativo</button>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #64748b; margin-bottom: 0.5rem;">NOME</label>
                <input type="text" id="new-project-name" placeholder="Es. Campagna Q1 o Marketing Routine..." style="width: 100%; padding: 0.85rem 1rem; border-radius: 12px; border: 1.5px solid #e2e8f0; outline: none; transition: 0.2s;" onfocus="this.style.borderColor='var(--brand-blue)'">
            </div>

            <!-- Parent Cluster Select (Only for Projects) -->
            <div id="parent-cluster-container" style="margin-bottom: 1.5rem;">
                <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #64748b; margin-bottom: 0.5rem;">CLUSTER DI APPARTENENZA (Opzionale)</label>
                <select id="parent-cluster-select" style="width: 100%; padding: 0.85rem 1rem; border-radius: 12px; border: 1.5px solid #e2e8f0; outline: none; bg: white;" ${prefilledParentId ? 'disabled' : ''}>
                    <option value="">Nessuno (Progetto Indipendente)</option>
                    <option value="loading" disabled>Caricamento...</option>
                </select>
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

            <div style="display: flex; gap: 0.75rem;">
                <button id="close-modal-btn" class="secondary-btn" style="flex: 1; padding: 0.85rem;">Annulla</button>
                <button id="confirm-create" class="primary-btn" style="flex: 1; padding: 0.85rem;">Crea</button>
            </div>
        </div>
        <style>
            .area-selectable:hover { background: #f8fafc; }
            .area-selectable:has(input:checked) { 
                border-color: var(--brand-blue); 
                background: #eff6ff; 
            }
            .type-switch { background: transparent; color: #64748b; }
            .type-switch.active { background: white; color: var(--brand-blue); box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
            
            .modal-overlay:not(.hidden) { opacity: 1 !important; pointer-events: auto !important; }
            .modal-overlay:not(.hidden) .modal-content { transform: translateY(0) !important; }
        </style>
    `;

    // Show Modal
    setTimeout(() => {
        modalOverlay.classList.remove('hidden');
        modalOverlay.querySelector('#new-project-name').focus();
    }, 10);

    // Logic
    const closeBtn = modalOverlay.querySelector('#close-modal-btn');
    const confirmBtn = modalOverlay.querySelector('#confirm-create');
    const typeSwitcher = modalOverlay.querySelector('#type-switcher');
    const switches = modalOverlay.querySelectorAll('.type-switch');
    const parentSelectContainer = modalOverlay.querySelector('#parent-cluster-container');
    const parentSelect = modalOverlay.querySelector('#parent-cluster-select');
    let createType = forceType || 'project';

    const closeModal = () => {
        modalOverlay.classList.add('hidden');
        setTimeout(() => modalOverlay.remove(), 300); // Cleanup DOM
    };

    closeBtn.onclick = closeModal;
    modalOverlay.onclick = (e) => { if (e.target === modalOverlay) closeModal(); };

    // Handle Type Switching
    const updateTypeUI = () => {
        switches.forEach(s => s.classList.toggle('active', s.dataset.type === createType));
        if (createType === 'cluster') {
            parentSelectContainer.style.display = 'none';
        } else {
            parentSelectContainer.style.display = 'block';
        }
    };

    if (forceType) {
        // If forced, hide switcher or lock it? Hiding logic for simplicity or just disable interaction?
        // Let's just update UI and maybe hide switcher if valid?
        // User wants to create project IN cluster.
        if (forceType === 'project') {
            // Maybe keep switcher visible but if they switch to cluster, clear parent?
            // If prefilledParentId is set, it implies we are IN a cluster view, so creating another cluster might be weird?
            // Let's allow switching but warn/clear parent? 
            // Actually, if I am in Cluster A, and I create a Cluster, it's a sibling or child? System only supports 1 level nesting for now right?
            // "Cluster -> Project". Can Cluster have Cluster child? `pm_spaces` schema supports parent_id. 
            // But let's assume flat clusters for now.
            // If prefilledParentId is present, we should probably LOCK mode to 'project'.
            if (prefilledParentId) typeSwitcher.style.display = 'none';
        }
    }

    switches.forEach(sw => {
        sw.onclick = () => {
            createType = sw.dataset.type;
            updateTypeUI();
        };
    });
    updateTypeUI();

    // Populate Clusters
    fetchInternalSpaces().then(spaces => {
        const allClusters = spaces.filter(s => s.is_cluster);
        let options = `<option value="">Nessuno (Progetto Indipendente)</option>`;

        allClusters.forEach(c => {
            const isSelected = prefilledParentId && (String(c.id) === String(prefilledParentId));
            options += `<option value="${c.id}" ${isSelected ? 'selected' : ''}>${c.name}</option>`;
        });

        parentSelect.innerHTML = options;
        if (prefilledParentId) parentSelect.value = prefilledParentId;
    });

    confirmBtn.onclick = async () => {
        const name = modalOverlay.querySelector('#new-project-name').value;
        const area = modalOverlay.querySelector('input[name="area"]:checked')?.value;
        if (!name || !area) return alert("Compila tutti i campi");

        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Creazione in corso...';

        try {
            let res;
            if (createType === 'cluster') {
                res = await createCluster(name, area);
            } else {
                const parentId = parentSelect.value || null;
                res = parentId
                    ? await createProjectInCluster(name, area, parentId)
                    : await createInternalSpace(name, area);
            }

            if (res) {
                closeModal();
                if (onSuccess) onSuccess(res);
                else window.location.hash = `#pm/space/${res.id}`;
            }
        } catch (e) {
            alert(e.message);
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Crea';
        }
    };
}
