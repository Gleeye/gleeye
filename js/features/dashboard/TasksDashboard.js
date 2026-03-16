import { supabase } from '../../modules/config.js';
import { state } from '../../modules/state.js';
import { showGlobalAlert, formatDate, renderAvatar } from '../../modules/utils.js?v=1000';
import { openHubDrawer } from '../pm/components/hub_drawer.js?v=1000';

// --- VISUAL CONSTANTS ---
const PRIORITY_ICONS = {
    'urgent': { icon: 'priority_high', color: '#ef4444' }, // Added Urgent
    'high': { icon: 'keyboard_double_arrow_up', color: '#f59e0b' },
    'medium': { icon: 'drag_handle', color: '#3b82f6' },
    'low': { icon: 'keyboard_arrow_down', color: '#64748b' }
};

const SPACE_COLORS = [
    '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899'
];

// --- MAIN COMPONENT ---
export class TasksDashboard {
    constructor(container) {
        this.container = container;
        this.state = {
            view: 'kanban', // 'kanban' | 'list'
            filterMode: 'my_tasks', // 'my_tasks' | 'delegated'
            priorityFilter: 'all', // 'all' | 'urgent' | 'high' | 'medium' | 'low'
            spaceTypeFilter: 'all', // 'all' | 'commessa' | 'interno'
            items: [],
            delegatedItems: [],
            spaces: {}, // Cache for space names
            isLoading: true
        };

        // Bind methods
        this.render = this.render.bind(this);
        this.fetchData = this.fetchData.bind(this);
        this.refresh = this.refresh.bind(this);
    }

    async init() {
        this.container.innerHTML = this.renderSkeleton();
        await this.fetchData();
        this.render();

        // Listen for global updates
        document.addEventListener('pm-item-changed', this.refresh);
    }

    destroy() {
        document.removeEventListener('pm-item-changed', this.refresh);
    }

    async refresh() {
        await this.fetchData();
        this.render();
    }

    // --- DATA LAYER ---
    async fetchData() {
        try {
            const user = state.session.user;
            if (!user) return;

            // 1. Fetch My Tasks (Assigned to me)
            const { data: myTasks, error: err1 } = await supabase
                .from('pm_items')
                .select(`
                    *,
                    space_ref ( id, name, type, ref_ordine ),
                    pm_item_assignees!inner ( user_ref )
                `)
                .eq('pm_item_assignees.user_ref', user.id)
                .neq('status', 'done')
                .neq('status', 'archived');

            if (err1) throw err1;

            // 2. Fetch Delegated Tasks (Created by me, assigned to others)
            const { data: createdByMe, error: err2 } = await supabase
                .from('pm_items')
                .select(`
                    *,
                    space_ref ( id, name, type, ref_ordine ),
                    pm_item_assignees ( user_ref, collaborator_ref )
                `)
                .eq('created_by_user_ref', user.id)
                .neq('status', 'done')
                .neq('status', 'archived');

            if (err2) throw err2;

            // Filter delegated: created by me AND I am NOT in assignees
            const delegated = createdByMe.filter(item => {
                const assignees = item.pm_item_assignees || [];
                return !assignees.some(a => a.user_ref === user.id);
            });

            this.state.items = myTasks || [];
            this.state.delegatedItems = delegated || [];

            // Extract spaces for color coding mapping
            const allItems = [...this.state.items, ...this.state.delegatedItems];
            allItems.forEach(i => {
                if (i.space_ref) {
                    this.state.spaces[i.space_ref.id] = i.space_ref;
                }
            });

            this.state.isLoading = false;
        } catch (err) {
            console.error("Dashboard Fetch Error:", err);
            showGlobalAlert('Errore caricamento task', 'error');
            this.state.isLoading = false;
        }
    }

