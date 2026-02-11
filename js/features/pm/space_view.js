import { fetchSpace, fetchProjectItems, fetchChildProjects, fetchSpaceAssignees, assignUserToSpace, removeUserFromSpace, fetchAppointments, fetchAppointmentTypes, deleteSpace, updateSpaceCloudLinks } from '../../modules/pm_api.js?v=385';
import { openProjectModal } from './components/project_modal.js?v=377';
import { renderHubTree } from './components/hub_tree.js?v=377';
import { renderHubAppointments } from './components/hub_appointments.js?v=377';
import { CloudLinksManager } from '../components/CloudLinksManager.js?v=377';
import { state } from '../../modules/state.js';
import { supabase } from '../../modules/config.js';

console.log("[SpaceView] Module v376 loaded");

// KPI Calculation Helper
function calculateKPIs(items) {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const total = items.length;
    const done = items.filter(i => i.status === 'done').length;
    const overdue = items.filter(i => {
        if (!i.due_date || i.status === 'done') return false;
        return new Date(i.due_date) < now;
    }).length;
    const dueSoon = items.filter(i => {
        if (!i.due_date || i.status === 'done') return false;
        const due = new Date(i.due_date);
        return due >= now && due <= weekFromNow;
    }).length;
    const blocked = items.filter(i => i.status === 'blocked').length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    return { total, done, overdue, dueSoon, blocked, progress };
}

