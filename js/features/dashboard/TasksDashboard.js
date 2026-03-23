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
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#8b5cf6'
];

const STATUS_ICONS = {
    'todo': { icon: 'circle', color: '#cbd5e1' },
    'doing': { icon: 'play_circle', color: '#3b82f6' },
    'blocked': { icon: 'error_outline', color: '#ef4444' },
    'review': { icon: 'visibility', color: '#f59e0b' }
};

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
            itemTypeFilter: 'all', // 'all' | 'task' | 'attivita' | 'milestone'
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
        
        // Priority Filter (Case-insensitive robust match)
        if (this.state.priorityFilter !== 'all') {
            const filterValue = this.state.priorityFilter.toLowerCase();
            list = list.filter(item => {
                const p = (item.priority || 'medium').toLowerCase();
                return p === filterValue;
            });
        }

        // Item Type Filter
        if (this.state.itemTypeFilter !== 'all') {
            list = list.filter(item => {
                const type = item.item_type || 'task';
                return type === this.state.itemTypeFilter;
            });
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

    categorizeByTime(items) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const week = new Date(now);
        week.setDate(week.getDate() + 7);

        const buckets = { working: [], urgent: [], today: [], week: [], future: [] };
        items.forEach(i => {
            // "In Corso" takes priority
            if (i.status === 'working' || i.status === 'doing' || i.status === 'in_progress') {
                buckets.working.push(i);
                return;
            }

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
        // Force strings to lowercase keys and handle nulls/unknowns
        const buckets = { urgent: [], high: [], medium: [], low: [] };
        items.forEach(i => {
            const p = (i.priority || 'medium').toLowerCase();
            if (buckets[p]) buckets[p].push(i);
            else buckets.medium.push(i); // Fallback to medium column
        });
        return buckets;
    }

    renderSkeleton() {
        return `<div class="animate-pulse" style="padding: 1.5rem 2rem;"><div style="display: grid; grid-template-columns: 320px 1fr; gap: 1.25rem;"><div style="height: 600px; background: white; border-radius: 24px;"></div><div style="height: 600px; background: white; border-radius: 24px;"></div></div></div>`;
    }

    render() {
        if (this.state.isLoading) return;

        const filteredItems = this.getFilteredItems();
        const activeTitle = this.state.filterMode === 'my_tasks' ? 'Miei Task' : 'Delegati';

        this.container.innerHTML = `
            <div class="tasks-clean-viewport">
                <style>
                    .tasks-clean-viewport { 
                        display: flex;
                        flex-direction: column;
                        height: calc(100vh - 100px); 
                        background: #fff;
                        font-family: 'Outfit', sans-serif;
                    }

                    /* --- HEADER & TOOLBAR --- */
                    .tasks-main-header {
                        padding: 1.5rem 2rem;
                        border-bottom: 1px solid #eee;
                        background: #fff;
                        display: flex;
                        flex-direction: column;
                        gap: 1.25rem;
                        flex-shrink: 0;
                    }

                    .header-top {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header-top h1 { margin: 0; font-size: 1.4rem; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }

                    .filter-bar {
                        display: flex;
                        align-items: center;
                        gap: 1.5rem;
                        flex-wrap: wrap;
                    }

                    .filter-group { display: flex; align-items: center; gap: 8px; }
                    .filter-label { font-size: 0.65rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }

                    .sub-pill-toggle { 
                        display: flex; 
                        background: #f1f5f9; 
                        padding: 2px; 
                        border-radius: 8px; 
                        border: 1px solid #e2e8f0;
                    }
                    .sub-pill-toggle button {
                        padding: 6px 14px;
                        border: none;
                        background: transparent;
                        font-family: inherit;
                        font-size: 0.75rem;
                        font-weight: 700;
                        color: #64748b;
                        border-radius: 6px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        transition: 0.15s;
                    }
                    .sub-pill-toggle button.active { 
                        background: #fff; 
                        color: var(--brand-blue); 
                        box-shadow: 0 1px 3px rgba(0,0,0,0.08); 
                    }
                    .sub-pill-toggle button:hover:not(.active) { color: #0f172a; background: rgba(255,255,255,0.5); }

                    /* --- WORKSPACE --- */
                    .kanban-view {
                        flex: 1;
                        padding: 1.5rem 2rem;
                        display: flex;
                        gap: 1.5rem;
                        overflow-x: auto;
                        background: #fdfdfd;
                    }

                    .kanban-col {
                        width: 320px;
                        flex-shrink: 0;
                        display: flex;
                        flex-direction: column;
                        gap: 1rem;
                    }
                    .kanban-col-head {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding-bottom: 10px;
                        border-bottom: 2px solid #f1f5f9;
                    }
                    .kanban-col-title { font-size: 0.8rem; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.02em; }
                    .kanban-col-count { font-size: 0.75rem; color: #94a3b8; font-weight: 600; background: #f1f5f9; padding: 2px 8px; border-radius: 6px; }

                    /* --- CARD --- */
                    .clean-task-card {
                        background: #fff;
                        border: 1px solid #e2e8f0;
                        border-radius: 12px;
                        padding: 1.1rem;
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                        cursor: pointer;
                        transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    .clean-task-card:hover { 
                        border-color: var(--brand-blue); 
                        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); 
                        transform: translateY(-2px);
                    }
                    .card-top { display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; font-weight: 600; color: #94a3b8; }
                    .card-body { font-size: 0.9rem; font-weight: 600; color: #1e293b; line-height: 1.4; }
                    .card-footer { display: flex; align-items: center; gap: 12px; border-top: 1px dashed #f1f5f9; padding-top: 10px; }
                    .card-meta { display: flex; align-items: center; gap: 4px; font-size: 0.72rem; font-weight: 600; color: #64748b; }
                </style>

                <header class="tasks-main-header">
                    <div class="header-top">
                        <h1>${activeTitle}</h1>
                        <div class="filter-group">
                            <button class="btn btn-primary" onclick="window.openHubDrawer('', '')" style="border-radius: 8px; font-weight: 700; height: 38px; padding: 0 16px;">
                                <i class="material-icons-round" style="font-size: 1.2rem;">add</i> Nuovo Task
                            </button>
                        </div>
                    </div>

                    <div class="filter-bar">
                        <div class="filter-group">
                            <span class="filter-label">Filtra</span>
                            <div class="sub-pill-toggle">
                                <button class="${this.state.filterMode === 'my_tasks' ? 'active' : ''}" onclick="window._dash.setMode('my_tasks')">Miei</button>
                                <button class="${this.state.filterMode === 'delegated' ? 'active' : ''}" onclick="window._dash.setMode('delegated')">Delegati</button>
                            </div>
                        </div>

                        <div class="filter-group">
                            <div class="sub-pill-toggle">
                                <button class="${this.state.itemTypeFilter === 'all' ? 'active' : ''}" onclick="window._dash.setItemTypeFilter('all')">Tutti</button>
                                <button class="${this.state.itemTypeFilter === 'task' ? 'active' : ''}" onclick="window._dash.setItemTypeFilter('task')">Task</button>
                                <button class="${this.state.itemTypeFilter === 'attivita' ? 'active' : ''}" onclick="window._dash.setItemTypeFilter('attivita')">Attività</button>
                            </div>
                        </div>

                        <div class="filter-group">
                            <div class="sub-pill-toggle">
                                <button class="${this.state.spaceTypeFilter === 'all' ? 'active' : ''}" onclick="window._dash.setSpaceTypeFilter('all')">Progetti</button>
                                <button class="${this.state.spaceTypeFilter === 'commessa' ? 'active' : ''}" onclick="window._dash.setSpaceTypeFilter('commessa')">Commesse</button>
                                <button class="${this.state.spaceTypeFilter === 'interno' ? 'active' : ''}" onclick="window._dash.setSpaceTypeFilter('interno')">Interni</button>
                            </div>
                        </div>

                        <div style="flex: 1;"></div>

                        <div class="filter-group">
                            <span class="filter-label">Vista</span>
                            <div class="sub-pill-toggle">
                                <button class="${this.state.groupBy === 'time' ? 'active' : ''}" onclick="window._dash.setGroupBy('time')">Tempo</button>
                                <button class="${this.state.groupBy === 'priority' ? 'active' : ''}" onclick="window._dash.setGroupBy('priority')">Priorità</button>
                            </div>
                        </div>

                        <div class="filter-group">
                            <div class="sub-pill-toggle">
                                <button class="${this.state.view === 'kanban' ? 'active' : ''}" onclick="window._dash.setView('kanban')"><i class="material-icons-round" style="font-size: 1.1rem;">view_kanban</i></button>
                                <button class="${this.state.view === 'list' ? 'active' : ''}" onclick="window._dash.setView('list')"><i class="material-icons-round" style="font-size: 1.1rem;">view_headline</i></button>
                            </div>
                        </div>
                    </div>
                </header>
                
                <main id="dash-scroll-area" class="kanban-view custom-scrollbar">
                    ${this.state.view === 'kanban' ? this.renderKanban(filteredItems) : this.renderList(filteredItems)}
                </main>
            </div>
        `;

        window._dash = {
            setView: (v) => { this.state.view = v; this.render(); },
            setGroupBy: (g) => { this.state.groupBy = g; this.render(); },
            setMode: (m) => { this.state.filterMode = m; this.render(); },
            setPriorityFilter: (p) => { this.state.priorityFilter = p; this.render(); },
            setItemTypeFilter: (t) => { this.state.itemTypeFilter = t; this.render(); },
            setSpaceTypeFilter: (s) => { this.state.spaceTypeFilter = s; this.render(); },
            resetFilters: () => {
                this.state.priorityFilter = 'all';
                this.state.spaceTypeFilter = 'all';
                this.state.itemTypeFilter = 'all';
                this.render();
            }
        };
    }

    renderKanban(items) {
        const buckets = this.state.groupBy === 'time' ? this.categorizeByTime(items) : this.categorizeByPriority(items);
        
        const cols = this.state.groupBy === 'time' ? [
            { id: 'working', label: 'In Corso', icon: 'play_circle_outline', color: '#3b82f6' },
            { id: 'urgent', label: 'Scaduti', icon: 'history', color: '#ef4444' },
            { id: 'today', label: 'Oggi', icon: 'bolt', color: '#f59e0b' },
            { id: 'week', label: 'Settimana', icon: 'calendar_today', color: '#3b82f6' }
        ] : [
            { id: 'urgent', label: 'Urgente', icon: 'priority_high', color: '#ef4444' },
            { id: 'high', label: 'Alta', icon: 'keyboard_double_arrow_up', color: '#f59e0b' },
            { id: 'medium', label: 'Media', icon: 'drag_handle', color: '#3b82f6' },
            { id: 'low', label: 'Bassa', icon: 'keyboard_arrow_down', color: '#64748b' }
        ];

        return `
            ${cols.map(c => {
                const colItems = buckets[c.id] || [];
                const activitesCount = colItems.filter(i => i.item_type === 'attivita').length;
                
                return `
                    <div class="kanban-col">
                        <div class="kanban-col-head">
                            <i class="material-icons-round" style="color: ${c.color}; font-size: 1.1rem;">${c.icon}</i>
                            <span class="kanban-col-title">${c.label}</span>
                            <span class="kanban-col-count" title="${activitesCount} attività">${colItems.length}</span>
                        </div>
                        <div class="stack custom-scrollbar" style="display: flex; flex-direction: column; gap: 0.75rem; overflow-y: auto;">
                            ${colItems.map(i => this.renderCard(i)).join('')}
                            ${colItems.length === 0 ? `
                                <div style="display:flex; justify-content:center; align-items:center; height:100px; color:#cbd5e1; font-size: 0.7rem; font-style:italic;">
                                    Tutto programmato
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
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
                            <span style="font-weight: 600; font-size: 0.85rem; text-transform: uppercase; color: var(--text-primary);">${spaceName}</span>
                            <span class="badge badge-neutral" style="font-size: 0.7rem; font-weight: 500;">${groups[spaceName].length}</span>
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
        const spaceName = item.space_ref?.name || 'Inbox';
        const isAttivita = item.item_type === 'attivita';
        const isWorking = item.status === 'working' || item.status === 'doing';
        
        let dateColor = '#94a3b8';
        let dateText = item.due_date ? formatDate(item.due_date) : '';
        
        if (item.due_date) {
            const now = new Date(); now.setHours(0,0,0,0);
            const d = new Date(item.due_date); d.setHours(0,0,0,0);
            if (d < now) dateColor = '#ef4444';
            else if (d.getTime() === now.getTime()) { dateColor = '#f59e0b'; dateText = 'Oggi'; }
        }

        const statusCfg = STATUS_ICONS[item.status] || STATUS_ICONS['todo'];

        return `
            <div class="clean-task-card" onclick="window.openHubDrawer('${item.id}', '${item.space_ref?.id || ''}')" style="${isAttivita ? 'border-left: 4px solid #10b981;' : ''}">
                <div class="card-top">
                    <div style="display: flex; align-items: center; gap: 4px;">
                        ${isAttivita ? '<i class="material-icons-round" style="font-size: 0.8rem; color: #10b981;">auto_awesome</i>' : ''}
                        <span style="${isAttivita ? 'color: #10b981; font-weight: 700;' : ''}">${spaceName}</span>
                    </div>
                    <i class="material-icons-round" style="color: ${pr.color}; font-size: 0.9rem;">${pr.icon}</i>
                </div>
                
                <div class="card-body" style="display: flex; flex-direction: column; gap: 4px;">
                    <span>${item.title}</span>
                    ${isWorking ? `
                        <div style="display: flex; align-items: center; gap: 4px; font-size: 0.65rem; color: #3b82f6; font-weight: 700;">
                            <span class="pulsing-dot" style="width: 6px; height: 6px; background: #3b82f6; border-radius: 50%;"></span>
                            IN CORSO
                        </div>
                    ` : ''}
                </div>

                <div class="card-footer">
                    <div class="card-meta">
                        <i class="material-icons-round" style="font-size: 0.9rem; color: ${statusCfg.color};">${statusCfg.icon}</i>
                        <span>${item.status}</span>
                    </div>
                    ${dateText ? `
                        <div class="card-meta" style="color: ${dateColor}; font-weight: 600;">
                            <i class="material-icons-round" style="font-size: 0.9rem;">event</i>
                            <span>${dateText}</span>
                        </div>
                    ` : ''}
                </div>
                
                <style>
                    .pulsing-dot { animation: pulse 1.5s infinite; }
                    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
                </style>
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
