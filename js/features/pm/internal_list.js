import { fetchInternalSpaces, createInternalSpace, createCluster, createProjectInCluster } from '../../modules/pm_api.js?v=317';
import { openProjectModal } from './components/project_modal.js?v=317';

const COMPANY_AREAS = [
    { id: 'amministrazione', label: 'Amministrazione', color: '#3b82f6', bg: '#eff6ff', icon: 'account_balance' },
    { id: 'marketing', label: 'Marketing', color: '#f59e0b', bg: '#fffbeb', icon: 'campaign' },
    { id: 'produzione', label: 'Produzione', color: '#10b981', bg: '#ecfdf5', icon: 'factory' },
    { id: 'ricerca_sviluppo', label: 'Ricerca e Sviluppo', color: '#8b5cf6', bg: '#f5f3ff', icon: 'biotech' },
    { id: 'risorse_umane', label: 'Risorse Umane', color: '#f97316', bg: '#fff7ed', icon: 'groups' },
    { id: 'servizi', label: 'Servizi', color: '#64748b', bg: '#f1f5f9', icon: 'cleaning_services' },
    { id: 'vendite', label: 'Vendite', color: '#ef4444', bg: '#fef2f2', icon: 'shopping_cart' }
];

export async function renderInternalProjects(container) {
    container.innerHTML = `
        <div style="height: 100%; display: flex; align-items: center; justify-content: center; background: white;">
            <div class="loader-container" style="text-align: center;">
                <span class="loader"></span>
            </div>
        </div>
    `;

    try {
        const spaces = await fetchInternalSpaces();
        let currentFilter = 'tutti';

        const renderContent = () => {
            const filteredSpaces = currentFilter === 'tutti'
                ? spaces
                : spaces.filter(s => (s.area || '').toLowerCase() === currentFilter.toLowerCase());

            // Split into Clusters and Standard Projects
            const clusters = filteredSpaces.filter(s => s.is_cluster);
            const projects = filteredSpaces.filter(s => !s.is_cluster && !s.parent_ref); // Only top-level projects, or maybe all?
            // Wait, if I filter by area, I want to see projects in that area.
            // If a project is inside a cluster, should it be shown here?
            // "svettano rispetto agli altri... sono separati" -> implies hierarchy.
            // Let's show Clusters, and then independent projects.
            // Projects inside a cluster should probably be visible inside the cluster detail, NOT mixed here, unless filtered?
            // For now, let's show ALL non-cluster projects in the "Projects" grid, OR only those without parent?
            // User said: "voglio creare dei progetti oltre che le attività... al loro interno"
            // So if I am in the main list, I probably only want to see Roots (Clusters + Independent Projects).
            // Let's try Filtered Roots.

            const rootClusters = clusters;
            const independentProjects = filteredSpaces.filter(s => !s.is_cluster && !s.parent_ref);

            container.innerHTML = `
                <div class="internal-projects-page" style="padding: 2.5rem; max-width: 1400px; margin: 0 auto; animation: fadeIn 0.3s ease-out;">
                    <!-- Header -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                        <div>
                            <h1 style="font-size: 1.75rem; font-weight: 700; color: #1e293b; margin: 0;">Progetti Interni</h1>
                            <p style="color: #64748b; font-size: 0.95rem; margin-top: 0.25rem;">Gestisci i flussi di lavoro per area aziendale</p>
                        </div>
                        <button class="primary-btn" id="new-internal-project-btn" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.25rem; border-radius: 12px; font-weight: 600;">
                            <span class="material-icons-round" style="font-size: 1.25rem;">add_circle</span>
                            Nuovo
                        </button>
                    </div>

                    <!-- Filters -->
                    <div class="filter-bar" style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2rem; overflow-x: auto; padding-bottom: 0.5rem;">
                        <button class="filter-pill ${currentFilter === 'tutti' ? 'active' : ''}" data-filter="tutti">Tutti</button>
                        ${COMPANY_AREAS.map(area => `
                            <button class="filter-pill ${currentFilter === area.label.toLowerCase() ? 'active' : ''}" data-filter="${area.label}">
                                ${area.label}
                            </button>
                        `).join('')}
                    </div>

                    <!-- CLUSTERS SECTION -->
                    ${rootClusters.length > 0 ? `
                        <div style="margin-bottom: 3rem;">
                            <h3 style="font-size: 0.9rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                                <span class="material-icons-round" style="font-size: 1.1rem;">hub</span>
                                Framework & Programmi Continuativi
                            </h3>
                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 1.5rem;">
                                ${rootClusters.map(space => {
                const areaCfg = COMPANY_AREAS.find(a => a.label.toLowerCase() === (space.area || '').toLowerCase()) || { label: space.area || 'Generale', color: '#64748b', bg: '#f1f5f9', icon: 'folder' };
                return `
                                        <div class="cluster-card" onclick="window.location.hash='#pm/space/${space.id}'" style="
                                            background: #1e293b; color: white; border-radius: 18px; padding: 1.75rem; 
                                            position: relative; overflow: hidden; cursor: pointer; transition: all 0.2s ease;
                                            box-shadow: 0 10px 30px -10px rgba(30, 41, 59, 0.3);
                                        ">
                                            <!-- Decorative bg icon -->
                                            <span class="material-icons-round" style="
                                                position: absolute; right: -20px; bottom: -20px; font-size: 8rem; 
                                                color: white; opacity: 0.03; transform: rotate(-15deg); pointer-events: none;
                                            ">hub</span>

                                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; position: relative;">
                                                <div style="background: rgba(255,255,255,0.1); backdrop-filter: blur(4px); padding: 0.35rem 0.85rem; border-radius: 20px; display: flex; align-items: center; gap: 0.5rem; border: 1px solid rgba(255,255,255,0.1);">
                                                    <div style="width: 8px; height: 8px; border-radius: 50%; background: ${areaCfg.color}; box-shadow: 0 0 8px ${areaCfg.color};"></div>
                                                    <span style="font-size: 0.75rem; font-weight: 600; color: rgba(255,255,255,0.9);">${areaCfg.label}</span>
                                                </div>
                                                <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center;">
                                                    <span class="material-icons-round" style="font-size: 1.1rem; color: white;">arrow_forward</span>
                                                </div>
                                            </div>

                                            <h3 style="font-size: 1.4rem; font-weight: 700; margin: 0 0 0.5rem; line-height: 1.2;">${space.name}</h3>
                                            <p style="font-size: 0.9rem; color: #94a3b8; margin: 0 0 1.5rem; opacity: 0.8;">Programma Continuativo</p>

                                            <!-- Mini stats or child preview could go here -->
                                            <div style="display: flex; gap: 1rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem;">
                                                <div style="display: flex; flex-direction: column;">
                                                    <span style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase;">Avanzamento</span>
                                                    <span style="font-weight: 600; font-size: 0.9rem;">Attivo</span> 
                                                </div>
                                            </div>
                                        </div>
                                    `;
            }).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <!-- STANDARD PROJECTS SECTION -->
                    <div>
                         ${rootClusters.length > 0 ? `
                            <h3 style="font-size: 0.9rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                                <span class="material-icons-round" style="font-size: 1.1rem;">folder</span>
                                Progetti Core & Attività Singole
                            </h3>
                        ` : ''}
                        
                        ${independentProjects.length === 0 ? `
                            <div style="text-align: center; padding: 4rem 2rem; background: #f8fafc; border-radius: 16px; border: 1px dashed #e2e8f0;">
                                <span style="font-size: 0.9rem; color: #94a3b8;">Nessun progetto singolo attivo in questa vista.</span>
                            </div>
                        ` : `
                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem;">
                                ${independentProjects.map(space => {
                const areaCfg = COMPANY_AREAS.find(a => a.label.toLowerCase() === (space.area || '').toLowerCase()) || { label: space.area || 'Generale', color: '#64748b', bg: '#f1f5f9', icon: 'folder' };
                return `
                                        <div class="project-card-premium" onclick="window.location.hash='#pm/space/${space.id}'" style="
                                            background: white; border-radius: 16px; padding: 1.5rem; border: 1px solid #e2e8f0;
                                            cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                                            display: flex; flex-direction: column; position: relative;
                                        ">
                                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                                                <div style="width: 44px; height: 44px; border-radius: 12px; background: ${areaCfg.bg}; color: ${areaCfg.color}; display: flex; align-items: center; justify-content: center;">
                                                    <span class="material-icons-round">${areaCfg.icon}</span>
                                                </div>
                                                <span style="font-size: 0.7rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">${areaCfg.label}</span>
                                            </div>
                                            
                                            <h3 style="font-size: 1.15rem; font-weight: 700; color: #1e293b; margin: 0 0 1rem; line-height: 1.3;">${space.name}</h3>

                                            <div style="margin-top: auto; padding-top: 1rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                                                <span style="font-size: 0.75rem; color: #94a3b8;">Aggiornato: ${new Date(space.updated_at || space.created_at).toLocaleDateString()}</span>
                                                <div style="display: flex; align-items: center; gap: 4px; color: var(--brand-blue); font-weight: 600; font-size: 0.85rem;">
                                                    Apri <span class="material-icons-round" style="font-size: 1rem;">arrow_forward</span>
                                                </div>
                                            </div>
                                        </div>
                                    `;
            }).join('')}
                            </div>
                        `}
                    </div>
                </div>

            `;

            // Modal Logic used to be here. Now replaced by:
            const newBtn = container.querySelector('#new-internal-project-btn');

            newBtn.onclick = () => {
                openProjectModal({
                    onSuccess: (res) => {
                        // Reload entire view or redirect
                        window.location.hash = `#pm / space / ${res.id} `;
                    }
                });
            };
        };

        renderContent();

    } catch (err) {
        console.error(err);
        container.innerHTML = `< div style = "padding: 2rem; color: #ef4444;" > Errore: ${err.message}</div > `;
    }
}

