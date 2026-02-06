// Hub Tree Tab - Hierarchical Activity View with filters

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

export function renderHubTree(container, items, space, spaceId) {
    // Build tree from flat items
    const tree = buildTree(items);

    container.innerHTML = `
        <div class="hub-tree-view" style="background: white; border-radius: 12px; overflow: hidden;">
            
            <!-- Toolbar -->
            <div class="tree-toolbar" style="
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
                    <input type="text" id="tree-search" placeholder="Cerca attività..." style="
                        width: 100%;
                        padding: 0.6rem 1rem 0.6rem 2.5rem;
                        border: 1px solid var(--surface-2);
                        border-radius: 8px;
                        font-size: 0.9rem;
                    ">
                </div>
                
                <!-- Filters -->
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="filter-chip active" data-filter="all">Tutti</button>
                    <button class="filter-chip" data-filter="my">Assegnati a me</button>
                    <button class="filter-chip" data-filter="overdue">Scadute</button>
                    <button class="filter-chip" data-filter="blocked">Bloccate</button>
                </div>
                
                <!-- Toggle completed -->
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem;">
                    <input type="checkbox" id="show-completed" checked>
                    Mostra completate
                </label>
            </div>
            
            <!-- Tree Content -->
            <div id="tree-content" style="padding: 1rem;">
                ${renderTreeContainer(tree, spaceId)}
            </div>
        </div>
        
        <style>
            .filter-chip {
                padding: 0.4rem 1rem;
                border: 1px solid var(--surface-2);
                background: white;
                border-radius: 20px;
                font-size: 0.8rem;
                cursor: pointer;
                transition: all 0.2s;
            }
            .filter-chip:hover {
                background: var(--surface-1);
            }
            .filter-chip.active {
                background: var(--brand-color);
                color: white;
                border-color: var(--brand-color);
            }
            .tree-node {
                margin-bottom: 2px;
            }
            .tree-row {
                display: flex;
                align-items: center;
                padding: 0.6rem 0.75rem;
                border-radius: 6px;
                cursor: pointer;
                transition: background 0.15s;
            }
            .tree-row:hover {
                background: var(--surface-1);
            }
            .tree-toggle {
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: none;
                background: none;
                cursor: pointer;
                border-radius: 4px;
            }
            .tree-toggle:hover {
                background: var(--surface-2);
            }
            .tree-children {
                margin-left: 1.5rem;
                border-left: 1px dashed var(--surface-2);
                padding-left: 0.5rem;
            }
            .tree-node.collapsed > .tree-children {
                display: none;
            }
            .status-pill {
                padding: 2px 8px;
                border-radius: 10px;
                font-size: 0.7rem;
                font-weight: 600;
                text-transform: uppercase;
            }
            .add-child-btn {
                opacity: 0;
                transition: opacity 0.2s;
            }
            .tree-row:hover .add-child-btn {
                opacity: 1;
            }
        </style>
    `;

    // Event handlers
    setupTreeEventHandlers(container, items, spaceId);
}

