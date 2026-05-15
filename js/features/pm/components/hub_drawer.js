// hub_drawer.js - Full item editor panel
import {
    createPMItem,
    updatePMItem,
    deletePMItem,
    fetchPMItem,
    fetchItemComments,
    addComment,
    fetchItemAssignees,
    assignUserToItem,
    updateItemCloudLinks,
    fetchChildItems,
    fetchPMItemViewLog,
    updatePMItemViewLog,
    deleteComment,
    fetchPMItemSubscriptions,
    subscribeToPMItem,
    unsubscribeFromPMItem,
    duplicatePMItem
} from '../../../modules/pm_api.js?v=8000';
import { supabase } from '../../../modules/config.js?v=8000';
import { CloudLinksManager } from '../../components/CloudLinksManager.js?v=8000';
import { state } from '../../../modules/state.js?v=8000';
import { renderUserPicker } from './picker_utils.js?v=8000';
import { renderAvatar, renderModal, closeModal } from '../../../modules/utils.js?v=8000';
import { ITEM_STATUS, ITEM_PRIORITY } from './hub/constants.js?v=8000';
import { toggleHubDatePicker, renderHubCalendar } from './hub/date_picker.js?v=8000';
// duplicate_modal also installs window.quickRemoveAssignee on import (side effect).
import { showDuplicateModal } from './hub/duplicate_modal.js?v=8000';

