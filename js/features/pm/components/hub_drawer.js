// Hub Drawer - Full item editor panel
import '../../../utils/modal-utils.js?v=157';
import {
    createPMItem,
    updatePMItem,
    deletePMItem,
    fetchItemComments,
    addComment,
    fetchItemAssignees,
    assignUserToItem,
    removeUserFromItem
} from '../../../modules/pm_api.js?v=157';
import { state } from '../../../modules/state.js?v=157';



const ITEM_STATUS = {
    'todo': { label: 'Da Fare', color: '#94a3b8', bg: '#f1f5f9' },
    'in_progress': { label: 'In Corso', color: '#3b82f6', bg: '#eff6ff' },
    'blocked': { label: 'Bloccato', color: '#ef4444', bg: '#fef2f2' },
    'review': { label: 'Revisione', color: '#f59e0b', bg: '#fffbeb' },
    'done': { label: 'Completata', color: '#10b981', bg: '#ecfdf5' }
};

export async function openHubDrawer(itemId, spaceId, parentId = null, itemType = 'task') {
    const overlay = document.getElementById('hub-drawer-overlay');
    const drawer = document.getElementById('hub-drawer');

    if (!overlay || !drawer) {
        console.error("Drawer elements not found");
        return;
    }

    const isEdit = !!itemId;
    let item = null;
    let comments = [];
    let assignees = [];

    let viewMode = isEdit;

    // For Form Mode (Pending Assignments)
    let pendingAssignees = [];
    // On edit, we will populate this after fetch, but usually we prefer live edit in view mode. 
    // However, for consistency, if we allow editing in form, we should sync.
    // For specific "Creation" request, we start empty.

    // Fetch data
    if (isEdit) {
        const items = window._hubContext?.items || [];
        item = items.find(i => i.id === itemId);
        if (!item) {
            console.error("Item not found:", itemId);
            return;
        }
        try {
            [comments, assignees] = await Promise.all([
                fetchItemComments(itemId),
                fetchItemAssignees(itemId)
            ]);
            // Sync pending assignees for Edit mode immediately after fetch
            if (assignees) {
                pendingAssignees = assignees.map(a => ({
                    user_ref: a.user_ref,
                    collaborator_ref: a.collaborator_ref,
                    role: a.role, // 'assignee' or 'pm'
                    user: a.user
                }));
            }
        } catch (e) {
            console.error("Error fetching details:", e);
        }
    } else {
        // Init empty item for constraints
        item = {
            item_type: itemType,
            status: 'todo',
            priority: 'medium'
        };
        pendingAssignees = []; // Start empty for new item
    }

    // Sync pending on edit load
    const syncPendingFromExisting = () => {
        if (assignees && assignees.length) {
            pendingAssignees = assignees.map(a => ({
                user_ref: a.user_ref,
                collaborator_ref: a.collaborator_ref,
                role: a.role,
                user: a.user
            }));
        }
    };

    // Helper to capture current form values into the 'item' object before re-render
    const captureFormState = () => {
        const form = drawer.querySelector('#item-form');
        if (!form) return;
        const formData = new FormData(form);
        // Only update editable fields if we are in edit/create mode
        if (!isEdit || !viewMode) {
            // Create a temp item object if null
            if (!item) item = {};
            item.title = formData.get('title') || item.title;
            item.status = formData.get('status') || item.status;
            item.priority = formData.get('priority') || item.priority;
            item.notes = formData.get('notes') || item.notes;

            // Dates need care to not break format
            const start = formData.get('start_date');
            if (start) item.start_date = start;

            const end = formData.get('due_date');
            if (end) item.due_date = end;
        }
    };

    // Default PM Logic on Creation
    if (!isEdit) {
        // Pre-fill default PM if exists in space
        let space = state.pm_spaces?.find(s => s.id === spaceId);

        // Fallback: If space not in global state, try window context
        if (!space && window._hubContext?.space?.id === spaceId) {
            space = window._hubContext.space;
        }

        console.log('[HubDrawer] Default PM check:', { spaceId, space, defaultPm: space?.default_pm_user_ref });

        if (space && space.default_pm_user_ref) {
            // Try profiles first
            let pm = state.profiles?.find(p => p.id === space.default_pm_user_ref);

            // Fallback: Find collaborator with this user_id
            if (!pm) {
                const collabAsPm = state.collaborators?.find(c => c.user_id === space.default_pm_user_ref);
                if (collabAsPm) {
                    pm = {
                        id: collabAsPm.user_id,
                        first_name: collabAsPm.first_name || collabAsPm.full_name,
                        last_name: collabAsPm.last_name || '',
                        avatar_url: collabAsPm.avatar_url
                    };
                    console.log('[HubDrawer] Found PM via collaborator fallback:', pm);
                }
            }

            if (pm) {
                const pmName = `${pm.first_name || ''} ${pm.last_name || ''}`.trim() || 'PM';
                pendingAssignees.push({
                    user_ref: pm.id,
                    role: 'pm',
                    displayName: pmName,
                    user: { first_name: pm.first_name, last_name: pm.last_name, avatar_url: pm.avatar_url, full_name: pmName }
                });
                console.log('[HubDrawer] Pre-filled PM:', pmName);
            } else {
                console.warn('[HubDrawer] PM profile not found for id:', space.default_pm_user_ref);
            }
        }
    }

    const render = () => {
        // --- VIEW MODE (Read/Quick Edit) ---
        if (viewMode) {
            drawer.innerHTML = `
                <!-- Header -->
                <div class="drawer-header" style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--surface-2); display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem; text-transform:uppercase;">
                            #${(item.item_type || itemType)}
                        </div>
                        <h2 style="margin: 0; font-size: 1.4rem; font-weight: 700;">${item.title}</h2>
                    </div>
                    <div style="display: flex; gap: 0.75rem; align-items: center;">
                        <!-- Delete Button (Circular) -->
                        <button id="delete-item-btn" class="icon-btn" title="Elimina" style="
                            width: 38px; height: 38px; border-radius: 50%;
                            display: flex; align-items: center; justify-content: center;
                            background: #fff; border: 1px solid #fee2e2; color: #ef4444;
                            cursor: pointer; box-shadow: var(--shadow-soft); transition: all 0.2s;
                        " onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='#fff'">
                            <span class="material-icons-round" style="font-size: 1.25rem;">delete_outline</span>
                        </button>

                        <!-- Edit Button (Circular) -->
                        <button id="edit-mode-btn" class="icon-btn" title="Modifica" style="
                            width: 38px; height: 38px; border-radius: 50%;
                            display: flex; align-items: center; justify-content: center;
                            background: #fff; border: 1px solid var(--surface-2); color: var(--text-primary);
                            cursor: pointer; box-shadow: var(--shadow-soft); transition: all 0.2s;
                        " onmouseover="this.style.background='var(--surface-1)'" onmouseout="this.style.background='#fff'">
                            <span class="material-icons-round" style="font-size: 1.25rem;">edit</span>
                        </button>

                        <!-- Close Button (Circular) -->
                        <button class="icon-btn close-drawer-btn" title="Chiudi" style="
                            width: 38px; height: 38px; border-radius: 50%;
                            display: flex; align-items: center; justify-content: center;
                            background: #fff; border: 1px solid var(--surface-2); color: var(--text-secondary);
                            cursor: pointer; box-shadow: var(--shadow-soft); transition: all 0.2s;
                        " onmouseover="this.style.background='var(--surface-1)'" onmouseout="this.style.background='#fff'">
                            <span class="material-icons-round" style="font-size: 1.25rem;">close</span>
                        </button>
                    </div>
                </div>

                <!-- Hero / Meta -->
                <div style="padding: 1.5rem; background: var(--surface-1); border-bottom: 1px solid var(--surface-2);">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                        
                        <!-- Status (Custom Dropdown) -->
                        <div>
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem; letter-spacing: 0.05em;">STATO</label>
                            
                            <div style="position: relative;">
                                <!-- Trigger -->
                                <button id="status-trigger-btn" style="
                                    appearance: none;
                                    border: none;
                                    padding: 6px 16px;
                                    padding-right: 36px;
                                    border-radius: 20px;
                                    font-size: 0.85rem;
                                    font-weight: 600;
                                    background-color: ${ITEM_STATUS[item.status]?.bg || '#f1f5f9'};
                                    color: ${ITEM_STATUS[item.status]?.color || '#64748b'};
                                    cursor: pointer;
                                    transition: all 0.2s;
                                    position: relative;
                                    min-width: 140px;
                                    text-align: left;
                                ">
                                    <span class="status-label">${ITEM_STATUS[item.status]?.label || item.status}</span>
                                    <span class="material-icons-round" style="
                                        position: absolute;
                                        right: 10px;
                                        top: 50%;
                                        transform: translateY(-50%);
                                        font-size: 1.1rem;
                                        opacity: 0.7;
                                    ">expand_more</span>
                                </button>

                                <!-- Dropdown Menu -->
                                <div id="status-dropdown-menu" class="hidden" style="
                                    position: absolute;
                                    top: 100%;
                                    left: 0;
                                    margin-top: 8px;
                                    background: white;
                                    border-radius: 12px;
                                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                                    border: 1px solid var(--surface-2);
                                    padding: 6px;
                                    z-index: 1000;
                                    min-width: 160px;
                                    display: flex;
                                    flex-direction: column;
                                    gap: 2px;
                                ">
                                    ${Object.keys(ITEM_STATUS).map(k => `
                                        <div class="status-option" data-value="${k}" style="
                                            padding: 8px 12px;
                                            border-radius: 8px;
                                            cursor: pointer;
                                            display: flex;
                                            align-items: center;
                                            gap: 8px;
                                            font-size: 0.85rem;
                                            font-weight: 500;
                                            color: #334155;
                                            transition: background 0.1s;
                                        " onmouseover="this.style.background='var(--surface-1)'" onmouseout="this.style.background='transparent'">
                                            <div style="width: 8px; height: 8px; border-radius: 50%; background: ${ITEM_STATUS[k].color || '#ccc'};"></div>
                                            ${ITEM_STATUS[k].label}
                                            ${item.status === k ? `<span class="material-icons-round" style="margin-left: auto; font-size: 16px; color: var(--brand-color);">check</span>` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>

                <!-- Project Managers -->
                        <div style="position: relative; margin-bottom: 1.5rem;">
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem; letter-spacing: 0.05em;">PROJECT MANAGER</label>
                            
                            <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                                <!-- Current PMs -->
                                ${assignees.filter(a => a.role === 'pm').map(a => {
                let userName = a.user?.full_name;
                if (!userName && a.user?.first_name) {
                    userName = `${a.user.first_name} ${a.user.last_name || ''}`.trim();
                }
                if (!userName) userName = 'Utente';

                const initial = userName.charAt(0).toUpperCase();
                return `
                                    <div class="assignee-pill pm-pill" style="display: flex; align-items: center; gap: 8px; background: rgba(66, 133, 244, 0.1); border: 1px solid rgba(66, 133, 244, 0.2); padding: 4px 10px 4px 4px; border-radius: 24px; transition: all 0.2s;">
                                        <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--brand-blue); color: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; border: 2px solid white; overflow: hidden;">
                                            ${a.user?.avatar_url ? `<img src="${a.user.avatar_url}" style="width:100%; height:100%; object-fit:cover;">` : initial}
                                        </div>
                                        <div style="display: flex; flex-direction: column; line-height: 1.1;">
                                            <span style="font-size: 0.85rem; font-weight: 500; color: var(--brand-blue);">${userName}</span>
                                            <span style="font-size: 0.65rem; color: var(--text-tertiary); font-weight: 400;">Project Manager</span>
                                        </div>
                                        <span class="material-icons-round remove-assignee-btn" data-id="${a.id}" data-role="pm" style="font-size: 16px; color: var(--brand-blue); cursor: pointer; margin-left: 4px; opacity: 0.5; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.5'">close</span>
                                    </div>
                                `;
            }).join('')}

                                <!-- Add PM Button -->
                                <button id="add-pm-btn" style="
                                    width: 36px; height: 36px; border-radius: 50%; 
                                    border: 1px dashed var(--brand-blue); 
                                    display: flex; align-items: center; justify-content: center;
                                    color: var(--brand-blue); cursor: pointer; background: transparent;
                                    transition: background 0.2s;
                                ">
                                    <span class="material-icons-round" style="font-size: 20px;">add</span>
                                </button>

                                <!-- PM Picker -->
                                <div id="pm-picker" class="hidden" style="
                                    position: absolute; 
                                    background: white; 
                                    box-shadow: 0 10px 40px rgba(0,0,0,0.15); 
                                    border-radius: 12px; 
                                    min-width: 260px; 
                                    max-width: 350px;
                                    z-index: 1000;
                                    top: 100%;
                                    left: 0;
                                    margin-top: 8px;
                                    border: 1px solid var(--surface-2);
                                    overflow: hidden;
                                ">
                                    ${renderAssigneePickerOptions(spaceId, 'pm')}
                                </div>
                            </div>
                        </div>

                        <!-- Assignees -->
                        <div style="position: relative;">
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem; letter-spacing: 0.05em;">ASSEGNATO A</label>
                            
                            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                ${assignees.filter(a => !a.role || a.role === 'assignee').map(a => {
                const userName = `${a.user?.first_name || ''} ${a.user?.last_name || ''}`.trim() || 'Utente';
                const initial = userName.charAt(0).toUpperCase();
                return `
                                    <div class="assignee-pill" style="display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid var(--surface-2); padding: 4px 10px 4px 4px; border-radius: 20px; transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                        <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--surface-3); color: var(--text-secondary); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; overflow: hidden;">
                                            ${a.user?.avatar_url ? `<img src="${a.user.avatar_url}" style="width:100%; height:100%; object-fit:cover;">` : initial}
                                        </div>
                                        <span style="font-size: 0.85rem; font-weight: 500;">${userName}</span>
                                        <span class="material-icons-round remove-assignee-btn" data-id="${a.id}" data-role="assignee" style="font-size: 16px; color: var(--text-tertiary); cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='var(--text-primary)'" onmouseout="this.style.color='var(--text-tertiary)'">close</span>
                                    </div>
                                `;
            }).join('')}
                                
                                <button id="add-assignee-btn" style="
                                    width: 32px; height: 32px; border-radius: 50%; 
                                    border: 1px dashed var(--text-secondary); 
                                    display: flex; align-items: center; justify-content: center;
                                    color: var(--text-secondary); cursor: pointer; background: transparent;
                                ">
                                    <span class="material-icons-round">add</span>
                                </button>
                                
                                <div id="assignee-picker" class="hidden" style="
                                    position: absolute; 
                                    background: white; 
                                    box-shadow: 0 10px 40px rgba(0,0,0,0.15); 
                                    border-radius: 12px; 
                                    min-width: 260px; 
                                    max-width: 350px;
                                    z-index: 1000;
                                    top: 100%;
                                    right: 0;
                                    margin-top: 8px;
                                    border: 1px solid var(--surface-2);
                                    overflow: hidden;
                                ">
                                    ${renderAssigneePickerOptions(spaceId, 'assignee')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Body -->
                <div class="drawer-body" style="padding: 1.5rem;">
                    <!-- Dates -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
                        <div>
                            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">INIZIO</label>
                            <div style="font-size: 0.95rem;">${item.start_date ? new Date(item.start_date).toLocaleDateString() : '-'}</div>
                        </div>
                        <div>
                            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">SCADENZA</label>
                            <div style="font-size: 0.95rem; color: ${item.due_date && new Date(item.due_date) < new Date() ? 'red' : 'inherit'}">
                                ${item.due_date ? new Date(item.due_date).toLocaleDateString() : '-'}
                            </div>
                        </div>
                    </div>

                    <!-- Description -->
                    <div style="margin-bottom: 2rem;">
                        <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">DESCRIZIONE</label>
                        <div style="margin-top: 0.5rem; line-height: 1.5; white-space: pre-wrap; font-size: 0.95rem;">${item.notes || '<span style="color:var(--text-secondary); font-style:italic;">Nessuna descrizione</span>'}</div>
                    </div>

                    <!-- Comments -->
                    ${renderCommentsSection(comments)}
                </div>
            `;

            attachViewModeListeners();

        } else {
            // --- EDIT / CREATE MODE ---
            drawer.innerHTML = `
                <div class="drawer-header" style="
                    padding: 1.25rem 1.5rem;
                    border-bottom: 1px solid var(--surface-2);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <h2 style="margin: 0; font-size: 1.1rem;">${isEdit ? 'Modifica' : 'Nuova'} ${itemType === 'attivita' ? 'Attività' : 'Task'}</h2>
                    <button class="icon-btn close-drawer-btn"><span class="material-icons-round">close</span></button>
                </div>
                
                <div class="drawer-body" style="flex: 1; overflow-y: auto; padding: 1.5rem;">
                    <form id="item-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
                        <input type="hidden" name="space_ref" value="${spaceId}">
                        ${parentId ? `<input type="hidden" name="parent_ref" value="${parentId}">` : ''}
                        <input type="hidden" name="item_type" value="${item?.item_type || itemType}">
                        
                        <div class="form-group">
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Titolo *</label>
                            <input type="text" name="title" required value="${item?.title || ''}" class="input-modern" placeholder="Descrivi l'attività...">
                        </div>

                        <!-- PROJECT MANAGER (Read Only - From Commessa) -->
                        ${(() => {
                    // Get PM from pendingAssignees (pre-filled) or from space
                    const pmAssignee = pendingAssignees.find(a => a.role === 'pm');
                    if (pmAssignee) {
                        let pmName = pmAssignee.displayName || pmAssignee.user?.full_name;
                        if (!pmName && pmAssignee.user?.first_name) {
                            pmName = `${pmAssignee.user.first_name} ${pmAssignee.user.last_name || ''}`.trim();
                        }
                        if (!pmName) pmName = 'PM';

                        const pmAvatar = pmAssignee.user?.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(pmName);
                        return `
                                    <div class="form-group">
                                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Project Manager</label>
                                        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border: 1px solid rgba(66, 133, 244, 0.3); border-radius: 8px; background: rgba(66, 133, 244, 0.05);">
                                            <div style="width: 28px; height: 28px; border-radius: 50%; background: #ccc; overflow: hidden;">
                                                <img src="${pmAvatar}" style="width: 100%; height: 100%; object-fit: cover;">
                                            </div>
                                            <span style="font-size: 0.9rem; font-weight: 500; color: var(--brand-blue);">${pmName}</span>
                                            <span class="material-icons-round" style="font-size: 14px; color: var(--brand-blue); margin-left: auto;">verified</span>
                                        </div>
                                    </div>
                                `;
                    }
                    return ''; // No PM to show
                })()}

                        <!-- ASSIGNEES IN FORM (Collaborators Only) -->
                        <div class="form-group">
                             <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Assegnato a</label>
                             <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; padding: 0.5rem; border: 1px solid var(--surface-2); border-radius: 8px; background: white;">
                                 
                                 <!-- Pending Assignees Pills (Collaborators Only - Exclude PM) -->
                                 ${pendingAssignees.filter(a => a.role !== 'pm').map((a, idx) => {
                    let displayName = a.user?.full_name || a.displayName;
                    if (!displayName && a.user?.first_name) {
                        displayName = `${a.user.first_name} ${a.user.last_name || ''}`.trim();
                    }
                    if (!displayName) displayName = 'Assegnatario';

                    const avatarUrl = a.user?.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(displayName);
                    return `
                                         <div class="pending-assignee-pill" style="display: flex; align-items: center; gap: 6px; background: var(--surface-2); padding: 4px 8px 4px 4px; border-radius: 20px;">
                                             <div style="width: 24px; height: 24px; border-radius: 50%; background: #ccc; overflow: hidden;">
                                                 <img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                                             </div>
                                             <span style="font-size: 0.85rem;">${displayName}</span>
                                             <span class="material-icons-round remove-pending-btn" data-idx="${pendingAssignees.indexOf(a)}" style="font-size: 16px; cursor: pointer; opacity: 0.6;">close</span>
                                         </div>
                                     `;
                }).join('')}

                                 <!-- Add Button -->
                                 <div style="position: relative;">
                                     <button type="button" id="form-add-assignee-btn" style="width: 28px; height: 28px; border-radius: 50%; border: 1px dashed var(--text-secondary); display: flex; align-items: center; justify-content: center; color: var(--text-secondary); background: transparent; cursor: pointer;">
                                         <span class="material-icons-round" style="font-size: 16px;">add</span>
                                     </button>

                                     <!-- Helper Picker -->
                                     <div id="form-assignee-picker" class="hidden" style="
                                         position: absolute; 
                                         top: 100%; 
                                         left: 0; 
                                         min-width: 260px; 
                                         max-width: 350px;
                                         background: white; 
                                         border-radius: 12px; 
                                         box-shadow: 0 10px 40px rgba(0,0,0,0.15); 
                                         z-index: 100; 
                                         border: 1px solid var(--surface-2);
                                         overflow: hidden;
                                         margin-top: 8px;
                                     ">
                                         ${renderAssigneePickerOptions(spaceId, 'assignee')}
                                     </div>
                                 </div>
                             </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Stato</label>
                                <select name="status" class="input-modern">
                                    ${Object.keys(ITEM_STATUS).map(k => `
                                        <option value="${k}" ${item?.status === k ? 'selected' : ''}>${ITEM_STATUS[k].label}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Priorità</label>
                                <select name="priority" class="input-modern">
                                    <option value="low" ${item?.priority === 'low' ? 'selected' : ''}>Bassa</option>
                                    <option value="medium" ${item?.priority === 'medium' ? 'selected' : ''}>Media</option>
                                    <option value="high" ${item?.priority === 'high' ? 'selected' : ''}>Alta</option>
                                    <option value="urgent" ${item?.priority === 'urgent' ? 'selected' : ''}>Urgente</option>
                                </select>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label class="label-sm">Data Inizio</label>
                                <input type="date" name="start_date" value="${item?.start_date ? item.start_date.split('T')[0] : ''}" class="input-modern">
                            </div>
                            <div class="form-group">
                                <label class="label-sm">Scadenza</label>
                                <input type="date" name="due_date" value="${item?.due_date ? item.due_date.split('T')[0] : ''}" class="input-modern">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="label-sm">Note / Descrizione</label>
                            <textarea name="notes" rows="4" class="input-modern" placeholder="Aggiungi dettagli...">${item?.notes || ''}</textarea>
                        </div>
                    </form>
                </div>
                
                <div class="drawer-footer" style="padding: 1rem 1.5rem; border-top: 1px solid var(--surface-2); display: flex; justify-content: flex-end; gap: 0.75rem;">
                    <button type="button" class="secondary-btn" id="cancel-edit-btn">Annulla</button>
                    <button type="submit" form="item-form" class="primary-btn">${isEdit ? 'Salva Modifiche' : 'Crea'}</button>
                </div>
            `;
            attachEditModeListeners();
        }
    };

    // --- LOGIC HELPERS ---

    const renderPMInfo = (spaceId) => {
        const space = state.pm_spaces?.find(s => s.id === spaceId) || {};
        if (!space.default_pm_user_ref) return '';
        const pm = state.profiles?.find(p => p.id === space.default_pm_user_ref);
        if (!pm) return '';

        return `
            <div style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--text-secondary);">
                <span class="material-icons-round" style="font-size: 14px;">manage_accounts</span>
                <strong>PM:</strong> ${pm.first_name} ${pm.last_name}
            </div>
        `;
    };

    const renderAssigneePickerOptions = (spaceId, targetRole = 'assignee') => {
        const space = state.pm_spaces?.find(s => s.id === spaceId) || {};
        const orderId = space.ref_ordine;

        const assignedIds = new Set(assignees.map(a => a.user_ref));
        const suggestedSet = new Set();

        if (orderId && state.assignments) {
            state.assignments
                .filter(a => a.order_id === orderId)
                .forEach(a => suggestedSet.add(a.collaborator_id));
        }

        const suggestions = [];
        const others = [];
        const processedUserIds = new Set();

        (state.collaborators || []).forEach(c => {
            // Filter inactive
            if (c.is_active === false || c.active === false) return; // Strict check for false

            const uid = c.user_id;

            // 1. Role Filtering
            if (targetRole === 'pm') {
                let tags = c.tags || [];
                if (typeof tags === 'string') {
                    try { tags = JSON.parse(tags); } catch (e) { tags = tags.split(',').map(t => t.trim()); }
                }
                const isProjectManager = Array.isArray(tags) &&
                    tags.some(t => t.toLowerCase() === 'project manager' || t.toLowerCase() === 'pm');

                if (!isProjectManager) return;
            }

            // If they have an account (uid), ensure we don't show duplicates/already assigned
            if (uid && (assignedIds.has(uid) || processedUserIds.has(uid))) return;
            if (uid) processedUserIds.add(uid);

            // Prioritize Database Collaborator Info
            let name = c.full_name;
            if (!name || name === 'Utente') {
                name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
            }
            if (!name) name = 'Collaboratore Sconosciuto';

            let avatar = c.avatar_url;

            // Fallback to Profile ONLY if we have a uid and missing data
            if ((!name || !avatar) && uid) {
                const p = state.profiles?.find(x => x.id === uid);
                if (p) {
                    if (!name || name === 'Collaboratore Sconosciuto') name = `${p.first_name} ${p.last_name}`;
                    if (!avatar) avatar = p.avatar_url;
                }
            }

            const u = {
                uid: uid,
                collabId: c.id,
                name: name,
                avatar: avatar,
                hasAccount: !!uid
            };

            if (suggestedSet.has(c.id)) suggestions.push(u);
            else others.push(u);
        });

        const headerStyle = "padding: 10px 12px 6px; font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--surface-2); margin-bottom: 4px;";

        const renderUserOption = (u) => {
            const initial = u.name.charAt(0).toUpperCase();
            return `
                <div class="user-option" 
                    data-uid="${u.uid || ''}" 
                    data-collab-id="${u.collabId || ''}" 
                    data-has-account="${!!u.uid}" 
                    data-target-role="${targetRole}" 
                    style="
                        padding: 8px 12px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        cursor: pointer;
                        transition: background 0.1s;
                    " 
                    onmouseover="this.style.background='var(--surface-1)'" 
                    onmouseout="this.style.background='transparent'"
                >
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--surface-3); overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--text-secondary); border: 1px solid var(--surface-2);">
                        ${u.avatar ? `<img src="${u.avatar}" style="width:100%; height:100%; object-fit:cover;">` : initial}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${u.name}</div>
                        <div style="font-size: 0.7rem; color: var(--text-tertiary); display: flex; align-items: center; gap: 4px;">
                            ${u.uid ? '<span class="material-icons-round" style="font-size: 10px; color: var(--brand-blue);">verified_user</span> User' : '<span class="material-icons-round" style="font-size: 10px;">person_outline</span> Guest'}
                        </div>
                    </div>
                </div>
            `;
        };

        return `
            <div style="max-height: 280px; overflow-y: auto;">
                ${suggestions.length ? `<div style="${headerStyle}">SUGGERITI</div>${suggestions.map(renderUserOption).join('')}` : ''}
                <div style="${headerStyle}">ALTRI</div>
                ${others.map(renderUserOption).join('')}
            </div>
        `;
    };

    const renderCommentsSection = (comments) => `
        <div class="comments-section" style="border-top: 1px solid var(--surface-2); padding-top: 1.5rem; margin-top: 0.5rem;">
            <h4 style="margin: 0 0 1rem; display: flex; align-items: center; gap: 0.5rem;">
                <span class="material-icons-round" style="font-size: 1.1rem;">chat_bubble_outline</span>
                Commenti (${comments.length})
            </h4>
            
            <div id="comments-list" style="max-height: 200px; overflow-y: auto; margin-bottom: 1rem;">
                ${comments.length === 0 ? `
                    <p class="text-secondary" style="font-size: 0.9rem;">Nessun commento ancora.</p>
                ` : comments.map(c => `
                    <div style="padding: 0.75rem; background: var(--surface-1); border-radius: 8px; margin-bottom: 0.5rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                            <span style="font-weight: 600; font-size: 0.85rem;">${c.author_user_ref || 'Anonimo'}</span>
                            <span class="text-xs text-secondary">${new Date(c.created_at).toLocaleDateString()}</span>
                        </div>
                        <p style="margin: 0; font-size: 0.9rem;">${c.body}</p>
                    </div>
                `).join('')}
            </div>
            
            <div style="display: flex; gap: 0.5rem;">
                <input type="text" id="new-comment" placeholder="Scrivi un commento..." class="input-modern" style="flex: 1;">
                <button type="button" id="add-comment-btn" class="primary-btn" style="padding: 0.75rem 1rem;">
                    <span class="material-icons-round" style="font-size: 1rem;">send</span>
                </button>
            </div>
        </div>
    `;

    // --- EVENT LISTENERS ---

    const attachViewModeListeners = () => {
        const closeBtn = drawer.querySelector('.close-drawer-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));

        drawer.querySelector('#edit-mode-btn').addEventListener('click', () => {
            viewMode = false;
            render();
        });

        const deleteBtn = drawer.querySelector('#delete-item-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (!await window.showConfirm("Sei sicuro di voler eliminare questa attività? Questa azione non può essere annullata.")) return;

                try {
                    deleteBtn.disabled = true;
                    deleteBtn.innerHTML = '<span class="loader-mini"></span>';

                    await deletePMItem(itemId);

                    window.showAlert?.("Attività eliminata con successo", "success");
                    overlay.classList.add('hidden');

                    // Trigger refresh on the hub
                    document.dispatchEvent(new CustomEvent('pm-item-changed', {
                        detail: { spaceId: spaceId, action: 'delete', itemId: itemId }
                    }));
                } catch (err) {
                    console.error("Delete failed:", err);
                    window.showAlert?.("Errore durante l'eliminazione: " + err.message, "error");
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = '<span class="material-icons-round" style="font-size: 1.25rem;">delete_outline</span>';
                }
            });
        }

        // Custom Status Dropdown Logic
        const statusTrigger = drawer.querySelector('#status-trigger-btn');
        const statusDropdown = drawer.querySelector('#status-dropdown-menu');

        if (statusTrigger && statusDropdown) {
            statusTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close others
                drawer.querySelectorAll('.hidden').forEach(el => {
                    if (el.id !== 'status-dropdown-menu' && !el.classList.contains('status-dropdown-menu')) {
                        // Don't accidentally close if logic overlaps, but here we want to close assign/pm pickers
                        if (el.id === 'pm-picker' || el.id === 'assignee-picker') el.classList.add('hidden');
                    }
                });
                statusDropdown.classList.toggle('hidden');
            });

            // Option selection
            statusDropdown.querySelectorAll('.status-option').forEach(opt => {
                opt.addEventListener('click', async (e) => {
                    const newStatus = opt.dataset.value;
                    statusDropdown.classList.add('hidden'); // Close immediately

                    if (newStatus === item.status) return;

                    try {
                        // Store old for rollback
                        const oldStatus = item.status;

                        // Optimistic UI Update
                        item.status = newStatus;

                        // Update Trigger UI
                        const cfg = ITEM_STATUS[newStatus];
                        statusTrigger.style.background = cfg.bg;
                        statusTrigger.style.color = cfg.color;
                        const labelEl = statusTrigger.querySelector('.status-label');
                        if (labelEl) labelEl.textContent = cfg.label;

                        // Trigger global refresh immediately
                        document.dispatchEvent(new CustomEvent('pm-item-changed', {
                            detail: { spaceId: spaceId, action: 'update', itemId: itemId }
                        }));

                        // API Call
                        await updatePMItem(itemId, { status: newStatus });

                        window.showAlert?.("Stato aggiornato", "success");
                    } catch (err) {
                        window.showAlert?.("Errore update stato: " + err.message, "error");
                        // Rollback simple visual? We'd need a re-render to be clean, or just alert.
                    }
                });
            });

            // Close on click outside
            document.addEventListener('click', (e) => {
                if (!statusTrigger.contains(e.target) && !statusDropdown.contains(e.target)) {
                    statusDropdown.classList.add('hidden');
                }
            });
        }

        const addBtn = drawer.querySelector('#add-assignee-btn');
        const picker = drawer.querySelector('#assignee-picker');

        if (addBtn && picker) {
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close other pickers
                drawer.querySelectorAll('.hidden').forEach(el => {
                    if (el.id === 'pm-picker' || el.id === 'status-dropdown-menu') el.classList.add('hidden');
                });
                picker.classList.toggle('hidden');
            });
        }

        const addPmBtn = drawer.querySelector('#add-pm-btn');
        const pmPicker = drawer.querySelector('#pm-picker');
        if (addPmBtn && pmPicker) {
            addPmBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close other pickers
                drawer.querySelectorAll('.hidden').forEach(el => {
                    if (el.id === 'assignee-picker' || el.id === 'status-dropdown-menu') el.classList.add('hidden');
                });
                pmPicker.classList.toggle('hidden');
            });
        }

        // Global click to close pickers
        setTimeout(() => {
            document.addEventListener('click', (e) => {
                if (picker && !picker.contains(e.target) && e.target !== addBtn) picker.classList.add('hidden');
                if (pmPicker && !pmPicker.contains(e.target) && e.target !== addPmBtn) pmPicker.classList.add('hidden');
            }, { capture: true }); // Capture to run before others? No wait, standard bubble is fine but need to be careful with removing listeners. 
            // Simplified: The existing click listener was {once:true}, which is buggy for toggling.
            // Better to attach a permanent listener to window or document body ONCE for the app, OR re-attach cleanly.
            // For now, let's just stick to the specific closers inside the handler?
            // Actually, best pattern:
        }, 0);

        // Document click close helper
        const closePickers = (e) => {
            if (picker && !picker.contains(e.target) && e.target !== addBtn) picker.classList.add('hidden');
            if (pmPicker && !pmPicker.contains(e.target) && e.target !== addPmBtn) pmPicker.classList.add('hidden');
        };
        document.removeEventListener('click', closePickers);
        document.addEventListener('click', closePickers);

        // Add Assignee
        drawer.querySelectorAll('.user-option').forEach(opt => {
            opt.addEventListener('click', async (e) => {
                const hasAccount = opt.dataset.hasAccount === 'true';
                // No longer restricting assignment!

                const userId = opt.dataset.uid; // Can be empty if no account
                const collabId = opt.dataset.collabId; // Added this in renderUserOption 

                // If hasAccount, we prefer assigning via User ID for compatibility, 
                // BUT strictly speaking, if we want "Collaborator First", maybe we should always assign Collab ID if available?
                // Migration supports both.
                // Let's adopt a hybrid approach:
                // If we have a user ID, assign as User for now to keep legacy logic safe (notifications etc often key off user_id).
                // If NO user ID, assign as Collaborator.

                // Wait, user requested: "colleghi l'utente dell'app al collaboratore... arrivi tutto".
                // Using Collaborator Ref is the most robust way to ensure future linking works if we link User <-> Collab later.
                // However, notifications currently look at user_id?
                // Let's assign via Collab ID if it's a "Ghost" user (no account).
                // If they have an account, assign via User ID (standard behavior).

                const targetRole = opt.dataset.targetRole || 'assignee';

                try {
                    if (!hasAccount && collabId) {
                        await assignUserToItem(itemId, collabId, targetRole, true); // true = isCollabId
                    } else if (userId) {
                        await assignUserToItem(itemId, userId, targetRole);
                    } else if (collabId) {
                        // Fallback
                        await assignUserToItem(itemId, collabId, targetRole, true);
                    } else {
                        throw new Error("ID mancante");
                    }

                    // Refresh data
                    assignees = await fetchItemAssignees(itemId);
                    render();

                    // Trigger global refresh
                    document.dispatchEvent(new CustomEvent('pm-item-changed', {
                        detail: { spaceId: spaceId, action: 'assign' }
                    }));
                } catch (err) {
                    console.error(err);
                    // Handle duplicate assignment gracefully
                    if (err.code === '23505') {
                        window.showAlert?.('Questo collaboratore è già assegnato a questa attività', 'warning') ||
                            alert('Questo collaboratore è già assegnato.');
                    } else {
                        window.showAlert?.('Errore assegnazione: ' + err.message, 'error') ||
                            alert("Errore assegnazione: " + err.message);
                    }
                }
            });
        });

        // Remove Assignee
        drawer.querySelectorAll('.remove-assignee-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const userId = btn.dataset.uid;
                const collabId = btn.dataset.collabId;

                if (!await window.showConfirm("Rimuovere assegnazione?")) return;
                try {
                    const recordId = btn.dataset.id;
                    if (!recordId) throw new Error("ID assegnazione mancante");

                    const { error } = await supabase.from('pm_item_assignees').delete().eq('id', recordId);
                    if (error) throw error;

                    // Refresh
                    assignees = await fetchItemAssignees(itemId);
                    render();

                    // Trigger global refresh
                    document.dispatchEvent(new CustomEvent('pm-item-changed', {
                        detail: { spaceId: spaceId, action: 'unassign' }
                    }));
                } catch (err) {
                    alert("Errore rimozione: " + err.message);
                }
            });
        });

        // Comments
        const addCommentBtn = drawer.querySelector('#add-comment-btn');
        const commentInput = drawer.querySelector('#new-comment');
        if (addCommentBtn) {
            addCommentBtn.addEventListener('click', async () => {
                const body = commentInput.value.trim();
                if (!body) return;
                try {
                    await addComment(itemId, body);
                    comments = await fetchItemComments(itemId);
                    render();
                } catch (err) {
                    alert("Errore commento");
                }
            });
        }
    };

    const attachEditModeListeners = () => {
        const closeBtn = drawer.querySelector('.close-drawer-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));

        drawer.querySelector('#cancel-edit-btn').addEventListener('click', () => {
            if (isEdit) {
                viewMode = true;
                render();
            } else {
                overlay.classList.add('hidden');
            }
        });

        const formPicker = drawer.querySelector('#form-assignee-picker');
        const formAddBtn = drawer.querySelector('#form-add-assignee-btn');

        if (formAddBtn && formPicker) {
            formAddBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                formPicker.classList.toggle('hidden');
            });

            // Pending Add
            formPicker.querySelectorAll('.user-option').forEach(opt => {
                opt.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const uid = opt.dataset.uid;
                    const collabId = opt.dataset.collabId;
                    const name = opt.querySelector('div > div:first-child').innerText; // Hacky but works for now or use dataset

                    // Check dupe
                    const exists = pendingAssignees.some(a => (uid && a.user_ref === uid) || (collabId && a.collaborator_ref === collabId));
                    if (exists) {
                        formPicker.classList.add('hidden');
                        return;
                    }

                    // Add to pending
                    captureFormState(); // Capture before adding and re-rendering
                    pendingAssignees.push({
                        user_ref: uid || null,
                        collaborator_ref: collabId || null,
                        role: 'assignee', // Default to assignee for this picker
                        displayName: name, // Store the display name explicitly
                        user: { first_name: name, last_name: '', avatar_url: opt.querySelector('img').src, full_name: name }
                    });

                    formPicker.classList.add('hidden');
                    // Partial re-render (Full render for simplicity)
                    render();
                });
            });

            // Pending Remove
            drawer.querySelectorAll('.remove-pending-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(btn.dataset.idx);
                    if (!isNaN(idx)) {
                        captureFormState(); // Capture before removing
                        pendingAssignees.splice(idx, 1);
                        render();
                    }
                });
            });

            document.addEventListener('click', (e) => {
                if (formPicker && !formPicker.contains(e.target) && e.target !== formAddBtn) {
                    formPicker.classList.add('hidden');
                }
            }, { once: true }); // Cleaner
        }

        const form = drawer.querySelector('#item-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const payload = Object.fromEntries(formData.entries());

            // Cleanup
            if (!payload.start_date) payload.start_date = null;
            if (!payload.due_date) payload.due_date = null;
            if (!payload.notes) payload.notes = null;

            try {
                if (isEdit) {
                    await updatePMItem(itemId, payload);
                    // Update local item reference
                    Object.assign(item, payload);
                    viewMode = true;
                    render();
                    // NO RELOAD - Dispatch Event
                    document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { spaceId } }));
                } else {
                    // DIVERGENCE CHECK (Creation Only)
                    const space = state.pm_spaces?.find(s => s.id === spaceId);
                    const defaultPM = space?.default_pm_user_ref;
                    const currentUserId = state.session.user.id;
                    let selectedPMs = [];

                    if (defaultPM && currentUserId && defaultPM !== currentUserId) {
                        // Divergence detected! Ask user.
                        const pmProfile = state.profiles?.find(p => p.id === defaultPM);
                        const pmName = pmProfile ? `${pmProfile.first_name} ${pmProfile.last_name}` : 'Default PM';

                        const choice = await new Promise(resolve => {
                            const modalId = `pm-choice-${Date.now()}`;
                            const modalHTML = `
                                <div id="${modalId}" class="modal active" style="z-index: 10001; align-items: center; justify-content: center; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);">
                                    <div class="modal-content" style="max-width: 450px; padding: 2rem; border-radius: 16px; border: 1px solid var(--surface-2); box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
                                        <div style="width: 48px; height: 48px; background: rgba(66, 133, 244, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
                                            <span class="material-icons-round" style="color: var(--brand-blue); font-size: 24px;">manage_accounts</span>
                                        </div>
                                        <h3 style="margin-bottom: 0.5rem; font-family: var(--font-titles);">Chi è il Project Manager?</h3>
                                        <p style="color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.5;">
                                            Stai creando un'attività ma non sei il PM predefinito di questa commessa (<strong>${pmName}</strong>).
                                        </p>
                                        
                                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                                            <button type="button" class="choice-btn" data-choice="me" style="text-align: left; padding: 1rem; border: 1px solid var(--surface-2); border-radius: 12px; background: white; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 1rem;">
                                                <span class="material-icons-round" style="color: var(--text-tertiary);">person</span>
                                                <div>
                                                    <div style="font-weight: 600; font-size: 0.95rem;">Sono io</div>
                                                    <div style="font-size: 0.75rem; color: var(--text-tertiary);">Assegna a me come PM</div>
                                                </div>
                                            </button>
                                            
                                            <button type="button" class="choice-btn" data-choice="default" style="text-align: left; padding: 1rem; border: 1px solid var(--surface-2); border-radius: 12px; background: white; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 1rem;">
                                                <span class="material-icons-round" style="color: var(--text-tertiary);">badge</span>
                                                <div>
                                                    <div style="font-weight: 600; font-size: 0.95rem;">È ${pmName}</div>
                                                    <div style="font-size: 0.75rem; color: var(--text-tertiary);">Assegna al PM predefinito</div>
                                                </div>
                                            </button>

                                            <button type="button" class="choice-btn" data-choice="both" style="text-align: left; padding: 1rem; border: 1px solid var(--surface-2); border-radius: 12px; background: white; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 1rem;">
                                                <span class="material-icons-round" style="color: var(--text-tertiary);">group</span>
                                                <div>
                                                    <div style="font-weight: 600; font-size: 0.95rem;">Entrambi</div>
                                                    <div style="font-size: 0.75rem; color: var(--text-tertiary);">Siamo co-gestori</div>
                                                </div>
                                            </button>

                                            <button type="button" class="choice-btn" data-choice="skip" style="text-align: left; padding: 0.75rem 1rem; border: none; background: transparent; cursor: pointer; display: flex; justify-content: center; margin-top: 0.5rem; color: var(--text-tertiary); font-size: 0.9rem;">
                                                Deciderò dopo
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `;
                            document.body.insertAdjacentHTML('beforeend', modalHTML);

                            const modal = document.getElementById(modalId);
                            modal.querySelectorAll('.choice-btn').forEach(btn => {
                                btn.addEventListener('mouseover', () => btn.style.background = 'var(--surface-1)');
                                btn.addEventListener('mouseout', () => btn.style.background = 'white');
                                if (btn.dataset.choice === 'skip') {
                                    btn.addEventListener('mouseover', () => btn.style.color = 'var(--text-primary)');
                                    btn.addEventListener('mouseout', () => btn.style.background = 'transparent');
                                }

                                btn.addEventListener('click', (ev) => {
                                    ev.preventDefault();
                                    ev.stopPropagation();
                                    resolve(btn.dataset.choice);
                                    modal.remove();
                                });
                            });
                        });

                        if (choice === 'me') selectedPMs.push(currentUserId);
                        else if (choice === 'default') selectedPMs.push(defaultPM);
                        else if (choice === 'both') selectedPMs.push(currentUserId, defaultPM);
                    } else if (defaultPM) {
                        if (defaultPM === currentUserId) selectedPMs.push(currentUserId);
                    }

                    // For Creation, we also need to respect the PMs already in pendingAssignees (if any)
                    // The "default" logic above handles the 'divergence' check if creating a generic item.
                    // But if we pre-filled pendingAssignees with the default PM, we should use that unless user removed it.

                    const newItem = await createPMItem(payload);

                    // Assign PMs (from divergence check)
                    if (selectedPMs.length > 0) {
                        const uniquePMs = [...new Set(selectedPMs)];
                        for (const pmId of uniquePMs) {
                            await assignUserToItem(newItem.id, pmId, 'pm');
                        }
                    }

                    // Assign Pending Assignees (Standard)
                    if (pendingAssignees.length > 0) {
                        for (const pa of pendingAssignees) {
                            // Skip PMs if we already handled them via logic above, OR assume pending list is source of truth?
                            // User request: "il project manager è di default il project manager della commessa".
                            // We added it to pending list. So we should persist it.
                            // But let's avoid duplicates with 'selectedPMs' logic.
                            // Simplified: If it's in pendingAssignees, save it.

                            // However, creation logic usually separates 'PM' from 'Assignee'. 
                            // Let's save all.
                            try {
                                // Check if already assigned (e.g. by logic above)
                                const already = await fetchItemAssignees(newItem.id);
                                const isThere = already.some(x => (pa.user_ref && x.user_ref === pa.user_ref) || (pa.collaborator_ref && x.collaborator_ref === pa.collaborator_ref));

                                if (!isThere) {
                                    const r = pa.role || 'assignee';
                                    if (pa.user_ref) await assignUserToItem(newItem.id, pa.user_ref, r);
                                    else if (pa.collaborator_ref) await assignUserToItem(newItem.id, pa.collaborator_ref, r, true);
                                }
                            } catch (e) { console.error("Assignment error", e); }
                        }
                    }

                    overlay.classList.add('hidden');
                    // NO RELOAD - Dispatch Event
                    document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { spaceId } }));
                }
            } catch (err) {
                console.error("Save error:", err);
                alert("Errore salvataggio: " + err.message);
            }
        });
    };

    // Initial Render
    overlay.classList.remove('hidden');
    render();
}
