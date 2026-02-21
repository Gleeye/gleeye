// Hub Drawer - Full item editor panel
import '../../../utils/modal-utils.js?v=1000';
import {
    createPMItem,
    updatePMItem,
    deletePMItem,
    fetchPMItem,
    fetchItemComments,
    addComment,
    fetchItemAssignees,
    assignUserToItem,
    removeUserFromItem,
    updateItemCloudLinks
} from '../../../modules/pm_api.js?v=1000';
import { supabase } from '../../../modules/config.js';
import { CloudLinksManager } from '../../components/CloudLinksManager.js?v=1000';
import { state } from '../../../modules/state.js';
import { renderUserPicker } from './picker_utils.js?v=1000';

const ITEM_STATUS = {
    'todo': { label: 'Da Fare', color: '#94a3b8', bg: '#f1f5f9' },
    'in_progress': { label: 'In Corso', color: '#3b82f6', bg: '#eff6ff' },
    'blocked': { label: 'Bloccato', color: '#ef4444', bg: '#fef2f2' },
    'review': { label: 'Revisione', color: '#f59e0b', bg: '#fffbeb' },
    'done': { label: 'Completata', color: '#10b981', bg: '#ecfdf5' }
};

const ITEM_PRIORITY = {
    'low': { label: 'Bassa', color: '#64748b' },
    'medium': { label: 'Media', color: '#3b82f6' },
    'high': { label: 'Alta', color: '#f59e0b' },
    'urgent': { label: 'Urgente', color: '#ef4444' }
};

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
                    background: white; box-shadow: -10px 0 40px rgba(0,0,0,0.2);
                    display: flex; flex-direction: column;
                "></div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        overlay = document.getElementById('hub-drawer-overlay');
        drawer = document.getElementById('hub-drawer');

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.add('hidden');
        });
    }

    const isEdit = !!itemId;
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
    let viewMode = isEdit;
    let pendingAssignees = [];
    const { defaultRole = 'assignee', defaultNote = '', is_account_level = false } = options;

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timeout caricamento (10s)")), 10000);
    });

    try {
        await Promise.race([
            (async () => {
                const { fetchSpaceAssignees } = await import('../../../modules/pm_api.js?v=1000');

                if (isEdit) {
                    console.log("[HubDrawer] Loading data for item:", itemId);

                    // Parallelize main data, comments, and ensure spaces are loaded
                    const [fullItem, itemComments] = await Promise.all([
                        fetchPMItem(itemId).catch(e => { console.error("Item load failed", e); return null; }),
                        fetchItemComments(itemId).catch(e => { console.warn("Comments load failed", e); return []; }),
                        (!state.pm_spaces || state.pm_spaces.length < 5)
                            ? supabase.from('pm_spaces').select('*').then(res => { if (res.data) state.pm_spaces = res.data; return res.data; })
                            : Promise.resolve(state.pm_spaces)
                    ]);

                    // Use context as fallback if fetch fails, but fresh data is priority
                    const contextItem = (window._hubContext?.items || []).find(i => String(i.id) === String(itemId));
                    item = fullItem || contextItem;
                    comments = itemComments || [];

                    if (!item) throw new Error("Attività non trovata o non accessibile.");

                    // Determine currentSpaceId for suggestions
                    if (item.space_ref) currentSpaceId = item.space_ref;

                    assignees = item.pm_item_assignees || [];
                    pendingAssignees = assignees.map(a => ({
                        user_ref: a.user_ref,
                        collaborator_ref: a.collaborator_ref,
                        role: a.role,
                        user: a.user,
                        displayName: a.user?.full_name || `${a.user?.first_name || ''} ${a.user?.last_name || ''}`.trim()
                    }));
                } else {
                    item = { item_type: itemType, status: 'todo', priority: 'medium', notes: defaultNote, title: '', is_account_level };

                    // Ensure spaces are loaded even for new items
                    if (!state.pm_spaces || state.pm_spaces.length < 5) {
                        try {
                            const { data } = await supabase.from('pm_spaces').select('*');
                            if (data) state.pm_spaces = data;
                        } catch (e) { console.error("Error loading spaces for new item context", e); }
                    }
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
                <button class="secondary-btn close-drawer-btn" style="margin-top: 1rem;">Chiudi</button>
            </div>
        `;
        drawer.querySelector('.close-drawer-btn').onclick = () => overlay.classList.add('hidden');
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

    if (space) {
        // 1. Reparto / Area
        const areaName = typeof space.area === 'object' ? space.area?.name : space.area;
        if (areaName) path.push(areaName);

        // 2. Cluster
        const cluster = Array.isArray(space.cluster) ? space.cluster[0] : space.cluster;
        if (cluster?.name) path.push(cluster.name);

        // 3. Commessa / Space Name
        if (space.name && space.name !== cluster?.name) path.push(space.name);
    }

    // 4. Parent Activity/Task
    if (item.parent_item) {
        path.push(item.parent_item.title);
    }

    // 5. Build breadcrumb string
    breadcrumb = path.join(' › ');

    const typeLabel = (item.item_type || itemType || 'task').toUpperCase();

    const render = () => {
        if (!item) return;

        if (viewMode) {
            drawer.innerHTML = `
                <div class="drawer-header" style="padding: 0.75rem 1.25rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: white; flex-shrink: 0;">
                    <div style="min-width: 0; flex: 1; margin-right: 1.25rem;">
                        <div style="margin-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.35rem;">
                            <div style="align-self: flex-start; font-size: 0.6rem; font-weight: 800; color: var(--brand-blue); background: rgba(59, 130, 246, 0.08); padding: 2px 8px; border-radius: 12px; text-transform: uppercase; border: 1px solid rgba(59, 130, 246, 0.15); flex-shrink: 0;">
                                ${typeLabel}
                            </div>
                            <div style="font-size: 0.65rem; color: var(--text-tertiary); text-transform:uppercase; letter-spacing: 0.05em; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${breadcrumb}
                            </div>
                        </div>
                        <h2 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: var(--text-primary); line-height: 1.2; word-break: break-word;">${item.title || 'Dettagli'}</h2>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center; flex-shrink: 0;">
                        <button id="delete-item-btn" class="icon-btn" title="Elimina" style="width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #fff; border: 1px solid #fee2e2; color: #ef4444; cursor: pointer;"><span class="material-icons-round" style="font-size: 1.1rem;">delete_outline</span></button>
                        <button id="edit-mode-btn" class="icon-btn" title="Modifica" style="width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #fff; border: 1px solid #e2e8f0; color: var(--text-primary); cursor: pointer;"><span class="material-icons-round" style="font-size: 1.1rem;">edit</span></button>
                        <button class="icon-btn close-drawer-btn" title="Chiudi" style="width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #fff; border: 1px solid #e2e8f0; color: var(--text-secondary); cursor: pointer;"><span class="material-icons-round" style="font-size: 1.1rem;">close</span></button>
                    </div>
                </div>
                <div class="drawer-scroll-container" style="flex: 1; overflow-y: auto;">
                    <div style="padding: 1rem 1.25rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                        <!-- Row 1: Dates, Priority & Status -->
                        <div style="display: flex; align-items: flex-start; gap: 1.5rem; margin-bottom: 1.5rem; flex-wrap: nowrap;">
                            <!-- Inizio -->
                            <div style="flex: 0 0 auto; min-width: 90px;">
                                <label style="display: block; font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform:uppercase; letter-spacing: 0.05em;">INIZIO</label>
                                <div id="start-date-btn" class="date-trigger" style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 4px 0;">
                                    <span class="material-icons-round" style="font-size: 1.1rem; color: #8b5cf6;">calendar_today</span>
                                    <span>${item.start_date ? new Date(item.start_date).toLocaleDateString('it-IT') : 'Non impostata'}</span>
                                </div>
                            </div>
                            <!-- Scadenza -->
                            <div style="flex: 0 0 auto; min-width: 100px;">
                                <label style="display: block; font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform:uppercase; letter-spacing: 0.05em;">SCADENZA</label>
                                <div id="due-date-btn" class="date-trigger" style="font-size: 0.85rem; font-weight: 700; color: ${item.due_date && new Date(item.due_date) < new Date() ? '#ef4444' : 'var(--text-secondary)'}; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 4px 0;">
                                    <span class="material-icons-round" style="font-size: 1.1rem; color: #f43f5e;">event</span>
                                    <span>${item.due_date ? new Date(item.due_date).toLocaleDateString('it-IT') : 'Non impostata'}</span>
                                </div>
                            </div>
                            <!-- Priorità -->
                            <div style="flex: 0 0 auto; min-width: 110px;">
                                <label style="display: block; font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform:uppercase; letter-spacing: 0.05em;">PRIORITÀ</label>
                                <div style="position: relative;">
                                    <button id="priority-trigger-btn" style="appearance: none; border: none; padding: 4px 0; background: transparent; color: ${ITEM_PRIORITY[item.priority || 'medium']?.color}; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 0.85rem; font-weight: 700; transition: all 0.2s;">
                                        <span class="material-icons-round" style="font-size: 1.1rem; color: ${ITEM_PRIORITY[item.priority || 'medium']?.color};">flag</span>
                                        <span class="priority-label">${ITEM_PRIORITY[item.priority || 'medium']?.label}</span>
                                        <span class="material-icons-round" style="font-size: 1.1rem; opacity: 0.5;">expand_more</span>
                                    </button>
                                    <div id="priority-dropdown-menu" class="hidden dropdown-menu" style="position: absolute; top: 100%; left: 0; margin-top: 8px; background: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); border: 1px solid #e2e8f0; padding: 8px; z-index: 1000; min-width: 160px; display: flex; flex-direction: column; gap: 4px;">
                                        ${Object.keys(ITEM_PRIORITY).map(k => `<div class="priority-option" data-value="${k}" style="padding: 10px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 0.85rem; font-weight: 600; color: #334155; transition: background 0.2s;">
                                            <span class="material-icons-round" style="font-size: 1.1rem; color: ${ITEM_PRIORITY[k].color};">flag</span>
                                            <span>${ITEM_PRIORITY[k].label}</span>
                                            ${(item.priority || 'medium') === k ? `<span class="material-icons-round" style="margin-left: auto; font-size: 1.1rem; color: var(--brand-blue);">check</span>` : ''}
                                        </div>`).join('')}
                                    </div>
                                </div>
                            </div>
                            <!-- Stato -->
                            <div style="flex: 0 0 auto; min-width: 140px;">
                                <label style="display: block; font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform:uppercase; letter-spacing: 0.05em;">STATO</label>
                                <div style="position: relative;">
                                    <button id="status-trigger-btn" style="appearance: none; border: none; padding: 6px 14px; padding-right: 36px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; background-color: ${ITEM_STATUS[item.status]?.bg || '#f1f5f9'}; color: ${ITEM_STATUS[item.status]?.color || '#64748b'}; cursor: pointer; position: relative; text-align: left; transition: all 0.2s;">
                                        <span class="status-label">${ITEM_STATUS[item.status]?.label || item.status}</span>
                                        <span class="material-icons-round" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 1.14rem; opacity: 0.7;">expand_more</span>
                                    </button>
                                    <div id="status-dropdown-menu" class="hidden dropdown-menu" style="position: absolute; top: 100%; left: 0; margin-top: 8px; background: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); border: 1px solid #e2e8f0; padding: 8px; z-index: 1000; min-width: 180px; display: flex; flex-direction: column; gap: 4px;">
                                        ${Object.keys(ITEM_STATUS).map(k => `<div class="status-option" data-value="${k}" style="padding: 10px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 0.85rem; font-weight: 600; color: #334155; transition: background 0.2s;">
                                            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${ITEM_STATUS[k].color};"></div>
                                            <span>${ITEM_STATUS[k].label}</span>
                                            ${item.status === k ? `<span class="material-icons-round" style="margin-left: auto; font-size: 1.1rem; color: var(--brand-blue);">check</span>` : ''}
                                        </div>`).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Row 2: PM & Assignees -->
                        <div style="display: flex; align-items: flex-start; gap: 2rem; flex-wrap: wrap;">
                            <!-- Project Manager -->
                            <div style="flex: 0 0 auto; min-width: 160px;">
                                <label style="display: block; font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform:uppercase; letter-spacing: 0.05em;">PROJECT MANAGER</label>
                                <div id="pm-list" style="display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; position: relative;">
                                    ${assignees.filter(a => a.role === 'pm').map(a => `
                                        <div class="assignee-pill" style="display: flex; align-items: center; gap: 8px; padding: 4px 10px; padding-left: 4px; background: white; border: 1px solid var(--brand-purple); border-radius: 20px; font-size: 0.8rem; font-weight: 700; color: var(--brand-purple); box-shadow: 0 2px 4px rgba(0,0,0,0.03); position: relative;">
                                            <img src="${a.user?.avatar_url || '../../../assets/default-avatar.png'}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
                                            <span>${a.user?.first_name || 'PM'}</span>
                                            ${(state.profile?.role === 'admin' || state.profile?.tags?.some(t => t.toLowerCase().includes('pm'))) ? `
                                            <span class="material-icons-round" onclick="event.stopPropagation(); window.quickRemoveAssignee('${itemId}', '${a.id}')" style="font-size: 14px; cursor: pointer; color: #ef4444; margin-left: 4px;">close</span>
                                            ` : ''}
                                        </div>
                                    `).join('')}
                                    <button id="add-pm-btn" style="width: 28px; height: 28px; border-radius: 50%; border: 1px dashed var(--brand-purple); background: transparent; color: var(--brand-purple); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"><span class="material-icons-round" style="font-size: 1.2rem;">add</span></button>
                                    <div id="pm-picker" class="hidden dropdown-menu" style="position: absolute; background: white; box-shadow: 0 10px 40px rgba(0,0,0,0.15); border-radius: 12px; min-width: 260px; z-index: 1000; top: 100%; left: 0; margin-top: 8px; border: 1px solid #e2e8f0; overflow-y: auto; max-height: 300px;">
                                        ${renderUserPicker(spaceId, 'pm', new Set(assignees.filter(a => a.role === 'pm').map(a => a.user_ref || a.collaborator_ref)), new Set(spaceAssigneesPool.map(sa => sa.collaborator_ref || sa.user_ref)))}
                                    </div>
                                </div>
                            </div>
                            <!-- Assegnatari -->
                            <div style="flex: 1; min-width: 200px;">
                                <label style="display: block; font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform:uppercase; letter-spacing: 0.05em;">ASSEGNATO A</label>
                                <div id="assignee-list" style="display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; position: relative;">
                                    ${assignees.filter(a => a.role !== 'pm').map(a => `
                                        <div class="assignee-pill" title="${a.user?.full_name || ''}" style="display: flex; align-items: center; gap: 8px; padding: 4px 10px; padding-left: 4px; background: white; border: 1px solid #e2e8f0; border-radius: 20px; font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); box-shadow: 0 2px 4px rgba(0,0,0,0.03); position: relative;">
                                            <img src="${a.user?.avatar_url || '../../../assets/default-avatar.png'}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
                                            <span>${a.user?.first_name || 'User'}</span>
                                            ${(state.profile?.role === 'admin' || state.profile?.tags?.some(t => t.toLowerCase().includes('pm'))) ? `
                                            <span class="material-icons-round" onclick="event.stopPropagation(); window.quickRemoveAssignee('${itemId}', '${a.id}')" style="font-size: 14px; cursor: pointer; color: #ef4444; margin-left: 4px;">close</span>
                                            ` : ''}
                                        </div>
                                    `).join('')}
                                    <button id="add-assignee-btn" style="width: 28px; height: 28px; border-radius: 50%; border: 1px dashed var(--text-tertiary); background: transparent; color: var(--text-tertiary); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"><span class="material-icons-round" style="font-size: 1.2rem;">add</span></button>
                                    <div id="assignee-picker" class="hidden dropdown-menu" style="position: absolute; background: white; box-shadow: 0 10px 40px rgba(0,0,0,0.15); border-radius: 12px; min-width: 260px; z-index: 1000; top: 100%; left: 0; margin-top: 8px; border: 1px solid #e2e8f0; overflow-y: auto; max-height: 300px;">
                                        ${renderUserPicker(spaceId, 'assignee', new Set(assignees.filter(a => a.role !== 'pm').map(a => a.user_ref || a.collaborator_ref)), new Set(spaceAssigneesPool.map(sa => sa.collaborator_ref || sa.user_ref)))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Row 3: Resources Button -->
                        <div style="margin-top: 1.25rem; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 1rem; display: flex; justify-content: flex-start;">
                            <div style="position: relative;">
                                <button id="open-resources-btn" style="
                                    display: flex; align-items: center; gap: 0.6rem; padding: 6px 14px;
                                    background: white; border: 1px solid #e2e8f0; border-radius: 20px;
                                    color: var(--text-secondary); font-weight: 700; font-size: 0.8rem;
                                    cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.04);
                                ">
                                    <span class="material-icons-round" style="font-size: 1.14rem; color: #3b82f6;">cloud</span>
                                    <span>Risorse</span>
                                    ${item.cloud_links?.length > 0 ? `<span id="resource-count-badge" style="background: #3b82f6; color: white; min-width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 0.7rem; font-weight: 800; border: 2px solid white;">${item.cloud_links.length}</span>` : ''}
                                </button>
                                
                                <!-- Resources Popover -->
                                <div id="resources-popover" class="hidden dropdown-menu glass-card" style="
                                    position: absolute; top: calc(100% + 10px); left: 0; width: 340px; z-index: 1000;
                                    background: white; border: 1px solid #e2e8f0; padding: 1.25rem;
                                    box-shadow: 0 15px 40px rgba(0,0,0,0.18); border-radius: 16px;
                                ">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <span class="material-icons-round" style="font-size: 1.1rem; color: #3b82f6;">cloud</span>
                                            <h3 style="font-size: 0.9rem; font-weight: 800; margin: 0; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em;">Risorse Cloud</h3>
                                        </div>
                                        <button id="close-resources-popover-btn" style="background: none; border: none; cursor: pointer; color: var(--text-tertiary); display: flex;"><span class="material-icons-round" style="font-size: 1.2rem;">close</span></button>
                                    </div>
                                    <div id="item-cloud-links-container"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style="padding: 1.25rem; border-bottom: 2px solid #e2e8f0; position: relative;">
                        <label style="display: block; font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); margin-bottom: 0.6rem; text-transform:uppercase; letter-spacing: 0.05em;">DESCRIZIONE</label>
                        <div id="item-description-container" style="min-height: 48px;">
                            <div id="item-description-view" style="font-size: 0.9rem; color: var(--text-primary); line-height: 1.6; white-space: pre-wrap; border-radius: 8px; cursor: pointer; padding: 6px; transition: all 0.2s; border: 1px solid transparent; width: 100%; word-break: break-word; margin: 0;" onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#e2e8f0'" onmouseout="this.style.background='transparent'; this.style.borderColor='transparent'">${(item.notes && item.notes.trim()) || '<span style="color: #94a3b8; font-style: italic;">Clicca per aggiungere una descrizione...</span>'}</div>
                        </div>
                        <div id="desc-saving-indicator" class="hidden" style="position: absolute; top: 1.25rem; right: 1.25rem; font-size: 0.65rem; color: var(--brand-blue); font-weight: 700; display: flex; align-items: center; gap: 4px;">
                             <span class="material-icons-round" style="font-size: 0.8rem; animation: spin-hub 1s linear infinite;">sync</span> SALVATAGGIO...
                        </div>
                    </div>
                    <div class="comments-section" style="padding: 1.25rem;">
                        <h4 style="margin: 0 0 1rem; display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;">Commenti (${comments.length})</h4>
                        <div id="comments-list" style="margin-bottom: 1rem;">
                            ${comments.map(c => `<div style="padding: 0.75rem; background: #f8fafc; border-radius: 8px; margin-bottom: 0.5rem; font-size: 0.85rem;"><strong>${c.profiles?.first_name || 'Utente'}</strong>: ${c.body}</div>`).join('')}
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <input type="text" id="new-comment" placeholder="Scrivi un commento..." class="input-modern" style="flex: 1;">
                            <button type="button" id="add-comment-btn" class="primary-btn"><span class="material-icons-round" style="font-size: 1rem;">send</span></button>
                        </div>
                    </div>
                </div>
            `;
            attachViewModeListeners();
            new CloudLinksManager(drawer.querySelector('#item-cloud-links-container'), item.cloud_links || [], async (newLinks) => {
                await updateItemCloudLinks(itemId, newLinks);
                item.cloud_links = newLinks;
            });
        } else {
            drawer.innerHTML = `
                <div class="drawer-header" style="padding: 1.25rem 2rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: white; flex-shrink: 0; position: sticky; top: 0; z-index: 10;">
                    <h2 style="margin: 0; font-size: 1.25rem; font-weight: 600; color: var(--text-primary); letter-spacing: -0.01em; font-family: var(--font-titles);">
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
                    <button class="icon-btn close-drawer-btn" style="width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; color: var(--text-secondary); cursor: pointer; transition: all 0.2s;"><span class="material-icons-round" style="font-size: 20px;">close</span></button>
                </div>
                <div class="drawer-body" style="flex: 1; overflow-y: auto; padding: 1.5rem 2rem;">
                    <form id="item-form" style="display: flex; flex-direction: column; gap: 1.75rem; max-width: 580px; margin: 0 auto;">
                        <input type="hidden" id="task-space-ref" name="space_ref" value="${currentSpaceId || ''}">
                        <input type="hidden" name="item_type" value="${item.item_type || itemType}">
                        <input type="hidden" name="parent_ref" value="${currentParentRef || ''}">
                        <input type="hidden" name="is_account_level" value="${item.is_account_level ? 'true' : 'false'}">
                        
                        <!-- Context Selection -->
                        ${!currentSpaceId ? `
                        <div class="form-group">
                            <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem;">Progetto o Commessa</label>
                            <div style="position: relative;">
                                <div id="context-picker-trigger" style="
                                    padding: 0 14px; height: 44px; background: #f8fafc; border: 1.2px solid #e2e8f0; border-radius: 10px; 
                                    font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: space-between;
                                    transition: all 0.2s;
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
                            <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem;">Titolo</label>
                            <input type="text" name="title" required value="${item.title || ''}" class="input-modern" style="height: 44px; padding: 0 14px; border-radius: 10px; font-weight: 500; font-size: 1rem; border: 1.2px solid #e2e8f0; width: 100%; box-sizing: border-box; background: white;">
                        </div>

                        <div style="height: 1px; background: #f1f5f9; margin: 0.5rem 0;"></div>
                        
                        <!-- People -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                            <div class="form-group">
                                <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem;">Project Manager</label>
                                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 6px; border: 1.2px solid #e2e8f0; border-radius: 10px; min-height: 44px; background: white;">
                                    ${pendingAssignees.filter(a => a.role === 'pm').map((a) => {
                        const originalIdx = pendingAssignees.indexOf(a);
                        return `
                                        <div class="pending-assignee-pill" style="display: flex; align-items: center; gap: 6px; background: #f5f3ff; color: #7c3aed; padding: 3px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 500; border: 1px solid #ddd6fe;">
                                            <img src="${a.user?.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(a.displayName)}" style="width: 18px; height: 18px; border-radius: 4px;">
                                            <span>${a.displayName}</span>
                                            <span class="material-icons-round remove-pending-btn" data-idx="${originalIdx}" style="font-size: 14px; cursor: pointer; opacity: 0.6;">close</span>
                                        </div>
                                        `;
                    }).join('')}
                                    <div style="position: relative;">
                                        <button type="button" id="form-add-pm-btn" style="width: 28px; height: 28px; border-radius: 6px; border: 1.2px dashed #cbd5e1; background: transparent; color: var(--text-tertiary); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"><span class="material-icons-round" style="font-size: 18px;">add</span></button>
                                        <div id="form-pm-picker" class="hidden" style="position: absolute; top: calc(100% + 6px); left: 0; min-width: 260px; background: white; border: 1.2px solid #e2e8f0; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); z-index: 1000; max-height: 300px; overflow-y: auto; padding: 4px;">
                                            ${renderUserPicker(currentSpaceId, 'pm', new Set(pendingAssignees.filter(a => a.role === 'pm').map(a => a.user_ref || a.collaborator_ref)), new Set(spaceAssigneesPool.map(sa => sa.collaborator_ref || sa.user_ref)))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="form-group">
                                <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem;">Assegnato a</label>
                                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 6px; border: 1.2px solid #e2e8f0; border-radius: 10px; min-height: 44px; background: white;">
                                    ${pendingAssignees.filter(a => a.role !== 'pm').map((a) => {
                        const originalIdx = pendingAssignees.indexOf(a);
                        return `
                                        <div class="pending-assignee-pill" style="display: flex; align-items: center; gap: 6px; background: #f8fafc; padding: 3px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 500; border: 1.2px solid #e2e8f0; color: var(--text-primary);">
                                            <img src="${a.user?.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(a.displayName)}" style="width: 18px; height: 18px; border-radius: 4px;">
                                            <span>${a.displayName}</span>
                                            <span class="material-icons-round remove-pending-btn" data-idx="${originalIdx}" style="font-size: 14px; cursor: pointer; color: var(--text-tertiary);">close</span>
                                        </div>
                                        `;
                    }).join('')}
                                    <div style="position: relative;">
                                        <button type="button" id="form-add-assignee-btn" style="width: 28px; height: 28px; border-radius: 6px; border: 1.2px dashed #cbd5e1; background: transparent; color: var(--text-tertiary); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"><span class="material-icons-round" style="font-size: 18px;">add</span></button>
                                        <div id="form-assignee-picker" class="hidden" style="position: absolute; top: calc(100% + 6px); left: 0; min-width: 260px; background: white; border: 1.2px solid #e2e8f0; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); z-index: 1000; max-height: 300px; overflow-y: auto; padding: 4px;">
                                            ${renderUserPicker(currentSpaceId, 'assignee', new Set(pendingAssignees.filter(a => a.role !== 'pm').map(a => a.user_ref || a.collaborator_ref)), new Set(spaceAssigneesPool.map(sa => sa.collaborator_ref || sa.user_ref)))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style="height: 1px; background: #f1f5f9; margin: 0.5rem 0;"></div>

                        <!-- Dates & Priority -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                            <div class="form-group">
                                <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem;">Pianificazione</label>
                                <div style="display: flex; gap: 8px;">
                                    <div id="form-start-date-trigger" style="flex: 1; cursor: pointer; display: flex; align-items: center; gap: 8px; height: 44px; background: white; border: 1.2px solid #e2e8f0; border-radius: 10px; padding: 0 12px; font-size: 0.9rem;">
                                        <span class="material-icons-round" style="font-size: 18px; color: var(--text-tertiary);">play_arrow</span>
                                        <span style="${!item.start_date ? 'color: var(--text-tertiary);' : 'font-weight: 500;'}">${item.start_date ? new Date(item.start_date).toLocaleDateString('it-IT') : 'Inizio'}</span>
                                    </div>
                                    <div id="form-due-date-trigger" style="flex: 1; cursor: pointer; display: flex; align-items: center; gap: 8px; height: 44px; background: white; border: 1.2px solid #e2e8f0; border-radius: 10px; padding: 0 12px; font-size: 0.9rem;">
                                        <span class="material-icons-round" style="font-size: 18px; color: var(--text-tertiary);">event_available</span>
                                        <span style="${!item.due_date ? 'color: var(--text-tertiary);' : 'font-weight: 500;'}">${item.due_date ? new Date(item.due_date).toLocaleDateString('it-IT') : 'Scadenza'}</span>
                                    </div>
                                </div>
                                <input type="hidden" name="start_date" value="${item.start_date || ''}">
                                <input type="hidden" name="due_date" value="${item.due_date || ''}">
                            </div>
                            <div class="form-group">
                                <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem;">Stato e Priorità</label>
                                <div style="display: flex; gap: 8px;">
                                    <div style="flex: 1.2; position: relative;">
                                        <div id="form-status-trigger" style="height: 44px; padding: 0 12px; border-radius: 10px; border: 1.2px solid #e2e8f0; background: white; font-size: 0.9rem; font-weight: 500; display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${ITEM_STATUS[item.status || 'todo']?.color || '#94a3b8'};"></div>
                                                <span>${ITEM_STATUS[item.status || 'todo']?.label || 'Da Fare'}</span>
                                            </div>
                                            <span class="material-icons-round" style="font-size: 18px; color: var(--text-tertiary);">expand_more</span>
                                        </div>
                                        <div id="form-status-picker" class="hidden glass-card" style="position: absolute; top: calc(100% + 6px); left: 0; width: 100%; z-index: 1000; background: white; border: 1.2px solid #e2e8f0; border-radius: 12px; box-shadow: 0 12px 48px rgba(0,0,0,0.12); padding: 6px;">
                                            ${Object.keys(ITEM_STATUS).map(k => `
                                                <div class="status-option-item" data-value="${k}" style="padding: 8px 10px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; transition: background 0.2s;">
                                                    <div style="width: 8px; height: 8px; border-radius: 50%; background: ${ITEM_STATUS[k].color};"></div>
                                                    <span>${ITEM_STATUS[k].label}</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                        <input type="hidden" name="status" value="${item.status || 'todo'}">
                                    </div>
                                    <div style="flex: 1; position: relative;">
                                        <div id="form-priority-trigger" style="height: 44px; padding: 0 12px; border-radius: 10px; border: 1.2px solid #e2e8f0; background: white; font-size: 0.9rem; font-weight: 500; display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <span class="material-icons-round" style="font-size: 18px; color: ${ITEM_PRIORITY[item.priority || 'medium']?.color || '#94a3b8'};">flag</span>
                                                <span>${ITEM_PRIORITY[item.priority || 'medium']?.label || 'Media'}</span>
                                            </div>
                                            <span class="material-icons-round" style="font-size: 18px; color: var(--text-tertiary);">expand_more</span>
                                        </div>
                                        <div id="form-priority-picker" class="hidden glass-card" style="position: absolute; top: calc(100% + 6px); left: 0; width: 100%; z-index: 1000; background: white; border: 1.2px solid #e2e8f0; border-radius: 12px; box-shadow: 0 12px 48px rgba(0,0,0,0.12); padding: 6px;">
                                            ${Object.keys(ITEM_PRIORITY).map(k => `
                                                <div class="priority-option-item" data-value="${k}" style="padding: 8px 10px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; transition: background 0.2s;">
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
                                width: 100%; padding: 0.75rem 1rem; background: #f8fafc; border: 1.2px solid #e2e8f0; 
                                border-radius: 10px; display: flex; align-items: center; justify-content: space-between;
                                cursor: pointer; transition: all 0.2s;
                            ">
                                <div style="display: flex; align-items: center; gap: 8px; color: var(--text-secondary); font-weight: 500; font-size: 0.85rem;">
                                    <span class="material-icons-round" style="font-size: 18px; color: var(--brand-blue);">cached</span>
                                    Pianifica come Ricorrente
                                </div>
                                <span class="material-icons-round toggle-icon" style="color: var(--text-tertiary); transition: transform 0.3s;">expand_more</span>
                            </button>
                            
                            <div id="recurrence-settings-content" class="hidden" style="
                                padding: 1.5rem; background: #fff; border: 1.2px solid #e2e8f0; border-top: none; 
                                border-bottom-left-radius: 10px; border-bottom-right-radius: 10px; margin-top: -1px;
                            ">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.25rem;">
                                    <div>
                                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.4rem;">Frequenza</label>
                                        <select name="rec_freq" style="height: 38px; width: 100%; border-radius: 8px; border: 1.2px solid #e2e8f0; padding: 0 8px; font-size: 0.9rem;">
                                            <option value="">Nessuna</option>
                                            <option value="DAILY">Ogni giorno</option>
                                            <option value="WEEKLY">Ogni settimana</option>
                                            <option value="MONTHLY">Ogni mese</option>
                                            <option value="YEARLY">Ogni anno</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.4rem;">Ogni quanto</label>
                                        <div style="display: flex; gap: 8px;">
                                            <input type="number" name="rec_interval" value="1" min="1" style="width: 50px; height: 38px; text-align: center; border-radius: 8px; border: 1.2px solid #e2e8f0; padding: 0;">
                                            <select name="rec_unit" style="flex: 1; height: 38px; border-radius: 8px; border: 1.2px solid #e2e8f0; padding: 0 8px; font-size: 0.85rem;">
                                                <option value="day">giorno</option>
                                                <option value="workday">giorno lav.</option>
                                                <option value="week">settimana</option>
                                                <option value="month">mese</option>
                                                <option value="year">anno</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.25rem;">
                                    <div>
                                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.4rem;">Dalla data</label>
                                        <div id="form-rec-start-trigger" style="cursor: pointer; display: flex; align-items: center; gap: 8px; height: 38px; border-radius: 8px; border: 1.2px solid #e2e8f0; padding: 0 10px; font-size: 0.9rem; background: white;">
                                            <span class="material-icons-round" style="font-size: 16px; color: var(--text-tertiary);">event</span>
                                            <span style="font-weight: 500;">${new Date().toLocaleDateString('it-IT')}</span>
                                        </div>
                                        <input type="hidden" name="rec_start" value="${new Date().toISOString().split('T')[0]}">
                                    </div>
                                    <div>
                                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.4rem;">Fino a (opz.)</label>
                                        <div id="form-rec-until-trigger" style="cursor: pointer; display: flex; align-items: center; gap: 8px; height: 38px; border-radius: 8px; border: 1.2px solid #e2e8f0; padding: 0 10px; font-size: 0.9rem; background: white;">
                                            <span class="material-icons-round" style="font-size: 16px; color: var(--text-tertiary);">event_busy</span>
                                            <span style="color: var(--text-tertiary); font-style: italic;">Sempre</span>
                                        </div>
                                        <input type="hidden" name="rec_until" value="">
                                    </div>
                                </div>

                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; border-top: 1px solid #f1f5f9; padding-top: 1.25rem;">
                                    <div style="display: flex; flex-direction: column; gap: 8px;">
                                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-secondary); font-size: 0.85rem; font-weight: 500;">
                                            <input type="checkbox" name="rec_limit_active" style="width: 16px; height: 16px;">
                                            Termina dopo
                                        </label>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <input type="number" name="rec_limit_count" value="10" min="1" style="width: 60px; height: 32px; border-radius: 6px; border: 1.2px solid #e2e8f0; text-align: center; font-size: 0.85rem;">
                                            <span style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: 600; text-transform: uppercase;">volte</span>
                                        </div>
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 8px;">
                                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-secondary); font-size: 0.85rem; font-weight: 500;">
                                            <input type="checkbox" name="rec_advance_active" style="width: 16px; height: 16px;">
                                            Crea in anticipo
                                        </label>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <input type="number" name="rec_advance_count" value="1" min="1" style="width: 60px; height: 32px; border-radius: 6px; border: 1.2px solid #e2e8f0; text-align: center; font-size: 0.85rem;">
                                            <span style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: 600; text-transform: uppercase;">task</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        ` : ''}

                        <div style="height: 1px; background: #f1f5f9; margin: 0.5rem 0;"></div>

                        <!-- Notes -->
                        <div class="form-group" style="padding-top: 0.5rem;">
                            <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem;">Descrizione o Note</label>
                            <textarea name="notes" rows="4" class="input-modern" style="padding: 12px; font-size: 0.95rem; line-height: 1.6; border-radius: 10px; border: 1.2px solid #e2e8f0; width: 100%; box-sizing: border-box; resize: vertical; min-height: 100px; background: white;" placeholder="Aggiungi dettagli...">${item.notes || ''}</textarea>
                        </div>
                    </form>
                </div>
                <div class="drawer-footer" style="padding: 1.25rem 2rem; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 0.75rem; background: white; flex-shrink: 0; position: sticky; bottom: 0; z-index: 10;">
                    <button type="button" class="secondary-btn" id="cancel-edit-btn" style="padding: 0.6rem 1.25rem; font-weight: 500; border-radius: 8px; border: 1.2px solid #e2e8f0; background: white; color: var(--text-secondary); cursor: pointer; transition: all 0.2s;">Annulla</button>
                    <button type="submit" form="item-form" class="primary-btn" style="padding: 0.6rem 1.5rem; font-weight: 600; border-radius: 8px; background: var(--brand-blue); color: white; border: none; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 10px rgba(78, 146, 216, 0.2);">${isEdit ? 'Salva Modifiche' : 'Crea Attività'}</button>
                </div>
            `;
            attachEditModeListeners();
        }
    };

    const attachViewModeListeners = () => {
        const close = () => overlay.classList.add('hidden');
        drawer.querySelector('.close-drawer-btn').onclick = close;
        drawer.querySelector('#edit-mode-btn').onclick = () => { viewMode = false; render(); };
        drawer.querySelector('#delete-item-btn').onclick = async () => {
            if (await window.showConfirm("Eliminare?")) {
                await deletePMItem(itemId);
                close();
                document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { spaceId } }));
            }
        };

        const statusTrigger = drawer.querySelector('#status-trigger-btn');
        const statusMenu = drawer.querySelector('#status-dropdown-menu');
        if (statusTrigger) {
            statusTrigger.onclick = (e) => { e.stopPropagation(); statusMenu.classList.toggle('hidden'); drawer.querySelector('#priority-dropdown-menu')?.classList.add('hidden'); };
            statusMenu.querySelectorAll('.status-option').forEach(opt => {
                opt.onclick = async () => {
                    const s = opt.dataset.value;
                    item.status = s;
                    await updatePMItem(itemId, { status: s });
                    render();
                    document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { spaceId } }));
                };
            });
        }

        const priorityTrigger = drawer.querySelector('#priority-trigger-btn');
        const priorityMenu = drawer.querySelector('#priority-dropdown-menu');
        if (priorityTrigger) {
            priorityTrigger.onclick = (e) => { e.stopPropagation(); priorityMenu.classList.toggle('hidden'); statusMenu?.classList.add('hidden'); };
            priorityMenu.querySelectorAll('.priority-option').forEach(opt => {
                opt.onclick = async () => {
                    const p = opt.dataset.value;
                    item.priority = p;
                    await updatePMItem(itemId, { priority: p });
                    render();
                    document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { spaceId } }));
                };
            });
        }

        const setupDate = (id, field) => {
            const btn = drawer.querySelector(`#${id}`);
            if (btn) btn.onclick = (e) => {
                e.stopPropagation();
                toggleHubDatePicker(btn, async (d) => {
                    item[field] = d;
                    await updatePMItem(itemId, { [field]: d });
                    render();
                    document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { spaceId } }));
                }, item[field]);
            };
        };
        setupDate('start-date-btn', 'start_date');
        setupDate('due-date-btn', 'due_date');

        const setupPicker = (btnId, pkrId) => {
            const btn = drawer.querySelector(`#${btnId}`);
            const pkr = drawer.querySelector(`#${pkrId}`);
            if (btn) btn.onclick = (e) => { e.stopPropagation(); pkr.classList.toggle('hidden'); };
            if (pkr) pkr.querySelectorAll('.user-option').forEach(opt => {
                opt.onclick = async () => {
                    const uid = opt.dataset.uid;
                    const cid = opt.dataset.collabId;
                    const role = opt.dataset.targetRole || (btnId === 'add-pm-btn' ? 'pm' : 'assignee');
                    await assignUserToItem(itemId, uid || cid, role, !uid);
                    assignees = await fetchItemAssignees(itemId);
                    render();
                };
            });
        };
        setupPicker('add-assignee-btn', 'assignee-picker');
        setupPicker('add-pm-btn', 'pm-picker');

        const addCommentBtn = drawer.querySelector('#add-comment-btn');
        if (addCommentBtn) addCommentBtn.onclick = async () => {
            const body = drawer.querySelector('#new-comment').value;
            if (body) {
                await addComment(itemId, body);
                comments = await fetchItemComments(itemId);
                render();
            }
        };

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
                    const isNotRejected = statusOffer !== 'offerta rifiutata';
                    const isNotCompleted = statusOffer === 'offerta accettata' ? statusWork !== 'completato' : true;

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
                    opt.onmouseover = () => opt.style.background = '#f8fafc';
                    opt.onmouseout = () => opt.style.background = 'transparent';
                    opt.onclick = () => {
                        const type = opt.dataset.type;
                        const id = opt.dataset.id;
                        captureFormState();
                        if (type === 'client') {
                            currentClientId = id;
                            currentSpaceId = null;
                        } else {
                            currentSpaceId = id;
                            const s = state.pm_spaces?.find(x => x.id === id);
                            if (s?.type === 'commessa') {
                                const o = state.orders?.find(x => x.id === s.ref_ordine);
                                if (o) currentClientId = o.client_id;
                            }
                        }
                        render();
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

        drawer.querySelector('.close-drawer-btn').onclick = () => overlay.classList.add('hidden');
        const cancelBtn = drawer.querySelector('#cancel-edit-btn');
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                if (isEdit) { viewMode = true; render(); }
                else overlay.classList.add('hidden');
            };
        }

        const formAddBtn = drawer.querySelector('#form-add-assignee-btn');
        const formPicker = drawer.querySelector('#form-assignee-picker');
        if (formAddBtn) {
            formAddBtn.onclick = (e) => {
                e.stopPropagation();
                const isHidden = formPicker.classList.toggle('hidden');
                if (!isHidden) {
                    drawer.querySelector('#form-pm-picker')?.classList.add('hidden');
                    drawer.querySelector('#form-status-picker')?.classList.add('hidden');
                    drawer.querySelector('#form-priority-picker')?.classList.add('hidden');
                    drawer.querySelector('#context-picker-dropdown')?.classList.add('hidden');
                }
            };
            formPicker.querySelectorAll('.user-option').forEach(opt => {
                opt.onclick = () => {
                    captureFormState();
                    pendingAssignees.push({
                        user_ref: opt.dataset.uid,
                        collaborator_ref: opt.dataset.collabId,
                        role: opt.dataset.targetRole || 'assignee',
                        displayName: opt.dataset.name,
                        user: { avatar_url: opt.querySelector('img')?.src }
                    });
                    render();
                };
            });
        }

        const formAddPmBtn = drawer.querySelector('#form-add-pm-btn');
        const formPmPicker = drawer.querySelector('#form-pm-picker');
        if (formAddPmBtn) {
            formAddPmBtn.onclick = (e) => {
                e.stopPropagation();
                const isHidden = formPmPicker.classList.toggle('hidden');
                if (!isHidden) {
                    drawer.querySelector('#form-assignee-picker')?.classList.add('hidden');
                    drawer.querySelector('#form-status-picker')?.classList.add('hidden');
                    drawer.querySelector('#form-priority-picker')?.classList.add('hidden');
                    drawer.querySelector('#context-picker-dropdown')?.classList.add('hidden');
                }
            };
            formPmPicker.querySelectorAll('.user-option').forEach(opt => {
                opt.onclick = () => {
                    captureFormState();
                    pendingAssignees.push({
                        user_ref: opt.dataset.uid,
                        collaborator_ref: opt.dataset.collabId,
                        role: 'pm',
                        displayName: opt.dataset.name,
                        user: { avatar_url: opt.querySelector('img')?.src }
                    });
                    render();
                };
            });
        }

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
                    opt.onmouseover = () => opt.style.background = '#f8fafc';
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
                        trigger.querySelector('span').textContent = new Date(d).toLocaleDateString('it-IT');
                        trigger.querySelector('span').style.color = 'var(--text-primary)';
                        trigger.querySelector('span').style.fontStyle = 'normal';
                        trigger.querySelector('span').style.fontWeight = '500';
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

            if (isEdit) {
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
                document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { spaceId } }));
            } else {
                const newItem = await createPMItem(rawData);
                for (const p of pendingAssignees) {
                    await assignUserToItem(newItem.id, p.user_ref || p.collaborator_ref, p.role || 'assignee', !p.user_ref).catch(e => null);
                }
                overlay.classList.add('hidden');
                document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { spaceId } }));
            }
        };
    };

    render();
}

