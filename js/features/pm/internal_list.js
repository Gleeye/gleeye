import { fetchInternalSpaces, createInternalSpace } from '../../modules/pm_api.js?v=159';

const COMPANY_AREAS = [
    { id: 'amministrazione', label: 'Amministrazione', color: '#3b82f6', bg: '#eff6ff', icon: 'account_balance' },
    { id: 'marketing', label: 'Marketing', color: '#f59e0b', bg: '#fffbeb', icon: 'campaign' },
    { id: 'produzione', label: 'Produzione', color: '#10b981', bg: '#ecfdf5', icon: 'factory' },
    { id: 'ricerca_sviluppo', label: 'Ricerca & Sviluppo', color: '#8b5cf6', bg: '#f5f3ff', icon: 'biotech' },
    { id: 'risorse_umane', label: 'Risorse Umane', color: '#f97316', bg: '#fff7ed', icon: 'groups' },
    { id: 'servizi', label: 'Servizi', color: '#64748b', bg: '#f1f5f9', icon: 'cleaning_services' },
    { id: 'vendite', label: 'Vendite', color: '#ef4444', bg: '#fef2f2', icon: 'shopping_cart' }
];

export async function renderInternalProjects(container) {
    container.innerHTML = '<div class="loading-state"><span class="loader"></span></div>';

    try {
        const spaces = await fetchInternalSpaces();

        container.innerHTML = `
            <div class="internal-projects-view" style="padding: 2rem; max-width: 1400px; margin: 0 auto;">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <div>
                        <h1 style="font-size: 1.75rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">Progetti Interni</h1>
                        <p style="color: var(--text-secondary);">Gestisci i progetti per area aziendale</p>
                    </div>
                    <button class="primary-btn" id="new-internal-project-btn" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.25rem;">
                        <span class="material-icons-round">add</span>
                        Nuovo Progetto
                    </button>
                </div>

                <!-- Grid -->
                ${spaces.length === 0 ? `
                    <div style="text-align: center; padding: 4rem; background: var(--surface-1); border-radius: 16px; border: 1px dashed var(--glass-border);">
                        <span class="material-icons-round" style="font-size: 3rem; color: var(--text-tertiary); margin-bottom: 1rem;">folder_open</span>
                        <h3 style="color: var(--text-secondary); margin-bottom: 0.5rem;">Nessun progetto interno</h3>
                        <p style="color: var(--text-tertiary);">Crea il primo progetto per iniziare</p>
                    </div>
                ` : `
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">
                        ${spaces.map(space => {
            const areaConfig = COMPANY_AREAS.find(a => a.label === space.area) ||
                COMPANY_AREAS.find(a => a.id === space.area?.toLowerCase()) ||
                { label: space.area || 'Generale', color: '#64748b', bg: '#f1f5f9', icon: 'folder' };

            return `
                                <div class="glass-card clickable-card" onclick="window.location.hash='#pm/space/${space.id}'" style="
                                    background: white; border-radius: 16px; padding: 1.5rem; 
                                    border: 1px solid var(--surface-2); transition: all 0.2s; cursor: pointer;
                                    display: flex; flex-direction: column; gap: 1rem;
                                ">
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                        <div style="
                                            width: 40px; height: 40px; border-radius: 10px; 
                                            background: ${areaConfig.bg}; color: ${areaConfig.color};
                                            display: flex; align-items: center; justify-content: center;
                                        ">
                                            <span class="material-icons-round">${areaConfig.icon}</span>
                                        </div>
                                        <span class="material-icons-round" style="color: var(--text-tertiary);">more_horiz</span>
                                    </div>
                                    
                                    <div>
                                        <h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">${space.name}</h3>
                                        <span style="
                                            font-size: 0.75rem; padding: 2px 8px; border-radius: 6px; 
                                            background: var(--surface-1); color: var(--text-secondary);
                                        ">${areaConfig.label}</span>
                                    </div>

                                    <div style="margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--surface-1); display: flex; justify-content: space-between; align-items: center;">
                                        <span style="font-size: 0.8rem; color: var(--text-tertiary);">Aggiornato ${new Date(space.updated_at || space.created_at).toLocaleDateString()}</span>
                                        <span style="font-size: 0.8rem; font-weight: 500; color: var(--brand-color);">Apri &rarr;</span>
                                    </div>
                                </div>
                            `;
        }).join('')}
                    </div>
                `}
            </div>

            <!-- Create Modal (Hidden) -->
            <div id="create-project-modal" class="modal-overlay hidden" style="
                position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000;
                display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.2s;
            ">
                <div class="modal-content" style="
                    background: white; width: 100%; max-width: 400px; border-radius: 16px; padding: 1.5rem;
                    transform: translateY(20px); transition: transform 0.2s; box-shadow: var(--shadow-xl);
                ">
                    <h2 style="margin-bottom: 1.5rem; font-size: 1.25rem;">Nuovo Progetto Interno</h2>
                    
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label style="display: block; font-size: 0.85rem; font-weight: 500; margin-bottom: 0.5rem;">Nome Progetto</label>
                        <input type="text" id="new-project-name" class="input-field" placeholder="Es. Sito Web 2026" style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--surface-2);">
                    </div>

                    <div class="form-group" style="margin-bottom: 1.5rem;">
                        <label style="display: block; font-size: 0.85rem; font-weight: 500; margin-bottom: 0.5rem;">Area Aziendale</label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                            ${COMPANY_AREAS.map(area => `
                                <label class="area-option" style="
                                    cursor: pointer; padding: 0.5rem; border-radius: 8px; border: 1px solid var(--surface-2);
                                    display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;
                                ">
                                    <input type="radio" name="area" value="${area.label}" style="accent-color: var(--brand-color);">
                                    <span style="font-size: 0.85rem;">${area.label}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
                        <button class="secondary-btn" id="cancel-create-btn">Annulla</button>
                        <button class="primary-btn" id="confirm-create-btn">Crea Progetto</button>
                    </div>
                </div>
            </div>
            
            <style>
                .modal-overlay:not(.hidden) { opacity: 1 !important; pointer-events: auto !important; }
                .modal-overlay:not(.hidden) .modal-content { transform: translateY(0) !important; }
                .area-option:has(input:checked) { background: var(--surface-1); border-color: var(--brand-color); }
            </style>
        `;

        // Modal Logic
        const modal = container.querySelector('#create-project-modal');
        const openBtn = container.querySelector('#new-internal-project-btn');
        const cancelBtn = container.querySelector('#cancel-create-btn');
        const confirmBtn = container.querySelector('#confirm-create-btn');
        const nameInput = container.querySelector('#new-project-name');

        const openModal = () => {
            modal.classList.remove('hidden');
            nameInput.value = '';
            // Reset radios
            container.querySelectorAll('input[name="area"]').forEach(r => r.checked = false);
            nameInput.focus();
        };

        const closeModal = () => modal.classList.add('hidden');

        openBtn.onclick = openModal;
        cancelBtn.onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };

        confirmBtn.onclick = async () => {
            const name = nameInput.value.trim();
            const areaRadio = container.querySelector('input[name="area"]:checked');

            if (!name) {
                alert("Inserisci un nome per il progetto.");
                return;
            }
            if (!areaRadio) {
                alert("Seleziona un'area aziendale.");
                return;
            }

            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Creazione...';

            try {
                const newSpace = await createInternalSpace(name, areaRadio.value);
                closeModal();
                if (newSpace) {
                    window.location.hash = `#pm/space/${newSpace.id}`;
                }
            } catch (err) {
                console.error(err);
                alert("Errore durante la creazione: " + err.message);
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Crea Progetto';
            }
        };

    } catch (err) {
        console.error("Error rendering internal projects:", err);
        container.innerHTML = `<div class="error-state">Errore caricamento: ${err.message}</div>`;
    }
}
