import { CustomSelect } from '/js/components/CustomSelect.js?v=1000';

// Global state to persist view/sort across refreshes
const hubTreePersistentState = new Map();

// Helper to save/load from localStorage
const getStoredState = (spaceId) => {
    try {
        const stored = localStorage.getItem(`hub_tree_state_${spaceId}`);
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                view: parsed.view || 'tree',
                sort: parsed.sort || { column: 'type', direction: 'asc' },
                expandedNodes: new Set(parsed.expandedNodes || [])
            };
        }
    } catch (e) { console.error("Error loading stored state", e); }
    return {
        view: 'tree',
        sort: { column: 'type', direction: 'asc' },
        expandedNodes: new Set()
    };
};

const saveStoredState = (spaceId, state) => {
    try {
        const toStore = {
            view: state.view,
            sort: state.sort,
            expandedNodes: Array.from(state.expandedNodes)
        };
        localStorage.setItem(`hub_tree_state_${spaceId}`, JSON.stringify(toStore));
    } catch (e) { console.error("Error saving state", e); }
};

export function renderHubTree(container, items, space, spaceId) {
    const sId = String(spaceId);
    if (!hubTreePersistentState.has(sId)) {
        const stored = getStoredState(sId);
        hubTreePersistentState.set(sId, stored || {
            view: 'tree',
            sort: { column: 'type', direction: 'asc' },
            expandedNodes: new Set()
        });
    }

    const pState = hubTreePersistentState.get(sId);
    const tree = buildTree(items);

    // Board State from persistence
    let currentView = pState.view;
    let currentSort = pState.sort;
    const expandedNodes = pState.expandedNodes;

    // Extract collaborators
    const collaboratorsMap = new Map();
    items.forEach(item => {
        item.pm_item_assignees?.forEach(a => {
            if (a.user && a.user_ref) collaboratorsMap.set(a.user_ref, a.user);
        });
    });
    const assignedCollaborators = Array.from(collaboratorsMap.values()).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

    // Unified Handlers
    const handleSortChange = (col) => {
        if (currentSort.column === col) currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        else { currentSort.column = col; currentSort.direction = 'asc'; }
        pState.sort = { ...currentSort };
        saveStoredState(sId, pState);
        refreshBoard();
    };

    const handleViewChange = (view) => {
        currentView = view;
        pState.view = view;
        saveStoredState(sId, pState);
        refreshBoard();
    };

    const refreshBoard = () => {
        const contentArea = container.querySelector('#board-content-area');
        if (!contentArea) return;

        contentArea.innerHTML = renderBoardView(container, tree, items, spaceId, currentSort, currentView, expandedNodes);

        setupBoardEventHandlers(container, items, spaceId, currentSort, currentView,
            handleSortChange,
            handleViewChange,
            expandedNodes,
            refreshBoard,
            space
        );
    };

    container.innerHTML = `
        <div class="hub-tree-view" style="background: white; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; width: 100%; height: 100%;">
            
            <!-- View Mode & Main Toggles -->
            <div style="padding: 0.6rem 1rem 0.4rem 1rem; display: flex; align-items: center; justify-content: space-between; background: white;">
                <div class="view-switcher" style="display: flex; background: var(--surface-1); padding: 2px; border-radius: 8px;">
                    <button class="view-btn ${currentView === 'tree' ? 'active' : ''}" data-view="tree" title="Lista">
                        <span class="material-icons-round" style="font-size: 1.1rem;">format_list_bulleted</span>
                    </button>
                    <button class="view-btn ${currentView === 'kanban' ? 'active' : ''}" data-view="kanban" title="Kanban">
                        <span class="material-icons-round" style="font-size: 1.1rem;">view_kanban</span>
                    </button>
                    <button class="view-btn ${currentView === 'gantt' ? 'active' : ''}" data-view="gantt" title="Gantt">
                        <span class="material-icons-round" style="font-size: 1.1rem;">equalizer</span>
                    </button>
                </div>

                <div style="display: flex; align-items: center; gap: 1rem;">
                    <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.7rem; color: var(--text-secondary); white-space: nowrap;">
                        <input type="checkbox" id="show-only-tasks" style="width: 14px; height: 14px; accent-color: var(--brand-blue);">
                        Solo Task
                    </label>
                    <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.7rem; color: var(--text-secondary); white-space: nowrap;">
                        <input type="checkbox" id="show-completed" style="width: 14px; height: 14px; accent-color: var(--brand-blue);">
                        Conclusi
                    </label>
                </div>
            </div>

            <!-- Filter Toolbar -->
            <div class="tree-toolbar" style="padding: 0.25rem 1rem 0.6rem 1rem; display: flex; align-items: center; gap: 1.25rem; background: white; border-bottom: 1px solid var(--surface-2);">
                <div style="position: relative; width: 160px; flex-shrink: 0;">
                    <span class="material-icons-round" style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); font-size: 0.95rem;">search</span>
                    <input type="text" id="tree-search" placeholder="Cerca..." style="width: 100%; padding: 0.4rem 0.6rem 0.4rem 2.22rem; border: 1px solid var(--surface-2); border-radius: 6px; font-size: 0.8rem; background: var(--surface-1); outline: none;">
                </div>

                <div style="display: flex; gap: 0.4rem; flex-shrink: 0;">
                    <button class="filter-chip active" data-filter="all">Tutti</button>
                    <button class="filter-chip" data-filter="my">Miei</button>
                    <button class="filter-chip" data-filter="assigned">Assegnati</button>
                </div>
                
                <div style="width: 1px; height: 18px; background: var(--surface-3); flex-shrink: 0;"></div>

                <div style="display: flex; gap: 0.8rem; align-items: center;">
                    <div style="width: 120px;">
                        <select id="filter-collaborator-tree">
                            <option value="">Team</option>
                            ${assignedCollaborators.map(c => `<option value="${c.id}">${c.full_name}</option>`).join('')}
                        </select>
                    </div>
                    <div style="width: 120px;">
                        <select id="filter-status-tree">
                            <option value="">Stato</option>
                            ${Object.entries(ITEM_STATUS).map(([key, cfg]) => `<option value="${key}" data-dot="${cfg.color}">${cfg.label}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>
            
            <div id="board-content-area" style="flex: 1; overflow: hidden; display: flex; flex-direction: column; min-width: 0;">
                ${renderBoardView(container, tree, items, spaceId, currentSort, currentView, expandedNodes)}
            </div>
        </div>
        
        <style>
            .view-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; background: none; border-radius: 6px; color: var(--text-tertiary); cursor: pointer; transition: all 0.2s; }
            .view-btn:hover { color: var(--text-secondary); background: rgba(0,0,0,0.05); }
            .view-btn.active { background: white; color: var(--brand-blue); box-shadow: 0 1px 4px rgba(0,0,0,0.1); }

            .filter-chip { padding: 0.4rem 0.8rem; border: 1px solid transparent; background: transparent; border-radius: 6px; font-size: 0.75rem; font-weight: 500; cursor: pointer; transition: all 0.15s; color: var(--text-secondary); }
            .filter-chip:hover { background: var(--surface-1); }
            .filter-chip.active { background: var(--brand-blue-light, #e0e7ff); color: var(--brand-blue); }
            
            .tree-toolbar .custom-select-trigger { padding: 0.4rem 0.6rem !important; font-size: 0.75rem !important; height: 32px !important; border-radius: 6px !important; background: transparent !important; border: 1px solid transparent !important; color: var(--text-secondary) !important; }
            .tree-toolbar .custom-select-trigger:hover { background: var(--surface-1) !important; color: var(--text-primary) !important; border-color: var(--surface-2) !important; }

            .tree-row { display: flex; align-items: center; padding: 0.45rem 1rem; cursor: pointer; border-bottom: 1px solid var(--surface-1); transition: background 0.1s, border 0.2s; min-height: 48px; border-left: 3px solid transparent; }
            .tree-row:hover { background: var(--surface-1); }
            .tree-row.drag-over { background: rgba(37, 99, 235, 0.05); border-left-color: var(--brand-blue); }
            .tree-node.dragging { opacity: 0.4; }
            
            .tree-toggle { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border: none; background: none; cursor: pointer; color: var(--text-tertiary); transition: transform 0.2s; }
            .tree-node.collapsed > .tree-row .tree-toggle { transform: rotate(-90deg); }
            .tree-node.collapsed > .tree-children { display: none; }
            
            .tree-children { margin-left: 15px; border-left: 1px solid var(--surface-2); }
            
            .status-pill { padding: 4px 10px; border-radius: 6px; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; background: var(--surface-1); color: var(--text-secondary); border: 1px solid var(--surface-2); }
            
            .add-child-btn { opacity: 0; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); transition: all 0.2s; border: 1.5px solid var(--surface-2); }
            .tree-row:hover .add-child-btn { opacity: 1; }
            .add-child-btn:hover { background: var(--brand-blue); color: white; border-color: var(--brand-blue); }
            
            .kanban-board { display: flex; gap: 1rem; padding: 1.25rem; flex: 1; overflow-x: auto; background: #f8fafc; align-items: flex-start; }
            .kanban-column { min-width: 290px; max-width: 290px; background: #f1f5f9; border-radius: 12px; padding: 0.75rem; flex-shrink: 0; display: flex; flex-direction: column; min-height: 500px; }
            .kanban-col-header { padding: 0.4rem 0.6rem; display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; color: var(--text-secondary); font-weight: 800; margin-bottom: 0.8rem; }
            .kanban-cards { display: flex; flex-direction: column; gap: 0.8rem; flex: 1; min-height: 150px; }
            .kanban-card { background: white; border-radius: 10px; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid var(--surface-1); cursor: move; display: flex; flex-direction: column; gap: 0.6rem; transition: transform 0.2s, box-shadow 0.2s; }
            .kanban-card:hover { transform: translateY(-3px); box-shadow: 0 8px 16px rgba(0,0,0,0.1); }
            .kanban-card.dragging { opacity: 0.4; }
            
            .sortable-header:hover { color: var(--text-primary); }
            .sortable-header.active { color: var(--brand-blue); font-weight: 600; }

            /* === MOBILE BOARD === */
            @media (max-width: 768px) {
                /* Root containment — prevent ANY horizontal overflow */
                .hub-tree-view {
                    max-width: 100vw !important;
                    overflow-x: hidden !important;
                    width: 100% !important;
                }
                #board-content-area {
                    overflow-x: hidden !important;
                    min-width: 0 !important;
                    width: 100% !important;
                }

                /* Hide table header on mobile */
                .tree-header { display: none !important; }

                /* Toolbar: compact single-row, horizontal scroll only */
                .tree-toolbar {
                    flex-wrap: nowrap !important;
                    gap: 0.4rem !important;
                    padding: 0.3rem 0.5rem !important;
                    overflow-x: auto !important;
                    overflow-y: hidden !important;
                    -webkit-overflow-scrolling: touch !important;
                    align-items: center !important;
                }
                .tree-toolbar::-webkit-scrollbar { display: none !important; }
                .tree-toolbar > div:first-child { width: 120px !important; flex-shrink: 0 !important; }
                .tree-toolbar input#tree-search {
                    padding: 0.3rem 0.5rem 0.3rem 1.8rem !important;
                    font-size: 0.7rem !important;
                    height: 28px !important;
                }
                .tree-toolbar > div:nth-child(3) { display: none !important; }
                .filter-chip { padding: 0.2rem 0.5rem !important; font-size: 0.65rem !important; white-space: nowrap !important; }
                .tree-toolbar .custom-select-trigger {
                    font-size: 0.65rem !important;
                    padding: 0.2rem 0.4rem !important;
                    height: 24px !important;
                    white-space: nowrap !important;
                }
                /* Make dropdown panels escape the overflow clip */
                .tree-toolbar .custom-options {
                    position: fixed !important;
                    z-index: 9999 !important;
                    max-height: 250px !important;
                    overflow-y: auto !important;
                    width: 160px !important;
                }

                /* View switcher row: compact */
                .hub-tree-view > div:first-child {
                    padding: 0.3rem 0.5rem !important;
                    gap: 0.4rem !important;
                }
                .view-btn { width: 28px !important; height: 28px !important; }
                .hub-tree-view > div:first-child > div:last-child {
                    gap: 0.4rem !important;
                }
                .hub-tree-view > div:first-child > div:last-child label {
                    font-size: 0.6rem !important;
                    gap: 0.2rem !important;
                }
                .hub-tree-view > div:first-child > div:last-child input {
                    width: 12px !important;
                    height: 12px !important;
                }

                /* Tree indent reduced */
                .tree-children { margin-left: 10px !important; }

                /* Tree row: stacked card layout */
                .tree-row {
                    flex-wrap: wrap !important;
                    padding: 0.5rem !important;
                    min-height: auto !important;
                    gap: 2px 6px !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                }

                /* Row 1: toggle + title + action (in that order) */
                .tree-col-toggle { width: 20px !important; flex-shrink: 0 !important; order: 1 !important; }
                .tree-col-title {
                    flex: 1 1 calc(100% - 76px) !important;
                    min-width: 0 !important;
                    max-width: none !important;
                    width: auto !important;
                    gap: 8px !important;
                    order: 2 !important;
                    overflow: hidden !important;
                }
                .tree-col-title > div {
                    overflow: hidden !important;
                    min-width: 0 !important;
                }
                /* Only truncate the TITLE text, NOT the material icon */
                .tree-col-title > div > span:not(.material-icons-round) {
                    white-space: nowrap !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                    font-size: 0.85rem !important;
                    display: block !important;
                }
                .tree-col-action { 
                    width: 24px !important; 
                    flex-shrink: 0 !important;
                    order: 3 !important;
                }
                .add-child-btn { opacity: 1 !important; width: 22px !important; height: 22px !important; }

                /* Hide team column */
                .tree-col-team { display: none !important; }

                /* Row 2: metadata — forced to next line, aligned under title text */
                .tree-col-priority {
                    width: auto !important; min-width: 0 !important; flex-shrink: 0 !important;
                    justify-content: flex-start !important; order: 10 !important;
                    margin-left: 48px !important;
                    margin-top: -2px !important;
                }
                .tree-col-date {
                    width: auto !important; min-width: 0 !important; flex-shrink: 0 !important;
                    justify-content: flex-start !important; order: 11 !important;
                    font-size: 0.7rem !important;
                }
                .tree-col-status {
                    width: auto !important; min-width: 0 !important; flex-shrink: 0 !important;
                    justify-content: flex-start !important; order: 12 !important;
                }
                .tree-col-status .status-pill { font-size: 0.6rem !important; padding: 2px 6px !important; }

                /* KILL the 950px scroll wrapper */
                #tree-content-scroll {
                    overflow-x: hidden !important;
                    overflow-y: auto !important;
                }
                #tree-content-scroll > div {
                    min-width: 0 !important;
                    width: 100% !important;
                }

                /* Kanban: single column */
                .kanban-board { flex-direction: column !important; padding: 0.75rem !important; }
                .kanban-column { min-width: 100% !important; max-width: 100% !important; min-height: auto !important; }
            }
        </style>
    `;

    // Initialize Custom Selects
    const selects = ['#filter-collaborator-tree', '#filter-status-tree'].map(s => container.querySelector(s));
    selects.forEach(s => s && new CustomSelect(s));

    setupBoardEventHandlers(container, items, spaceId, currentSort, currentView,
        handleSortChange,
        handleViewChange,
        expandedNodes,
        refreshBoard,
        space
    );
}

function buildTree(items) {
    const map = new Map();
    const roots = [];
    items.forEach(item => map.set(item.id, { ...item, children: [] }));
    items.forEach(item => {
        const node = map.get(item.id);
        if (item.parent_ref && map.has(item.parent_ref)) map.get(item.parent_ref).children.push(node);
        else roots.push(node);
    });
    return roots;
}

function renderBoardView(container, tree, allItems, spaceId, sort, view, expandedNodes) {
    const showCompleted = document.getElementById('show-completed')?.checked === true;
    const showOnlyTasks = document.getElementById('show-only-tasks')?.checked === true;
    const activeFilter = document.querySelector('.filter-chip.active')?.dataset.filter || 'all';
    const searchTerm = document.getElementById('tree-search')?.value.toLowerCase() || '';
    const collaboratorVal = document.getElementById('filter-collaborator-tree')?.value || '';
    const statusVal = document.getElementById('filter-status-tree')?.value || '';

    const filterNodes = (nodes) => {
        return nodes.map(node => {
            const children = node.children ? filterNodes(node.children) : [];
            const isDone = node.status === 'done';
            let visible = true;

            if (!showCompleted && isDone) visible = false;
            if (showOnlyTasks && node.item_type === 'attivita') visible = false;

            if (activeFilter === 'my') {
                const myId = window.state?.session?.user?.id;
                if (!node.pm_item_assignees?.some(a => a.user_ref === myId) && children.length === 0) visible = false;
            } else if (activeFilter === 'assigned') {
                if ((!node.pm_item_assignees || node.pm_item_assignees.length === 0) && children.length === 0) visible = false;
            }

            if (collaboratorVal && !node.pm_item_assignees?.some(a => a.user_ref === collaboratorVal) && children.length === 0) visible = false;
            if (statusVal && node.status !== statusVal && children.length === 0) visible = false;
            if (searchTerm && !node.title.toLowerCase().includes(searchTerm) && children.length === 0) visible = false;

            if (children.some(c => c._visible)) visible = true;
            return { ...node, children, _visible: visible };
        });
    };

    const filteredTree = filterNodes(tree);
    const isFlatSort = sort.column !== 'type';
    const shouldFlatten = view === 'kanban' || view === 'gantt' || isFlatSort || showOnlyTasks;

    if (shouldFlatten) {
        const flatList = [];
        const flatten = (nodes, depth = 0) => {
            nodes.forEach(node => {
                const isGantt = view === 'gantt';
                const passesFilters = (isGantt || showCompleted || node.status !== 'done') && (!showOnlyTasks || node.item_type !== 'attivita');
                let matchesSearch = true;
                if (statusVal && node.status !== statusVal) matchesSearch = false;
                if (collaboratorVal && !node.pm_item_assignees?.some(a => a.user_ref === collaboratorVal)) matchesSearch = false;
                if (searchTerm && !node.title.toLowerCase().includes(searchTerm)) matchesSearch = false;
                if (activeFilter === 'my' && !node.pm_item_assignees?.some(a => a.user_ref === window.state?.session?.user?.id)) matchesSearch = false;
                if (activeFilter === 'assigned' && (!node.pm_item_assignees || node.pm_item_assignees.length === 0)) matchesSearch = false;

                if (passesFilters && matchesSearch) {
                    flatList.push({ ...node, _depth: depth });
                }
                if (node.children) flatten(node.children, depth + 1);
            });
        };
        flatten(filteredTree);

        if (view === 'kanban') return renderKanbanView(flatList, allItems, spaceId);

        if (view === 'gantt') {
            // Gantt View
            setTimeout(async () => {
                const ganttArea = container.querySelector('#gantt-render-area');
                if (ganttArea) {
                    const { renderHubGantt } = await import('./hub_gantt.js?v=3000');
                    renderHubGantt(ganttArea, flatList, spaceId);
                }
            }, 0);
            return `<div id="gantt-render-area" style="flex: 1; height: 100%; width: 100%; min-width: 0; overflow: hidden;"></div>`;
        }

        flatList.sort((a, b) => {
            const valA = getSortValue(a, sort.column); const valB = getSortValue(b, sort.column);
            let res = valA < valB ? -1 : (valA > valB ? 1 : 0);
            if (res === 0) res = a.title.localeCompare(b.title);
            return sort.direction === 'asc' ? res : -res;
        });

        if (flatList.length === 0) return `<div style="text-align: center; padding: 3rem; color: var(--text-tertiary);">Nessun risultato trovato.</div>`;
        return `<div id="tree-content-scroll" style="overflow-x: auto; flex: 1;"><div style="min-width: 950px;">${renderTableHeader(sort)}<div id="tree-content">${renderTreeNodes(flatList, 0, spaceId, true, allItems, expandedNodes, sort)}</div></div></div>`;
    } else {
        const sortRecursive = (nodes) => {
            return [...nodes].sort((a, b) => {
                const valA = getSortValue(a, 'type'); const valB = getSortValue(b, 'type');
                let res = valA < valB ? -1 : (valA > valB ? 1 : 0);
                if (res === 0) res = a.title.localeCompare(b.title);
                return sort.direction === 'asc' ? res : -res;
            }).map(node => { if (node.children) node.children = sortRecursive(node.children); return node; });
        };
        const sortedTree = sortRecursive(filteredTree).filter(n => n._visible);
        if (sortedTree.length === 0) return `<div style="text-align: center; padding: 3rem; color: var(--text-tertiary);">Nessun risultato trovato.</div>`;
        return `<div id="tree-content-scroll" style="overflow-x: auto; flex: 1;"><div style="min-width: 950px;">${renderTableHeader(sort)}<div id="tree-content">${renderTreeNodes(sortedTree, 0, spaceId, false, allItems, expandedNodes, sort)}</div></div></div>`;
    }
}

function renderTableHeader(sort) {
    return `
        <div class="tree-header" style="display: flex; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid var(--surface-2); font-size: 0.7rem; color: var(--text-tertiary); font-weight: 800; text-transform: uppercase; background: white; position: sticky; top: 0; z-index: 5;">
            <div style="width: 24px;"></div>
            <div class="sortable-header" data-col="type" style="flex: 1; min-width: 250px; cursor: pointer; display: flex; align-items: center; gap: 4px;">Elemento <span class="material-icons-round" style="font-size: 13px;">${sort.column === 'type' ? (sort.direction === 'asc' ? 'expand_less' : 'expand_more') : ''}</span></div>
            <div style="width: 100px; text-align: center;">Team</div>
            <div class="sortable-header" data-col="priority" style="width: 110px; text-align: center; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">Priorità <span class="material-icons-round" style="font-size: 13px;">${sort.column === 'priority' ? (sort.direction === 'asc' ? 'expand_less' : 'expand_more') : ''}</span></div>
            <div class="sortable-header" data-col="due_date" style="width: 110px; text-align: center; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">Scadenza <span class="material-icons-round" style="font-size: 13px;">${sort.column === 'due_date' ? (sort.direction === 'asc' ? 'expand_less' : 'expand_more') : ''}</span></div>
            <div class="sortable-header" data-col="status" style="width: 130px; text-align: center; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">Stato <span class="material-icons-round" style="font-size: 13px;">${sort.column === 'status' ? (sort.direction === 'asc' ? 'expand_less' : 'expand_more') : ''}</span></div>
            <div style="width: 32px;"></div>
        </div>`;
}

function renderKanbanView(flatList, allItems, spaceId) {
    return `
        <div class="kanban-board">
            ${Object.entries(ITEM_STATUS).map(([key, cfg]) => {
        const colItems = flatList.filter(i => i.status === key);
        return `
                    <div class="kanban-column" data-status="${key}">
                        <div class="kanban-col-header" style="border-bottom: 2px solid ${cfg.color};">
                            <span>${cfg.label}</span>
                            <span style="background: ${cfg.color}20; color: ${cfg.color}; font-size: 0.75rem; padding: 2px 8px; border-radius: 12px;">${colItems.length}</span>
                        </div>
                        <div class="kanban-cards">
                            ${colItems.map(item => `
                                <div class="kanban-card" draggable="true" data-id="${item.id}">
                                    <div style="display: flex; align-items: flex-start; gap: 8px;">
                                        <span class="material-icons-round" style="font-size: 1rem; color: ${item.item_type === 'attivita' ? '#f59e0b' : 'var(--text-tertiary)'}; flex-shrink:0;">${item.item_type === 'attivita' ? 'folder' : 'check_circle_outline'}</span>
                                        <div style="flex:1; font-weight:700; font-size:0.85rem; line-height:1.4;">${item.title}</div>
                                    </div>
                                    ${item.parent_ref ? `<div style="font-size: 0.65rem; color: var(--text-tertiary); opacity: 0.8; display: flex; align-items: center; gap: 4px; margin-top: -3px;"><span class="material-icons-round" style="font-size: 0.75rem;">subdirectory_arrow_right</span>${allItems.find(i => i.id === item.parent_ref)?.title || '...'}</div>` : ''}
                                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                                        <div style="display: flex; align-items: center; gap: 0.6rem;">
                                            <span style="font-size: 0.6rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${ITEM_PRIORITY[item.priority]?.bg}; color: ${ITEM_PRIORITY[item.priority]?.color}; text-transform: uppercase;">${ITEM_PRIORITY[item.priority]?.label}</span>
                                            ${item.due_date ? `<span style="font-size: 0.7rem; color: ${new Date(item.due_date) < new Date() && item.status !== 'done' ? '#ef4444' : 'var(--text-tertiary)'}; font-weight: 700; display: flex; align-items: center; gap: 3px;"><span class="material-icons-round" style="font-size: 0.85rem;">event</span>${new Date(item.due_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>` : ''}
                                        </div>
                                    </div>
                                </div>`).join('')}
                        </div>
                    </div>`;
    }).join('')}
        </div>`;
}

function getSortValue(item, col) {
    if (col === 'priority') { const weight = { 'urgent': 0, 'high': 1, 'medium': 2, 'low': 3 }; return weight[item.priority] ?? 99; }
    if (col === 'due_date') return item.due_date ? new Date(item.due_date).getTime() : 9999999999999;
    if (col === 'status') { const weight = { 'blocked': 0, 'review': 1, 'in_progress': 2, 'todo': 3, 'done': 4 }; return weight[item.status] ?? 99; }
    if (col === 'type') return item.item_type === 'attivita' ? 0 : 1;
    return 0;
}

function renderTreeNodes(nodes, level, spaceId, isFlat = false, allItems, expandedNodes, sort) {
    return nodes.map(node => {
        if (!node._visible && !isFlat) return '';
        const statusInfo = ITEM_STATUS[node.status] || ITEM_STATUS['todo'];
        const priorityInfo = ITEM_PRIORITY[node.priority] || ITEM_PRIORITY['medium'];
        const isExpanded = expandedNodes.has(node.id);
        const hasChildren = !isFlat && node.children?.some(c => c._visible);

        return `
            <div class="tree-node ${isExpanded || isFlat ? '' : 'collapsed'}" data-id="${node.id}">
                <div class="tree-row" draggable="${sort?.column === 'type' ? 'true' : 'false'}" data-id="${node.id}" data-type="${node.item_type}">
                    <div class="tree-col-toggle" style="width: 24px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        ${hasChildren ? `<button class="tree-toggle"><span class="material-icons-round" style="font-size: 1.25rem;">expand_more</span></button>` : ''}
                    </div>
                    <div class="tree-col-title" style="flex: 1; min-width: 250px; display: flex; align-items: center; gap: 12px; ${node.status === 'done' ? 'opacity: 0.5;' : ''}">
                        <span class="material-icons-round" style="font-size: 1.15rem; color: ${node.item_type === 'attivita' ? '#f59e0b' : 'var(--text-tertiary)'}; flex-shrink:0;">${node.item_type === 'attivita' ? 'folder' : 'check_circle_outline'}</span>
                        <div style="display: flex; flex-direction: column; overflow: hidden;">
                            <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ${node.status === 'done' ? 'text-decoration: line-through;' : ''}">${node.title}</span>
                            ${isFlat && node.parent_ref ? `<span style="font-size: 0.7rem; color: var(--text-tertiary); opacity: 0.8; display: flex; align-items: center; gap: 4px;"><span class="material-icons-round" style="font-size: 0.8rem;">subdirectory_arrow_right</span>${allItems.find(i => i.id === node.parent_ref)?.title || '...'}</span>` : ''}
                        </div>
                    </div>
                    <div class="tree-col-team" style="width: 100px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"></div>
                    <div class="tree-col-priority" style="width: 110px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><span style="font-size: 0.6rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; background: ${priorityInfo.bg}; color: ${priorityInfo.color}; text-transform: uppercase;">${priorityInfo.label}</span></div>
                    <div class="tree-col-date" style="width: 110px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0;">${node.due_date ? new Date(node.due_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : '---'}</div>
                    <div class="tree-col-status" style="width: 130px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><span class="status-pill" style="color: ${statusInfo.color}; border: 1.5px solid ${statusInfo.color}30; background: ${statusInfo.color}05;">${statusInfo.label}</span></div>
                    <div class="tree-col-action" style="width: 32px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><button class="add-child-btn" data-parent="${node.id}" data-space="${spaceId}"><span class="material-icons-round" style="font-size: 1.25rem;">add</span></button></div>
                </div>
                ${hasChildren ? `<div class="tree-children">${renderTreeNodes(node.children, level + 1, spaceId, false, allItems, expandedNodes, sort)}</div>` : ''}
            </div>
        `;
    }).join('');
}

function setupBoardEventHandlers(container, items, spaceId, currentSort, currentView, onSortChange, onViewChange, expandedNodes, refreshBoard, space) {
    container.querySelectorAll('.view-btn').forEach(btn => btn.onclick = () => onViewChange(btn.dataset.view));
    container.querySelectorAll('.sortable-header').forEach(header => header.onclick = () => onSortChange(header.dataset.col));

    container.querySelectorAll('.tree-toggle').forEach(btn => btn.onclick = (e) => {
        e.stopPropagation();
        const nodeDiv = btn.closest('.tree-node');
        const id = nodeDiv.dataset.id;
        if (expandedNodes.has(id)) expandedNodes.delete(id);
        else expandedNodes.add(id);
        saveStoredState(spaceId, { view: currentView, sort: currentSort, expandedNodes });
        nodeDiv.classList.toggle('collapsed');
        refreshBoard();
    });

    if (currentView === 'kanban') {
        const cards = container.querySelectorAll('.kanban-card');
        const columns = container.querySelectorAll('.kanban-column');

        cards.forEach(card => {
            card.onclick = (e) => {
                // If it was a real click, not a drag-end
                import('/js/features/pm/components/hub_drawer.js?v=1000').then(mod => mod.openHubDrawer(card.dataset.id, spaceId));
            };

            card.onmousedown = () => card.style.cursor = 'grabbing';
            card.onmouseup = () => card.style.cursor = 'move';

            card.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', card.dataset.id);
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => card.classList.add('dragging'), 0);
            };
            card.ondragend = () => {
                card.classList.remove('dragging');
                columns.forEach(c => c.style.background = '');
            };
        });

        columns.forEach(col => {
            col.ondragover = (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                col.style.background = 'rgba(37, 99, 235, 0.08)';
            };
            col.ondragleave = () => {
                col.style.background = '';
            };
            col.ondrop = async (e) => {
                e.preventDefault();
                col.style.background = '';
                const id = e.dataTransfer.getData('text/plain');
                const newStatus = col.dataset.status;

                if (id && newStatus) {
                    try {
                        // Find current status for this item locally to avoid redundant updates
                        const item = items.find(i => i.id === id);
                        if (item && item.status === newStatus) return;

                        const { updatePMItem } = await import('../../../modules/pm_api.js?v=1000');
                        await updatePMItem(id, { status: newStatus });
                        document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { spaceId, action: 'update' } }));
                    } catch (err) {
                        console.error("Error in Kanban drop:", err);
                    }
                }
            };
        });
    } else {
        container.querySelectorAll('.tree-row').forEach(row => {
            row.onclick = (e) => { if (!e.target.closest('.tree-toggle') && !e.target.closest('.add-child-btn')) import('/js/features/pm/components/hub_drawer.js?v=1000').then(mod => mod.openHubDrawer(row.dataset.id, spaceId)); };

            // Re-implement Drag & Drop for Tree Hierarchy
            if (currentSort.column === 'type') {
                row.ondragstart = (e) => {
                    e.stopPropagation();
                    e.dataTransfer.setData('text/plain', row.dataset.id);
                    row.closest('.tree-node').classList.add('dragging');
                };
                row.ondragend = () => {
                    row.closest('.tree-node').classList.remove('dragging');
                    container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
                };
                row.ondragover = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const dragging = container.querySelector('.tree-node.dragging');
                    if (dragging && dragging.dataset.id !== row.dataset.id && !dragging.contains(row) && row.dataset.type === 'attivita') {
                        row.classList.add('drag-over');
                    }
                };
                row.ondragleave = () => row.classList.remove('drag-over');
                row.ondrop = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    row.classList.remove('drag-over');
                    const draggedId = e.dataTransfer.getData('text/plain');
                    if (draggedId && draggedId !== row.dataset.id) {
                        try {
                            const { updatePMItem } = await import('../../../modules/pm_api.js?v=1000');
                            await updatePMItem(draggedId, { parent_ref: row.dataset.id });
                            document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { spaceId, action: 'update' } }));
                        } catch (err) { console.error(err); }
                    }
                };
            }
        });
    }

    container.querySelectorAll('.add-child-btn').forEach(btn => btn.onclick = (e) => {
        e.stopPropagation();
        const menu = document.createElement('div');
        menu.className = 'hub-context-menu glass-card';
        menu.style.cssText = `position: absolute; z-index: 10000; padding: 4px; min-width: 110px; background: white; border: 1px solid var(--surface-2); border-radius: 8px; box-shadow: var(--shadow-lg);`;

        let menuHTML = `<div class="menu-item" data-type="attivita" style="padding:8px 12px; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; gap:8px;"><span class="material-icons-round" style="font-size:1.1rem; color:#f59e0b;">folder</span> Attività</div>
                        <div class="menu-item" data-type="task" style="padding:8px 12px; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; gap:8px;"><span class="material-icons-round" style="font-size:1.1rem; color:#3b82f6;">check_circle_outline</span> Task</div>`;

        if (space?.is_cluster) {
            menuHTML = `<div class="menu-item" data-type="project" style="padding:8px 12px; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; gap:8px; border-bottom:1px solid var(--surface-2); margin-bottom:4px;"><span class="material-icons-round" style="font-size:1.1rem; color:var(--brand-blue);">lan</span> Progetto</div>` + menuHTML;
        }

        menu.innerHTML = menuHTML;
        const rect = btn.getBoundingClientRect();
        menu.style.top = (window.scrollY + rect.bottom + 4) + 'px';
        menu.style.left = (window.scrollX + rect.left - 40) + 'px';
        document.body.appendChild(menu);

        menu.querySelectorAll('.menu-item').forEach(it => {
            it.onclick = async () => {
                const type = it.dataset.type;
                if (type === 'project') {
                    const { openNewProjectModal } = await import('./cluster_projects.js?v=2000');
                    openNewProjectModal(spaceId, () => {
                        // Projects tab is not visible here, but maybe we want to refresh something?
                        // Usually projects aren't in the tree yet if they are siblings, but here they are "children" of a cluster item?
                        // Wait, a project cannot be a child of an ITEM. It's a sibling of other items or child of a cluster SPACE.
                        // But the user clicked on an ITEM's "add-child" button.
                        // If it's a cluster, maybe they want to create a project inside the cluster.
                        // The cluster projects tab is better for this, but if they are in the board, they might expect it here too.
                    });
                } else {
                    import('./hub_drawer.js?v=1000').then(mod => mod.openHubDrawer(null, spaceId, btn.dataset.parent, type));
                }
                menu.remove();
            };
        });
        setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
    });

    container.querySelectorAll('.filter-chip').forEach(c => c.onclick = () => {
        container.querySelectorAll('.filter-chip').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        refreshBoard();
    });
    ['tree-search', 'show-completed', 'show-only-tasks'].forEach(id => container.querySelector('#' + id)?.addEventListener('change', refreshBoard));
    container.querySelector('#tree-search')?.addEventListener('input', refreshBoard);
    ['filter-collaborator-tree', 'filter-status-tree'].forEach(id => container.querySelector('#' + id)?.addEventListener('change', refreshBoard));
}

const ITEM_STATUS = {
    'todo': { label: 'Da Fare', color: '#64748b' },
    'in_progress': { label: 'In Corso', color: '#2563eb' },
    'blocked': { label: 'Bloccato', color: '#dc2626' },
    'review': { label: 'Revisione', color: '#d97706' },
    'done': { label: 'Completata', color: '#059669' }
};

const ITEM_PRIORITY = {
    'low': { label: 'Bassa', color: '#059669', bg: '#ecfdf5' },
    'medium': { label: 'Media', color: '#d97706', bg: '#fffbeb' },
    'high': { label: 'Alta', color: '#dc2626', bg: '#fef2f2' },
    'urgent': { label: 'Urgente', color: '#7c3aed', bg: '#f5f3ff' }
};
