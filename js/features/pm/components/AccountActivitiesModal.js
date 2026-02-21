import { supabase } from '../../../modules/config.js';
import { state } from '../../../modules/state.js';
import { fetchProjectItems, fetchAppointments, fetchAppointmentTypes, createPMItem, assignUserToItem } from '../../../modules/pm_api.js';

export async function openAccountActivitiesModal(orderId, spaceId) {
    const modal = document.createElement('div');
    modal.className = 'custom-modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    modal.innerHTML = `
        <div class="custom-modal-container" style="max-width: 1000px; width: 90vw; height: 85vh; background: var(--bg-primary); border: 1px solid var(--glass-border); border-radius: 20px; box-shadow: var(--shadow-2xl); padding: 0; display: flex; flex-direction: column; overflow: hidden; position: relative;">
            <style>
                .modal-tab-btn {
                    padding: 1rem 1.5rem;
                    border: none;
                    background: none;
                    cursor: pointer;
                    font-weight: 500;
                    color: var(--text-secondary);
                    border-bottom: 2px solid transparent;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    transition: all 0.2s;
                }
                .modal-tab-btn:hover {
                    background: var(--surface-1);
                }
                .modal-tab-btn.active {
                    color: var(--brand-blue);
                    border-bottom-color: var(--brand-blue);
                    font-weight: 600;
                }
                .loading-spinner {
                    width: 30px;
                    height: 30px;
                    border: 3px solid rgba(0,0,0,0.1);
                    border-top-color: var(--brand-blue);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .activity-card {
                    background: white;
                    border: 1px solid var(--glass-border);
                    border-radius: 12px;
                    padding: 1rem;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    transition: all 0.2s;
                }
                .activity-card:hover {
                    border-color: var(--brand-blue);
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-md);
                }
            </style>
            
            <div style="padding: 1.5rem; background: white; border-bottom: 1px solid var(--surface-2); display: flex; justify-content: space-between; align-items: center; z-index: 10;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(59, 130, 246, 0.1); color: var(--brand-blue); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.15);">
                        <span class="material-icons-round" style="font-size: 24px;">assignment</span>
                    </div>
                    <div>
                        <h2 style="font-size: 1.35rem; font-weight: 800; margin: 0; color: var(--text-primary); font-family: var(--font-titles); letter-spacing: -0.02em;">Attività e Task</h2>
                        <div style="font-size: 0.8rem; color: var(--text-tertiary); font-weight: 500;">Gestione operativa e strategica</div>
                    </div>
                </div>
                <button onclick="this.closest('.custom-modal-overlay').remove()" style="background: var(--surface-1); border:none; cursor:pointer; color:var(--text-tertiary); display:flex; align-items:center; padding: 10px; border-radius: 50%; transition: all 0.2s;" onmouseover="this.style.background='var(--surface-2)'; this.style.color='var(--text-primary)'" onmouseout="this.style.background='var(--surface-1)'; this.style.color='var(--text-tertiary)'">
                    <span class="material-icons-round" style="font-size: 20px;">close</span>
                </button>
            </div>
            
            <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #f8fafc;">
                <!-- Tabs -->
                <div style="display: flex; background: white; border-bottom: 1px solid var(--surface-2); padding: 0 1.5rem;">
                    <button class="modal-tab-btn active structure" data-tab="struttura">
                        <span class="material-icons-round" style="font-size: 1.1rem;">account_tree</span> Struttura
                    </button>
                    <button class="modal-tab-btn items" data-tab="attivita">
                        <span class="material-icons-round" style="font-size: 1.1rem;">folder</span> Attività Account
                    </button>
                    <button class="modal-tab-btn tasks" data-tab="task">
                        <span class="material-icons-round" style="font-size: 1.1rem;">check_circle_outline</span> Task Account
                    </button>
                    <button class="modal-tab-btn appointments" data-tab="appointments">
                        <span class="material-icons-round" style="font-size: 1.1rem;">event</span> Appuntamenti
                    </button>
                </div>

                <!-- Content Area -->
                <div id="account-modal-content" style="flex: 1; overflow-y: auto; padding: 1.5rem;">
                    <div style="display: flex; justify-content: center; padding: 3rem;"><div class="loading-spinner"></div></div>
                </div>
            </div>

            <!-- Footer / Actions -->
            <div style="padding: 1.25rem 1.5rem; background: white; border-top: 1px solid var(--surface-2); display: flex; justify-content: flex-end; gap: 1rem; z-index: 10;">
                <button id="add-account-activity-btn" style="background: var(--brand-blue); color: white; border: none; padding: 12px 28px; border-radius: 12px; font-weight: 700; display: flex; align-items: center; gap: 0.75rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);">
                    <span class="material-icons-round">add</span>
                    Nuova Attività Account
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Tab Logic
    const contentArea = modal.querySelector('#account-modal-content');
    const tabs = modal.querySelectorAll('.modal-tab-btn');
    const addBtn = modal.querySelector('#add-account-activity-btn');
    // Set Hub Context for Drawer
    const items = await fetchProjectItems(spaceId);
    window._hubContext = { items, spaceId };

    let currentTab = 'struttura';

    const refreshContent = async () => {
        contentArea.innerHTML = '<div style="display: flex; justify-content: center; padding: 3rem;"><div class="loading-spinner"></div></div>';
        const freshItems = await fetchProjectItems(spaceId);
        window._hubContext.items = freshItems;

        if (currentTab === 'struttura') {
            await renderStructure(contentArea, spaceId, freshItems);
            addBtn.innerHTML = '<span class="material-icons-round">add</span> Nuova Attività Account'; // Default for structure, can be changed
            addBtn.style.background = 'var(--brand-blue)'; // Default for structure
            addBtn.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.25)'; // Default for structure
            const spinner = modal.querySelector('.loading-spinner');
            if (spinner) spinner.style.borderTopColor = 'var(--brand-blue)'; // Default for structure

        } else if (currentTab === 'attivita' || currentTab === 'task') {
            await renderItems(contentArea, spaceId, currentTab, freshItems);
            addBtn.innerHTML = `<span class="material-icons-round">add</span> Nuovo ${currentTab === 'attivita' ? 'Attività' : 'Task'} Account`;
            addBtn.style.background = 'var(--brand-blue)';
            addBtn.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.25)';

            const spinner = modal.querySelector('.loading-spinner');
            if (spinner) spinner.style.borderTopColor = 'var(--brand-blue)';

        } else if (currentTab === 'appointments') {
            await renderAppointments(contentArea, orderId, spaceId);
            addBtn.innerHTML = '<span class="material-icons-round">add_event</span> Nuovo Appuntamento';
            addBtn.style.background = 'var(--brand-blue)';
            addBtn.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.25)';
            const spinner = modal.querySelector('.loading-spinner');
            if (spinner) spinner.style.borderTopColor = 'var(--brand-blue)';
        }
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            refreshContent();
        });
    });

    addBtn.addEventListener('click', async () => {
        if (currentTab === 'attivita' || currentTab === 'task') {
            const { openHubDrawer } = await import('/js/features/pm/components/hub_drawer.js?v=1000');
            openHubDrawer(null, spaceId, null, currentTab, {
                defaultRole: 'account',
                defaultNote: '[ACCOUNT]',
                is_account_level: true
            });
        } else {
            const { openAppointmentDrawer } = await import('/js/features/pm/components/hub_appointment_drawer.js?v=1000');
            openAppointmentDrawer(null, orderId || spaceId, orderId ? 'order' : 'space', {
                defaultRole: 'account',
                defaultNote: '[ACCOUNT]',
                is_account_level: true
            });
        }
    });

    // Listen for changes
    const onApptChange = (e) => {
        if (e.detail?.orderId === orderId || e.detail?.spaceId === spaceId) {
            refreshContent();
        }
    };
    const onPmItemChange = (e) => {
        if (e.detail?.spaceId === spaceId) {
            refreshContent();
        }
    };

    document.addEventListener('appointment-changed', onApptChange);
    document.addEventListener('pm-item-changed', onPmItemChange);

    // Cleanup listener when modal removed
    const observer = new MutationObserver((mutations) => {
        if (!document.contains(modal)) {
            document.removeEventListener('appointment-changed', onApptChange);
            document.removeEventListener('pm-item-changed', onPmItemChange);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true });

    await refreshContent();
}

