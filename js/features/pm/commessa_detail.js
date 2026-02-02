import { state } from '../../modules/state.js?v=151';
import { fetchOrders } from '../../modules/api.js?v=151';
import { fetchProjectSpaceForOrder, fetchProjectItems, fetchSpaceAssignees, assignUserToSpace, removeUserFromSpace, fetchAppointments, fetchAppointmentTypes } from '../../modules/pm_api.js?v=151';

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
    'done': { label: 'Completato', color: '#10b981', bg: '#ecfdf5' }
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
    const done = items.filter(i => i.status === 'done' || i.status === 'completed').length;
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

export async function renderCommessaDetail(container, orderId) {
    container.innerHTML = '<div class="loading-state"><span class="loader"></span></div>';

    try {
        console.log('[ProjectHub] Loading commessa:', orderId);

        // 1. Ensure core data is fetched
        const promises = [];
        if (!state.orders || state.orders.length === 0) promises.push(fetchOrders());

        // We need assignments and collaborators for the Smart Picker and Incarichi tab
        // Assuming fetchAssignments and fetchCollaborators exist in api.js
        const { fetchAssignments, fetchCollaborators } = await import('../../modules/api.js?v=151');
        if (!state.assignments || state.assignments.length === 0) promises.push(fetchAssignments());
        if (!state.collaborators || state.collaborators.length === 0) promises.push(fetchCollaborators());

        if (promises.length > 0) {
            console.log('[ProjectHub] Fetching dependencies...', promises.length);
            await Promise.all(promises);
        }

        // 2. Find the order
        const order = state.orders?.find(o => o.id === orderId);
        console.log('[ProjectHub] Found order:', order?.order_number);

        if (!order) {
            console.error('[ProjectHub] Order not found in state. Available IDs:', state.orders?.map(o => o.id).slice(0, 5));
            container.innerHTML = `
                <div class="error-state" style="padding: 2rem; text-align: center;">
                    <span class="material-icons-round" style="font-size: 3rem; color: var(--text-tertiary);">search_off</span>
                    <h3>Commessa non trovata</h3>
                    <p class="text-secondary">ID: ${orderId}</p>
                    <a href="#pm/commesse" class="primary-btn" style="margin-top: 1rem; text-decoration: none;">
                        Torna alle Commesse
                    </a>
                </div>
            `;
            return;
        }

        // 2. Get or create PM Space
        let space = await fetchProjectSpaceForOrder(orderId);
        const spaceId = space?.id;
        let [items, spaceAssignees] = await Promise.all([
            spaceId ? fetchProjectItems(spaceId) : [],
            spaceId ? fetchSpaceAssignees(spaceId) : []
        ]);

        // 3. Calculate KPIs
        let kpis = calculateKPIs(items);

        // 4. Status badge
        const normalized = normalizeStatus(order.status_works);
        const statusConfig = STATUS_CONFIG[normalized] || { label: order.status_works || 'N/A', color: '#64748b', bg: '#f1f5f9' };

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
                    <!-- Row 1: Title + Actions -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                                <span style="
                                    background: var(--brand-color); 
                                    color: white; 
                                    padding: 2px 8px; 
                                    border-radius: 4px; 
                                    font-size: 0.7rem; 
                                    font-weight: 600;
                                    text-transform: uppercase;
                                ">Commessa</span>
                                <span style="font-family: monospace; color: var(--text-secondary);">${order.order_number}</span>
                                <div class="status-selector-wrapper" style="position: relative;">
                                    <select id="hub-order-status-select" style="
                                        appearance: none;
                                        border: none;
                                        padding: 4px 28px 4px 12px;
                                        border-radius: 20px;
                                        font-size: 0.75rem;
                                        font-weight: 500;
                                        background-color: ${statusConfig.bg};
                                        color: ${statusConfig.color};
                                        cursor: pointer;
                                        font-family: inherit;
                                        outline: none;
                                        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                                    ">
                                        ${Object.entries(STATUS_CONFIG).map(([key, cfg]) => `
                                            <option value="${cfg.label}" ${normalized === key ? 'selected' : ''}>
                                                ${cfg.label}
                                            </option>
                                        `).join('')}
                                    </select>
                                    <span class="material-icons-round" style="
                                        position: absolute;
                                        right: 8px;
                                        top: 50%;
                                        transform: translateY(-50%);
                                        font-size: 1rem;
                                        pointer-events: none;
                                        color: ${statusConfig.color};
                                    ">expand_more</span>
                                </div>
                            </div>
                            <h1 style="margin: 0; font-size: 1.5rem; font-weight: 600; line-height: 1.3;">${order.title || 'Senza Titolo'}</h1>
                            <div style="display: flex; align-items: center; gap: 1.5rem; margin-top: 0.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                                <span style="display: flex; align-items: center; gap: 4px;">
                                    <span class="material-icons-round" style="font-size: 1rem;">business</span>
                                    ${order.clients?.business_name || '---'}
                                </span>
                                
                                <!-- SPACE PROJECT MANAGERS -->
                                <div id="space-pms-container" style="display: flex; align-items: center; gap: 0.75rem;">
                                    <span style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: 500; text-transform: uppercase;">PM:</span>
                                    <div id="space-pms-list" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                        ${spaceAssignees.filter(a => a.role === 'pm').map(a => {
            // Improved Name Resolution: Try global collaborators list first
            let userName = 'Utente';
            let avatarUrl = null;

            const collab = state.collaborators?.find(c =>
                (a.user_ref && c.user_id === a.user_ref) ||
                (a.collaborator_ref && c.id === a.collaborator_ref)
            );

            if (collab) {
                userName = collab.full_name || `${collab.first_name} ${collab.last_name}`;
                avatarUrl = collab.avatar_url;
            } else {
                // Fallback to expanded object from API
                userName = a.user?.full_name || a.user?.first_name || a.user?.email || 'Utente';
                avatarUrl = a.user?.avatar_url;
            }

            // Final cleanup if name is still weird
            if (!userName || userName === 'null null') userName = 'Utente';

            const initial = (userName && userName !== 'Utente') ? userName.charAt(0).toUpperCase() : 'U';

            return `
                                            <div class="user-pill-mini pm" data-uid="${a.user_ref}" data-collab-id="${a.collaborator_ref}" title="${userName}" style="
                                                display: flex;
                                                align-items: center;
                                                gap: 4px;
                                                background: var(--surface-2);
                                                padding: 2px 8px 2px 4px;
                                                border-radius: 12px;
                                                border: 1px solid var(--brand-blue-light, rgba(66, 133, 244, 0.2));
                                                font-size: 0.75rem;
                                                color: var(--brand-blue);
                                                font-weight: 500;
                                            ">
                                                <div style="width: 16px; height: 16px; border-radius: 50%; background: var(--brand-blue); color: white; display: flex; align-items: center; justify-content: center; font-size: 10px;">
                                                    ${avatarUrl ? `<img src="${avatarUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : initial}
                                                </div>
                                                ${userName}
                                                <span class="material-icons-round remove-space-pm-btn" data-id="${a.id}" style="font-size: 0.8rem; cursor: pointer; opacity: 0.6;">close</span>
                                            </div>
                                            `;
        }).join('')}
                                        
                                        <!-- Add Button & Picker Wrapper -->
                                        <div style="position: relative;">
                                            <button id="add-space-pm-btn" class="icon-btn-mini" style="width: 22px; height: 22px; border-radius: 50%; color: var(--brand-blue); background: var(--surface-2); border: 1px dashed var(--brand-blue); display: flex; align-items: center; justify-content: center; cursor: pointer;">
                                                <span class="material-icons-round" style="font-size: 1rem;">add</span>
                                            </button>
                                            
                                            <!-- PM PICKER -->
                                            <div id="space-pm-picker" class="hidden glass-card" style="
                                                position: absolute;
                                                top: 120%;
                                                left: 0;
                                                width: 260px;
                                                z-index: 1000;
                                                max-height: 300px;
                                                overflow-y: auto;
                                                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                                                border: 1px solid var(--surface-2);
                                                background: white;
                                                border-radius: 12px;
                                            ">
                                                <!-- Logic will fill this -->
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Actions -->
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <!-- Add Dropdown -->
                            <div style="position: relative;">
                                <button class="primary-btn" id="add-new-hub-btn" style="display: flex; align-items: center; gap: 0.5rem;">
                                    <span class="material-icons-round" style="font-size: 1rem;">add</span>
                                    Nuovo
                                    <span class="material-icons-round" style="font-size: 1rem;">expand_more</span>
                                </button>
                                
                                <div id="add-hub-dropdown" class="hidden glass-card" style="
                                    position: absolute;
                                    top: 120%;
                                    right: 0;
                                    width: 200px;
                                    z-index: 1000;
                                    background: white;
                                    border: 1px solid var(--surface-2);
                                    border-radius: 12px;
                                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                                    overflow: hidden;
                                    padding: 0.5rem;
                                ">
                                    <button class="dropdown-item" id="add-activity-btn" style="
                                        display: flex; align-items: center; gap: 0.75rem; 
                                        width: 100%; padding: 0.75rem; text-align: left;
                                        border: none; background: none; cursor: pointer;
                                        border-radius: 8px; transition: background 0.2s;
                                        color: var(--text-primary); font-size: 0.9rem;
                                    ">
                                        <span class="material-icons-round" style="color: #f59e0b;">folder</span>
                                        <div>
                                            <div style="font-weight: 500;">Attività</div>
                                            <div style="font-size: 0.75rem; color: var(--text-tertiary);">Raggruppa task</div>
                                        </div>
                                    </button>
                                    
                                    <button class="dropdown-item" id="add-task-btn" style="
                                        display: flex; align-items: center; gap: 0.75rem; 
                                        width: 100%; padding: 0.75rem; text-align: left;
                                        border: none; background: none; cursor: pointer;
                                        border-radius: 8px; transition: background 0.2s;
                                        color: var(--text-primary); font-size: 0.9rem;
                                    ">
                                        <span class="material-icons-round" style="color: #3b82f6;">check_circle_outline</span>
                                        <div>
                                            <div style="font-weight: 500;">Task</div>
                                            <div style="font-size: 0.75rem; color: var(--text-tertiary);">Singolo lavoro</div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                            <a href="#order-detail/${orderId}" class="icon-btn" title="Info Ordine" style="text-decoration: none;">
                                <span class="material-icons-round">receipt_long</span>
                            </a>
                        </div>
                    </div>
                    
                    <!-- Row 2: KPI Badges -->
                    <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
                        <div id="kpi-badge-overdue" class="kpi-badge ${kpis.overdue > 0 ? 'warning' : ''}" style="
                            display: flex; 
                            align-items: center; 
                            gap: 0.5rem; 
                            padding: 0.5rem 1rem; 
                            background: ${kpis.overdue > 0 ? '#fef2f2' : 'var(--surface-1)'}; 
                            border-radius: 8px;
                            ${kpis.overdue > 0 ? 'border: 1px solid #fecaca;' : ''}
                        ">
                            <span class="material-icons-round" style="font-size: 1.1rem; color: ${kpis.overdue > 0 ? '#ef4444' : 'var(--text-secondary)'};">warning</span>
                            <span class="kpi-val" style="font-weight: 600; color: ${kpis.overdue > 0 ? '#ef4444' : 'var(--text-main)'};">${kpis.overdue}</span>
                            <span style="font-size: 0.85rem; color: var(--text-secondary);">Scadute</span>
                        </div>
                        
                        <div id="kpi-badge-dueSoon" class="kpi-badge" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: var(--surface-1); border-radius: 8px;">
                            <span class="material-icons-round" style="font-size: 1.1rem; color: #f59e0b;">schedule</span>
                            <span class="kpi-val" style="font-weight: 600;">${kpis.dueSoon}</span>
                            <span style="font-size: 0.85rem; color: var(--text-secondary);">In scadenza</span>
                        </div>
                        
                        <div id="kpi-badge-blocked" class="kpi-badge ${kpis.blocked > 0 ? 'blocked' : ''}" style="
                            display: flex; 
                            align-items: center; 
                            gap: 0.5rem; 
                            padding: 0.5rem 1rem; 
                            background: ${kpis.blocked > 0 ? '#fef2f2' : 'var(--surface-1)'}; 
                            border-radius: 8px;
                        ">
                            <span class="material-icons-round" style="font-size: 1.1rem; color: ${kpis.blocked > 0 ? '#ef4444' : 'var(--text-secondary)'};">block</span>
                            <span class="kpi-val" style="font-weight: 600; color: ${kpis.blocked > 0 ? '#ef4444' : 'var(--text-main)'};">${kpis.blocked}</span>
                            <span style="font-size: 0.85rem; color: var(--text-secondary);">Bloccate</span>
                        </div>
                        
                        <div id="kpi-badge-progress" class="kpi-badge" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: var(--surface-1); border-radius: 8px;">
                            <span class="material-icons-round" style="font-size: 1.1rem; color: #10b981;">check_circle</span>
                            <span class="kpi-val" style="font-weight: 600;">${kpis.progress}%</span>
                            <span style="font-size: 0.85rem; color: var(--text-secondary);">Completato</span>
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
                    <button class="hub-tab" data-tab="incarichi">
                        <span class="material-icons-round">assignment_ind</span>
                        Incarichi
                    </button>
                    <button class="hub-tab" data-tab="appointments">
                        <span class="material-icons-round">event</span>
                        Appuntamenti
                    </button>
                </div>
                
                <!-- TAB CONTENT -->
                <div id="hub-tab-content" style="flex: 1; overflow-y: auto; background: var(--surface-1); padding: 1.5rem;">
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
                    const { renderHubOverview } = await import('./components/hub_overview.js?v=151');
                    renderHubOverview(tabContent, items, kpis, spaceId);
                    break;
                case 'tree':
                    const { renderHubTree } = await import('./components/hub_tree.js?v=151');
                    renderHubTree(tabContent, items, space, spaceId);
                    break;
                case 'list':
                    const { renderHubList } = await import('./components/hub_list.js?v=151');
                    renderHubList(tabContent, items, space, spaceId);
                    break;
                case 'incarichi':
                    renderIncarichiTab(tabContent, order);
                    break;
                case 'appointments':
                    const { renderHubAppointments } = await import('./components/hub_appointments.js?v=151');
                    // We need to fetch appointments first or let the component do it.
                    // Let's pass the fetch function and orderId
                    // Or fetch here? Fetching here ensures data readiness before render.
                    // But for consistency with overview (which takes items), let's fetch here.
                    const ap = await fetchAppointments(orderId);
                    const types = await fetchAppointmentTypes();
                    renderHubAppointments(tabContent, ap, types, orderId);
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

                const { fetchProjectItems, fetchSpace, fetchSpaceAssignees } = await import('../../modules/pm_api.js?v=151');

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

                    window._hubContext.items = items;
                    window._hubContext.space = space;
                    window._hubContext.kpis = kpis;

                    // Update Header KPI DOM manually to avoid full re-render
                    container.querySelector('#kpi-badge-overdue .kpi-val').textContent = kpis.overdue;
                    container.querySelector('#kpi-badge-dueSoon .kpi-val').textContent = kpis.dueSoon;
                    container.querySelector('#kpi-badge-blocked .kpi-val').textContent = kpis.blocked;
                    container.querySelector('#kpi-badge-progress .kpi-val').textContent = `${kpis.progress}%`;

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
                                <div class="user-pill-mini pm" data-uid="${a.user_ref}" data-collab-id="${a.collaborator_ref}" title="${userName}" style="display: flex; align-items: center; gap: 4px; background: var(--surface-2); padding: 2px 8px 2px 4px; border-radius: 12px; border: 1px solid rgba(66, 133, 244, 0.2); font-size: 0.75rem; color: var(--brand-blue); font-weight: 500;">
                                    <div style="width: 16px; height: 16px; border-radius: 50%; background: var(--brand-blue); color: white; display: flex; align-items: center; justify-content: center; font-size: 10px;">
                                        ${avatarUrl ? `<img src="${avatarUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : initial}
                                    </div>
                                    ${userName}
                                    <span class="material-icons-round remove-space-pm-btn" data-id="${a.id}" style="font-size: 0.8rem; cursor: pointer; opacity: 0.6;">close</span>
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
            if (String(e.detail.orderId) === String(orderId)) {
                const activeTab = container.querySelector('.hub-tab.active')?.dataset.tab;
                if (activeTab === 'appointments') {
                    renderTab('appointments');
                }
            }
        };
        if (window._currentApptListener) document.removeEventListener('appointment-changed', window._currentApptListener);
        window._currentApptListener = apptListener;
        document.addEventListener('appointment-changed', apptListener);

        // 11. Initial render
        renderTab('overview');

        // 12. Multi-PM Picker Logic Helpers
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

            if (others.length === 0) return '<div style="padding:1rem; font-size:0.8rem; color:var(--text-tertiary);">Nessun altro PM disponibile</div>';
            return others.map(c => `
                 <div class="user-option-space" data-uid="${c.user_id || ''}" data-collab-id="${c.id}" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; cursor: pointer; transition: background 0.2s;">
                    <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--brand-blue); color: white; display: flex; align-items: center; justify-content: center; font-size: 10px;">
                        ${c.avatar_url ? `<img src="${c.avatar_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : (c.full_name || 'U')[0]}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 0.85rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.full_name}</div>
                    </div>
                 </div>
             `).join('');
        };

        const attachPmOptionListeners = (picker) => {
            picker.querySelectorAll('.user-option-space').forEach(opt => {
                opt.addEventListener('click', async () => {
                    const uid = opt.dataset.uid;
                    const collabId = opt.dataset.collabId;
                    try {
                        if (uid && uid !== 'null' && uid !== '') await assignUserToSpace(spaceId, uid, 'pm');
                        else await assignUserToSpace(spaceId, collabId, 'pm', true);
                        document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { spaceId } }));
                    } catch (err) { alert("Errore PM: " + err.message); }
                });
            });
        };

        // Header PM UI initial setup
        const addPmBtn = container.querySelector('#add-space-pm-btn');
        const pmPicker = container.querySelector('#space-pm-picker');
        if (addPmBtn && pmPicker) {
            addPmBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (pmPicker.classList.contains('hidden')) {
                    pmPicker.innerHTML = renderPmOptions();
                    pmPicker.classList.remove('hidden');
                    attachPmOptionListeners(pmPicker);
                } else pmPicker.classList.add('hidden');
            });
            document.addEventListener('click', (e) => { if (pmPicker && !pmPicker.contains(e.target) && e.target !== addPmBtn) pmPicker.classList.add('hidden'); });
        }

        // PM removal delegation
        container.addEventListener('click', async (e) => {
            const removeBtn = e.target.closest('.remove-space-pm-btn');
            if (!removeBtn) return;
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
        });

        // 13. Status Update Logic
        const statusSelect = container.querySelector('#hub-order-status-select');
        if (statusSelect) {
            statusSelect.addEventListener('change', async (e) => {
                const newStatus = e.target.value;
                try {
                    statusSelect.disabled = true;
                    const { updateOrder } = await import('../../modules/api.js?v=151');
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
        container.innerHTML = `<div class="error-state">Errore: ${e.message}</div>`;
    }
}

// Drawer function (exported for use by child components)
export function openItemDrawer(itemId, spaceId, parentId = null, itemType = 'task') {
    import('./components/hub_drawer.js?v=151').then(mod => {
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