    // --- FILTERING LOGIC ---
    getFilteredItems() {
        // Base list based on mode
        let list = this.state.filterMode === 'delegated' ? this.state.delegatedItems : this.state.items;
        
        // Priority Filter
        if (this.state.priorityFilter !== 'all') {
            list = list.filter(item => item.priority === this.state.priorityFilter);
        }

        // Space Type Filter
        if (this.state.spaceTypeFilter !== 'all') {
            list = list.filter(item => {
                const type = item.space_ref?.type;
                if (this.state.spaceTypeFilter === 'commessa') return type === 'commessa';
                if (this.state.spaceTypeFilter === 'interno') return type === 'interno';
                return true;
            });
        }

        return list;
    }

    // --- DATA CATEGORIZATION ---
    categorizeTasks(items) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const week = new Date(now);
        week.setDate(week.getDate() + 7);

        const buckets = { urgent: [], today: [], week: [], future: [] };

        items.forEach(i => {
            if (!i.due_date) {
                buckets.future.push(i);
                return;
            }
            const d = new Date(i.due_date);
            d.setHours(0, 0, 0, 0);

            if (d < now) buckets.urgent.push(i);
            else if (d.getTime() === now.getTime()) buckets.today.push(i);
            else if (d <= week) buckets.week.push(i);
            else buckets.future.push(i);
        });