export async function renderSpaceView(container, spaceId) {
    // Preserve current view if reloading same space
    const previousView = container.querySelector ? container.querySelector('.tab-btn.active')?.dataset.view : null;

    container.innerHTML = '<div class="loading-state"><span class="loader"></span></div>';

    try {
        // 1. Robust Collaborator Fetch (Deterministic Fix)
        // Always ensure we have the latest list to resolve IDs
        const { data: latestCollabs } = await supabase.from('collaborators').select('*');
        if (latestCollabs) state.collaborators = latestCollabs; // Update global state too

        const space = await fetchSpace(spaceId);
        if (!space) {
            container.innerHTML = '<div class="error-state">Progetto non trovato o accesso negato.</div>';
            return;
        }

        const [items, spaceAssignees, appointments, appointmentTypes] = await Promise.all([
            fetchProjectItems(spaceId),
            fetchSpaceAssignees(spaceId),
            fetchAppointments(spaceId, 'space'),
            fetchAppointmentTypes()
        ]);

        let childProjects = [];
        if (space.is_cluster) {
            childProjects = await fetchChildProjects(spaceId);
        }

        // KPIs
        const kpis = calculateKPIs(items);

        // View Defaults
        const defaultView = space.is_cluster ? 'projects' : 'tree';
        const activeView = previousView || defaultView;

        // Set Hub Context for Drawer
        window._hubContext = { items, space, spaceId, spaceAssignees };

        // Helper to resolve Profile from Assignee
        const resolveProfile = (assignee) => {
            if (!latestCollabs) return { full_name: 'Caricamento...', avatar_url: null };

            // Try matching by user_id first
            if (assignee.user_ref) {
                const c = latestCollabs.find(x => x.user_id === assignee.user_ref);
                if (c) return c;
            }
            // Fallback to collaborator_id
            if (assignee.collaborator_ref) {
                const c = latestCollabs.find(x => x.id === assignee.collaborator_ref);
                if (c) return c;
            }
            // Fallback to embedded user object if API provided it
            return assignee.user || { full_name: 'Utente', avatar_url: null };
        };

        // Filter PMs for Header (role 'pm' or 'manager')
        let pms = spaceAssignees.filter(a => ['pm', 'manager', 'admin'].includes(a.role)).map(assignee => {
            const profile = resolveProfile(assignee);
            return {
                id: assignee.id, // assignment id
                name: profile.full_name || `${profile.first_name} ${profile.last_name}` || 'Utente',
                avatar: profile.avatar_url,
                initial: (profile.full_name || 'U').charAt(0).toUpperCase(),
                user_ref: assignee.user_ref,
                collab_ref: assignee.collaborator_ref,
                is_fallback: false
            };
        });

        // Filter standard members
        let members = spaceAssignees.filter(a => !['pm', 'manager', 'admin'].includes(a.role)).map(assignee => {
            const profile = resolveProfile(assignee);
            return {
                id: assignee.id,
                name: profile.full_name || 'Utente',
                avatar: profile.avatar_url,
                initial: (profile.full_name || 'U').charAt(0).toUpperCase()
            };
        });

        // Fallback: If no explicit PM, show default creator/manager (matches Dashboard logic)
        if (pms.length === 0 && space.default_pm_user_ref) {
            const fallbackProfile = (latestCollabs || []).find(x => x.user_id === space.default_pm_user_ref)
                || { full_name: 'Non assegnato' };

            if (fallbackProfile.full_name !== 'Non assegnato') {
                pms.push({
                    id: 'default',
                    name: fallbackProfile.full_name,
                    avatar: fallbackProfile.avatar_url,
                    initial: (fallbackProfile.full_name || 'U').charAt(0).toUpperCase(),
                    user_ref: space.default_pm_user_ref,
                    is_fallback: true
                });
            }
        }

        // --- RENDER ---
        container.innerHTML = `
            <div class="pm-space-layout" style="height: 100%; display: flex; flex-direction: column;">
                
                <!-- STICKY HEADER (Unified Style) -->
                <div class="hub-header" style="
                    background: white; border-bottom: 1px solid var(--surface-2); padding: 1.25rem 1.5rem;
                    position: sticky; top: 0; z-index: 50;
                ">
                    <!-- Top Row: Meta -->
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                        <span style="font-family: monospace; color: var(--text-secondary); font-weight: 600; font-size: 0.85rem; text-transform: uppercase;">
                            ${space.area || 'Generale'}
                        </span>
                        <span style="background: #f1f5f9; color: var(--text-secondary); padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase;">
                            ${space.is_cluster ? 'Cluster' : 'Progetto'}
                        </span>
                    </div>

                    <!-- Main Row: Title & Actions -->
                    <div style="display: flex; justify-content: space-between; align-items: start; gap: 1rem; margin-bottom: 1.5rem;">
                         <h1 style="font-size: 1.75rem; font-weight: 800; color: var(--text-primary); margin: 0; line-height: 1.2;">
                            ${space.name}
                        </h1>

                        <div style="display: flex; gap: 0.5rem;">
                            <!-- Cloud Resources Button -->
                            <div style="position: relative;">
                                <button id="cloud-resources-btn" style="
                                    display: flex; align-items: center; gap: 0.6rem; padding: 0 16px; height: 42px;
                                    background: white; border: 1px solid var(--surface-2); border-radius: 12px;
                                    color: var(--text-secondary); font-weight: 600; font-size: 0.85rem;
                                    cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                                " onmouseover="this.style.borderColor='var(--brand-blue)'; this.style.color='var(--text-primary)'" onmouseout="this.style.borderColor='var(--surface-2)'; this.style.color='var(--text-secondary)'">
                                    <span class="material-icons-round" style="font-size: 1.1rem; color: var(--brand-blue);">cloud</span>
                                    Risorse
                                    ${(space.cloud_links?.length || 0) > 0 ? `<span class="badge" style="background: var(--brand-blue); color: white; padding: 2px 6px; font-size: 0.7rem; border-radius: 10px; margin-left: 2px;">${space.cloud_links.length}</span>` : ''}
                                </button>
                                <div id="cloud-resources-popover" class="hidden glass-card" style="
                                    position: absolute; top: 110%; right: 0; width: 320px; z-index: 1000;
                                    background: white; border: 1px solid var(--surface-2); border-radius: 12px;
                                    box-shadow: 0 4px 20px rgba(0,0,0,0.15); padding: 1rem;
                                ">
                                    <h4 style="margin:0 0 1rem; font-size:0.75rem; font-weight:700; text-transform:uppercase; color:#94a3b8; letter-spacing:0.05em;">Cartelle Cloud</h4>
                                    <div id="cloud-links-container"></div>
                                </div>
                            </div>

                            <!-- New Button -->
                            <div style="position: relative;">
                                <button class="primary-btn" id="add-new-hub-btn" style="display: flex; align-items: center; gap: 0.5rem; padding: 8px 16px;">
                                    <span class="material-icons-round">add</span>
                                    Nuovo
                                    <span class="material-icons-round">expand_more</span>
                                </button>
                                <div id="add-hub-dropdown" class="hidden glass-card" style="
                                    position: absolute; top: 110%; right: 0; width: 210px; z-index: 1000;
                                    background: white; border: 1px solid var(--surface-2); border-radius: 12px;
                                    box-shadow: 0 4px 20px rgba(0,0,0,0.15); padding: 0.5rem;
                                ">
                                    ${space.is_cluster ? `
                                        <button class="dropdown-item" id="add-project-btn">
                                            <span class="material-icons-round" style="color: #6366f1;">folder_special</span>
                                            <div><div class="dt">Progetto</div><div class="ds">Nel cluster</div></div>
                                        </button>
                                    ` : ''}
                                    <button class="dropdown-item" id="add-activity-btn">
                                        <span class="material-icons-round" style="color: #f59e0b;">folder</span>
                                        <div><div class="dt">Attività</div><div class="ds">Raggruppa task</div></div>
                                    </button>
                                    <button class="dropdown-item" id="add-task-btn">
                                        <span class="material-icons-round" style="color: #3b82f6;">check_circle_outline</span>
                                        <div><div class="dt">Task</div><div class="ds">Singolo lavoro</div></div>
                                    </button>
                                </div>
                            </div>

                            <!-- Settings Button -->
                            <div style="position: relative;">
                                <button class="secondary-btn" id="space-settings-btn" style="width: 38px; height: 38px; padding:0; display:flex; align-items:center; justify-content:center;">
                                    <span class="material-icons-round">more_vert</span>
                                </button>
                                <div id="space-settings-dropdown" class="hidden glass-card" style="
                                    position: absolute; top: 110%; right: 0; width: 180px; z-index: 1000;
                                    background: white; border: 1px solid var(--surface-2); border-radius: 12px;
                                    box-shadow: 0 4px 20px rgba(0,0,0,0.15); padding: 0.5rem;
                                ">
                                    <button class="dropdown-item text-red" id="delete-space-btn" style="color: #ef4444;">
                                        <span class="material-icons-round">delete</span>
                                        Elimina ${space.is_cluster ? 'Cluster' : 'Progetto'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Bottom Row: PMs & KPIs -->
                    <div style="display: flex; gap: 2rem; align-items: center; flex-wrap: wrap;">
                        <!-- PM & Team List -->
                        <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
                            
                            <!-- Managers -->
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <span style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">MANAGER:</span>
                                <div id="space-pms-list" style="display: flex; align-items: center; gap: 6px;">
                                    ${pms.map(pm => `
                                        <div class="user-pill-mini pm" title="${pm.name}" style="background: rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.2);">
                                            <div class="avatar-circle" style="background: var(--brand-blue);">
                                                ${pm.avatar ? `<img src="${pm.avatar}">` : pm.initial}
                                            </div>
                                            <span class="name" style="color: var(--brand-blue);">${pm.name.split(' ')[0]}</span>
                                            ${!pm.is_fallback ? `<span class="material-icons-round remove-space-pm-btn" data-id="${pm.id}">close</span>` : ''}
                                        </div>
                                    `).join('')}
                                    <div style="position: relative;">
                                        <button id="add-space-pm-btn" class="add-pm-circle" title="Aggiungi Responsabile">
                                            <span class="material-icons-round">add</span>
                                        </button>
                                        <!-- Picker handled by generic picker popover -->
                                        <div id="space-pm-picker" class="hidden glass-card picker-popover" style="margin-top: 10px;"></div>
                                    </div>
                                </div>
                            </div>

                            <!-- Standard Members (Team) -->
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <span style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">TEAM:</span>
                                <div id="space-members-list" style="display: flex; align-items: center; gap: 6px;">
                                    ${members.map(m => `
                                        <div class="user-pill-mini" title="${m.name}">
                                            <div class="avatar-circle" style="background: #94a3b8;">
                                                ${m.avatar ? `<img src="${m.avatar}">` : m.initial}
                                            </div>
                                            <span class="name">${m.name.split(' ')[0]}</span>
                                        </div>
                                    `).join('')}
                                    ${members.length === 0 ? '<span style="font-size: 0.75rem; color: var(--text-tertiary); font-style: italic;">Nessuno</span>' : ''}
                                    <button id="add-space-member-btn" class="add-pm-circle" title="Gestisci Team" style="border-color: #cbd5e1; color: #64748b;">
                                        <span class="material-icons-round">group_add</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- KPIs -->
                        <div style="height: 24px; width: 1px; background: var(--surface-2);"></div>
                        
                        <div style="display: flex; gap: 1rem;">
                            <div class="kpi-pill red">
                                <span class="material-icons-round">warning</span> ${kpis.overdue} Scadute
                            </div>
                             <div class="kpi-pill orange">
                                <span class="material-icons-round">schedule</span> ${kpis.dueSoon} In scadenza
                            </div>
                            <div class="kpi-pill green">
                                <span class="material-icons-round">check_circle</span> ${kpis.progress}%
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tabs -->
                <div class="pm-tabs-bar">
                    ${space.is_cluster ? `
                        <button class="tab-btn ${activeView === 'projects' ? 'active' : ''}" data-view="projects">
                            <span class="material-icons-round">folder_special</span> Progetti
                        </button>
                    ` : ''}
                    <button class="tab-btn ${activeView === 'tree' ? 'active' : ''}" data-view="tree">
                        <span class="material-icons-round">account_tree</span> Struttura
                    </button>
                    <button class="tab-btn ${activeView === 'list' ? 'active' : ''}" data-view="list">
                        <span class="material-icons-round">view_list</span> Lista
                    </button>
                    <button class="tab-btn ${activeView === 'people' ? 'active' : ''}" data-view="people">
                        <span class="material-icons-round">group</span> Persone
                    </button>
                    <button class="tab-btn ${activeView === 'appointments' ? 'active' : ''}" data-view="appointments">
                        <span class="material-icons-round">event</span> Appuntamenti
                    </button>
                    <button class="tab-btn ${activeView === 'docs' ? 'active' : ''}" data-view="docs">
                        <span class="material-icons-round">description</span> Documenti
                    </button>
                </div>

                <!-- View Content -->
                <div id="pm-view-content" style="flex: 1; overflow-y: auto; position: relative; background: #f8fafc; padding: 1.5rem;">
                    <!-- Content injected here -->
                </div>
            </div>
            

            <style>
                /* Shared Styles */
                .dropdown-item {
                    display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.6rem 0.75rem;
                    text-align: left; border: none; background: none; cursor: pointer; border-radius: 8px;
                    transition: background 0.2s;
                }
                .dropdown-item:hover { background: #f1f5f9; }
                .dropdown-item .dt { font-weight: 600; font-size: 0.85rem; color: var(--text-primary); }
                .dropdown-item .ds { font-size: 0.7rem; color: #64748b; }
                .dropdown-item.text-red:hover { background: #fef2f2; }
                
                .user-pill-mini {
                    display: flex; align-items: center; gap: 6px; background: var(--surface-1);
                    padding: 2px 8px 2px 2px; border-radius: 16px; border: 1px solid var(--surface-2);
                    font-size: 0.8rem; color: var(--text-secondary); font-weight: 500;
                }
                .avatar-circle {
                    width: 20px; height: 20px; border-radius: 50%; background: var(--brand-blue); color: white;
                    display: flex; align-items: center; justify-content: center; font-size: 10px; overflow: hidden;
                }
                .avatar-circle img { width: 100%; height: 100%; object-fit: cover; }
                .add-pm-circle {
                    width: 24px; height: 24px; border-radius: 50%; color: var(--brand-blue);
                    background: white; border: 1px dashed var(--brand-blue); display: flex;
                    align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;
                }
                .add-pm-circle:hover { background: #eff6ff; }
                .picker-popover {
                    position: absolute; top: 130%; left: 0; width: 280px; z-index: 1000;
                    max-height: 320px; overflow-y: auto; background: white; border-radius: 12px;
                    border: 1px solid var(--surface-2); box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                }
                
                .kpi-pill { display: flex; align-items: center; gap: 0.5rem; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 0.8rem; }
                .kpi-pill.red { background: #fef2f2; color: #ef4444; }
                .kpi-pill.orange { color: #f59e0b; background: #fffbeb; }
                .kpi-pill.green { color: #10b981; background: #ecfdf5; }

                .pm-tabs-bar {
                    display: flex; gap: 0; background: white; border-bottom: 1px solid var(--surface-2); padding: 0 1.5rem;
                }
                .tab-btn {
                    display: flex; align-items: center; gap: 0.5rem; padding: 1rem 1.25rem;
                    border: none; background: none; cursor: pointer; font-weight: 500; color: var(--text-secondary);
                    border-bottom: 2px solid transparent; transition: all 0.2s;
                }
                .tab-btn:hover { color: var(--text-main); background: var(--surface-1); }
                .tab-btn.active { color: var(--brand-color); border-bottom-color: var(--brand-color); font-weight: 600; }
                
            </style>
        `;

        // --- EVENT HANDLERS ---
        const viewContent = container.querySelector('#pm-view-content');
        const tabs = container.querySelectorAll('.tab-btn');

        // Tabs Logic
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const view = tab.dataset.view;

                if (view === 'tree') {
                    renderHubTree(viewContent, items, space, spaceId);
                } else if (view === 'projects' && space.is_cluster) {
                    renderChildProjects(viewContent, childProjects);
                } else if (view === 'appointments') {
                    renderHubAppointments(viewContent, appointments, appointmentTypes, spaceId, 'space');
                } else if (view === 'people') {
                    renderTeamTab(viewContent, spaceAssignees, latestCollabs, spaceId);
                } else if (view === 'list') {
                    viewContent.innerHTML = '<div style="text-align:center; padding: 2rem; color: #94a3b8;">Vista lista in arrivo...</div>';
                } else if (view === 'docs') {
                    import('../docs/DocsView.js').then(mod => mod.renderDocsView(viewContent, spaceId));
                }
            });
        });

        // Dropdowns Toggle
        const toggleDropdown = (triggerId, dropdownId) => {
            const btn = container.querySelector(triggerId);
            const drop = container.querySelector(dropdownId);
            if (btn && drop) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    container.querySelectorAll('.glass-card.hidden').forEach(el => {
                        if (el !== drop && !el.classList.contains('picker-popover')) el.classList.add('hidden');
                    });
                    drop.classList.toggle('hidden');
                });
                document.addEventListener('click', (e) => {
                    if (!btn.contains(e.target) && !drop.contains(e.target)) drop.classList.add('hidden');
                });
            }
            return drop;
        };

        const addDropdown = toggleDropdown('#add-new-hub-btn', '#add-hub-dropdown');
        const settingsDropdown = toggleDropdown('#space-settings-btn', '#space-settings-dropdown');

        // Cloud Resources
        const cloudBtn = container.querySelector('#cloud-resources-btn');
        const cloudPopover = container.querySelector('#cloud-resources-popover');
        if (cloudBtn && cloudPopover) {
            cloudBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close others
                addDropdown?.classList.add('hidden');
                settingsDropdown?.classList.add('hidden');

                cloudPopover.classList.toggle('hidden');

                if (!cloudPopover.classList.contains('hidden')) {
                    new CloudLinksManager(
                        cloudPopover.querySelector('#cloud-links-container'),
                        space.cloud_links || [],
                        async (newLinks) => {
                            try {
                                await updateSpaceCloudLinks(spaceId, newLinks);
                                space.cloud_links = newLinks;
                                // Update badge
                                let badge = cloudBtn.querySelector('.badge');
                                if (newLinks.length > 0) {
                                    if (badge) {
                                        badge.textContent = newLinks.length;
                                    } else {
                                        cloudBtn.insertAdjacentHTML('beforeend', `<span class="badge" style="background: var(--brand-blue); color: white; padding: 2px 6px; font-size: 0.7rem; border-radius: 10px; margin-left: 2px;">${newLinks.length}</span>`);
                                    }
                                } else {
                                    if (badge) badge.remove();
                                }
                            } catch (err) {
                                window.showAlert("Errore salvataggio link: " + err.message, 'error');
                            }
                        }
                    );
                }
            });
            document.addEventListener('click', (e) => {
                if (!cloudBtn.contains(e.target) && !cloudPopover.contains(e.target)) cloudPopover.classList.add('hidden');
            });
        }

        // Delete Action (Use Custom Modal)
        container.querySelector('#delete-space-btn')?.addEventListener('click', async () => {
            if (await window.showConfirm(`Sei sicuro di voler eliminare questo ${space.is_cluster ? 'Cluster' : 'Progetto'}? Questa azione è irreversibile.`, { type: 'danger' })) {
                try {
                    await deleteSpace(spaceId);
                    window.location.hash = '#pm/interni';
                } catch (err) {
                    window.showAlert("Errore durante l'eliminazione: " + err.message, 'error');
                }
            }
        });

        // Add Actions
        addDropdown?.querySelector('#add-project-btn')?.addEventListener('click', () => {
            addDropdown.classList.add('hidden');
            openProjectModal({
                prefilledParentId: spaceId,
                forceType: 'project',
                prefilledArea: space.area,
                onSuccess: () => renderSpaceView(container, spaceId)
            });
        });

        addDropdown?.querySelector('#add-activity-btn')?.addEventListener('click', () => {
            addDropdown.classList.add('hidden');
            import('./components/hub_drawer.js?v=385').then(mod => mod.openHubDrawer(null, spaceId, null, 'attivita'));
        });

        addDropdown?.querySelector('#add-task-btn')?.addEventListener('click', () => {
            addDropdown.classList.add('hidden');
            import('./components/hub_drawer.js?v=385').then(mod => mod.openHubDrawer(null, spaceId, null, 'task'));
        });

        // PM Picker logic
        container.querySelector('#add-space-pm-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const picker = container.querySelector('#space-pm-picker');
            // ... (rest of PM picker logic)
            // Render options (excluding already assigned)
            const assignedUserIds = new Set(spaceAssignees.map(a => a.user_ref).filter(Boolean));
            const assignedCollabIds = new Set(spaceAssignees.map(a => a.collaborator_ref).filter(Boolean));

            // Sort by name
            const candidates = (latestCollabs || [])
                .filter(c => {
                    const isAssigned = (c.user_id && assignedUserIds.has(c.user_id)) || assignedCollabIds.has(c.id);
                    return !isAssigned && c.active !== false;
                })
                .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

            picker.innerHTML = candidates.length === 0 ? '<div style="padding:1rem;">Nessun candidato</div>' : candidates.map(c => `
                <div class="dropdown-item pm-candidate" data-uid="${c.user_id}" data-cid="${c.id}">
                    <div class="avatar-circle" style="width:24px;height:24px;">${c.avatar_url ? `<img src="${c.avatar_url}">` : (c.full_name || 'U').charAt(0)}</div>
                    <div class="dt" style="font-size:0.8rem;">${c.full_name}</div>
                    <div class="ds" style="margin-left:auto;">+</div>
                </div>
             `).join('');

            picker.querySelectorAll('.pm-candidate').forEach(el => {
                el.addEventListener('click', async () => {
                    // ...
                    const uid = el.dataset.uid !== 'undefined' ? el.dataset.uid : null;
                    const cid = el.dataset.cid;
                    try {
                        if (uid) await assignUserToSpace(spaceId, uid, 'pm');
                        else await assignUserToSpace(spaceId, cid, 'pm', true);
                        renderSpaceView(container, spaceId);
                    } catch (err) { window.showAlert(err.message, 'error'); }
                });
            });

            picker.classList.toggle('hidden');
        });

        // Add Member Button (Header) Logic
        container.querySelector('#add-space-member-btn')?.addEventListener('click', () => {
            container.querySelector('.tab-btn[data-view="people"]')?.click();
        });

        // Remove PM (Use Custom Modal)
        container.querySelectorAll('.remove-space-pm-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (await window.showConfirm("Rimuovere Responsabile?", { type: 'warning', confirmText: 'Rimuovi' })) {
                    try {
                        const assignmentId = btn.dataset.id;
                        await supabase.from('pm_space_assignees').delete().eq('id', assignmentId);
                        renderSpaceView(container, spaceId);
                    } catch (err) { window.showAlert(err.message, 'error'); }
                }
            });
        });


        // Initial Content Render
        if (activeView === 'people') {
            renderTeamTab(viewContent, spaceAssignees, latestCollabs, spaceId);
        } else if (activeView === 'projects' && space.is_cluster) {
            renderChildProjects(viewContent, childProjects);
        } else if (activeView === 'tree') {
            renderHubTree(viewContent, items, space, spaceId);
        } else if (activeView === 'appointments') {
            renderHubAppointments(viewContent, appointments, appointmentTypes, spaceId, 'space');
        } else if (activeView === 'docs') {
            import('../docs/DocsView.js').then(mod => mod.renderDocsView(viewContent, spaceId));
        } else {
            renderHubTree(viewContent, items, space, spaceId);
        }

    } catch (e) {
        console.error("Error rendering space:", e);
        container.innerHTML = `<div class="error-state">Errore caricamento: ${e.message}</div>`;
    }

    // Setup Auto-Refresh for Drawer Updates
    setupRefresher(container, spaceId);
}

