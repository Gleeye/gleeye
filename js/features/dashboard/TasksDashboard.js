import { supabase } from '../../modules/config.js';
import { state } from '../../modules/state.js';
import { showGlobalAlert, formatDate, renderAvatar } from '../../modules/utils.js?v=1000';
import { openHubDrawer } from '../pm/components/hub_drawer.js?v=1000';

// --- VISUAL CONSTANTS ---
const PRIORITY_CONFIG = {
    'urgent': { label: 'Urgente', icon: 'priority_high', color: '#ef4444', bg: '#fee2e2' },
    'high': { label: 'Alta', icon: 'keyboard_double_arrow_up', color: '#f59e0b', bg: '#fef3c7' },
    'medium': { label: 'Media', icon: 'drag_handle', color: '#3b82f6', bg: '#dbeafe' },
    'low': { label: 'Bassa', icon: 'keyboard_arrow_down', color: '#64748b', bg: '#f1f5f9' }
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
            groupBy: 'time', // 'time' | 'priority'
            filterMode: 'my_tasks', // 'my_tasks' | 'delegated'
            priorityFilter: 'all', // 'all' | 'urgent' | 'high' | 'medium' | 'low'
            spaceTypeFilter: 'all', // 'all' | 'commessa' | 'interno'
            items: [],
            delegatedItems: [],
            spaces: {},
            isLoading: true
        };

        this.render = this.render.bind(this);
        this.fetchData = this.fetchData.bind(this);
        this.refresh = this.refresh.bind(this);
    }

    async init() {
        this.container.innerHTML = this.renderSkeleton();
        await this.fetchData();
        this.render();
        document.addEventListener('pm-item-changed', this.refresh);
    }

    destroy() {
        document.removeEventListener('pm-item-changed', this.refresh);
    }

    async refresh() {
        await this.fetchData();
        this.render();
    }

    async fetchData() {
        try {
            const user = state.session.user;
            if (!user) return;

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

            const delegated = createdByMe.filter(item => {
                const assignees = item.pm_item_assignees || [];
                return !assignees.some(a => a.user_ref === user.id);
            });

            this.state.items = myTasks || [];
            this.state.delegatedItems = delegated || [];
            this.state.isLoading = false;
        } catch (err) {
            console.error("Dashboard Fetch Error:", err);
            showGlobalAlert('Errore caricamento task', 'error');
            this.state.isLoading = false;
        }
    }

    getFilteredItems() {
        let list = this.state.filterMode === 'delegated' ? this.state.delegatedItems : this.state.items;
        
        if (this.state.priorityFilter !== 'all') {
            list = list.filter(item => item.priority === this.state.priorityFilter);
        }

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

    categorizeByTime(items) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const week = new Date(now);
        week.setDate(week.getDate() + 7);

        const buckets = { urgent: [], today: [], week: [], future: [] };
        items.forEach(i => {
            if (!i.due_date) { buckets.future.push(i); return; }
            const d = new Date(i.due_date);
            d.setHours(0, 0, 0, 0);
            if (d < now) buckets.urgent.push(i);
            else if (d.getTime() === now.getTime()) buckets.today.push(i);
            else if (d <= week) buckets.week.push(i);
            else buckets.future.push(i);
        });
        return buckets;
    }

    categorizeByPriority(items) {
        const buckets = { urgent: [], high: [], medium: [], low: [], other: [] };
        items.forEach(i => {
            if (buckets[i.priority]) buckets[i.priority].push(i);
            else buckets.other.push(i);
        });
        return buckets;
    }

    renderSkeleton() {
        return `<div class="animate-pulse" style="padding: 1.5rem 2rem;"><div style="display: grid; grid-template-columns: 320px 1fr; gap: 1.25rem;"><div style="height: 600px; background: white; border-radius: 24px;"></div><div style="height: 600px; background: white; border-radius: 24px;"></div></div></div>`;
    }

    render() {
        if (this.state.isLoading) return;

        const filteredItems = this.getFilteredItems();
        const activeScopeItems = this.state.filterMode === 'my_tasks' ? this.state.items : this.state.delegatedItems;
        const activeScopeBuckets = this.categorizeByTime(activeScopeItems);
        
        const activeTitle = this.state.filterMode === 'my_tasks' ? 'Le Mie Task' : 'Task Delegate';
        const activeColor = this.state.filterMode === 'my_tasks' ? 'var(--brand-blue)' : 'var(--success-soft)';

        this.container.innerHTML = `
            <div class="animate-fade-in tasks-dashboard-container" style="width: 100%; padding: 1.5rem 2rem;">
                <style>
                    .tasks-sidebar { width: 320px; flex-shrink: 0; display: flex; flex-direction: column; gap: 1.25rem; }
                    .main-workspace { flex: 1; display: flex; flex-direction: column; gap: 1.25rem; min-width: 0; }
                    .context-toggle { display: flex; background: rgba(0,0,0,0.05); padding: 4px; border-radius: 12px; }
                    .context-btn { flex: 1; border: none; background: transparent; padding: 8px; border-radius: 8px; font-weight: 700; font-size: 0.8rem; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; color: var(--text-secondary); }
                    .context-btn.active { background: white; color: var(--brand-blue); box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
                    .context-btn.active.success { color: var(--success-soft); }
                    
                    .kpi-summary { background: white; border-top: 4px solid ${activeColor}; padding: 1.25rem; border-radius: 16px; box-shadow: var(--shadow-sm); }
                    .kpi-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.03); }
                    
                    .filter-group { background: white; padding: 1.25rem; border-radius: 16px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 0.5rem; }
                    .filter-title { font-size: 0.65rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; }
                    .filter-btn { border: 1px solid transparent; background: transparent; padding: 8px 12px; border-radius: 8px; font-size: 0.85rem; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: 0.2s; color: var(--text-secondary); }
                    .filter-btn:hover { background: rgba(0,0,0,0.03); }
                    .filter-btn.active { background: rgba(0,102,255,0.05); color: var(--brand-blue); border-color: rgba(0,102,255,0.1); font-weight: 700; }
                    
                    .view-toggle-pill { display: flex; background: rgba(0,0,0,0.05); padding: 4px; border-radius: 10px; }
                    .view-toggle-btn { border: none; background: transparent; padding: 6px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; color: var(--text-secondary); }
                    .view-toggle-btn.active { background: white; color: var(--brand-blue); box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

                    .task-card-new { background: white; border: 1px solid var(--surface-2); border-radius: 14px; padding: 1rem; cursor: pointer; transition: 0.2s; display: flex; flex-direction: column; gap: 0.75rem; }
                    .task-card-new:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); border-color: var(--brand-blue); }
                </style>

                <div style="display: flex; gap: 1.5rem; height: calc(100vh - 130px); align-items: stretch;">
                    
                    <!-- SIDEBAR PANEL -->
                    <div class="tasks-sidebar custom-scrollbar" style="overflow-y: auto;">
                        
                        <!-- Scope Switch -->
                        <div class="context-toggle">
                            <button class="context-btn ${this.state.filterMode === 'my_tasks' ? 'active' : ''}" onclick="window._dash.setMode('my_tasks')">
                                <span class="material-icons-round" style="font-size: 1rem;">assignment_ind</span> Mie Task
                            </button>
                            <button class="context-btn ${this.state.filterMode === 'delegated' ? 'active success' : ''}" onclick="window._dash.setMode('delegated')">
                                <span class="material-icons-round" style="font-size: 1rem;">send</span> Delegate
                            </button>
                        </div>

                        <!-- Dynamic Summary -->
                        <div class="kpi-summary flex-column">
                            <span class="filter-title" style="margin-bottom: 0.5rem;">Riepilogo Scadenze</span>
                            <div class="kpi-row">
                                <div class="flex-start" style="gap: 8px;"><span class="material-icons-round" style="color: #ef4444; font-size: 1.1rem;">local_fire_department</span> Scadute</div>
                                <span class="badge badge-neutral">${activeScopeBuckets.urgent.length}</span>
                            </div>
                            <div class="kpi-row">
                                <div class="flex-start" style="gap: 8px;"><span class="material-icons-round" style="color: #f97316; font-size: 1.1rem;">bolt</span> Oggi</div>
                                <span class="badge badge-neutral">${activeScopeBuckets.today.length}</span>
                            </div>
                            <div class="kpi-row">
                                <div class="flex-start" style="gap: 8px;"><span class="material-icons-round" style="color: var(--brand-blue); font-size: 1.1rem;">date_range</span> Settimana</div>
                                <span class="badge badge-neutral">${activeScopeBuckets.week.length}</span>
                            </div>
                        </div>

                        <!-- Filter: Progetto -->
                        <div class="filter-group">
                            <span class="filter-title">Profilo Progetto</span>
                            <button class="filter-btn ${this.state.spaceTypeFilter === 'all' ? 'active' : ''}" onclick="window._dash.setSpaceTypeFilter('all')"><span>Tutti</span> ${this.state.spaceTypeFilter === 'all' ? '<i class="material-icons-round" style="font-size:1rem;">check</i>' : ''}</button>
                            <button class="filter-btn ${this.state.spaceTypeFilter === 'commessa' ? 'active' : ''}" onclick="window._dash.setSpaceTypeFilter('commessa')"><span>Commesse</span> ${this.state.spaceTypeFilter === 'commessa' ? '<i class="material-icons-round" style="font-size:1rem;">check</i>' : ''}</button>
                            <button class="filter-btn ${this.state.spaceTypeFilter === 'interno' ? 'active' : ''}" onclick="window._dash.setSpaceTypeFilter('interno')"><span>Progetti Interni</span> ${this.state.spaceTypeFilter === 'interno' ? '<i class="material-icons-round" style="font-size:1rem;">check</i>' : ''}</button>
                        </div>

                        <!-- Filter: Priorità -->
                        <div class="filter-group">
                            <span class="filter-title">Priorità</span>
                            <button class="filter-btn ${this.state.priorityFilter === 'all' ? 'active' : ''}" onclick="window._dash.setPriorityFilter('all')"><span>Tutte</span> ${this.state.priorityFilter === 'all' ? '<i class="material-icons-round" style="font-size:1rem;">check</i>' : ''}</button>
                            ${Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => `
                                <button class="filter-btn ${this.state.priorityFilter === key ? 'active' : ''}" onclick="window._dash.setPriorityFilter('${key}')">
                                    <div class="flex-start" style="gap: 8px; color: ${this.state.priorityFilter === 'all' ? cfg.color : 'inherit'}">
                                        <i class="material-icons-round" style="font-size: 1rem;">${cfg.icon}</i> ${cfg.label}
                                    </div>
                                    ${this.state.priorityFilter === key ? '<i class="material-icons-round" style="font-size:1rem;">check</i>' : ''}
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <!-- MAIN CONTENT -->
                    <div class="main-workspace glass-card" style="padding: 1.25rem; background: white; border-radius: 24px;">
                        
                        <!-- Header -->
                        <div class="flex-between" style="padding-bottom: 1rem; border-bottom: 1px solid var(--surface-2);">
                            <div class="flex-column">
                                <span class="filter-title">Vista Workspace</span>
                                <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary);">${activeTitle}</h2>
                            </div>
                            
                            <div class="flex-start" style="gap: 1rem;">
                                <!-- Group Toggle -->
                                <div class="view-toggle-pill">
                                    <button class="view-toggle-btn ${this.state.groupBy === 'time' ? 'active' : ''}" onclick="window._dash.setGroupBy('time')" title="Ordina per Scadenza">
                                        <i class="material-icons-round" style="font-size: 1.1rem;">schedule</i>
                                    </button>
                                    <button class="view-toggle-btn ${this.state.groupBy === 'priority' ? 'active' : ''}" onclick="window._dash.setGroupBy('priority')" title="Ordina per Priorità">
                                        <i class="material-icons-round" style="font-size: 1.1rem;">priority_high</i>
                                    </button>
                                </div>

                                <!-- View Toggle -->
                                <div class="view-toggle-pill">
                                    <button class="view-toggle-btn ${this.state.view === 'kanban' ? 'active' : ''}" onclick="window._dash.setView('kanban')" title="Vista Colonne">
                                        <i class="material-icons-round" style="font-size: 1.1rem;">view_column</i>
                                    </button>
                                    <button class="view-toggle-btn ${this.state.view === 'list' ? 'active' : ''}" onclick="window._dash.setView('list')" title="Vista Lista">
                                        <i class="material-icons-round" style="font-size: 1.1rem;">view_list</i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Scroller Content -->
                        <div id="dash-scroll-area" class="flex-column custom-scrollbar" style="flex: 1; overflow-y: auto; overflow-x: hidden;">
                            ${this.state.view === 'kanban' ? this.renderKanban(filteredItems) : this.renderList(filteredItems)}
                        </div>
                    </div>
                </div>
            </div>
        `;

        window._dash = {
            setView: (v) => { this.state.view = v; this.render(); },
            setGroupBy: (g) => { this.state.groupBy = g; this.render(); },
            setMode: (m) => { this.state.filterMode = m; this.render(); },
            setPriorityFilter: (p) => { this.state.priorityFilter = p; this.render(); },
            setSpaceTypeFilter: (t) => { this.state.spaceTypeFilter = t; this.render(); }
        };
    }

    renderKanban(items) {
        const buckets = this.state.groupBy === 'time' ? this.categorizeByTime(items) : this.categorizeByPriority(items);
        
        const cols = this.state.groupBy === 'time' ? [
            { id: 'urgent', label: 'Scadute / Urgenti', icon: 'local_fire_department', color: '#ef4444' },
            { id: 'today', label: 'Per Oggi', icon: 'bolt', color: '#f97316' },
            { id: 'week', label: 'Prossimi Giorni', icon: 'date_range', color: 'var(--brand-blue)' },
            { id: 'future', label: 'Pianificate', icon: 'event_note', color: 'var(--text-tertiary)' }
        ] : [
            { id: 'urgent', label: 'Urgente', icon: 'priority_high', color: '#ef4444' },
            { id: 'high', label: 'Alta', icon: 'keyboard_double_arrow_up', color: '#f59e0b' },
            { id: 'medium', label: 'Media', icon: 'drag_handle', color: '#3b82f6' },
            { id: 'low', label: 'Bassa', icon: 'keyboard_arrow_down', color: '#64748b' }
        ];

        return `
            <div style="display: grid; grid-auto-flow: column; grid-auto-columns: minmax(280px, 1fr); gap: 1.25rem; height: 100%; padding: 1rem 0;">
                ${cols.map(c => `
                    <div class="flex-column" style="gap: 0.75rem; min-width: 0; min-height: 0;">
                        <div class="flex-between" style="padding: 0.5rem 0.2rem; border-bottom: 2px solid ${c.color}20;">
                            <div class="flex-start" style="gap: 8px;">
                                <i class="material-icons-round" style="color: ${c.color}; font-size: 1.1rem;">${c.icon}</i>
                                <span style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase;">${c.label}</span>
                            </div>
                            <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-tertiary);">${buckets[c.id]?.length || 0}</span>
                        </div>
                        <div class="flex-column custom-scrollbar" style="gap: 0.75rem; overflow-y: auto; overflow-x: hidden; flex: 1; padding: 2px;">
                            ${(buckets[c.id] || []).map(i => this.renderCard(i)).join('')}
                            ${!buckets[c.id] || buckets[c.id].length === 0 ? '<div style="padding: 1.5rem; text-align: center; color: var(--text-tertiary); font-size: 0.8rem; font-style: italic; background: rgba(0,0,0,0.02); border-radius: 12px; margin-top: 0.5rem;">Nessuna task</div>' : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderList(items) {
        const groups = {};
        items.forEach(i => {
            const key = i.space_ref?.name || 'Senza Progetto';
            if (!groups[key]) groups[key] = [];
            groups[key].push(i);
        });

        const sortedGroupKeys = Object.keys(groups).sort();

        return `
            <div style="display: flex; flex-direction: column; gap: 1.5rem; padding: 1rem 0;">
                ${sortedGroupKeys.map(spaceName => `
                    <div class="list-section">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 0.75rem;">
                            <span style="height: 12px; width: 4px; background: var(--brand-blue); border-radius: 10px;"></span>
                            <span style="font-weight: 800; font-size: 0.85rem; text-transform: uppercase; color: var(--text-primary);">${spaceName}</span>
                            <span class="badge badge-neutral" style="font-size: 0.7rem;">${groups[spaceName].length}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
                            ${groups[spaceName].map(i => this.renderCard(i)).join('')}
                        </div>
                    </div>
                `).join('')}
                ${items.length === 0 ? '<div style="padding: 3rem; text-align: center; color: var(--text-tertiary); font-style: italic;">Nessun risultato cercato</div>' : ''}
            </div>
        `;
    }

    renderCard(item) {
        const pr = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG['medium'];
        const spaceName = item.space_ref?.name || '---';
        const isInternal = item.space_ref?.type === 'interno';
        
        let dateColor = 'var(--text-tertiary)';
        let dateText = item.due_date ? formatDate(item.due_date) : 'Senza data';
        
        if (item.due_date) {
            const now = new Date(); now.setHours(0,0,0,0);
            const d = new Date(item.due_date); d.setHours(0,0,0,0);
            if (d < now) dateColor = '#ef4444';
            else if (d.getTime() === now.getTime()) { dateColor = '#f97316'; dateText = 'Oggi'; }
        }

        return `
            <div class="task-card-new" onclick="window.openHubDrawer('${item.id}', '${item.space_ref?.id || ''}')">
                <div class="flex-between">
                    <div class="flex-start" style="gap: 6px;">
                        <span style="font-size: 0.6rem; font-weight: 800; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: ${isInternal ? '#f1f5f9' : 'rgba(0,102,255,0.08)'}; color: ${isInternal ? '#64748b' : 'var(--brand-blue)'};">
                            ${isInternal ? 'INTERNO' : 'CLIENTE'}
                        </span>
                        <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${spaceName}</span>
                    </div>
                    <i class="material-icons-round" style="color: ${pr.color}; font-size: 1.1rem;" title="Priorità: ${pr.label}">${pr.icon}</i>
                </div>
                
                <div style="font-weight: 700; color: var(--text-primary); font-size: 0.9rem; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                    ${item.title}
                </div>
                
                <div class="flex-between" style="border-top: 1px dashed rgba(0,0,0,0.05); padding-top: 0.75rem;">
                    <div class="flex-start" style="gap: 4px; color: ${dateColor}; font-weight: 600; font-size: 0.75rem;">
                        <i class="material-icons-round" style="font-size: 0.9rem;">event</i> ${dateText}
                    </div>
                    ${this.state.filterMode === 'delegated' && item.pm_item_assignees?.length > 0 ? `
                        <div style="display: flex; gap: -4px; flex-direction: row-reverse;">
                            <div style="width: 20px; height: 20px; border-radius: 50%; background: #e2e8f0; border: 1.5px solid white;"></div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
}

// Global bridge
window.openHubDrawer = openHubDrawer;
export async function renderMyWork(container) {
    container.innerHTML = `<div id="tasks-dashboard-container" style="min-height: 400px; padding: 0;"></div>`;
    const dashboard = new TasksDashboard(container.querySelector('#tasks-dashboard-container'));
    await dashboard.init();
    window.__currentDashboard = dashboard;
}
