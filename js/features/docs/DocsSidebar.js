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
        addBtn.onclick = () => {
            if (sidebarCallbacks.onPageCreate) sidebarCallbacks.onPageCreate();
        };
    }
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
        input.placeholder = 'Search pages...';
        input.value = searchTerm;
        input.style.width = '100%';
        input.style.padding = '6px 10px';
        input.style.borderRadius = '6px';
        input.style.border = '1px solid #cbd5e1';
        input.style.fontSize = '13px';
        input.style.outline = 'none';
        input.style.backgroundColor = '#f8fafc';

        input.onfocus = () => input.style.backgroundColor = 'white';
        input.onblur = () => input.style.backgroundColor = '#f8fafc';

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
            container.innerHTML = '<div style="padding:12px; color:#94a3b8; font-size:13px; text-align:center;">No pages found</div>';
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
    div.style.fontSize = '14px';
    div.style.color = node.id === activePageId ? '#0f172a' : '#64748b';
    div.style.backgroundColor = node.id === activePageId ? '#f1f5f9' : 'transparent';
    div.style.transition = 'background 0.2s';
    div.style.position = 'relative'; // For absolute positioning if needed, or flex

    const iconHtml = node.icon
        ? `<span style="font-size: 16px; margin-right: 8px; line-height: 1;">${node.icon}</span>`
        : `<span class="material-icons-round" style="font-size: 16px; margin-right: 8px; opacity: 0.7;">description</span>`;

    div.innerHTML = `
        ${iconHtml}
        <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${node.title || 'Untitled'}</span>
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
        if (sidebarCallbacks.onPageCreateSub) sidebarCallbacks.onPageCreateSub(node.id);
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
        if (confirm(`Delete page "${node.title}"?`)) {
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
