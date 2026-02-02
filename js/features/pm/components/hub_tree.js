// Hub Tree Tab - Hierarchical Activity View with filters

const ITEM_STATUS = {
    'todo': { label: 'Da Fare', color: '#94a3b8', bg: '#f1f5f9' },
    'in_progress': { label: 'In Corso', color: '#3b82f6', bg: '#eff6ff' },
    'blocked': { label: 'Bloccato', color: '#ef4444', bg: '#fef2f2' },
    'review': { label: 'Revisione', color: '#f59e0b', bg: '#fffbeb' },
    'done': { label: 'Completato', color: '#10b981', bg: '#ecfdf5' }
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
                ${tree.length === 0 ? renderEmptyState() : renderTreeNodes(tree, 0, spaceId)}
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

function renderTreeNodes(nodes, level, spaceId) {
    return nodes.map(node => {
        const hasChildren = node.children && node.children.length > 0;
        const statusInfo = ITEM_STATUS[node.status] || ITEM_STATUS['todo'];
        const isDone = node.status === 'done';
        const isOverdue = node.due_date && node.status !== 'done' && new Date(node.due_date) < new Date();

        return `
            <div class="tree-node" data-id="${node.id}">
                <div class="tree-row" data-id="${node.id}">
                    <!-- Toggle -->
                    <button class="tree-toggle" style="visibility: ${hasChildren ? 'visible' : 'hidden'};">
                        <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-secondary);">expand_more</span>
                    </button>
                    
                    <!-- Icon -->
                    <span class="material-icons-round" style="margin-right: 0.5rem; font-size: 1.1rem; color: ${node.item_type === 'attivita' ? '#f59e0b' : 'var(--text-secondary)'};">
                        ${node.item_type === 'attivita' ? 'folder' : node.item_type === 'milestone' ? 'flag' : 'check_circle_outline'}
                    </span>
                    
                    <!-- Title -->
                    <div style="flex: 1; min-width: 0; ${isDone ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                        <span style="font-weight: 500;">${node.title}</span>
                    </div>
                    
                    <!-- Status Pill -->
                    <span class="status-pill" style="background: ${statusInfo.bg}; color: ${statusInfo.color}; margin-right: 0.75rem;">
                        ${statusInfo.label}
                    </span>
                    
                    <!-- Due Date -->
                    ${node.due_date ? `
                        <span style="font-size: 0.8rem; color: ${isOverdue ? '#ef4444' : 'var(--text-secondary)'}; margin-right: 0.75rem; display: flex; align-items: center; gap: 4px;">
                            <span class="material-icons-round" style="font-size: 0.9rem;">${isOverdue ? 'warning' : 'event'}</span>
                            ${new Date(node.due_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                        </span>
                    ` : ''}
                    
                    <!-- Add Child Button -->
                    <button class="add-child-btn icon-btn" data-parent="${node.id}" data-space="${spaceId}" title="Aggiungi sotto-elemento" style="padding: 4px;">
                        <span class="material-icons-round" style="font-size: 1rem;">add</span>
                    </button>
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
            import('./hub_drawer.js?v=151').then(mod => {
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
                    import('./hub_drawer.js?v=151').then(mod => {
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
        import('./hub_drawer.js?v=151').then(mod => {
            mod.openHubDrawer(null, spaceId, null, 'attivita');
        });
    });

    // Filter chips
    container.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            // TODO: Apply filter logic
        });
    });

    // Search
    const searchInput = container.querySelector('#tree-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            container.querySelectorAll('.tree-node').forEach(node => {
                const title = node.querySelector('.tree-row span[style*="font-weight"]')?.textContent?.toLowerCase() || '';
                node.style.display = title.includes(term) ? '' : 'none';
            });
        });
    }
}
