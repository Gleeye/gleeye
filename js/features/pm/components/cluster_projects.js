import { state } from '../../../modules/state.js';
import { fetchChildProjects, createProjectInCluster } from '../../../modules/pm_api.js';
import { renderAvatar, showGlobalAlert } from '../../../modules/utils.js?v=1000';

export async function renderClusterProjects(container, clusterId) {
    container.innerHTML = `
        <div class="animate-fade-in" style="background: white; border-radius: 12px; padding: 1.5rem; min-height: 400px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                    <span class="material-icons-round" style="color: var(--brand-blue);">lan</span>
                    Progetti nel Cluster
                </h3>
                <button id="add-project-to-cluster-btn" class="glass-btn" style="padding: 8px 16px; font-size: 0.8rem; font-weight: 700; display: flex; align-items: center; gap: 6px; background: var(--brand-blue); color: white; border: none; border-radius: 10px; cursor: pointer;">
                    <span class="material-icons-round" style="font-size: 1.1rem;">add</span>
                    Nuovo Progetto
                </button>
            </div>

            <div id="cluster-projects-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.25rem;">
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-tertiary);">
                    <span class="loader"></span>
                </div>
            </div>
        </div>
    `;

    const listContainer = container.querySelector('#cluster-projects-list');
    const addBtn = container.querySelector('#add-project-to-cluster-btn');

    const refreshList = async () => {
        listContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-tertiary);"><span class="loader"></span></div>';

        try {
            const projects = await fetchChildProjects(clusterId);

            if (!projects || projects.length === 0) {
                listContainer.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem; background: var(--surface-1); border: 1px dashed var(--glass-border); border-radius: 16px;">
                        <span class="material-icons-round" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;">lan</span>
                        <div style="font-size: 1rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem;">Nessun progetto trovato</div>
                        <div style="font-size: 0.85rem; color: var(--text-tertiary);">Crea il tuo primo progetto interno in questo cluster.</div>
                    </div>
                `;
                return;
            }

            listContainer.innerHTML = projects.map(p => `
                <a href="#pm/space/${p.id}" class="glass-card animate-slide-in" style="padding: 1.25rem; text-decoration: none; transition: all 0.2s; display: block; border: 1px solid var(--glass-border);" 
                   onmouseover="this.style.transform='translateY(-2px)'; this.style.borderColor='var(--brand-blue)'; this.style.boxShadow='var(--shadow-lg)'" 
                   onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='var(--glass-border)'; this.style.boxShadow='var(--shadow-sm)'">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1.25rem;">
                        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(59, 130, 246, 0.08); display: flex; align-items: center; justify-content: center; color: var(--brand-blue); border: 1px solid rgba(59, 130, 246, 0.1);">
                            <span class="material-icons-round" style="font-size: 1.4rem;">business_center</span>
                        </div>
                        <div style="min-width: 0; flex: 1;">
                            <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name || 'Progetto'}</div>
                            <div style="font-size: 0.7rem; color: var(--text-tertiary); font-weight: 600; text-transform: uppercase;">${p.area || 'Generale'}</div>
                        </div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 1rem; border-top: 1px solid var(--surface-2);">
                        <div style="font-size: 0.7rem; color: var(--text-tertiary);">Creato il ${new Date(p.created_at).toLocaleDateString()}</div>
                        <div style="padding: 4px 10px; border-radius: 6px; background: var(--surface-1); color: var(--text-secondary); font-size: 0.65rem; font-weight: 700;">
                            Vedi Dettaglio
                        </div>
                    </div>
                </a>
            `).join('');
        } catch (e) {
            console.error(e);
            listContainer.innerHTML = '<p style="color:var(--text-danger); padding:2rem;">Errore nel caricamento dei progetti.</p>';
        }
    };

    addBtn.addEventListener('click', async () => {
        const { openProjectModal } = await import('./project_modal.js?v=2000');
        const { fetchSpace } = await import('../../../modules/pm_api.js');
        const cluster = await fetchSpace(clusterId);

        openProjectModal({
            prefilledParentId: clusterId,
            prefilledArea: cluster?.area,
            onSuccess: () => refreshList()
        });
    });

    refreshList();
}

// Keep the export but maybe we can delete the implementation of openNewProjectModal if not needed.
// Or just point it to the right one for backward compatibility if any.
export async function openNewProjectModal(clusterId, onSuccess) {
    const { openProjectModal } = await import('./project_modal.js?v=2000');
    const { fetchSpace } = await import('../../../modules/pm_api.js');
    const cluster = await fetchSpace(clusterId);
    openProjectModal({
        prefilledParentId: clusterId,
        prefilledArea: cluster?.area,
        onSuccess
    });
}