function buildTree(items) {
    const map = new Map();
    const roots = [];

    items.forEach(item => {
        map.set(item.id, { ...item, children: [] });
    });

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

function renderTreeContainer(tree, spaceId) {
    const showCompleted = document.getElementById('show-completed')?.checked !== false;
    const activeFilter = document.querySelector('.filter-chip.active')?.dataset.filter || 'all';
    const searchTerm = document.getElementById('tree-search')?.value.toLowerCase() || '';

    // Recursive filter function
    const filterNodes = (nodes) => {
        return nodes.map(node => {
            const children = node.children ? filterNodes(node.children) : [];
            const isDone = node.status === 'done';

            // Should this node be visible?
            let visible = true;

            // 1. Completed filter
            if (!showCompleted && isDone) visible = false;

            // 2. Category filter
            if (activeFilter === 'my') {
                const myId = state.session?.user?.id;
                const isAssignedToMe = node.pm_item_assignees?.some(a => a.user_ref === myId);
                if (!isAssignedToMe && children.length === 0) visible = false;
            } else if (activeFilter === 'overdue') {
                const isOverdue = node.due_date && !isDone && new Date(node.due_date) < new Date();
                if (!isOverdue && children.length === 0) visible = false;
            } else if (activeFilter === 'blocked') {
                if (node.status !== 'blocked' && children.length === 0) visible = false;
            }

            // 3. Search filter
            if (searchTerm && !node.title.toLowerCase().includes(searchTerm) && children.length === 0) visible = false;

            // If children are visible, parent must be visible
            if (children.some(c => c._visible)) visible = true;

            return { ...node, children, _visible: visible };
        });
    };

    const processedTree = filterNodes(tree);
    const visibleRoots = processedTree.filter(n => n._visible);

    if (visibleRoots.length === 0) return renderEmptyState();

    // Render Table Header
    const headerHtml = `
        <div style="display: flex; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid var(--surface-2); font-size: 0.75rem; color: var(--text-tertiary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
            <div style="width: 30px;"></div>
            <div style="flex: 2; min-width: 0;">Titolo</div>
            <div style="width: 120px; text-align: center;">Persone</div>
            <div style="width: 100px; text-align: center;">Priorità</div>
            <div style="width: 100px; text-align: center;">Scadenza</div>
            <div style="width: 80px; text-align: center;">Stato</div>
            <div style="width: 40px;"></div>
        </div>
    `;

    return headerHtml + renderTreeNodes(visibleRoots, 0, spaceId);
}

function renderTreeNodes(nodes, level, spaceId) {
    return nodes.map(node => {
        if (node._visible === false) return '';

        const hasChildren = node.children && node.children.some(c => c._visible);
        const statusInfo = ITEM_STATUS[node.status] || ITEM_STATUS['todo'];
        const priorityInfo = ITEM_PRIORITY[node.priority] || ITEM_PRIORITY['medium'];
        const isDone = node.status === 'done';
        const isOverdue = node.due_date && !isDone && new Date(node.due_date) < new Date();

        // Assignee avatars
        const assignees = node.pm_item_assignees || [];
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
            <div class="tree-node" data-id="${node.id}">
                <div class="tree-row" data-id="${node.id}" style="display: flex; align-items: center; padding: 0.5rem 1rem; border-bottom: 1px solid var(--surface-1);">
                    <!-- Toggle & Icon -->
                    <div style="width: 30px; display: flex; align-items: center;">
                        ${hasChildren ? `
                            <button class="tree-toggle" style="padding:0; margin-left: -4px;">
                                <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-secondary);">expand_more</span>
                            </button>
                        ` : ''}
                    </div>
                    
                    <!-- Title & Type Icon -->
                    <div style="flex: 2; min-width: 0; display: flex; align-items: center; gap: 8px; ${isDone ? 'opacity: 0.5;' : ''}">
                        <span class="material-icons-round" style="font-size: 1.1rem; color: ${node.item_type === 'attivita' ? '#f59e0b' : 'var(--text-secondary)'}; flex-shrink: 0;">
                            ${node.item_type === 'attivita' ? 'folder' : 'check_circle_outline'}
                        </span>
                        <span style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ${isDone ? 'text-decoration: line-through;' : ''}">${node.title}</span>
                    </div>

                    <!-- Assignees -->
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
                            text-transform: uppercase;
                        ">${priorityInfo.label}</span>
                    </div>

                    <!-- Due Date -->
                    <div style="width: 100px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; color: ${isOverdue ? '#ef4444' : 'var(--text-secondary)'}; font-weight: 500;">
                        ${node.due_date ? `
                            <span class="material-icons-round" style="font-size: 0.9rem; margin-right: 4px;">${isOverdue ? 'warning' : 'event'}</span>
                            ${new Date(node.due_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                        ` : '<span style="color: var(--text-tertiary); opacity: 0.5;">---</span>'}
                    </div>

                    <!-- Status -->
                    <div style="width: 80px; display: flex; align-items: center; justify-content: center;">
                        <span class="status-pill" style="background: ${statusInfo.bg}; color: ${statusInfo.color};">
                            ${statusInfo.label}
                        </span>
                    </div>

                    <!-- Actions -->
                    <div style="width: 40px; display: flex; align-items: center; justify-content: center;">
                        <button class="add-child-btn icon-btn" data-parent="${node.id}" data-space="${spaceId}" title="Aggiungi" style="padding: 4px;">
                            <span class="material-icons-round" style="font-size: 1rem;">add</span>
                        </button>
                    </div>
                </div>
                
                ${hasChildren ? `
                    <div class="tree-children">
                        ${renderTreeNodes(node.children, level + 1, spaceId)}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function renderEmptyState() {
    return `
        <div style="text-align: center; padding: 4rem 2rem; color: var(--text-secondary);">
            <span class="material-icons-round" style="font-size: 4rem; opacity: 0.2;">park</span>
            <h3 style="margin: 1rem 0 0.5rem; color: var(--text-main);">Inizia a creare</h3>
            <p>Crea la prima attività per organizzare il lavoro su questa commessa.</p>
            <button class="primary-btn create-first-btn" style="margin-top: 1.5rem;">
                <span class="material-icons-round" style="font-size: 1rem; margin-right: 0.5rem;">add</span>
                Crea Attività
            </button>
        </div>
    `;
}

function setupTreeEventHandlers(container, items, spaceId) {
    // Toggle expand/collapse
    container.querySelectorAll('.tree-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const node = btn.closest('.tree-node');
            node.classList.toggle('collapsed');
            const icon = btn.querySelector('.material-icons-round');
            icon.textContent = node.classList.contains('collapsed') ? 'chevron_right' : 'expand_more';
        });
    });

    // Click item to open drawer
    container.querySelectorAll('.tree-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('.tree-toggle') || e.target.closest('.add-child-btn')) return;
            const itemId = row.dataset.id;
            import('./hub_drawer.js?v=157').then(mod => {
                mod.openHubDrawer(itemId, spaceId);
            });
        });
    });

    // Add child button
    container.querySelectorAll('.add-child-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const parentId = btn.dataset.parent;
            const spaceId = btn.dataset.space;

            // Context Menu Logic
            // Remove any existing one
            document.querySelectorAll('.hub-context-menu').forEach(el => el.remove());

            const menu = document.createElement('div');
            menu.className = 'hub-context-menu glass-card';
            menu.style.cssText = `
                position: absolute;
                z-index: 10000;
                background: white;
                border: 1px solid var(--surface-2);
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                min-width: 160px;
                overflow: hidden;
                padding: 4px;
            `;

            menu.innerHTML = `
                <div class="menu-item" data-type="attivita" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; border-radius: 6px; font-size: 0.9rem;">
                    <span class="material-icons-round" style="font-size: 1.1rem; color: #f59e0b;">folder</span>
                    <span>Sotto-attività</span>
                </div>
                <div class="menu-item" data-type="task" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; border-radius: 6px; font-size: 0.9rem;">
                    <span class="material-icons-round" style="font-size: 1.1rem; color: #3b82f6;">check_circle_outline</span>
                    <span>Task</span>
                </div>
            `;

            // Position
            const rect = btn.getBoundingClientRect();
            menu.style.top = (window.scrollY + rect.bottom + 4) + 'px';
            menu.style.left = (window.scrollX + rect.left) + 'px';

            document.body.appendChild(menu);

            // Logic
            menu.querySelectorAll('.menu-item').forEach(item => {
                item.addEventListener('mouseenter', () => item.style.background = 'var(--surface-1)');
                item.addEventListener('mouseleave', () => item.style.background = 'transparent');
                item.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    const type = item.dataset.type;
                    import('./hub_drawer.js?v=157').then(mod => {
                        mod.openHubDrawer(null, spaceId, parentId, type);
                    });
                    menu.remove();
                });
            });

            // Close on outside click
            const closeMenu = (ev) => {
                if (!menu.contains(ev.target) && ev.target !== btn) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            };
            setTimeout(() => document.addEventListener('click', closeMenu), 0);
        });
    });

    // Create first button
    container.querySelector('.create-first-btn')?.addEventListener('click', () => {
        import('./hub_drawer.js?v=157').then(mod => {
            mod.openHubDrawer(null, spaceId, null, 'attivita');
        });
    });

    // Filter chips
    container.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            refreshTree();
        });
    });

    // Toggle completed
    container.querySelector('#show-completed')?.addEventListener('change', () => {
        refreshTree();
    });

    function refreshTree() {
        const content = container.querySelector('#tree-content');
        if (content) content.innerHTML = renderTreeContainer(buildTree(items), spaceId);
        // Re-attach handlers because we re-rendered the tree
        setupTreeEventHandlers(container, items, spaceId);
    }

    // Search
    const searchInput = container.querySelector('#tree-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            refreshTree();
        });
    }
}