export async function openHubDrawer(itemId, spaceId, parentId = null, itemType = 'task', options = {}) {
    let overlay = document.getElementById('hub-drawer-overlay');
    let drawer = document.getElementById('hub-drawer');

    if (!overlay || !drawer) {
        const html = `
            <div id="hub-drawer-overlay" class="drawer-overlay hidden" style="
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0,0,0,0.4); z-index: 99999;
                display: flex; justify-content: flex-end;
            ">
                <div id="hub-drawer" style="
                    width: 600px; max-width: 100%; height: 100%; 
                    background: var(--card-bg); box-shadow: -10px 0 40px rgba(0,0,0,0.2);
                    display: flex; flex-direction: column;
                "></div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        overlay = document.getElementById('hub-drawer-overlay');
        drawer = document.getElementById('hub-drawer');

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeHubDrawer();
        });
    }

    const isEdit = !!itemId;
    const closeHubDrawer = () => {
        overlay.classList.add('hidden');
        isExpanded = false;
        if (drawer) {
            drawer.style.width = '600px';
            drawer.style.maxWidth = '100%';
        }
        if (overlay) {
            overlay.style.left = '0';
            overlay.style.width = '100vw';
        }
    };

    overlay.classList.remove('hidden');
    drawer.innerHTML = `
        <style>
            .spinner-modern {
                width: 32px; height: 32px; border: 3px solid #f3f3f3;
                border-top: 3px solid var(--brand-blue, #3b82f6);
                border-radius: 50%; animation: spin-hub 0.8s linear infinite;
            }
            @keyframes spin-hub { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
        <div style="display: flex; flex-direction: column; height: 100%; align-items: center; justify-content: center; color: var(--text-tertiary); gap: 1rem;">
            <div class="spinner-modern"></div>
            <div style="font-size: 0.9rem; font-weight: 500;">Caricamento...</div>
        </div>
    `;

    let currentSpaceId = spaceId;
    let currentClientId = null;
    let currentParentRef = parentId;
    let spaceAssigneesPool = []; // Pool of users assigned to the project

    let item = null;
    let comments = [];
    let assignees = [];
    let subItems = [];
    let viewMode = isEdit;
    let pendingAssignees = [];
    let unreadCommentsCount = 0;
    let itemSubs = [];
    let isSubscribed = false;
    let isExpanded = false;
    const { defaultRole = 'assignee', defaultNote = '', is_account_level = false } = options;

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timeout caricamento (10s)")), 10000);
    });

    try {
        await Promise.race([
            (async () => {
                const { fetchSpaceAssignees } = await import('../../../modules/pm_api.js?v=8000');

                if (isEdit) {
                    console.log("[HubDrawer] Loading data for item:", itemId);

                    // Parallelize main data, comments, and ensure spaces are loaded
                    const [fullItem, itemComments, fetchedSubItems, viewLog, itemSubs] = await Promise.all([
                        fetchPMItem(itemId).catch(e => { console.error("Item load failed", e); return null; }),
                        fetchItemComments(itemId).catch(e => { console.warn("Comments load failed", e); return []; }),
                        fetchChildItems(itemId).catch(e => { console.warn("Subitems load failed", e); return []; }),
                        fetchPMItemViewLog(itemId).catch(e => { console.error("View log load failed", e); return null; }),
                        fetchPMItemSubscriptions(itemId).catch(e => { console.warn("Subs load failed", e); return []; }),
                        (!state.pm_spaces || state.pm_spaces.length < 5)
                            ? supabase.from('pm_spaces').select('*').then(res => { if (res.data) state.pm_spaces = res.data; return res.data; })
                            : Promise.resolve(state.pm_spaces)
                    ]);

                    // Use context as fallback if fetch fails, but fresh data is priority
                    const contextItem = (window._hubContext?.items || []).find(i => String(i.id) === String(itemId));
                    item = fullItem || contextItem;
                    comments = itemComments || [];
                    subItems = fetchedSubItems || [];

                    const lastViewedAt = viewLog?.last_viewed_at ? new Date(viewLog.last_viewed_at) : new Date(0);
                    unreadCommentsCount = comments.filter(c =>
                        new Date(c.created_at) > lastViewedAt &&
                        c.author_user_ref !== state.session?.user?.id
                    ).length;

                    if (!item) throw new Error("Attività non trovata o non accessibile.");

                    // Determine currentSpaceId for suggestions
                    if (item.space_ref) currentSpaceId = item.space_ref;

                    assignees = item.pm_item_assignees || [];
                    const currentUserId = state.session?.user?.id;
                    const isExplicitSub = (itemSubs || []).some(s => s.user_id === currentUserId);
                    const isAssigned = (assignees || []).some(a => a.user_ref === currentUserId);
                    const isCreator = item.created_by_user_ref === currentUserId;
                    const spacePM = item.pm_spaces ? (Array.isArray(item.pm_spaces) ? item.pm_spaces[0]?.default_pm_user_ref : item.pm_spaces.default_pm_user_ref) : null;
                    const isSpacePM = spacePM === currentUserId;

                    isSubscribed = isExplicitSub || isAssigned || isCreator || isSpacePM;
                    pendingAssignees = assignees.map(a => ({
                        user_ref: a.user_ref,
                        collaborator_ref: a.collaborator_ref,
                        role: a.role,
                        user: a.user,
                        displayName: a.user?.full_name && a.user.full_name !== 'null' ? a.user.full_name : joinNames(a.user?.first_name, a.user?.last_name) || 'Utente'
                    }));
                } else {
                    item = { item_type: itemType, status: 'todo', priority: 'medium', notes: defaultNote, title: '', is_account_level, parent_ref: currentParentRef };

                    // Ensure spaces are loaded even for new items
                    if (!state.pm_spaces || state.pm_spaces.length < 5) {
                        try {
                            const { data } = await supabase.from('pm_spaces').select('*');
                            if (data) state.pm_spaces = data;
                        } catch (e) { console.error("Error loading spaces for new item context", e); }
                    }
                }

                // FETCH PARENT DATA if missing but ref is present
                const effectiveParentRef = item.parent_ref || currentParentRef;
                if (effectiveParentRef && !item.parent_item) {
                    try {
                        const { data: pData } = await supabase.from('pm_items').select('id, title, item_type').eq('id', effectiveParentRef).single();
                        if (pData) item.parent_item = pData;
                    } catch (e) { console.warn("[HubDrawer] Parent fetch failed", e); }
                }

                // Fetch space assignees pool for suggestions (common for edit/create)
                if (currentSpaceId) {
                    try {
                        spaceAssigneesPool = await fetchSpaceAssignees(currentSpaceId);
                    } catch (e) {
                        console.warn("[HubDrawer] Could not fetch space assignees pool", e);
                    }
                }

                // If new item, handle auto-assignment logic
                if (!isEdit && state.profile?.id) {
                    const meCollab = state.collaborators?.find(c => c.user_id === state.profile.id);
                    if (meCollab) {
                        let myRole = defaultRole;
                        const isSpacePm = spaceAssigneesPool.some(sa =>
                            (sa.user_ref === state.profile.id || sa.collaborator_ref === meCollab.id) &&
                            sa.role === 'pm'
                        );
                        if (isSpacePm) myRole = 'pm';

                        pendingAssignees = [{
                            user_ref: state.profile.id, collaborator_ref: meCollab.id, role: myRole,
                            displayName: meCollab.full_name || (meCollab.first_name + ' ' + (meCollab.last_name || '')).trim(),
                            user: meCollab
                        }];
                    }
                }

                // --- REPORT LOGIC ---
                const fetchReports = async () => {
                    const docSpace = await import('../../../modules/docs_api.js?v=8000').then(m => m.ensureDocSpace(currentSpaceId));
                    const pages = await import('../../../modules/docs_api.js?v=8000').then(m => m.fetchDocPages(docSpace.id));
                    // Filter for reports (using metadata or title prefix)
                    return pages.filter(p => p.title.startsWith('Report:') || p.metadata?.type === 'ai_report');
                };

                const renderReportsList = (reports) => {
                    const list = drawer.querySelector('#reports-list');
                    if (!list) return;
                    if (reports.length === 0) {
                        list.innerHTML = `<div style="font-size: 0.85rem; color: #94a3b8; font-style: italic; padding: 20px; text-align: center; background: #f8fafc; border: 1.5px dashed #e2e8f0; border-radius: 12px;">Nessun report generato finora.</div>`;
                        return;
                    }
                    list.innerHTML = reports.map(r => `
                        <div class="report-row" data-id="${r.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; transition: all 0.2s; cursor: pointer;" onmouseover="this.style.borderColor='var(--brand-blue)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.03)';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none';">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="width: 32px; height: 32px; border-radius: 8px; background: #f8fafc; display: flex; align-items: center; justify-content: center;">
                                    <span class="material-icons-round" style="font-size: 1.2rem; color: var(--text-tertiary);">description</span>
                                </div>
                                <div>
                                    <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">${r.title}</div>
                                    <div style="font-size: 0.7rem; color: var(--text-tertiary);">${new Date(r.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                            </div>
                            <button class="secondary-btn" style="padding: 4px 12px; font-size: 0.75rem;">VEDI</button>
                        </div>
                    `).join('');

                    list.querySelectorAll('.report-row').forEach(row => {
                        row.onclick = () => {
                            // Navigate to the doc page
                            const pageId = row.dataset.id;
                            window.location.hash = `#docs/${currentSpaceId}/${pageId}`;
                            closeHubDrawer();
                        };
                    });
                };

                // Initial load of reports
                if (isEdit) {
                    fetchReports().then(renderReportsList).catch(console.error);
                }
            })(),
            timeoutPromise
        ]);
    } catch (e) {
        console.error("[HubDrawer] Load Error:", e);
        drawer.innerHTML = `
            <div style="padding: 2rem; text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 1rem;">
                <span class="material-icons-round" style="font-size: 3rem; color: #ef4444;">error_outline</span>
                <div style="font-weight: 600; color: var(--text-primary);">Errore di Caricamento</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); max-width: 250px;">${e.message}</div>
                <button id="header-close-btn" class="secondary-btn" style="margin-top: 1rem;">Chiudi</button>
            </div>
        `;
        drawer.querySelector('#header-close-btn').onclick = closeHubDrawer;

        return;
    }

    const captureFormState = () => {
        const form = drawer.querySelector('#item-form');
        if (!form) return;
        const formData = new FormData(form);
        item.title = formData.get('title') || item.title;
        item.status = formData.get('status') || item.status;
        item.priority = formData.get('priority') || item.priority;
        item.notes = formData.get('notes') || item.notes;
        if (formData.get('start_date')) item.start_date = formData.get('start_date');
        if (formData.get('due_date')) item.due_date = formData.get('due_date');
    };

    let breadcrumb = '';
    const path = [];

    let space = item?.pm_spaces ? (Array.isArray(item.pm_spaces) ? item.pm_spaces[0] : item.pm_spaces) : null;
    if (!space && spaceId) {
        space = state.pm_spaces?.find(s => s.id === spaceId) || window._hubContext?.space;
    }

    // 0. Client Association (Primary Context)
    let itemClient = item.clients || (item.client_ref ? state.clients?.find(c => c.id === item.client_ref) : null);

    // Fallback: Resolve client from space's order (newly enriched in API)
    if (!itemClient && space) {
        // Check order joined in space
        const spaceOrder = space.order;
        if (spaceOrder) {
            itemClient = spaceOrder.client || spaceOrder.clients;
        }

        // Final fallback to state if still not found
        if (!itemClient && space.ref_ordine) {
            const stateOrder = (state.orders || []).find(o => o.id === space.ref_ordine);
            if (stateOrder) itemClient = stateOrder.clients || stateOrder.client;
        }
    }

    if (itemClient) {
        path.push({ label: itemClient.client_code || itemClient.business_name, type: 'client', id: itemClient.id });
    }

    if (space) {
        // 1. Reparto / Area
        const areaName = typeof space.area === 'object' ? space.area?.name : space.area;
        if (areaName) {
            // Area is generally just text, but we can make it clickable to the internal list
            path.push({ label: areaName, type: 'area' });
        }

        // 2. Cluster
        const cluster = Array.isArray(space.cluster) ? space.cluster[0] : space.cluster;
        if (cluster?.name) {
            path.push({ label: cluster.name, type: 'cluster', id: cluster.id });
        }

        // 3. Commessa / Space Name
        if (space.name || space.ref_ordine) {
            let spaceLabel = space.name || 'Commessa';
            const orderRef = space.ref_ordine || space.order_ref;

            const orderData = space.order || (orderRef ? (state.orders || []).find(o => o.id === orderRef) : null);

            if (orderData) {
                // Use #orderNumber always, add title only if it's short
                spaceLabel = `#${orderData.order_number}`;
                if (orderData.title && orderData.title.length < 25) {
                    spaceLabel += ` ${orderData.title}`;
                }
            }

            // Only add to path if it's not a duplicate of cluster or if it's a specific commessa
            if (space.name !== cluster?.name || space.ref_ordine) {
                path.push({
                    label: spaceLabel,
                    type: 'space',
                    id: space.id,
                    orderRef: orderRef
                });
            }
        }
    }

    // 4. Parent Activity/Task (Up to 3 levels from API join)
    if (item.parent_item) {
        const parents = [];
        let p = item.parent_item;
        while (p) {
            parents.push({ label: p.title, type: 'item', id: p.id });
            p = p.parent_item;
        }
        path.push(...parents.reverse());
    }

    // 5. Build breadcrumb string with clickable items
    breadcrumb = path.map((p, idx) => {
        const isClickable = p.type === 'item' || p.type === 'space' || (p.type === 'cluster' && p.id) || p.type === 'area';
        return `<span class="${isClickable ? 'breadcrumb-clickable' : ''}" 
                      data-type="${p.type || ''}" 
                      data-id="${p.id || ''}" 
                      data-order-ref="${p.orderRef || ''}"
                      style="${isClickable ? 'cursor: pointer; transition: color 0.2s;' : ''}"
                      ${isClickable ? 'onmouseover="this.style.color=\'var(--brand-blue)\'" onmouseout="this.style.color=\'var(--text-tertiary)\'" title="Vai a ${p.label}"' : ''}>${p.label}</span>`;
    }).join(' <span style="margin: 0 4px; opacity: 0.5;">›</span> ');

    const typeLabel = (item.item_type || itemType || 'task').toUpperCase();

    const render = () => {
        if (!item) return;

        const footerHtml = `
                <div id="drawer-footer-comments" class="${state.profile?.role !== 'admin' ? '' : 'hidden'}" style="
                    flex-shrink: 0;
                    padding: 1rem 1.5rem; 
                    border-top: 1px solid var(--glass-border); 
                    background: #fff; 
                    z-index: 30;
                    box-shadow: 0 -4px 20px rgba(0,0,0,0.03);
                ">
                    <div style="
                        display: flex; 
                        align-items: center; 
                        gap: 0.75rem; 
                        background: #f8fafc; 
                        padding: 6px 14px; 
                        border-radius: 24px; 
                        border: 1px solid #e2e8f0;
                        transition: all 0.2s ease;
                    " onfocusin="this.style.borderColor='var(--brand-blue)'; this.style.boxShadow='0 0 0 4px rgba(78, 146, 216, 0.1)';" onfocusout="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none';">
                         <button id="comment-attachment-btn" title="Allega file" style="background: none; border: none; color: #94a3b8; cursor: pointer; display: flex; align-items: center; transition: color 0.2s;" onmouseover="this.style.color='var(--brand-blue)'" onmouseout="this.style.color='#94a3b8'">
                            <span class="material-icons-round" style="font-size: 1.3rem;">attachment</span>
                         </button>
                         <input type="text" id="new-comment" placeholder="Scrivi un commento..." style="
                            flex: 1; 
                            border: none; 
                            background: transparent; 
                            font-size: 0.9rem; 
                            color: var(--text-primary); 
                            outline: none;
                            padding: 8px 0;
                            height: 40px;
                         ">
                         <button id="add-comment-btn" title="Invia" style="background: none; border: none; color: var(--brand-blue); cursor: pointer; display: flex; align-items: center; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                            <span class="material-icons-round" style="font-size: 1.6rem;">send</span>
                         </button>
                    </div>
                </div>
        `;

        if (drawer && overlay) {
            const sidebar = document.getElementById('sidebar');
            const isMobile = window.innerWidth <= 768;
            const sidebarWidth = (sidebar && !isMobile) ? sidebar.offsetWidth : 0;

            if (isExpanded) {
                overlay.style.left = sidebarWidth + 'px';
                overlay.style.width = `calc(100vw - ${sidebarWidth}px)`;
                drawer.style.setProperty('width', '100%', 'important');
                drawer.style.setProperty('max-width', '100%', 'important');
            } else {
                overlay.style.left = '0';
                overlay.style.width = '100vw';
                drawer.style.setProperty('width', isMobile ? '100%' : '600px', 'important');
                drawer.style.setProperty('max-width', '100%', 'important');
                if (isMobile) {
                    drawer.style.setProperty('border-radius', '0', 'important');
                }
            }

            drawer.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
            overlay.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1), background 0.4s ease';
            overlay.style.background = isExpanded ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.4)';
        }

        if (viewMode) {
            drawer.innerHTML = `
                <style>
                    .drawer-tab { position: relative; overflow: hidden; flex-shrink: 0; white-space: nowrap; cursor: pointer; }
                    .drawer-tab::after { 
                        content: ''; position: absolute; bottom: 0; left: 50%; width: 0; height: 2px; 
                        background: var(--brand-blue); transition: all 0.3s ease; transform: translateX(-50%);
                    }
                    .drawer-tab.active::after { width: 100%; }
                    .drawer-tab:hover { background: rgba(59, 130, 246, 0.03); }
                    
                    .avatar-stack-item { transition: transform 0.2s ease, margin 0.2s ease; cursor: pointer; }
                    .avatar-stack-item:hover { transform: translateY(-4px) scale(1.1); margin-right: 0 !important; z-index: 50 !important; }
                    
                    .info-card { transition: all 0.2s ease; border: 1px solid #e2e8f0; }
                    .info-card:hover { border-color: var(--brand-blue); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                    
                    .icon-btn { transition: all 0.2s ease; }
                    .icon-btn:hover { transform: scale(1.1); background: #f8fafc; }
                    .close-drawer-btn:hover { color: #ef4444 !important; background: #fef2f2 !important; border-color: #fee2e2 !important; }
                    
                    .tab-pane { animation: fadeInHub 0.3s ease; }
                    @keyframes fadeInHub { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

                    /* Horizontal scroll for tabs on mobile */
                    .drawer-tabs {
                        overflow-x: auto;
                        scrollbar-width: none; /* Firefox */
                        -ms-overflow-style: none; /* IE/Edge */
                        -webkit-overflow-scrolling: touch;
                    }
                    .drawer-tabs::-webkit-scrollbar {
                        display: none; /* Chrome, Safari, Opera */
                    }

                    /* Revealing labels logic */
                    .metadata-grid .hover-label {
                        opacity: 0;
                        max-height: 0;
                        margin-bottom: 0 !important;
                        overflow: hidden;
                        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                        pointer-events: none;
                    }
                    .metadata-grid:hover .hover-label {
                        opacity: 1;
                        max-height: 20px;
                        margin-bottom: 0.35rem !important;
                    }

                    @media (max-width: 768px) {
                        #full-screen-btn { display: none !important; }
                        .drawer-header { 
                            padding: 0.75rem 1rem !important; 
                            padding-top: calc(0.75rem + env(safe-area-inset-top, 40px)) !important; 
                        }
                        .drawer-body { padding: 0 0.75rem !important; }
                        .metadata-container {
                            padding: 0.5rem 0.75rem !important;
                        }
                        .metadata-grid { 
                            display: none !important; 
                        }
                        .mobile-metadata-bar {
                            display: flex !important;
                            align-items: center;
                            justify-content: space-between;
                            gap: 4px;
                            width: 100%;
                            padding: 4px;
                            border-bottom: 1px dashed #f1f5f9;
                            margin-bottom: 8px;
                        }
                        .mobile-date-text {
                            font-size: 0.7rem;
                            font-weight: 600;
                            color: var(--text-primary);
                            display: flex;
                            align-items: center;
                            gap: 4px;
                            white-space: nowrap;
                        }
                        .mobile-meta-item {
                            display: flex;
                            align-items: center;
                            gap: 4px;
                            font-size: 0.72rem;
                            font-weight: 700;
                            cursor: pointer;
                            padding: 4px;
                        }
                        #priority-trigger-btn, #status-trigger-btn, .mobile-meta-item {
                            background: transparent !important;
                            border: none !important;
                            padding: 0 !important;
                            height: auto !important;
                            font-size: 0.75rem !important;
                            font-weight: 700 !important;
                            display: flex;
                            align-items: center;
                            gap: 3px;
                            box-shadow: none !important;
                        }
                        #item-title-view { font-size: 1.1rem !important; }
                        .team-section-grid { border-top: none !important; margin-top: 0.5rem !important; gap: 0.75rem !important; padding-top: 0 !important; }

                        /* Dropdown mobile positioning reset */
                        .dropdown-menu {
                            position: absolute !important;
                            max-width: 95vw;
                        }

                        /* Avatar-only toggle logic */
                        .mobile-team-list.is-collapsed .assignee-pill {
                            padding-right: 4px !important;
                            border: none !important;
                            background: transparent !important;
                            width: 24px !important;
                            height: 24px !important;
                        }
                        .mobile-team-list.is-collapsed .assignee-pill span, 
                        .mobile-team-list.is-collapsed .assignee-pill div[onclick] {
                            display: none !important;
                        }
                    }
                </style>
                <div class="drawer-header" style="
                    padding: 1.25rem 1.5rem; 
                    padding-top: calc(1.5rem + env(safe-area-inset-top, 30px));
                    border-bottom: 1px solid #f1f5f9; 
                    display: flex; 
                    flex-direction: column;
                    gap: 4px;
                    background: #ffffff !important;
                    flex-shrink: 0;
                    z-index: 110;
                    position: relative;
                ">
                    <!-- Top Row: Tag & Expand -->
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <button id="full-screen-btn" class="icon-btn" title="${isExpanded ? 'Riduci' : 'Espandi'}" style="width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px solid transparent; color: var(--text-tertiary); transition: all 0.2s; cursor: pointer;" onmouseover="this.style.background='rgba(59, 130, 246, 0.05)'; this.style.borderColor='rgba(59, 130, 246, 0.15)';" onmouseout="this.style.background='transparent'; this.style.borderColor='transparent';">
                            <span class="material-icons-round" style="font-size: 1.2rem;">${isExpanded ? 'fullscreen_exit' : 'fullscreen'}</span>
                        </button>
                        <div style="font-size: 0.55rem; font-weight: 800; color: var(--brand-blue); background: rgba(59, 130, 246, 0.08); padding: 2px 8px; border-radius: 6px; text-transform: uppercase; border: 1px solid rgba(59, 130, 246, 0.15);">
                            ${typeLabel}
                        </div>
                    </div>

                    <!-- Middle Row: Title & Actions -->
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 1rem;">
                        <div id="item-title-container" style="min-width: 0; flex: 1;">
                            <h2 id="item-title-view" style="margin: 0; font-size: 1.5rem; font-weight: 700; color: #1a1f36; line-height: 1.25; font-family: 'Satoshi', sans-serif; letter-spacing: -0.02em; cursor: pointer; border-radius: 12px; padding: 4px 10px; margin-left: -10px; transition: all 0.2s; border: 1.2px solid transparent; width: fit-content;" onmouseover="this.style.background='rgba(78, 146, 216, 0.05)'; this.style.borderColor='rgba(78, 146, 216, 0.15)';" onmouseout="this.style.background='transparent'; this.style.borderColor='transparent';">
                                ${item.title || 'Senza Titolo'}
                            </h2>
                        </div>
                        <div style="display: flex; gap: 0.75rem; align-items: center; flex-shrink: 0;">
                            ${isEdit ? `
                                <button id="toggle-subscription-btn" class="icon-btn" title="${isSubscribed ? 'Smetti di seguire' : 'Segui attività'}" style="width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: ${isSubscribed ? 'rgba(59, 130, 246, 0.08)' : '#fff'}; border: 1.2px solid ${isSubscribed ? 'rgba(59, 130, 246, 0.3)' : '#e2e8f0'}; color: ${isSubscribed ? 'var(--brand-blue)' : 'var(--text-tertiary)'}; transition: all 0.2s;">
                                    <span class="material-icons-round" style="font-size: 20px;">${isSubscribed ? 'notifications_active' : 'notifications_none'}</span>
                                </button>
                            ` : ''}
                            
                            <div style="display: flex; align-items: center; gap: 0.5rem; padding-left: 0.5rem; border-left: 1.2px solid #e2e8f0;">
                                <button class="icon-btn more-actions-btn" id="header-more-actions" style="width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #fff; border: 1.2px solid #e2e8f0; color: var(--text-tertiary);">
                                    <span class="material-icons-round" style="font-size: 20px;">more_vert</span>
                                </button>
                                <button class="icon-btn" id="header-close-btn" style="width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #fff; border: 1.2px solid #e2e8f0; color: var(--text-tertiary);">
                                    <span class="material-icons-round" style="font-size: 20px;">close</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Bottom Row: Breadcrumb (Full Width) -->
                    <div style="font-size: 0.72rem; color: #697386; text-transform: uppercase; font-weight: 700; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; line-height: 1.5; margin-top: 6px; font-family: 'Plus Jakarta Sans', sans-serif; letter-spacing: 0.05em;">
                        ${breadcrumb}
                    </div>
                </div>
                <div id="more-actions-menu" class="hidden dropdown-menu glass-card" style="position: absolute; top: 120px; right: 24px; padding: 6px; z-index: 1000; min-width: 210px; box-shadow: 0 16px 48px rgba(0,0,0,0.12); border: 1.2px solid rgba(0, 0, 0, 0.06); background: rgba(255, 255, 255, 0.96); backdrop-filter: blur(20px); border-radius: 16px;">
                    <div class="menu-action-opt" id="duplicate-item-btn">
                        <span class="material-icons-round" style="font-size: 1.25rem; opacity: 0.8;">content_copy</span>
                        <span>Duplica</span>
                    </div>
                    <div class="menu-action-opt" id="copy-link-btn">
                        <span class="material-icons-round" style="font-size: 1.25rem; opacity: 0.8;">link</span>
                        <span>Copia link diretto</span>
                    </div>
                    <div class="divider" style="margin: 6px 10px;"></div>
                    <div class="menu-action-opt danger" id="delete-item-btn">
                        <span class="material-icons-round" style="font-size: 1.25rem; opacity: 0.9;">delete_outline</span>
                        <span>Elimina</span>
                    </div>
                </div>
                <div class="drawer-body" style="flex: 1; overflow: ${isExpanded ? 'hidden' : 'auto'}; position: relative; background: #fff; ${isExpanded ? 'display: flex;' : ''}">
                    <!-- Sidebar Column -->
                    ${isExpanded ? '<div class="drawer-sidebar" style="width: 420px; flex-shrink: 0; border-right: 1px solid #f1f5f9; overflow-y: auto; padding-bottom: 2rem; background: #fff;">' : ''}
                    
                    <!-- Main Metadata Bar -->
                    <div class="metadata-container" style="padding: 1.25rem 1.5rem; border-bottom: 1px solid #f1f5f9; background: #fff; position: relative;">
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
                            
                            <!-- Desktop Metadata Grid (Hidden on Mobile via CSS) -->
                            <div class="metadata-grid" style="display: grid; grid-template-columns: ${isExpanded ? '1fr 1fr' : 'repeat(4, 1fr)'}; gap: 1.25rem 2.5rem; width: 100%; transition: all 0.3s ease;">
                                <!-- Inizio -->
                                <div id="start-date-btn" class="date-trigger" style="cursor: pointer; min-width: 0;">
                                    <label class="hover-label" style="display: block; font-size: 0.65rem; font-weight: 800; color: #697386; text-transform: uppercase; letter-spacing: 0.06em; font-family: 'Plus Jakarta Sans', sans-serif; margin-bottom: 6px;">INIZIO</label>
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <span class="material-icons-round" style="font-size: 1.15rem; color: #614aa2; opacity: 0.85;">calendar_today</span>
                                        <span style="font-size: 1rem; font-weight: 700; color: #1a1f36; white-space: nowrap; font-family: 'Plus Jakarta Sans', sans-serif;">${item.start_date ? new Date(item.start_date).toLocaleDateString('it-IT') : 'Imposta...'}</span>
                                    </div>
                                </div>

                                <!-- Fine -->
                                <div id="due-date-btn" class="date-trigger" style="cursor: pointer; min-width: 0;">
                                    <label class="hover-label" style="display: block; font-size: 0.65rem; font-weight: 800; color: #697386; text-transform: uppercase; letter-spacing: 0.06em; font-family: 'Plus Jakarta Sans', sans-serif; margin-bottom: 6px;">SCADENZA</label>
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <span class="material-icons-round" style="font-size: 1.15rem; color: #ef4444; opacity: 0.85;">event</span>
                                        <span style="font-size: 1rem; font-weight: 700; color: ${item.due_date && new Date(item.due_date) < new Date() ? '#ef4444' : '#1a1f36'}; white-space: nowrap; font-family: 'Plus Jakarta Sans', sans-serif;">${item.due_date ? new Date(item.due_date).toLocaleDateString('it-IT') : 'Imposta...'}</span>
                                    </div>
                                </div>

                                <!-- Priorità -->
                                <div style="min-width: 0;">
                                    <label class="hover-label" style="display: block; font-size: 0.65rem; font-weight: 800; color: #697386; text-transform: uppercase; letter-spacing: 0.06em; font-family: 'Plus Jakarta Sans', sans-serif; margin-bottom: 6px;">PRIORITÀ</label>
                                    <button class="priority-trigger priority-trigger-btn-desktop" style="appearance: none; border: none; padding: 6px 14px; border-radius: 10px; background: ${ITEM_PRIORITY[item.priority || 'medium']?.color}14; color: ${ITEM_PRIORITY[item.priority || 'medium']?.color}; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.9rem; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif;">
                                        <span class="material-icons-round" style="font-size: 1.15rem;">flag</span>
                                        <span>${ITEM_PRIORITY[item.priority || 'medium']?.label}</span>
                                    </button>
                                </div>

                                <!-- Stato -->
                                <div style="min-width: 0;">
                                    <label class="hover-label" style="display: block; font-size: 0.65rem; font-weight: 800; color: #697386; text-transform: uppercase; letter-spacing: 0.06em; font-family: 'Plus Jakarta Sans', sans-serif; margin-bottom: 6px;">STATO</label>
                                    <button class="status-trigger status-trigger-btn-desktop" style="appearance: none; border: none; padding: 6px 16px; border-radius: 10px; font-size: 0.9rem; font-weight: 800; background-color: ${ITEM_STATUS[item.status]?.bg || '#f1f5f9'}; color: ${ITEM_STATUS[item.status]?.color || '#697386'}; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif;">
                                        <span>${ITEM_STATUS[item.status]?.label || item.status}</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Ultra-Compact Mobile Metadata Bar (Single Row) -->
                            <div class="mobile-metadata-bar" style="display: none;">
                                <!-- Single Line Dates: separately clickable -->
                                <div class="mobile-date-text" style="display: flex; align-items: center; gap: 6px; font-family: 'Plus Jakarta Sans', sans-serif;">
                                    <span class="material-icons-round" style="font-size: 1rem; color: #697386;">calendar_today</span>
                                    <span id="mobile-start-date" style="cursor: pointer; font-weight: 700; color: #1a1f36;">${item.start_date ? new Date(item.start_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '--'}</span>
                                    <span style="color: #cbd5e1; margin: 0 4px;">–</span>
                                    <span id="mobile-due-date" style="cursor: pointer; font-weight: 700; color: ${item.due_date && new Date(item.due_date) < new Date() ? '#ef4444' : '#1a1f36'};">${item.due_date ? new Date(item.due_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '--'}</span>
                                </div>

                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <!-- Priority -->
                                    <button class="priority-trigger mobile-meta-item" style="color: ${ITEM_PRIORITY[item.priority || 'medium']?.color}; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; display: flex; align-items: center; gap: 4px;">
                                        <span class="material-icons-round" style="font-size: 1rem;">flag</span>
                                        <span>${ITEM_PRIORITY[item.priority || 'medium']?.label}</span>
                                    </button>

                                    <span style="color: #f1f5f9;">|</span>

                                    <!-- Status -->
                                    <button class="status-trigger mobile-meta-item" style="color: ${ITEM_STATUS[item.status]?.color || '#697386'}; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; display: flex; align-items: center; gap: 6px;">
                                        <div style="width: 6px; height: 6px; border-radius: 50%; background: ${ITEM_STATUS[item.status]?.color || '#697386'};"></div>
                                        <span>${ITEM_STATUS[item.status]?.label || item.status}</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Shared Dropdowns for Metadata (Absolute positioned relative to container) -->
                            <div id="priority-dropdown-menu" class="hidden dropdown-menu glass-card" style="position: absolute; padding: 6px; z-index: 1000; min-width: 150px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); background: white;">
                                ${Object.keys(ITEM_PRIORITY).map(k => `<div class="priority-option" data-value="${k}" style="padding: 8px 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 400; color: #334155; transition: background 0.2s;">
                                    <span class="material-icons-round" style="font-size: 1rem; color: ${ITEM_PRIORITY[k].color};">flag</span>
                                    <span>${ITEM_PRIORITY[k].label}</span>
                                </div>`).join('')}
                            </div>
                            <div id="status-dropdown-menu" class="hidden dropdown-menu glass-card" style="position: absolute; padding: 6px; z-index: 1000; min-width: 160px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); background: white;">
                                ${Object.keys(ITEM_STATUS).map(k => `<div class="status-option" data-value="${k}" style="padding: 8px 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 400; color: #334155; transition: background 0.2s;">
                                    <div style="width: 8px; height: 8px; border-radius: 50%; background: ${ITEM_STATUS[k].color};"></div>
                                    <span>${ITEM_STATUS[k].label}</span>
                                </div>`).join('')}
                            </div>




                        </div>

                        <!-- Team Section (PM & Assignees) -->
                        <div class="team-section-grid" style="display: grid; grid-template-columns: ${isExpanded ? '1fr' : '1fr 1fr'}; gap: ${isExpanded ? '1.5rem' : '1.75rem'}; margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1.2px dashed #f1f5f9; align-items: flex-start;">
                            <!-- Project Manager -->
                            <div style="width: 100%; display: flex; flex-direction: column;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <label style="display: block; font-size: 0.65rem; font-weight: 800; color: #697386; text-transform: uppercase; letter-spacing: 0.06em; line-height: 1; font-family: 'Plus Jakarta Sans', sans-serif;">RESPONSABILE</label>
                                    <span class="material-icons-round team-expand-toggle" data-target="pm-list" style="font-size: 1rem; color: #697386; cursor: pointer; display: none;">expand_more</span>
                                </div>
                                <div id="pm-list" class="mobile-team-list is-collapsed" style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; min-height: 36px; position: relative;">
                                    ${assignees.filter(a => a.role === 'pm').map(a => `
                                        <div class="assignee-pill" style="display: flex; align-items: center; gap: 8px; padding: 4px 12px; padding-left: 4px; background: #f5f3ff; border: 1.2px solid #ddd6fe; border-radius: 20px; font-size: 0.85rem; font-weight: 500; color: #7c3aed; min-width: 0; height: 36px; box-sizing: border-box; position: relative; padding-right: 32px; font-family: 'Outfit', sans-serif;">
                                            ${renderAvatar(a.user, { size: 28, borderRadius: '50%' })}
                                            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${a.user?.full_name && a.user.full_name !== 'null' ? a.user.full_name : joinNames(a.user?.first_name, a.user?.last_name) || 'PM'}</span>
                                            <div onclick="window.quickRemoveAssignee('${itemId}', '${a.id}')" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; background: #ede9fe; color: #7c3aed; transition: all 0.2s;" onmouseover="this.style.background='#ddd6fe'" onmouseout="this.style.background='#ede9fe'">
                                                <span class="material-icons-round" style="font-size: 14px;">close</span>
                                            </div>
                                        </div>
                                    `).join('')}
                                    <button id="add-pm-btn" class="icon-btn" style="width: 32px; height: 32px; border-radius: 50%; border: 1.2px dashed #7c3aed; background: transparent; color: #7c3aed; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0.7; flex-shrink: 0;"><span class="material-icons-round" style="font-size: 18px;">add</span></button>
                                </div>
                            </div>

                            <!-- Assegnatari -->
                            <div style="flex: 1; display: flex; flex-direction: column;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <label style="display: block; font-size: 0.65rem; font-weight: 800; color: #697386; text-transform: uppercase; letter-spacing: 0.06em; line-height: 1; font-family: 'Plus Jakarta Sans', sans-serif;">ASSEGNATARI</label>
                                    <span class="material-icons-round team-expand-toggle" data-target="assignee-list" style="font-size: 1rem; color: #697386; cursor: pointer; display: none;">expand_more</span>
                                </div>
                                <div id="assignee-list" class="mobile-team-list is-collapsed" style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; min-height: 36px; position: relative;">
                                    ${assignees.filter(a => a.role !== 'pm').map(a => `
                                        <div class="assignee-pill" style="display: flex; align-items: center; gap: 8px; padding: 4px 12px; padding-left: 4px; background: #f8fafc; border: 1.2px solid #e2e8f0; border-radius: 20px; font-size: 0.85rem; font-weight: 500; color: var(--text-primary); box-shadow: 0 1px 3px rgba(0,0,0,0.02); min-width: 0; height: 36px; box-sizing: border-box; position: relative; padding-right: 32px; font-family: 'Outfit', sans-serif;">
                                            ${renderAvatar(a.user, { size: 28, borderRadius: '50%' })}
                                            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${a.user?.full_name && a.user.full_name !== 'null' ? a.user.full_name : joinNames(a.user?.first_name, a.user?.last_name) || 'User'}</span>
                                            <div onclick="window.quickRemoveAssignee('${itemId}', '${a.id}')" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; background: #f1f5f9; color: #64748b; transition: all 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
                                                <span class="material-icons-round" style="font-size: 14px;">close</span>
                                            </div>
                                        </div>
                                    `).join('')}
                                    <button id="add-assignee-btn" class="icon-btn" style="width: 32px; height: 32px; border-radius: 50%; border: 1.2px dashed #cbd5e1; background: transparent; color: #94a3b8; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0.8; flex-shrink: 0;"><span class="material-icons-round" style="font-size: 18px;">add</span></button>
                                </div>
                            </div>
                        </div>

                        <!-- Team Pickers (Moved for reliable positioning) -->
                        <div id="pm-picker" class="hidden dropdown-menu glass-card" style="position: absolute; z-index: 1000; width: 260px; background: white; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border-radius: 12px; overflow: hidden;">
                            ${renderUserPicker(spaceId, 'pm', new Set(assignees.filter(a => a.role === 'pm').map(a => a.user_ref || a.collaborator_ref)), new Set(spaceAssigneesPool.map(sa => sa.collaborator_ref || sa.user_ref)), 'Tutti i responsabili')}
                        </div>
                        <div id="assignee-picker" class="hidden dropdown-menu glass-card" style="position: absolute; z-index: 1000; width: 260px; background: white; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border-radius: 12px; overflow: hidden;">
                            ${renderUserPicker(spaceId, 'assignee', new Set(assignees.filter(a => a.role !== 'pm').map(a => a.user_ref || a.collaborator_ref)), new Set(spaceAssigneesPool.map(sa => sa.collaborator_ref || sa.user_ref)), 'Tutti i collaboratori')}
                        </div>


                    </div>

                    <!-- Description Section -->
                    <div style="padding: 1.5rem 1.75rem; border-bottom: 1.2px solid #f1f5f9; position: relative;">
                         <label style="display: block; font-size: 0.65rem; font-weight: 800; color: #697386; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.06em; font-family: 'Plus Jakarta Sans', sans-serif;">DESCRIZIONE</label>
                         <div id="item-description-container" style="min-height: 100px;">
                            <div id="item-description-view" style="font-size: 1rem; color: #1a1f36; line-height: 1.6; white-space: pre-wrap; border-radius: 16px; cursor: pointer; padding: 20px; transition: all 0.3s; background: #fafbfc; border: 1.2px solid rgba(0,0,0,0.04); width: 100%; word-break: break-word; margin: 0; font-family: 'Plus Jakarta Sans', sans-serif;" onmouseover="this.style.borderColor='#4e92d8'; this.style.background='white'; this.style.boxShadow='0 12px 32px rgba(78, 146, 216, 0.08)'" onmouseout="this.style.borderColor='rgba(0,0,0,0.04)'; this.style.background='#fafbfc'; this.style.boxShadow='none'">${(item.notes && item.notes.trim()) || '<span style="color: #a0aec0; font-style: italic;">Aggiungi una descrizione per dare più contesto al team...</span>'}</div>
                         </div>
                         <div id="desc-saving-indicator" class="hidden" style="position: absolute; top: 1.5rem; right: 1.75rem; font-size: 0.72rem; color: #4e92d8; font-weight: 800; display: flex; align-items: center; gap: 6px; font-family: 'Plus Jakarta Sans', sans-serif;">
                              <span class="material-icons-round" style="font-size: 1rem; animation: spin-hub 1s linear infinite;">sync</span> SALVATAGGIO...
                         </div>
                    </div>

                    ${isExpanded ? '</div> <!-- Close sidebar --><div class="drawer-content-main" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #f8fafc;">' : ''}

                    <!-- Tab Navigation -->
                    <div class="drawer-tabs" style="display: flex; flex-wrap: nowrap; border-bottom: 1.2px solid #f1f5f9; background: #ffffff !important; position: sticky; top: 0; z-index: 100; padding: 0 1.25rem; gap: 0.5rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02); overflow-x: auto; min-width: 0; width: 100%; max-width: 100%; scrollbar-width: none;">
                        ${state.profile?.role === 'admin' ? `
                        <div class="drawer-tab ${item.item_type === 'task' ? 'active' : ''}" data-tab="activity" style="padding: 1.1rem 1rem; font-size: 0.85rem; font-weight: ${item.item_type === 'task' ? '700' : '600'}; color: ${item.item_type === 'task' ? '#4e92d8' : '#697386'}; border-bottom: 2.5px solid ${item.item_type === 'task' ? '#4e92d8' : 'transparent'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; font-family: 'Satoshi', sans-serif; white-space: nowrap; flex-shrink: 0;">
                            <span class="material-icons-round" style="font-size: 1.1rem;">history</span>
                            Feed
                        </div>
                        ` : ''}

                        ${(item.item_type || itemType) !== 'task' ? `
                        <div class="drawer-tab ${(item.item_type || itemType) !== 'task' ? 'active' : ''}" data-tab="subtasks" style="padding: 1.1rem 1rem; font-size: 0.85rem; font-weight: ${(item.item_type || itemType) !== 'task' ? '700' : '600'}; color: ${(item.item_type || itemType) !== 'task' ? '#4e92d8' : '#697386'}; border-bottom: 2.5px solid ${(item.item_type || itemType) !== 'task' ? '#4e92d8' : 'transparent'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; font-family: 'Satoshi', sans-serif; white-space: nowrap; flex-shrink: 0;">
                            <span class="material-icons-round" style="font-size: 1.1rem;">checklist</span>
                            Board
                             ${subItems.length > 0 ? `<span style="font-size: 0.75rem; background: rgba(78, 146, 216, 0.08); padding: 2px 6px; border-radius: 6px; margin-left: 2px;">${subItems.length}</span>` : ''}
                        </div>
                        ` : ''}

                        <div class="drawer-tab ${item.item_type === 'task' && state.profile?.role !== 'admin' ? 'active' : ''}" data-tab="comments" style="padding: 1.1rem 1rem; font-size: 0.85rem; font-weight: ${item.item_type === 'task' && state.profile?.role !== 'admin' ? '700' : '600'}; color: ${item.item_type === 'task' && state.profile?.role !== 'admin' ? '#4e92d8' : '#697386'}; border-bottom: 2.5px solid ${item.item_type === 'task' && state.profile?.role !== 'admin' ? '#4e92d8' : 'transparent'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; font-family: 'Satoshi', sans-serif; white-space: nowrap; flex-shrink: 0;">
                            <span class="material-icons-round" style="font-size: 1.1rem;">chat_bubble_outline</span>
                            Commenti
                            ${unreadCommentsCount > 0 && state.profile?.role === 'admin' ? `
                                <span class="unread-badge" style="background: #ef4444; color: white; min-width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; margin-left: 4px; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.25);">
                                    ${unreadCommentsCount}
                                </span>
                            ` : ''}
                        </div>

                        <div class="drawer-tab" data-tab="resources" style="padding: 1.1rem 1rem; font-size: 0.85rem; font-weight: 600; color: #697386; border-bottom: 2.5px solid transparent; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; font-family: 'Satoshi', sans-serif; white-space: nowrap; flex-shrink: 0;">
                            <span class="material-icons-round" style="font-size: 1.1rem;">cloud_queue</span>
                            Risorse
                            ${item.cloud_links?.length > 0 ? `<span style="font-size: 0.75rem; background: #f1f5f9; padding: 2px 6px; border-radius: 6px; margin-left: 2px;">${item.cloud_links.length}</span>` : ''}
                        </div>

                        <div class="drawer-tab" data-tab="report" style="padding: 1.1rem 1rem; font-size: 0.85rem; font-weight: 600; color: #697386; border-bottom: 2.5px solid transparent; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; font-family: 'Satoshi', sans-serif; white-space: nowrap; flex-shrink: 0;">
                            <span class="material-icons-round" style="font-size: 1.1rem;">description</span>
                            Report
                        </div>
                    </div>

                    ${isExpanded ? '<div class="panes-scrollable" style="flex: 1; overflow-y: auto;">' : ''}

                    <div id="tab-subtasks" class="tab-pane ${item.item_type !== 'task' ? '' : 'hidden'}">
                        <div class="sub-items-section" style="padding: 1.5rem 1.75rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                                <label style="display: block; font-size: 0.65rem; font-weight: 800; color: #697386; text-transform: uppercase; letter-spacing: 0.06em; font-family: 'Plus Jakarta Sans', sans-serif;">BOARD</label>
                                <div style="position: relative;">
                                    <button id="add-sub-item-btn" style="display: flex; align-items: center; gap: 6px; border: none; background: transparent; color: #4e92d8; font-size: 0.8rem; font-weight: 800; cursor: pointer; padding: 8px 12px; border-radius: 10px; transition: all 0.2s; font-family: 'Satoshi', sans-serif;" onmouseover="this.style.background='rgba(78, 146, 216, 0.08)'" onmouseout="this.style.background='transparent'">
                                        <span class="material-icons-round" style="font-size: 1.2rem;">add</span> NUOVA
                                    </button>
                                    <div id="add-sub-item-menu" class="hidden dropdown-menu glass-card" style="position: absolute; top: calc(100% + 6px); right: 0; width: 210px; z-index: 1000; box-shadow: 0 10px 30px rgba(0,0,0,0.1); padding: 6px;">
                                        <div class="menu-item add-sub-item-opt" data-type="attivita" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; cursor: pointer; transition: 0.2s; border-radius: 8px;">
                                            <span class="material-icons-round" style="font-size: 1.25rem; color: #f59e0b;">folder</span>
                                            <span style="font-size: 0.9rem; font-weight: 600; font-family: 'Outfit', sans-serif;">Sotto-attività</span>
                                        </div>
                                        <div class="menu-item add-sub-item-opt" data-type="task" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; cursor: pointer; transition: 0.2s; border-radius: 8px;">
                                            <span class="material-icons-round" style="font-size: 1.25rem; color: #3b82f6;">check_circle_outline</span>
                                            <span style="font-size: 0.9rem; font-weight: 600; font-family: 'Outfit', sans-serif;">Task</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div id="sub-items-list" style="display: flex; flex-direction: column; gap: 12px;">
                                ${(() => {
                    const activeSubItems = subItems;
                    if (activeSubItems.length === 0) {
                        return `
                            <div style="font-size: 0.9rem; color: #94a3b8; font-style: italic; padding: 40px 20px; text-align: center; background: #fff; border: 1.5px dashed #f1f5f9; border-radius: 16px; font-family: 'Outfit', sans-serif; display: flex; flex-direction: column; align-items: center; gap: 12px;">
                                <span class="material-icons-round" style="font-size: 2.5rem; opacity: 0.2;">auto_stories</span>
                                Nessun contenuto qui. Inizia aggiungendo una task o attività.
                            </div>`;
                    }
                    return activeSubItems.map(si => `
                                    <div class="sub-item-row" data-id="${si.id}" style="display: flex; align-items: center; gap: 14px; padding: 14px; background: #fff; border: 1.2px solid #f1f5f9; border-radius: 14px; cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.01);" onmouseover="this.style.borderColor='var(--brand-blue)'; this.style.boxShadow='0 4px 12px rgba(59, 130, 246, 0.05)'; this.style.transform='translateY(-1px)'" onmouseout="this.style.borderColor='#f1f5f9'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.01)'; this.style.transform='none'">
                                        <div style="width: 36px; height: 36px; border-radius: 10px; background: ${si.item_type === 'attivita' ? '#fff7ed' : '#eff6ff'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                            <span class="material-icons-round" style="font-size: 1.2rem; color: ${si.item_type === 'attivita' ? '#f59e0b' : '#3b82f6'};">
                                                ${si.item_type === 'attivita' ? 'folder' : 'check_circle_outline'}
                                            </span>
                                        </div>
                                        <div style="flex: 1; font-size: 0.95rem; font-weight: 600; color: var(--text-primary); font-family: 'Outfit', sans-serif; letter-spacing: -0.01em;">${si.title}</div>
                                        <div style="display: flex; align-items: center;">
                                            ${(si.pm_item_assignees || []).slice(0, 3).map((a, idx) => `
                                                <div class="avatar-stack-item" style="margin-left: ${idx === 0 ? '0' : '-10px'}; z-index: ${5 - idx}; border: 2px solid white; border-radius: 50%;">
                                                    ${renderAvatar(a.user, { size: 26, borderRadius: '50%', fontSize: '10px' })}
                                                </div>
                                            `).join('')}
                                            ${(si.pm_item_assignees || []).length > 3 ? `<div style="margin-left: -10px; z-index: 1; width: 26px; height: 26px; border-radius: 50%; background: #f1f5f9; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; color: #64748b;">+${si.pm_item_assignees.length - 3}</div>` : ''}
                                        </div>
                                        ${si.due_date ? `
                                            <div style="font-size: 0.75rem; color: ${new Date(si.due_date) < new Date() ? '#ef4444' : '#64748b'}; font-weight: 700; white-space: nowrap; display: flex; align-items: center; gap: 4px; padding: 5px 10px; background: ${new Date(si.due_date) < new Date() ? '#fef2f2' : '#f8fafc'}; border: 1px solid ${new Date(si.due_date) < new Date() ? '#fee2e2' : '#f1f5f9'}; border-radius: 8px; font-family: 'Outfit', sans-serif;">
                                                <span class="material-icons-round" style="font-size: 1rem;">${new Date(si.due_date) < new Date() ? 'history' : 'event'}</span>
                                                ${new Date(si.due_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                                            </div>
                                        ` : ''}
                                    </div>
                                `).join('');
                })()}
                            </div>
                        </div>
                    </div>
                    ${state.profile?.role === 'admin' ? `
                    <div id="tab-activity" class="tab-pane ${item.item_type === 'task' ? '' : 'hidden'}">
                        <div id="drawer-activity-log-container"></div>
                    </div>
                    ` : ''}

                    <div id="tab-comments" class="tab-pane ${state.profile?.role === 'admin' ? 'hidden' : ''}">
                        <div class="comments-section" style="padding: 1.5rem 1.75rem;">
                            <div id="comments-list" style="margin-bottom: 5rem; display: flex; flex-direction: column; gap: 1.5rem;">
                                ${comments.length === 0 ? `
                                    <div style="text-align: center; padding: 4rem 1rem; color: #a0aec0; font-family: 'Plus Jakarta Sans', sans-serif;">
                                        <span class="material-icons-round" style="font-size: 3rem; opacity: 0.15; margin-bottom: 0.75rem;">chat_bubble_outline</span>
                                        <p style="font-size: 0.95rem; font-weight: 500;">Ancora nessun commento.</p>
                                        <p style="font-size: 0.8rem; opacity: 0.7;">Inizia la conversazione taggando un collega.</p>
                                    </div>
                                ` : comments.map(c => `
                                    <div style="display: flex; gap: 14px;">
                                        ${renderAvatar(c.profiles, { size: 36, borderRadius: '50%' })}
                                        <div style="flex: 1;">
                                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 6px;">
                                                <span style="font-size: 0.9rem; font-weight: 700; color: #1a1f36; font-family: 'Plus Jakarta Sans', sans-serif;">${c.profiles?.full_name || 'Utente'}</span>
                                                <span style="font-size: 0.65rem; font-weight: 700; color: #697386; text-transform: uppercase; letter-spacing: 0.05em; font-family: 'Plus Jakarta Sans', sans-serif;">${new Date(c.created_at).toLocaleDateString('it-IT')}</span>
                                            </div>
                                            <div class="comment-bubble" style="font-size: 0.95rem; color: #1a1f36; line-height: 1.6; padding: 12px 16px; background: #fafbfc; border: 1.2px solid rgba(0,0,0,0.04); border-radius: 0 16px 16px 16px; position: relative; width: fit-content; max-width: 100%; box-sizing: border-box; word-break: break-word; font-family: 'Plus Jakarta Sans', sans-serif;">
                                                ${c.body}
                                                ${(() => {
                        const myRole = assignees.find(a => a.user_ref === state.profile?.id)?.role;
                        const isAdmin = state.profile?.role === 'admin';
                        const isAuthor = c.author_user_ref === state.profile?.id;
                        const isPM = myRole === 'pm' || myRole === 'owner';

                        if (isAdmin || isAuthor || isPM) {
                            return `
                                                    <button class="delete-comment-btn" data-id="${c.id}" style="position: absolute; right: 4px; top: -12px; width: 22px; height: 22px; border-radius: 50%; border: 1.2px solid #fee2e2; background: #fff; color: #ef4444; cursor: pointer; opacity: 0; transition: all 0.2s; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.06);" title="Elimina commento">
                                                        <span class="material-icons-round" style="font-size: 14px;">close</span>
                                                    </button>
                                                `;
                        }
                        return '';
                    })()}
                                            </div>
                                            <style>
                                                .comment-bubble:hover .delete-comment-btn { opacity: 1 !important; transform: scale(1.1); }
                                                .delete-comment-btn:hover { background: #fef2f2 !important; }
                                            </style>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <div id="tab-resources" class="tab-pane hidden">
                        <div class="resources-section" style="padding: 1.5rem;">
                            <div id="item-cloud-links-container" style="background: #f8fafc; border-radius: 16px; padding: 10px; border: 1.5px solid #f1f5f9;"></div>
                        </div>
                    </div>

                    <div id="tab-report" class="tab-pane hidden">
                        <div class="report-section" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem;">
                            <!-- Upload Area -->
                                <div id="report-upload-zone" style="
                                border: 2.2px dashed rgba(78, 146, 216, 0.2);
                                border-radius: 20px;
                                padding: 3rem 2rem;
                                text-align: center;
                                background: #fafbfc;
                                cursor: pointer;
                                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                            " onmouseover="this.style.borderColor='#4e92d8'; this.style.background='white'; this.style.boxShadow='0 20px 40px rgba(78, 146, 216, 0.08)';" onmouseout="this.style.borderColor='rgba(78, 146, 216, 0.2)'; this.style.background='#fafbfc'; this.style.boxShadow='none';">
                                <span class="material-icons-round" style="font-size: 3.5rem; color: #4e92d8; opacity: 0.4; margin-bottom: 1.25rem;">mic</span>
                                <div style="font-weight: 700; color: #1a1f36; margin-bottom: 0.5rem; font-family: 'Satoshi', sans-serif; font-size: 1.1rem;">Trascina qui il memo vocale</div>
                                <div style="font-size: 0.82rem; color: #697386; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 500;">Supporta MP3, WAV, M4A (Max 50MB)</div>
                                <input type="file" id="report-audio-input" accept="audio/*" style="display: none;">
                            </div>

                            <!-- Action Bar -->
                            <div id="report-action-bar" class="hidden" style="display: flex; align-items: center; justify-content: space-between; background: #fff; padding: 1.25rem; border: 1.2px solid #f1f5f9; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.03);">
                                <div style="display: flex; align-items: center; gap: 14px;">
                                    <div style="width: 38px; height: 38px; border-radius: 12px; background: rgba(78, 146, 216, 0.08); display: flex; align-items: center; justify-content: center;">
                                        <span class="material-icons-round" style="font-size: 1.35rem; color: #4e92d8;">audiotrack</span>
                                    </div>
                                    <div style="min-width: 0;">
                                        <div id="selected-audio-name" style="font-size: 0.9rem; font-weight: 700; color: #1a1f36; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px; font-family: 'Plus Jakarta Sans', sans-serif;">file_senza_nome.mp3</div>
                                        <div id="selected-audio-size" style="font-size: 0.72rem; color: #697386; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 600;">1.2 MB</div>
                                    </div>
                                </div>
                                <button id="generate-report-btn" class="nt-btn-premium" style="padding: 10px 20px; font-size: 0.82rem;">
                                    <span class="material-icons-round" style="font-size: 1.2rem;">auto_awesome</span> GENERA REPORT AI
                                </button>
                            </div>

                            <!-- Processing Status -->
                            <div id="report-processing-status" class="hidden" style="background: #fff; padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; flex-direction: column; gap: 1rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span class="material-icons-round" style="font-size: 1.2rem; color: var(--brand-blue); animation: spin-hub 2s linear infinite;">sync</span>
                                        <span id="processing-step-text" style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">Trascrizione in corso...</span>
                                    </div>
                                    <span id="processing-percentage" style="font-size: 0.8rem; font-weight: 700; color: var(--brand-blue);">45%</span>
                                </div>
                                <div style="height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;">
                                    <div id="processing-progress-bar" style="height: 100%; width: 45%; background: var(--brand-blue); transition: width 0.3s ease;"></div>
                                </div>
                                <div style="font-size: 0.75rem; color: var(--text-tertiary); text-align: center;">Tempo stimato: ~1-2 minuti. Puoi chiudere questa finestra, il report sarà disponibile sotto.</div>
                            </div>

                            <!-- Report Result (visibile quando job completato in questa stessa sessione) -->
                            <div id="report-result-pane" class="hidden" style="background: #fff; padding: 1.5rem; border: 1.5px solid rgba(16, 185, 129, 0.3); border-radius: 16px; display: flex; flex-direction: column; gap: 1rem;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(16, 185, 129, 0.12); display: flex; align-items: center; justify-content: center;">
                                        <span class="material-icons-round" style="color: #10b981;">check_circle</span>
                                    </div>
                                    <div style="flex: 1;">
                                        <div style="font-weight: 700; color: #1a1f36;">Report generato</div>
                                        <div id="report-result-meta" style="font-size: 0.72rem; color: #697386;"></div>
                                    </div>
                                </div>
                                <div>
                                    <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem;">Riassunto</div>
                                    <div id="report-result-summary" style="font-size: 0.9rem; line-height: 1.5; color: var(--text-primary);"></div>
                                </div>
                                <div id="report-result-actions-wrap">
                                    <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem;">Azioni proposte dall'AI</div>
                                    <div id="report-result-actions" style="display: flex; flex-direction: column; gap: 6px;"></div>
                                </div>
                                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.25rem;">
                                    <button id="report-open-doc-btn" class="primary-btn" style="flex: 1; min-width: 140px; background: var(--brand-blue); justify-content: center;">
                                        <span class="material-icons-round" style="font-size: 1rem;">description</span> Apri report completo
                                    </button>
                                    <button id="report-new-btn" class="primary-btn secondary" style="min-width: 100px; justify-content: center;">
                                        <span class="material-icons-round" style="font-size: 1rem;">mic</span> Nuovo memo
                                    </button>
                                </div>
                            </div>

                            <!-- Previous Reports -->
                            <div style="margin-top: 1rem;">
                                <label style="display: block; font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); margin-bottom: 1rem; text-transform:uppercase; letter-spacing: 0.05em;">REPORT PRECEDENTI</label>
                                    <div id="reports-list" style="display: flex; flex-direction: column; gap: 10px;">
                                        <div style="text-align: center; padding: 2rem; opacity: 0.5;">Caricamento report...</div>
                                    </div>
                            </div>
                        </div>
                    </div>
                    ${isExpanded ? `</div> <!-- panes-scrollable --> ${footerHtml}` : ''}
                </div>
                ${isExpanded ? '</div> <!-- drawer-content-main -->' : ''}

                ${!isExpanded ? footerHtml : ''}
            `;
            attachViewModeListeners();
            new CloudLinksManager(drawer.querySelector('#item-cloud-links-container'), item.cloud_links || [], async (newLinks) => {
                await updateItemCloudLinks(itemId, newLinks);
                item.cloud_links = newLinks;
            });

            async function loadReports() {
                const reportsList = drawer.querySelector('#reports-list');
                if (!reportsList) return;

                try {
                    // 1. Get Doc Space
                    const { data: docSpaces } = await supabase.from('doc_spaces').select('id').eq('space_ref', spaceId);
                    if (!docSpaces || docSpaces.length === 0) {
                        reportsList.innerHTML = '<div style="font-size: 0.85rem; color: #94a3b8; font-style: italic; padding: 20px; text-align: center; background: #f8fafc; border: 1.5px dashed #e2e8f0; border-radius: 12px;">Nessun report generato finora.</div>';
                        return;
                    }

                    const docSpaceId = docSpaces[0].id;

                    // 2. Get Pages
                    const { data: pages, error } = await supabase.from('doc_pages')
                        .select('id, title, created_at, metadata')
                        .eq('space_ref', docSpaceId)
                        .order('created_at', { ascending: false });

                    if (error) throw error;

                    if (!pages || pages.length === 0) {
                        reportsList.innerHTML = '<div style="font-size: 0.85rem; color: #94a3b8; font-style: italic; padding: 20px; text-align: center; background: #f8fafc; border: 1.5px dashed #e2e8f0; border-radius: 12px;">Nessun report generato finora.</div>';
                        return;
                    }

                    reportsList.innerHTML = pages.map(p => `
                        <div class="report-item glass-card" data-page-id="${p.id}" style="
                            padding: 12px 16px;
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            cursor: pointer;
                            transition: all 0.2s;
                            border: 1px solid var(--glass-border);
                        " onmouseover="this.style.borderColor='var(--brand-blue)'; this.style.background='rgba(59, 130, 246, 0.02)'" onmouseout="this.style.borderColor='var(--glass-border)'; this.style.background='white'">
                            <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                                <div style="width: 32px; height: 32px; border-radius: 8px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: var(--brand-blue);">
                                    <span class="material-icons-round" style="font-size: 1.2rem;">description</span>
                                </div>
                                <div style="min-width: 0;">
                                    <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.title}</div>
                                    <div style="font-size: 0.65rem; color: var(--text-tertiary);">${new Date(p.created_at).toLocaleString('it-IT')}</div>
                                </div>
                            </div>
                            <span class="material-icons-round" style="color: var(--text-tertiary); font-size: 1.2rem;">chevron_right</span>
                        </div>
                    `).join('');

                    // Attach listeners to report items
                    reportsList.querySelectorAll('.report-item').forEach(item => {
                        item.onclick = async () => {
                            const pageId = item.dataset.pageId;
                            // Open in document viewer (assuming existing router)
                            window.location.hash = `#docs/${pageId}`;
                            closeHubDrawer();
                        };
                    });

                } catch (e) {
                    console.error("[ReportAuto] Error loading reports:", e);
                    reportsList.innerHTML = '<div style="color: #ef4444; font-size: 0.8rem; padding: 10px;">Errore durante il caricamento.</div>';
                }
            }

            // Mostra il pannello risultato (summary + action items) e crea il doc_page
            async function displayReportResult(jobData) {
                const resultPane = drawer.querySelector('#report-result-pane');
                const summaryEl = drawer.querySelector('#report-result-summary');
                const actionsEl = drawer.querySelector('#report-result-actions');
                const actionsWrap = drawer.querySelector('#report-result-actions-wrap');
                const metaEl = drawer.querySelector('#report-result-meta');
                const openDocBtn = drawer.querySelector('#report-open-doc-btn');
                const newBtn = drawer.querySelector('#report-new-btn');
                if (!resultPane) return;

                // 1. Crea (o riusa) il doc_space del pm_space, poi crea un doc_page col report
                let docPageId = jobData.doc_page_id || null;
                if (!docPageId) {
                    try {
                        // Trova o crea doc_space per questo pm_space
                        let { data: docSpaces } = await supabase
                            .from('doc_spaces')
                            .select('id')
                            .eq('space_ref', spaceId)
                            .limit(1);
                        let docSpaceId = docSpaces?.[0]?.id;
                        if (!docSpaceId) {
                            const { data: newDocSpace, error: dsErr } = await supabase
                                .from('doc_spaces')
                                .insert({ space_ref: spaceId, name: 'Report' })
                                .select()
                                .single();
                            if (dsErr) throw dsErr;
                            docSpaceId = newDocSpace.id;
                        }

                        // Crea doc_page col report markdown
                        const title = 'Report ' + new Date(jobData.completed_at || Date.now())
                            .toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                        const { data: newPage, error: pageErr } = await supabase
                            .from('doc_pages')
                            .insert({
                                space_ref: docSpaceId,
                                title,
                                metadata: {
                                    source: 'voice_memo',
                                    job_id: jobData.id,
                                    audio_url: jobData.audio_url,
                                    summary: jobData.summary,
                                    action_items: jobData.action_items,
                                }
                            })
                            .select()
                            .single();
                        if (pageErr) throw pageErr;
                        docPageId = newPage.id;

                        // Crea un doc_block "text" col markdown del report
                        await supabase
                            .from('doc_blocks')
                            .insert({
                                page_ref: docPageId,
                                block_type: 'text',
                                content: { markdown: jobData.report_markdown || jobData.transcription || '' },
                                position: 0,
                            });

                        // Aggiorna il job con il doc_page_id
                        await supabase
                            .from('pm_ai_report_jobs')
                            .update({ doc_page_id: docPageId })
                            .eq('id', jobData.id);
                    } catch (err) {
                        console.error('[displayReportResult] save doc_page failed', err);
                    }
                }

                // 2. Popola il pannello
                summaryEl.textContent = jobData.summary || '(nessun riassunto disponibile)';

                const items = Array.isArray(jobData.action_items) ? jobData.action_items : [];
                if (items.length === 0) {
                    actionsWrap.style.display = 'none';
                } else {
                    actionsWrap.style.display = 'block';
                    actionsEl.innerHTML = items.map((ai, idx) => {
                        const priorityColor = ai.priority === 'alta' ? '#ef4444'
                            : ai.priority === 'media' ? '#f59e0b' : '#64748b';
                        const meta = [ai.assignee_hint, ai.due_hint].filter(Boolean).join(' · ');
                        return '<div data-idx="' + idx + '" style="display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; background: #f8fafc; border-radius: 8px; border-left: 3px solid ' + priorityColor + ';">'
                            + '<span class="material-icons-round" style="color: ' + priorityColor + '; font-size: 1rem; margin-top: 2px;">task_alt</span>'
                            + '<div style="flex: 1; min-width: 0;">'
                            + '<div style="font-size: 0.85rem; color: var(--text-primary); line-height: 1.35;">' + (ai.text || '') + '</div>'
                            + (meta ? '<div style="font-size: 0.7rem; color: var(--text-tertiary); margin-top: 2px;">' + meta + '</div>' : '')
                            + '</div>'
                            + '<button class="action-create-task-btn" data-idx="' + idx + '" title="Crea task da questa azione" style="background: none; border: 1px solid var(--glass-border); padding: 4px 8px; border-radius: 6px; cursor: pointer; font-size: 0.7rem; color: var(--brand-blue); white-space: nowrap;">+ task</button>'
                            + '</div>';
                    }).join('');

                    // Wire create-task buttons
                    actionsEl.querySelectorAll('.action-create-task-btn').forEach(btn => {
                        btn.onclick = async (e) => {
                            e.stopPropagation();
                            const idx = parseInt(btn.dataset.idx, 10);
                            const ai = items[idx];
                            if (!ai) return;
                            btn.disabled = true;
                            btn.textContent = '…';
                            try {
                                // Crea pm_item come task figlio dell'item corrente (se isEdit), altrimenti nello space
                                const taskData = {
                                    space_ref: spaceId,
                                    title: ai.text,
                                    item_type: 'task',
                                    status: 'todo',
                                    priority: ai.priority === 'alta' ? 'urgent' : ai.priority === 'media' ? 'normal' : 'low',
                                };
                                if (isEdit && itemId) taskData.parent_ref = itemId;
                                const { error: taskErr } = await supabase.from('pm_items').insert(taskData);
                                if (taskErr) throw taskErr;
                                btn.textContent = '✓ creata';
                                btn.style.color = 'var(--color-success, #10b981)';
                                btn.style.borderColor = 'var(--color-success, #10b981)';
                                if (window.showGlobalAlert) window.showGlobalAlert('Task creata: ' + ai.text);
                            } catch (err) {
                                console.error('[create task from action] error', err);
                                btn.disabled = false;
                                btn.textContent = '+ task';
                                if (window.showGlobalAlert) window.showGlobalAlert('Errore: ' + err.message, 'error');
                            }
                        };
                    });
                }

                const costNote = jobData.cost_eur ? '€' + Number(jobData.cost_eur).toFixed(4) : '';
                metaEl.textContent = (jobData.tokens_used ? jobData.tokens_used + ' token' : '') + (costNote ? ' · ' + costNote : '');

                if (openDocBtn) {
                    openDocBtn.onclick = () => {
                        if (docPageId) {
                            window.location.hash = '#docs/' + docPageId;
                            if (typeof closeHubDrawer === 'function') closeHubDrawer();
                        }
                    };
                }
                if (newBtn) {
                    newBtn.onclick = () => {
                        resultPane.classList.add('hidden');
                        const uz = drawer.querySelector('#report-upload-zone');
                        if (uz) uz.style.display = 'block';
                    };
                }

                resultPane.classList.remove('hidden');
            }

            async function pollJobStatus(jobId) {
                const stepText = drawer.querySelector('#processing-step-text');
                const progressBar = drawer.querySelector('#processing-progress-bar');
                const percentage = drawer.querySelector('#processing-percentage');

                let attempts = 0;
                const maxAttempts = 120; // 10 minutes max

                const interval = setInterval(async () => {
                    attempts++;
                    if (attempts > maxAttempts) {
                        clearInterval(interval);
                        stepText.textContent = "Errore: Tempo scaduto.";
                        return;
                    }

                    const { data, error } = await supabase.from('pm_ai_report_jobs').select('*').eq('id', jobId).single();
                    if (error) return;

                    if (data.status === 'processing') {
                        stepText.textContent = "Gemini sta analizzando l'audio...";
                        progressBar.style.width = '50%';
                        percentage.textContent = '50%';
                    } else if (data.status === 'completed') {
                        clearInterval(interval);
                        stepText.textContent = "Report Generato!";
                        progressBar.style.width = '100%';
                        percentage.textContent = '100%';

                        setTimeout(async () => {
                            statusPane.classList.add('hidden');
                            generateBtn.disabled = false;
                            generateBtn.innerHTML = `<span class="material-icons-round" style="font-size: 1.1rem;">auto_awesome</span> GENERA REPORT AI`;
                            await displayReportResult(data);
                            loadReports(); // Refresh the list
                            if (window.showGlobalAlert) window.showGlobalAlert("Report AI completato con successo!");
                        }, 1500);
                    } else if (data.status === 'failed') {
                        clearInterval(interval);
                        stepText.textContent = "Errore nella generazione.";
                        if (window.showGlobalAlert) window.showGlobalAlert("Errore AI: " + (data.error_message || "Generazione fallita"), 'error');
                        generateBtn.disabled = false;
                    }
                }, 5000);
            }

            // Init Activity Log
            if (state.profile?.role === 'admin') {
                import('./activity_log.js?v=8000').then(mod => {
                    const logContainer = drawer.querySelector('#drawer-activity-log-container');

                    let targetItemIds = [itemId];
                    if (subItems && subItems.length > 0) {
                        targetItemIds = targetItemIds.concat(subItems.map(s => s.id));
                    }

                    if (logContainer) mod.renderActivityLog(logContainer, { itemIds: targetItemIds, itemId: itemId });
                }).catch(e => console.error("Error loading Activity Log", e));
            }

            // Report Tab Listeners
            const uploadZone = drawer.querySelector('#report-upload-zone');
            const audioInput = drawer.querySelector('#report-audio-input');
            const actionBar = drawer.querySelector('#report-action-bar');
            const generateBtn = drawer.querySelector('#generate-report-btn');
            const statusPane = drawer.querySelector('#report-processing-status');

            if (uploadZone && audioInput) {
                uploadZone.onclick = () => audioInput.click();
                audioInput.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        drawer.querySelector('#selected-audio-name').textContent = file.name;
                        drawer.querySelector('#selected-audio-size').textContent = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
                        actionBar.classList.remove('hidden');
                        uploadZone.style.display = 'none';
                    }
                };
            }

            if (generateBtn) {
                generateBtn.onclick = async () => {
                    const file = audioInput.files[0];
                    if (!file) return;

                    generateBtn.disabled = true;
                    generateBtn.innerHTML = `<span class="material-icons-round" style="font-size: 1.1rem; animation: spin-hub 1s linear infinite;">sync</span> CARICAMENTO...`;

                    try {
                        // 1. Upload to Supabase
                        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                        const filePath = `${itemId}/${fileName}`;
                        const { data, error } = await supabase.storage.from('voice_memos').upload(filePath, file);
                        if (error) throw error;

                        const { data: { publicUrl } } = supabase.storage.from('voice_memos').getPublicUrl(filePath);

                        // 2. Start AI Processing
                        actionBar.classList.add('hidden');
                        statusPane.classList.remove('hidden');

                        // 2. Queue AI Job
                        const { data: jobData, error: jobError } = await supabase.from('pm_ai_report_jobs').insert({
                            space_ref: spaceId,
                            item_ref: itemId,
                            audio_url: publicUrl,
                            status: 'pending'
                        }).select();

                        if (jobError) throw jobError;
                        const jobId = jobData[0].id;

                        console.log("[ReportAuto] Job queued:", jobId);

                        // UPDATE UI TO WAITING STATE
                        drawer.querySelector('#processing-step-text').textContent = "Inviato. In attesa di AI...";
                        drawer.querySelector('#processing-progress-bar').style.width = '10%';
                        drawer.querySelector('#processing-percentage').textContent = '10%';

                        if (window.showGlobalAlert) window.showGlobalAlert("Audio caricato! L'AI inizierà ora l'elaborazione.");

                        // 3. Trigger AI processing (fire-and-forget, il polling gestisce il resto)
                        supabase.functions.invoke('process-voice-memo', { body: { job_id: jobId } })
                            .then(({ error }) => {
                                if (error) console.warn("[ReportAuto] Edge function invoke warning:", error);
                            })
                            .catch(err => console.error("[ReportAuto] Edge function invoke error:", err));

                        // 4. Start Polling
                        pollJobStatus(jobId);
                    } catch (e) {
                        console.error(e);
                        if (window.showGlobalAlert) window.showGlobalAlert("Errore durante l'upload: " + e.message, 'error');
                        generateBtn.disabled = false;
                        generateBtn.innerHTML = `<span class="material-icons-round" style="font-size: 1.1rem;">auto_awesome</span> GENERA REPORT AI`;
                    }
                };
            }

            // Tab switching logic (updated to handle 'report' tab)
            const tabs = drawer.querySelectorAll('.drawer-tab');
            const panes = drawer.querySelectorAll('.tab-pane');

            window.setDrawerTab = (tabName) => {
                // Mark comments as read when switching to comments tab
                if (isEdit && tabName === 'comments' && unreadCommentsCount > 0) {
                    updatePMItemViewLog(itemId);
                    unreadCommentsCount = 0;
                    const badge = drawer.querySelector('.unread-badge');
                    if (badge) badge.remove();
                }

                tabs.forEach(t => {
                    const isActive = t.dataset.tab === tabName;
                    t.classList.toggle('active', isActive);
                    t.style.color = isActive ? 'var(--brand-blue)' : 'var(--text-tertiary)';
                    t.style.fontWeight = isActive ? '700' : '600';
                    t.style.borderBottomColor = isActive ? 'var(--brand-blue)' : 'transparent';
                });
                panes.forEach(p => {
                    p.classList.toggle('hidden', p.id !== `tab-${tabName}`);
                });

                // Toggle Anchored Footer
                const footer = drawer.querySelector('#drawer-footer-comments');
                if (footer) {
                    footer.classList.toggle('hidden', tabName !== 'comments');
                }

                // If switching to report tab, load reports
                if (tabName === 'report') {
                    loadReports();
                }
            };

            // If we're opening on comments tab (default for non-admins), mark as read immediately
            if (isEdit && unreadCommentsCount > 0 && state.profile?.role !== 'admin') {
                updatePMItemViewLog(itemId);
                unreadCommentsCount = 0;
                // Note: badge is rendered based on initial unreadCommentsCount, but non-admins would be in tab-comments already which is not hidden
            }

            tabs.forEach(tab => {
                tab.addEventListener('click', () => window.setDrawerTab(tab.dataset.tab));
            });
        } else {
            drawer.innerHTML = `
                <style>
                    #item-form .form-group label {
                        font-family: 'Plus Jakarta Sans', sans-serif !important;
                        font-weight: 700 !important;
                        letter-spacing: 0.05em !important;
                        color: #697386 !important;
                        text-transform: uppercase !important;
                        font-size: 0.65rem !important;
                        margin-bottom: 0.65rem !important;
                        display: block;
                    }
                    #item-form .input-modern {
                        font-family: 'Plus Jakarta Sans', sans-serif !important;
                        transition: all 0.3s ease !important;
                        border: 1.2px solid #f1f5f9 !important;
                        background: #fff !important;
                        border-radius: 10px !important;
                        color: #1a1f36 !important;
                        font-weight: 500 !important;
                    }
                    #item-form .input-modern:focus {
                        border-color: #4e92d8 !important;
                        box-shadow: 0 0 0 4px rgba(78, 146, 216, 0.12) !important;
                    }
                    .form-grid-2 {
                        display: grid; 
                        grid-template-columns: 1fr 1fr; 
                        gap: 1.5rem;
                    }
                    @media (max-width: 768px) {
                        .drawer-header-new {
                            padding: 1.25rem 1rem !important;
                            padding-top: calc(1rem + env(safe-area-inset-top, 40px)) !important;
                        }
                        .drawer-body-new {
                            padding: 1rem !important;
                        }
                        .form-grid-2 {
                            grid-template-columns: 1fr !important;
                            gap: 1.25rem !important;
                        }
                        #item-form {
                            gap: 1.25rem !important;
                        }
                        .drawer-footer-new {
                            padding: 1rem !important;
                            padding-bottom: calc(1rem + env(safe-area-inset-bottom, 20px)) !important;
                        }
                    }
                </style>
                <div class="drawer-header drawer-header-new" style="padding: 1.25rem 2rem; border-bottom: 1.2px solid rgba(0,0,0,0.06); display: flex; justify-content: space-between; align-items: center; background: #ffffff !important; flex-shrink: 0; position: sticky; top: 0; z-index: 100;">
                    <div style="display: flex; flex-direction: column; overflow: hidden; min-width: 0;">
                        ${item && item.parent_item ? `
                        <div id="back-to-parent-btn" style="display: flex; align-items: center; gap: 4px; font-size: 0.72rem; font-weight: 800; color: #4e92d8; cursor: pointer; margin-bottom: 4px; text-transform: uppercase; transition: opacity 0.2s; font-family: 'Plus Jakarta Sans', sans-serif;" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">
                            <span class="material-icons-round" style="font-size: 1rem;">arrow_back</span>
                            Torna a ${item.parent_item.title}
                        </div>
                        ` : ''}
                        <h2 style="margin: 0; font-size: 1.35rem; font-weight: 700; color: #1a1f36; letter-spacing: -0.02em; font-family: 'Satoshi', sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${isEdit ? 'Modifica' : 'Nuova'} ${(() => {
                    switch (item.item_type || itemType) {
                        case 'task': return 'Task';
                        case 'milestone': return 'Milestone';
                        case 'appointment': return 'Appuntamento';
                        case 'note': return 'Nota';
                        default: return 'Attività';
                    }
                })()}
                        </h2>
                    </div>
                    <button id="header-close-btn" class="icon-btn" style="width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #fafbfc; border: 1.2px solid #f1f5f9; color: #a0aec0; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#ef4444'; this.style.color='#ef4444';" onmouseout="this.style.borderColor='#f1f5f9'; this.style.color='#a0aec0';"><span class="material-icons-round" style="font-size: 20px;">close</span></button>
                </div>
                <div class="drawer-body drawer-body-new" style="flex: 1; overflow-y: auto; padding: 2rem; background: #fcfcfd;">
                    <form id="item-form" style="display: flex; flex-direction: column; gap: 1.75rem; max-width: 580px; margin: 0 auto;">
                        <input type="hidden" id="task-space-ref" name="space_ref" value="${currentSpaceId || ''}">
                        <input type="hidden" name="item_type" value="${item.item_type || itemType}">
                        <input type="hidden" name="parent_ref" value="${currentParentRef || ''}">
                        <input type="hidden" name="is_account_level" value="${item.is_account_level ? 'true' : 'false'}">
                        
                        <!-- Context Selection -->
                        ${!currentSpaceId ? `
                        <div class="form-group">
                            <label>Progetto o Commessa</label>
                            <div style="position: relative;">
                                <div id="context-picker-trigger" style="
                                    padding: 0 14px; height: 44px; background: #fff; border: 1.2px solid #e2e8f0; border-radius: 10px; 
                                    font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: space-between;
                                    transition: all 0.2s; font-family: 'Outfit', sans-serif;
                                ">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <span class="material-icons-round" style="font-size: 18px; color: var(--brand-blue);">
                                            ${currentSpaceId ? (state.pm_spaces?.find(x => x.id === currentSpaceId)?.type === 'interno' ? 'folder_special' : 'style') : (currentClientId ? 'person' : 'room_service')}
                                        </span>
                                        <span style="${!currentSpaceId && !currentClientId ? 'color: var(--text-tertiary);' : 'font-weight: 500;'}">
                                            ${(() => {
                        if (currentSpaceId) {
                            const s = state.pm_spaces?.find(x => x.id === currentSpaceId);
                            if (s?.type === 'commessa') {
                                const o = state.orders?.find(x => x.id === s.ref_ordine);
                                return o ? `#${o.order_number} ${o.title}` : s.name || 'Commessa';
                            }
                            return s?.name || 'Progetto Interno';
                        }
                        if (currentClientId) {
                            const c = state.clients?.find(x => x.id === currentClientId);
                            return c ? `Cliente: ${c.business_name}` : 'Cliente Selezionato';
                        }
                        return 'Seleziona contesto...';
                    })()}
                                        </span>
                                    </div>
                                    <span class="material-icons-round" style="font-size: 18px; color: var(--text-tertiary);">expand_more</span>
                                </div>
                                <div id="context-picker-dropdown" class="hidden glass-card" style="
                                    position: absolute; top: calc(100% + 6px); left: 0; width: 100%; z-index: 1000;
                                    background: white; border: 1.2px solid #e2e8f0; border-radius: 12px;
                                    box-shadow: 0 12px 48px rgba(0,0,0,0.12); padding: 10px;
                                ">
                                    <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                                        <input type="text" id="context-search" placeholder="Cerca progetto..." class="input-modern" style="flex: 1; font-size: 0.85rem; height: 36px; padding: 0 12px; border-radius: 8px; border: 1.2px solid #e2e8f0;">
                                        <button type="button" id="clear-context-btn" title="Rimuovi" style="background: #f8fafc; border: 1.2px solid #e2e8f0; border-radius: 8px; padding: 0 8px; cursor: pointer; color: var(--text-tertiary);">
                                            <span class="material-icons-round" style="font-size: 18px;">backspace</span>
                                        </button>
                                    </div>
                                    <div id="context-options-list" style="max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px;"></div>
                                </div>
                            </div>
                        </div>
                        <div style="height: 1px; background: #f1f5f9; margin: 0.5rem 0;"></div>
                        ` : ''}

                        <!-- Title -->
                        <div class="form-group">
                            <label>Titolo</label>
                            <input type="text" name="title" required value="${item.title || ''}" class="input-modern" style="height: 48px; padding: 0 16px; border-radius: 12px; font-weight: 600; font-size: 1rem; border: 1.2px solid #e2e8f0; width: 100%; box-sizing: border-box; background: #fff;" placeholder="Cosa dobbiamo fare?">
                        </div>

                        <div style="height: 1px; background: #f1f5f9; margin: 0.5rem 0;"></div>
                        
                        <!-- People -->
                        <div class="form-grid-2">
                            <div class="form-group">
                                <label>Project Manager</label>
                                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px; border: 1.2px solid #e2e8f0; border-radius: 12px; min-height: 48px; background: white; box-sizing: border-box;">
                                    ${pendingAssignees.filter(a => a.role === 'pm').map((a) => {
                        const originalIdx = pendingAssignees.indexOf(a);
                        return `
                                        <div class="pending-assignee-pill" style="display: flex; align-items: center; gap: 6px; background: #f5f3ff; color: #7c3aed; padding: 4px 10px; border-radius: 8px; font-size: 0.8rem; font-weight: 500; border: 1px solid #ddd6fe; max-width: 100%; font-family: 'Outfit', sans-serif;">
                                            <img src="${a.user?.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(a.displayName)}" style="width: 20px; height: 20px; border-radius: 6px;">
                                            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${a.displayName || a.user?.full_name || [a.user?.first_name, a.user?.last_name].filter(v => v && v !== 'null').join(' ') || 'User'}</span>
                                            <span class="material-icons-round remove-pending-btn" data-idx="${originalIdx}" style="font-size: 14px; cursor: pointer; opacity: 0.6;">close</span>
                                        </div>
                                        `;
                    }).join('')}
                                    <div style="position: relative;">
                                        <button type="button" id="form-add-pm-btn" style="width: 32px; height: 32px; border-radius: 8px; border: 1.2px dashed #cbd5e1; background: transparent; color: var(--text-tertiary); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"><span class="material-icons-round" style="font-size: 20px;">add</span></button>
                                        <div id="form-pm-picker" class="hidden glass-card" style="position: absolute; top: calc(100% + 6px); left: 0; width: 260px; background: white; border: 1.2px solid #e2e8f0; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); z-index: 1000; padding: 0; overflow: hidden;">
                                            ${renderUserPicker(currentSpaceId, 'pm', new Set(pendingAssignees.filter(a => a.role === 'pm').map(a => a.user_ref || a.collaborator_ref)), new Set(spaceAssigneesPool.map(sa => sa.collaborator_ref || sa.user_ref)), 'Tutti i responsabili')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="form-group">
                                <label>Assegnato a</label>
                                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px; border: 1.2px solid #e2e8f0; border-radius: 12px; min-height: 48px; background: white; box-sizing: border-box;">
                                    ${pendingAssignees.filter(a => a.role !== 'pm').map((a) => {
                        const originalIdx = pendingAssignees.indexOf(a);
                        return `
                                        <div class="pending-assignee-pill" style="display: flex; align-items: center; gap: 6px; background: #f8fafc; padding: 4px 10px; border-radius: 8px; font-size: 0.8rem; font-weight: 500; border: 1.2px solid #e2e8f0; color: var(--text-primary); max-width: 100%; font-family: 'Outfit', sans-serif;">
                                            <img src="${a.user?.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(a.displayName)}" style="width: 20px; height: 20px; border-radius: 6px;">
                                            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${a.displayName}</span>
                                            <span class="material-icons-round remove-pending-btn" data-idx="${originalIdx}" style="font-size: 14px; cursor: pointer; color: var(--text-tertiary);">close</span>
                                        </div>
                                        `;
                    }).join('')}
                                    <div style="position: relative;">
                                        <button type="button" id="form-add-assignee-btn" style="width: 32px; height: 32px; border-radius: 8px; border: 1.2px dashed #cbd5e1; background: transparent; color: var(--text-tertiary); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"><span class="material-icons-round" style="font-size: 20px;">add</span></button>
                                        <div id="form-assignee-picker" class="hidden glass-card" style="position: absolute; top: calc(100% + 6px); left: 0; width: 260px; background: #fff; border: 1.2px solid #e2e8f0; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); z-index: 1000; padding: 0; overflow: hidden;">
                                            ${renderUserPicker(currentSpaceId, 'assignee', new Set(pendingAssignees.filter(a => a.role !== 'pm').map(a => a.user_ref || a.collaborator_ref)), new Set(spaceAssigneesPool.map(sa => sa.collaborator_ref || sa.user_ref)), 'Tutti i collaboratori')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>


                        <div style="height: 1px; background: #f1f5f9; margin: 0.5rem 0;"></div>

                        <!-- Dates & Priority -->
                        <div class="form-grid-2">
                            <div class="form-group">
                                <label>Pianificazione</label>
                                <div style="display: flex; gap: 8px;">
                                    <div id="form-start-date-trigger" style="flex: 1; cursor: pointer; display: flex; align-items: center; gap: 8px; height: 48px; background: #fff; border: 1.2px solid #e2e8f0; border-radius: 12px; padding: 0 12px; font-size: 0.9rem; font-family: 'Outfit', sans-serif;">
                                        <span class="material-icons-round" style="font-size: 18px; color: var(--text-tertiary);">play_arrow</span>
                                        <span style="${!item.start_date ? 'color: var(--text-tertiary);' : 'font-weight: 600;'}">${item.start_date ? new Date(item.start_date).toLocaleDateString('it-IT') : 'Inizio'}</span>
                                    </div>
                                    <div id="form-due-date-trigger" style="flex: 1; cursor: pointer; display: flex; align-items: center; gap: 8px; height: 48px; background: #fff; border: 1.2px solid #e2e8f0; border-radius: 12px; padding: 0 12px; font-size: 0.9rem; font-family: 'Outfit', sans-serif;">
                                        <span class="material-icons-round" style="font-size: 18px; color: var(--text-tertiary);">event_available</span>
                                        <span style="${!item.due_date ? 'color: var(--text-tertiary);' : 'font-weight: 600;'}">${item.due_date ? new Date(item.due_date).toLocaleDateString('it-IT') : 'Scadenza'}</span>
                                    </div>
                                </div>
                                <input type="hidden" name="start_date" value="${item.start_date || ''}">
                                <input type="hidden" name="due_date" value="${item.due_date || ''}">
                            </div>
                            <div class="form-group">
                                <label>Stato e Priorità</label>
                                <div style="display: flex; gap: 8px;">
                                     <div style="flex: 1.2; position: relative;">
                                        <div id="form-status-trigger" style="height: 48px; padding: 0 12px; border-radius: 12px; border: 1.2px solid #e2e8f0; background: #fff; font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-family: 'Outfit', sans-serif;">
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${ITEM_STATUS[item.status || 'todo']?.color || '#94a3b8'};"></div>
                                                <span>${ITEM_STATUS[item.status || 'todo']?.label || 'Da Fare'}</span>
                                            </div>
                                            <span class="material-icons-round" style="font-size: 18px; color: var(--text-tertiary);">expand_more</span>
                                        </div>
                                        <div id="form-status-picker" class="hidden glass-card" style="position: absolute; top: calc(100% + 6px); left: 0; width: 100%; z-index: 1000; background: #fff; border: 1.2px solid #e2e8f0; border-radius: 12px; box-shadow: 0 12px 48px rgba(0,0,0,0.12); padding: 6px;">
                                            ${Object.keys(ITEM_STATUS).map(k => `
                                                <div class="status-option-item" data-value="${k}" style="padding: 10px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; transition: background 0.2s; font-family: 'Outfit', sans-serif; font-weight: 600;">
                                                    <div style="width: 8px; height: 8px; border-radius: 50%; background: ${ITEM_STATUS[k].color};"></div>
                                                    <span>${ITEM_STATUS[k].label}</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                        <input type="hidden" name="status" value="${item.status || 'todo'}">
                                    </div>
                                    <div style="flex: 1; position: relative;">
                                        <div id="form-priority-trigger" style="height: 48px; padding: 0 12px; border-radius: 12px; border: 1.2px solid #e2e8f0; background: #fff; font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-family: 'Outfit', sans-serif;">
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <span class="material-icons-round" style="font-size: 18px; color: ${ITEM_PRIORITY[item.priority || 'medium']?.color || '#94a3b8'};">flag</span>
                                                <span>${ITEM_PRIORITY[item.priority || 'medium']?.label || 'Media'}</span>
                                            </div>
                                            <span class="material-icons-round" style="font-size: 18px; color: var(--text-tertiary);">expand_more</span>
                                        </div>
                                        <div id="form-priority-picker" class="hidden glass-card" style="position: absolute; top: calc(100% + 6px); left: 0; width: 100%; z-index: 1000; background: #fff; border: 1.2px solid #e2e8f0; border-radius: 12px; box-shadow: 0 12px 48px rgba(0,0,0,0.12); padding: 6px;">
                                            ${Object.keys(ITEM_PRIORITY).map(k => `
                                                <div class="priority-option-item" data-value="${k}" style="padding: 10px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; transition: background 0.2s; font-family: 'Outfit', sans-serif; font-weight: 600;">
                                                    <span class="material-icons-round" style="font-size: 18px; color: ${ITEM_PRIORITY[k].color || '#94a3b8'};">flag</span>
                                                    <span>${ITEM_PRIORITY[k].label}</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                        <input type="hidden" name="priority" value="${item.priority || 'medium'}">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style="height: 1px; background: #f1f5f9; margin: 0.5rem 0;"></div>

                        <!-- Recurrence -->
                        ${!isEdit ? `
                        <div class="recurrence-section">
                            <button type="button" id="toggle-recurrence-btn" style="
                                width: 100%; padding: 0.85rem 1rem; background: #fff; border: 1.2px solid #e2e8f0; 
                                border-radius: 12px; display: flex; align-items: center; justify-content: space-between;
                                cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.02);
                            ">
                                <div style="display: flex; align-items: center; gap: 10px; color: var(--text-primary); font-weight: 600; font-size: 0.9rem; font-family: 'Outfit', sans-serif;">
                                    <span class="material-icons-round" style="font-size: 20px; color: var(--brand-blue);">cached</span>
                                    Pianifica come Ricorrente
                                </div>
                                <span class="material-icons-round toggle-icon" style="color: var(--text-tertiary); transition: transform 0.3s; font-size: 20px;">expand_more</span>
                            </button>
                            
                            <div id="recurrence-settings-content" class="hidden" style="
                                padding: 1.5rem; background: #fff; border: 1.2px solid #e2e8f0; border-top: none; 
                                border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; margin-top: -1px;
                            ">
                                <div class="form-grid-2" style="margin-bottom: 1.25rem;">
                                    <div>
                                        <label>Frequenza</label>
                                        <select name="rec_freq" style="height: 44px; width: 100%; border-radius: 10px; border: 1.2px solid #e2e8f0; padding: 0 10px; font-size: 0.9rem; font-family: 'Outfit', sans-serif; font-weight: 500;">
                                            <option value="">Nessuna</option>
                                            <option value="DAILY">Ogni giorno</option>
                                            <option value="WEEKLY">Ogni settimana</option>
                                            <option value="MONTHLY">Ogni mese</option>
                                            <option value="YEARLY">Ogni anno</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Ogni quanto</label>
                                        <div style="display: flex; gap: 8px;">
                                            <input type="number" name="rec_interval" value="1" min="1" style="width: 60px; height: 44px; text-align: center; border-radius: 10px; border: 1.2px solid #e2e8f0; padding: 0; font-family: 'Outfit', sans-serif; font-weight: 600;">
                                            <select name="rec_unit" style="flex: 1; height: 44px; border-radius: 10px; border: 1.2px solid #e2e8f0; padding: 0 10px; font-size: 0.9rem; font-family: 'Outfit', sans-serif; font-weight: 500;">
                                                <option value="day">giorno</option>
                                                <option value="workday">giorno lav.</option>
                                                <option value="week">settimana</option>
                                                <option value="month">mese</option>
                                                <option value="year">anno</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div class="form-grid-2" style="margin-bottom: 1.25rem;">
                                    <div>
                                        <label>Dalla data</label>
                                        <div id="form-rec-start-trigger" style="cursor: pointer; display: flex; align-items: center; gap: 10px; height: 44px; border-radius: 10px; border: 1.2px solid #e2e8f0; padding: 0 12px; font-size: 0.9rem; background: #fff; font-family: 'Outfit', sans-serif;">
                                            <span class="material-icons-round" style="font-size: 18px; color: var(--text-tertiary);">event</span>
                                            <span style="font-weight: 600;">${new Date().toLocaleDateString('it-IT')}</span>
                                        </div>
                                        <input type="hidden" name="rec_start" value="${new Date().toISOString().split('T')[0]}">
                                    </div>
                                    <div>
                                        <label>Fino a (opz.)</label>
                                        <div id="form-rec-until-trigger" style="cursor: pointer; display: flex; align-items: center; gap: 10px; height: 44px; border-radius: 10px; border: 1.2px solid #e2e8f0; padding: 0 12px; font-size: 0.9rem; background: #fff; font-family: 'Outfit', sans-serif;">
                                            <span class="material-icons-round" style="font-size: 18px; color: var(--text-tertiary);">event_busy</span>
                                            <span style="color: var(--text-tertiary); font-style: italic;">Sempre</span>
                                        </div>
                                        <input type="hidden" name="rec_until" value="">
                                    </div>
                                </div>

                                <div class="form-grid-2" style="border-top: 1px solid #f1f5f9; padding-top: 1.25rem;">
                                    <div style="display: flex; flex-direction: column; gap: 10px;">
                                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: var(--text-secondary); font-size: 0.9rem; font-weight: 600; font-family: 'Outfit', sans-serif; text-transform: none !important;">
                                            <input type="checkbox" name="rec_limit_active" style="width: 18px; height: 18px; border-radius: 4px; accent-color: var(--brand-blue);">
                                            Termina dopo
                                        </label>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <input type="number" name="rec_limit_count" value="10" min="1" style="width: 70px; height: 36px; border-radius: 8px; border: 1.2px solid #e2e8f0; text-align: center; font-size: 0.9rem; font-weight: 600; font-family: 'Outfit', sans-serif;">
                                            <span style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: 700; text-transform: uppercase;">volte</span>
                                        </div>
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 10px;">
                                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: var(--text-secondary); font-size: 0.9rem; font-weight: 600; font-family: 'Outfit', sans-serif; text-transform: none !important;">
                                            <input type="checkbox" name="rec_advance_active" style="width: 18px; height: 18px; border-radius: 4px; accent-color: var(--brand-blue);">
                                            Crea in anticipo
                                        </label>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <input type="number" name="rec_advance_count" value="1" min="1" style="width: 70px; height: 36px; border-radius: 8px; border: 1.2px solid #e2e8f0; text-align: center; font-size: 0.9rem; font-weight: 600; font-family: 'Outfit', sans-serif;">
                                            <span style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: 700; text-transform: uppercase;">task</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        ` : ''}

                        <div style="height: 1px; background: #f1f5f9; margin: 0.5rem 0;"></div>

                        <!-- Notes -->
                        <div class="form-group" style="padding-top: 0.5rem;">
                            <label>Descrizione o Note</label>
                            <textarea name="notes" rows="6" class="input-modern" style="padding: 16px; font-size: 1rem; line-height: 1.6; border-radius: 12px; border: 1.2px solid #e2e8f0; width: 100%; box-sizing: border-box; resize: vertical; min-height: 120px; background: #fff;" placeholder="Aggiungi dettagli importanti...">${item.notes || ''}</textarea>
                        </div>
                    </form>
                </div>
                <div class="drawer-footer drawer-footer-new" style="padding: 1.25rem 2rem; border-top: 1px solid var(--glass-border); display: flex; justify-content: flex-end; gap: 0.75rem; background: #ffffff !important; flex-shrink: 0; position: sticky; bottom: 0; z-index: 100;">
                    <button type="button" class="secondary-btn" id="cancel-edit-btn" style="padding: 0.75rem 1.5rem; font-weight: 600; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff; color: var(--text-secondary); cursor: pointer; transition: all 0.2s; font-family: 'Outfit', sans-serif;">Annulla</button>
                    <button type="submit" form="item-form" class="primary-btn" style="padding: 0.75rem 2rem; font-weight: 700; border-radius: 12px; background: var(--brand-blue); color: white; border: none; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25); font-family: 'Outfit', sans-serif;">${isEdit ? 'Salva Modifiche' : 'Crea Attività'}</button>
                </div>
            `;
            attachEditModeListeners();
        }
    };

    const attachViewModeListeners = () => {
        const close = closeHubDrawer;
        drawer.querySelector('#header-close-btn').onclick = close;

        // Clickable Breadcrumbs
        drawer.querySelectorAll('.breadcrumb-clickable').forEach(el => {
            el.onclick = () => {
                const type = el.dataset.type;
                const id = el.dataset.id;
                const orderRef = el.dataset.orderRef;

                if (type === 'item' && id) {
                    openHubDrawer(id, currentSpaceId);
                } else if (type === 'client' && id) {
                    window.location.hash = `#anagrafica/clienti/view/${id}`;
                    close();
                } else if (type === 'space' && id) {
                    if (orderRef && orderRef !== 'undefined' && orderRef !== 'null') {
                        window.location.hash = `#pm/commessa/${orderRef}`;
                    } else {
                        window.location.hash = `#pm/space/${id}`; // For internal projects
                    }
                    close();
                } else if (type === 'cluster' && id) {
                    window.location.hash = `#pm/space/${id}`; // A cluster is also a space
                    close();
                } else if (type === 'area') {
                    const label = el.textContent.toLowerCase();
                    window.location.hash = `#pm/interni/${label}`;
                    close();
                }
            };
        });
        // Edit Title Inline
        const titleView = drawer.querySelector('#item-title-view');
        const titleContainer = drawer.querySelector('#item-title-container');
        if (titleView && titleContainer) {
            titleView.onclick = () => {
                const currentTitle = item.title || '';
                titleContainer.innerHTML = `
                    <input type="text" id="item-title-editor" class="input-modern" style="
                        width: 100%; font-size: 1.35rem; font-weight: 700; color: var(--text-primary);
                        line-height: 1.2; font-family: 'Satoshi', sans-serif; letter-spacing: -0.02em;
                        padding: 4px 8px; margin-left: -8px; border: 2px solid var(--brand-blue);
                        border-radius: 8px; background: #fff; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
                        outline: none; box-sizing: border-box;
                    " value="${currentTitle.replace(/"/g, '&quot;')}">
                `;
                const input = titleContainer.querySelector('#item-title-editor');
                input.focus();
                input.select();

                let isSaving = false;
                const saveTitle = async () => {
                    if (isSaving) return;
                    const newTitle = input.value.trim();
                    if (!newTitle || newTitle === currentTitle) {
                        render();
                        return;
                    }

                    isSaving = true;
                    try {
                        item.title = newTitle;
                        await updatePMItem(itemId, { title: newTitle });
                        document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { spaceId: currentSpaceId, itemId, action: 'update' } }));
                        render();
                    } catch (e) {
                        console.error(e);
                        render();
                    }
                };

                input.onblur = saveTitle;
                input.onkeydown = (e) => {
                    if (e.key === 'Escape') { render(); }
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        input.blur();
                    }
                };

                // Mobile Team Section Expand/Collapse Toggles
                if (window.innerWidth <= 768) {
                    drawer.querySelectorAll('.team-expand-toggle').forEach(btn => {
                        btn.style.display = 'block'; // Show on mobile
                        btn.onclick = (e) => {
                            const targetId = btn.getAttribute('data-target');
                            const targetList = drawer.querySelector(`#${targetId}`);
                            if (targetList) {
                                const isCollapsed = targetList.classList.toggle('is-collapsed');
                                btn.textContent = isCollapsed ? 'expand_more' : 'expand_less';
                            }
                        };
                    });
                }
            };
        }
        // More Actions Menu Listeners
        const moreTrigger = drawer.querySelector('#header-more-actions');
        const moreMenu = drawer.querySelector('#more-actions-menu');
        if (moreTrigger && moreMenu) {
            moreTrigger.onclick = (e) => {
                e.stopPropagation();
                moreMenu.classList.toggle('hidden');
                // Close other main-level dropdowns
                drawer.querySelector('#status-dropdown-menu')?.classList.add('hidden');
                drawer.querySelector('#priority-dropdown-menu')?.classList.add('hidden');
            };
        }

        // Full Screen Toggle
        const fullScreenBtn = drawer.querySelector('#full-screen-btn');
        if (fullScreenBtn) {
            fullScreenBtn.onclick = () => {
                isExpanded = !isExpanded;
                render();
            };
        }

        // Duplication
        const duplicateBtn = drawer.querySelector('#duplicate-item-btn');
        if (duplicateBtn) {
            duplicateBtn.onclick = async () => {
                const options = await showDuplicateModal(itemId, item, currentSpaceId);
                if (options) {
                    try {
                        const newItem = await duplicatePMItem(itemId, options);
                        window.showSuccess("Attività duplicata con successo!");
                        document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { spaceId: currentSpaceId, itemId, action: 'update' } }));
                        // Open the new one
                        openHubDrawer(newItem.id, options.newSpaceId || currentSpaceId);
                    } catch (e) {
                        console.error(e);
                        window.showError("Errore durante la duplicazione");
                    }
                }
            };
        }

        // Copy Link
        const copyLinkBtn = drawer.querySelector('#copy-link-btn');
        if (copyLinkBtn) {
            copyLinkBtn.onclick = () => {
                const link = `${window.location.origin}${window.location.pathname}#pm/task/${itemId}`;
                navigator.clipboard.writeText(link).then(() => {
                    const originalText = copyLinkBtn.querySelector('span:last-child').textContent;
                    copyLinkBtn.querySelector('span:last-child').textContent = "Copiato!";
                    setTimeout(() => { copyLinkBtn.querySelector('span:last-child').textContent = originalText; }, 2000);
                });
            };
        }

        const deleteBtn = drawer.querySelector('#delete-item-btn');
        if (deleteBtn) {
            deleteBtn.onclick = async () => {
                if (await window.showConfirm("Eliminare definitivamente questa attività?")) {
                    await deletePMItem(itemId);
                    closeHubDrawer();
                    document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { spaceId: currentSpaceId, itemId, action: 'delete' } }));
                }
            };
        }

        const positionElementUnderTrigger = (trigger, element, container) => {
            const rect = trigger.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            // Vertical position (exactly below the trigger)
            element.style.top = (rect.bottom - containerRect.top + 5) + 'px';

            // Horizontal position with boundary checks
            let left = rect.left - containerRect.left;

            // To get accurate width, we must ensure it's not hidden
            const wasHidden = element.classList.contains('hidden');
            if (wasHidden) element.classList.remove('hidden');
            const elementWidth = element.offsetWidth || 260;
            if (wasHidden) element.classList.add('hidden');

            if (left + elementWidth > containerRect.width - 15) {
                left = containerRect.width - elementWidth - 15;
            }
            if (left < 15) left = 15;

            element.style.left = left + 'px';
        };

        const setupDropdown = (triggerClass, menuId, optionsClass, field) => {
            const triggers = drawer.querySelectorAll(`.${triggerClass}`);
            const menu = drawer.querySelector(`#${menuId}`);
            if (!menu || triggers.length === 0) return;

            triggers.forEach(trigger => {
                trigger.onclick = (e) => {
                    e.stopPropagation();
                    const container = drawer.querySelector('.metadata-container');
                    const isHiddenBefore = menu.classList.contains('hidden');

                    // Close others
                    drawer.querySelectorAll('.dropdown-menu, .glass-card').forEach(m => m.classList.add('hidden'));

                    if (isHiddenBefore) {
                        menu.classList.remove('hidden');
                        positionElementUnderTrigger(trigger, menu, container);
                    }
                };
            });

            menu.querySelectorAll(`.${optionsClass}`).forEach(opt => {
                opt.onclick = async () => {
                    const val = opt.dataset.value;
                    item[field] = val;
                    await updatePMItem(itemId, { [field]: val });
                    render();
                    document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { spaceId, itemId, action: 'update' } }));
                };
            });
        };

        setupDropdown('priority-trigger', 'priority-dropdown-menu', 'priority-option', 'priority');
        setupDropdown('status-trigger', 'status-dropdown-menu', 'status-option', 'status');

        const setupDate = (idOrClass, field) => {
            const btns = drawer.querySelectorAll(idOrClass.startsWith('.') ? idOrClass : `#${idOrClass}`);
            btns.forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    toggleHubDatePicker(btn, async (d) => {
                        item[field] = d;
                        await updatePMItem(itemId, { [field]: d });
                        render();
                        document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { spaceId, itemId, action: 'update' } }));
                    }, item[field]);
                };
            });
        };
        setupDate('start-date-btn', 'start_date');
        setupDate('due-date-btn', 'due_date');
        // Mobile specific date triggers
        setupDate('mobile-start-date', 'start_date');
        setupDate('mobile-due-date', 'due_date');

        const setupPicker = (btnId, pkrId) => {
            const btn = drawer.querySelector(`#${btnId}`);
            const pkr = drawer.querySelector(`#${pkrId}`);
            if (btn && pkr) btn.onclick = (e) => {
                e.stopPropagation();

                const isHiddenBefore = pkr.classList.contains('hidden');
                const container = drawer.querySelector('.metadata-container');

                // Close ALL other dropdowns/pickers
                drawer.querySelectorAll('.dropdown-menu, .glass-card, #form-pm-picker, #form-assignee-picker').forEach(el => {
                    el.classList.add('hidden');
                });

                if (isHiddenBefore) {
                    pkr.classList.remove('hidden');
                    positionElementUnderTrigger(btn, pkr, container);

                    // Focus search after a tiny delay to ensure visibility
                    setTimeout(() => pkr.querySelector('.user-picker-search')?.focus(), 150);
                }
            };

            // Search Filtering Logic
            if (pkr) {
                const searchInput = pkr.querySelector('.user-picker-search');
                if (searchInput) {
                    searchInput.addEventListener('input', (e) => {
                        const q = e.target.value.toLowerCase();
                        const options = pkr.querySelectorAll('.user-option');
                        options.forEach(opt => {
                            const match = opt.dataset.nameSearch.includes(q);
                            opt.style.display = match ? 'flex' : 'none';
                        });
                        // Hide empty section headers
                        pkr.querySelectorAll('.picker-section-header').forEach(header => {
                            let sibling = header.nextElementSibling;
                            let hasVisible = false;
                            while (sibling && !sibling.classList.contains('picker-section-header')) {
                                if (sibling.style.display !== 'none') { hasVisible = true; break; }
                                sibling = sibling.nextElementSibling;
                            }
                            header.style.display = hasVisible ? 'block' : 'none';
                        });
                    });
                    searchInput.onclick = (e) => e.stopPropagation();
                }
            }

            if (pkr) pkr.querySelectorAll('.user-option').forEach(opt => {
                opt.onclick = async (e) => {
                    e.stopPropagation();
                    if (opt.classList.contains('processing')) return;
                    opt.classList.add('processing');
                    try {
                        const uid = opt.dataset.uid;
                        const cid = opt.dataset.collabId;
                        const role = opt.dataset.targetRole || (btnId.includes('pm') ? 'pm' : 'assignee');
                        await assignUserToItem(itemId, uid || cid, role, !uid);
                        // Refresh data and render once
                        const [newAssignees, newLog] = await Promise.all([
                            fetchItemAssignees(itemId),
                            fetchPMItemViewLog(itemId)
                        ]);
                        assignees = newAssignees;
                        render();
                    } catch (err) {
                        console.error("Assignment failed", err);
                    } finally {
                        opt.classList.remove('processing');
                    }
                };
            });
        };

        setupPicker('add-assignee-btn', 'assignee-picker');
        setupPicker('add-assignee-header-btn', 'assignee-picker');
        setupPicker('add-pm-btn', 'pm-picker');

        const addSubBtn = drawer.querySelector('#add-sub-item-btn');
        if (addSubBtn) addSubBtn.onclick = (e) => {
            e.stopPropagation();
            drawer.querySelector('#add-sub-item-menu').classList.toggle('hidden');
        };

        drawer.querySelectorAll('.add-sub-item-opt').forEach(opt => {
            opt.onclick = () => {
                const type = opt.dataset.type;
                openHubDrawer(null, currentSpaceId, itemId, type, { is_account_level: item.is_account_level });
            };
        });

        const backBtn = drawer.querySelector('#back-to-parent-btn');
        if (backBtn) backBtn.onclick = () => {
            openHubDrawer(item.parent_item.id, currentSpaceId);
        };

        drawer.querySelectorAll('.sub-item-row').forEach(row => {
            row.onclick = () => {
                const sid = row.dataset.id;
                openHubDrawer(sid, currentSpaceId);
            };
        });

        const addCommentBtn = drawer.querySelector('#add-comment-btn');
        const newCommentInput = drawer.querySelector('#new-comment');
        if (addCommentBtn && newCommentInput) {
            const sendComment = async () => {
                const body = newCommentInput.value.trim();
                if (body) {
                    newCommentInput.value = '';
                    await addComment(itemId, body);
                    comments = await fetchItemComments(itemId);
                    await updatePMItemViewLog(itemId);
                    unreadCommentsCount = 0;
                    render();
                }
            };
            addCommentBtn.onclick = sendComment;
            newCommentInput.onkeydown = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendComment();
                }
            };
        }

        drawer.querySelectorAll('.delete-comment-btn').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const confirm = await window.showConfirm("Sei sicuro di voler eliminare questo commento?", "Elimina Commento");
                if (confirm) {
                    await deleteComment(btn.dataset.id);
                    comments = await fetchItemComments(itemId);
                    render();
                }
            };
        });

        document.addEventListener('click', (e) => {
            if (!drawer.contains(e.target)) return;
            // Close all dropdowns if click is outside of them
            if (!e.target.closest('#status-trigger-btn') &&
                !e.target.closest('#priority-trigger-btn') &&
                !e.target.closest('#add-assignee-btn') &&
                !e.target.closest('#add-pm-btn') &&
                !e.target.closest('#open-resources-btn') &&
                !e.target.closest('.dropdown-menu')) {
                drawer.querySelectorAll('.dropdown-menu').forEach(el => el.classList.add('hidden'));
            }
        });

        // Inline Description Editing (Live Style)
        const descView = drawer.querySelector('#item-description-view');
        const descContainer = drawer.querySelector('#item-description-container');
        const savingIndicator = drawer.querySelector('#desc-saving-indicator');

        if (descView && descContainer) {
            descView.onclick = () => {
                const currentNotes = item.notes || '';
                descContainer.innerHTML = `
                    <textarea id="item-description-editor" class="input-modern" style="width: 100%; min-height: 120px; font-size: 0.9rem; line-height: 1.6; padding: 6px; resize: vertical; border: 1px solid var(--brand-blue); box-shadow: 0 0 0 3px var(--brand-blue-light); background: white; display: block; margin: 0;">${currentNotes}</textarea>
                `;
                const textarea = descContainer.querySelector('#item-description-editor');
                textarea.focus();

                // Set cursor at the end
                textarea.setSelectionRange(textarea.value.length, textarea.value.length);

                let isSaving = false;
                const saveChanges = async () => {
                    if (isSaving) return;
                    const newNotes = textarea.value;
                    if (newNotes === currentNotes) {
                        render(); // Just revert to view mode if no change
                        return;
                    }

                    isSaving = true;
                    if (savingIndicator) savingIndicator.classList.remove('hidden');

                    try {
                        item.notes = newNotes;
                        await updatePMItem(itemId, { notes: newNotes });
                        // We don't call render() immediately to avoid flicker, just swap the content back
                        descContainer.innerHTML = `
                            <div id="item-description-view" style="font-size: 0.9rem; color: var(--text-primary); line-height: 1.6; white-space: pre-wrap; border-radius: 8px; cursor: pointer; padding: 6px; transition: all 0.2s; border: 1px solid transparent; width: 100%; word-break: break-word;">
                                ${newNotes.trim() || '<span style="color: #94a3b8; font-style: italic;">Clicca per aggiungere una descrizione...</span>'}
                            </div>
                        `;
                        // Re-fetch and full render after a small delay to sync everything
                        setTimeout(() => { if (savingIndicator) savingIndicator.classList.add('hidden'); render(); }, 500);
                    } catch (e) {
                        console.error(e);
                        if (savingIndicator) savingIndicator.classList.add('hidden');
                        render();
                    }
                };

                textarea.onblur = saveChanges;
                textarea.onkeydown = (e) => {
                    if (e.key === 'Escape') { render(); }
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { textarea.blur(); }
                };
            };
        }

        // Resources Popover specifically
        const resBtn = drawer.querySelector('#open-resources-btn');
        const resPop = drawer.querySelector('#resources-popover');
        if (resBtn && resPop) {
            resBtn.onclick = (e) => { e.stopPropagation(); resPop.classList.toggle('hidden'); };
            drawer.querySelector('#close-resources-popover-btn').onclick = (e) => { e.stopPropagation(); resPop.classList.add('hidden'); };
        }

        // Subscription Toggle
        const subBtn = drawer.querySelector('#toggle-subscription-btn');
        if (subBtn) {
            subBtn.onclick = async (e) => {
                e.stopPropagation();
                try {
                    if (isSubscribed) {
                        await unsubscribeFromPMItem(itemId);
                        isSubscribed = false;
                    } else {
                        await subscribeToPMItem(itemId);
                        isSubscribed = true;
                    }
                    render();
                } catch (err) {
                    console.error("Subscription toggle failed", err);
                }
            };
        }
    };

    const attachEditModeListeners = () => {
        // Context Picker Listeners (New functionality for global tasks)
        const ctxTrigger = drawer.querySelector('#context-picker-trigger');
        const ctxDropdown = drawer.querySelector('#context-picker-dropdown');
        const ctxSearch = drawer.querySelector('#context-search');
        const ctxList = drawer.querySelector('#context-options-list');

        if (ctxTrigger && ctxDropdown) {
            ctxTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = ctxDropdown.classList.toggle('hidden');
                if (!isHidden) {
                    ctxSearch.focus();
                    renderContextOptions();
                    // Close others
                    drawer.querySelectorAll('.glass-card:not(#context-picker-dropdown), #form-pm-picker, #form-assignee-picker').forEach(el => el.classList.add('hidden'));
                }
            });

            ctxSearch.addEventListener('input', () => renderContextOptions(ctxSearch.value));

            function renderContextOptions(filter = '') {
                const query = filter.toLowerCase();

                // 1. Orders (Active only)
                const activeOrders = (state.orders || []).filter(o => {
                    const statusOffer = (o.offer_status || '').toLowerCase();
                    const statusWork = (o.status_works || '').toLowerCase();
                    const isNotRejected = statusOffer !== 'rifiutata';
                    const isNotCompleted = statusOffer === 'accettata' ? statusWork !== 'completato' : true;

                    const matchesSearch = `#${o.order_number} ${o.title}`.toLowerCase().includes(query) || o.clients?.business_name?.toLowerCase().includes(query);
                    const matchesClient = currentClientId ? o.client_id === currentClientId : true;
                    return isNotRejected && isNotCompleted && matchesSearch && matchesClient;
                });

                const orderSpaces = activeOrders.map(o => {
                    const s = state.pm_spaces?.find(x => x.ref_ordine === o.id);
                    return s ? { ...s, order: o } : null;
                }).filter(Boolean);

                // 2. Clients
                const clients = (state.clients || []).filter(c =>
                    c.business_name.toLowerCase().includes(query)
                ).slice(0, 15);

                // 3. Internal Spaces (Split into Cluster vs Project)
                const clusters = (state.pm_spaces || []).filter(s =>
                    s.type === 'interno' && s.is_cluster && s.name.toLowerCase().includes(query)
                ).slice(0, 30);

                const projects = (state.pm_spaces || []).filter(s =>
                    s.type === 'interno' && !s.is_cluster && s.name.toLowerCase().includes(query)
                ).slice(0, 50);

                let html = '';

                // Clients
                if (clients.length > 0 && !currentClientId) {
                    html += `<div style="padding: 12px 8px 4px; font-size: 0.65rem; color: var(--text-tertiary); font-weight: 700; border-top: 1px solid #e2e8f0; margin-top: 4px;">CLIENTI</div>`;
                    clients.forEach(c => {
                        html += `
                            <div class="ctx-option" data-id="${c.id}" data-type="client" style="padding: 10px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;">
                                <span class="material-icons-round" style="font-size: 16px; color: #f59e0b;">person</span>
                                <span style="font-size: 0.85rem; font-weight: 500;">${c.business_name}</span>
                            </div>
                        `;
                    });
                }

                // Clusters
                if (clusters.length > 0) {
                    html += `<div style="padding: 12px 8px 4px; font-size: 0.65rem; color: var(--text-tertiary); font-weight: 700; border-top: 1px solid #e2e8f0; margin-top: 4px;">CLUSTER</div>`;
                    clusters.forEach(s => {
                        html += `
                            <div class="ctx-option" data-id="${s.id}" data-type="space" style="padding: 10px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;">
                                <span class="material-icons-round" style="font-size: 16px; color: var(--brand-purple);">folder_special</span>
                                <span style="font-size: 0.85rem; font-weight: 500;">${s.name}</span>
                            </div>
                        `;
                    });
                }

                // Projects
                if (projects.length > 0) {
                    html += `<div style="padding: 12px 8px 4px; font-size: 0.65rem; color: var(--text-tertiary); font-weight: 700; border-top: 1px solid #e2e8f0; margin-top: 4px;">PROGETTI INTERNI</div>`;
                    projects.forEach(s => {
                        const parent = state.pm_spaces?.find(p => p.id === s.parent_ref);
                        html += `
                            <div class="ctx-option" data-id="${s.id}" data-type="space" style="padding: 10px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;">
                                <span class="material-icons-round" style="font-size: 16px; color: var(--brand-purple); opacity: 0.7;">folder</span>
                                <div style="display: flex; flex-direction: column;">
                                    <span style="font-size: 0.85rem; font-weight: 500;">${s.name}</span>
                                    ${parent ? `<span style="font-size: 0.7rem; color: var(--text-tertiary);">Cluster: ${parent.name}</span>` : ''}
                                </div>
                            </div>
                        `;
                    });
                }

                // Orders
                if (orderSpaces.length > 0) {
                    html += `<div style="padding: 12px 8px 4px; font-size: 0.65rem; color: var(--text-tertiary); font-weight: 700; border-top: 1px solid #e2e8f0; margin-top: 4px;">COMMESSE ATTIVE</div>`;
                    orderSpaces.forEach(os => {
                        html += `
                            <div class="ctx-option" data-id="${os.id}" data-type="space" style="padding: 10px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;">
                                <span class="material-icons-round" style="font-size: 16px; color: var(--brand-blue);">style</span>
                                <div style="display: flex; flex-direction: column;">
                                    <span style="font-size: 0.85rem; font-weight: 500;">#${os.order.order_number} ${os.order.title}</span>
                                    <span style="font-size: 0.7rem; color: var(--text-tertiary);">${os.order.clients?.business_name || ''}</span>
                                </div>
                            </div>
                        `;
                    });
                }

                if (!html) html = `<div style="padding: 20px; text-align: center; font-size: 0.8rem; color: var(--text-tertiary); font-style: italic;">Nessun risultato</div>`;
                ctxList.innerHTML = html;

                ctxList.querySelectorAll('.ctx-option').forEach(opt => {
                    opt.onmouseover = () => opt.style.background = 'var(--bg-tertiary, #f8fafc)';
                    opt.onmouseout = () => opt.style.background = 'transparent';
                    opt.onclick = () => {
                        const type = opt.dataset.type;
                        const id = opt.dataset.id;
                        captureFormState();
                        if (type === 'client') {
                            currentClientId = id;
                            currentSpaceId = null;

                            // OPTIONALLY: Pre-select the latest project for this client if exists
                            if (state.orders && state.pm_spaces) {
                                const clientOrders = state.orders.filter(o => o.client_id === id);
                                if (clientOrders.length > 0) {
                                    const latestOrder = clientOrders[0];
                                    const space = state.pm_spaces.find(s => s.ref_ordine === latestOrder.id);
                                    if (space) {
                                        currentSpaceId = space.id;
                                    }
                                }
                            }

                            render();
                            setTimeout(() => {
                                const trigger = document.getElementById('context-picker-trigger');
                                if (trigger) {
                                    trigger.click(); // Re-open to let them choose the commessa for this client
                                    const searchInput = document.getElementById('context-search');
                                    if (searchInput) searchInput.focus();
                                }
                            }, 50);
                        } else {
                            currentSpaceId = id;
                            const s = state.pm_spaces?.find(x => x.id === id);
                            if (s?.type === 'commessa') {
                                const o = state.orders?.find(x => x.id === s.ref_ordine);
                                if (o) currentClientId = o.client_id;
                            }
                            render();
                        }
                    };
                });
            }

            const clearBtn = drawer.querySelector('#clear-context-btn');
            if (clearBtn) {
                clearBtn.onclick = () => {
                    currentClientId = null;
                    currentSpaceId = null;
                    render();
                };
            }
        }

        const backBtn = drawer.querySelector('#back-to-parent-btn');
        if (backBtn && item.parent_item) {
            backBtn.onclick = () => {
                openHubDrawer(item.parent_item.id, currentSpaceId);
            };
        }

        drawer.querySelector('#header-close-btn').onclick = closeHubDrawer;

        const cancelBtn = drawer.querySelector('#cancel-edit-btn');
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                if (isEdit) { viewMode = true; render(); }
                else closeHubDrawer();
            };
        }

        const setupEditUserPicker = (btnId, pkrId, role) => {
            const btn = drawer.querySelector(`#${btnId}`);
            const pkr = drawer.querySelector(`#${pkrId}`);
            if (!btn || !pkr) return;

            btn.onclick = (e) => {
                e.stopPropagation();
                const isHidden = pkr.classList.toggle('hidden');
                if (!isHidden) {
                    // Close others
                    drawer.querySelectorAll('#form-pm-picker, #form-assignee-picker, #form-status-picker, #form-priority-picker, #context-picker-dropdown').forEach(el => {
                        if (el !== pkr) el.classList.add('hidden');
                    });
                    pkr.querySelector('.user-picker-search')?.focus();
                }
            };

            // Search filtering
            const searchInput = pkr.querySelector('.user-picker-search');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const q = e.target.value.toLowerCase();
                    pkr.querySelectorAll('.user-option').forEach(opt => {
                        opt.style.display = opt.dataset.nameSearch.includes(q) ? 'flex' : 'none';
                    });
                    // Section headers
                    pkr.querySelectorAll('.picker-section-header').forEach(header => {
                        let sibling = header.nextElementSibling;
                        let hasVisible = false;
                        while (sibling && !sibling.classList.contains('picker-section-header')) {
                            if (sibling.style.display !== 'none') { hasVisible = true; break; }
                            sibling = sibling.nextElementSibling;
                        }
                        header.style.display = hasVisible ? 'block' : 'none';
                    });
                });
                searchInput.onclick = (e) => e.stopPropagation();
            }

            pkr.querySelectorAll('.user-option').forEach(opt => {
                opt.onclick = () => {
                    captureFormState();
                    pendingAssignees.push({
                        user_ref: opt.dataset.uid,
                        collaborator_ref: opt.dataset.collabId,
                        role: role || opt.dataset.targetRole || 'assignee',
                        displayName: opt.dataset.name,
                        user: { avatar_url: opt.querySelector('img')?.src }
                    });
                    render();
                };
            });
        };

        setupEditUserPicker('form-add-assignee-btn', 'form-assignee-picker', 'assignee');
        setupEditUserPicker('form-add-pm-btn', 'form-pm-picker', 'pm');

        // Custom Pickers: Status & Priority
        const setupCustomPicker = (triggerId, pickerId, optionClass, dataMap) => {
            const trigger = drawer.querySelector(`#${triggerId}`);
            const picker = drawer.querySelector(`#${pickerId}`);
            if (trigger && picker) {
                trigger.onclick = (e) => {
                    e.stopPropagation();
                    const isHidden = picker.classList.toggle('hidden');
                    if (!isHidden) {
                        // Close others
                        drawer.querySelectorAll('.glass-card, #form-pm-picker, #form-assignee-picker, #context-picker-dropdown').forEach(el => {
                            if (el !== picker) el.classList.add('hidden');
                        });
                    }
                };
                picker.querySelectorAll(`.${optionClass}`).forEach(opt => {
                    opt.onclick = (e) => {
                        e.stopPropagation();
                        const val = opt.dataset.value;
                        const hidden = trigger.parentElement.querySelector('input[type="hidden"]');
                        if (hidden) hidden.value = val;

                        // Sync with item object for re-renders
                        if (optionClass === 'status-option-item') item.status = val;
                        else item.priority = val;

                        const obj = dataMap[val];
                        if (optionClass === 'status-option-item') {
                            trigger.querySelector('div').innerHTML = `
                                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${obj.color};"></div>
                                <span>${obj.label}</span>
                            `;
                        } else {
                            trigger.querySelector('div').innerHTML = `
                                <span class="material-icons-round" style="font-size: 18px; color: ${obj.color};">flag</span>
                                <span>${obj.label}</span>
                            `;
                        }

                        picker.classList.add('hidden');
                    };
                    opt.onmouseover = () => opt.style.background = 'var(--bg-tertiary, #f8fafc)';
                    opt.onmouseout = () => opt.style.background = 'transparent';
                });
            }
        };

        setupCustomPicker('form-status-trigger', 'form-status-picker', 'status-option-item', ITEM_STATUS);
        setupCustomPicker('form-priority-trigger', 'form-priority-picker', 'priority-option-item', ITEM_PRIORITY);

        // Outside Click Listener (Global for the drawer)
        const closeAllPickers = (e) => {
            const dropdowns = drawer.querySelectorAll('.glass-card, #form-pm-picker, #form-assignee-picker, #context-picker-dropdown');
            dropdowns.forEach(el => {
                if (!el.classList.contains('hidden') && !el.contains(e.target)) {
                    el.classList.add('hidden');
                }
            });
        };
        drawer.removeEventListener('click', closeAllPickers);
        drawer.addEventListener('click', closeAllPickers);

        const setupFormDate = (triggerId, hiddenName) => {
            const trigger = drawer.querySelector(`#${triggerId}`);
            const hidden = drawer.querySelector(`input[name="${hiddenName}"]`);
            if (trigger && hidden) {
                trigger.onclick = (e) => {
                    e.stopPropagation();
                    toggleHubDatePicker(trigger, (d) => {
                        hidden.value = d;
                        item[hiddenName] = d;
                        const labelSpan = trigger.querySelector('span:not(.material-icons-round)');
                        if (labelSpan) {
                            labelSpan.textContent = new Date(d).toLocaleDateString('it-IT');
                            labelSpan.style.color = 'var(--text-primary)';
                            labelSpan.style.fontWeight = '500';
                        }
                    }, hidden.value);
                };
            }
        };

        setupFormDate('form-start-date-trigger', 'start_date');
        setupFormDate('form-due-date-trigger', 'due_date');
        setupFormDate('form-rec-start-trigger', 'rec_start');
        setupFormDate('form-rec-until-trigger', 'rec_until');

        drawer.querySelectorAll('.remove-pending-btn').forEach(btn => {
            btn.onclick = () => {
                captureFormState();
                pendingAssignees.splice(parseInt(btn.dataset.idx), 1);
                render();
            };
        });

        // Recurrence Toggle Logic
        const toggleBtn = drawer.querySelector('#toggle-recurrence-btn');
        const recurrenceContent = drawer.querySelector('#recurrence-settings-content');
        if (toggleBtn && recurrenceContent) {
            toggleBtn.onclick = () => {
                const isHidden = recurrenceContent.classList.toggle('hidden');
                const icon = toggleBtn.querySelector('.toggle-icon');
                if (icon) {
                    icon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
                }
                toggleBtn.style.borderBottomLeftRadius = isHidden ? '10px' : '0';
                toggleBtn.style.borderBottomRightRadius = isHidden ? '10px' : '0';
            };
        }

        drawer.querySelector('#item-form').onsubmit = async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.7'; }

            const rawData = Object.fromEntries(new FormData(e.target).entries());
            if (rawData.is_account_level) {
                rawData.is_account_level = rawData.is_account_level === 'true';
            }

            // Build recurrence rule if any
            if (rawData.rec_freq) {
                const rule = {
                    freq: rawData.rec_freq,
                    interval: parseInt(rawData.rec_interval) || 1,
                    unit: rawData.rec_unit || 'day'
                };

                if (rawData.rec_until) rule.until = rawData.rec_until;

                if (rawData.rec_limit_active === 'on') {
                    rule.count = parseInt(rawData.rec_limit_count) || 0;
                }

                if (rawData.rec_advance_active === 'on') {
                    rule.create_advance = parseInt(rawData.rec_advance_count) || 1;
                } else {
                    rule.create_advance = 1; // Just the main one
                }

                rawData.recurrence_rule = rule;

                // If a recurrence start is specified, use it for the main task dates
                if (rawData.rec_start) {
                    const diff = (rawData.start_date && rawData.due_date)
                        ? (new Date(rawData.due_date) - new Date(rawData.start_date))
                        : 0;

                    rawData.start_date = rawData.rec_start;
                    if (diff > 0) {
                        rawData.due_date = new Date(new Date(rawData.rec_start).getTime() + diff).toISOString().split('T')[0];
                    } else {
                        rawData.due_date = rawData.rec_start;
                    }
                }
            }

            // Cleanup form subfields
            const toDelete = ['rec_freq', 'rec_interval', 'rec_unit', 'rec_start', 'rec_until', 'rec_limit_active', 'rec_limit_count', 'rec_advance_active', 'rec_advance_count'];
            toDelete.forEach(k => delete rawData[k]);

            if (!rawData.space_ref && !currentClientId) {
                alert("Seleziona un Cliente o una Commessa dal menu a tendina in alto prima di salvare.");
                return;
            }

            // If we have a client but no space, add client_ref
            if (!rawData.space_ref && currentClientId) {
                rawData.client_ref = currentClientId;
            }

            if (isEdit) {
                try {
                    await updatePMItem(itemId, rawData);

                    // SYNC ASSIGNEES: Remove those no longer in the list
                    const { data: dbAssignees } = await supabase.from('pm_item_assignees').select('id, user_ref, collaborator_ref').eq('pm_item_ref', itemId);
                    const keepUserRefs = pendingAssignees.filter(p => p.user_ref).map(p => p.user_ref);
                    const keepCollabRefs = pendingAssignees.filter(p => p.collaborator_ref).map(p => p.collaborator_ref);

                    if (dbAssignees) {
                        for (const dba of dbAssignees) {
                            const isUserIdToKeep = dba.user_ref && keepUserRefs.includes(dba.user_ref);
                            const isCollabIdToKeep = dba.collaborator_ref && keepCollabRefs.includes(dba.collaborator_ref);
                            if (!isUserIdToKeep && !isCollabIdToKeep) {
                                await supabase.from('pm_item_assignees').delete().eq('id', dba.id);
                            }
                        }
                    }

                    // Add or update current ones
                    for (const p of pendingAssignees) {
                        await assignUserToItem(itemId, p.user_ref || p.collaborator_ref, p.role || 'assignee', !p.user_ref).catch(e => null);
                    }

                    viewMode = true;
                    render();
                    document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { spaceId: rawData.space_ref || spaceId, itemId, action: 'update' } }));
                } catch (error) {
                    console.error("Error updating PM item:", error);
                    alert("Errore durante il salvataggio: " + error.message);
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; }
                }
            } else {
                try {
                    const newItem = await createPMItem(rawData);

                    if (newItem && pendingAssignees.length > 0) {
                        for (const p of pendingAssignees) {
                            await assignUserToItem(newItem.id, p.user_ref || p.collaborator_ref, p.role || 'assignee', !p.user_ref).catch(e => null);
                        }
                    }

                    document.dispatchEvent(new CustomEvent('pm-item-changed', {
                        detail: {
                            spaceId: rawData.space_ref || spaceId || null,
                            clientId: currentClientId || null,
                            itemId: newItem.id,
                            parentId: rawData.parent_ref || null,
                            action: 'create'
                        }
                    }));
                    closeHubDrawer();
                } catch (error) {
                    console.error("Error creating PM item:", error);
                    alert("Errore durante la creazione: " + error.message);
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; }
                }
            }

        };
    };

    render();
}

// CALENDAR PICKER HELPERS extracted to ./hub/date_picker.js (step 2)

// showDuplicateModal + window.quickRemoveAssignee extracted to ./hub/duplicate_modal.js (step 3)
