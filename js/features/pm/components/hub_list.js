// Hub List Tab - Table view with sorting and filtering

const ITEM_STATUS = {
    'todo': { label: 'Da Fare', color: '#94a3b8', bg: '#f1f5f9' },
    'in_progress': { label: 'In Corso', color: '#3b82f6', bg: '#eff6ff' },
    'blocked': { label: 'Bloccato', color: '#ef4444', bg: '#fef2f2' },
    'review': { label: 'Revisione', color: '#f59e0b', bg: '#fffbeb' },
    'done': { label: 'Completato', color: '#10b981', bg: '#ecfdf5' }
};

const PRIORITY_CONFIG = {
    'low': { label: 'Bassa', color: '#94a3b8' },
    'medium': { label: 'Media', color: '#f59e0b' },
    'high': { label: 'Alta', color: '#ef4444' },
    'urgent': { label: 'Urgente', color: '#dc2626' }
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
                        <option value="milestone">Milestone</option>
                    </select>
                </div>
                
                <!-- Count -->
                <span class="text-secondary" style="font-size: 0.9rem;">${items.length} elementi</span>
            </div>
            
            <!-- Table -->
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; min-width: 800px;">
                    <thead>
                        <tr style="background: var(--surface-1);">
                            <th class="sortable" data-sort="title" style="text-align: left; padding: 0.75rem 1rem; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); cursor: pointer;">
                                Titolo <span class="material-icons-round sort-icon" style="font-size: 1rem; vertical-align: middle;">unfold_more</span>
                            </th>
                            <th style="text-align: left; padding: 0.75rem 1rem; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary);">Tipo</th>
                            <th style="text-align: left; padding: 0.75rem 1rem; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary);">Stato</th>
                            <th style="text-align: left; padding: 0.75rem 1rem; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary);">Priorità</th>
                            <th class="sortable" data-sort="due_date" style="text-align: left; padding: 0.75rem 1rem; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); cursor: pointer;">
                                Scadenza <span class="material-icons-round sort-icon" style="font-size: 1rem; vertical-align: middle;">unfold_more</span>
                            </th>
                            <th style="width: 50px;"></th>
                        </tr>
                    </thead>
                    <tbody id="list-tbody">
                        ${sortedItems.length === 0 ? `
                            <tr>
                                <td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                                    Nessun elemento trovato
                                </td>
                            </tr>
                        ` : sortedItems.map(item => renderListRow(item)).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Event handlers
    setupListEventHandlers(container, items, spaceId);
}

function renderListRow(item) {
    const statusInfo = ITEM_STATUS[item.status] || ITEM_STATUS['todo'];
    const priorityInfo = PRIORITY_CONFIG[item.priority] || { label: '-', color: 'var(--text-secondary)' };
    const isOverdue = item.due_date && item.status !== 'done' && new Date(item.due_date) < new Date();
    const isDone = item.status === 'done';

    const typeIcon = item.item_type === 'attivita' ? 'folder' : item.item_type === 'milestone' ? 'flag' : 'check_circle_outline';
    const typeColor = item.item_type === 'attivita' ? '#f59e0b' : item.item_type === 'milestone' ? 'var(--brand-color)' : 'var(--text-secondary)';

    return `
        <tr class="list-row" data-id="${item.id}" style="border-bottom: 1px solid var(--surface-2); cursor: pointer; transition: background 0.15s; ${isDone ? 'opacity: 0.6;' : ''}">
            <td style="padding: 0.75rem 1rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <span class="material-icons-round" style="font-size: 1.1rem; color: ${typeColor};">${typeIcon}</span>
                    <span style="font-weight: 500; ${isDone ? 'text-decoration: line-through;' : ''}">${item.title}</span>
                </div>
            </td>
            <td style="padding: 0.75rem 1rem;">
                <span style="font-size: 0.85rem; color: var(--text-secondary);">${item.item_type === 'attivita' ? 'Attività' : item.item_type === 'milestone' ? 'Milestone' : 'Task'}</span>
            </td>
            <td style="padding: 0.75rem 1rem;">
                <span style="
                    display: inline-block;
                    padding: 3px 10px;
                    border-radius: 10px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    background: ${statusInfo.bg};
                    color: ${statusInfo.color};
                ">${statusInfo.label}</span>
            </td>
            <td style="padding: 0.75rem 1rem;">
                <span style="font-size: 0.85rem; color: ${priorityInfo.color}; font-weight: 500;">${priorityInfo.label}</span>
            </td>
            <td style="padding: 0.75rem 1rem;">
                ${item.due_date ? `
                    <span style="
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        font-size: 0.85rem;
                        color: ${isOverdue ? '#ef4444' : 'var(--text-secondary)'};
                        ${isOverdue ? 'font-weight: 600;' : ''}
                    ">
                        ${isOverdue ? '<span class="material-icons-round" style="font-size: 0.9rem;">warning</span>' : ''}
                        ${new Date(item.due_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                    </span>
                ` : '<span style="color: var(--text-tertiary);">-</span>'}
            </td>
            <td style="padding: 0.75rem 1rem; text-align: center;">
                <button class="icon-btn row-menu-btn" style="padding: 4px;">
                    <span class="material-icons-round" style="font-size: 1rem;">more_vert</span>
                </button>
            </td>
        </tr>
    `;
}

function setupListEventHandlers(container, items, spaceId) {
    // Click row to open drawer
    container.querySelectorAll('.list-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('.row-menu-btn')) return;
            const itemId = row.dataset.id;
            import('./hub_drawer.js?v=155').then(mod => {
                mod.openHubDrawer(itemId, spaceId);
            });
        });

        row.addEventListener('mouseenter', () => {
            row.style.background = 'var(--surface-1)';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = '';
        });
    });

    // Search
    const searchInput = container.querySelector('#list-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            container.querySelectorAll('.list-row').forEach(row => {
                const title = row.querySelector('td span[style*="font-weight"]')?.textContent?.toLowerCase() || '';
                row.style.display = title.includes(term) ? '' : 'none';
            });
        });
    }

    // Filter by status
    const statusFilter = container.querySelector('#filter-status');
    const typeFilter = container.querySelector('#filter-type');

    const applyFilters = () => {
        const statusVal = statusFilter?.value || '';
        const typeVal = typeFilter?.value || '';

        container.querySelectorAll('.list-row').forEach(row => {
            const item = items.find(i => i.id === row.dataset.id);
            if (!item) return;

            const matchStatus = !statusVal || item.status === statusVal;
            const matchType = !typeVal || item.item_type === typeVal;

            row.style.display = (matchStatus && matchType) ? '' : 'none';
        });
    };

    statusFilter?.addEventListener('change', applyFilters);
    typeFilter?.addEventListener('change', applyFilters);
}
