export let sidebarCallbacks = {
    onPageSelect: null,
    onPageCreate: null,
    onPageCreateSub: null,
    onPageDelete: null
};

let searchTerm = '';
let lastPages = [];
let lastActiveId = null;

export function setupSidebarEvents(callbacks) {
    sidebarCallbacks = { ...sidebarCallbacks, ...callbacks };

    // Global Add Button Listener
    const addBtn = document.getElementById('add-page-btn');
    if (addBtn) {
        addBtn.onclick = (e) => {
            showDocumentTypeMenu(e.currentTarget, (type) => {
                if (sidebarCallbacks.onPageCreate) sidebarCallbacks.onPageCreate(type);
            });
        };
    }
}

function showDocumentTypeMenu(anchorEl, onSelect) {
    // Remove if exists
    const existing = document.getElementById('doc-type-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'doc-type-menu';
    menu.style.position = 'absolute';
    menu.style.background = 'white';
    menu.style.boxShadow = 'var(--shadow-xl)';
    menu.style.borderRadius = '12px';
    menu.style.padding = '6px';
    menu.style.zIndex = '10000';
    menu.style.display = 'flex';
    menu.style.flexDirection = 'column';
    menu.style.gap = '2px';
    menu.style.minWidth = '180px';
    menu.style.border = '1px solid var(--glass-border)';
    menu.style.backdropFilter = 'blur(10px)';

    const createOption = (icon, text, type) => {
        const btn = document.createElement('button');
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.gap = '8px';
        btn.style.padding = '8px 12px';
        btn.style.border = 'none';
        btn.style.background = 'transparent';
        btn.style.cursor = 'pointer';
        btn.style.borderRadius = '6px';
        btn.style.textAlign = 'left';
        btn.style.fontSize = '13px';
        btn.style.fontWeight = '600';
        btn.style.color = 'var(--text-secondary)';
        btn.onmouseenter = () => {
            btn.style.backgroundColor = 'var(--surface-2)';
            btn.style.color = 'var(--brand-blue)';
        };
        btn.onmouseleave = () => {
            btn.style.backgroundColor = 'transparent';
            btn.style.color = 'var(--text-secondary)';
        };
        btn.innerHTML = `<span class="material-icons-round" style="font-size: 18px; opacity:0.8;">${icon}</span> <span>${text}</span>`;
        btn.onclick = (e) => {
            e.stopPropagation();
            onSelect(type);
            menu.remove();
        };
        return btn;
    };

    menu.appendChild(createOption('description', 'Documento', 'document'));
    menu.appendChild(createOption('draw', 'Whiteboard', 'whiteboard'));

    const rect = anchorEl.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.left}px`;

    document.body.appendChild(menu);

    // Close on outside click
    requestAnimationFrame(() => {
        const closeMenu = (e) => {
            if (!menu.contains(e.target) && e.target !== anchorEl && !anchorEl.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        document.addEventListener('click', closeMenu);
    });
}

export function renderDocsSidebar(container, pages, activePageId) {
    lastPages = pages;
    lastActiveId = activePageId;

    let treeDiv = container.querySelector('.doc-sidebar-tree');
    if (!treeDiv) {
        container.innerHTML = '';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        // container.style.height = '100%'; // Managed by flex parent

        // Search Input
        const searchDiv = document.createElement('div');
        searchDiv.style.padding = '12px 12px 8px 12px';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Cerca pagine...';
        input.value = searchTerm;
        input.style.width = '100%';
        input.style.padding = '8px 12px';
        input.style.borderRadius = '10px';
        input.style.border = '1px solid var(--surface-2)';
        input.style.fontSize = '0.75rem';
        input.style.outline = 'none';
        input.style.backgroundColor = 'var(--surface-1)';
        input.style.transition = 'all 0.2s';

        input.onfocus = () => {
            input.style.backgroundColor = 'white';
            input.style.borderColor = 'var(--brand-blue)';
            input.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
        };
        input.onblur = () => {
            input.style.backgroundColor = 'var(--surface-1)';
            input.style.borderColor = 'var(--surface-2)';
            input.style.boxShadow = 'none';
        };

        input.oninput = (e) => {
            searchTerm = e.target.value.toLowerCase();
            if (treeDiv) renderTreeContent(treeDiv, lastPages, lastActiveId);
        };
        searchDiv.appendChild(input);
        container.appendChild(searchDiv);

        treeDiv = document.createElement('div');
        treeDiv.className = 'doc-sidebar-tree';
        treeDiv.style.flex = '1';
        treeDiv.style.overflowY = 'auto';
        treeDiv.style.padding = '0 8px';
        container.appendChild(treeDiv);
    }

    renderTreeContent(treeDiv, pages, activePageId);
}

function renderTreeContent(container, pages, activePageId) {
    container.innerHTML = '';

    const sorted = [...pages].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

    // Search Mode
    if (searchTerm) {
        const matches = sorted.filter(p => (p.title || '').toLowerCase().includes(searchTerm));
        if (matches.length === 0) {
            container.innerHTML = '<div style="padding:24px 12px; color:var(--text-tertiary); font-size:12px; text-align:center; font-style:italic;">Nessuna pagina trovata</div>';
            return;
        }

        const ul = document.createElement('ul');
        ul.style.listStyle = 'none';
        ul.style.padding = '0';
        ul.style.margin = '0';

        matches.forEach(p => {
            // Pass empty children just in case to force leaf rendering
            const leafNode = { ...p, children: [] };
            ul.appendChild(createPageItem(leafNode, activePageId));
        });
        container.appendChild(ul);
        return;
    }

    // Tree Mode
    const map = {};
    sorted.forEach(p => {
        map[p.id] = { ...p, children: [] };
    });

    const tree = [];
    sorted.forEach(p => {
        if (p.parent_ref && map[p.parent_ref]) {
            map[p.parent_ref].children.push(map[p.id]);
        } else {
            tree.push(map[p.id]);
        }
    });

    const ul = document.createElement('ul');
    ul.style.listStyle = 'none';
    ul.style.padding = '0';
    ul.style.margin = '0';

    tree.forEach(node => {
        ul.appendChild(createPageItem(node, activePageId));
    });

    container.appendChild(ul);
}

function createPageItem(node, activePageId, level = 0) {
    const li = document.createElement('li');
    li.style.marginBottom = '2px';

    const div = document.createElement('div');
    div.className = `doc-page-item ${node.id === activePageId ? 'active' : ''}`;
    div.style.padding = `6px 12px 6px ${12 + (level * 16)}px`;
    div.style.cursor = 'pointer';
    div.style.borderRadius = '6px';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.fontSize = '0.75rem';
    div.style.fontWeight = node.id === activePageId ? '700' : '500';
    div.style.color = node.id === activePageId ? 'var(--brand-blue)' : 'var(--text-secondary)';
    div.style.backgroundColor = node.id === activePageId ? 'rgba(59, 130, 246, 0.05)' : 'transparent';
    div.style.transition = 'all 0.2s';
    div.style.position = 'relative';

    let iconHtml = node.icon
        ? `<span style="font-size: 16px; margin-right: 8px; line-height: 1;">${node.icon}</span>`
        : `<span class="material-icons-round" style="font-size: 16px; margin-right: 8px; opacity: 0.7;">description</span>`;

    if (!node.icon && node.page_type === 'whiteboard') {
        iconHtml = `<span class="material-icons-round" style="font-size: 16px; margin-right: 8px; opacity: 0.7; color: #8b5cf6;">draw</span>`;
    }

    const visibilityIcon = node.is_public
        ? `<span class="material-icons-round" style="font-size: 13px; color: var(--brand-blue); opacity: 0.8; margin-left: 4px;" title="Pubblico">public</span>`
        : ``;

    div.innerHTML = `
        ${iconHtml}
        <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${node.title || 'Untitled'}</span>
        ${visibilityIcon}
    `;

    // Add Sub-page Button
    const addBtn = document.createElement('span');
    addBtn.className = 'material-icons-round sidebar-add-sub';
    addBtn.innerText = 'add';
    addBtn.title = 'Add sub-page';
    addBtn.style.fontSize = '14px';
    addBtn.style.marginLeft = '8px';
    addBtn.style.opacity = '0';
    addBtn.style.color = '#94a3b8';
    addBtn.style.transition = 'opacity 0.2s';

    addBtn.onclick = (e) => {
        e.stopPropagation();
        showDocumentTypeMenu(e.currentTarget, (type) => {
            if (sidebarCallbacks.onPageCreateSub) sidebarCallbacks.onPageCreateSub(node.id, type);
        });
    };

    // Add Delete Button
    const delBtn = document.createElement('span');
    delBtn.className = 'material-icons-round sidebar-del';
    delBtn.innerText = 'delete';
    delBtn.title = 'Delete page';
    delBtn.style.fontSize = '14px';
    delBtn.style.marginLeft = '4px';
    delBtn.style.opacity = '0';
    delBtn.style.color = '#ef4444'; // Red
    delBtn.style.transition = 'opacity 0.2s';

    delBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Rimuovere la pagina "${node.title || 'Senza Titolo'}"?`)) {
            if (sidebarCallbacks.onPageDelete) sidebarCallbacks.onPageDelete(node.id);
        }
    };

    div.appendChild(addBtn);
    div.appendChild(delBtn);

    // Hover effect
    div.onmouseenter = () => {
        if (node.id !== activePageId) div.style.backgroundColor = '#f8fafc';
        addBtn.style.opacity = '1';
        delBtn.style.opacity = '0.6'; // Slightly visible
        delBtn.onmouseenter = () => delBtn.style.opacity = '1';
        delBtn.onmouseleave = () => delBtn.style.opacity = '0.6';
    };
    div.onmouseleave = () => {
        if (node.id !== activePageId) div.style.backgroundColor = 'transparent';
        addBtn.style.opacity = '0';
        delBtn.style.opacity = '0';
    };

    div.onclick = () => {
        if (sidebarCallbacks.onPageSelect) sidebarCallbacks.onPageSelect(node.id);
    };

    li.appendChild(div);

    // Children
    if (node.children && node.children.length > 0) {
        const subUl = document.createElement('ul');
        subUl.style.listStyle = 'none';
        subUl.style.padding = '0';
        subUl.style.margin = '0';
        node.children.forEach(child => {
            subUl.appendChild(createPageItem(child, activePageId, level + 1));
        });
        li.appendChild(subUl);
    }

    return li;
}
