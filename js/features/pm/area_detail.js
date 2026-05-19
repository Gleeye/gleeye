import { fetchInternalSpaces, fetchAppointments, fetchAppointmentTypes } from '../../modules/pm_api.js?v=8000';
import { renderAreaOverview } from './components/area_overview.js?v=8000';
import { renderHubTree } from './components/hub_tree.js?v=8000';
import { renderHubAppointments } from './components/hub_appointments.js?v=8000';
import { supabase } from '../../modules/config.js?v=8000';
import { state } from '../../modules/state.js?v=8000';
import { renderAvatar } from '../../modules/utils.js?v=8000';

const COMPANY_AREAS = [
    { id: 'amministrazione', label: 'Amministrazione', color: 'var(--brand-viola)', bg: 'rgba(97, 74, 162, 0.08)', icon: 'account_balance' },
    { id: 'marketing', label: 'Marketing', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', icon: 'campaign' },
    { id: 'produzione', label: 'Produzione', color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', icon: 'factory' },
    { id: 'ricerca_sviluppo', label: 'Ricerca e Sviluppo', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)', icon: 'biotech' },
    { id: 'risorse_umane', label: 'Risorse Umane', color: '#f97316', bg: 'rgba(249, 115, 22, 0.08)', icon: 'groups' },
    { id: 'servizi', label: 'Servizi', color: '#64748b', bg: 'rgba(100, 116, 139, 0.08)', icon: 'cleaning_services' },
    { id: 'vendite', label: 'Vendite', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', icon: 'shopping_cart' }
];

export async function renderAreaDetail(container, areaSlug) {
    container.innerHTML = '<div style="height:100%; display:flex; align-items:center; justify-content:center;"><span class="loader"></span></div>';

    const area = COMPANY_AREAS.find(a => a.id === areaSlug);
    if (!area) {
        container.innerHTML = `<div style="padding:2rem; color:var(--text-tertiary);">Area non trovata: ${areaSlug}</div>`;
        return;
    }

    try {
        const spaces = await fetchInternalSpaces();
        const areaSpaces = (spaces || []).filter(s => (s.area || '').toLowerCase() === area.label.toLowerCase());
        const clusters = areaSpaces.filter(s => s.is_cluster);
        const projects = areaSpaces.filter(s => !s.is_cluster);
        const allSpaceIds = areaSpaces.map(s => s.id);

        // Fetch collaborators if missing
        if (!state.collaborators?.length) {
            const { data } = await supabase.from('collaborators').select('*');
            if (data) state.collaborators = data;
        }
        const collaborators = state.collaborators || [];

        // Area manager from system_config
        const { data: configData } = await supabase
            .from('system_config')
            .select('key, value')
            .eq('key', `area_manager_${area.id}`);
        const managerId = configData?.[0]?.value;
        const manager = managerId ? collaborators.find(c => c.id === managerId) : null;

        // KPIs
        let items = [];
        if (allSpaceIds.length > 0) {
            const { data } = await supabase
                .from('pm_items')
                .select('id, space_ref, title, status, due_date, item_type, pm_item_assignees(user_ref, collaborator_ref)')
                .in('space_ref', allSpaceIds)
                .is('archived_at', null);
            items = data || [];
        }

        const now = new Date();
        const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const totalItems = items.length;
        const openItems = items.filter(i => i.status !== 'done').length;
        const overdueItems = items.filter(i => i.due_date && i.status !== 'done' && new Date(i.due_date) < now).length;
        const dueSoonItems = items.filter(i => i.due_date && i.status !== 'done' && new Date(i.due_date) >= now && new Date(i.due_date) <= weekAhead).length;

        const teamMembers = new Set();
        items.forEach(item => {
            (item.pm_item_assignees || []).forEach(a => {
                if (a.user_ref) teamMembers.add(a.user_ref);
            });
        });

        // Stats per cluster (for cluster cards)
        const clusterStats = {};
        clusters.forEach(c => {
            const childProjectIds = projects.filter(p => p.parent_ref === c.id).map(p => p.id);
            const clusterItemIds = [c.id, ...childProjectIds];
            const clusterItems = items.filter(i => clusterItemIds.includes(i.space_ref));
            clusterStats[c.id] = {
                projects: childProjectIds.length,
                openItems: clusterItems.filter(i => i.status !== 'done').length,
                overdue: clusterItems.filter(i => i.due_date && i.status !== 'done' && new Date(i.due_date) < now).length,
            };
        });

        // Cloud links aggregated
        const allCloudLinks = areaSpaces.flatMap(s => s.cloud_links || []);
        const spaceNamesMap = {};
        areaSpaces.forEach(s => { spaceNamesMap[s.id] = s.name; });

        let currentTab = 'overview';

        const renderTab = async (tabContent) => {
            if (currentTab === 'overview') {
                if (allSpaceIds.length === 0) {
                    tabContent.innerHTML = '<div style="padding:3rem; text-align:center; color:var(--text-tertiary); font-size:0.85rem;">Nessun progetto in questa area.</div>';
                    return;
                }
                await renderAreaOverview(tabContent, allSpaceIds, spaceNamesMap, allCloudLinks);

            } else if (currentTab === 'cluster') {
                renderClusterTab(tabContent, clusters, projects, clusterStats, area);

            } else if (currentTab === 'struttura') {
                if (allSpaceIds.length === 0) {
                    tabContent.innerHTML = '<div style="padding:3rem; text-align:center; color:var(--text-tertiary);">Nessun progetto in questa area.</div>';
                    return;
                }
                renderHubTree(tabContent, items, { name: area.label, id: areaSlug, is_cluster: false }, areaSlug);

            } else if (currentTab === 'appuntamenti') {
                tabContent.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:200px;"><span class="loader"></span></div>';
                let appts = [];
                const types = await fetchAppointmentTypes();
                for (const sid of allSpaceIds) {
                    const data = await fetchAppointments(sid, 'space');
                    appts = appts.concat(data || []);
                }
                appts.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
                renderHubAppointments(tabContent, appts, types, allSpaceIds[0] || null, 'area');

            } else if (currentTab === 'feed') {
                import('./components/activity_log.js?v=8000').then(mod => {
                    mod.renderActivityLog(tabContent, { spaceIds: allSpaceIds, isAccountLevel: false });
                });

            } else if (currentTab === 'file') {
                await renderAreaFilesTab(tabContent, areaSpaces, area);
            }
        };

        container.innerHTML = `
            <style>
                .area-detail-layout { height: 100%; display: flex; flex-direction: column; background: #f8fafc; }

                .area-detail-header {
                    background: white; border-bottom: 1px solid var(--surface-2);
                    padding: 1.25rem 1.5rem; position: sticky; top: 0; z-index: 50; flex-shrink: 0;
                }
                .area-breadcrumb {
                    display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;
                    font-size: 0.75rem; color: var(--text-tertiary);
                }
                .area-breadcrumb a { color: var(--text-tertiary); text-decoration: none; transition: color 0.2s; }
                .area-breadcrumb a:hover { color: var(--brand-blue); }
                .area-breadcrumb .sep { font-size: 0.9rem; }

                .area-header-main { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.25rem; }
                .area-title-group { display: flex; align-items: center; gap: 1rem; }
                .area-icon-lg { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .area-icon-lg .material-icons-round { font-size: 1.5rem; }
                .area-name { font-size: 1.75rem; font-weight: 800; color: var(--text-primary); margin: 0; line-height: 1.2; font-family: var(--font-titles); letter-spacing: -0.02em; }
                .area-badge { background: #f1f5f9; color: var(--text-secondary); padding: 2px 10px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; align-self: center; }

                .area-meta-row { display: flex; align-items: center; gap: 2rem; flex-wrap: wrap; }
                .area-manager-block { display: flex; align-items: center; gap: 0.6rem; }
                .area-manager-label { font-size: 0.65rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.06em; }
                .area-manager-name { font-size: 0.8rem; font-weight: 700; color: var(--text-primary); }

                .kpi-pill { display: flex; align-items: center; gap: 0.4rem; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 0.78rem; }
                .kpi-pill .material-icons-round { font-size: 0.9rem; }
                .kpi-pill.neutral { background: #f1f5f9; color: var(--text-secondary); }
                .kpi-pill.red { background: #fef2f2; color: #ef4444; }
                .kpi-pill.orange { background: #fffbeb; color: #f59e0b; }
                .kpi-pill.green { background: #ecfdf5; color: #10b981; }
                .kpi-divider { width: 1px; height: 20px; background: var(--surface-2); }

                .area-tabs-bar { display: flex; background: white; border-bottom: 1px solid var(--surface-2); padding: 0 1.5rem; flex-shrink: 0; }
                .area-tab { display: flex; align-items: center; gap: 0.5rem; padding: 1rem 1.25rem; border: none; background: none; cursor: pointer; font-weight: 500; font-size: 0.83rem; color: var(--text-secondary); border-bottom: 2px solid transparent; transition: all 0.2s; white-space: nowrap; margin-bottom: -1px; }
                .area-tab:hover { color: var(--text-primary); background: var(--surface-1); }
                .area-tab.active { color: var(--brand-blue); border-bottom-color: var(--brand-blue); font-weight: 700; }
                .area-tab .material-icons-round { font-size: 1rem; }

                .area-tab-content { flex: 1; overflow-y: auto; padding: 1.5rem; }

                /* Cluster cards */
                .cluster-cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
                .cluster-card { background: white; border-radius: 16px; padding: 1.25rem 1.5rem; box-shadow: var(--shadow-sm); border: 1px solid transparent; text-decoration: none; display: block; transition: all 0.2s; }
                .cluster-card:hover { border-color: var(--brand-blue); box-shadow: var(--shadow-md); transform: translateY(-2px); }
                .cluster-card-head { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
                .cluster-card-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .cluster-card-name { font-size: 0.95rem; font-weight: 800; color: var(--text-primary); font-family: var(--font-titles); line-height: 1.2; }
                .cluster-card-stats { display: flex; gap: 1.25rem; padding-top: 0.75rem; border-top: 1px solid var(--surface-2); }
                .cs { text-align: center; }
                .cs .v { font-size: 1.1rem; font-weight: 800; color: var(--text-primary); font-family: var(--font-titles); line-height: 1; }
                .cs .l { font-size: 0.55rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 3px; }
            </style>

            <div class="area-detail-layout animate-fade-in">
                <div class="area-detail-header">
                    <div class="area-breadcrumb">
                        <a href="#pm/interni">Progetti Interni</a>
                        <span class="material-icons-round sep" style="font-size:0.9rem;">chevron_right</span>
                        <span>${area.label}</span>
                    </div>

                    <div class="area-header-main">
                        <div class="area-title-group">
                            <div class="area-icon-lg" style="background: ${area.bg}; color: ${area.color};">
                                <span class="material-icons-round">${area.icon}</span>
                            </div>
                            <div>
                                <h1 class="area-name">${area.label}</h1>
                            </div>
                            <span class="area-badge">Area</span>
                        </div>
                    </div>

                    <div class="area-meta-row">
                        <div class="area-manager-block">
                            ${manager
                                ? renderAvatar(manager, { size: 26, borderRadius: '50%' })
                                : `<div style="width:26px; height:26px; border-radius:50%; background:var(--surface-2); display:flex; align-items:center; justify-content:center; color:var(--text-tertiary);"><span class="material-icons-round" style="font-size:0.9rem;">person_outline</span></div>`
                            }
                            <div>
                                <div class="area-manager-label">Responsabile</div>
                                <div class="area-manager-name">${manager ? manager.full_name : 'Non assegnato'}</div>
                            </div>
                        </div>

                        <div class="kpi-divider"></div>

                        <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
                            <div class="kpi-pill neutral">
                                <span class="material-icons-round">workspaces</span> ${clusters.length} cluster
                            </div>
                            <div class="kpi-pill neutral">
                                <span class="material-icons-round">folder_special</span> ${projects.length} progetti
                            </div>
                            <div class="kpi-pill neutral">
                                <span class="material-icons-round">task_alt</span> ${totalItems} attività
                            </div>
                            ${overdueItems > 0 ? `<div class="kpi-pill red"><span class="material-icons-round">warning</span> ${overdueItems} scadute</div>` : ''}
                            ${dueSoonItems > 0 ? `<div class="kpi-pill orange"><span class="material-icons-round">schedule</span> ${dueSoonItems} in scadenza</div>` : ''}
                            ${overdueItems === 0 && openItems >= 0 ? `<div class="kpi-pill green"><span class="material-icons-round">check_circle</span> ${openItems} aperte</div>` : ''}
                        </div>
                    </div>
                </div>

                <div class="area-tabs-bar">
                    <button class="area-tab active" data-tab="overview">
                        <span class="material-icons-round">dashboard</span> Overview
                    </button>
                    <button class="area-tab" data-tab="cluster">
                        <span class="material-icons-round">workspaces</span> Cluster
                        ${clusters.length > 0 ? `<span style="background:var(--surface-2); color:var(--text-secondary); padding:1px 6px; border-radius:10px; font-size:0.65rem; font-weight:700;">${clusters.length}</span>` : ''}
                    </button>
                    <button class="area-tab" data-tab="struttura">
                        <span class="material-icons-round">account_tree</span> Struttura
                    </button>
                    <button class="area-tab" data-tab="appuntamenti">
                        <span class="material-icons-round">event</span> Appuntamenti
                    </button>
                    <button class="area-tab" data-tab="feed">
                        <span class="material-icons-round">history</span> Feed
                    </button>
                    <button class="area-tab" data-tab="file">
                        <span class="material-icons-round">folder_open</span> File
                    </button>
                </div>

                <div class="area-tab-content" id="area-tab-content">
                    <div style="display:flex; align-items:center; justify-content:center; height:300px;"><span class="loader"></span></div>
                </div>
            </div>
        `;

        const tabContent = container.querySelector('#area-tab-content');
        await renderTab(tabContent);

        container.querySelectorAll('.area-tab').forEach(tab => {
            tab.addEventListener('click', async () => {
                container.querySelectorAll('.area-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentTab = tab.dataset.tab;
                tabContent.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:200px;"><span class="loader"></span></div>';
                await renderTab(tabContent);
            });
        });

    } catch (err) {
        console.error('[AreaDetail] Error:', err);
        container.innerHTML = `<div style="padding:2rem; color:red;">Errore caricamento area: ${err.message}</div>`;
    }
}

async function renderAreaFilesTab(container, areaSpaces, area) {
    const { initFilesTab, initAreaFilesTab } = await import('./components/hub/files_tab.js?v=8002');

    const sorted = [...areaSpaces].sort((a, b) => (b.is_cluster ? 1 : 0) - (a.is_cluster ? 1 : 0));

    if (sorted.length === 0) {
        container.innerHTML = '<div style="padding:3rem; text-align:center; color:var(--text-tertiary);">Nessun progetto in questa area.</div>';
        return;
    }

    container.innerHTML = `
        <style>
            .af-section { background: white; border-radius: 16px; box-shadow: var(--shadow-sm); margin-bottom: 1rem; overflow: hidden; }
            .af-header { display: flex; align-items: center; gap: 0.75rem; padding: 0.9rem 1.25rem; cursor: pointer; border-bottom: 1px solid var(--surface-2); user-select: none; }
            .af-header:hover { background: var(--bg-secondary); }
            .af-body { padding: 1rem; }
            .af-body.collapsed { display: none; }
        </style>
        ${sorted.map((s, i) => `
            <div class="af-section">
                <div class="af-header" data-idx="${i}">
                    <div style="width:28px; height:28px; border-radius:8px; background:${area.bg}; color:${area.color}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
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
        <div class="af-section" style="border: 1px dashed #e2e8f0; background: #fafbfc; box-shadow: none;">
            <div class="af-header" data-area-section style="border-bottom: none;">
                <span class="material-icons-round" style="font-size:1.2rem; color:#94a3b8;">cloud_upload</span>
                <div style="flex:1; min-width:0;">
                    <div style="font-size:0.82rem; font-weight:600; color:var(--text-secondary);">File generali area</div>
                    <div style="font-size:0.6rem; color:var(--text-tertiary);">File non legati a un cluster specifico</div>
                </div>
                <span class="af-toggle" style="color:var(--text-tertiary); font-size:1.1rem;">▼</span>
            </div>
            <div class="af-body collapsed" data-area-id="${area.id}">
                <div id="tab-files-area-${area.id}"></div>
            </div>
        </div>
    `;

    const initSection = (spaceId) => {
        const body = container.querySelector('[data-space-id="' + spaceId + '"]');
        if (!body || body.dataset.initialized) return;
        body.dataset.initialized = 'true';
        const tabEl = body.querySelector('#tab-files-' + spaceId);
        if (!tabEl) return;
        const wrapper = { querySelector: (sel) => sel === '#tab-files' ? tabEl : body.querySelector(sel) };
        initFilesTab(wrapper, null, spaceId);
    };

    if (sorted[0]) initSection(sorted[0].id);

    // Toggle "File generali area" section (lazy-init on first open)
    const areaHeader = container.querySelector('[data-area-section]');
    if (areaHeader) {
        areaHeader.addEventListener('click', () => {
            const body = areaHeader.nextElementSibling;
            const toggle = areaHeader.querySelector('.af-toggle');
            const isCollapsed = body.classList.contains('collapsed');
            body.classList.toggle('collapsed', !isCollapsed);
            if (toggle) toggle.textContent = isCollapsed ? '▲' : '▼';
            if (isCollapsed) {
                const areaTabEl = body.querySelector('#tab-files-area-' + area.id);
                if (areaTabEl && !body.dataset.initialized) {
                    body.dataset.initialized = 'true';
                    const wrapper = { querySelector: (sel) => sel === '#tab-files' ? areaTabEl : body.querySelector(sel) };
                    initAreaFilesTab(wrapper, area.id);
                }
            }
        });
    }

    // Toggle cluster/project sections (lazy-init on expand)
    container.querySelectorAll('.af-header[data-idx]').forEach(header => {
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

function renderClusterTab(container, clusters, allProjects, clusterStats, area) {
    if (clusters.length === 0) {
        container.innerHTML = `
            <div style="padding:4rem; text-align:center; color:var(--text-tertiary);">
                <span class="material-icons-round" style="font-size:3rem; display:block; margin-bottom:1rem; opacity:0.3;">workspaces</span>
                <div style="font-size:0.9rem; font-weight:600;">Nessun cluster in quest'area</div>
                <div style="font-size:0.75rem; margin-top:0.5rem;">Crea un cluster da Progetti Interni per organizzare i tuoi progetti.</div>
            </div>`;
        return;
    }

    container.innerHTML = `<div class="cluster-cards-grid">
        ${clusters.map(c => {
            const stats = clusterStats[c.id] || { projects: 0, openItems: 0, overdue: 0 };
            const assignees = (c.pm_space_assignees || []).slice(0, 3);
            return `
                <a href="#pm/space/${c.id}" class="cluster-card">
                    <div class="cluster-card-head">
                        <div class="cluster-card-icon" style="background:${area.bg}; color:${area.color};">
                            <span class="material-icons-round" style="font-size:1.1rem;">workspaces</span>
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div class="cluster-card-name">${c.name}</div>
                            <div style="font-size:0.65rem; color:var(--text-tertiary); margin-top:2px; font-weight:600; text-transform:uppercase;">${area.label}</div>
                        </div>
                        <span class="material-icons-round" style="color:var(--text-tertiary); font-size:1.1rem;">chevron_right</span>
                    </div>
                    <div class="cluster-card-stats">
                        <div class="cs">
                            <div class="v">${stats.projects}</div>
                            <div class="l">Progetti</div>
                        </div>
                        <div class="cs">
                            <div class="v" style="${stats.openItems > 0 ? 'color:var(--brand-blue)' : ''}">${stats.openItems}</div>
                            <div class="l">Aperte</div>
                        </div>
                        <div class="cs">
                            <div class="v" style="${stats.overdue > 0 ? 'color:#ef4444' : ''}">${stats.overdue}</div>
                            <div class="l">Scadute</div>
                        </div>
                    </div>
                </a>`;
        }).join('')}
    </div>`;
}
