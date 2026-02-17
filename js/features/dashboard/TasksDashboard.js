import { supabase } from '../../modules/config.js';
import { state } from '../../modules/state.js';
import { showGlobalAlert, formatDate, renderAvatar } from '../../modules/utils.js?v=317';
import { openHubDrawer } from '../pm/components/hub_drawer.js?v=317';

// --- VISUAL CONSTANTS ---
const PRIORITY_ICONS = {
    'high': { icon: 'keyboard_double_arrow_up', color: '#ef4444' },
    'medium': { icon: 'drag_handle', color: '#f59e0b' },
    'low': { icon: 'keyboard_arrow_down', color: '#3b82f6' }
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
            filterMode: 'my_tasks', // 'my_tasks' | 'delegated' | 'all'
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
            // SQL note: "id NOT IN (select...)" is hard in simple JS client, 
            // but we can fetch "Created by me" and filter client side OR use a raw query if needed.
            // Let's fetch "Created by me" and then exclude those where I am an assignee.
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

    // --- KPI CALCULATION ---
    getKPIs() {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const all = this.state.items; // Only "My Tasks" count for personal KPIs usually

        const expired = all.filter(i => {
            if (!i.due_date) return false;
            return new Date(i.due_date) < now;
        }).length;

        const today = all.filter(i => {
            if (!i.due_date) return false;
            const d = new Date(i.due_date);
            d.setHours(0, 0, 0, 0);
            return d.getTime() === now.getTime();
        }).length;

        const delegated = this.state.delegatedItems.length;

        return { expired, today, delegated };
    }

    // --- RENDERERS ---

    renderSkeleton() {
        return `
            <div class="animate-pulse">
                <div style="height: 60px; background: #e2e8f0; border-radius: 12px; margin-bottom: 2rem;"></div>
                <div style="display: flex; gap: 1.5rem;">
                    <div style="flex:1; height: 400px; background: #f1f5f9; border-radius: 12px;"></div>
                    <div style="flex:1; height: 400px; background: #f1f5f9; border-radius: 12px;"></div>
                    <div style="flex:1; height: 400px; background: #f1f5f9; border-radius: 12px;"></div>
                    <div style="flex:1; height: 400px; background: #f1f5f9; border-radius: 12px;"></div>
                </div>
            </div>
        `;
    }

    render() {
        if (this.state.isLoading) return;

        const kpi = this.getKPIs();

        this.container.innerHTML = `
            <div class="tasks-dashboard fade-in">
                <!-- PULSE HEADER -->
                <div class="pulse-header glass-panel" style="
                    display: flex; justify-content: space-between; align-items: center; 
                    padding: 1rem 1.5rem; margin-bottom: 2rem; border-radius: 16px; 
                    background: white; box-shadow: var(--shadow-sm); border: 1px solid var(--surface-2);
                ">
                    <div style="display: flex; gap: 2rem;">
                        <!-- KPI: Expired -->
                        <div class="kpi-card ${kpi.expired > 0 ? 'active-red' : ''}" onclick="window._dash.setFilter('expired')" style="cursor: pointer; display: flex; align-items: center; gap: 0.75rem;">
                            <div style="
                                width: 40px; height: 40px; border-radius: 10px; 
                                background: ${kpi.expired > 0 ? '#fee2e2' : '#f1f5f9'}; 
                                color: ${kpi.expired > 0 ? '#ef4444' : '#94a3b8'};
                                display: flex; align-items: center; justify-content: center;
                                transition: all 0.2s;
                            ">
                                <span class="material-icons-round">local_fire_department</span>
                            </div>
                            <div>
                                <div style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); line-height: 1;">${kpi.expired}</div>
                                <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 500;">Scadute</div>
                            </div>
                        </div>

                        <!-- KPI: Today -->
                        <div class="kpi-card" onclick="window._dash.setFilter('today')" style="cursor: pointer; display: flex; align-items: center; gap: 0.75rem;">
                            <div style="
                                width: 40px; height: 40px; border-radius: 10px; 
                                background: ${kpi.today > 0 ? '#ffedd5' : '#f1f5f9'}; 
                                color: ${kpi.today > 0 ? '#f97316' : '#94a3b8'};
                                display: flex; align-items: center; justify-content: center;
                            ">
                                <span class="material-icons-round">bolt</span>
                            </div>
                            <div>
                                <div style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); line-height: 1;">${kpi.today}</div>
                                <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 500;">Oggi</div>
                            </div>
                        </div>

                        <!-- KPI: Delegated -->
                        <div class="kpi-card ${this.state.filterMode === 'delegated' ? 'active-blue' : ''}" onclick="window._dash.setMode('delegated')" style="cursor: pointer; display: flex; align-items: center; gap: 0.75rem; padding-left: 2rem; border-left: 1px solid var(--surface-2);">
                            <div style="
                                width: 40px; height: 40px; border-radius: 10px; 
                                background: #eff6ff; color: #3b82f6;
                                display: flex; align-items: center; justify-content: center;
                            ">
                                <span class="material-icons-round">send</span>
                            </div>
                            <div>
                                <div style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); line-height: 1;">${kpi.delegated}</div>
                                <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 500;">Delegate</div>
                            </div>
                        </div>
                    </div>

                    <!-- VIEW CONTROLS -->
                    <div style="display: flex; background: #f1f5f9; padding: 4px; border-radius: 10px;">
                        <button class="view-btn ${this.state.view === 'kanban' ? 'active' : ''}" onclick="window._dash.setView('kanban')">
                            <span class="material-icons-round">view_column</span>
                        </button>
                        <button class="view-btn ${this.state.view === 'list' ? 'active' : ''}" onclick="window._dash.setView('list')">
                            <span class="material-icons-round">view_list</span>
                        </button>
                    </div>
                </div>

                <!-- MAIN CONTENT -->
                <div id="dash-content-area">
                    ${this.state.view === 'kanban' ? this.renderKanban() : this.renderList()}
                </div>
            </div>

            <style>
                .view-btn {
                    border: none; background: none; padding: 6px; border-radius: 6px;
                    color: var(--text-secondary); cursor: pointer; display: flex;
                }
                .view-btn.active { background: white; color: var(--brand-blue); box-shadow: var(--shadow-sm); }
                .kpi-card:hover { transform: translateY(-1px); }
                .kpi-card.active-red div:first-child { box-shadow: 0 0 0 2px #fecaca; }
                .kpi-card.active-blue div:first-child { box-shadow: 0 0 0 2px #dbeafe; }
            </style>
        `;

        // Expose instance for inline clicks
        window._dash = {
            setView: (v) => { this.state.view = v; this.render(); },
            setMode: (m) => {
                this.state.filterMode = this.state.filterMode === m ? 'my_tasks' : m;
                this.render();
            },
            setFilter: (f) => {
                // Implement filter logic if needed, for now just reset to my_tasks
                this.state.filterMode = 'my_tasks';
                this.render();
            }
        };
    }

    renderKanban() {
        const items = this.state.filterMode === 'delegated' ? this.state.delegatedItems : this.state.items;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const week = new Date(now);
        week.setDate(week.getDate() + 7);

        // Buckets
        const buckets = {
            urgent: [], // < Today
            today: [],  // == Today
            week: [],   // <= Today + 7
            future: []  // > Today + 7 or Null
        };

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

        const colStyle = "flex: 1; min-width: 280px; display: flex; flex-direction: column; gap: 1rem;";
        const headStyle = "font-size: 0.9rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;";

        return `
            <div style="display: flex; gap: 1.5rem; overflow-x: auto; padding-bottom: 1rem;">
                <!-- URGENT -->
                <div style="${colStyle}">
                    <div style="${headStyle} color: #ef4444;">
                        <span class="material-icons-round">local_fire_department</span> Scadute / Urgenti
                        <span style="background: #fee2e2; color: #ef4444; padding: 2px 6px; border-radius: 8px; font-size: 0.75rem;">${buckets.urgent.length}</span>
                    </div>
                    ${buckets.urgent.map(i => this.renderCard(i)).join('')}
                    ${buckets.urgent.length === 0 ? this.renderEmpty('Nessuna urgenza') : ''}
                </div>

                <!-- TODAY -->
                <div style="${colStyle}">
                    <div style="${headStyle} color: #f97316;">
                        <span class="material-icons-round">bolt</span> Oggi
                        <span style="background: #ffedd5; color: #f97316; padding: 2px 6px; border-radius: 8px; font-size: 0.75rem;">${buckets.today.length}</span>
                    </div>
                    ${buckets.today.map(i => this.renderCard(i)).join('')}
                    ${buckets.today.length === 0 ? this.renderEmpty('Tutto fatto per oggi') : ''}
                </div>

                <!-- WEEK -->
                <div style="${colStyle}">
                    <div style="${headStyle} color: var(--brand-blue);">
                        <span class="material-icons-round">date_range</span> Questa settimana
                        <span style="background: #eff6ff; color: var(--brand-blue); padding: 2px 6px; border-radius: 8px; font-size: 0.75rem;">${buckets.week.length}</span>
                    </div>
                    ${buckets.week.map(i => this.renderCard(i)).join('')}
                </div>

                <!-- FUTURE -->
                <div style="${colStyle}">
                    <div style="${headStyle}">
                        <span class="material-icons-round">event_note</span> Futuro / Backlog
                        <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 8px; font-size: 0.75rem;">${buckets.future.length}</span>
                    </div>
                    ${buckets.future.map(i => this.renderCard(i)).join('')}
                </div>
            </div>
        `;
    }

    renderList() {
        // Group by Space Name
        const items = this.state.filterMode === 'delegated' ? this.state.delegatedItems : this.state.items;
        const groups = {};

        items.forEach(i => {
            const key = i.space_ref?.name || 'Senza Progetto';
            if (!groups[key]) groups[key] = [];
            groups[key].push(i);
        });

        return `
            <div style="display: flex; flex-direction: column; gap: 2rem;">
                ${Object.entries(groups).map(([spaceName, spaceItems]) => `
                    <div class="glass-section" style="background: white; border-radius: 12px; border: 1px solid var(--surface-2); overflow: hidden;">
                        <div style="padding: 1rem; background: #f8fafc; border-bottom: 1px solid var(--surface-2); font-weight: 600; font-size: 0.95rem; color: var(--text-primary);">
                            ${spaceName} <span style="color: var(--text-tertiary); font-weight: 400; margin-left: 0.5rem;">(${spaceItems.length})</span>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; padding: 1rem;">
                            ${spaceItems.map(i => this.renderCard(i)).join('')}
                        </div>
                    </div>
                `).join('')}
                ${items.length === 0 ? this.renderEmpty('Nessuna attività trovata') : ''}
            </div>
        `;
    }

    renderCard(item) {
        /*
          Design: 
          - Wrapper: white, shadow, radius, hover effect
          - Top: Badges (Space Name)
          - Mid: Title
          - Bottom: Meta (Date, Priority, Avatar if delegated)
          - Hover: Quick Actions overlay?
        */

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
        const spaceName = item.space_ref?.name || '...';
        const colorIdx = (spaceName.length + (item.space_ref?.id?.charCodeAt(0) || 0)) % SPACE_COLORS.length;
        const badgeColor = SPACE_COLORS[colorIdx];

        return `
        <div class="task-card-v2" 
             onclick="window.openHubDrawer('${item.id}', '${item.space_ref?.id}')"
             style="
                background: white; border-radius: 12px; padding: 1rem;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid var(--surface-2);
                cursor: pointer; transition: all 0.2s; position: relative;
             "
             onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-md)'"
             onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.05)'"
        >
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                <span style="
                    font-size: 0.7rem; font-weight: 700; text-transform: uppercase; 
                    color: ${badgeColor}; background: ${badgeColor}15; 
                    padding: 2px 8px; border-radius: 6px;
                ">${spaceName}</span>
                
                <span class="material-icons-round" style="font-size: 1.1rem; color: ${prio.color};" title="Priorità ${item.priority}">
                    ${prio.icon}
                </span>
            </div>
            
            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 1rem; line-height: 1.4;">
                ${item.title}
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
                <div style="display: flex; align-items: center; gap: 4px; color: ${dateColor}; font-weight: 500;">
                    <span class="material-icons-round" style="font-size: 1rem;">event</span>
                    ${dateStr || 'No data'}
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

    renderEmpty(msg) {
        return `
            <div style="text-align: center; padding: 2rem; border: 2px dashed #cbd5e1; border-radius: 12px; color: var(--text-tertiary);">
                <div style="margin-bottom: 0.5rem;">🍃</div>
                ${msg}
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
    container.innerHTML = `<div id="tasks-dashboard-container" style="min-height: 400px; padding: 1rem;"></div>`;
    const dashContainer = container.querySelector('#tasks-dashboard-container');
    const dashboard = new TasksDashboard(dashContainer);
    await dashboard.init();

    // Store in window for potential cleanup if needed, but router handles contentArea wipe
    window.__currentDashboard = dashboard;
}
