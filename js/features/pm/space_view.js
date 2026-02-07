import { fetchSpace, fetchProjectItems, fetchChildProjects, fetchSpaceAssignees, assignUserToSpace, removeUserFromSpace, fetchAppointments, fetchAppointmentTypes } from '../../modules/pm_api.js?v=317';
import { openProjectModal } from './components/project_modal.js?v=317';
import { renderHubTree } from './components/hub_tree.js?v=317';
import { renderHubAppointments } from './components/hub_appointments.js?v=317';
import { state } from '../../modules/state.js?v=317';

export async function renderSpaceView(container, spaceId) {
    // Preserve current view if reloading same space
    const previousView = container.querySelector ? container.querySelector('.tab-btn.active')?.dataset.view : null;

    container.innerHTML = '<div class="loading-state"><span class="loader"></span></div>';

    try {
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

        // Header Info
        const title = space.type === 'commessa' && space.orders
            ? `${space.orders.order_number} - ${space.orders.title}`
            : (space.name || 'Progetto Interno');

        const subtitle = space.type === 'commessa' && space.orders?.clients
            ? space.orders.clients.business_name
            : 'Progetto';

        const defaultView = space.is_cluster ? 'projects' : 'tree';
        const activeView = previousView || defaultView;

        // Set Hub Context for Drawer
        window._hubContext = { items, space, spaceId, spaceAssignees };

        container.innerHTML = `
            <div class="pm-space-layout" style="height: 100%; display: flex; flex-direction: column;">
                <!-- Header -->
                <div class="pm-header glass-panel" style="margin: 0 0 1rem 0; padding: 1.5rem; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div class="text-xs text-secondary uppercase tracking-wider">${subtitle}</div>
                        <h1 style="margin:0; font-size:1.5rem;">${title}</h1>
                        
                        <!-- PM List (New) -->
                        <div style="display: flex; align-items: center; gap: 0.75rem; margin-top: 0.5rem;">
                            <span style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: 500; text-transform: uppercase;">RESPONSABILI:</span>
                            <div id="space-pms-list" style="display: flex; align-items: center; gap: 6px;">
                                ${spaceAssignees.filter(a => a.role === 'pm').map(a => {
            let userName = a.user?.full_name || a.user?.first_name || 'Utente';
            let avatarUrl = a.user?.avatar_url;
            return `
                                    <div class="user-pill-mini pm" data-uid="${a.user_ref}" data-collab-id="${a.collaborator_ref}" title="${userName}" style="
                                        display: flex; align-items: center; gap: 6px; background: var(--surface-1); 
                                        padding: 2px 8px 2px 2px; border-radius: 16px; border: 1px solid transparent;
                                        font-size: 0.8rem; color: var(--text-secondary); font-weight: 500;
                                    ">
                                        <div style="width: 20px; height: 20px; border-radius: 50%; background: var(--brand-blue); color: white; display: flex; align-items: center; justify-content: center; font-size: 10px;">
                                            ${avatarUrl ? `<img src="${avatarUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : userName.charAt(0).toUpperCase()}
                                        </div>
                                        ${userName.split(' ')[0]}
                                        <span class="material-icons-round remove-space-pm-btn" data-id="${a.id}" style="font-size: 0.9rem; cursor: pointer; opacity: 0.5;">close</span>
                                    </div>
                                `;
        }).join('')}
                                
                                <!-- Add PM Button -->
                                <div style="position: relative;">
                                    <button id="add-space-pm-btn" style="
                                        width: 24px; height: 24px; border-radius: 50%; color: var(--brand-blue); 
                                        background: white; border: 1px dashed var(--brand-blue); display: flex; 
                                        align-items: center; justify-content: center; cursor: pointer;
                                    ">
                                        <span class="material-icons-round" style="font-size: 1rem;">add</span>
                                    </button>
                                    <div id="space-pm-picker" class="hidden glass-card" style="position: absolute; top: 130%; left: 0; width: 280px; z-index: 1000; max-height: 320px; overflow-y: auto; background: white; border-radius: 12px; border: 1px solid var(--surface-2); box-shadow: 0 10px 40px rgba(0,0,0,0.2);"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="actions" style="display:flex; gap:0.5rem;">
                        <!-- Unified Add Dropdown -->
                        <div style="position: relative;">
                            <button class="primary-btn" id="add-new-hub-btn" style="display: flex; align-items: center; gap: 0.5rem;">
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
                                    <button class="dropdown-item" id="add-project-btn" style="display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.75rem; text-align: left; border: none; background: none; cursor: pointer; border-radius: 8px;">
                                        <span class="material-icons-round" style="color: #6366f1;">folder_special</span>
                                        <div><div style="font-weight: 600; font-size: 0.85rem;">Progetto</div><div style="font-size: 0.7rem; color: #64748b;">Nuovo progetto nel cluster</div></div>
                                    </button>
                                ` : ''}
                                
                                <button class="dropdown-item" id="add-activity-btn" style="display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.75rem; text-align: left; border: none; background: none; cursor: pointer; border-radius: 8px;">
                                    <span class="material-icons-round" style="color: #f59e0b;">folder</span>
                                    <div><div style="font-weight: 600; font-size: 0.85rem;">Attività</div><div style="font-size: 0.7rem; color: #64748b;">Raggruppa task</div></div>
                                </button>
                                
                                <button class="dropdown-item" id="add-task-btn" style="display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.75rem; text-align: left; border: none; background: none; cursor: pointer; border-radius: 8px;">
                                    <span class="material-icons-round" style="color: #3b82f6;">check_circle_outline</span>
                                    <div><div style="font-weight: 600; font-size: 0.85rem;">Task</div><div style="font-size: 0.7rem; color: #64748b;">Singolo lavoro</div></div>
                                </button>

                                <div style="height: 1px; background: #f1f5f9; margin: 4px 0;"></div>

                                <button class="dropdown-item" id="add-appointment-btn" style="display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.75rem; text-align: left; border: none; background: none; cursor: pointer; border-radius: 8px;">
                                    <span class="material-icons-round" style="color: #8b5cf6;">event</span>
                                    <div><div style="font-weight: 600; font-size: 0.85rem;">Appuntamento</div><div style="font-size: 0.7rem; color: #64748b;">Singolo incontro</div></div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tabs -->
                <div class="pm-tabs" style="margin-bottom: 1rem; display:flex; gap: 1rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem;">
                    ${space.is_cluster ? `
                        <button class="tab-btn ${activeView === 'projects' ? 'active' : ''}" data-view="projects">
                            <span class="material-icons-round">folder_special</span> Progetti
                        </button>
                    ` : ''}
                    <button class="tab-btn ${activeView === 'tree' ? 'active' : ''}" data-view="tree">
                        <span class="material-icons-round">account_tree</span> Albero
                    </button>
                    <button class="tab-btn ${activeView === 'list' ? 'active' : ''}" data-view="list">
                        <span class="material-icons-round">view_list</span> Lista
                    </button>
                    <button class="tab-btn ${activeView === 'appointments' ? 'active' : ''}" data-view="appointments">
                        <span class="material-icons-round">event</span> Appuntamenti
                    </button>
                    ${!space.is_cluster ? `
                        <button class="tab-btn ${activeView === 'people' ? 'active' : ''}" data-view="people">
                            <span class="material-icons-round">group</span> Persone
                        </button>
                    ` : ''}
                </div>

                <!-- View Content -->
                <div id="pm-view-content" style="flex: 1; overflow-y: auto; position: relative;">
                    <!-- Content will be injected here -->
                </div>
            </div>
            
            <!-- Drawer Container (Hub Style) -->
            <div id="hub-drawer-overlay" class="drawer-overlay hidden" style="
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.3);
                z-index: 200;
                display: flex;
                justify-content: flex-end;
            ">
                <div id="hub-drawer" style="
                    width: 500px;
                    max-width: 100%;
                    background: white;
                    height: 100%;
                    box-shadow: -4px 0 20px rgba(0,0,0,0.1);
                    display: flex;
                    flex-direction: column;
                ">
                    <!-- Drawer content injected dynamically -->
                </div>
            </div>
        `;

        // Tab Logic
        const tabs = container.querySelectorAll('.tab-btn');
        const viewContent = container.querySelector('#pm-view-content');

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
                } else {
                    viewContent.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-secondary);">Vista ${view} in arrivo...</div>`;
                }
            });
        });

        // Dropdown Header Logic
        const addBtn = container.querySelector('#add-new-hub-btn');
        const addDropdown = container.querySelector('#add-hub-dropdown');

        if (addBtn && addDropdown) {
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                addDropdown.classList.toggle('hidden');
            });

            document.addEventListener('click', (e) => {
                if (!addBtn.contains(e.target) && !addDropdown.contains(e.target)) {
                    addDropdown.classList.add('hidden');
                }
            });

            // Handlers inside dropdown
            addDropdown.querySelector('#add-project-btn')?.addEventListener('click', () => {
                addDropdown.classList.add('hidden');
                openProjectModal({
                    prefilledParentId: spaceId,
                    forceType: 'project',
                    onSuccess: () => renderSpaceView(container, spaceId)
                });
            });

            addDropdown.querySelector('#add-activity-btn')?.addEventListener('click', () => {
                addDropdown.classList.add('hidden');
                import('./components/hub_drawer.js?v=317').then(mod => mod.openHubDrawer(null, spaceId, null, 'attivita'));
            });

            addDropdown.querySelector('#add-task-btn')?.addEventListener('click', () => {
                addDropdown.classList.add('hidden');
                import('./components/hub_drawer.js?v=317').then(mod => mod.openHubDrawer(null, spaceId, null, 'task'));
            });

            addDropdown.querySelector('#add-appointment-btn')?.addEventListener('click', () => {
                addDropdown.classList.add('hidden');
                import('./components/hub_appointment_drawer.js?v=317').then(mod => mod.openAppointmentDrawer(null, spaceId, 'space'));
            });
        }

        // ---------------------------------------------------------
        // PM Management Logic (Delegated)
        // ---------------------------------------------------------

        const renderPmOptions = () => {
            const assignedUserIds = new Set(spaceAssignees.map(a => a.user_ref).filter(Boolean));
            const assignedCollabIds = new Set(spaceAssignees.map(a => a.collaborator_ref).filter(Boolean));
            const others = (state.collaborators || []).filter(c => {
                if (c.is_active === false || c.active === false) return false;
                let tags = c.tags || [];
                if (typeof tags === 'string') {
                    try { tags = JSON.parse(tags); } catch (e) { tags = tags.split(',').map(t => t.trim()); }
                }
                const isPM = Array.isArray(tags) && tags.some(t => t.toLowerCase().includes('pm') || t.toLowerCase().includes('manager') || t.toLowerCase().includes('account'));
                const isAssigned = (c.user_id && assignedUserIds.has(c.user_id)) || assignedCollabIds.has(c.id);
                return (isPM || true) && !isAssigned;
            });

            if (others.length === 0) return '<div style="padding:1.5rem; text-align:center; font-size:0.85rem; color:var(--text-tertiary);">Nessun altro responsabile disponibile</div>';

            return `
                <div style="padding: 10px 12px 6px; font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--surface-2); margin-bottom: 4px;">Aggiungi Responsabile</div>
                ${others.map(c => {
                return `
                        <div class="user-option-space" data-uid="${c.user_id || ''}" data-collab-id="${c.id}" style="
                            display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer; transition: background 0.2s;
                        " onmouseover="this.style.background='var(--surface-1)'" onmouseout="this.style.background='transparent'">
                            <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--brand-blue); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; border: 1px solid rgba(0,0,0,0.05); overflow: hidden;">
                                ${c.avatar_url ? `<img src="${c.avatar_url}" style="width:100%; height:100%; object-fit:cover;">` : (c.full_name?.charAt(0) || 'U')}
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${c.full_name}</div>
                                <div style="font-size: 0.7rem; color: var(--text-tertiary);">Responsabile</div>
                            </div>
                        </div>
                    `;
            }).join('')}
            `;
        };

        const handleSpaceViewEvents = async (e) => {
            // Add PM
            const addBtn = e.target.closest('#add-space-pm-btn');
            if (addBtn) {
                e.stopPropagation();
                const picker = addBtn.parentElement.querySelector('#space-pm-picker');
                if (picker) {
                    if (picker.classList.contains('hidden')) {
                        document.querySelectorAll('#space-pm-picker:not(.hidden)').forEach(p => p.classList.add('hidden'));
                        picker.innerHTML = renderPmOptions();
                        picker.classList.remove('hidden');
                    } else {
                        picker.classList.add('hidden');
                    }
                }
                return;
            }

            // Select PM
            const opt = e.target.closest('.user-option-space');
            if (opt) {
                e.stopPropagation();
                const uid = opt.dataset.uid;
                const collabId = opt.dataset.collabId;
                const picker = opt.closest('#space-pm-picker');
                if (picker) picker.classList.add('hidden');

                try {
                    if (uid && uid !== 'null') await assignUserToSpace(spaceId, uid, 'pm');
                    else await assignUserToSpace(spaceId, collabId, 'pm', true);
                    renderSpaceView(container, spaceId); // Re-render full view to refresh state
                } catch (err) { alert("Errore: " + err.message); }
                return;
            }

            // Remove PM
            const removeBtn = e.target.closest('.remove-space-pm-btn');
            if (removeBtn) {
                e.stopPropagation();
                if (!confirm("Rimuovere responsabile?")) return;
                const pill = removeBtn.closest('.user-pill-mini');
                const uid = pill.dataset.uid;
                const collabId = pill.dataset.collabId;
                try {
                    if (uid && uid !== 'null' && uid !== 'undefined') await removeUserFromSpace(spaceId, uid);
                    else await removeUserFromSpace(spaceId, collabId, true);
                    renderSpaceView(container, spaceId); // Re-render
                } catch (err) { alert("Errore: " + err.message); }
                return;
            }
        };

        // Remove previous listener if reference exists
        if (container._spaceViewHandler) {
            container.removeEventListener('click', container._spaceViewHandler);
        }
        container._spaceViewHandler = handleSpaceViewEvents;
        container.addEventListener('click', handleSpaceViewEvents);

        // Outside Click (Global)
        if (!window._pickerOutsideListener) {
            window._pickerOutsideListener = (e) => {
                const pickers = document.querySelectorAll('#space-pm-picker:not(.hidden)');
                pickers.forEach(p => {
                    const btn = p.parentElement?.querySelector('#add-space-pm-btn');
                    if (!p.contains(e.target) && (!btn || !btn.contains(e.target))) {
                        p.classList.add('hidden');
                    }
                });
            };
            document.addEventListener('click', window._pickerOutsideListener);
        }



        // ---------------------------------------------------------
        // State Listeners (Real-time updates without full reload)
        // ---------------------------------------------------------

        const spaceListener = async (e) => {
            if (String(e.detail?.spaceId) === String(spaceId)) {
                // Fetch fresh data
                const [newItems, newSpace, newChildren] = await Promise.all([
                    fetchProjectItems(spaceId),
                    fetchSpace(spaceId),
                    space.is_cluster ? fetchChildProjects(spaceId) : Promise.resolve([])
                ]);

                // Update local references
                // We actually need to update the higher scope if we want to avoid full re-render, 
                // but for space_view, a re-render is safer for now.
                renderSpaceView(container, spaceId);
            }
        };

        const apptListener = (e) => {
            if (String(e.detail?.spaceId) === String(spaceId) || (e.detail?.refType === 'space' && String(e.detail?.refId) === String(spaceId))) {
                renderSpaceView(container, spaceId);
            }
        };

        if (window._spaceViewListener) document.removeEventListener('pm-item-changed', window._spaceViewListener);
        window._spaceViewListener = spaceListener;
        document.addEventListener('pm-item-changed', spaceListener);

        if (window._spaceApptListener) document.removeEventListener('appointment-changed', window._spaceApptListener);
        window._spaceApptListener = apptListener;
        document.addEventListener('appointment-changed', apptListener);

        // Initial Render
        if (activeView === 'projects' && space.is_cluster) {
            renderChildProjects(viewContent, childProjects);
        } else if (activeView === 'tree') {
            renderHubTree(viewContent, items, space, spaceId);
        } else if (activeView === 'appointments') {
            renderHubAppointments(viewContent, appointments, appointmentTypes, spaceId, 'space');
        } else {
            // Default fallback or rendering for 'list'/'people' if they have renderers
            if (activeView === 'list') viewContent.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-secondary);">Vista Lista in arrivo...</div>`;
            else if (activeView === 'people') viewContent.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-secondary);">Vista Persone in arrivo...</div>`;
            else {
                // Really fallback
                space.is_cluster ? renderChildProjects(viewContent, childProjects) : renderHubTree(viewContent, items, space, spaceId);
            }
        }

    } catch (e) {
        console.error("Error rendering space:", e);
        container.innerHTML = `<div class="error-state">Errore caricamento progetto: ${e.message}</div>`;
    }
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
