import { fetchInternalSpaces, createInternalSpace, createCluster, createProjectInCluster, fetchPMActivityLogs, updateSpaceCloudLinks } from '../../modules/pm_api.js?v=8000';
import { CloudLinksManager } from '../components/CloudLinksManager.js?v=8000';
import { openProjectModal } from './components/project_modal.js?v=8000';
import { supabase } from '../../modules/config.js?v=8000';
import { state } from '../../modules/state.js?v=8000';
import { renderAvatar } from '../../modules/utils.js?v=8000';
import { humanizeActivity } from '../../modules/pm_activity_helper.js?v=8000';

const COMPANY_AREAS = [
    { id: 'amministrazione', label: 'Amministrazione', color: 'var(--brand-viola)', bg: 'rgba(97, 74, 162, 0.05)', icon: 'account_balance' },
    { id: 'marketing', label: 'Marketing', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.05)', icon: 'campaign' },
    { id: 'produzione', label: 'Produzione', color: '#10b981', bg: 'rgba(16, 185, 129, 0.05)', icon: 'factory' },
    { id: 'ricerca_sviluppo', label: 'Ricerca e Sviluppo', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.05)', icon: 'biotech' },
    { id: 'risorse_umane', label: 'Risorse Umane', color: '#f97316', bg: 'rgba(249, 115, 22, 0.05)', icon: 'groups' },
    { id: 'servizi', label: 'Servizi', color: '#64748b', bg: 'rgba(100, 116, 139, 0.05)', icon: 'cleaning_services' },
    { id: 'vendite', label: 'Vendite', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.05)', icon: 'shopping_cart' }
].sort((a, b) => a.label.localeCompare(b.label));