        return buckets;
    }

    // --- RENDERERS ---

    renderSkeleton() {
        return `
            <div class="animate-pulse" style="width: 100%; max-width: 100%; margin: 0; padding: 1.5rem 2rem;">
                <div style="display: grid; grid-template-columns: 340px 1fr; gap: 1.25rem; height: calc(100vh - 130px);">
                    <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                        <div style="height: 250px; background: white; border-radius: 24px; border: 1px solid var(--surface-2);"></div>
                        <div style="height: 250px; background: white; border-radius: 24px; border: 1px solid var(--surface-2);"></div>
                    </div>
                    <div style="background: white; border-radius: 24px; border: 1px solid var(--surface-2);"></div>
                </div>
            </div>
        `;
    }

    render() {
        if (this.state.isLoading) return;

        // Categorize ALL items for sidebar counts (independent of priority/type filters to show overall picture)
        const myBuckets = this.categorizeTasks(this.state.items);
        const delBuckets = this.categorizeTasks(this.state.delegatedItems);

        const renderKpiRow = (label, icon, color, itemsCount) => {
            if (itemsCount === 0) return '';
            return `
                <div class="kpi-sub-row" style="display: grid; grid-template-columns: 24px 1fr auto; align-items: center; gap: 0.75rem; padding: 0.75rem 0.5rem; border-radius: 10px; transition: all 0.2s; width: 100%;">
                    <div style="display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons-round" style="font-size: 1.1rem; color: ${color};">${icon}</span>
                    </div>
                    <div style="font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${label}
                    </div>
                    <div style="display: flex; align-items: center;">
                        <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); background: rgba(0,0,0,0.06); padding: 0.15rem 0.6rem; border-radius: 20px; min-width: 24px; text-align: center;">${itemsCount}</span>
                    </div>
                </div>
            `;
        };

        this.container.innerHTML = `
            <div class="animate-fade-in tasks-dashboard-container" style="width: 100%; max-width: 100%; margin: 0; padding: 1.5rem 2rem;">
                
                <style>
                    @media (max-width: 1024px) {
                        .tasks-dashboard-container { padding: 1rem !important; }
                        .dashboard-grid-layout { grid-template-columns: 1fr !important; height: auto !important; gap: 1.5rem !important; }
                        .dashboard-grid-layout > .custom-scrollbar { overflow-y: visible !important; }
                        #tasks-right-panel { min-height: 500px; }
                        .kanban-board-grid { grid-auto-flow: row !important; grid-template-columns: 1fr !important; gap: 1rem !important; }
                        .filter-controls-row { flex-direction: column !important; align-items: stretch !important; }
                        .filter-controls-row > div { width: 100%; justify-content: space-between; }
                    }
                    .kpi-sub-row:hover { background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.05); transform: translateX(4px); }
                    .kpi-sub-row:not(:last-child) { border-bottom: 1px solid rgba(0,0,0,0.03); }
                    .view-btn { border: none; background: none; padding: 6px; border-radius: 6px; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; transition: all 0.2s; }
                    .view-btn.active { background: white; color: var(--brand-blue); box-shadow: var(--shadow-sm); border: 1px solid rgba(0,0,0,0.05); }
                    .view-btn:hover:not(.active) { background: rgba(0,0,0,0.05); }
                    
                    
                    /* Sidebar generic styles */
                    .clickable-header { cursor: pointer; border: 1px solid transparent; }
                    .clickable-header:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--glass-border); }
                    .clickable-header.selected { background: var(--glass-highlight); border: 1px solid var(--glass-border); box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }
                    
                    /* Sidebar Filter Button Styles */
                    .sidebar-filter-btn { border: 1px solid transparent; background: transparent; padding: 8px 12px; border-radius: 8px; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 0.85rem; font-weight: 500; transition: all 0.2s; width: 100%; text-align: left; }
                    .sidebar-filter-btn:hover { background: rgba(0,0,0,0.03); }
                    .sidebar-filter-btn.active { background: rgba(0, 102, 255, 0.05); color: var(--brand-blue); border: 1px solid rgba(0, 102, 255, 0.15); font-weight: 700; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }
                    
                    /* Task cards layout fixes */
                    .task-card-v2 { background: white; border-radius: 12px; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid var(--surface-2); cursor: pointer; transition: all 0.2s; position: relative; margin-bottom: 0.2rem; }
                    .task-card-v2:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--glass-border); }
                </style>
                
                <div class="dashboard-grid-layout" style="display: grid; grid-template-columns: 340px 1fr; gap: 1.25rem; align-items: stretch; height: calc(100vh - 130px);">
                    
                    <!-- LEFT COLUMN: KPIs & FILTERS -->
                    <div class="flex-column custom-scrollbar" style="gap: 1.25rem; overflow-y: auto; padding-right: 4px;">
                        
                        <!-- LE MIE TASK -->
                        <div class="glass-card flex-column clickable-header ${this.state.filterMode === 'my_tasks' ? 'selected' : ''}" 
                             onclick="window._dash.setMode('my_tasks')" 
                             style="padding: 1.25rem; gap: 1rem; border-top: 4px solid var(--brand-blue); transition: all 0.2s;">
                            
                            <div class="flex-between">
                                <div class="flex-start" style="gap: 1rem;">
                                    <div class="icon-container icon-info icon-container-sm" style="border-radius: 12px; background: rgba(0, 102, 255, 0.1); color: var(--brand-blue);">
                                        <span class="material-icons-round">assignment_ind</span>
                                    </div>
                                    <div class="flex-column">
                                        <span style="font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">Le Mie Task</span>
                                        <span style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary); line-height: 1;">${this.state.items.length}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="flex-column kpi-rows-wrapper" style="gap: 0.1rem; background: rgba(0,0,0,0.02); padding: 0.4rem; border-radius: 12px;">
                                ${renderKpiRow('Scadute / Urgenti', 'local_fire_department', '#ef4444', myBuckets.urgent.length)}
                                ${renderKpiRow('Oggi', 'bolt', '#f97316', myBuckets.today.length)}
                                ${renderKpiRow('Questa settimana', 'date_range', 'var(--brand-blue)', myBuckets.week.length)}
                            </div>
                        </div>

                        <!-- TASK DELEGATE -->
                        <div class="glass-card flex-column clickable-header ${this.state.filterMode === 'delegated' ? 'selected' : ''}" 
                             onclick="window._dash.setMode('delegated')" 
                             style="padding: 1.25rem; gap: 1rem; border-top: 4px solid var(--success-soft); transition: all 0.2s;">
                            
                            <div class="flex-between">
                                <div class="flex-start" style="gap: 1rem;">
                                    <div class="icon-container icon-success icon-container-sm" style="border-radius: 12px;">
                                        <span class="material-icons-round">send</span>
                                    </div>
                                    <div class="flex-column">
                                        <span style="font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">Task Delegate</span>
                                        <span style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary); line-height: 1;">${this.state.delegatedItems.length}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="flex-column kpi-rows-wrapper" style="gap: 0.1rem; background: rgba(0,0,0,0.02); padding: 0.4rem; border-radius: 12px;">
                                ${renderKpiRow('Scadute / Urgenti', 'local_fire_department', '#ef4444', delBuckets.urgent.length)}
                                ${renderKpiRow('Oggi', 'bolt', '#f97316', delBuckets.today.length)}
                                ${renderKpiRow('Questa settimana', 'date_range', 'var(--brand-blue)', delBuckets.week.length)}
                            </div>
                        </div>

                        <!-- FILTRI: PROGETTO -->
                        <div class="glass-card flex-column" style="padding: 1.25rem; gap: 0.75rem; border-left: 4px solid #94a3b8;">
                            <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Tipo Progetto</div>
                            <div class="flex-column" style="gap: 0.2rem;">
                                <button class="sidebar-filter-btn ${this.state.spaceTypeFilter === 'all' ? 'active' : ''}" onclick="window._dash.setSpaceTypeFilter('all')">
                                    <div style="display: flex; align-items: center; gap: 8px;"><span class="material-icons-round" style="font-size: 1rem;">workspaces</span> Tutti</div>
                                    ${this.state.spaceTypeFilter === 'all' ? '<span class="material-icons-round" style="font-size: 1rem;">check</span>' : ''}
                                </button>
                                <button class="sidebar-filter-btn ${this.state.spaceTypeFilter === 'commessa' ? 'active' : ''}" onclick="window._dash.setSpaceTypeFilter('commessa')">
                                    <div style="display: flex; align-items: center; gap: 8px;"><span class="material-icons-round" style="font-size: 1rem;">business_center</span> Solo Commesse</div>
                                    ${this.state.spaceTypeFilter === 'commessa' ? '<span class="material-icons-round" style="font-size: 1rem;">check</span>' : ''}
                                </button>
                                <button class="sidebar-filter-btn ${this.state.spaceTypeFilter === 'interno' ? 'active' : ''}" onclick="window._dash.setSpaceTypeFilter('interno')">
                                    <div style="display: flex; align-items: center; gap: 8px;"><span class="material-icons-round" style="font-size: 1rem;">apartment</span> Solo Interni</div>
                                    ${this.state.spaceTypeFilter === 'interno' ? '<span class="material-icons-round" style="font-size: 1rem;">check</span>' : ''}
                                </button>
                            </div>
                        </div>

                        <!-- FILTRI: PRIORITÀ -->
                        <div class="glass-card flex-column" style="padding: 1.25rem; gap: 0.75rem; border-left: 4px solid #94a3b8;">
                            <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Priorità</div>
                            <div class="flex-column" style="gap: 0.2rem;">
                                <button class="sidebar-filter-btn ${this.state.priorityFilter === 'all' ? 'active' : ''}" onclick="window._dash.setPriorityFilter('all')">
                                    <div style="display: flex; align-items: center; gap: 8px;"><span class="material-icons-round" style="font-size: 1rem;">list</span> Tutte le priorità</div>
                                    ${this.state.priorityFilter === 'all' ? '<span class="material-icons-round" style="font-size: 1rem;">check</span>' : ''}
                                </button>
                                <button class="sidebar-filter-btn ${this.state.priorityFilter === 'urgent' ? 'active' : ''}" onclick="window._dash.setPriorityFilter('urgent')">
                                    <div style="display: flex; align-items: center; gap: 8px; color: ${this.state.priorityFilter !== 'urgent' ? '#ef4444' : 'inherit'};"><span class="material-icons-round" style="font-size: 1rem;">priority_high</span> Urgente</div>
                                    ${this.state.priorityFilter === 'urgent' ? '<span class="material-icons-round" style="font-size: 1rem;">check</span>' : ''}
                                </button>
                                <button class="sidebar-filter-btn ${this.state.priorityFilter === 'high' ? 'active' : ''}" onclick="window._dash.setPriorityFilter('high')">
                                    <div style="display: flex; align-items: center; gap: 8px; color: ${this.state.priorityFilter !== 'high' ? '#f59e0b' : 'inherit'};"><span class="material-icons-round" style="font-size: 1rem;">keyboard_double_arrow_up</span> Alta</div>
                                    ${this.state.priorityFilter === 'high' ? '<span class="material-icons-round" style="font-size: 1rem;">check</span>' : ''}
                                </button>
                                <button class="sidebar-filter-btn ${this.state.priorityFilter === 'medium' ? 'active' : ''}" onclick="window._dash.setPriorityFilter('medium')">
                                    <div style="display: flex; align-items: center; gap: 8px; color: ${this.state.priorityFilter !== 'medium' ? '#3b82f6' : 'inherit'};"><span class="material-icons-round" style="font-size: 1rem;">drag_handle</span> Media</div>
                                    ${this.state.priorityFilter === 'medium' ? '<span class="material-icons-round" style="font-size: 1rem;">check</span>' : ''}
                                </button>
                                <button class="sidebar-filter-btn ${this.state.priorityFilter === 'low' ? 'active' : ''}" onclick="window._dash.setPriorityFilter('low')">
                                    <div style="display: flex; align-items: center; gap: 8px; color: ${this.state.priorityFilter !== 'low' ? '#64748b' : 'inherit'};"><span class="material-icons-round" style="font-size: 1rem;">keyboard_arrow_down</span> Bassa</div>
                                    ${this.state.priorityFilter === 'low' ? '<span class="material-icons-round" style="font-size: 1rem;">check</span>' : ''}
                                </button>
                            </div>
                        </div>

                    </div>

                    <!-- RIGHT COLUMN: MAIN CONTENT -->
                    <div id="tasks-right-panel" class="glass-card flex-column" style="padding: 1.25rem; gap: 1.25rem; height: 100%; position: relative; overflow: hidden; border-radius: 24px;">
                        
                        <!-- Header with Title & Toggles (Filters moved to sidebar) -->
                        <div class="flex-between filter-controls-row" style="flex-shrink: 0; padding-bottom: 0.5rem; border-bottom: 1px solid var(--glass-border); flex-wrap: wrap; gap: 1rem;">
                            
                            <!-- Title -->
                            <div class="flex-start" style="gap: 1rem;">
                                <div class="icon-container ${this.state.filterMode === 'my_tasks' ? 'icon-info' : 'icon-success'} icon-container-sm" style="border-radius: 12px; background: ${this.state.filterMode === 'my_tasks' ? 'rgba(0, 102, 255, 0.1)' : 'var(--success-bg)'}; color: ${this.state.filterMode === 'my_tasks' ? 'var(--brand-blue)' : 'var(--success-soft)'};">
                                    <span class="material-icons-round">${this.state.filterMode === 'my_tasks' ? 'assignment_ind' : 'send'}</span>
                                </div>
                                <div class="flex-column">
                                    <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px;">Vista Dettaglio</span>
                                    <span style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary);">${this.state.filterMode === 'my_tasks' ? 'Le Mie Task' : 'Task Delegate'}</span>
                                </div>
                            </div>
                            
                            <!-- View Controls -->
                            <div class="flex-start" style="gap: 0.75rem;">
                                <div style="display: flex; background: var(--glass-highlight); padding: 4px; border-radius: 10px; border: 1px solid var(--glass-border);">
                                    <button class="view-btn ${this.state.view === 'kanban' ? 'active' : ''}" onclick="window._dash.setView('kanban')" title="Vista a Colonne">
                                        <span class="material-icons-round" style="font-size: 1.1rem;">view_column</span>
                                    </button>
                                    <button class="view-btn ${this.state.view === 'list' ? 'active' : ''}" onclick="window._dash.setView('list')" title="Vista a Lista (Raggruppata per Progetto)">
                                        <span class="material-icons-round" style="font-size: 1.1rem;">view_list</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Content Area -->
                        <div id="dash-content-area" class="flex-column custom-scrollbar" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding-right: 4px;">
                            ${this.state.view === 'kanban' ? this.renderKanban() : this.renderList()}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Expose instance for inline clicks
        window._dash = {
            setView: (v) => { this.state.view = v; this.render(); },
            setMode: (m) => {
                this.state.filterMode = m; // 'my_tasks' | 'delegated'
                this.render();
            },
            setPriorityFilter: (p) => {
                this.state.priorityFilter = p;
                this.render();
            },
            setSpaceTypeFilter: (t) => {
                this.state.spaceTypeFilter = t;
                this.render();
            }
        };
    }

    renderKanban() {
        const filteredItems = this.getFilteredItems();
        const buckets = this.categorizeTasks(filteredItems);

        const renderColumn = (label, icon, color, itemsList) => {
            return `
                <div class="flex-column" style="gap: 0.75rem; min-width: 0; flex: 1; height: 100%; overflow: hidden; min-width: 250px;">
                    <div class="flex-between" style="padding: 0.5rem 0.75rem; background: var(--glass-highlight); border-radius: 12px; flex-shrink: 0; border: 1px solid var(--glass-border);">
                        <div class="flex-start" style="gap: 0.5rem;">
                            <span class="material-icons-round" style="font-size: 1.1rem; color: ${color};">${icon}</span>
                            <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">${label}</span>
                        </div>
                        <span class="badge badge-neutral" style="font-size: 0.75rem; padding: 0.2rem 0.5rem; background: white; font-weight: 700; border: 1px solid var(--glass-border);">${itemsList.length}</span>
                    </div>
                    <div class="flex-column custom-scrollbar" style="gap: 0.6rem; overflow-y: auto; overflow-x: hidden; flex: 1; padding-right: 4px; padding-bottom: 1rem;">
                        ${itemsList.map(i => this.renderCard(i)).join('')}
                        ${itemsList.length === 0 ? '<div style="padding: 2rem; text-align: center; color: var(--text-tertiary); font-style: italic; font-size: 0.85rem; background: var(--glass-highlight); border-radius: 16px;">Nessuna task</div>' : ''}
                    </div>
                </div>
            `;
        };

        return `
            <div class="kanban-board-grid" style="display: grid; grid-auto-flow: column; grid-auto-columns: minmax(250px, 1fr); gap: 1.25rem; height: 100%;">
                ${renderColumn('Scadute / Urgenti', 'local_fire_department', '#ef4444', buckets.urgent)}
                ${renderColumn('Oggi', 'bolt', '#f97316', buckets.today)}
                ${renderColumn('Questa settimana', 'date_range', 'var(--brand-blue)', buckets.week)}
                ${renderColumn('Futuro / Backlog', 'event_note', 'var(--text-tertiary)', buckets.future)}
            </div>
        `;
    }

    renderList() {
        const filteredItems = this.getFilteredItems();
        const groups = {};

        // Group by Space Name
        filteredItems.forEach(i => {
            const key = i.space_ref?.name || 'Senza Progetto';
            if (!groups[key]) groups[key] = [];
            groups[key].push(i);
        });

        const listKeys = Object.keys(groups).sort();

        return `
            <div style="display: flex; flex-direction: column; gap: 1.5rem; padding-bottom: 1rem;">
                ${listKeys.map(spaceName => `
                    <div class="glass-section" style="background: white; border-radius: 16px; border: 1px solid var(--surface-2); overflow: hidden;">
                        <div style="padding: 0.75rem 1rem; background: var(--glass-highlight); border-bottom: 1px solid var(--surface-2); font-weight: 800; font-size: 0.85rem; color: var(--text-primary); text-transform: uppercase;">
                            ${spaceName} <span style="color: var(--brand-blue); font-weight: 700; margin-left: 0.5rem; background: rgba(0, 102, 255, 0.1); padding: 2px 6px; border-radius: 8px;">${groups[spaceName].length}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; padding: 1rem;">
                            ${groups[spaceName].map(i => this.renderCard(i)).join('')}
                        </div>
                    </div>
                `).join('')}
                ${listKeys.length === 0 ? '<div style="padding: 3rem; text-align: center; color: var(--text-tertiary); font-style: italic; font-size: 0.9rem; background: var(--glass-highlight); border-radius: 16px;">Nessuna task in questa categoria</div>' : ''}
            </div>
        `;
    }

    renderCard(item) {
        // Priority
        const prio = PRIORITY_ICONS[item.priority] || PRIORITY_ICONS['medium'];

        // Date logic
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        let dateStr = '';
        let dateColor = 'var(--text-tertiary)';

        if (item.due_date) {
            const d = new Date(item.due_date);
            d.setHours(0, 0, 0, 0);
            dateStr = formatDate(item.due_date);
            if (d < now) dateColor = '#ef4444'; // Red
            else if (d.getTime() === now.getTime()) dateColor = '#f97316'; // Orange
        }

        // Space Color (deterministic hash)
        const spaceName = item.space_ref?.name || '---';
        const colorIdx = (spaceName.length + (item.space_ref?.id?.charCodeAt(0) || 0)) % SPACE_COLORS.length;
        const badgeColor = SPACE_COLORS[colorIdx];

        return `
        <div class="task-card-v2" onclick="window.openHubDrawer('${item.id}', '${item.space_ref?.id || ''}')">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                <span style="
                    font-size: 0.65rem; font-weight: 700; text-transform: uppercase; 
                    color: ${badgeColor}; background: ${badgeColor}15; 
                    padding: 3px 8px; border-radius: 6px; letter-spacing: 0.5px;
                ">${spaceName}</span>
                
                <span class="material-icons-round" style="font-size: 1.1rem; color: ${prio.color};" title="Priorità ${item.priority}">
                    ${prio.icon}
                </span>
            </div>
            
            <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 1rem; line-height: 1.35; font-size: 0.9rem;">
                ${item.title}
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
                <div style="display: flex; align-items: center; gap: 4px; color: ${dateColor}; font-weight: 600;">
                    <span class="material-icons-round" style="font-size: 1.05rem;">event</span>
                    ${dateStr || 'Senza data'}
                </div>
                
                <!-- Avatar Only if delegated to someone else -->
                ${this.state.filterMode === 'delegated' && item.pm_item_assignees?.length > 0 ? `
                    <div style="display: flex; gap: -5px;">
                        ${item.pm_item_assignees.map(a => `
                            <div style="width: 24px; height: 24px; border-radius: 50%; background: #e2e8f0; border: 1px solid white; margin-left: -5px;"></div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
        `;
    }
}

// Global quick-opener bridge
window.openHubDrawer = openHubDrawer;

/**
 * Global entry point for rendering the Tasks Dashboard in any container
 */
export async function renderMyWork(container) {
    container.innerHTML = `<div id="tasks-dashboard-container" style="min-height: 400px; padding: 0;"></div>`;
    const dashContainer = container.querySelector('#tasks-dashboard-container');
    const dashboard = new TasksDashboard(dashContainer);
    await dashboard.init();

    // Store in window for potential cleanup if needed, but router handles contentArea wipe
    window.__currentDashboard = dashboard;
}