async function renderStructure(container, spaceId, items) {
    try {
        const tree = buildTree(items);

        // Filter tree for Account: a branch is kept if it or any descendant is [ACCOUNT]
        const filterAccount = (nodes) => {
            return nodes.map(node => {
                const children = filterAccount(node.children || []);
                const isAccount = node.is_account_level || node.pm_item_assignees?.some(a => a.role === 'account') || node.notes?.toLowerCase().includes('[account]');
                const hasAccountChild = children.some(c => c._isAccountBranch);
                return { ...node, children, _isAccountBranch: isAccount || hasAccountChild };
            }).filter(node => node._isAccountBranch);
        };

        const accountTree = filterAccount(tree);

        if (accountTree.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 5rem 2rem; color: var(--text-tertiary);">
                    <div style="width: 80px; height: 80px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                        <span class="material-icons-round" style="font-size: 2.5rem; color: #94a3b8;">account_tree</span>
                    </div>
                    <h3 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.5rem;">Nessuna struttura account</h3>
                    <p style="font-size: 0.9rem; max-width: 300px; margin: 0 auto;">Crea attività e sotto-task per organizzare il lavoro dell'account.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="account-structure-view">
                <style>
                    .tree-row { display: flex; align-items: center; padding: 0.6rem 0.75rem; border-radius: 8px; cursor: pointer; transition: background 0.2s; }
                    .tree-row:hover { background: rgba(0,0,0,0.03); }
                    .tree-children { margin-left: 1.5rem; border-left: 1px dashed var(--surface-2); padding-left: 0.5rem; }
                    .status-pill { padding: 2px 8px; border-radius: 10px; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; }
                </style>
                <div style="display: flex; align-items: center; padding: 0.5rem 1rem; border-bottom: 1px solid var(--surface-2); font-size: 0.7rem; color: var(--text-tertiary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
                    <div style="width: 24px;"></div>
                    <div style="flex: 1;">Titolo</div>
                    <div style="width: 80px; text-align: center;">Scadenza</div>
                    <div style="width: 80px; text-align: center;">Stato</div>
                </div>
                ${renderTreeNodes(accountTree, spaceId)}
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div style="background: #fef2f2; border: 1px solid #fee2e2; color: #b91c1c; padding: 1rem; border-radius: 12px;">Errore: ${err.message}</div>`;
    }
}

function buildTree(items) {
    const map = new Map();
    const roots = [];
    items.forEach(item => map.set(item.id, { ...item, children: [] }));
    items.forEach(item => {
        const node = map.get(item.id);
        if (item.parent_ref && map.has(item.parent_ref)) {
            map.get(item.parent_ref).children.push(node);
        } else {
            roots.push(node);
        }
    });
    return roots;
}

function renderTreeNodes(nodes, spaceId) {
    const ITEM_STATUS = {
        'todo': { label: 'TODO', color: '#64748b', bg: '#f1f5f9' },
        'in_progress': { label: 'WAIT', color: '#3b82f6', bg: '#eff6ff' },
        'blocked': { label: 'STOP', color: '#ef4444', bg: '#fef2f2' },
        'review': { label: 'EYE', color: '#f59e0b', bg: '#fffbeb' },
        'done': { label: 'OK', color: '#10b981', bg: '#ecfdf5' }
    };

    return nodes.map(node => {
        const hasChildren = node.children && node.children.length > 0;
        const status = ITEM_STATUS[node.status] || ITEM_STATUS['todo'];
        const isDone = node.status === 'done';

        return `
            <div class="tree-node">
                <div class="tree-row" onclick="import('/js/features/pm/components/hub_drawer.js?v=1000').then(mod => mod.openHubDrawer('${node.id}', '${spaceId}'))">
                    <div style="width: 24px; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary);">
                        <span class="material-icons-round" style="font-size: 18px;">
                            ${node.item_type === 'attivita' ? 'folder' : 'description'}
                        </span>
                    </div>
                    <div style="flex: 1; font-weight: ${node.item_type === 'attivita' ? '600' : '400'}; font-size: 0.9rem; color: var(--text-primary); text-decoration: ${isDone ? 'line-through' : 'none'}; opacity: ${isDone ? '0.6' : '1'};">
                        ${node.title}
                    </div>
                    <div style="width: 80px; text-align: center; font-size: 0.75rem; color: var(--text-tertiary);">
                        ${node.due_date ? new Date(node.due_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : '-'}
                    </div>
                    <div style="width: 80px; text-align: center;">
                        <span class="status-pill" style="background: ${status.bg}; color: ${status.color};">
                            ${status.label}
                        </span>
                    </div>
                </div>
                ${hasChildren ? `
                    <div class="tree-children">
                        ${renderTreeNodes(node.children, spaceId)}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

async function renderItems(container, spaceId, filterType, items = null) {
    try {
        if (!items) items = await fetchProjectItems(spaceId);
        const accountItems = items.filter(item => {
            const isRightType = item.item_type === filterType;
            const isAccount = item.is_account_level || item.pm_item_assignees?.some(a => a.role === 'account') || item.notes?.toLowerCase().includes('[account]');
            return isRightType && isAccount;
        });

        if (accountItems.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 5rem 2rem; color: var(--text-tertiary);">
                    <div style="width: 80px; height: 80px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                        <span class="material-icons-round" style="font-size: 2.5rem; color: #94a3b8;">${filterType === 'attivita' ? 'folder' : 'check_circle_outline'}</span>
                    </div>
                    <h3 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.5rem;">Nessun ${filterType === 'attivita' ? 'attività' : 'task'} account</h3>
                    <p style="font-size: 0.9rem; max-width: 300px; margin: 0 auto;">Inizia a tracciare le attività strategiche per questa commessa.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${accountItems.map(item => {
            const isDone = item.status === 'done';
            return `
                        <div class="activity-card" style="opacity: ${isDone ? '0.7' : '1'}; cursor: pointer;" onclick="import('/js/features/pm/components/hub_drawer.js?v=1000').then(mod => mod.openHubDrawer('${item.id}', '${spaceId}'))">
                            <div style="flex-shrink: 0; color: ${isDone ? '#10b981' : 'var(--brand-blue)'};">
                                <span class="material-icons-round" style="font-size: 24px;">
                                    ${isDone ? 'check_circle' : (filterType === 'attivita' ? 'folder' : 'circle_outline')}
                                </span>
                            </div>
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 1rem; color: var(--text-primary); text-decoration: ${isDone ? 'line-through' : 'none'};">${item.title}</div>
                                <div style="display: flex; gap: 1rem; margin-top: 0.3rem;">
                                    ${item.due_date ? `
                                        <div style="font-size: 0.75rem; color: ${new Date(item.due_date) < new Date() && !isDone ? '#ef4444' : 'var(--text-tertiary)'}; display: flex; align-items: center; gap: 4px;">
                                            <span class="material-icons-round" style="font-size: 14px;">event</span>
                                            ${new Date(item.due_date).toLocaleDateString()}
                                        </div>
                                    ` : ''}
                                    <div style="font-size: 0.75rem; color: var(--text-tertiary); display: flex; align-items: center; gap: 4px;">
                                        <span class="material-icons-round" style="font-size: 14px;">label</span>
                                        ${filterType === 'attivita' ? 'Account Activity' : 'Account Task'}
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; -webkit-mask-image: linear-gradient(to left, black 80%, transparent); padding-left: 20px;">
                                ${item.pm_item_assignees?.map((a, i) => `
                                    <div title="${a.user?.full_name}" style="width: 28px; height: 28px; border-radius: 50%; background: var(--brand-blue); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; border: 2px solid white; margin-left: -8px; z-index: ${10 - i};">
                                        ${(a.user?.full_name || 'U').charAt(0)}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;

    } catch (err) {
        container.innerHTML = `<div style="background: #fef2f2; border: 1px solid #fee2e2; color: #b91c1c; padding: 1rem; border-radius: 12px;">Errore: ${err.message}</div>`;
    }
}

async function renderAppointments(container, orderId, spaceId) {
    try {
        const appointments = await fetchAppointments(orderId || spaceId, orderId ? 'order' : 'space');
        const accountAppts = appointments.filter(appt =>
            appt.is_account_level || appt.appointment_internal_participants?.some(p => p.role === 'account') || appt.note?.toLowerCase().includes('[account]')
        );

        if (accountAppts.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 5rem 2rem; color: var(--text-tertiary);">
                    <div style="width: 80px; height: 80px; background: #dbeafe; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                        <span class="material-icons-round" style="font-size: 2.5rem; color: #3b82f6;">calendar_today</span>
                    </div>
                    <h3 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.5rem;">Nessun appuntamento account</h3>
                    <p style="font-size: 0.9rem; max-width: 300px; margin: 0 auto;">Pianifica riunioni, call strategiche o shooting collegati a questa commessa.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${accountAppts.map(appt => {
            const start = new Date(appt.start_time);
            return `
                                                <div class="activity-card" style="border-left: 4px solid #3b82f6; cursor: pointer;" onclick="import('/js/features/pm/components/hub_appointment_drawer.js?v=1000').then(mod => mod.openAppointmentDrawer({id: '${appt.id}'}, '${orderId}', 'order'))">
                            <div style="width: 48px; border-right: 1px solid var(--glass-border); display: flex; flex-direction: column; align-items: center; justify-content: center; margin-right: 0.5rem;">
                                <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">${start.toLocaleDateString('it-IT', { weekday: 'short' })}</div>
                                <div style="font-size: 1.25rem; font-weight: 800; color: #3b82f6; line-height: 1;">${start.getDate()}</div>
                            </div>
                            <div style="flex: 1;">
                                <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-primary);">${appt.title}</div>
                                <div style="display: flex; align-items: center; gap: 10px; margin-top: 0.3rem;">
                                    <div style="font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;">
                                        <span class="material-icons-round" style="font-size: 16px;">schedule</span>
                                        ${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}
                                    </div>
                                    <div class="badge-mini" style="background: ${appt.mode === 'remoto' ? '#eff6ff' : '#f0fdf4'}; color: ${appt.mode === 'remoto' ? '#3b82f6' : '#10b981'}; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase;">
                                        ${appt.mode}
                                    </div>
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 0.7rem; font-weight: 700; color: ${appt.status === 'confermato' ? '#10b981' : '#f59e0b'}; text-transform: uppercase; margin-bottom: 4px;">
                                    ${appt.status}
                                </div>
                                <div style="display: flex; justify-content: flex-end; -webkit-mask-image: linear-gradient(to left, black 80%, transparent);">
                                     ${appt.appointment_internal_participants?.map((p, i) => `
                                        <div title="${p.collaborator_id}" style="width: 24px; height: 24px; border-radius: 50%; background: #94a3b8; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; border: 2px solid white; margin-left: -6px;">
                                            ${(p.collaborator_id).charAt(0)}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div style="background: #fef2f2; border: 1px solid #fee2e2; color: #b91c1c; padding: 1rem; border-radius: 12px;">Errore: ${err.message}</div>`;
    }
}

// Global helper for toggling status (quick implementation)
window._toggleTaskStatus = async (itemId, newStatus) => {
    const { supabase } = await import('../../../modules/config.js');
    await supabase.from('pm_items').update({ status: newStatus }).eq('id', itemId);
};
