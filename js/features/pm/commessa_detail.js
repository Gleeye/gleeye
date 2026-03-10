import { state } from '../../modules/state.js';
import { fetchOrders } from '../../modules/api.js';
import { showGlobalAlert } from '../../modules/utils.js?v=1000';
import { fetchProjectSpaceForOrder, fetchProjectItems, fetchSpaceAssignees, assignUserToSpace, removeUserFromSpace, fetchAppointments, fetchAppointmentTypes, updateSpaceCloudLinks } from '../../modules/pm_api.js';
import { CloudLinksManager } from '../components/CloudLinksManager.js?v=1000';
import { renderAvatar } from '../../modules/utils.js?v=1000';

// Status colors for "Stato Lavori"
// Status colors for "Stato Lavori"
const STATUS_CONFIG = {
    'in_svolgimento': { label: 'In Svolgimento', color: '#3b82f6', bg: '#eff6ff', icon: 'play_circle' },
    'lavoro_in_attesa': { label: 'In Attesa', color: '#f59e0b', bg: '#fffbeb', icon: 'hourglass_empty' },
    'in_pausa': { label: 'In Pausa', color: '#64748b', bg: '#f1f5f9', icon: 'pause_circle' },
    'manutenzione': { label: 'Ongoing', color: '#06b6d4', bg: '#ecfeff', icon: 'published_with_changes' },
    'completato': { label: 'Completato', color: '#10b981', bg: '#ecfdf5', icon: 'check_circle' }
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
    if (s.includes('completato') || s.includes('concluso') || s.includes('finito')) return 'completato';
    if (s.includes('pausa') || s.includes('sospeso')) return 'in_pausa';
    if (s.includes('manutenzione') || s.includes('assistenza')) return 'manutenzione';
    if (s.includes('svolgimento') || s.includes('in corso')) return 'in_svolgimento';
    if (s.includes('attesa')) return 'lavoro_in_attesa';
    return 'lavoro_in_attesa';
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

        const { fetchAssignments, fetchCollaborators } = await import('../../modules/api.js?v=1000');
        if (!state.assignments || state.assignments.length === 0) promises.push(fetchAssignments());
        if (!state.collaborators || state.collaborators.length === 0) promises.push(fetchCollaborators());

        if (promises.length > 0) await Promise.all(promises);

        // 2. Resolve Space and Context
        let space = null;
        let order = null;
        let orderId = null;

        if (isInternal) {
            // EntityId is SpaceID
            const { fetchSpace } = await import('../../modules/pm_api.js?v=1000');
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

        // Filter out Account-specific items (they should only appear in the AccountActivitiesModal)
        items = items.filter(i => {
            const isAccount = i.is_account_level || i.pm_item_assignees?.some(a => a.role === 'account') || i.notes?.toLowerCase().includes('[account]');
            return !isAccount;
        });

        // 3. Calculate KPIs
        let kpis = calculateKPIs(items);

        // 4. Status badge (Only for Commesse)
        /* const normalized = normalizeStatus(order?.status_works);
        const statusConfig = STATUS_CONFIG[normalized] || { label: order?.status_works || 'N/A', color: '#64748b', bg: '#f1f5f9' }; */
        // Moved inside render to handle internal case

        // 5. Get PM user
        const pmUser = state.profiles?.find(p => p.id === space?.default_pm_user_ref);

        // 5b. Check permissions for Receipt Icon (Partner, Account, Amministrazione only)
        const userTags = (() => {
            let t = state.profile?.tags || [];
            if (typeof t === 'string') {
                try { t = JSON.parse(t); } catch { t = t.split(',').map(s => s.trim()); }
            }
            return Array.isArray(t) ? t : [];
        })();
        // Check if user has at least one of the allowed tags or is admin
        const canViewReceipt = state.profile?.role === 'admin' || userTags.some(t => ['Partner', 'Account', 'Amministrazione'].includes(t));

        const normalized = normalizeStatus(isInternal ? space?.status : order?.status_works);
        const statusConfig = STATUS_CONFIG[normalized] || STATUS_CONFIG['in_svolgimento'];

        // --- 7. RENDER MAIN CONTENT ---
        container.innerHTML = `
            <style>
                .project-hub {
                    width: auto;
                    margin: 0 -3rem !important; /* Only breakout sides, no top negative margin */
                    padding: 0 !important;
                }
                .project-hub-container {
                    display: flex;
                    width: 100%;
                    min-height: calc(100vh - 60px);
                    background: transparent;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    gap: 2.5rem;
                    padding: 1.5rem 2.5rem 2rem 2.5rem; /* Added top padding and refined sides */
                }
                .hub-sidebar {
                    width: 320px;
                    flex-shrink: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    position: sticky;
                    top: 1rem;
                    height: fit-content;
                    opacity: 1;
                    visibility: visible;
                }
                .hub-sidebar.collapsed {
                    width: 0;
                    margin-right: -2.5rem;
                    opacity: 0;
                    visibility: hidden;
                    pointer-events: none;
                }
                .hub-main-content {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }
                
                /* Mini Title when sidebar is collapsed */
                .hub-title-mini {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    opacity: 0;
                    max-width: 0;
                    overflow: hidden;
                    white-space: nowrap;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    margin-left: 0;
                }
                .hub-sidebar.collapsed + .hub-main-content .hub-title-mini {
                    opacity: 1;
                    max-width: 500px;
                    margin-left: 0.5rem;
                }

                .sidebar-toggle-btn {
                    width: 42px;
                    height: 42px;
                    border-radius: 12px;
                    background: white;
                    border: 1px solid var(--glass-border);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    color: var(--text-secondary);
                    flex-shrink: 0;
                    box-shadow: var(--shadow-sm);
                }
                .sidebar-toggle-btn:hover {
                    color: var(--brand-blue);
                    background: white;
                    border-color: var(--brand-blue);
                    box-shadow: var(--shadow-md);
                    transform: translateY(-1px);
                }

                /* MOBILE RESPONSIVENESS */
                @media (max-width: 1024px) {
                    .project-hub { margin: 0 !important; }
                    .project-hub-container { padding: 1rem !important; gap: 1rem !important; }
                    .hub-sidebar { display: none !important; }
                    .hub-sidebar.collapsed { display: none !important; }
                    .hub-main-content .hub-title-mini { opacity: 1 !important; max-width: none !important; margin-left: 0.5rem !important; overflow: visible !important; }
                }

                @media (max-width: 768px) {
                    .project-hub { margin: 0 -0.5rem !important; padding: 0 !important; width: calc(100% + 1rem) !important; overflow-x: hidden !important; }
                    .project-hub-container { 
                        flex-direction: column !important; 
                        padding: 0 !important; 
                        gap: 0 !important; 
                        min-height: auto !important;
                    }
                    
                    /* ===== MOBILE HEADER ===== */
                    #hub-header-bar {
                        padding: 0.5rem 0.75rem !important;
                        margin: 0 !important;
                        gap: 0 !important;
                        flex-wrap: wrap !important;
                    }
                    #hub-sidebar-toggle { display: none !important; }
                    /* Hide desktop-only action buttons row */
                    #hub-header-bar > div:last-child { display: none !important; }
                    /* Hide desktop PM avatars & divider */
                    .hub-pm-avatars-desktop, .hub-header-divider-desktop { display: none !important; }

                    /* --- Row 1: Badge + Title + Order icon --- */
                    /* The left div becomes full width */
                    #hub-header-bar > div:first-child {
                        width: 100% !important;
                        flex-wrap: wrap !important;
                        gap: 0.5rem !important;
                    }
                    .hub-title-mini {
                        display: flex !important;
                        align-items: center !important;
                        gap: 0.5rem !important;
                        flex: 1 !important;
                        min-width: 0 !important;
                        opacity: 1 !important;
                    }
                    .hub-title-badge { flex-shrink: 0; }
                    .hub-title-content { flex: 1; min-width: 0; }
                    .hub-title-main {
                        display: -webkit-box !important;
                        -webkit-box-orient: vertical !important;
                        -webkit-line-clamp: 2 !important;
                        overflow: hidden !important;
                        text-overflow: ellipsis !important;
                        font-size: 0.9rem !important;
                        font-weight: 700 !important;
                        line-height: 1.25 !important;
                        color: var(--text-primary) !important;
                        word-break: normal !important;
                        overflow-wrap: anywhere !important;
                    }
                    .hub-title-sub {
                        font-size: 0.7rem !important;
                        color: var(--brand-blue) !important;
                        margin-top: 1px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .hub-title-actions-mobile {
                        flex-shrink: 0 !important;
                        display: flex !important;
                        align-items: center !important;
                    }

                    /* --- Row 2: Status pill (compact) --- */
                    .custom-status-dropdown {
                        display: block !important;
                        width: 100% !important;
                        margin-top: 0.25rem !important;
                    }
                    .custom-status-dropdown #hub-status-trigger {
                        padding: 4px 10px !important;
                        font-size: 0.7rem !important;
                        border-radius: 8px !important;
                    }
                    .custom-status-dropdown #hub-status-trigger .material-icons-round {
                        font-size: 0.9rem !important;
                    }

                    /* ===== FAB ===== */
                    #mobile-fab {
                        display: flex !important;
                        position: fixed;
                        bottom: 1.5rem;
                        right: 1.5rem;
                        width: 56px;
                        height: 56px;
                        border-radius: 50%;
                        background: var(--brand-gradient);
                        color: white;
                        box-shadow: 0 8px 24px rgba(97, 74, 162, 0.4);
                        z-index: 1001;
                        align-items: center;
                        justify-content: center;
                        border: none;
                        cursor: pointer;
                        transition: transform 0.2s;
                    }
                    #mobile-fab:active { transform: scale(0.9); }

                    /* Dropdown above FAB */
                    #add-hub-dropdown {
                        position: fixed !important;
                        bottom: 5.5rem !important;
                        right: 1.5rem !important;
                        top: auto !important;
                        left: auto !important;
                        width: 220px !important;
                        z-index: 1002 !important;
                        transform-origin: bottom right !important;
                        animation: fabMenuPop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
                    }
                    @keyframes fabMenuPop {
                        from { opacity: 0; transform: scale(0.8) translateY(20px); }
                        to { opacity: 1; transform: scale(1) translateY(0); }
                    }

                    /* Tabs */
                    .hub-tabs { 
                        gap: 0.25rem !important; 
                        justify-content: flex-start !important; 
                        overflow-x: auto !important; 
                        overflow-y: hidden !important; 
                        -webkit-overflow-scrolling: touch !important;
                    }
                    .hub-tabs::-webkit-scrollbar { display: none !important; }
                    #mobile-risorse-tab { display: flex !important; }

                    /* Team strip & layout */
                    #mobile-team-strip { display: flex !important; overflow-y: hidden !important; }
                    .hub-main-content { gap: 0 !important; }
                    
                    /* Sticky tabs */
                    /* Fixed sticky tabs by removing overflow: hidden on parent */
                    #hub-content-card { 
                        overflow: visible !important;
                        border: none !important;
                        min-height: auto !important;
                        background: transparent !important;
                        box-shadow: none !important;
                    }
                    .hub-main-content { overflow: visible !important; }
                    .hub-tabs {
                        position: sticky !important;
                        top: 0 !important;
                        z-index: 100 !important;
                        background: rgba(255, 255, 255, 0.95) !important;
                        backdrop-filter: blur(10px) !important;
                        border-bottom: 1px solid var(--glass-border) !important;
                        margin: 0 !important;
                        width: 100% !important;
                    }
                    .hub-tab {
                        padding: 0.85rem 0.4rem !important;
                        font-size: 0.75rem !important;
                        gap: 0.3rem !important;
                    }
                    .hub-tab .material-icons-round { font-size: 1rem !important; }
                    
                    /* Tab content — ZERO padding, full width */
                    #hub-tab-content { 
                        padding: 0.5rem !important;
                        overflow: visible !important;
                        margin: 0 !important; 
                    }
                    
                    /* Glass card wrapper — flat */
                    .hub-main-content > .glass-card,
                    #hub-content-card {
                        border-radius: 0 !important;
                        border: none !important;
                        padding: 0 !important;
                        min-height: auto !important;
                        background: transparent !important;
                        box-shadow: none !important;
                    }
                    
                    /* Inline style overrides for tab container */
                    .hub-tabs {
                        padding: 0 0.25rem !important;
                    }
                    #hub-tab-content {
                        padding: 0 !important;
                    }
                }
            </style>

            <div class="project-hub animate-fade-in">
                <div class="project-hub-container" id="hub-main-layout">
                    
                    <!-- LEFT SIDEBAR -->
                    <div class="hub-sidebar" id="hub-left-sidebar">
                        
                        <!-- Redundant status removed from here -->

                        <!-- MAIN INFO CARD -->
                        <div class="glass-card" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem;">
                            
                            <div style="display: flex; align-items: flex-start; gap: 1.25rem;">
                                ${(() => {
                if (isInternal) {
                    return `
                                            <div style="width: 48px; height: 48px; border-radius: 12px; background: var(--brand-gradient); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(97, 74, 162, 0.2); color: white; flex-shrink: 0;">
                                                <span class="material-icons-round" style="font-size: 1.5rem;">${space?.is_cluster ? 'workspaces' : 'business_center'}</span>
                                            </div>
                                        `;
                } else {
                    const parts = (order?.order_number || '00-0000').split('-');
                    const yearPrefix = parts[0] || '00';
                    const seqNumber = parts[1] || '0000';
                    return `
                                            <div style="width: 48px; height: 48px; border-radius: 12px; background: var(--brand-gradient); display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(97, 74, 162, 0.2); color: white; line-height: 1; flex-shrink: 0;">
                                                <div style="font-size: 0.7rem; font-weight: 800; opacity: 0.8; margin-bottom: 1px;">${yearPrefix}</div>
                                                <div style="font-size: 0.95rem; font-weight: 900; letter-spacing: 0.05em;">${seqNumber}</div>
                                            </div>
                                        `;
                }
            })()}

                                <div style="min-width: 0; flex: 1;">
                                    <h1 style="font-size: 1.25rem; font-weight: 700; margin: 0; color: var(--text-primary); font-family: var(--font-titles); letter-spacing: -0.015em; line-height: 1.25;">
                                        ${isInternal ? (space?.name || 'Project Detail') : (order?.title || 'Dettaglio Commessa')}
                                    </h1>
                                    ${isInternal ? `
                                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.35rem;">
                                            <span style="font-size: 0.7rem; font-weight: 600; color: var(--text-secondary);">${space?.area || 'Generale'}</span>
                                            <span style="background: ${space?.is_cluster ? '#e0e7ff' : '#f1f5f9'}; color: ${space?.is_cluster ? '#4f46e5' : 'var(--text-secondary)'}; padding: 1px 6px; border-radius: 4px; font-size: 0.6rem; font-weight: 700; text-transform: uppercase;">${space?.is_cluster ? 'Cluster' : 'Progetto'}</span>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>

                            <!-- Subject Client (Integrated) -->
                            ${!isInternal ? `
                            <div style="border-top: 1px solid var(--glass-border); padding-top: 1.25rem;">
                                    <div style="color: var(--text-tertiary); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; margin-bottom: 0.75rem; letter-spacing: 0.05em;">Cliente</div>
                                    ${order?.clients ? `
                                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                                            <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(59, 130, 246, 0.06); display: flex; align-items: center; justify-content: center; color: var(--brand-blue); flex-shrink: 0; border: 1px solid rgba(59, 130, 246, 0.1);">
                                                <span class="material-icons-round" style="font-size: 1.1rem;">business</span>
                                            </div>
                                            <div style="min-width: 0; flex: 1;">
                                                <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${order.clients.business_name}">
                                                    ${order.clients.client_code || order.clients.business_name}
                                                </div>
                                            </div>
                                        </div>
                                    ` : ''}
                            </div>
                            ` : ''}

                            <!-- Actions moved to right header -->
                        </div>

                        <!-- Team & Members -->
                        <div class="glass-card" style="padding: 1.5rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                                <div style="color: var(--text-tertiary); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">${isInternal ? 'Responsabili' : 'Team Commessa'}</div>
                                <div style="position: relative;">
                                    <button id="add-space-pm-btn" style="width: 24px; height: 24px; border-radius: 50%; color: var(--brand-blue); background: white; border: 1px dashed var(--brand-blue); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='var(--brand-blue)'; this.style.color='white'">
                                        <span class="material-icons-round" style="font-size: 1rem;">add</span>
                                    </button>
                                    <div id="space-pm-picker" class="hidden glass-card" style="position: absolute; top: 130%; left: 0; width: 280px; z-index: 1000; max-height: 320px; overflow-y: auto; padding: 8px; box-shadow: var(--shadow-xl);"></div>
                                </div>
                            </div>
                            <div id="space-pms-list" style="display: flex; flex-direction: column; gap: 0.75rem;">
                                ${(() => {
                const pmList = isInternal ? spaceAssignees.filter(a => ['pm', 'manager', 'admin'].includes(a.role)) : spaceAssignees;
                return pmList.map(a => {
                    const collab = state.collaborators?.find(c => (a.user_ref && c.user_id === a.user_ref) || (a.collaborator_ref && c.id === a.collaborator_ref));
                    const userName = collab ? (collab.full_name || `${collab.first_name} ${collab.last_name}`) : (a.user?.full_name || 'Utente');
                    return `
                                        <div class="user-pill-full animate-slide-in" style="display: flex; align-items: center; justify-content: space-between; background: white; padding: 10px 12px; border-radius: 14px; border: 1px solid var(--glass-border); box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                                            <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                                                ${renderAvatar(collab || a.user || { full_name: userName }, { size: 36, borderRadius: '10px' })}
                                                <div style="min-width: 0;">
                                                    <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${userName}</div>
                                                    <div style="font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 700;">${a.role === 'pm' ? (isInternal ? 'Responsabile' : 'Project Manager') : (isInternal ? 'Responsabile' : 'Collaboratore')}</div>
                                                </div>
                                            </div>
                                            <button class="remove-space-pm-btn" data-id="${a.id}" style="background:none; border:none; padding:4px; cursor:pointer; color: #cbd5e1; transition: color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#cbd5e1'">
                                                <span class="material-icons-round" style="font-size: 1.1rem;">close</span>
                                            </button>
                                        </div>
                                    `;
                }).join('');
            })()}
                                ${(() => {
                const pmList = isInternal ? spaceAssignees.filter(a => ['pm', 'manager', 'admin'].includes(a.role)) : spaceAssignees;
                return pmList.length === 0 ? '<div style="text-align: center; color: var(--text-tertiary); font-size: 0.8rem; padding: 1.5rem; border: 1px dashed var(--glass-border); border-radius: 12px; background: var(--surface-1);">Nessun responsabile assegnato</div>' : '';
            })()}
                            </div>

                            ${isInternal ? `
                                <!-- Team Members (isInternal only) -->
                                <div style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--surface-2);">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                                        <div style="color: var(--text-tertiary); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Team</div>
                                        <div style="position: relative;">
                                            <button id="add-space-member-btn" style="width: 24px; height: 24px; border-radius: 50%; color: #64748b; background: white; border: 1px dashed #64748b; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#64748b'; this.style.color='white'" onmouseout="this.style.background='white'; this.style.color='#64748b'">
                                                <span class="material-icons-round" style="font-size: 1rem;">group_add</span>
                                            </button>
                                            <div id="space-member-picker" class="hidden glass-card" style="position: absolute; top: 130%; right: 0; left: auto; width: 280px; z-index: 1000; max-height: 320px; overflow-y: auto; padding: 8px; box-shadow: var(--shadow-xl);"></div>
                                        </div>
                                    </div>
                                    <div id="space-members-list" style="display: flex; flex-direction: column; gap: 0.75rem;">
                                        ${(() => {
                    const memberList = spaceAssignees.filter(a => !['pm', 'manager', 'admin'].includes(a.role));
                    return memberList.map(a => {
                        const collab = state.collaborators?.find(c => (a.user_ref && c.user_id === a.user_ref) || (a.collaborator_ref && c.id === a.collaborator_ref));
                        const userName = collab ? (collab.full_name || `${collab.first_name} ${collab.last_name}`) : (a.user?.full_name || 'Utente');
                        return `
                                            <div class="user-pill-full animate-slide-in" style="display: flex; align-items: center; justify-content: space-between; background: white; padding: 10px 12px; border-radius: 14px; border: 1px solid var(--glass-border); box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                                                <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                                                    ${renderAvatar(collab || a.user || { full_name: userName }, { size: 36, borderRadius: '10px' })}
                                                    <div style="min-width: 0;">
                                                        <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${userName}</div>
                                                        <div style="font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 700;">Membro</div>
                                                    </div>
                                                </div>
                                                <button class="remove-space-pm-btn" data-id="${a.id}" style="background:none; border:none; padding:4px; cursor:pointer; color: #cbd5e1; transition: color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#cbd5e1'">
                                                    <span class="material-icons-round" style="font-size: 1.1rem;">close</span>
                                                </button>
                                            </div>
                                        `;
                    }).join('') || '<div style="text-align: center; color: var(--text-tertiary); font-size: 0.8rem; padding: 1.5rem; border: 1px dashed var(--glass-border); border-radius: 12px; background: var(--surface-1);">Nessun membro nel team</div>';
                })()}
                                    </div>
                                </div>
                            ` : ''}

                            ${!isInternal && order ? (() => {
                const assignments = state.assignments?.filter(a => a.order_id === order.id) || [];
                if (assignments.length === 0) return '';
                return `
                                    <div style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--surface-2);">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                            <div style="color: var(--text-tertiary); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Incarichi Esterni</div>
                                            <a href="#order-detail/${orderId}" style="font-size: 0.65rem; color: var(--brand-blue); text-decoration: none; font-weight: 700;">Gestisci</a>
                                        </div>
                                        <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                                            ${assignments.map(a => {
                    const collab = state.collaborators?.find(c => c.id === a.collaborator_id);
                    return `
                                                    <div style="display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 10px; background: var(--surface-1); border: 1px solid var(--glass-border);">
                                                        ${renderAvatar(collab || { full_name: 'Collab' }, { size: 28, borderRadius: '6px' })}
                                                        <div style="min-width: 0; flex: 1;">
                                                            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${collab?.full_name || 'Incaricato'}</div>
                                                            <div style="font-size: 0.6rem; color: var(--text-tertiary);">${a.description || 'Incarico'}</div>
                                                        </div>
                                                        <div style="width: 8px; height: 8px; border-radius: 50%; background: ${a.status === 'completato' ? '#10b981' : '#f59e0b'};"></div>
                                                    </div>
                                                `;
                }).join('')}
                                        </div>
                                    </div>
                                `;
            })() : ''}
                        </div>
                    </div>

                    <!-- MAIN CONTENT -->
                    <div class="hub-main-content">
                        
                        <!-- Header Bar (Status & Actions Combined) -->
                        <div id="hub-header-bar" style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 0.5rem;">
                            
                            <!-- Left: Sidebar Toggle, Mini Title & Status -->
                            <div style="display: flex; align-items: center; gap: 1rem; min-width: 0;">
                                <button id="hub-sidebar-toggle" class="sidebar-toggle-btn" title="Toggle Sidebar">
                                    <span class="material-icons-round">menu_open</span>
                                </button>

                                <!-- Mini Project Info -->
                                <div class="hub-title-mini">
                                    <div class="hub-title-badge">
                                        ${(() => {
                if (isInternal) {
                    return `<div style="padding: 4px 8px; border-radius: 6px; background: var(--brand-gradient); box-shadow: 0 4px 12px rgba(97, 74, 162, 0.2); color: white; font-size: 0.65rem; font-weight: 800;">${space?.is_cluster ? '⬡' : 'INT'}</div>`;
                } else {
                    const parts = (order?.order_number || '00-0000').split('-');
                    const yPart = parts[0] || '00';
                    const nPart = parts[1] || '0000';
                    return `
                                                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3px 6px; border-radius: 6px; background: var(--brand-gradient); box-shadow: 0 4px 12px rgba(97, 74, 162, 0.2); color: white; line-height: 1;">
                                                        <span style="font-size: 0.55rem; font-weight: 800; opacity: 0.8; margin-bottom: 1px;">${yPart}</span>
                                                        <span style="font-size: 0.7rem; font-weight: 900;">${nPart}</span>
                                                    </div>
                                                `;
                }
            })()}
                                    </div>
                                    
                                    <div class="hub-title-content">
                                        <div class="hub-title-main">
                                            ${isInternal ? (space?.name || 'Project') : (order?.title || 'Commessa')}
                                        </div>
                                        ${!isInternal && order?.clients ? `
                                            <div class="hub-title-sub">
                                                ${order.clients.client_code || order.clients.business_name}
                                            </div>
                                        ` : ''}
                                        ${isInternal ? `
                                            <div class="hub-title-sub">
                                                ${space?.area || 'Generale'} · ${space?.is_cluster ? 'Cluster' : 'Progetto'}
                                            </div>
                                        ` : ''}
                                    </div>

                                    <!-- Mobile Title Actions (Order Icon) -->
                                    <div class="hub-title-actions-mobile">
                                        ${!isInternal && canViewReceipt ? `
                                            <a href="#order-detail/${orderId}" title="Dettaglio Ordine" style="color: var(--text-secondary); text-decoration: none;">
                                                <span class="material-icons-round" style="font-size: 1.6rem;">receipt_long</span>
                                            </a>
                                        ` : ''}
                                    </div>

                                    <!-- PM Avatars Group (Desktop only) -->
                                    <div class="hub-pm-avatars-desktop" style="display: flex; align-items: center; margin-left: 0.75rem; flex-shrink: 0;">
                                        ${spaceAssignees.filter(a => a.role === 'pm').map((pm, idx) => {
                const collab = state.collaborators?.find(c => (pm.user_ref && c.user_id === pm.user_ref) || (pm.collaborator_ref && c.id === pm.collaborator_ref));
                return `
                                                <div style="margin-left: ${idx === 0 ? '0' : '-8px'}; border: 2px solid white; border-radius: 50%; box-shadow: var(--shadow-sm); z-index: ${10 - idx};">
                                                    ${renderAvatar(collab || pm.user || { full_name: 'PM' }, { size: 28, borderRadius: '50%' })}
                                                </div>
                                            `;
            }).join('')}
                                    </div>

                                    <div class="hub-header-divider-desktop" style="width: 1px; height: 28px; background: var(--glass-border); margin: 0 0.5rem; flex-shrink: 0;"></div>
                                </div>

                                <div class="custom-status-dropdown" style="position: relative;">
                                    <button id="hub-status-trigger" style="
                                        background: ${statusConfig.bg}; color: ${statusConfig.color};
                                        padding: 7px 16px; border: 1px solid transparent; border-radius: 12px;
                                        font-size: 0.8rem; font-weight: 800; display: flex; align-items: center; gap: 8px;
                                        cursor: pointer; transition: all 0.2s; box-shadow: var(--shadow-sm);
                                    ">
                                        <span class="material-icons-round" style="font-size: 1.1rem;">${statusConfig.icon}</span>
                                        ${statusConfig.label}
                                        <span class="material-icons-round" style="font-size: 0.9rem; opacity: 0.7;">expand_more</span>
                                    </button>
                                    <div id="hub-status-menu" class="hidden glass-card" style="position: absolute; top: calc(100% + 8px); left: 0; min-width: 200px; z-index: 1000; padding: 6px; box-shadow: var(--shadow-xl);">
                                        <div style="padding: 10px 12px 6px; font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--surface-2); margin-bottom: 4px;">Stato Lavori</div>
                                        ${Object.entries(STATUS_CONFIG).map(([key, cfg]) => `
                                            <div class="status-option ${normalized === key ? 'active' : ''}" data-status="${key}" style="
                                                padding: 8px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 0.8rem; font-weight: 600;
                                                color: ${normalized === key ? cfg.color : 'var(--text-secondary)'}; background: ${normalized === key ? cfg.bg : 'transparent'}; transition: all 0.2s;
                                            " onmouseover="this.style.background='${cfg.bg}'; this.style.color='${cfg.color}'" onmouseout="if(!this.classList.contains('active')){this.style.background='transparent'; this.style.color='var(--text-secondary)'}">
                                                <span class="material-icons-round" style="font-size: 1.1rem;">${cfg.icon}</span>
                                                ${cfg.label}
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>

                            <!-- Right: Global Actions -->
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <!-- Risorse -->
                                <div style="position: relative;">
                                    <button id="open-resources-btn" 
                                            style="padding: 7px 16px; border-radius: 12px; display: flex; align-items: center; gap: 6px; background: white; border: 1px solid var(--glass-border); cursor: pointer; transition: all 0.2s; box-shadow: var(--shadow-sm);"
                                            onmouseover="this.style.borderColor='var(--brand-blue)'; this.style.background='rgba(59, 130, 246, 0.02)'"
                                            onmouseout="this.style.borderColor='var(--glass-border)'; this.style.background='white'">
                                        <span class="material-icons-round" style="font-size: 1.1rem; color: var(--brand-blue);">cloud_queue</span>
                                        <span style="font-weight: 700; color: var(--text-primary); font-size: 0.75rem;">Risorse</span>
                                        ${space?.cloud_links?.length > 0 ? `<span class="badge" style="background: var(--brand-blue); color: white; padding: 1px 5px; font-size: 0.6rem; border-radius: 8px;">${space.cloud_links.length}</span>` : ''}
                                    </button>
                                    <div id="resources-popover" class="hidden glass-card" style="position: absolute; top: calc(100% + 8px); right: 0; width: 280px; z-index: 1000; padding: 1rem; text-align: left; box-shadow: var(--shadow-xl); border: 1px solid var(--glass-border);">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                                            <h3 style="font-size: 0.85rem; font-weight: 700; margin: 0; color: var(--text-primary);">Risorse Cloud</h3>
                                            <button id="close-resources-btn" style="background: none; border: none; cursor: pointer; color: var(--text-tertiary);"><span class="material-icons-round" style="font-size: 1.1rem;">close</span></button>
                                        </div>
                                        <div id="space-cloud-links-container"></div>
                                    </div>
                                </div>

                                <!-- Nuovo Elemento -->
                                <div style="position: relative;">
                                    <button id="add-new-hub-btn" 
                                            style="padding: 7px 18px; border-radius: 12px; display: flex; align-items: center; gap: 8px; background: var(--brand-gradient); border: none; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(97, 74, 162, 0.15); color: white;"
                                            onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 16px rgba(97, 74, 162, 0.25)'"
                                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(97, 74, 162, 0.15)'">
                                        <span class="material-icons-round" style="font-size: 1.25rem;">add_circle</span>
                                        <span style="font-weight: 700; font-size: 0.8rem;">Nuovo Elemento</span>
                                    </button>
                                </div>

                                <!-- Ordine (Link) -->
                                ${!isInternal && canViewReceipt ? `
                                <a href="#order-detail/${orderId}" title="Dettaglio Ordine" 
                                   style="padding: 7px 16px; border-radius: 12px; background: white; border: 1px solid var(--glass-border); color: var(--text-secondary); display: flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s; box-shadow: var(--shadow-sm); text-decoration: none;"
                                   onmouseover="this.style.borderColor='var(--brand-blue)'; this.style.color='var(--brand-blue)'; this.style.background='rgba(59, 130, 246, 0.02)'"
                                   onmouseout="this.style.borderColor='var(--glass-border)'; this.style.color='var(--text-secondary)'; this.style.background='white'">
                                    <span class="material-icons-round" style="font-size: 1.1rem;">receipt_long</span>
                                    <span style="font-weight: 700; font-size: 0.75rem;">Ordine</span>
                                </a>
                                ` : ''}
                            </div>
                        </div>

                        <!-- Mobile Team Strip (hidden on desktop) -->
                        <div id="mobile-team-strip" style="display: none; align-items: center; gap: 0; padding: 0.35rem 0.5rem; overflow-x: auto;">
                            <span style="font-size: 0.6rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; margin-right: 0.5rem; flex-shrink: 0;">Team</span>
                            <div style="display: flex; align-items: center;" id="team-avatars-row">
                                ${spaceAssignees.map((a, idx) => {
                const collab = state.collaborators?.find(c => (a.user_ref && c.user_id === a.user_ref) || (a.collaborator_ref && c.id === a.collaborator_ref));
                const person = collab || a.user || { full_name: a.role || 'Membro' };
                const name = person.full_name || person.business_name || 'Membro';
                const isPM = a.role === 'pm';
                return `
                                    <div class="team-avatar-item" data-name="${name}" data-role="${a.role || ''}" style="margin-left: ${idx === 0 ? '0' : '-6px'}; border: 2px solid white; border-radius: 50%; cursor: pointer; z-index: ${20 - idx}; position: relative; transition: transform 0.15s;">
                                        ${renderAvatar(person, { size: 26, borderRadius: '50%' })}
                                    </div>
                                `;
            }).join('')}
                            </div>
                            ${(() => {
                const assignments = !isInternal && order ? (state.assignments?.filter(a => a.order_id === order.id) || []) : [];
                if (assignments.length === 0) return '';
                return `
                            <div style="width: 1px; height: 20px; background: var(--glass-border); margin: 0 0.5rem; flex-shrink: 0;"></div>
                            <span style="font-size: 0.55rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; margin-right: 0.35rem; flex-shrink: 0;">Ext</span>
                            <div style="display: flex; align-items: center;">
                                ${assignments.map((a, idx) => {
                    const collab = state.collaborators?.find(c => c.id === a.collaborator_id);
                    const name = collab?.full_name || 'Incaricato';
                    const desc = a.description || 'Incarico';
                    return `
                                    <div class="team-avatar-item" data-name="${name} — ${desc}" data-role="ext" style="margin-left: ${idx === 0 ? '0' : '-6px'}; border: 2px solid white; border-radius: 50%; cursor: pointer; z-index: ${20 - idx}; position: relative;">
                                        ${renderAvatar(collab || { full_name: name }, { size: 26, borderRadius: '50%' })}
                                    </div>
                                    `;
                }).join('')}
                            </div>
                `;
            })()}
                        </div>

                        <div id="hub-content-card" class="glass-card" style="display: flex; flex-direction: column; min-height: 700px; flex: 1; overflow: hidden; border: 1px solid var(--glass-border);">
                            <div class="hub-tabs" style="display: flex; background: rgba(255,255,255,0.7); border-bottom: 1px solid var(--glass-border); padding: 0 1.25rem; gap: 0.5rem; backdrop-filter: blur(10px); position: sticky; top: 0; z-index: 10;">
                                <button class="hub-tab active" data-tab="overview"><span class="material-icons-round">dashboard</span>Overview</button>
                                <button class="hub-tab" data-tab="feed"><span class="material-icons-round">history</span>Feed</button>
                                <button class="hub-tab" data-tab="board"><span class="material-icons-round">account_tree</span>Board</button>
                                <button class="hub-tab" data-tab="appointments"><span class="material-icons-round">event</span>Appuntamenti</button>
                                ${space?.is_cluster ? `<button class="hub-tab" data-tab="projects"><span class="material-icons-round">lan</span>Progetti</button>` : ''}
                                <button class="hub-tab" data-tab="docs"><span class="material-icons-round">description</span>Documenti</button>
                                
                                <!-- Mobile Risorse Tab Item -->
                                <button id="mobile-risorse-tab" class="hub-tab" data-tab="risorse" style="display: none; border: 1px solid transparent; color: var(--brand-blue);">
                                    <span class="material-icons-round">cloud_queue</span>Risorse
                                </button>
                            </div>
                            <div id="hub-tab-content" style="flex: 1; min-height: 400px; background: transparent; padding: 1.25rem;">
                                <!-- Dynamic content -->
                                <div style="display:flex; align-items:center; justify-content:center; height:300px; color:var(--text-tertiary);">
                                    <span class="loader"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Floating Action Button (FAB) for mobile -->
                <button id="mobile-fab" style="display: none;">
                    <span class="material-icons-round" style="font-size: 1.7rem;">add</span>
                </button>

                <!-- NEW Dropdown Menu (Moved here so it's not inside hidden header on mobile) -->
                <div id="add-hub-dropdown" class="hidden glass-card" style="position: absolute; top: calc(100% + 8px); right: 0; width: 180px; z-index: 1000; padding: 0.4rem; box-shadow: var(--shadow-xl); border: 1px solid var(--glass-border);">
                    ${space?.is_cluster ? `
                    <div class="dropdown-item" id="add-project-btn" style="display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.6rem 0.75rem; border-radius: 8px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.03)'" onmouseout="this.style.background='transparent'">
                        <span class="material-icons-round" style="color: var(--brand-blue); font-size: 1.2rem;">lan</span>
                        <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary);">Progetti</div>
                    </div>
                    <div style="height: 1px; background: var(--surface-2); margin: 4px 8px;"></div>
                    ` : ''}
                    <div class="dropdown-item" id="add-activity-btn" style="display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.6rem 0.75rem; border-radius: 8px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.03)'" onmouseout="this.style.background='transparent'">
                        <span class="material-icons-round" style="color: #f59e0b; font-size: 1.2rem;">folder</span>
                        <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary);">Attività</div>
                    </div>
                    <div class="dropdown-item" id="add-task-btn" style="display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.6rem 0.75rem; border-radius: 8px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.03)'" onmouseout="this.style.background='transparent'">
                        <span class="material-icons-round" style="color: #3b82f6; font-size: 1.2rem;">check_circle_outline</span>
                        <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary);">Task</div>
                    </div>
                    ${!isInternal ? `
                    <div style="height: 1px; background: var(--surface-2); margin: 4px 8px;"></div>
                    <div class="dropdown-item" id="add-appointment-btn" style="display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.6rem 0.75rem; border-radius: 8px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.03)'" onmouseout="this.style.background='transparent'">
                        <span class="material-icons-round" style="color: #8b5cf6; font-size: 1.2rem;">event</span>
                        <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary);">Appuntamento</div>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <style>
                .hub-tab {
                    display: flex; align-items: center; gap: 0.5rem; padding: 1.15rem 0.5rem; border: none; background: none; cursor: pointer;
                    font-size: 0.8rem; font-weight: 600; color: var(--text-tertiary); border-bottom: 2px solid transparent; transition: all 0.2s; white-space: nowrap;
                    margin-bottom: -1px;
                }
                .hub-tab:hover { color: var(--text-primary); }
                .hub-tab.active { color: var(--brand-blue); border-bottom-color: var(--brand-blue); font-weight: 700; }
                .hub-tab .material-icons-round { font-size: 1.1rem; }
                
                .user-pill-full { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
                .user-pill-full:hover { transform: translateX(5px); border-color: var(--brand-blue) !important; background: white !important; }

                #hub-tab-content > .animate-fade-in { animation-duration: 0.4s; }

                .hub-tabs {
                    overflow-x: auto !important;
                    -webkit-overflow-scrolling: touch;
                }
                .hub-tabs::-webkit-scrollbar { display: none; }
                
                @media (max-width: 1200px) {
                    /* Removed conflicting global override */
                }
                @media (max-width: 768px) {
                    /* All mobile overrides are in the first style block above */
                    #hub-tab-content { padding: 0 !important; margin: 0 !important; }
                    .hub-overview { width: 100% !important; margin: 0 !important; padding: 0 !important; }
                }
            </style>
        `;


        // Store context for child components
        const spaceName = isInternal ? (space?.name || 'Project') : (order?.title || 'Commessa');
        window._hubContext = { order, space, spaceId, items, kpis, orderId, spaceName };

        // 7. Tab Logic
        const tabContent = container.querySelector('#hub-tab-content');
        const tabs = container.querySelectorAll('.hub-tab');

        const renderTab = async (tabName) => {
            tabs.forEach(t => t.classList.remove('active'));
            container.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

            // Reset padding by default, specific tabs might override
            tabContent.style.padding = '1.5rem';

            switch (tabName) {
                case 'overview':
                    const { renderHubOverview } = await import('./components/hub_overview.js?v=1210');
                    renderHubOverview(tabContent, items, kpis, spaceId);
                    break;
                case 'feed':
                    const { renderActivityLog } = await import('./components/activity_log.js?v=1020');
                    renderActivityLog(tabContent, { spaceId });
                    break;
                case 'board':
                    const { renderHubTree } = await import('./components/hub_tree.js?v=1320');
                    renderHubTree(tabContent, items, space, spaceId);
                    break;
                case 'list':
                    const { renderHubList } = await import('./components/hub_list.js?v=1020');
                    renderHubList(tabContent, items, space, spaceId);
                    break;
                case 'incarichi':
                    if (!isInternal && order) renderIncarichiTab(tabContent, order);
                    else tabContent.innerHTML = '<p style="padding:2rem;">Non disponibile per progetti interni.</p>';
                    break;
                case 'appointments':
                    const { renderHubAppointments } = await import('./components/hub_appointments.js?v=1020');
                    const refId = isInternal ? spaceId : orderId;
                    const refType = isInternal ? 'space' : 'order';

                    let ap = await fetchAppointments(refId, refType);
                    // Filter out Account-specific appointments
                    ap = ap.filter(appt => {
                        const isAccount = appt.is_account_level || appt.appointment_internal_participants?.some(p => p.role === 'account') || appt.note?.toLowerCase().includes('[account]');
                        return !isAccount;
                    });
                    const types = await fetchAppointmentTypes();
                    renderHubAppointments(tabContent, ap, types, refId, refType);
                    break;
                case 'risorse':
                    tabContent.innerHTML = `
                        <div class="animate-fade-in" style="background: white; border-radius: 12px; padding: 1.5rem; min-height: 300px;">
                            <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1.5rem; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                                <span class="material-icons-round" style="color: var(--brand-blue);">cloud_queue</span>
                                Risorse Cloud
                            </h3>
                            <div id="mobile-cloud-links-tab-container"></div>
                        </div>
                    `;
                    new CloudLinksManager(
                        tabContent.querySelector('#mobile-cloud-links-tab-container'),
                        space.cloud_links || [],
                        async (newLinks) => {
                            try {
                                await updateSpaceCloudLinks(spaceId, newLinks);
                                space.cloud_links = newLinks;
                                // Update desktop badge
                                const resourcesBtn = container.querySelector('#open-resources-btn');
                                if (resourcesBtn) {
                                    const badge = resourcesBtn.querySelector('.badge');
                                    if (newLinks.length > 0) {
                                        if (badge) badge.textContent = newLinks.length;
                                        else {
                                            const newBadge = document.createElement('span');
                                            newBadge.className = 'badge';
                                            newBadge.style.cssText = 'background: var(--brand-blue); color: white; padding: 2px 6px; font-size: 0.7rem; border-radius: 10px;';
                                            newBadge.textContent = newLinks.length;
                                            resourcesBtn.appendChild(newBadge);
                                        }
                                    } else if (badge) badge.remove();
                                }
                            } catch (e) {
                                console.error(e);
                                showGlobalAlert('Errore salvataggio link', 'error');
                            }
                        }
                    );
                    break;
                case 'docs':
                    tabContent.style.padding = '0';
                    const { renderDocsView } = await import('../docs/DocsView.js');
                    renderDocsView(tabContent, spaceId);
                    break;
                case 'projects':
                    if (space?.is_cluster) {
                        const { renderClusterProjects } = await import('./components/cluster_projects.js');
                        renderClusterProjects(tabContent, spaceId);
                    } else {
                        tabContent.innerHTML = '<p style="padding:2rem;">Non disponibile per questo spazio.</p>';
                    }
                    break;
                default:
                    tabContent.innerHTML = '<p style="padding:2rem;">Tab non implementata.</p>';
            }
        };

        tabs.forEach(tab => {
            tab.addEventListener('click', () => renderTab(tab.dataset.tab));
        });

        // 8. Add Activity/Task buttons (Dropdown Logic)

        // Toggle Sidebar Logic
        const toggleBtn = container.querySelector('#hub-sidebar-toggle');
        const sidebar = container.querySelector('#hub-left-sidebar');

        if (toggleBtn && sidebar) {
            toggleBtn.addEventListener('click', () => {
                const isNowCollapsed = sidebar.classList.toggle('collapsed');
                toggleBtn.classList.toggle('collapsed');
                toggleBtn.innerHTML = isNowCollapsed ?
                    '<span class="material-icons-round">menu</span>' :
                    '<span class="material-icons-round">menu_open</span>';
            });
        }

        // Mobile Team Avatar Tap-to-reveal
        container.querySelectorAll('.team-avatar-item').forEach(avatar => {
            avatar.addEventListener('click', (e) => {
                e.stopPropagation();
                // Remove any existing tooltip
                const existing = container.querySelector('.team-name-tooltip');
                if (existing) existing.remove();

                const name = avatar.dataset.name;
                const role = avatar.dataset.role;
                const tooltip = document.createElement('div');
                tooltip.className = 'team-name-tooltip';
                tooltip.style.cssText = 'position: absolute; bottom: -28px; left: 50%; transform: translateX(-50%); background: var(--text-primary); color: white; padding: 3px 8px; border-radius: 6px; font-size: 0.65rem; font-weight: 700; white-space: nowrap; z-index: 100; box-shadow: var(--shadow-md); pointer-events: none;';
                tooltip.textContent = name + (role === 'pm' ? ' (PM)' : '');
                avatar.style.position = 'relative';
                avatar.appendChild(tooltip);
                setTimeout(() => tooltip.remove(), 2000);
            });
        });

        // Resources Popover Logic
        const resourcesBtn = container.querySelector('#open-resources-btn');
        const resourcesPopover = container.querySelector('#resources-popover');
        const closeResourcesBtn = container.querySelector('#close-resources-btn');

        if (resourcesBtn && resourcesPopover) {
            // Initialize Manager
            new CloudLinksManager(
                container.querySelector('#space-cloud-links-container'),
                space.cloud_links || [],
                async (newLinks) => {
                    try {
                        await updateSpaceCloudLinks(spaceId, newLinks);
                        // Update local state
                        space.cloud_links = newLinks;
                        // Update badge
                        const badge = resourcesBtn.querySelector('.badge');
                        if (newLinks.length > 0) {
                            if (badge) {
                                badge.textContent = newLinks.length;
                            } else {
                                const newBadge = document.createElement('span');
                                newBadge.className = 'badge';
                                newBadge.style.cssText = 'background: var(--brand-blue); color: white; padding: 2px 6px; font-size: 0.7rem; border-radius: 10px;';
                                newBadge.textContent = newLinks.length;
                                resourcesBtn.appendChild(newBadge);
                            }
                        } else {
                            if (badge) badge.remove();
                        }
                    } catch (e) {
                        console.error(e);
                        showGlobalAlert('Errore salvataggio link', 'error');
                    }
                }
            );

            resourcesBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                resourcesPopover.classList.toggle('hidden');
            });

            closeResourcesBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                resourcesPopover.classList.add('hidden');
            });

            document.addEventListener('click', (e) => {
                if (!resourcesBtn.contains(e.target) && !resourcesPopover.contains(e.target)) {
                    resourcesPopover.classList.add('hidden');
                }
            });
        }

        const addHubBtn = container.querySelector('#add-new-hub-btn');
        const addHubDropdown = container.querySelector('#add-hub-dropdown');

        if (addHubBtn && addHubDropdown) {
            const toggleDropdown = (e) => {
                e.stopPropagation();
                addHubDropdown.classList.toggle('hidden');
            };

            addHubBtn.addEventListener('click', toggleDropdown);

            // Add listener to FAB too
            const mobileFab = container.querySelector('#mobile-fab');
            if (mobileFab) mobileFab.addEventListener('click', toggleDropdown);

            document.addEventListener('click', (e) => {
                const isFab = mobileFab && mobileFab.contains(e.target);
                if (!addHubBtn.contains(e.target) && !addHubDropdown.contains(e.target) && !isFab) {
                    addHubDropdown.classList.add('hidden');
                }
            });

            container.querySelector('#add-project-btn')?.addEventListener('click', async () => {
                addHubDropdown.classList.add('hidden');
                const { openNewProjectModal } = await import('./components/cluster_projects.js?v=2000');
                openNewProjectModal(spaceId, () => {
                    const activeTab = Array.from(tabs).find(t => t.classList.contains('active'))?.dataset.tab;
                    if (activeTab === 'projects') renderTab('projects');
                });
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
                import('./components/hub_appointment_drawer.js?v=1000').then(mod => {
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

                const { fetchProjectItems, fetchSpace, fetchSpaceAssignees } = await import('../../modules/pm_api.js?v=1000');

                try {
                    console.log('[ProjectHub] Fetching fresh data to sync...');
                    const [newSpace, newItems, newAssignees] = await Promise.all([
                        fetchSpace(spaceId),
                        fetchProjectItems(spaceId),
                        fetchSpaceAssignees(spaceId)
                    ]);

                    console.log('[ProjectHub] Sync complete. Items:', newItems?.length);

                    // Update local references
                    items = (newItems || []).filter(i => {
                        const isAccount = i.pm_item_assignees?.some(a => a.role === 'account') || i.notes?.toLowerCase().includes('[account]');
                        return !isAccount;
                    });
                    space = newSpace;
                    spaceAssignees = newAssignees || [];
                    kpis = calculateKPIs(items);

                    // Update Team icons in left column
                    const pmsList = container.querySelector('#space-pms-list');
                    if (pmsList) {
                        pmsList.innerHTML = spaceAssignees.map(a => {
                            const collab = state.collaborators?.find(c => (a.user_ref && c.user_id === a.user_ref) || (a.collaborator_ref && c.id === a.collaborator_ref));
                            const userName = collab ? (collab.full_name || `${collab.first_name} ${collab.last_name}`) : (a.user?.full_name || 'Utente');
                            return `
                                <div class="user-pill-full" style="display: flex; align-items: center; justify-content: space-between; background: white; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--glass-border); box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                                    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                                        ${renderAvatar(collab || a.user || { full_name: userName }, { size: 32, borderRadius: '8px' })}
                                        <div style="min-width: 0;">
                                            <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${userName}</div>
                                            <div style="font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600;">${a.role === 'pm' ? 'Project Manager' : 'Collaboratore'}</div>
                                        </div>
                                    </div>
                                    <span class="material-icons-round remove-space-pm-btn" data-id="${a.id}" style="font-size: 1.1rem; cursor: pointer; color: #cbd5e1; transition: color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#cbd5e1'">close</span>
                                </div>
                            `;
                        }).join('') || '<div style="text-align: center; color: var(--text-tertiary); font-size: 0.8rem; padding: 1rem; border: 1px dashed var(--glass-border); border-radius: 10px;">Nessun membro assegnato</div>';
                    }

                    // Re-attach remove PM listeners if needed or use delegation (better)
                    // For simplicity, we assume delegation is handled or we re-trigger some setup

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

        // Team Member Picker (isInternal only)
        if (isInternal) {
            const handleTeamMemberEvents = async (e) => {
                const addBtn = e.target.closest('#add-space-member-btn');
                if (addBtn) {
                    e.stopPropagation();
                    const pickerContainer = addBtn.parentElement;
                    const memberPicker = pickerContainer.querySelector('#space-member-picker');
                    if (memberPicker) {
                        if (memberPicker.classList.contains('hidden')) {
                            document.querySelectorAll('#space-member-picker:not(.hidden)').forEach(p => p.classList.add('hidden'));
                            memberPicker.innerHTML = renderPmOptions();
                            memberPicker.classList.remove('hidden');
                        } else {
                            memberPicker.classList.add('hidden');
                        }
                    }
                    return;
                }
                // Selection in member picker
                const memberPicker = e.target.closest('#space-member-picker');
                if (memberPicker) {
                    const opt = e.target.closest('.user-option-space');
                    if (opt) {
                        e.stopPropagation();
                        const uid = opt.dataset.uid;
                        const collabId = opt.dataset.collabId;
                        memberPicker.classList.add('hidden');
                        try {
                            if (uid && uid !== 'null' && uid !== '') await assignUserToSpace(spaceId, uid, 'assignee');
                            else await assignUserToSpace(spaceId, collabId, 'assignee', true);
                            document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { spaceId } }));
                        } catch (err) { alert("Errore Team: " + err.message); }
                    }
                }
            };
            if (container._teamMemberHandler) container.removeEventListener('click', container._teamMemberHandler);
            container._teamMemberHandler = handleTeamMemberEvents;
            container.addEventListener('click', handleTeamMemberEvents);
        }

        // Global Outside Click for PM Picker
        if (!window._commessaPickerOutside) {
            window._commessaPickerOutside = (e) => {
                const pickers = container.querySelectorAll('#space-pm-picker:not(.hidden), #space-member-picker:not(.hidden)');
                pickers.forEach(picker => {
                    const btn = picker.parentElement.querySelector('#add-space-pm-btn, #add-space-member-btn');
                    if (!picker.contains(e.target) && (!btn || !btn.contains(e.target))) {
                        picker.classList.add('hidden');
                    }
                });
            };
            document.addEventListener('click', window._commessaPickerOutside);
        }

        // 13. Status Update Logic (Custom Dropdown)
        const statusTrigger = container.querySelector('#hub-status-trigger');
        const statusMenu = container.querySelector('#hub-status-menu');

        if (statusTrigger && statusMenu) {
            statusTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                statusMenu.classList.toggle('hidden');
            });

            document.addEventListener('click', () => statusMenu.classList.add('hidden'));

            statusMenu.querySelectorAll('.status-option').forEach(opt => {
                opt.addEventListener('click', async (e) => {
                    const newStatusKey = opt.dataset.status;
                    const cfg = STATUS_CONFIG[newStatusKey];

                    try {
                        statusTrigger.style.opacity = '0.5';
                        statusTrigger.style.pointerEvents = 'none';

                        if (isInternal) {
                            const { updateSpace } = await import('../../modules/pm_api.js?v=1000');
                            await updateSpace(spaceId, { status: newStatusKey });
                            if (space) space.status = newStatusKey;
                        } else {
                            const { updateOrder } = await import('../../modules/api.js?v=1000');
                            await updateOrder(orderId, { status_works: newStatusKey });
                            if (order) order.status_works = newStatusKey;
                        }

                        // Update Trigger UI
                        statusTrigger.style.background = cfg.bg;
                        statusTrigger.style.color = cfg.color;
                        statusTrigger.innerHTML = `
                            <span class="material-icons-round" style="font-size: 1rem;">${cfg.icon}</span>
                            ${cfg.label}
                            <span class="material-icons-round" style="font-size: 1rem; opacity: 0.7;">unfold_more</span>
                        `;

                        // Update Menu Active State
                        statusMenu.querySelectorAll('.status-option').forEach(s => {
                            s.classList.remove('active');
                            s.style.background = 'transparent';
                            s.style.color = 'var(--text-secondary)';
                        });
                        opt.classList.add('active');
                        opt.style.background = cfg.bg;
                        opt.style.color = cfg.color;

                        showGlobalAlert('Stato aggiornato', 'success');

                        // Refresh active tab to show the new log entry in the activity feed or overview
                        const activeTab = Array.from(tabs).find(t => t.classList.contains('active'))?.dataset.tab || 'overview';
                        if (activeTab === 'overview' || activeTab === 'feed') {
                            renderTab(activeTab);
                        }
                    } catch (err) {
                        showGlobalAlert("Errore: " + err.message, 'error');
                    } finally {
                        statusTrigger.style.opacity = '1';
                        statusTrigger.style.pointerEvents = 'auto';
                        statusMenu.classList.add('hidden');
                    }
                });
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
    import('./components/hub_drawer.js?v=1000').then(mod => {
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
                                    ${renderAvatar(collab || { full_name: 'Collaboratore' }, { size: 44, borderRadius: '50%', fontSize: '1rem' })}
                                <div style="flex: 1;">
                                    <div style="font-weight: 600;">${collab?.full_name || 'Collaboratore'}</div>
                                    <div class="text-xs" style="color: var(--text-secondary);">${a.description || 'Incarico'}</div>
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