export async function renderInternalProjects(container, initialFilter) {
    container.innerHTML = `
        <div style="height: 100%; display: flex; align-items: center; justify-content: center; background: var(--bg-primary);">
            <div class="loader-container"><div class="loader"></div></div>
        </div>
    `;

    try {
        const spaces = await fetchInternalSpaces();
        const spaceIds = (spaces || []).map(s => s.id);
        
        // Fetch Area Managers from system_config
        const { data: configData } = await supabase.from('system_config').select('key, value').like('key', 'area_manager_%');
        const areaManagers = {};
        (configData || []).forEach(row => {
            areaManagers[row.key.replace('area_manager_', '')] = row.value;
        });

        const { data: allItems, error: itemsError } = await supabase
            .from('pm_items')
            .select(`id, space_ref, title, status, due_date, cloud_links, pm_item_assignees ( user_ref, collaborator_ref )`)
            .in('space_ref', spaceIds)
            .is('archived_at', null);

        if (itemsError) throw itemsError;

        const collaborators = state.collaborators || [];
        const statsMap = {};
        (spaces || []).forEach(s => {
            statsMap[s.id] = {
                activeProjects: 0,
                activities: { total: 0, open: 0, overdue: 0, team: new Set(), nextAction: null, tasks: 0 }
            };
        });

        // Hierarchy and stats mapping
        (spaces || []).forEach(s => {
            if (s.parent_ref && statsMap[s.parent_ref]) statsMap[s.parent_ref].activeProjects++;
        });

        const now = new Date();
        (allItems || []).forEach(item => {
            const s = statsMap[item.space_ref];
            if (!s) return;
            
            // It's an activity if it has no parent or a specific type, but in Gleeye ERP 
            // the convention is often based on the depth or parent_ref in pm_items.
            // For this summary, we treat everything in pm_items as an "attività".
            // If the user distinguishes "task" as sub-items, we need to adapt.
            // Assuming "att" = activities (top level pm_items in space) and "task" = sub-items or all pm_items.
            // Looking at the screen2: "0 prog 14 att 0 task"
            // Let's assume:
            // - PROG: subspaces
            // - ATT: top-level items in the space
            // - TASK: sub-items (items with parent_ref in pm_items) - need to check if pm_items has parent_ref.
            
            s.activities.total++;
            item.pm_item_assignees?.forEach(a => { 
                if (a.user_ref) s.activities.team.add(a.user_ref);
                else if (a.collaborator_ref) {
                    const c = collaborators.find(collab => collab.id === a.collaborator_ref);
                    if (c?.user_id) s.activities.team.add(c.user_id);
                }
            });
            if (item.status !== 'done') {
                s.activities.open++;
                const itemDate = item.due_date ? new Date(item.due_date) : null;
                if (itemDate && itemDate < now) s.activities.overdue++;
                if (!s.activities.nextAction || (itemDate && itemDate < new Date(s.activities.nextAction.date))) {
                    s.activities.nextAction = { title: item.title, date: item.due_date || null };
                }
            }
        });

        let currentAreaId = 'marketing';
        if (initialFilter) {
            const found = COMPANY_AREAS.find(a => a.id === initialFilter.toLowerCase() || a.label.toLowerCase() === initialFilter.toLowerCase());
            if (found) currentAreaId = found.id;
        }

        // Default to first cluster of the area
        const activeArea = COMPANY_AREAS.find(a => a.id === currentAreaId) || COMPANY_AREAS[0];
        const areaClusters = (spaces || []).filter(s => s.is_cluster && (s.area || '').toLowerCase() === activeArea.label.toLowerCase());
        
        let currentClusterId = areaClusters[0]?.id || 'all';
        let currentKpiFilter = 'all';
        let currentTab = 'overview';

        const getCollab = (uid, collabId) => {
            if (uid) return collaborators.find(c => c.user_id === uid);
            if (collabId) return collaborators.find(c => c.id === collabId);
            return null;
        };

        const renderUI = async () => {
            const activeArea = COMPANY_AREAS.find(a => a.id === currentAreaId) || COMPANY_AREAS[0];
            const areaClusters = (spaces || []).filter(s => s.is_cluster && (s.area || '').toLowerCase() === activeArea.label.toLowerCase());
            
            // Ensure currentClusterId is valid for the area, or reset
            if (currentClusterId !== 'all' && !areaClusters.find(c => c.id === currentClusterId)) {
                currentClusterId = areaClusters[0]?.id || 'all';
            }

            const activeCluster = areaClusters.find(c => c.id === currentClusterId);
            const clusterManagerRec = activeCluster?.pm_space_assignees?.find(a => a.role === 'manager');
            const clusterManager = clusterManagerRec ? getCollab(clusterManagerRec.user_ref, clusterManagerRec.collaborator_ref) : getCollab(null, areaManagers[currentAreaId]);

            let visibleProjects = [];
            if (currentClusterId === 'all') {
                visibleProjects = (spaces || []).filter(s => !s.is_cluster && (s.area || '').toLowerCase() === activeArea.label.toLowerCase() && !s.parent_ref);
            } else {
                visibleProjects = (spaces || []).filter(s => s.parent_ref === currentClusterId);
            }

            const kpiClusters = currentClusterId === 'all' ? areaClusters.length : 1;
            const kpiTotal = visibleProjects.length;
            let kpiActivities = 0;
            if (currentClusterId !== 'all') {
                 kpiActivities += statsMap[currentClusterId]?.activities.open || 0;
            }
            visibleProjects.forEach(p => kpiActivities += statsMap[p.id]?.activities.open || 0);

            const isPartner = (state.profile?.tags || []).includes('Partner') || state.profile?.role === 'admin';
            const managerId = areaManagers[currentAreaId];
            const manager = collaborators.find(c => c.id === managerId);

            container.innerHTML = `
                <style>
                    .project-hub { width: auto; margin: 0 -3rem !important; padding: 0 !important; background: transparent; font-family: var(--font-body); }
                    .project-hub-container { display: flex; width: 100%; min-height: calc(100vh - 60px); gap: 2rem; padding: 1.5rem 2.5rem 2rem 2.5rem; }
                    
                    .hub-sidebar { width: 280px; flex-shrink: 0; display: flex; flex-direction: column; gap: 1rem; }
                    .hub-main-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1rem; }
                    
                    .glass-card { background: white; border: none; border-radius: 12px; box-shadow: var(--shadow-sm); position: relative; }
                    .sidebar-card { padding: 0.75rem 1rem; }
                    
                    /* Sidebar Area Switcher */
                    .area-trigger { 
                        width: 100%; display: flex; align-items: center; justify-content: space-between; 
                        background: none; border: none; padding: 6px 8px; border-radius: 10px; cursor: pointer; 
                        transition: 0.2s; border: 1px solid transparent; 
                    }
                    .area-trigger:hover { background: var(--bg-secondary); }
                    
                    .area-pop { position: absolute; top: calc(100% + 8px); left: 0; right: 0; z-index: 2000; padding: 5px; display: none; background: white; border: 1px solid var(--glass-border); border-radius: 12px; box-shadow: var(--shadow-xl); }
                    .area-pop.active { display: block; animation: popUp 0.15s ease; }
                    .opt-row { padding: 9px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 12px; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); transition: 0.2s; }
                    .opt-row:hover { background: var(--bg-secondary); color: var(--text-primary); }
                    .opt-row.active { background: var(--brand-gradient); color: white; }
                    
                    .resp-block { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(0,0,0,0.04); display: flex; align-items: center; justify-content: space-between; }
                    .resp-info { display: flex; align-items: center; gap: 10px; }
                    .resp-label { font-size: 0.6rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
                    .resp-name { font-size: 0.8rem; font-weight: 700; color: var(--text-primary); }
                    .resp-edit { color: var(--text-tertiary); cursor: pointer; transition: 0.2s; visibility: hidden; }
                    .glass-card:hover .resp-edit { visibility: visible; }
                    .resp-edit:hover { color: var(--brand-blue); }

                    .mng-pop { position: absolute; top: calc(100% + 8px); left: 0; right: 0; z-index: 2100; padding: 5px; display: none; background: white; border: 1px solid var(--glass-border); border-radius: 12px; box-shadow: var(--shadow-xl); max-height: 250px; overflow-y: auto; }
                    .mng-pop.active { display: block; animation: popUp 0.1s ease; }
                    .mng-row { padding: 8px 10px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
                    .mng-row:hover { background: var(--bg-secondary); color: var(--text-primary); }

                    /* Sidebar Cluster List */
                    .cluster-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.65rem 0.85rem; border-radius: 10px; cursor: pointer; border: 1px solid transparent; background: transparent; transition: 0.2s; }
                    .cluster-item:hover { background: var(--bg-secondary); transform: translateX(3px); }
                    .cluster-item.active { border-color: var(--brand-viola); background: rgba(97, 74, 162, 0.035); }
                    
                    /* Cluster Detail Header */
                    .cluster-header-card { padding: 1.25rem 1.5rem; background: var(--card-bg); border: 1px solid var(--glass-border); border-radius: 16px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 1rem; }
                    .cluster-title { font-size: 1.4rem; font-weight: 800; color: var(--text-primary); font-family: var(--font-titles); letter-spacing: -0.02em; }
                    .cluster-stats-row { display: flex; align-items: center; gap: 1.25rem; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 0.75rem; }
                    .cluster-stat { display: flex; align-items: baseline; gap: 4px; }
                    .cluster-stat .n { font-size: 1rem; font-weight: 800; color: var(--text-primary); }
                    .cluster-stat .l { font-size: 0.8rem; font-weight: 600; color: var(--text-tertiary); }
                    
                    /* Tabs */
                    .hub-tabs { display: flex; background: rgba(255,255,255,0.7); border-bottom: 1px solid var(--glass-border); padding: 0 1.25rem; gap: 0.5rem; backdrop-filter: blur(10px); position: sticky; top: 0; z-index: 10; margin-top: 0.5rem; }
                    .hub-tab { display: flex; align-items: center; gap: 0.5rem; padding: 1.15rem 0.5rem; border: none; background: none; cursor: pointer; font-size: 0.8rem; font-weight: 600; color: var(--text-tertiary); border-bottom: 2px solid transparent; transition: 0.2s; white-space: nowrap; margin-bottom: -1px; }
                    .hub-tab:hover { color: var(--text-primary); }
                    .hub-tab.active { color: var(--brand-blue); border-bottom-color: var(--brand-blue); font-weight: 700; }
                    .hub-tab .material-icons-round { font-size: 1.1rem; }

                    /* Master Action */
                    .premium-add-btn { width: 100%; height: 44px; border-radius: 12px; background: var(--brand-gradient); border: none; color: white; font-family: var(--font-titles); font-weight: 800; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(97, 74, 162, 0.15); letter-spacing: 0.05em; }
                    .premium-add-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(97, 74, 162, 0.25); }
                    .master-dropdown { position: absolute; bottom: calc(100% + 8px); left: 0; right: 0; background: white; border: 1px solid var(--glass-border); border-radius: 14px; box-shadow: var(--shadow-xl); padding: 5px; display: none; z-index: 2000; }
                    .master-dropdown.active { display: block; animation: popUp 0.15s ease; }
                    .drop-opt { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px; cursor: pointer; transition: 0.2s; color: var(--text-primary); }
                    .drop-opt:hover { background: var(--bg-secondary); }

                    /* Table & Grid */
                    
                    .pm-summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; margin-bottom: 1.5rem; }
                    .pm-card { background: white; border-radius: 16px; padding: 1.25rem; border: none; box-shadow: var(--shadow-sm); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); border-left: 4px solid transparent; position: relative; overflow: hidden; display: flex; justify-content: space-between; align-items: flex-start; }
                    .pm-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); }
                    .card-count { font-size: 1.75rem; font-weight: 700; color: var(--text-primary); line-height: 1; font-family: var(--font-titles); margin-top: 0.25rem; }
                    
                    .pm-filter-bar { padding: 1rem 1.5rem; display: flex; align-items: center; gap: 1.5rem; background: #fcfcfd; border-bottom: 1px solid var(--glass-border); }
.m-table { width: 100%; border-collapse: separate; border-spacing: 0; }
                    .m-table th { padding: 1rem 1.25rem; text-align: left; font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 800; background: rgba(255,255,255,0.7); border-bottom: 2px solid var(--bg-primary); position: sticky; top: 0; z-index: 10; }
                    .m-table td { padding: 0.85rem 1.25rem; border-bottom: 1px solid rgba(0,0,0,0.025); vertical-align: middle; }
                    .m-row { cursor: pointer; transition: 0.2s; }
                    .m-row:hover { background: #fafafa; }
                    .avatar-stack-v { display: flex; align-items: center; }
                    .avatar-stack-v .face { margin-left: -8px; border: 2px solid white; border-radius: 50%; width: 28px; height: 28px; overflow: hidden; background: white; transition: 0.2s; }
                    .avatar-stack-v .face:first-child { margin-left: 0; }

                    .health-dot { width: 6px; height: 6px; border-radius: 50%; }
                    .health-dot.stable { background: var(--brand-blue); box-shadow: 0 0 8px rgba(59, 130, 246, 0.5); }
                    .health-dot.urgent { background: #ef4444; box-shadow: 0 0 8px rgba(239, 68, 68, 0.5); }

                    @keyframes popUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                </style>

                <div class="project-hub animate-fade-in">
                    <div class="project-hub-container">
                        <aside class="hub-sidebar">
                            <div class="glass-card sidebar-card" style="z-index: 100;">
                                <button class="area-trigger" id="area-trigger">
                                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                                        <div style="width: 28px; height: 28px; border-radius: 6px; background: ${activeArea.bg}; display: flex; align-items: center; justify-content: center; color: ${activeArea.color};">
                                            <span class="material-icons-round" style="font-size: 1rem;">${activeArea.icon}</span>
                                        </div>
                                        <span style="font-family: var(--font-titles); font-weight: 700; font-size: 1rem; color: var(--text-primary);">${activeArea.label}</span>
                                    </div>
                                    <span class="material-icons-round" style="color: var(--text-tertiary); font-size: 1.1rem;">unfold_more</span>
                                </button>
                                <div class="area-pop" id="area-pop">
                                    ${COMPANY_AREAS.map(a => `<div class="opt-row ${a.id === currentAreaId ? 'active' : ''}" data-id="${a.id}"><span class="material-icons-round" style="font-size: 1rem; color: ${a.id === currentAreaId ? 'white' : a.color}">${a.icon}</span> ${a.label}</div>`).join('')}
                                </div>
                                <div class="resp-block">
                                    <div class="resp-info">
                                        ${manager ? renderAvatar(manager, { size: 28, borderRadius: '50%' }) : `<div style="width: 28px; height: 28px; border-radius: 50%; background: var(--bg-secondary); display: flex; align-items: center; justify-content: center; color: var(--text-tertiary);"><span class="material-icons-round" style="font-size: 1rem;">person_outline</span></div>`}
                                        <div><div class="resp-label">Responsabile Hub</div><div class="resp-name">${manager ? manager.full_name : 'Non assegnato'}</div></div>
                                    </div>
                                    ${isPartner ? `<span class="material-icons-round resp-edit" id="mng-trigger" title="Modifica responsabile">edit</span>` : ''}
                                </div>
                                <div class="mng-pop" id="mng-pop">
                                    <div style="padding: 8px; font-weight: 800; font-size: 0.6rem; color: var(--text-tertiary); text-transform: uppercase;">Seleziona Responsabile</div>
                                    <div class="mng-row" data-val="">Nessuno</div>
                                    ${collaborators.filter(c => (c.tags || '').toLowerCase().includes('account') || (c.tags || '').toLowerCase().includes('project manager')).map(c => `
                                        <div class="mng-row" data-val="${c.id}">${renderAvatar(c, { size: 22, borderRadius: '50%' })} ${c.full_name}</div>
                                    `).join('')}
                                </div>
                            </div>

                            <div class="glass-card sidebar-card" style="flex: 1; display: flex; flex-direction: column; overflow: visible;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; padding: 0 4px;">
                                    <span style="font-size: 0.6rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase;">Clusters</span>
                                    <span class="material-icons-round" style="font-size: 1rem; color: var(--text-tertiary); opacity: 0.5;">workspaces</span>
                                </div>
                                <div style="flex: 1; overflow-y: auto;">
                                    ${areaClusters.length === 0 ? `<div style="padding: 2rem; text-align: center; color: var(--text-tertiary); font-size: 0.75rem;">Nessun cluster</div>` : areaClusters.map(c => `
                                        <a href="#pm/space/${c.id}" class="cluster-item" style="text-decoration: none;">
                                            <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary)">folder</span>
                                            <div style="min-width: 0;"><div style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.name}</div><div style="font-size: 0.55rem; color: var(--text-tertiary); font-weight: 600;">${statsMap[c.id].activeProjects} progetti correlati</div></div>
                                        </a>
                                    `).join('')}
                                </div>
                            </div>

                            <div style="position: relative; z-index: 50;">
                                <button class="premium-add-btn" id="master-add-btn"><span class="material-icons-round" style="font-size: 1.1rem;">add</span> CREA NUOVO ELEMENTO</button>
                                <div class="master-dropdown" id="master-add-dropdown">
                                    <div class="drop-opt" id="opt-project"><div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(59, 130, 246, 0.08); display: flex; align-items: center; justify-content: center; color: var(--brand-blue);"><span class="material-icons-round">business_center</span></div><div><div style="font-size: 0.8rem; font-weight: 700;">Progetto Interno</div><div style="font-size: 0.65rem; color: var(--text-tertiary);">Spazio operativo dedicato</div></div></div>
                                    <div style="height: 1px; background: var(--bg-primary); margin: 4px 8px;"></div>
                                    <div class="drop-opt" id="opt-cluster"><div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(139, 92, 246, 0.08); display: flex; align-items: center; justify-content: center; color: var(--brand-viola);"><span class="material-icons-round">workspaces</span></div><div><div style="font-size: 0.8rem; font-weight: 700;">Cluster Dipartimentale</div><div style="font-size: 0.65rem; color: var(--text-tertiary);">Organizza più progetti</div></div></div>
                                </div>
                            </div>
                        </aside>

                        <main class="hub-main-content">
                            <header style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1rem;">
                                <div>
                                    <div style="font-size: 0.6rem; font-weight: 800; color: var(--brand-blue); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 2px;">PANORAMICA AREA</div>
                                    <h2 id="hub-title" style="font-size: 1.4rem; font-weight: 800; margin: 0; color: var(--text-primary); font-family: var(--font-titles); letter-spacing: -0.015em;">Overview ${activeArea.label}</h2>
                                </div>
                            </header>

                            <div class="glass-card" style="display: flex; flex-direction: column; min-height: 600px; flex: 1; overflow: hidden; border: none;">
                                <div class="hub-tabs">
                                    <button class="hub-tab ${currentTab === 'overview' ? 'active' : ''}" data-tab="overview"><span class="material-icons-round">dashboard</span>Overview</button>
                                    <button class="hub-tab ${currentTab === 'board' ? 'active' : ''}" data-tab="board"><span class="material-icons-round">view_kanban</span>Board</button>
                                    <button class="hub-tab ${currentTab === 'appointments' ? 'active' : ''}" data-tab="appointments"><span class="material-icons-round">calendar_today</span>Appuntamenti</button>
                                    <button class="hub-tab ${currentTab === 'feed' ? 'active' : ''}" data-tab="feed"><span class="material-icons-round">history</span>Feed</button>
                                    <button class="hub-tab ${currentTab === 'docs' ? 'active' : ''}" data-tab="docs"><span class="material-icons-round">description</span>Documenti</button>
                                    <button class="hub-tab ${currentTab === 'risorse' ? 'active' : ''}" data-tab="risorse"><span class="material-icons-round">cloud</span>Risorse</button>
                                    <button class="hub-tab ${currentTab === 'file' ? 'active' : ''}" data-tab="file"><span class="material-icons-round">folder_open</span>File</button>
                                </div>
                                <div id="hub-tab-content" style="flex: 1; padding: 1.5rem; overflow-y: auto;">
                                    <div style="display:flex; align-items:center; justify-content:center; height:300px;"><span class="loader"></span></div>
                                </div>
                            </div>
                        </main>
                    </div>
                </div>
            `;

            renderTab();
            bindBaseHandlers();
        };
        const renderTab = async () => {
            const content = container.querySelector('#hub-tab-content');
            const activeArea = COMPANY_AREAS.find(a => a.id === currentAreaId) || COMPANY_AREAS[0];
            
            let visibleProjects = [];
            if (currentClusterId === 'all') {
                visibleProjects = (spaces || []).filter(s => !s.is_cluster && (s.area || '').toLowerCase() === activeArea.label.toLowerCase() && !s.parent_ref);
            } else {
                visibleProjects = (spaces || []).filter(s => s.parent_ref === currentClusterId);
            }

            // FILTER LOGIC: Aggregate ALL spaces in the area/cluster context
            let targetSpaceIds = [];
            if (currentClusterId === 'all') {
                targetSpaceIds = (spaces || []).filter(s => (s.area || '').toLowerCase() === activeArea.label.toLowerCase()).map(s => s.id);
            } else {
                targetSpaceIds = [currentClusterId, ...(spaces || []).filter(s => s.parent_ref === currentClusterId).map(s => s.id)];
            }
            if (targetSpaceIds.length === 0) targetSpaceIds = ['__empty__'];

            if (currentTab === 'overview') {
                const spaceNamesMap = {};
                (spaces || []).forEach(s => spaceNamesMap[s.id] = s.name);
                
                let cloudLinks = [];
                (spaces || []).forEach(s => {
                    if (targetSpaceIds.includes(s.id) && s.cloud_links) {
                        try {
                            const links = typeof s.cloud_links === 'string' ? JSON.parse(s.cloud_links) : s.cloud_links;
                            if (Array.isArray(links)) cloudLinks.push(...links);
                        } catch (e) {}
                    }
                });

                import('./components/area_overview.js?v=8001').then(mod => {
                    mod.renderAreaOverview(content, targetSpaceIds, spaceNamesMap, cloudLinks);
                });

            } else if (currentTab === 'board') {
                content.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:200px;"><span class="loader"></span></div>`;
                
                // We need all items related to these spaces
                const { data: boardItems, error: bErr } = await supabase
                    .from('pm_items')
                    .select('*, pm_item_assignees(*, user:collaborators(*))')
                    .in('space_ref', targetSpaceIds)
                    .is('archived_at', null);

                if (bErr) { content.innerHTML = `<div style="padding:2rem; color:red;">Errore: ${bErr.message}</div>`; return; }

                const dummySpace = { id: currentClusterId || 'area', name: activeArea.label, is_cluster: true, area: activeArea.id };
                
                import('./components/hub_tree.js?v=8000').then(mod => {
                    mod.renderHubTree(content, boardItems || [], dummySpace, currentClusterId || currentAreaId);
                });

            } else if (currentTab === 'appointments') {
                content.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:200px;"><span class="loader"></span></div>`;
                
                const { fetchAppointments, fetchAppointmentTypes } = await import('../../modules/pm_api.js?v=8000');
                
                // Fetch appointments for all spaces in the target list
                const { data: appts, error: aErr } = await supabase
                    .from('appointments')
                    .select('*, appointment_type_links(appointment_types(*)), appointment_internal_participants(*, user:collaborators(*))')
                    .in('pm_space_id', targetSpaceIds);

                const types = await fetchAppointmentTypes();

                if (aErr) { content.innerHTML = `<div style="padding:2rem; color:red;">Errore: ${aErr.message}</div>`; return; }

                // Map to the expected flat format for the component
                const mappedAppts = (appts || []).map(a => ({
                    ...a,
                    types: (a.appointment_type_links || []).map(l => l.appointment_types).filter(Boolean),
                    participants: {
                        internal: (a.appointment_internal_participants || []).map(p => ({
                            ...p,
                            user: p.user
                        }))
                    }
                }));

                import('./components/hub_appointments.js?v=8000').then(mod => {
                    mod.renderHubAppointments(content, mappedAppts, types, currentClusterId || currentAreaId, 'space');
                });

            } else if (currentTab === 'feed') {
                content.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:200px;"><span class="loader"></span></div>`;
                
                const contextIds = targetSpaceIds;
                
                // Fetch and filter logs for the cluster context
                const logs = await fetchPMActivityLogs(null, null, null, null);
                const filteredLogs = logs.filter(l => contextIds.includes(l.space_ref));
                
                content.innerHTML = `
                    <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 8px;"><span class="material-icons-round" style="font-size: 1rem; color: var(--brand-blue);">history</span> FEED ATTIVITÀ CLUSTER</div>
                    ${filteredLogs.length === 0 ? `<div style="padding: 3rem; text-align: center; color: var(--text-tertiary); font-style: italic;">Nessuna attività recente registrata per questo cluster.</div>` : filteredLogs.slice(0, 30).map(l => {
                        const human = humanizeActivity(l);
                        return `
                        <div style="display: flex; gap: 1rem; padding: 1rem; border-bottom: 1px solid var(--bg-primary); animation: fadeIn 0.3s ease; cursor:pointer;" onclick="import('./components/hub_drawer.js?v=8026').then(m => m.openHubDrawer('${l.item_ref}', '${l.space_ref}'))">
                            ${renderAvatar(l.actor || { full_name: 'S' }, { size: 32, borderRadius: '50%' })}
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4;">
                                    <strong style="color:var(--text-primary);">${human.actorName}</strong> ${human.formattedDesc}
                                </div>
                                <div style="font-size: 0.7rem; color: var(--text-tertiary); margin-top: 4px;">${new Date(l.created_at).toLocaleString('it-IT')}</div>
                            </div>
                        </div>
                    `}).join('')}
                `;


            } else if (currentTab === 'docs') {
                if (currentClusterId !== 'all') {
                    // Show directly for the selected cluster
                    content.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:300px;"><span class="loader"></span></div>`;
                    const { renderDocsView } = await import('../docs/DocsView.js?v=8003');
                    await renderDocsView(content, currentClusterId);
                } else {
                    // Area level: Show list of cluster documentations
                    if (areaClusters.length === 0) {
                        content.innerHTML = `<div style="padding: 3rem; text-align: center; color: var(--text-tertiary);">Nessun cluster trovato in quest'area per visualizzare la documentazione.</div>`;
                    } else {
                        content.innerHTML = `
                            <div style="max-width: 800px; margin: 0 auto;">
                                <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 1.5rem; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px;">
                                    <span class="material-icons-round" style="font-size: 1rem; color: var(--brand-blue);">description</span> DOCUMENTAZIONE DEI CLUSTER
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    ${areaClusters.map(c => `
                                        <div class="docs-cluster-card" data-id="${c.id}" style="
                                            padding: 1.5rem; background: white; border-radius: 12px; border: 1px solid var(--surface-2); 
                                            cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 1rem;
                                        " onmouseover="this.style.borderColor='var(--brand-blue)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='var(--surface-2)'; this.style.transform='none';">
                                            <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(59, 130, 246, 0.08); color: var(--brand-blue); display: flex; align-items: center; justify-content: center;">
                                                <span class="material-icons-round">description</span>
                                            </div>
                                            <div style="flex: 1; min-width: 0;">
                                                <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.name}</div>
                                                <div style="font-size: 0.75rem; color: var(--text-tertiary);">Apri Notion</div>
                                            </div>
                                            <span class="material-icons-round" style="color: var(--text-tertiary); font-size: 1.25rem;">chevron_right</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                        content.querySelectorAll('.docs-cluster-card').forEach(card => {
                            card.onclick = async () => {
                                const cid = card.dataset.id;
                                content.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:300px;"><span class="loader"></span></div>`;
                                const { renderDocsView } = await import('../docs/DocsView.js?v=8003');
                                await renderDocsView(content, cid);
                            };
                        });
                    }
                }

            } else if (currentTab === 'risorse') {
                const activeSpaceId = currentClusterId !== 'all' ? currentClusterId : null;
                const activeSpace = spaces.find(s => s.id === activeSpaceId);

                if (!activeSpaceId) {
                    content.innerHTML = `
                        <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-tertiary); margin-bottom: 2rem; display: flex; align-items: center; gap: 8px; text-transform: uppercase;">
                            <span class="material-icons-round" style="font-size: 1rem; color: #f59e0b;">cloud_queue</span> PANORAMICA RISORSE AREA
                        </div>
                        <div style="padding: 3rem; text-align: center; background: white; border-radius: 16px; border: 1px dashed var(--surface-2);">
                            <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--bg-secondary); color: var(--text-tertiary); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                                <span class="material-icons-round" style="font-size: 2rem;">mouse</span>
                            </div>
                            <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">Seleziona un Cluster per gestire le sue risorse</div>
                            <div style="font-size: 0.85rem; color: var(--text-tertiary);">Per caricare nuovi link o documenti, seleziona un cluster specifico dalla barra laterale.</div>
                        </div>
                    `;
                } else {
                    content.innerHTML = `
                        <div style="display: flex; flex-direction: column; gap: 2rem;">
                            <section>
                                <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 8px;">
                                    <span class="material-icons-round" style="font-size: 1rem; color: #f59e0b;">cloud_queue</span> RISORSE DIRETTE CLUSTER
                                </div>
                                <div id="space-cloud-links-container" style="background: white; padding: 1.5rem; border-radius: 16px; border: 1px solid var(--surface-2);"></div>
                            </section>

                            <section>
                                <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-tertiary); margin-bottom: 1.25rem; display: flex; align-items: center; gap: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
                                    <span class="material-icons-round" style="font-size: 0.9rem; color: var(--text-tertiary);">link</span> LINK DALLE ATTIVITÀ (READ-ONLY)
                                </div>
                                <div id="task-links-container"></div>
                            </section>
                        </div>
                    `;

                    // Initialize Manager for Cluster Links
                    new CloudLinksManager(
                        content.querySelector('#space-cloud-links-container'),
                        activeSpace.cloud_links || [],
                        async (newLinks) => {
                            try {
                                await updateSpaceCloudLinks(activeSpaceId, newLinks);
                                activeSpace.cloud_links = newLinks;
                            } catch (e) {
                                console.error("Error updating cloud links:", e);
                                alert("Errore nel salvataggio dei link.");
                            }
                        }
                    );

                    // Task links
                    const visibleProjectIds = (visibleProjects || []).map(p => p.id);
                    const contextIds = [currentClusterId, ...visibleProjectIds];
                    const docItems = (allItems || []).filter(item => contextIds.includes(item.space_ref) && item.cloud_links && item.cloud_links.length > 0);
                    const allLinks = [];
                    docItems.forEach(item => { 
                        item.cloud_links.forEach(link => {
                            const spaceName = spaces.find(s => s.id === item.space_ref)?.name || 'Progetto';
                            allLinks.push({ ...link, itemTitle: item.title, spaceName }); 
                        });
                    });

                    const taskContainer = content.querySelector('#task-links-container');
                    if (allLinks.length === 0) {
                        taskContainer.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-tertiary); font-size: 0.8rem; background: var(--bg-primary); border-radius: 12px; border: 1px solid var(--surface-2);">Nessun link trovato nelle attività del cluster.</div>`;
                    } else {
                        taskContainer.innerHTML = `
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                ${allLinks.map(link => `
                                    <a href="${link.url}" target="_blank" style="display: flex; align-items: center; gap: 1rem; padding: 12px 16px; border-radius: 10px; border: 1px solid var(--surface-2); background: white; text-decoration: none; transition: 0.2s;" onmouseover="this.style.borderColor='var(--brand-blue)'" onmouseout="this.style.borderColor='var(--surface-2)'">
                                        <span class="material-icons-round" style="color: var(--text-tertiary); font-size: 1.25rem;">link</span>
                                        <div style="flex: 1;"><div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">${link.title || 'Senza titolo'}</div><div style="font-size: 0.65rem; color: var(--text-tertiary);">Task: ${link.itemTitle}</div></div>
                                        <span class="material-icons-round" style="color: var(--text-tertiary); font-size: 1rem;">open_in_new</span>
                                    </a>
                                `).join('')}
                            </div>
                        `;
                    }
                }

            } else if (currentTab === 'file') {
                content.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:200px;"><span class="loader"></span></div>';
                const { initFilesTab, initAreaFilesTab } = await import('./components/hub/files_tab.js?v=8003');

                if (currentClusterId !== 'all') {
                    // Single cluster: render file tab directly
                    content.innerHTML = '<div id="tab-files"></div>';
                    initFilesTab(content, null, currentClusterId);
                } else {
                    // Area level: sezione generale area + accordion per cluster/progetti
                    const areaSpacesForFiles = (spaces || []).filter(s => (s.area || '').toLowerCase() === activeArea.label.toLowerCase());
                    const sorted = [...areaSpacesForFiles].sort((a, b) => (b.is_cluster ? 1 : 0) - (a.is_cluster ? 1 : 0));

                    content.innerHTML = `
                        <style>
                            .af-section { background: white; border-radius: 16px; box-shadow: var(--shadow-sm); margin-bottom: 1rem; overflow: hidden; }
                            .af-header { display: flex; align-items: center; gap: 0.75rem; padding: 0.9rem 1.25rem; cursor: pointer; border-bottom: 1px solid var(--surface-2); user-select: none; }
                            .af-header:hover { background: var(--bg-secondary); }
                            .af-body { padding: 1rem; }
                            .af-body.collapsed { display: none; }
                        </style>
                        <div class="af-section" style="border: 1px dashed #e2e8f0; background: #fafbfc; box-shadow: none;">
                            <div class="af-header" data-area-section style="border-bottom: none;">
                                <span class="material-icons-round" style="font-size:1.2rem; color:#94a3b8;">cloud_upload</span>
                                <div style="flex:1; min-width:0;">
                                    <div style="font-size:0.82rem; font-weight:600; color:var(--text-secondary);">File generali area</div>
                                    <div style="font-size:0.6rem; color:var(--text-tertiary);">File non legati a un cluster specifico</div>
                                </div>
                                <span class="af-toggle" style="color:var(--text-tertiary); font-size:1.1rem;">▼</span>
                            </div>
                            <div class="af-body collapsed" data-area-id="${activeArea.id}">
                                <div id="tab-files-area-${activeArea.id}"></div>
                            </div>
                        </div>
                        ${sorted.map((s, i) => `
                            <div class="af-section">
                                <div class="af-header" data-idx="${i}">
                                    <div style="width:28px; height:28px; border-radius:8px; background:${activeArea.bg}; color:${activeArea.color}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                        <span class="material-icons-round" style="font-size:1rem;">${s.is_cluster ? 'workspaces' : 'folder_special'}</span>
                                    </div>
                                    <div style="flex:1; min-width:0;">
                                        <div style="font-size:0.85rem; font-weight:700; color:var(--text-primary);">${s.name}</div>
                                        <div style="font-size:0.6rem; font-weight:700; color:var(--text-tertiary); text-transform:uppercase;">${s.is_cluster ? 'Cluster' : 'Progetto'}</div>
                                    </div>
                                    <span class="af-toggle" style="color:var(--text-tertiary); font-size:1.1rem;">${i === 0 ? '▲' : '▼'}</span>
                                </div>
                                <div class="af-body ${i === 0 ? '' : 'collapsed'}" data-space-id="${s.id}">
                                    <div id="tab-files-${s.id}"></div>
                                </div>
                            </div>
                        `).join('')}
                    `;

                    // Inizializza il primo cluster subito (è già aperto)
                    const initSection = (spaceId) => {
                        const body = content.querySelector('[data-space-id="' + spaceId + '"]');
                        if (!body || body.dataset.initialized) return;
                        body.dataset.initialized = 'true';
                        const tabEl = body.querySelector('#tab-files-' + spaceId);
                        if (!tabEl) return;
                        const wrapper = { querySelector: (sel) => sel === '#tab-files' ? tabEl : body.querySelector(sel) };
                        initFilesTab(wrapper, null, spaceId);
                    };

                    if (sorted[0]) initSection(sorted[0].id);

                    // Toggle sezione area generale (lazy-init al primo open)
                    const areaHeader = content.querySelector('[data-area-section]');
                    if (areaHeader) {
                        areaHeader.addEventListener('click', () => {
                            const body = areaHeader.nextElementSibling;
                            const toggle = areaHeader.querySelector('.af-toggle');
                            const isCollapsed = body.classList.contains('collapsed');
                            body.classList.toggle('collapsed', !isCollapsed);
                            if (toggle) toggle.textContent = isCollapsed ? '▲' : '▼';
                            if (isCollapsed) {
                                const areaTabEl = body.querySelector('#tab-files-area-' + activeArea.id);
                                if (areaTabEl && !body.dataset.initialized) {
                                    body.dataset.initialized = 'true';
                                    const wrapper = { querySelector: (sel) => sel === '#tab-files' ? areaTabEl : body.querySelector(sel) };
                                    initAreaFilesTab(wrapper, activeArea.id);
                                }
                            }
                        });
                    }

                    content.querySelectorAll('.af-header[data-idx]').forEach(header => {
                        header.addEventListener('click', () => {
                            const body = header.nextElementSibling;
                            const toggle = header.querySelector('.af-toggle');
                            const isCollapsed = body.classList.contains('collapsed');
                            body.classList.toggle('collapsed', !isCollapsed);
                            if (toggle) toggle.textContent = isCollapsed ? '▲' : '▼';
                            if (isCollapsed) initSection(body.dataset.spaceId);
                        });
                    });
                }
            }
        };

        const bindBaseHandlers = () => {
            const areaBtn = container.querySelector('#area-trigger');
            const areaMenu = container.querySelector('#area-pop');
            areaBtn.onclick = (e) => { e.stopPropagation(); areaMenu.classList.toggle('active'); mngPop.classList.remove('active'); masterDrop.classList.remove('active'); };

            const mngBtn = container.querySelector('#mng-trigger');
            const mngPop = container.querySelector('#mng-pop');
            if (mngBtn) mngBtn.onclick = (e) => { e.stopPropagation(); mngPop.classList.toggle('active'); areaMenu.classList.remove('active'); masterDrop.classList.remove('active'); };

            const masterBtn = container.querySelector('#master-add-btn');
            const masterDrop = container.querySelector('#master-add-dropdown');
            masterBtn.onclick = (e) => { e.stopPropagation(); masterDrop.classList.toggle('active'); areaMenu.classList.remove('active'); mngPop.classList.remove('active'); };
            
            window.onclick = () => { areaMenu?.classList.remove('active'); mngPop?.classList.remove('active'); masterDrop?.classList.remove('active'); };

            container.querySelectorAll('.opt-row').forEach(opt => {
                opt.onclick = () => { currentAreaId = opt.dataset.id; currentClusterId = 'all'; renderUI(); };
            });

            container.querySelectorAll('.mng-row').forEach(row => {
                row.onclick = async () => {
                    const collabId = row.dataset.val;
                    await supabase.from('system_config').upsert({ key: `area_manager_${currentAreaId}`, value: collabId || '', description: `Manager for ${currentAreaId}` });
                    areaManagers[currentAreaId] = collabId;
                    renderUI();
                };
            });

            /* cluster-item handlers moved to standard <a> href navigation */
            container.querySelectorAll('.kpi-h-card').forEach(k => {
                k.onclick = () => { currentKpiFilter = k.dataset.kpi; renderUI(); };
            });

            container.querySelectorAll('.hub-tab').forEach(t => {
                t.onclick = () => { currentTab = t.dataset.tab; container.querySelectorAll('.hub-tab').forEach(b => b.classList.remove('active')); t.classList.add('active'); renderTab(); };
            });

            container.querySelector('#opt-project').onclick = () => openProjectModal({ onSuccess: (res) => window.location.hash = `#pm/space/${res.id}` });
            container.querySelector('#opt-cluster').onclick = () => openProjectModal({ forceType: 'cluster', onSuccess: () => renderInternalProjects(container) });
        };
        renderUI();

        // 10. Real-time Listeners
        const refreshHandler = (e) => {
            if (!container.isConnected) {
                console.log('[InternalProjects] Container disconnected, cleaning up listener...');
                document.removeEventListener('pm-item-changed', refreshHandler);
                document.removeEventListener('pm-space-changed', refreshHandler);
                return;
            }
            console.log('[InternalProjects] Change detected, refreshing list...');
            renderInternalProjects(container, currentAreaId);
        };

        if (window._internalRefresher) {
            document.removeEventListener('pm-item-changed', window._internalRefresher);
            document.removeEventListener('pm-space-changed', window._internalRefresher);
        }
        window._internalRefresher = refreshHandler;
        document.addEventListener('pm-item-changed', refreshHandler);
        document.addEventListener('pm-space-changed', refreshHandler);

    } catch (err) {
        console.error("Hub Error:", err);
        container.innerHTML = `<div style="padding: 4rem; text-align: center; color: #ef4444;">Errore: ${err.message}</div>`;
    }
}