function setupRefresher(container, spaceId) {
    if (container._pmRefreshHandler) {
        document.removeEventListener('pm-item-changed', container._pmRefreshHandler);
    }

    const handler = (e) => {
        if (e.detail && e.detail.spaceId === spaceId) {
            console.log("[SpaceView] Detected item change, refreshing view...");
            // Debounce or just reload?
            // Reloading the specific tab would be better, but full re-render is safer for consistency
            // We can check which tab is active and re-render that + HubTree logic?
            // renderSpaceView does a full fetch.
            renderSpaceView(container, spaceId);
        }
    };

    container._pmRefreshHandler = handler;
    document.addEventListener('pm-item-changed', handler);
}

function renderTeamTab(container, assignees, collaborators, spaceId) {
    // Helper to resolve profile
    const resolve = (assignee) => {
        if (assignee.user_ref) return collaborators.find(x => x.user_id === assignee.user_ref);
        if (assignee.collaborator_ref) return collaborators.find(x => x.id === assignee.collaborator_ref);
        return assignee.user;
    };

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">Membri del Team</h3>
            <div style="position: relative;">
                <button id="add-team-member-btn" class="primary-btn" style="display: flex; align-items: center; gap: 0.5rem; padding: 6px 12px; font-size: 0.85rem;">
                    <span class="material-icons-round" style="font-size: 1.1rem;">person_add</span>
                    Aggiungi Persona
                </button>
                <div id="team-member-picker-container" class="hidden glass-card picker-popover" style="top: 110%; right: 0; left: auto; width: 300px;">
                    <!-- Picker content will be injected -->
                </div>
            </div>

        <div style="background: white; border-radius: 12px; border: 1px solid var(--surface-2); overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <tr>
                        <th style="padding: 1rem; text-align: left; font-size: 0.75rem; color: #64748b; font-weight: 600; text-transform: uppercase;">Membro</th>
                        <th style="padding: 1rem; text-align: left; font-size: 0.75rem; color: #64748b; font-weight: 600; text-transform: uppercase;">Ruolo</th>
                        <th style="padding: 1rem; text-align: right;"></th>
                    </tr>
                </thead>
                <tbody>
                    ${(assignees || []).map(a => {
        const profile = resolve(a) || { full_name: 'Sconosciuto', avatar_url: null };
        return `
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 1rem;">
                                    <div style="display: flex; align-items: center; gap: 1rem;">
                                        <div class="avatar-circle" style="width:32px; height:32px; font-size: 0.85rem;">
                                            ${profile.avatar_url ? `<img src="${profile.avatar_url}">` : (profile.full_name || 'U').charAt(0)}
                                        </div>
                                        <div style="display: flex; flex-direction: column;">
                                            <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary);">${profile.full_name || 'Sconosciuto'}</div>
                                            <div style="font-size: 0.75rem; color: var(--text-tertiary);">${profile.email || ''}</div>
                                        </div>
                                    </div>
                                </td>
                                <td style="padding: 1rem;">
                                    <select class="member-role-select" data-id="${a.id}" style="
                                        padding: 4px 8px; border-radius: 6px; border: 1px solid var(--surface-2); 
                                        font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
                                        background: ${['pm', 'manager'].includes(a.role) ? '#eff6ff' : '#f1f5f9'};
                                        color: ${['pm', 'manager'].includes(a.role) ? 'var(--brand-blue)' : '#64748b'};
                                        outline: none; cursor: pointer;
                                    ">
                                        <option value="pm" ${a.role === 'pm' ? 'selected' : ''}>Project Manager</option>
                                        <option value="assignee" ${['pm', 'manager'].includes(a.role) ? '' : 'selected'}>Membro</option>
                                    </select>
                                </td>
                                <td style="padding: 1rem; text-align: right;">
                                    <button class="remove-member-btn" data-id="${a.id}" style="
                                        width: 32px; height: 32px; border-radius: 8px; border: none; background: transparent; 
                                        color: #94a3b8; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
                                        transition: all 0.2s;
                                    ">
                                        <span class="material-icons-round">delete_outline</span>
                                    </button>
                                </td>
                            </tr>
                        `;
    }).join('')}
                    ${(!assignees || assignees.length === 0) ? `
                        <tr>
                            <td colspan="3" style="padding: 3rem; text-align: center; color: var(--text-tertiary);">
                                Nessun membro assegnato a questo progetto.
                            </td>
                        </tr>
                    ` : ''}
                </tbody>
            </table>
        </div>
    `;

    // Attach listeners
    const addBtn = container.querySelector('#add-team-member-btn');
    const picker = container.querySelector('#team-member-picker-container');

    addBtn?.addEventListener('click', (e) => {
        e.stopPropagation();

        const assignedUserIds = new Set(assignees.map(a => a.user_ref).filter(Boolean));
        const assignedCollabIds = new Set(assignees.map(a => a.collaborator_ref).filter(Boolean));

        const candidates = (collaborators || [])
            .filter(c => {
                const isAssigned = (c.user_id && assignedUserIds.has(c.user_id)) || assignedCollabIds.has(c.id);
                return !isAssigned && c.active !== false;
            })
            .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

        picker.innerHTML = `
            <div style="padding: 0.75rem; border-bottom: 1px solid var(--surface-2); font-size: 0.75rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">
                Aggiungi al Team
            </div>
            <div style="max-height: 250px; overflow-y: auto; padding: 0.5rem;">
                ${candidates.map(c => `
                    <div class="dropdown-item candidate-item" data-uid="${c.user_id}" data-cid="${c.id}" style="padding: 8px; border-radius: 8px;">
                        <div class="avatar-circle" style="width:24px; height:24px;">
                            ${c.avatar_url ? `<img src="${c.avatar_url}">` : (c.full_name || 'U').charAt(0)}
                        </div>
                        <div style="flex: 1; font-size: 0.85rem; font-weight: 500;">${c.full_name}</div>
                        <span class="material-icons-round" style="font-size: 1.2rem; color: var(--brand-blue);">add_circle_outline</span>
                    </div>
                `).join('')}
                ${candidates.length === 0 ? '<div style="padding: 1rem; color: var(--text-tertiary); font-size: 0.85rem; text-align: center;">Nessun altro collaboratore</div>' : ''}
            </div>
        `;

        picker.querySelectorAll('.candidate-item').forEach(el => {
            el.onclick = async () => {
                const uid = el.dataset.uid !== 'undefined' ? el.dataset.uid : null;
                const cid = el.dataset.cid;
                try {
                    // Default to 'assignee' (Member) when adding from here
                    if (uid) await assignUserToSpace(spaceId, uid, 'assignee');
                    else await assignUserToSpace(spaceId, cid, 'assignee', true);

                    // Trigger a re-render of the whole space view to update everything
                    // Or just re-click the tab
                    document.querySelector('.tab-btn.active')?.click();
                } catch (err) { window.showAlert(err.message, 'error'); }
            };
        });

        picker.classList.toggle('hidden');
    });

    // Close picker when clicking outside
    document.addEventListener('click', (e) => {
        if (!picker.contains(e.target) && !addBtn.contains(e.target)) {
            picker.classList.add('hidden');
        }
    }, { once: true });

    container.querySelectorAll('.remove-member-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (await window.showConfirm("Rimuovere questo membro dal progetto?", { type: 'warning' })) {
                try {
                    await supabase.from('pm_space_assignees').delete().eq('id', btn.dataset.id);
                    document.querySelector('.tab-btn.active')?.click();
                } catch (err) { window.showAlert(err.message, 'error'); }
            }
        });
    });

    container.querySelectorAll('.member-role-select').forEach(sel => {
        sel.addEventListener('change', async () => {
            const id = sel.dataset.id;
            const newRole = sel.value;
            try {
                await supabase.from('pm_space_assignees').update({ role: newRole }).eq('id', id);
                document.querySelector('.tab-btn.active')?.click();
            } catch (err) { window.showAlert(err.message, 'error'); }
        });
    });
}

function renderChildProjects(container, projects) {
    if (!projects || projects.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem; background: #f8fafc; border-radius: 16px; border: 1px dashed #e2e8f0; margin-top: 1rem;">
                <span class="material-icons-round" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;">folder_open</span>
                <h3 style="color: #475569; margin-bottom: 0.5rem;">Nessun progetto in questo cluster</h3>
                <p style="color: #94a3b8; font-size: 0.9rem;">Crea un nuovo progetto e seleziona questo cluster come genitore.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; padding-top: 1rem;">
            ${projects.map(space => {
        const areaColor = '#64748b';
        const areaBg = '#f1f5f9';

        return `
                    <div class="project-card-premium" onclick="window.location.hash='#pm/space/${space.id}'" style="
                        background: white; border-radius: 16px; padding: 1.5rem; border: 1px solid #e2e8f0;
                        cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                        display: flex; flex-direction: column; position: relative;
                    ">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                             <div style="width: 44px; height: 44px; border-radius: 12px; background: ${areaBg}; color: ${areaColor}; display: flex; align-items: center; justify-content: center;">
                                <span class="material-icons-round">folder</span>
                            </div>
                            <span style="font-size: 0.7rem; font-weight: 700; color: #94a3b8; text-transform: uppercase;">PROGETTO</span>
                        </div>
                        
                        <h3 style="font-size: 1.15rem; font-weight: 700; color: #1e293b; margin: 0 0 1rem; line-height: 1.3;">${space.name}</h3>

                        <div style="margin-top: auto; padding-top: 1rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.75rem; color: #94a3b8;">${new Date(space.updated_at || space.created_at).toLocaleDateString()}</span>
                            <div style="display: flex; align-items: center; gap: 4px; color: var(--brand-blue); font-weight: 600; font-size: 0.85rem;">
                                Apri <span class="material-icons-round" style="font-size: 1rem;">arrow_forward</span>
                            </div>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
        
        <style>
             .project-card-premium:hover {
                transform: translateY(-4px);
                border-color: var(--brand-blue);
                box-shadow: 0 12px 24px -8px rgba(0,0,0,0.08);
            }
        </style>
    `;
}
