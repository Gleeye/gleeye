// Hub List Tab - Table view with sorting and filtering

const ITEM_STATUS = {
    'todo': { label: 'Da Fare', color: '#94a3b8', bg: '#f1f5f9' },
    'in_progress': { label: 'In Corso', color: '#3b82f6', bg: '#eff6ff' },
    'blocked': { label: 'Bloccato', color: '#ef4444', bg: '#fef2f2' },
    'review': { label: 'Revisione', color: '#f59e0b', bg: '#fffbeb' },
    'done': { label: 'Completata', color: '#10b981', bg: '#ecfdf5' }
};

const ITEM_PRIORITY = {
    'low': { label: 'Bassa', color: '#10b981', bg: '#ecfdf5' },
    'medium': { label: 'Media', color: '#f59e0b', bg: '#fffbeb' },
    'high': { label: 'Alta', color: '#ef4444', bg: '#fef2f2' },
    'urgent': { label: 'Urgente', color: '#7c3aed', bg: '#f5f3ff' }
};

export function renderHubList(container, items, space, spaceId) {
    // Sort by due date by default
    const sortedItems = [...items].sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date) - new Date(b.due_date);
    });

    container.innerHTML = `
        <div class="hub-list-view" style="background: white; border-radius: 12px; overflow: hidden;">
            
            <!-- Toolbar -->
            <div class="list-toolbar" style="
                padding: 1rem 1.5rem;
                border-bottom: 1px solid var(--surface-2);
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 1rem;
            ">
                <!-- Search -->
                <div style="position: relative; flex: 1; max-width: 300px;">
                    <span class="material-icons-round" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-secondary); font-size: 1.1rem;">search</span>
                    <input type="text" id="list-search" placeholder="Cerca..." style="
                        width: 100%;
                        padding: 0.6rem 1rem 0.6rem 2.5rem;
                        border: 1px solid var(--surface-2);
                        border-radius: 8px;
                        font-size: 0.9rem;
                    ">
                </div>
                
                <!-- Filters -->
                <div style="display: flex; gap: 0.5rem;">
                    <select id="filter-status" class="filter-select" style="padding: 0.5rem; border-radius: 6px; border: 1px solid var(--surface-2);">
                        <option value="">Tutti gli stati</option>
                        <option value="todo">Da Fare</option>
                        <option value="in_progress">In Corso</option>
                        <option value="blocked">Bloccato</option>
                        <option value="review">Revisione</option>
                        <option value="done">Completato</option>
                    </select>
                    
                    <select id="filter-type" class="filter-select" style="padding: 0.5rem; border-radius: 6px; border: 1px solid var(--surface-2);">
                        <option value="">Tutti i tipi</option>
                        <option value="attivita">Attività</option>
                        <option value="task">Task</option>
                    </select>
                </div>
                
                <!-- Count -->
                <span class="text-secondary" style="font-size: 0.9rem;">${items.length} elementi</span>
            </div>
            
            <!-- Table Container -->
            <div style="overflow-x: auto;">
                <div style="min-width: 900px;">
                    <!-- Table Header -->
                    <div style="display: flex; align-items: center; padding: 0.75rem 1.5rem; border-bottom: 2px solid var(--surface-2); font-size: 0.75rem; color: var(--text-tertiary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: var(--surface-1);">
                        <div style="flex: 2; min-width: 0;">Titolo</div>
                        <div style="width: 120px; text-align: center;">Persone</div>
                        <div style="width: 100px; text-align: center;">Priorità</div>
                        <div style="width: 100px; text-align: center;">Scadenza</div>
                        <div style="width: 100px; text-align: center;">Stato</div>
                        <div style="width: 50px;"></div>
                    </div>
                    
                    <!-- Table Body -->
                    <div id="list-content" style="padding: 0.5rem 0;">
                        ${sortedItems.length === 0 ? `
                            <div style="text-align: center; padding: 4rem; color: var(--text-tertiary);">
                                Nessun elemento trovato
                            </div>
                        ` : sortedItems.map(item => renderListRow(item)).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Event handlers
    setupListEventHandlers(container, items, spaceId);
}

function renderListRow(item) {
    const statusInfo = ITEM_STATUS[item.status] || ITEM_STATUS['todo'];
    const priorityInfo = ITEM_PRIORITY[item.priority] || ITEM_PRIORITY['medium'];
    const isOverdue = item.due_date && item.status !== 'done' && new Date(item.due_date) < new Date();
    const isDone = item.status === 'done';

    // Assignees
    const assignees = item.pm_item_assignees || [];
    const avatars = assignees.slice(0, 3).map((a, idx) => {
        const userName = a.user?.full_name || 'U';
        const avatarUrl = a.user?.avatar_url;
        return `
            <div title="${userName}" style="
                width: 24px; height: 24px; border-radius: 50%; background: var(--surface-3); 
                border: 2px solid white; margin-left: ${idx === 0 ? '0' : '-8px'}; 
                display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--text-secondary);
                overflow: hidden; z-index: ${5 - idx};
            ">
                ${avatarUrl ? `<img src="${avatarUrl}" style="width:100%; height:100%; object-fit:cover;">` : userName.charAt(0)}
            </div>
        `;
    }).join('');
    const extraAssignees = assignees.length > 3 ? `<div style="font-size: 0.7rem; color: var(--text-tertiary); margin-left: 4px;">+${assignees.length - 3}</div>` : '';

    return `
        <div class="list-row" data-id="${item.id}" style="
            display: flex; align-items: center; padding: 0.75rem 1.5rem; border-bottom: 1px solid var(--surface-1); 
            cursor: pointer; transition: all 0.2s;
        " onmouseover="this.style.background='var(--surface-1)'" onmouseout="this.style.background='white'">
            
            <!-- Title -->
            <div style="flex: 2; min-width: 0; display: flex; align-items: center; gap: 10px; ${isDone ? 'opacity: 0.5;' : ''}">
                <span class="material-icons-round" style="font-size: 1.1rem; color: ${item.item_type === 'attivita' ? '#f59e0b' : 'var(--text-secondary)'}; flex-shrink: 0;">
                    ${item.item_type === 'attivita' ? 'folder' : 'check_circle_outline'}
                </span>
                <span style="font-weight: 600; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ${isDone ? 'text-decoration: line-through;' : ''}">${item.title}</span>
            </div>

            <!-- People -->
            <div style="width: 120px; display: flex; align-items: center; justify-content: center;">
                <div style="display: flex; align-items: center;">
                    ${avatars}
                    ${extraAssignees}
                </div>
                ${assignees.length === 0 ? '<span style="font-size: 0.7rem; color: var(--text-tertiary); opacity: 0.5;">---</span>' : ''}
            </div>

            <!-- Priority -->
            <div style="width: 100px; display: flex; align-items: center; justify-content: center;">
                <span style="
                    font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: 6px; 
                    background: ${priorityInfo.bg}; color: ${priorityInfo.color};
                    text-transform: uppercase; letter-spacing: 0.02em;
                ">${priorityInfo.label}</span>
            </div>

            <!-- Due Date -->
            <div style="width: 100px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; color: ${isOverdue ? '#ef4444' : 'var(--text-secondary)'}; font-weight: 600;">
                ${item.due_date ? `
                    <span class="material-icons-round" style="font-size: 0.9rem; margin-right: 4px;">${isOverdue ? 'warning' : 'event'}</span>
                    ${new Date(item.due_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                ` : '<span style="color: var(--text-tertiary); opacity: 0.3;">---</span>'}
            </div>

            <!-- Status -->
            <div style="width: 100px; display: flex; align-items: center; justify-content: center;">
                <span style="
                    font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 10px;
                    background: ${statusInfo.bg}; color: ${statusInfo.color};
                    text-transform: uppercase;
                ">${statusInfo.label}</span>
            </div>

            <!-- Actions -->
            <div style="width: 50px; display: flex; align-items: center; justify-content: center;">
                <button class="icon-btn row-menu-btn" style="padding: 4px;">
                    <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary);">more_vert</span>
                </button>
            </div>
        </div>
    `;
}

function setupListEventHandlers(container, items, spaceId) {
    // Click row to open drawer
    container.querySelectorAll('.list-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('.row-menu-btn')) return;
            const itemId = row.dataset.id;
            import('./hub_drawer.js?v=157').then(mod => {
                mod.openHubDrawer(itemId, spaceId);
            });
        });
    });

    // Filtering logic remains the same but targets .list-row
    const searchInput = container.querySelector('#list-search');
    const statusFilter = container.querySelector('#filter-status');
    const typeFilter = container.querySelector('#filter-type');

    const applyFilters = () => {
        const term = searchInput?.value.toLowerCase() || '';
        const statusVal = statusFilter?.value || '';
        const typeVal = typeFilter?.value || '';

        container.querySelectorAll('.list-row').forEach(row => {
            const item = items.find(i => i.id === row.dataset.id);
            if (!item) return;

            const matchSearch = item.title.toLowerCase().includes(term);
            const matchStatus = !statusVal || item.status === statusVal;
            const matchType = !typeVal || item.item_type === typeVal;

            row.style.display = (matchSearch && matchStatus && matchType) ? 'flex' : 'none';
        });
    };

    [searchInput, statusFilter, typeFilter].forEach(el => el?.addEventListener('input', applyFilters));
    [statusFilter, typeFilter].forEach(el => el?.addEventListener('change', applyFilters));
}
