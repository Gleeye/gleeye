import { state } from '../../modules/state.js?v=317';
import { fetchOrders } from '../../modules/api.js?v=317';
import { fetchProjectSpaceForOrder, fetchProjectItems, fetchSpaceAssignees, assignUserToSpace, removeUserFromSpace, fetchAppointments, fetchAppointmentTypes } from '../../modules/pm_api.js?v=317';

// Status colors for "Stato Lavori"
const STATUS_CONFIG = {
    'in_svolgimento': { label: 'In Svolgimento', color: '#3b82f6', bg: '#eff6ff' },
    'lavoro_in_attesa': { label: 'Lavoro in Attesa', color: '#f59e0b', bg: '#fffbeb' },
    'finito_da_fatturare': { label: 'Finito da Fatturare', color: '#8b5cf6', bg: '#f5f3ff' },
    'completato': { label: 'Completato', color: '#10b981', bg: '#ecfdf5' },
    'contratto_da_inviare': { label: 'Contratto da Inviare', color: '#64748b', bg: '#f1f5f9' }
};

// Item status colors
const ITEM_STATUS = {
    'todo': { label: 'Da Fare', color: '#94a3b8', bg: '#f1f5f9' },
    'in_progress': { label: 'In Corso', color: '#3b82f6', bg: '#eff6ff' },
    'blocked': { label: 'Bloccato', color: '#ef4444', bg: '#fef2f2' },
    'review': { label: 'Revisione', color: '#f59e0b', bg: '#fffbeb' },
    'done': { label: 'Completata', color: '#10b981', bg: '#ecfdf5' }
};

function normalizeStatus(status) {
    if (!status) return 'altro';
    const s = status.toLowerCase().trim().replace(/_/g, ' ');
    if (s.includes('svolgimento') || s.includes('in corso')) return 'in_svolgimento';
    if (s.includes('attesa')) return 'lavoro_in_attesa';
    if (s.includes('fatturare') || s.includes('finito')) return 'finito_da_fatturare';
    if (s.includes('completato')) return 'completato';
    if (s.includes('contratto')) return 'contratto_da_inviare';
    return 'altro';
}

// Calculate KPIs from items
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