// --- CALENDAR PICKER HELPERS ---
let hubPickerCurrentDate = new Date();
let onHubDateSelect = null;

function toggleHubDatePicker(btn, onSelect, initialDate) {
    const existing = document.getElementById('hub-datepicker-popover');
    if (existing) {
        existing.remove();
        return;
    }

    onHubDateSelect = onSelect;
    hubPickerCurrentDate = initialDate ? new Date(initialDate) : new Date();

    const rect = btn.getBoundingClientRect();
    const popover = document.createElement('div');
    popover.id = 'hub-datepicker-popover';
    popover.style.cssText = `
        position: fixed; 
        top: ${rect.bottom + 12}px; 
        left: ${rect.left}px; 
        background: white; 
        border: 1px solid #e2e8f0; 
        border-radius: 16px; 
        padding: 20px; 
        box-shadow: 0 15px 50px rgba(0,0,0,0.18); 
        z-index: 999999; 
        width: 300px;
        animation: hub-pop-in 0.2s ease-out;
    `;

    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes hub-pop-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .hub-cal-day { 
            width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; 
            font-size: 0.85rem; font-weight: 500; border-radius: 50%; cursor: pointer; transition: all 0.2s;
            color: var(--text-primary);
        }
        .hub-cal-day:hover { background: #f8fafc; color: var(--brand-blue); }
        .hub-cal-day.today { color: var(--brand-blue); font-weight: 800; border: 1px solid var(--brand-blue-light); }
        .hub-cal-day.selected { background: var(--brand-blue) !important; color: white !important; font-weight: 700; }
        .hub-cal-day.other-month { opacity: 0.3; pointer-events: none; }
        .hub-cal-day-name { font-size: 0.65rem; font-weight: 800; color: var(--text-tertiary); text-align: center; text-transform: uppercase; padding-bottom: 8px; }
    `;
    document.head.appendChild(style);

    renderHubCalendar(popover, initialDate);
    document.body.appendChild(popover);

    const closeHandler = (e) => {
        if (!popover.contains(e.target) && !btn.contains(e.target)) {
            popover.remove();
            document.removeEventListener('mousedown', closeHandler);
        }
    };
    document.addEventListener('mousedown', closeHandler);
}

function renderHubCalendar(container, selectedDateStr) {
    const y = hubPickerCurrentDate.getFullYear();
    const m = hubPickerCurrentDate.getMonth();
    const names = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    let startIdx = firstDay.getDay() - 1;
    if (startIdx < 0) startIdx = 6; // Monday start

    const prevMonthLastDay = new Date(y, m, 0).getDate();
    let daysHtml = '';

    // Prev Month
    for (let i = 0; i < startIdx; i++) {
        daysHtml += `<div class="hub-cal-day other-month">${prevMonthLastDay - startIdx + i + 1}</div>`;
    }

    // Current Month
    const today = new Date().toISOString().split('T')[0];
    const selected = selectedDateStr ? selectedDateStr.split('T')[0] : null;

    for (let d = 1; d <= lastDay.getDate(); d++) {
        const cur = new Date(y, m, d).toISOString().split('T')[0];
        let cls = 'hub-cal-day';
        if (cur === today) cls += ' today';
        if (cur === selected) cls += ' selected';
        daysHtml += `<div class="${cls}" data-day="${d}">${d}</div>`;
    }

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-primary);">${names[m]} ${y}</div>
            <div style="display: flex; gap: 4px;">
                <button id="hub-prev-month" style="background: none; border: none; cursor: pointer; padding: 4px; color: var(--text-secondary);"><span class="material-icons-round">chevron_left</span></button>
                <button id="hub-next-month" style="background: none; border: none; cursor: pointer; padding: 4px; color: var(--text-secondary);"><span class="material-icons-round">chevron_right</span></button>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">
            <div class="hub-cal-day-name">L</div><div class="hub-cal-day-name">M</div><div class="hub-cal-day-name">M</div>
            <div class="hub-cal-day-name">G</div><div class="hub-cal-day-name">V</div><div class="hub-cal-day-name">S</div><div class="hub-cal-day-name">D</div>
            ${daysHtml}
        </div>
    `;

    container.querySelector('#hub-prev-month').onclick = (e) => { e.stopPropagation(); hubPickerCurrentDate.setMonth(m - 1); renderHubCalendar(container, selectedDateStr); };
    container.querySelector('#hub-next-month').onclick = (e) => { e.stopPropagation(); hubPickerCurrentDate.setMonth(m + 1); renderHubCalendar(container, selectedDateStr); };
    container.querySelectorAll('.hub-cal-day:not(.other-month)').forEach(el => {
        el.onclick = () => {
            const d = new Date(y, m, parseInt(el.dataset.day));
            // Set time to noon to avoid timezone shift issues when converting to ISO date string
            d.setHours(12, 0, 0, 0);
            onHubDateSelect(d.toISOString());
            container.remove();
        };
    });
}

window.quickRemoveAssignee = async (itemId, assignmentId) => {
    if (!confirm("Rimuovere questa persona dalla task?")) return;
    try {
        await supabase.from('pm_item_assignees').delete().eq('id', assignmentId);
        // Refresh the drawer to show updated state
        if (typeof openHubDrawer === 'function') {
            openHubDrawer(itemId);
        }
    } catch (e) {
        console.error("Error removing assignee:", e);
        alert("Errore durante la rimozione dell'assegnatario.");
    }
};
