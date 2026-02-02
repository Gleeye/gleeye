
export function renderPMTree(container, items, space) {
    // 1. Build Tree
    const tree = buildTree(items);

    // 2. Render
    if (tree.length === 0) {
        container.innerHTML = `
            <div style="padding:3rem; text-align:center; color: var(--text-secondary);">
                <span class="material-icons-round" style="font-size:3rem; opacity:0.3;">park</span>
                <p>Nessuna attività in questo progetto.</p>
                <p class="text-xs">Crea la prima attività per iniziare.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `<div class="pm-tree-container">${renderTreeNodes(tree)}</div>`;

    // Attach Listeners
    // Toggle expand/collapse
    container.querySelectorAll('.tree-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const node = btn.closest('.tree-node');
            node.classList.toggle('expanded');
            const icon = btn.querySelector('.material-icons-round');
            icon.textContent = node.classList.contains('expanded') ? 'expand_more' : 'chevron_right';
        });
    });
}

function buildTree(items) {
    // items have parent_ref
    const map = new Map();
    const roots = [];

    // Initialize map
    items.forEach(item => {
        map.set(item.id, { ...item, children: [] });
    });

    // Link children
    items.forEach(item => {
        if (item.parent_ref && map.has(item.parent_ref)) {
            map.get(item.parent_ref).children.push(map.get(item.id));
        } else {
            roots.push(map.get(item.id));
        }
    });

    return roots;
}

function renderTreeNodes(nodes, level = 0) {
    return nodes.map(node => {
        const hasChildren = node.children && node.children.length > 0;
        const padding = level * 1.5;

        // Status color logic
        let statusColor = '#94a3b8'; // grey
        if (node.status === 'done' || node.status === 'completed') statusColor = '#10b981'; // green
        if (node.status === 'in_progress') statusColor = '#3b82f6'; // blue
        if (node.status === 'blocked') statusColor = '#ef4444'; // red

        return `
            <div class="tree-node expanded" data-id="${node.id}">
                <div class="tree-row hover-bg" style="padding-left: ${padding}rem; display:flex; align-items:center; padding-top:0.5rem; padding-bottom:0.5rem; border-bottom:1px solid var(--glass-border);">
                    
                    <button class="icon-btn tree-toggle" style="visibility: ${hasChildren ? 'visible' : 'hidden'}; padding:0; margin-right:0.5rem; width:24px; height:24px;">
                        <span class="material-icons-round" style="font-size:1.2rem;">expand_more</span>
                    </button>
                    
                    <div style="margin-right:0.5rem;">
                        ${getNodeIcon(node.item_type)}
                    </div>
                    
                    <div class="tree-content" style="flex:1;">
                        <div style="font-weight:500;">${node.title}</div>
                        <div class="text-xs text-secondary" style="display:flex; gap:0.5rem; align-items:center;">
                             <span class="status-dot" style="background:${statusColor}; width:8px; height:8px; border-radius:50%; display:inline-block;"></span>
                             ${node.status}
                             ${node.due_date ? `• Scadenza: ${new Date(node.due_date).toLocaleDateString()}` : ''}
                        </div>
                    </div>
                    
                    <div class="tree-actions" style="opacity:0.5;">
                        <!-- Avatars could go here -->
                        <button class="icon-btn" onclick="alert('Modifica in arrivo')">
                            <span class="material-icons-round" style="font-size:1rem;">edit</span>
                        </button>
                    </div>
                </div>
                
                ${hasChildren ? `<div class="tree-children">${renderTreeNodes(node.children, level + 1)}</div>` : ''}
            </div>
        `;
    }).join('');
}

function getNodeIcon(type) {
    if (type === 'milestone') return '<span class="material-icons-round" style="color:var(--brand-color);">flag</span>';
    if (type === 'attivita') return '<span class="material-icons-round" style="color:#f59e0b;">folder</span>';
    return '<span class="material-icons-round" style="color:var(--text-secondary); font-size:1rem;">check_circle_outline</span>'; // Task
}
