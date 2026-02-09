import { fetchInternalSpaces, createInternalSpace, createCluster, createProjectInCluster } from '../modules/api.js';
import { openProjectModal } from './components/project_modal.js?v=335';
import { supabase } from '../modules/config.js';
import { state } from '../modules/state.js';

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
        <div style="height: 100%; display: flex; align-items: center; justify-content: center; background: #f8fafc;">
            <div class="loader-container" style="text-align: center;">
                <span class="loader"></span>
                <p style="margin-top: 1rem; color: #64748b; font-weight: 500;">Caricamento Dashboard...</p>
            </div>
        </div>
    `;

    try {
        // 1. Fetch Basic Data (and assignees for PM role detection)
        // Include both user_ref AND collaborator_ref for PM lookup
        const { data: spaces, error } = await supabase
            .from('pm_spaces')
            .select(`
                *,
                pm_space_assignees (
                    user_ref,
                    collaborator_ref,
                    role
                )
            `)
            .eq('type', 'interno')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 1b. Ensure we have collaborators for PM resolution
        // We fetch fresh to be sure, as state might be stale or empty
        const { data: collaborators } = await supabase
            .from('collaborators')
            .select('*');

        // 2. Fetch Aggregated Stats (Child counts, Activities, Tasks)
        const spaceIds = spaces.map(s => s.id);

        let stats = {}; // spaceId -> { activeProjects, activities, tasks }
        // Initialize
        spaces.forEach(s => stats[s.id] = {
            activeProjects: 0,
            activities: { total: 0, open: 0, overdue: 0, team: new Set(), nextAction: null },
            tasks: { total: 0, completed: 0 }
        });

        if (spaceIds.length > 0) {
            // Count child projects for Clusters
            const { data: children } = await supabase
                .from('pm_spaces')
                .select('id, parent_ref')
                .in('parent_ref', spaceIds);

            (children || []).forEach(c => {
                if (stats[c.parent_ref]) stats[c.parent_ref].activeProjects++;
            });

            // Fetch Activities (pm_items) with Assignees
            const { data: items } = await supabase
                .from('pm_items')
                .select(`
                    id, space_ref, title, status, due_date,
                    pm_item_assignees ( user_ref )
                `)
                .in('space_ref', spaceIds)
                .is('archived_at', null);

            const activeItemIds = [];

            (items || []).forEach(item => {
                activeItemIds.push(item.id);
                const s = stats[item.space_ref];
                if (!s) return;

                s.activities.total++;

                // Add assignees to team set (unique user IDs)
                item.pm_item_assignees?.forEach(a => {
                    if (a.user_ref) s.activities.team.add(a.user_ref);
                });

                if (item.status !== 'done') {
                    s.activities.open++;

                    // Check Overdue
                    const isOverdue = item.due_date && new Date(item.due_date) < new Date();
                    if (isOverdue) s.activities.overdue++;

                    // Determine Next Action
                    if (!s.activities.nextAction || (item.due_date && new Date(item.due_date) < new Date(s.activities.nextAction.due_date))) {
                        s.activities.nextAction = {
                            title: item.title,
                            date: item.due_date ? new Date(item.due_date) : null,
                            isOverdue
                        };
                    } else if (!s.activities.nextAction.date && !item.due_date) {
                        s.activities.nextAction = { title: item.title, date: null, isOverdue: false };
                    }
                }
            });

            // Fetch Tasks (Checklists) - Try/Catch in case table doesn't exist yet
            try {
                if (activeItemIds.length > 0) {
                    const { data: checklists } = await supabase
                        .from('pm_item_checklists')
                        .select('id, pm_item_ref, is_completed')
                        .in('pm_item_ref', activeItemIds);

                    const itemSpaceMap = {};
                    items.forEach(i => itemSpaceMap[i.id] = i.space_ref);

                    (checklists || []).forEach(c => {
                        const spaceId = itemSpaceMap[c.pm_item_ref];
                        if (spaceId && stats[spaceId]) {
                            stats[spaceId].tasks.total++;
                            if (c.is_completed) stats[spaceId].tasks.completed++;
                        }
                    });
                }
            } catch (e) {
                console.warn("Checklist fetch failed:", e);
            }
        }

        let currentFilter = 'tutti';

        // Helper to get collaborator info - check BOTH user_id AND id (collaborator_ref)
        const getCollab = (uid, collabId) => {
            const list = collaborators || state.collaborators || [];
            if (uid) {
                const byUserId = list.find(c => c.user_id === uid);
                if (byUserId) return byUserId;
            }
            if (collabId) {
                const byCollabId = list.find(c => c.id === collabId);
                if (byCollabId) return byCollabId;
            }
            return null;
        };

        // Helper to resolve manager: default_pm_user_ref OR fallback to first 'manager'/'pm' role assignee
        const getManager = (space) => {
            // 1. Priority: Find assignee with role 'manager' or 'pm'
            // This overrides the default_pm_user_ref (which is often just the creator)
            const roleBased = space.pm_space_assignees?.find(a => ['manager', 'pm', 'admin'].includes(a.role));
            if (roleBased) {
                return getCollab(roleBased.user_ref, roleBased.collaborator_ref);
            }

            // 2. Fallback: default_pm_user_ref
            if (space.default_pm_user_ref) {
                const pm = getCollab(space.default_pm_user_ref, null);
                if (pm) return pm;
            }

            // 3. Last resort: Just take the first assignee
            const firstAssignee = space.pm_space_assignees?.[0];
            if (firstAssignee) {
                return getCollab(firstAssignee.user_ref, firstAssignee.collaborator_ref);
            }

            return null;
        };

        const renderContent = () => {
            const filteredSpaces = currentFilter === 'tutti'
                ? spaces
                : spaces.filter(s => (s.area || '').toLowerCase() === currentFilter.toLowerCase());

            const clusters = filteredSpaces.filter(s => s.is_cluster);
            const independentProjects = filteredSpaces.filter(s => !s.is_cluster && !s.parent_ref);

            // Sorting
            const sortedProjects = [...independentProjects].sort((a, b) => {
                const sA = stats[a.id]?.activities || { open: 0, overdue: 0 };
                const sB = stats[b.id]?.activities || { open: 0, overdue: 0 };
                if (sA.overdue !== sB.overdue) return sB.overdue - sA.overdue;
                return sB.open - sA.open;
            });


            // Aggregate Dashboard Stats
            const totalActiveProjects = independentProjects.length;
            const totalActivities = Object.values(stats).reduce((acc, s) => acc + s.activities.total, 0);
            const openActivities = Object.values(stats).reduce((acc, s) => acc + s.activities.open, 0);
            const overdueActivities = Object.values(stats).reduce((acc, s) => acc + s.activities.overdue, 0);

            container.innerHTML = `
                <div class="internal-projects-dashboard">
                    <!-- MAIN CONTENT (Left) -->
                    <main class="dashboard-main">
                        <header class="dashboard-header">
                            <div>
                                <h1>Dashboard Progetti</h1>
                                <p>Monitora lo stato di avanzamento e i carichi di lavoro.</p>
                            </div>

                            <div class="dropdown" id="new-element-dropdown">
                                <button class="primary-btn-premium">
                                    <span class="material-icons-round">add</span>
                                    Nuovo Progetto
                                </button>
                                <div class="dropdown-content">
                                    <a href="javascript:void(0)" data-type="project">
                                        <span class="material-icons-round">folder</span> Progetto Singolo
                                    </a>
                                    <a href="javascript:void(0)" data-type="cluster">
                                        <span class="material-icons-round">hub</span> Cluster Continuativo
                                    </a>
                                </div>
                            </div>
                        </header>

                        <!-- Filters -->
                        <div class="filter-bar">
                            <button class="filter-pill ${currentFilter === 'tutti' ? 'active' : ''}" data-filter="tutti">Tutti</button>
                            ${COMPANY_AREAS.map(area => `
                                <button class="filter-pill ${currentFilter === area.label.toLowerCase() ? 'active' : ''}" data-filter="${area.label}">
                                    ${area.label}
                                </button>
                            `).join('')}
                        </div>

                        <!-- Hero Stats -->
                        <div class="hero-stats-grid">
                            <div class="stat-card">
                                <div class="stat-icon-bg gray"><span class="material-icons-round">folder_open</span></div>
                                <div class="stat-info">
                                    <span class="stat-label">Progetti Attivi</span>
                                    <span class="stat-value">${totalActiveProjects}</span>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon-bg blue"><span class="material-icons-round">list_alt</span></div>
                                <div class="stat-info">
                                    <span class="stat-label">Attività Totali</span>
                                    <span class="stat-value">${totalActivities}</span>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon-bg green"><span class="material-icons-round">play_circle</span></div>
                                <div class="stat-info">
                                    <span class="stat-label">In Corso</span>
                                    <span class="stat-value">${openActivities}</span>
                                </div>
                            </div>
                            <div class="stat-card ${overdueActivities > 0 ? 'alert' : ''}">
                                <div class="stat-icon-bg red"><span class="material-icons-round">warning</span></div>
                                <div class="stat-info">
                                    <span class="stat-label">Scadute / Critiche</span>
                                    <span class="stat-value">${overdueActivities}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Projects Grid -->
                        <div class="projects-grid">
                            ${sortedProjects.map(p => {
                const areaCfg = COMPANY_AREAS.find(a => a.label.toLowerCase() === (p.area || '').toLowerCase()) || { label: p.area || 'Generale', color: '#64748b', bg: '#f1f5f9' };
                const s = stats[p.id] || { activities: { total: 0, open: 0, overdue: 0, nextAction: null, team: new Set() } };
                const act = s.activities;
                const progress = act.total > 0 ? Math.round(((act.total - act.open) / act.total) * 100) : 0;
                const pm = getManager(p);

                // Team
                const teamIds = Array.from(act.team || []);
                const teamAvatars = teamIds.slice(0, 3).map(uid => getCollab(uid, null)).filter(Boolean);
                const extraTeam = teamIds.length > 3 ? teamIds.length - 3 : 0;

                return `
                                    <div class="project-card ${act.overdue > 0 ? 'status-red' : (act.open > 5 ? 'status-yellow' : 'status-green')}" onclick="window.location.hash='#pm/space/${p.id}'">
                                        <div class="card-header">
                                            <div class="area-pill" style="background: ${areaCfg.bg}; color: ${areaCfg.color};">
                                                ${areaCfg.label}
                                            </div>
                                            ${act.overdue > 0 ? `
                                                <div class="overdue-badge">
                                                    <span class="material-icons-round">error</span> ${act.overdue}
                                                </div>
                                            ` : ''}
                                        </div>

                                        <h3 class="project-title">${p.name}</h3>
                                        
                                        <div class="next-action-box">
                                            <span class="label">PROSSIMA ATTIVITÀ</span>
                                            ${act.nextAction ? `
                                                <div class="action-row">
                                                    <span class="action-title text-truncate">${act.nextAction.title}</span>
                                                    ${act.nextAction.date ? `
                                                        <span class="action-date ${act.nextAction.isOverdue ? 'text-red' : ''}">
                                                            ${act.nextAction.date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                                                        </span>
                                                    ` : ''}
                                                </div>
                                            ` : `
                                                <div class="action-row empty">Nessuna attività pianificata</div>
                                            `}
                                        </div>

                                        <div class="progress-section">
                                            <div class="progress-info">
                                                <span>Avanzamento</span>
                                                <span>${progress}%</span>
                                            </div>
                                            <div class="progress-bar-bg">
                                                <div class="progress-bar-fill" style="width: ${progress}%; background: ${act.overdue > 0 ? '#ef4444' : 'var(--brand-blue)'}"></div>
                                            </div>
                                        </div>

                                        <div class="card-footer">
                                            <div class="team-stack">
                                                ${pm ? `<img src="${pm.avatar_url}" class="avatar pm" title="PM: ${pm.full_name}">` : ''}
                                                ${teamAvatars.map(c => `<img src="${c.avatar_url}" class="avatar" title="${c.full_name}">`).join('')}
                                                ${extraTeam > 0 ? `<div class="avatar-count">+${extraTeam}</div>` : ''}
                                            </div>
                                            <button class="open-btn">
                                                Apri <span class="material-icons-round">arrow_forward</span>
                                            </button>
                                        </div>
                                    </div>
                                `;
            }).join('')}
                        </div>
                    </main>

                    <!-- SIDEBAR: Clusters (Right) -->
                    <aside class="dashboard-sidebar">
                        <div class="sidebar-header">
                            <h2>Cluster & Framework</h2>
                            <button class="add-cluster-btn" title="Nuovo Cluster">
                                <span class="material-icons-round">add_box</span>
                            </button>
                        </div>

                        <div class="sidebar-scroll-wrapper">
                            ${clusters.length === 0 ? `
                                <div class="empty-state-sidebar">Nessun cluster</div>
                            ` : clusters.map(c => {
                const areaCfg = COMPANY_AREAS.find(a => a.label.toLowerCase() === (c.area || '').toLowerCase()) || { label: c.area || 'Generale', color: '#64748b', bg: '#f1f5f9' };
                const pm = getManager(c);
                const s = stats[c.id];

                return `
                                    <div class="cluster-card" onclick="window.location.hash='#pm/space/${c.id}'">
                                        <div class="cluster-top">
                                            <span class="cluster-badge" style="color: ${areaCfg.color};">${areaCfg.label}</span>
                                            <span class="cluster-title">${c.name}</span>
                                        </div>
                                        <div class="cluster-stats">
                                            <span><b>${s.activeProjects}</b> prog</span>
                                            <span><b>${s.activities.total}</b> att</span>
                                            <span><b>${s.tasks.total}</b> task</span>
                                        </div>
                                        <div class="cluster-pm">
                                            ${pm ? `<img src="${pm.avatar_url}" alt="">` : ''}
                                            <span>${pm ? pm.full_name : 'Non assegnato'}</span>
                                        </div>
                                    </div>
                                `;
            }).join('')}
                        </div>
                    </aside>

                    <style>
                        /* LAYOUT */
                        .internal-projects-dashboard {
                            display: grid; grid-template-columns: 1fr 260px; height: 100vh;
                            background: #f8fafc; overflow: hidden; font-family: 'Inter', system-ui, sans-serif;
                        }

                        /* SIDEBAR (Right) */
                        .dashboard-sidebar {
                            background: #f1f5f9; border-left: 1px solid #e2e8f0; 
                            display: flex; flex-direction: column; overflow: hidden;
                        }
                        .sidebar-header {
                            display: flex; justify-content: space-between; align-items: center; 
                            padding: 1rem 1rem 0.75rem; border-bottom: 1px solid #e2e8f0; background: white;
                        }
                        .sidebar-header h2 {
                            font-size: 0.65rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin: 0;
                        }
                        .add-cluster-btn {
                            background: none; border: none; color: var(--brand-blue); cursor: pointer; padding: 2px; transition: 0.2s; font-size: 1.2rem;
                        }
                        .add-cluster-btn:hover { color: #1d4ed8; transform: scale(1.1); }
                        
                        /* SCROLL CONTAINER */
                        .sidebar-scroll-wrapper {
                            flex: 1; overflow-y: auto; padding: 0.75rem;
                            scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent;
                        }
                        .sidebar-scroll-wrapper::-webkit-scrollbar { width: 4px; }
                        .sidebar-scroll-wrapper::-webkit-scrollbar-track { background: transparent; }
                        .sidebar-scroll-wrapper::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }

                        /* COMPACT CLUSTER CARD */
                        .cluster-card {
                            background: #1e293b; color: white;
                            padding: 0.65rem 0.75rem; border-radius: 10px; 
                            cursor: pointer; transition: 0.15s ease; margin-bottom: 0.5rem;
                            display: flex; flex-direction: column; gap: 0.35rem;
                        }
                        .cluster-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(30, 41, 59, 0.3); }

                        .cluster-top { display: flex; flex-direction: column; gap: 0.15rem; }
                        .cluster-badge { font-size: 0.55rem; font-weight: 600; text-transform: uppercase; opacity: 0.9; }
                        .cluster-title { font-size: 0.8rem; font-weight: 600; color: #f8fafc; line-height: 1.15; }
                        
                        .cluster-stats {
                            display: flex; gap: 0.75rem; font-size: 0.65rem; color: #94a3b8; padding: 0.35rem 0; border-top: 1px solid rgba(255,255,255,0.08);
                        }
                        .cluster-stats b { color: white; font-weight: 600; }

                        .cluster-pm { display: flex; align-items: center; gap: 0.3rem; font-size: 0.65rem; color: #cbd5e1; }
                        .cluster-pm img { width: 16px; height: 16px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); }

                        /* MAIN AREA */
                        .dashboard-main { padding: 2rem 3rem; overflow-y: auto; }
                        .dashboard-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; }
                        .dashboard-header h1 { font-size: 1.8rem; font-weight: 700; color: #1e293b; margin: 0; letter-spacing: -0.02em; }
                        .dashboard-header p { color: #64748b; font-size: 0.95rem; margin-top: 0.25rem; font-weight: 500; }

                        .primary-btn-premium {
                            display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.25rem; 
                            background: var(--brand-blue); color: white; border: none;
                            border-radius: 12px; font-weight: 600; cursor: pointer;
                            box-shadow: 0 4px 12px rgba(30, 41, 59, 0.15); transition: 0.2s; font-size: 0.9rem;
                        }
                        .primary-btn-premium:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(30, 41, 59, 0.25); }

                        /* STATS HERO */
                        .hero-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; margin-bottom: 2.5rem; }
                        .stat-card {
                            background: white; padding: 1.25rem; border-radius: 16px; border: 1px solid #e2e8f0; 
                            display: flex; align-items: center; gap: 1rem; transition: 0.2s;
                        }
                        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.06); }
                        .stat-card.alert { background: #fef2f2; border-color: #fee2e2; }

                        .stat-icon-bg { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; }
                        .stat-icon-bg.gray { background: #f1f5f9; color: #64748b; }
                        .stat-icon-bg.blue { background: #eff6ff; color: #3b82f6; }
                        .stat-icon-bg.green { background: #ecfdf5; color: #10b981; }
                        .stat-icon-bg.red { background: #fee2e2; color: #ef4444; }

                        .stat-info { display: flex; flex-direction: column; }
                        .stat-label { font-size: 0.7rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
                        .stat-value { font-size: 1.5rem; font-weight: 700; color: #1e293b; line-height: 1.1; }
                        .stat-card.alert .stat-value { color: #ef4444; }

                        /* PROJECT CARD */
                        .projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }
                        
                        .project-card {
                            background: white; border-radius: 16px; padding: 1.5rem; border: 1px solid #e2e8f0;
                            cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                            display: flex; flex-direction: column; gap: 1rem; position: relative; overflow: hidden;
                        }
                        .project-card:hover { transform: translateY(-4px); box-shadow: 0 12px 30px -10px rgba(0,0,0,0.12); border-color: var(--brand-blue); }
                        
                        /* Status lines */
                        .project-card::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; transition: 0.3s; }
                        .project-card.status-green::before { background: #10b981; opacity: 0; }
                        .project-card.status-yellow::before { background: #f59e0b; opacity: 1; }
                        .project-card.status-red::before { background: #ef4444; opacity: 1; }

                        .card-header { display: flex; justify-content: space-between; align-items: flex-start; }
                        .area-pill { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; padding: 4px 10px; border-radius: 6px; }
                        .overdue-badge { 
                            background: #ef4444; color: white; padding: 4px 8px; border-radius: 100px; 
                            font-size: 0.7rem; font-weight: 700; display: flex; align-items: center; gap: 4px;
                            animation: pulse 2s infinite;
                        }

                        .project-title { font-size: 1.15rem; font-weight: 700; color: #1e293b; margin: 0; line-height: 1.3; }

                        .next-action-box { 
                            background: #f8fafc; border-radius: 10px; padding: 0.75rem; border: 1px solid #f1f5f9;
                        }
                        .next-action-box .label { font-size: 0.65rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 0.25rem; }
                        .action-row { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 500; color: #334155; }
                        .action-row.empty { color: #94a3b8; font-weight: 400; font-style: italic; }
                        .action-date { white-space: nowrap; font-size: 0.7rem; background: white; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0; }
                        .action-date.text-red { color: #ef4444; border-color: #fca5a5; background: #fef2f2; }

                        .progress-section { margin-top: 0.25rem; }
                        .progress-info { display: flex; justify-content: space-between; font-size: 0.7rem; font-weight: 600; color: #64748b; margin-bottom: 0.3rem; }
                        .progress-bar-bg { height: 6px; background: #f1f5f9; border-radius: 10px; overflow: hidden; }
                        .progress-bar-fill { height: 100%; border-radius: 10px; transition: width 0.6s ease; }

                        .card-footer { 
                            margin-top: auto; padding-top: 1rem; border-top: 1px solid #f1f5f9; 
                            display: flex; justify-content: space-between; align-items: center; 
                        }
                        .team-stack { display: flex; align-items: center; }
                        .team-stack .avatar { width: 26px; height: 26px; border-radius: 50%; border: 2px solid white; margin-left: -8px; object-fit: cover; background: #e2e8f0; }
                        .team-stack .avatar:first-child { margin-left: 0; }
                        .team-stack .avatar.pm { width: 30px; height: 30px; z-index: 10; border-color: #f1f5f9; }
                        .avatar-count { 
                            width: 24px; height: 24px; border-radius: 50%; background: #f1f5f9; border: 2px solid white; 
                            margin-left: -8px; display: flex; align-items: center; justify-content: center;
                            font-size: 0.65rem; font-weight: 600; color: #64748b;
                        }

                        .open-btn { 
                            background: none; border: none; color: var(--brand-blue); font-weight: 600; font-size: 0.8rem; 
                            display: flex; align-items: center; gap: 2px; padding: 4px 8px; border-radius: 6px; cursor: pointer; transition: 0.2s;
                        }
                        .open-btn:hover { background: #eff6ff; gap: 4px; }

                        /* FILTERS */
                        .filter-bar { display: flex; gap: 0.75rem; margin-bottom: 2rem; overflow-x: auto; padding-bottom: 4px; }
                        .filter-pill {
                            padding: 0.5rem 1rem; border: 1px solid #e2e8f0; background: white; color: #64748b;
                            border-radius: 100px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: 0.2s; white-space: nowrap;
                        }
                        .filter-pill.active { background: #1e293b; color: white; border-color: #1e293b; box-shadow: 0 4px 12px rgba(30, 41, 59, 0.2); }
                        .filter-pill:hover:not(.active) { background: #f8fafc; color: #1e293b; border-color: #cbd5e1; }

                        /* UTILS */
                        .text-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
                        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.7; } 100% { opacity: 1; } }
                        .empty-state-sidebar { padding: 2rem 1rem; text-align: center; color: #94a3b8; font-size: 0.8rem; }

                        /* DROPDOWN */
                        .dropdown { position: relative; }
                        .dropdown-content {
                            position: absolute; right: 0; top: 120%; background: white; border-radius: 14px; 
                            box-shadow: 0 15px 35px rgba(0,0,0,0.15); border: 1px solid #e2e8f0; min-width: 220px; 
                            z-index: 100; opacity: 0; pointer-events: none; transform: translateY(10px); transition: 0.2s; padding: 0.5rem;
                        }
                        .dropdown.active .dropdown-content { opacity: 1; pointer-events: auto; transform: translateY(0); }
                        .dropdown-content a { 
                            display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1rem; 
                            color: #1e293b; text-decoration: none; font-weight: 600; border-radius: 8px; transition: 0.2s;
                        }
                        .dropdown-content a:hover { background: #f1f5f9; color: var(--brand-blue); }
                        .dropdown-content a .material-icons-round { color: #94a3b8; font-size: 1.2rem; }
                    </style>
                </div>
            `;

            // EVENT LISTENERS
            container.querySelectorAll('.filter-pill').forEach(btn => {
                btn.onclick = () => {
                    currentFilter = btn.dataset.filter.toLowerCase();
                    renderContent();
                };
            });

            const dropdown = container.querySelector('#new-element-dropdown');
            const dropdownBtn = dropdown.querySelector('button');
            const dropdownItems = dropdown.querySelectorAll('.dropdown-content a');

            dropdownBtn.onclick = (e) => { e.stopPropagation(); dropdown.classList.toggle('active'); };
            window.onclick = () => dropdown.classList.remove('active');

            dropdownItems.forEach(item => {
                item.onclick = (e) => {
                    e.preventDefault();
                    const type = item.dataset.type;
                    dropdown.classList.remove('active');
                    openProjectModal({
                        forceType: type,
                        onSuccess: (res) => window.location.hash = `#pm/space/${res.id}`
                    });
                };
            });

            const addClusterBtn = container.querySelector('.add-cluster-btn');
            if (addClusterBtn) {
                addClusterBtn.onclick = () => {
                    openProjectModal({
                        forceType: 'cluster',
                        onSuccess: (res) => window.location.hash = `#pm/space/${res.id}`
                    });
                };
            }
        };

        renderContent();

    } catch (err) {
        console.error("Dashboard Error:", err);
        container.innerHTML = `<div style="padding: 3rem; text-align: center; color: #ef4444;">
            <span class="material-icons-round" style="font-size: 3rem;">error_outline</span>
            <p style="margin-top: 1rem; font-weight: 600;">Impossibile caricare la dashboard</p>
            <p style="font-size: 0.85rem; opacity: 0.8;">${err.message}</p>
        </div>`;
    }
}