export async function renderCommessaDetail(container, entityId, isInternal = false) {
    container.innerHTML = '<div class="loading-state"><span class="loader"></span></div>';

    try {
        console.log('[ProjectHub] Loading:', entityId, 'Internal:', isInternal);

        // 1. Ensure core data is fetched (for collaborators, assignments)
        const promises = [];
        // Only fetch orders if we are in commessa mode
        if (!isInternal && (!state.orders || state.orders.length === 0)) promises.push(fetchOrders());

        const { fetchAssignments, fetchCollaborators } = await import('../../modules/api.js?v=317');
        if (!state.assignments || state.assignments.length === 0) promises.push(fetchAssignments());
        if (!state.collaborators || state.collaborators.length === 0) promises.push(fetchCollaborators());

        if (promises.length > 0) await Promise.all(promises);

        // 2. Resolve Space and Context
        let space = null;
        let order = null;
        let orderId = null;

        if (isInternal) {
            // EntityId is SpaceID
            const { fetchSpace } = await import('../../modules/pm_api.js?v=317');
            space = await fetchSpace(entityId);
            if (!space) throw new Error("Spazio non trovato");
        } else {
            // EntityId is OrderID
            orderId = entityId;
            // Use loose comparison or string conversion to handle numeric IDs vs string URL params
            order = state.orders?.find(o => String(o.id) === String(orderId));

            if (!order) {
                // If not found in current state, force a refresh of orders just in case
                console.warn("Order not found in state, refetching orders...");
                await fetchOrders();
                order = state.orders?.find(o => String(o.id) === String(orderId));
            }

            if (!order) throw new Error("Ordine non trovato");

            // Get or create PM Space
            space = await fetchProjectSpaceForOrder(orderId);
        }

        const spaceId = space?.id; // Should be available now

        let [items, spaceAssignees] = await Promise.all([
            spaceId ? fetchProjectItems(spaceId) : [],
            spaceId ? fetchSpaceAssignees(spaceId) : []
        ]);

        // 3. Calculate KPIs
        let kpis = calculateKPIs(items);

        // 4. Status badge (Only for Commesse)
        /* const normalized = normalizeStatus(order?.status_works);
        const statusConfig = STATUS_CONFIG[normalized] || { label: order?.status_works || 'N/A', color: '#64748b', bg: '#f1f5f9' }; */
        // Moved inside render to handle internal case

        // 5. Get PM user
        const pmUser = state.profiles?.find(p => p.id === space?.default_pm_user_ref);

        // 6. Render Page
        container.innerHTML = `
            <div class="project-hub" style="height: 100%; display: flex; flex-direction: column;">
                
                <!-- STICKY HEADER -->
                <div class="hub-header" style="
                    background: white;
                    border-bottom: 1px solid var(--surface-2);
                    padding: 1.25rem 1.5rem;
                    position: sticky;
                    top: 0;
                    z-index: 50;
                ">
                    <!-- UNIFIED HEADER -->
                    <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem;">
                        
                        <!-- Row 1: Badges & Status -->
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            ${isInternal ? `
                                <span style="font-family: monospace; color: var(--text-secondary); font-weight: 600; font-size: 0.85rem;">${space?.area || 'Generale'}</span>
                                <span style="background: #f1f5f9; color: var(--text-secondary); padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase;">Progetto Interno</span>
                            ` : `
                                <span style="font-family: monospace; color: var(--text-secondary); font-weight: 600; font-size: 0.85rem;">${order?.order_number || ''}</span>
                                ${(() => {
                const normalized = normalizeStatus(order?.status_works);
                const statusConfig = STATUS_CONFIG[normalized] || { label: order?.status_works || 'N/A', color: '#64748b', bg: '#f1f5f9' };
                return `
                                        <div style="position: relative;">
                                            <select id="hub-order-status-select" style="
                                                appearance: none; border: none; padding: 2px 24px 2px 10px; border-radius: 12px;
                                                font-size: 0.75rem; font-weight: 600; background-color: ${statusConfig.bg}; color: ${statusConfig.color};
                                                cursor: pointer; outline: none;
                                            ">
                                                ${Object.entries(STATUS_CONFIG).map(([key, cfg]) => `
                                                    <option value="${key}" ${normalized === key ? 'selected' : ''}>${cfg.label}</option>
                                                `).join('')}
                                            </select>
                                            <span class="material-icons-round" style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); font-size: 0.9rem; color: ${statusConfig.color}; pointer-events: none;">expand_more</span>
                                        </div>
                                    `;
            })()}
                            `}
                        </div>

                        <!-- Row 2: Title & Main Actions -->
                        <div style="display: flex; justify-content: space-between; align-items: start; gap: 1rem;">
                            <h1 style="font-size: 1.75rem; font-weight: 800; color: var(--text-primary); margin: 0; line-height: 1.2;">
                                ${isInternal ? (space?.name || 'Progetto senza nome') : (order?.title || 'Senza Titolo')}
                            </h1>

                            <!-- Actions -->
                            <div style="display: flex; gap: 0.5rem;">
                                <!-- Add Dropdown -->
                                <div style="position: relative;">
                                    <button class="primary-btn" id="add-new-hub-btn" style="display: flex; align-items: center; gap: 0.5rem; padding: 8px 16px;">
                                        <span class="material-icons-round" style="font-size: 1.1rem;">add</span>
                                        Nuovo
                                        <span class="material-icons-round" style="font-size: 1.1rem;">expand_more</span>
                                    </button>
                                    
                                    <div id="add-hub-dropdown" class="hidden glass-card" style="
                                        position: absolute; top: 110%; right: 0; width: 200px; z-index: 1000;
                                        background: white; border: 1px solid var(--surface-2); border-radius: 12px;
                                        box-shadow: 0 4px 20px rgba(0,0,0,0.15); padding: 0.5rem;
                                    ">
                                        <button class="dropdown-item" id="add-activity-btn" style="
                                            display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.75rem; 
                                            text-align: left; border: none; background: none; cursor: pointer; border-radius: 8px;
                                            color: var(--text-primary); font-size: 0.9rem;
                                        ">
                                            <span class="material-icons-round" style="color: #f59e0b;">folder</span>
                                            <div><div style="font-weight: 500;">Attività</div><div style="font-size: 0.75rem; text-secondary;">Raggruppa task</div></div>
                                        </button>
                                        <button class="dropdown-item" id="add-task-btn" style="
                                            display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.75rem; 
                                            text-align: left; border: none; background: none; cursor: pointer; border-radius: 8px;
                                            color: var(--text-primary); font-size: 0.9rem;
                                        ">
                                            <span class="material-icons-round" style="color: #3b82f6;">check_circle_outline</span>
                                            <div><div style="font-weight: 500;">Task</div><div style="font-size: 0.75rem; text-secondary;">Singolo lavoro</div></div>
                                        </button>
                                        ${!isInternal ? `
                                        <button class="dropdown-item" id="add-appointment-btn" style="
                                            display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.75rem; 
                                            text-align: left; border: none; background: none; cursor: pointer; border-radius: 8px;
                                            color: var(--text-primary); font-size: 0.9rem;
                                        ">
                                            <span class="material-icons-round" style="color: #8b5cf6;">event</span>
                                            <div><div style="font-weight: 500;">Appuntamento</div><div style="font-size: 0.75rem; text-secondary;">Singolo incontro</div></div>
                                        </button>
                                        ` : ''}
                                    </div>
                                </div>
                                
                                ${!isInternal ? `
                                <a href="#order-detail/${orderId}" class="secondary-btn" title="Info Ordine" style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; padding: 0; text-decoration: none; border-radius: 8px;">
                                    <span class="material-icons-round" style="font-size: 1.25rem;">receipt_long</span>
                                </a>
                                ` : ''}
                            </div>
                        </div>

                        <!-- Row 3: Meta Info (Client + PMs) -->
                        <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
                            ${!isInternal && order?.clients ? `
                                <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                                    <span class="material-icons-round" style="font-size: 1.1rem;">business</span>
                                    <span>${order.clients.business_name}</span>
                                </div>
                            ` : ''}
                            
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <span style="font-size: 0.8rem; color: var(--text-tertiary); font-weight: 500; text-transform: uppercase;">PM:</span>
                                <div id="space-pms-list" style="display: flex; align-items: center; gap: 6px;">
                                    ${spaceAssignees.filter(a => a.role === 'pm').map(a => {
                // Name Resolution logic
                let userName = 'Utente';
                let avatarUrl = null;
                const collab = state.collaborators?.find(c => (a.user_ref && c.user_id === a.user_ref) || (a.collaborator_ref && c.id === a.collaborator_ref));
                if (collab) {
                    userName = collab.full_name || `${collab.first_name} ${collab.last_name}`;
                    avatarUrl = collab.avatar_url;
                } else {
                    userName = a.user?.full_name || a.user?.first_name || 'Utente';
                    avatarUrl = a.user?.avatar_url;
                }
                const initial = userName.charAt(0).toUpperCase();

                return `
                                            <div class="user-pill-mini pm" data-uid="${a.user_ref}" data-collab-id="${a.collaborator_ref}" title="${userName}" style="
                                                display: flex; align-items: center; gap: 6px; background: var(--surface-1); 
                                                padding: 2px 8px 2px 2px; border-radius: 16px; border: 1px solid transparent;
                                                font-size: 0.8rem; color: var(--text-secondary); font-weight: 500;
                                            ">
                                                <div style="width: 20px; height: 20px; border-radius: 50%; background: var(--brand-blue); color: white; display: flex; align-items: center; justify-content: center; font-size: 10px;">
                                                    ${avatarUrl ? `<img src="${avatarUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : initial}
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

                        <!-- Row 4: KPI Pills -->
                        <div style="display: flex; gap: 1.5rem; margin-top: 0.5rem; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; background: #fef2f2; color: #ef4444; padding: 4px 12px; border-radius: 6px; font-weight: 600; font-size: 0.85rem;">
                                <span class="material-icons-round" style="font-size: 1rem;">warning</span>
                                ${kpis.overdue} Scadute
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem; color: #f59e0b; font-weight: 600; font-size: 0.85rem;">
                                <span class="material-icons-round" style="font-size: 1rem;">schedule</span>
                                ${kpis.dueSoon} In scadenza
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-weight: 600; font-size: 0.85rem;">
                                <span class="material-icons-round" style="font-size: 1rem;">block</span>
                                ${kpis.blocked} Bloccate
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem; color: #10b981; font-weight: 600; font-size: 0.85rem;">
                                <span class="material-icons-round" style="font-size: 1rem;">check_circle</span>
                                ${kpis.progress}% Completato
                            </div>
                        </div>

                    </div>
                
                <!-- TABS -->
                <div class="hub-tabs" style="
                    display: flex; 
                    gap: 0; 
                    background: white;
                    border-bottom: 1px solid var(--surface-2);
                    padding: 0 1.5rem;
                ">
                    <button class="hub-tab active" data-tab="overview">
                        <span class="material-icons-round">dashboard</span>
                        Overview
                    </button>
                    <button class="hub-tab" data-tab="tree">
                        <span class="material-icons-round">account_tree</span>
                        Attività
                    </button>
                    <button class="hub-tab" data-tab="list">
                        <span class="material-icons-round">view_list</span>
                        Lista
                    </button>
                    ${!isInternal ? `
                    <button class="hub-tab" data-tab="incarichi">
                        <span class="material-icons-round">assignment_ind</span>
                        Incarichi
                    </button>
                    ` : ''}
                    <button class="hub-tab" data-tab="appointments">
                        <span class="material-icons-round">event</span>
                        Appuntamenti
                    </button>
                </div>
                
                <!-- TAB CONTENT -->
                <div id="hub-tab-content" style="flex: 1; overflow-y: auto; background: #f1f5f9; padding: 1.5rem;">
                    <!-- Dynamic content -->
                </div>
                
                <!-- DRAWER -->
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
            </div>
            
            <style>
                .hub-tab {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 1rem 1.25rem;
                    border: none;
                    background: none;
                    cursor: pointer;
                    font-weight: 500;
                    color: var(--text-secondary);
                    border-bottom: 2px solid transparent;
                    transition: all 0.2s;
                }
                .hub-tab:hover {
                    color: var(--text-main);
                    background: var(--surface-1);
                }
                .hub-tab.active {
                    color: var(--brand-color);
                    border-bottom-color: var(--brand-color);
                    font-weight: 600;
                }
                .hub-tab .material-icons-round {
                    font-size: 1.1rem;
                }
                .drawer-overlay.hidden {
                    display: none !important;
                }
            </style>
        `;

        // Store context for child components
        window._hubContext = { order, space, spaceId, items, kpis, orderId };

        // 7. Tab Logic
        const tabContent = container.querySelector('#hub-tab-content');
        const tabs = container.querySelectorAll('.hub-tab');

        const renderTab = async (tabName) => {
            tabs.forEach(t => t.classList.remove('active'));
            container.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

            switch (tabName) {
                case 'overview':
                    const { renderHubOverview } = await import('./components/hub_overview.js?v=317');
                    renderHubOverview(tabContent, items, kpis, spaceId);
                    break;
                case 'tree':
                    const { renderHubTree } = await import('./components/hub_tree.js?v=317');
                    renderHubTree(tabContent, items, space, spaceId);
                    break;
                case 'list':
                    const { renderHubList } = await import('./components/hub_list.js?v=317');
                    renderHubList(tabContent, items, space, spaceId);
                    break;
                case 'incarichi':
                    if (!isInternal && order) renderIncarichiTab(tabContent, order);
                    else tabContent.innerHTML = '<p style="padding:2rem;">Non disponibile per progetti interni.</p>';
                    break;
                case 'appointments':
                    const { renderHubAppointments } = await import('./components/hub_appointments.js?v=317');
                    const refId = isInternal ? spaceId : orderId;
                    const refType = isInternal ? 'space' : 'order';

                    const ap = await fetchAppointments(refId, refType);
                    const types = await fetchAppointmentTypes();
                    renderHubAppointments(tabContent, ap, types, refId, refType);
                    break;
                default:
                    tabContent.innerHTML = '<p style="padding:2rem;">Tab non implementata.</p>';
            }
        };

        tabs.forEach(tab => {
            tab.addEventListener('click', () => renderTab(tab.dataset.tab));
        });

        // 8. Add Activity/Task buttons (Dropdown Logic)
        const addHubBtn = container.querySelector('#add-new-hub-btn');
        const addHubDropdown = container.querySelector('#add-hub-dropdown');

        if (addHubBtn && addHubDropdown) {
            addHubBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                addHubDropdown.classList.toggle('hidden');
            });

            document.addEventListener('click', (e) => {
                if (!addHubBtn.contains(e.target) && !addHubDropdown.contains(e.target)) {
                    addHubDropdown.classList.add('hidden');
                }
            });

            container.querySelector('#add-activity-btn')?.addEventListener('click', () => {
                addHubDropdown.classList.add('hidden');
                openItemDrawer(null, spaceId, null, 'attivita');
            });

            container.querySelector('#add-task-btn')?.addEventListener('click', () => {
                addHubDropdown.classList.add('hidden');
                openItemDrawer(null, spaceId, null, 'task');
            });

            container.querySelector('#add-appointment-btn')?.addEventListener('click', () => {
                addHubDropdown.classList.add('hidden');
                import('./components/hub_appointment_drawer.js?v=317').then(mod => {
                    const refId = isInternal ? spaceId : orderId;
                    const refType = isInternal ? 'space' : 'order';
                    mod.openAppointmentDrawer(null, refId, refType);
                });
            });
        }

        // 9. Listen for Item Changes (No Reload)
        const pmListener = async (e) => {
            // Safer comparison (String vs Number)
            const eventSpaceId = e.detail?.spaceId;
            if (String(eventSpaceId) === String(spaceId)) {
                console.log('[ProjectHub] Event received:', e.detail);

                // If it's a deletion, we can immediately remove it from local state for speed
                if (e.detail.action === 'delete' && e.detail.itemId) {
                    items = items.filter(i => String(i.id) !== String(e.detail.itemId));
                    kpis = calculateKPIs(items);

                    // Partial DOM update first
                    const kpi_ov = container.querySelector('#kpi-badge-overdue .kpi-val');
                    if (kpi_ov) kpi_ov.textContent = kpis.overdue;
                    // ... other kpi updates can follow or just render

                    // Re-render active tab immediately
                    const activeTab = Array.from(tabs).find(t => t.classList.contains('active'))?.dataset.tab || 'overview';
                    renderTab(activeTab);
                }

                const { fetchProjectItems, fetchSpace, fetchSpaceAssignees } = await import('../../modules/pm_api.js?v=317');

                try {
                    console.log('[ProjectHub] Fetching fresh data to sync...');
                    const [newSpace, newItems, newAssignees] = await Promise.all([
                        fetchSpace(spaceId),
                        fetchProjectItems(spaceId),
                        fetchSpaceAssignees(spaceId)
                    ]);

                    console.log('[ProjectHub] Sync complete. Items:', newItems?.length);

                    // Update local references
                    items = newItems || [];
                    space = newSpace;
                    spaceAssignees = newAssignees || [];
                    kpis = calculateKPIs(items);

                    // Update PM icons in header
                    const pmsList = container.querySelector('#space-pms-list');
                    if (pmsList) {
                        const currentAddBtn = pmsList.querySelector('div:has(#add-space-pm-btn)'); // Keep the add button
                        const addBtnHtml = currentAddBtn ? currentAddBtn.outerHTML : '';

                        pmsList.innerHTML = spaceAssignees.filter(a => a.role === 'pm').map(a => {
                            let userName = a.user?.full_name || a.user?.first_name || 'Utente';
                            let avatarUrl = a.user?.avatar_url;
                            const initial = userName.charAt(0).toUpperCase();
                            return `
                                        <div class="user-pill-mini pm" data-uid="${a.user_ref}" data-collab-id="${a.collaborator_ref}" title="${userName}" style="
                                            display: flex; align-items: center; gap: 6px; background: var(--surface-1); 
                                            padding: 2px 8px 2px 2px; border-radius: 16px; border: 1px solid transparent;
                                            font-size: 0.8rem; color: var(--text-secondary); font-weight: 500;
                                        ">
                                            <div style="width: 20px; height: 20px; border-radius: 50%; background: var(--brand-blue); color: white; display: flex; align-items: center; justify-content: center; font-size: 10px;">
                                                ${avatarUrl ? `<img src="${avatarUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : initial}
                                            </div>
                                            ${userName.split(' ')[0]}
                                            <span class="material-icons-round remove-space-pm-btn" data-id="${a.id}" style="font-size: 0.9rem; cursor: pointer; opacity: 0.5;">close</span>
                                        </div>
                                    `;
                        }).join('') + addBtnHtml;

                        // Re-attach remove PM listeners if needed or use delegation (better)
                        // For simplicity, we assume delegation is handled or we re-trigger some setup
                    }

                    // Re-render active tab content
                    const activeTab = Array.from(tabs).find(t => t.classList.contains('active'))?.dataset.tab || 'overview';
                    renderTab(activeTab);

                } catch (err) {
                    console.error("Error refreshing hub:", err);
                }
            }
        };

        // Remove old listener if exists to prevent duplicates
        if (window._currentPMListener) document.removeEventListener('pm-item-changed', window._currentPMListener);
        window._currentPMListener = pmListener;
        document.addEventListener('pm-item-changed', pmListener);

        const apptListener = (e) => {
            const evt = e.detail;
            const matchOrder = !isInternal && orderId && String(evt.orderId) === String(orderId);
            const matchSpace = isInternal && spaceId && String(evt.spaceId) === String(spaceId);
            const matchGeneric = evt.refType === (isInternal ? 'space' : 'order') && String(evt.refId) === String(isInternal ? spaceId : orderId);

            if (matchOrder || matchSpace || matchGeneric) {
                const activeTab = container.querySelector('.hub-tab.active')?.dataset.tab;
                if (activeTab === 'appointments' || activeTab === 'overview') {
                    renderTab(activeTab);
                }
            }
        };
        if (window._currentApptListener) document.removeEventListener('appointment-changed', window._currentApptListener);
        window._currentApptListener = apptListener;
        document.addEventListener('appointment-changed', apptListener);

        // 11. Initial render
        renderTab('overview');

        // Multi-PM Picker Logic Helpers
        const renderPmOptions = () => {
            const assignedUserIds = new Set(spaceAssignees.map(a => a.user_ref).filter(Boolean));
            const assignedCollabIds = new Set(spaceAssignees.map(a => a.collaborator_ref).filter(Boolean));
            const others = (state.collaborators || []).filter(c => {
                if (c.is_active === false || c.active === false) return false;
                let tags = c.tags || [];
                if (typeof tags === 'string') {
                    try { tags = JSON.parse(tags); } catch (e) { tags = tags.split(',').map(t => t.trim()); }
                }
                const isPM = Array.isArray(tags) && tags.some(t => t.toLowerCase() === 'pm' || t.toLowerCase() === 'project manager');
                const isAssigned = (c.user_id && assignedUserIds.has(c.user_id)) || assignedCollabIds.has(c.id);
                return isPM && !isAssigned;
            });

            if (others.length === 0) return '<div style="padding:1.5rem; text-align:center; font-size:0.85rem; color:var(--text-tertiary);">Nessun altro PM disponibile</div>';

            return `
                <div style="padding: 10px 12px 6px; font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--surface-2); margin-bottom: 4px;">Assegna Project Manager</div>
                ${others.map(c => {
                const initial = c.full_name?.charAt(0).toUpperCase() || 'P';
                return `
                        <div class="user-option-space" data-uid="${c.user_id || ''}" data-collab-id="${c.id}" style="
                            display: flex; 
                            align-items: center; 
                            gap: 10px; 
                            padding: 10px 12px; 
                            cursor: pointer; 
                            transition: background 0.2s;
                        " onmouseover="this.style.background='var(--surface-1)'" onmouseout="this.style.background='transparent'">
                            <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--brand-blue); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; border: 1px solid rgba(0,0,0,0.05); overflow: hidden;">
                                ${c.avatar_url ? `<img src="${c.avatar_url}" style="width:100%; height:100%; object-fit:cover;">` : initial}
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.full_name}</div>
                                <div style="font-size: 0.7rem; color: var(--text-tertiary); display: flex; align-items: center; gap: 4px;">
                                    <span class="material-icons-round" style="font-size: 10px;">verified</span> Project Manager
                                </div>
                            </div>
                        </div>
                    `;
            }).join('')}
            `;
        };

        // Header PM UI - Consolidated Event Handler
        const handleCommessaPmEvents = async (e) => {
            // 1. ADD Button Click
            const addBtn = e.target.closest('#add-space-pm-btn');
            if (addBtn) {
                e.stopPropagation();
                // Find relative picker
                const pickerContainer = addBtn.parentElement;
                const pmPicker = pickerContainer.querySelector('#space-pm-picker');
                if (pmPicker) {
                    if (pmPicker.classList.contains('hidden')) {
                        // Close other pickers if any (optional)
                        document.querySelectorAll('#space-pm-picker:not(.hidden)').forEach(p => p.classList.add('hidden'));
                        pmPicker.innerHTML = renderPmOptions();
                        pmPicker.classList.remove('hidden');
                    } else {
                        pmPicker.classList.add('hidden');
                    }
                }
                return;
            }

            // 2. OPTION Selection Click
            const opt = e.target.closest('.user-option-space');
            if (opt) {
                e.stopPropagation();
                const uid = opt.dataset.uid;
                const collabId = opt.dataset.collabId;
                const pmPicker = opt.closest('#space-pm-picker');
                if (pmPicker) pmPicker.classList.add('hidden');

                try {
                    if (uid && uid !== 'null' && uid !== '') await assignUserToSpace(spaceId, uid, 'pm');
                    else await assignUserToSpace(spaceId, collabId, 'pm', true);
                    document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { spaceId } }));
                } catch (err) { alert("Errore PM: " + err.message); }
                return;
            }

            // 3. PM removal delegation
            const removeBtn = e.target.closest('.remove-space-pm-btn');
            if (removeBtn) {
                e.stopPropagation();
                const pill = removeBtn.closest('.user-pill-mini');
                if (pill && await window.showConfirm?.("Rimuovere PM dalla commessa?")) {
                    const uid = pill.dataset.uid;
                    const collabId = pill.dataset.collabId;
                    try {
                        if (uid && uid !== 'null' && uid !== 'undefined') await removeUserFromSpace(spaceId, uid);
                        else await removeUserFromSpace(spaceId, collabId, true);
                        document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { spaceId } }));
                    } catch (err) { alert("Errore: " + err.message); }
                }
                return;
            }
        };

        // Attach Container Listener (Remove old first)
        if (container._commessaPmHandler) {
            container.removeEventListener('click', container._commessaPmHandler);
        }
        container._commessaPmHandler = handleCommessaPmEvents;
        container.addEventListener('click', handleCommessaPmEvents);

        // Global Outside Click for PM Picker
        if (!window._commessaPickerOutside) {
            window._commessaPickerOutside = (e) => {
                const pickers = container.querySelectorAll('#space-pm-picker:not(.hidden)');
                pickers.forEach(picker => {
                    const btn = picker.parentElement.querySelector('#add-space-pm-btn');
                    if (!picker.contains(e.target) && (!btn || !btn.contains(e.target))) {
                        picker.classList.add('hidden');
                    }
                });
            };
            document.addEventListener('click', window._commessaPickerOutside);
        }

        // 13. Status Update Logic
        const statusSelect = container.querySelector('#hub-order-status-select');
        if (statusSelect) {
            statusSelect.addEventListener('change', async (e) => {
                const newStatus = e.target.value;
                try {
                    statusSelect.disabled = true;
                    const { updateOrder } = await import('../../modules/api.js?v=317');
                    await updateOrder(orderId, { status_works: newStatus });
                    const newNormalized = normalizeStatus(newStatus);
                    const newCfg = STATUS_CONFIG[newNormalized] || { label: newStatus, color: '#64748b', bg: '#f1f5f9' };
                    statusSelect.style.backgroundColor = newCfg.bg;
                    statusSelect.style.color = newCfg.color;
                    const icon = statusSelect.nextElementSibling;
                    if (icon) icon.style.color = newCfg.color;
                    statusSelect.disabled = false;
                } catch (err) {
                    alert("Errore stato: " + err.message);
                    statusSelect.disabled = false;
                    statusSelect.value = order.status_works;
                }
            });
        }
    } catch (e) {
        console.error("Error Hub:", e);
        container.innerHTML = `
            <div class="error-state" style="padding: 2rem; text-align: center;">
                <span class="material-icons-round" style="font-size: 3rem; color: var(--text-tertiary);">error_outline</span>
                <h3>${isInternal ? 'Progetto non trovato' : 'Commessa non trovata'}</h3>
                <p class="text-secondary">${e.message || 'Si è verificato un errore durante il caricamento.'}</p>
                <a href="${isInternal ? '#pm/interni' : '#pm/commesse'}" class="primary-btn" style="margin-top: 1rem; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;">
                    <span class="material-icons-round">arrow_back</span>
                    ${isInternal ? 'Torna ai Progetti' : 'Torna alle Commesse'}
                </a>
            </div>
        `;
    }
}

// Drawer function (exported for use by child components)
export function openItemDrawer(itemId, spaceId, parentId = null, itemType = 'task') {
    import('./components/hub_drawer.js?v=317').then(mod => {
        mod.openHubDrawer(itemId, spaceId, parentId, itemType);
    });
}

// Incarichi tab
function renderIncarichiTab(container, order) {
    const assignments = state.assignments?.filter(a => a.order_id === order.id) || [];

    if (assignments.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem; background: white; border-radius: 12px;">
                <span class="material-icons-round" style="font-size: 3.5rem; color: var(--text-tertiary); opacity: 0.5;">assignment_ind</span>
                <h3 style="margin: 1rem 0 0.5rem;">Nessun incarico collegato</h3>
                <p class="text-secondary">Gli incarichi vengono gestiti dalla pagina Dettaglio Ordine.</p>
                <a href="#order-detail/${order.id}" class="primary-btn" style="margin-top: 1.5rem; display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none;">
                    <span class="material-icons-round" style="font-size: 1rem;">open_in_new</span>
                    Gestisci Incarichi
                </a>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="background: white; border-radius: 12px; padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0;">Incarichi (${assignments.length})</h3>
                <a href="#order-detail/${order.id}" class="secondary-btn" style="text-decoration: none; font-size: 0.85rem;">
                    Gestisci
                </a>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
                ${assignments.map(a => {
        const collab = state.collaborators?.find(c => c.id === a.collaborator_id);
        // Count items linked to this assignment (would need pm_item_incarichi data)
        return `
                        <div class="glass-card incarico-card" data-id="${a.id}" style="padding: 1.25rem; cursor: pointer; transition: all 0.2s;">
                            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                                <div style="
                                    width: 44px; 
                                    height: 44px; 
                                    border-radius: 50%; 
                                    background: linear-gradient(135deg, var(--brand-color), #7c3aed); 
                                    color: white; 
                                    display: flex; 
                                    align-items: center; 
                                    justify-content: center;
                                    font-weight: 600;
                                    font-size: 1rem;
                                ">
                                    ${(collab?.full_name || 'N/A').charAt(0).toUpperCase()}
                                </div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 600;">${collab?.full_name || 'Collaboratore'}</div>
                                    <div class="text-xs text-secondary">${a.description || 'Incarico'}</div>
                                </div>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 1rem; border-top: 1px solid var(--surface-2);">
                                <span style="font-weight: 600; color: var(--brand-color);">${a.amount ? '€' + a.amount.toLocaleString() : '-'}</span>
                                <span class="badge" style="background: ${a.status === 'completato' ? '#ecfdf5' : 'var(--surface-2)'}; color: ${a.status === 'completato' ? '#10b981' : 'var(--text-secondary)'};">
                                    ${a.status || 'attivo'}
                                </span>
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;
}
