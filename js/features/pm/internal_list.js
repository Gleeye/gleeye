import { fetchInternalSpaces, createInternalSpace, createCluster, createProjectInCluster, fetchPMActivityLogs } from '../../modules/pm_api.js?v=1241';
import { openProjectModal } from './components/project_modal.js?v=1241';
import { supabase } from '../../modules/config.js';
import { state } from '../../modules/state.js';
import { renderAvatar } from '../../modules/utils.js?v=1241';

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

            const kpiTotal = visibleProjects.length;
            const kpiOpen = visibleProjects.reduce((acc, p) => acc + (statsMap[p.id]?.activities.open || 0), 0);
            const kpiOverdue = visibleProjects.reduce((acc, p) => acc + (statsMap[p.id]?.activities.overdue || 0), 0);

            // Filter projects based on KPI
            let filteredProjects = [...visibleProjects];
            if (currentKpiFilter === 'open') filteredProjects = filteredProjects.filter(p => (statsMap[p.id]?.activities.open || 0) > 0);
            else if (currentKpiFilter === 'overdue') filteredProjects = filteredProjects.filter(p => (statsMap[p.id]?.activities.overdue || 0) > 0);

            const isPartner = (state.profile?.tags || []).includes('Partner') || state.profile?.role === 'admin';
            const managerId = areaManagers[currentAreaId];
            const manager = collaborators.find(c => c.id === managerId);

            container.innerHTML = `
                <style>
                    .project-hub { width: auto; margin: 0 -3rem !important; padding: 0 !important; background: transparent; font-family: var(--font-body); }
                    .project-hub-container { display: flex; width: 100%; min-height: calc(100vh - 60px); gap: 2rem; padding: 1.5rem 2.5rem 2rem 2.5rem; }
                    
                    .hub-sidebar { width: 280px; flex-shrink: 0; display: flex; flex-direction: column; gap: 1rem; }
                    .hub-main-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1rem; }
                    
                    .glass-card { background: white; border: 1px solid var(--glass-border); border-radius: 12px; box-shadow: var(--shadow-sm); position: relative; }
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
                            <header style="display: flex; justify-content: space-between; align-items: flex-end;">
                                <div><div style="font-size: 0.6rem; font-weight: 800; color: var(--brand-blue); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 2px;">PANORAMICA AREA</div><h2 id="hub-title" style="font-size: 1.1rem; font-weight: 800; margin: 0; color: var(--text-primary); font-family: var(--font-titles); letter-spacing: -0.015em;">Overview ${activeArea.label}</h2></div>
                                <div class="kpi-h-row">
                                    <div class="kpi-h-card ${currentKpiFilter === 'all' ? 'active' : ''}" data-kpi="all"><span class="n">${kpiTotal}</span> <span class="l">Progetti</span></div>
                                    <div class="kpi-h-card ${currentKpiFilter === 'open' ? 'active blue' : ''}" data-kpi="open"><span class="n">${kpiOpen}</span> <span class="l">Aperti</span></div>
                                    <div class="kpi-h-card ${currentKpiFilter === 'overdue' ? 'active red' : ''}" data-kpi="overdue"><span class="n">${kpiOverdue}</span> <span class="l">Ritardi</span></div>
                                </div>
                            </header>

                            <div class="glass-card" style="display: flex; flex-direction: column; min-height: 600px; flex: 1; overflow: hidden; border: 1px solid var(--glass-border);">
                                <div class="hub-tabs">
                                    <button class="hub-tab ${currentTab === 'overview' ? 'active' : ''}" data-tab="overview"><span class="material-icons-round">dashboard</span>Overview</button>
                                    <button class="hub-tab ${currentTab === 'feed' ? 'active' : ''}" data-tab="feed"><span class="material-icons-round">history</span>Feed</button>
                                    <button class="hub-tab ${currentTab === 'team' ? 'active' : ''}" data-tab="team"><span class="material-icons-round">groups</span>Team</button>
                                    <button class="hub-tab ${currentTab === 'docs' ? 'active' : ''}" data-tab="docs"><span class="material-icons-round">description</span>Documenti</button>
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
            const contextSpaceIds = [currentClusterId, ...visibleProjects.map(s => s.id)];

            if (currentTab === 'overview') {
                let filtered = [...visibleProjects];
                if (currentKpiFilter === 'open') filtered = filtered.filter(p => (statsMap[p.id]?.activities.open || 0) > 0);
                else if (currentKpiFilter === 'overdue') filtered = filtered.filter(p => (statsMap[p.id]?.activities.overdue || 0) > 0);

                content.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 8px;"><span class="material-icons-round" style="font-size: 1rem; color: var(--brand-viola);">insights</span> MONITORAGGIO PERFORMANCE</div>
                        <div style="position: relative;"><input type="text" id="m-search" placeholder="Cerca nel workspace..." style="background: var(--bg-secondary); border: 1px solid var(--glass-border); border-radius: 8px; padding: 6px 12px 6px 30px; font-size: 0.75rem; width: 180px; outline: none;"><span class="material-icons-round" style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); font-size: 1rem; color: var(--text-tertiary);">search</span></div>
                    </div>
                    <table class="m-table">
                        <thead><tr><th style="width: 35%;">PROGETTO</th><th style="width: 20%;">TEAM</th><th style="width: 20%;">SAL</th><th style="width: 25%;">PROSSIMO STEP</th><th></th></tr></thead>
                        <tbody id="m-tbody">
                            ${filtered.length === 0 ? `<tr><td colspan="5" style="padding: 4rem; text-align: center; color: var(--text-tertiary); font-style: italic; font-size: 0.8rem;">Nessun progetto trovato per questo filtro.</td></tr>` : filtered.map(p => {
                                const s = statsMap[p.id];
                                const progress = s.activities.total > 0 ? Math.round(((s.activities.total - s.activities.open) / s.activities.total) * 100) : 0;
                                const teamIds = Array.from(s.activities.team || []);
                                const teamCollabs = teamIds.slice(0, 3).map(uid => getCollab(uid, null)).filter(Boolean);
                                const pmRec = p.pm_space_assignees?.find(a => ['manager', 'pm', 'admin'].includes(a.role)) || { user_ref: p.default_pm_user_ref };
                                const pm = getCollab(pmRec.user_ref, pmRec.collaborator_ref);
                                const next = s.activities.nextAction;
                                return `
                                    <tr class="m-row" onclick="window.location.hash='#pm/space/${p.id}'">
                                        <td><div style="display: flex; align-items: center; gap: 0.85rem;"><div class="health-dot ${s.activities.overdue > 0 ? 'urgent' : 'stable'}"></div><div style="min-width: 0;"><div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">${p.name}</div><div style="font-size: 0.6rem; color: var(--text-tertiary); font-weight: 700; text-transform: uppercase;">ID: ${p.id.slice(0,8)}</div></div></div></td>
                                        <td><div class="avatar-stack-v">${pm ? `<div class="face owner-v">${renderAvatar(pm, { size: 28, borderRadius: '50%' })}</div>` : ''}${teamCollabs.map((c, i) => `<div class="face" style="z-index: ${3-i}">${renderAvatar(c, { size: 28, borderRadius: '50%' })}</div>`).join('')}${teamIds.length > 4 ? `<div style="margin-left: -8px; width: 28px; height: 28px; border-radius: 50%; background: var(--bg-secondary); border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; font-weight: 800; color: var(--text-secondary);">+${teamIds.length-4}</div>` : ''}</div></td>
                                        <td><div style="display: flex; align-items: center; gap: 0.65rem;"><div style="flex: 1; height: 5px; background: var(--bg-secondary); border-radius: 5px; overflow: hidden;"><div style="width: ${progress}%; height: 100%; background: var(--brand-gradient);"></div></div><span style="font-size: 0.7rem; font-weight: 800; color: var(--text-primary);">${progress}%</span></div></td>
                                        <td><div style="display: flex; flex-direction: column; gap: 2px; ${next?.date && new Date(next.date) < now ? 'color: #ef4444' : ''}"><span style="font-size: 0.75rem; font-weight: 700;">${next ? next.title : 'Non pianificato'}</span>${next?.date ? `<span style="font-size: 0.6rem; color: var(--text-tertiary); font-weight: 700; display: flex; align-items: center; gap: 4px;"><span class="material-icons-round" style="font-size: 0.9rem;">calendar_today</span> ${new Date(next.date).toLocaleDateString()}</span>` : ''}</div></td>
                                        <td style="text-align: right;"><span class="material-icons-round" style="color: var(--text-tertiary); font-size: 1rem; opacity: 0.3;">arrow_forward</span></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `;
                const sInput = content.querySelector('#m-search');
                sInput.oninput = (e) => {
                    const t = e.target.value.toLowerCase();
                    content.querySelectorAll('#m-tbody tr').forEach(r => r.style.display = r.innerText.toLowerCase().includes(t) ? '' : 'none');
                };

            } else if (currentTab === 'feed') {
                content.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:200px;"><span class="loader"></span></div>`;
                
                const visibleProjectIds = visibleProjects.map(p => p.id);
                const contextIds = [currentClusterId, ...visibleProjectIds];
                
                // Fetch and filter logs for the cluster context
                const logs = await fetchPMActivityLogs(null, null, null, null);
                const filteredLogs = logs.filter(l => contextIds.includes(l.space_ref));
                
                content.innerHTML = `
                    <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 8px;"><span class="material-icons-round" style="font-size: 1rem; color: var(--brand-blue);">history</span> FEED ATTIVITÀ CLUSTER</div>
                    ${filteredLogs.length === 0 ? `<div style="padding: 3rem; text-align: center; color: var(--text-tertiary); font-style: italic;">Nessuna attività recente registrata per questo cluster.</div>` : filteredLogs.slice(0, 30).map(l => `
                        <div style="display: flex; gap: 1rem; padding: 1rem; border-bottom: 1px solid var(--bg-primary); animation: fadeIn 0.3s ease;">
                            ${renderAvatar(l.actor || { full_name: 'S' }, { size: 32, borderRadius: '50%' })}
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-size: 0.85rem; color: var(--text-primary); line-height: 1.4;">
                                    <strong>${l.authorName}</strong> ${l.action_type.replace(/_/g, ' ')} 
                                    <span style="color: var(--brand-blue); font-weight: 600;">${l.item?.title || l.space?.name || ''}</span>
                                </div>
                                <div style="font-size: 0.7rem; color: var(--text-tertiary); margin-top: 4px;">${new Date(l.created_at).toLocaleString('it-IT')}</div>
                            </div>
                        </div>
                    `).join('')}
                `;

            } else if (currentTab === 'team') {
                const uniqueTeamIds = new Set();
                
                // Aggregating team members from all projects within the cluster
                visibleProjects.forEach(p => {
                    const s = statsMap[p.id];
                    if (s) s.activities.team.forEach(uid => uniqueTeamIds.add(uid));
                });
                
                // Also add members assigned directly to the cluster space itself
                const clusterStats = statsMap[currentClusterId];
                if (clusterStats) clusterStats.activities.team.forEach(uid => uniqueTeamIds.add(uid));

                const team = Array.from(uniqueTeamIds).map(uid => collaborators.find(c => c.user_id === uid)).filter(Boolean);

                content.innerHTML = `
                    <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 8px;"><span class="material-icons-round" style="font-size: 1rem; color: var(--brand-blue);">groups</span> TEAM OPERATIVO CLUSTER</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
                        ${team.length === 0 ? `<div style="grid-column: 1/-1; padding: 3rem; text-align: center; color: var(--text-tertiary);">Nessun membro del team identificato per questo cluster.</div>` : team.map(c => `
                            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; border: 1px solid var(--glass-border); background: white;">
                                ${renderAvatar(c, { size: 40, borderRadius: '50%' })}
                                <div><div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">${c.full_name}</div><div style="font-size: 0.65rem; color: var(--text-tertiary); font-weight: 600; text-transform: uppercase;">${c.role || 'Membro'}</div></div>
                            </div>
                        `).join('')}
                    </div>
                `;

            } else if (currentTab === 'docs') {
                const visibleProjectIds = visibleProjects.map(p => p.id);
                const contextIds = [currentClusterId, ...visibleProjectIds];
                const docItems = (allItems || []).filter(item => contextIds.includes(item.space_ref) && item.cloud_links && item.cloud_links.length > 0);
                const allLinks = [];
                docItems.forEach(item => { 
                    item.cloud_links.forEach(link => {
                        const spaceName = spaces.find(s => s.id === item.space_ref)?.name || 'Progetto';
                        allLinks.push({ ...link, itemTitle: item.title, spaceName }); 
                    });
                });

                content.innerHTML = `
                    <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 8px;"><span class="material-icons-round" style="font-size: 1rem; color: #f59e0b;">description</span> RISORSE E DOCUMENTI CLUSTER</div>
                    ${allLinks.length === 0 ? `<div style="padding: 3rem; text-align: center; color: var(--text-tertiary);">Nessun documento o link cloud caricato in questo cluster.</div>` : `
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${allLinks.map(link => `
                                <a href="${link.url}" target="_blank" style="display: flex; align-items: center; gap: 1rem; padding: 12px 16px; border-radius: 10px; border: 1px solid var(--glass-border); background: white; text-decoration: none; transition: 0.2s;" onmouseover="this.style.borderColor='var(--brand-blue)'" onmouseout="this.style.borderColor='var(--glass-border)'">
                                    <span class="material-icons-round" style="color: var(--brand-blue); font-size: 1.25rem;">link</span>
                                    <div style="flex: 1;"><div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">${link.title || 'Senza titolo'}</div><div style="font-size: 0.65rem; color: var(--text-tertiary);">Rif. Task: ${link.itemTitle} (${link.spaceName})</div></div>
                                    <span class="material-icons-round" style="color: var(--text-tertiary); font-size: 1rem;">open_in_new</span>
                                </a>
                            `).join('')}
                        </div>
                    `}
                `;
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

    } catch (err) {
        console.error("Hub Error:", err);
        container.innerHTML = `<div style="padding: 4rem; text-align: center; color: #ef4444;">Errore: ${err.message}</div>`;
    }
}
