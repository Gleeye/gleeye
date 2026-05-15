import { supabase } from '../../modules/config.js?v=8000';
import { state } from '../../modules/state.js?v=8000';
import { showGlobalAlert, formatDate } from '../../modules/utils.js?v=8000';
import { openHubDrawer } from '../pm/components/hub_drawer.js?v=8014';

// --- VISUAL CONSTANTS ---
const PRIORITY_CONFIG = {
    'urgent': { label: 'Urgente', icon: 'error_outline', color: '#ef4444', bg: '#fff5f5' },
    'high': { label: 'Alta', icon: 'keyboard_double_arrow_up', color: '#f59e0b', bg: '#fffbeb' },
    'medium': { label: 'Media', icon: 'drag_handle', color: '#4e92d8', bg: '#f0f7ff' },
    'low': { label: 'Bassa', icon: 'keyboard_arrow_down', color: '#6875ed', bg: '#f5f3ff' }
};

// --- MAIN COMPONENT ---
export class TasksDashboard {
    constructor(container) {
        this.container = container;
        this.state = {
            view: 'kanban',
            groupBy: 'time',
            filterMode: 'all', // 'all' | 'my_tasks' | 'delegated' | 'to_review' | 'as_responsible'
            spaceFilter: 'all', // 'all' | 'commessa' | 'interno'
            items: [],
            isLoading: true,
            activeBucket: null // For mobile view
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
        window.addEventListener('resize', this.render);
    }

    destroy() {
        document.removeEventListener('pm-item-changed', this.refresh);
        window.removeEventListener('resize', this.render);
    }

    async refresh() {
        await this.fetchData();
        this.render();
    }

    getTargetUserId() {
        if (state.impersonatedCollaboratorId) {
            const collab = (state.collaborators || []).find(c => c.id === state.impersonatedCollaboratorId);
            if (collab && collab.user_id) return collab.user_id;
        }
        return state.session?.user?.id;
    }

    getTargetAuthContext() {
        if (state.impersonatedRole === 'collaborator' && state.impersonatedCollaboratorId) {
             const collab = (state.collaborators || []).find(c => c.id === state.impersonatedCollaboratorId);
             if (collab) {
                 let tags = collab.tags || [];
                 if (typeof tags === 'string') {
                     try { tags = JSON.parse(tags); } catch (e) { tags = tags.split(',').map(t => t.trim()); }
                 }
                 return {
                     role: 'user',
                     tags: Array.isArray(tags) ? tags.map(t => t.toLowerCase()) : []
                 };
             }
        }
        return {
            role: state.profile?.role || 'user',
            tags: (state.profile?.tags || []).map(t => t.toLowerCase())
        };
    }

    async fetchData() {
        try {
            const targetUserId = this.getTargetUserId();
            if (!targetUserId) return;

            const selectQuery = `
                *,
                space_ref ( 
                    id, name, type, ref_ordine, is_cluster, parent_ref,
                    order:ref_ordine ( 
                        id, title, order_number, 
                        clients ( id, business_name, client_code ) 
                    ),
                    parent:parent_ref ( id, name )
                ),
                parent:parent_ref ( id, title ),
                pm_item_assignees( user_ref, role ),
                pm_item_incarichi ( incarico_ref )
            `;

            const { data, error } = await supabase
                .from('pm_items')
                .select(selectQuery)
                .neq('status', 'done')
                .neq('status', 'archived');
            
            if (error) throw error;

            this.state.items = data || [];
            this.state.isLoading = false;
        } catch (err) {
            console.error("Dashboard Fetch Error:", err);
            showGlobalAlert('Errore caricamento task', 'error');
            this.state.isLoading = false;
        }
    }

    async completeTask(id) {
        try {
            // Find element for animation
            const card = this.container.querySelector(`[data-task-id="${id}"]`);
            if (card) card.classList.add('task-completing');

            // Wait for animation to build anticipation
            await new Promise(r => setTimeout(r, 500));

            const { error } = await supabase
                .from('pm_items')
                .update({ status: 'done' })
                .eq('id', id);
            
            if (error) throw error;
            showGlobalAlert('Task completata!', 'success');
            
            // Remove locally for snappiness
            this.state.items = this.state.items.filter(i => i.id !== id);
            this.render();
            
            // Global events
            document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { id, type: 'task', action: 'completed' }}));
            if (window.updatePmList) window.updatePmList();

        } catch (err) {
            console.error("Complete Task Error:", err);
            showGlobalAlert('Errore completamento task', 'error');
            // Re-render to restore card if error
            this.render();
        }
    }

    getFilteredItems() {
        const targetUserId = this.getTargetUserId();
        if (!targetUserId) return [];

        let list = this.state.items;
        list = list.filter(item => (item.item_type || 'task') === 'task');

        if (this.state.spaceFilter !== 'all') {
            list = list.filter(item => (item.space_ref?.type || 'unknown') === this.state.spaceFilter);
        }

        // Helpers per match ruoli su pm_item_assignees (R-A-R)
        const isReviewerRole = (r) => {
            const v = (r || '').toLowerCase();
            return v === 'reviewer' || v === 'revisore' || v === 'review';
        };
        const isResponsibleRole = (r) => {
            const v = (r || '').toLowerCase();
            return v === 'responsible' || v === 'responsabile';
        };

        if (this.state.filterMode === 'my_tasks') {
            // Solo me: assignee unico O PM senza altri assegnatari (escludo revisori dal conteggio)
            list = list.filter(item => {
                const operatives = (item.pm_item_assignees || []).filter(a => !isReviewerRole(a.role));
                const isOnlyMe = operatives.length === 1 && operatives[0].user_ref === targetUserId;
                const isPmNoOperatives = item.pm_user_ref === targetUserId && operatives.length === 0;
                return isOnlyMe || isPmNoOperatives;
            });
        } else if (this.state.filterMode === 'delegated') {
            // PM/Creator + ci sono altri assegnatari operativi
            list = list.filter(item => {
                const isOwner = item.pm_user_ref === targetUserId || item.created_by_user_ref === targetUserId;
                const operatives = (item.pm_item_assignees || []).filter(a => !isReviewerRole(a.role));
                const hasOthers = operatives.some(a => a.user_ref !== targetUserId);
                return isOwner && hasOthers;
            });
        } else if (this.state.filterMode === 'to_review') {
            // Sono revisore di queste task (devo controllare)
            list = list.filter(item => {
                const assignees = item.pm_item_assignees || [];
                return assignees.some(a => a.user_ref === targetUserId && isReviewerRole(a.role));
            });
        } else if (this.state.filterMode === 'as_responsible') {
            // Sono responsabile (con potere decisionale) di queste task
            list = list.filter(item => {
                const assignees = item.pm_item_assignees || [];
                return assignees.some(a => a.user_ref === targetUserId && isResponsibleRole(a.role));
            });
        } else {
            // 'all': qualunque ruolo (assignee/responsible/reviewer/account) + PM + Creator
            list = list.filter(item => {
                const assignees = item.pm_item_assignees || [];
                const isAnyRole = assignees.some(a => a.user_ref === targetUserId);
                const isPm = item.pm_user_ref === targetUserId;
                const isCreator = item.created_by_user_ref === targetUserId;
                return isAnyRole || isPm || isCreator;
            });
        }

        return list;
    }

    categorizeByTime(items) {
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
        const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);

        const buckets = { urgent: [], today: [], tomorrow: [], week: [], future: [] };
        // LT-1: urgenti senza data → promosse nel bucket "urgent" (visibile)
        // invece che "future" (nascosto). Coerente con filosofia Davide:
        // "task urgenti senza data = da fare prima possibile se ho tempo libero".
        const isHighPriority = (p) => p === 'urgent' || p === 'high';
        items.forEach(i => {
            if (!i.due_date) {
                if (isHighPriority(i.priority)) buckets.urgent.push(i);
                else buckets.future.push(i);
                return;
            }
            const d = new Date(i.due_date); d.setHours(0, 0, 0, 0);
            const time = d.getTime();
             if (time < now.getTime()) buckets.urgent.push(i);
            else if (time === now.getTime()) buckets.today.push(i);
            else if (time === tomorrow.getTime()) buckets.tomorrow.push(i);
            else if (time <= weekEnd.getTime()) buckets.week.push(i);
            else buckets.future.push(i);
        });
        return buckets;
    }

    categorizeByPriority(items) {
        const buckets = { urgent: [], high: [], medium: [], low: [] };
        items.forEach(i => {
            const p = (i.priority || 'medium').toLowerCase();
            if (buckets[p]) buckets[p].push(i); else buckets.medium.push(i);
        });
        return buckets;
    }

    renderSkeleton() {
        return `
            <div class="animate-pulse" style="padding: 1.5rem 2rem;">
                <div style="height: 68px; background: white; border-radius: 22px; margin-bottom: 2rem; border: 1px solid #f1f5f9;"></div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem;">
                    <div style="height: 600px; background: rgba(255,255,255,0.5); border-radius: 24px; border: 1px solid #f1f5f9;"></div>
                    <div style="height: 600px; background: rgba(255,255,255,0.5); border-radius: 24px; border: 1px solid #f1f5f9;"></div>
                    <div style="height: 600px; background: rgba(255,255,255,0.5); border-radius: 24px; border: 1px solid #f1f5f9;"></div>
                    <div style="height: 600px; background: rgba(255,255,255,0.5); border-radius: 24px; border: 1px solid #f1f5f9;"></div>
                </div>
            </div>`;
    }

    render() {
        if (this.state.isLoading) return;

        const isMobile = window.innerWidth <= 768;
        let filteredItems = this.getFilteredItems();

        const pScore = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
        filteredItems.sort((a, b) => {
            if (a.due_date && b.due_date) {
                const da = new Date(a.due_date).getTime();
                const db = new Date(b.due_date).getTime();
                if (da !== db) return da - db;
            } else if (a.due_date) return -1; else if (b.due_date) return 1;
            const pa = pScore[a.priority?.toLowerCase()] || 2;
            const pb = pScore[b.priority?.toLowerCase()] || 2;
            return pb - pa;
        });

        const buckets = this.state.groupBy === 'time' ? this.categorizeByTime(filteredItems) : this.categorizeByPriority(filteredItems);
        const cols = this.state.groupBy === 'time' ? [
            { id: 'urgent', label: 'Scaduti', icon: 'history', color: '#ef4444' },
            { id: 'today', label: 'Oggi', icon: 'bolt', color: '#f59e0b' },
            { id: 'tomorrow', label: 'Domani', icon: 'schedule', color: '#3b82f6' },
            { id: 'week', label: 'Settimana', icon: 'calendar_today', color: '#8b5cf6' }
        ] : [
            { id: 'urgent', label: 'Urgente', icon: 'priority_high', color: '#ef4444' },
            { id: 'high', label: 'Alta', icon: 'keyboard_double_arrow_up', color: '#f59e0b' },
            { id: 'medium', label: 'Media', icon: 'drag_handle', color: '#3b82f6' },
            { id: 'low', label: 'Bassa', icon: 'keyboard_arrow_down', color: '#94a3b8' }
        ];

        if (isMobile && !this.state.activeBucket) {
            this.state.activeBucket = cols.find(c => buckets[c.id]?.length > 0)?.id || cols[0].id;
        }

        const ctx = this.getTargetAuthContext();
        const isAuthForDelegated = ctx.tags.includes('account') || ctx.tags.includes('project manager') || ctx.role === 'admin';

        this.container.innerHTML = `
            <div class="tasks-premium-viewport ${isMobile ? 'is-mobile' : ''}">
                <style>
                    .tasks-premium-viewport { 
                        display: flex; flex-direction: column; height: calc(100vh - 70px); background: #fafbfc; font-family: 'Plus Jakarta Sans', sans-serif; overflow: hidden; position: relative;
                    }
                    
                    /* EXTREME GLASS TOOLBAR (DESKTOP) */
                    .tasks-toolbar-wrapper {
                        padding: 16px 2rem 1rem 2rem; flex-shrink: 0; display: flex; justify-content: center; z-index: 1000;
                    }
                    .tasks-toolbar-glass {
                        width: 100%; max-width: 1400px; height: 60px; background: rgba(255, 255, 255, 0.5); backdrop-filter: blur(30px) saturate(210%); -webkit-backdrop-filter: blur(30px) saturate(210%); border: 1.2px solid rgba(0, 0, 0, 0.05); border-radius: 20px; display: flex; align-items: center; justify-content: space-between; padding: 0 1.25rem; box-shadow: 0 10px 30px rgba(0,0,0,0.03), inset 0 0 0 1.2px rgba(255,255,255,0.3);
                    }
                    
                    /* PILL TOGGLES */
                    .premium-pill-toggle { display: flex; background: rgba(0, 0, 0, 0.05); padding: 4px; border-radius: 12px; height: 38px; align-items: center; gap: 2px; }
                    .premium-pill-toggle button { padding: 0 12px; border: none; background: transparent; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.72rem; font-weight: 700; color: #697386; border-radius: 9px; cursor: pointer; display: flex; align-items: center; transition: all 0.3s; white-space: nowrap; height: 30px; border: 1px solid transparent; }
                    .premium-pill-toggle button.active { background: #fff; color: #1a1f36; border-color: rgba(0,0,0,0.02); box-shadow: 0 4px 10px rgba(0,0,0,0.05); transform: scale(1.01); }
                    .premium-pill-toggle button:hover:not(.active) { color: #4e92d8; }
                    
                    /* NEW TASK BUTTON (SIGNATURE) */
                    .nt-btn-premium { 
                        background: linear-gradient(135deg, #4e92d8 0%, #614aa2 100%) !important; color: white !important; font-family: 'Satoshi', sans-serif !important; border: none !important; padding: 10px 20px !important; border-radius: 10px !important; font-size: 0.8rem !important; font-weight: 700 !important; cursor: pointer !important; display: flex !important; align-items: center !important; gap: 8px !important; box-shadow: 0 6px 15px rgba(78, 146, 216, 0.15) !important; transition: all 0.3s !important;
                    }
                    .nt-btn-premium:hover { transform: translateY(-1.5px); box-shadow: 0 10px 22px rgba(78, 146, 216, 0.25); filter: brightness(1.05); }

                    /* KANBAN GRID (DESKTOP) */
                    .kanban-view:not(.is-mobile-view) { flex: 1; padding: 0rem 2rem 2rem 2rem; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; overflow: hidden; }
                    .kanban-col { display: flex; flex-direction: column; background: rgba(241, 245, 249, 0.5); border-radius: 20px; padding: 1.25rem; height: 100%; border: 1.2px solid rgba(255,255,255,0.7); overflow: hidden; }
                    .col-scroll-area { flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; padding: 4px; scrollbar-width: none; }
                    .kanban-col-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; font-family: 'Satoshi', sans-serif; }
                    .kanban-col-head .label { font-size: 0.88rem; font-weight: 700; color: #1a1f36; letter-spacing: -0.01em; }
                    .kanban-col-head .count { font-size: 0.72rem; font-weight: 800; color: #697386; background: #fff; padding: 2px 8px; border-radius: 6px; border: 1.2px solid #f1f5f9; }

                    /* TASK CARDS */
                    .premium-task-card { background: rgba(255, 255, 255, 0.92); backdrop-filter: blur(12px); border: 1.2px solid rgba(0,0,0,0.04); border-radius: 16px; padding: 1.15rem; display: flex; flex-direction: column; gap: 8px; cursor: pointer; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 4px 12px rgba(0,0,0,0.015); position: relative; overflow: hidden; }
                    
                    /* Type Accents - Vibrant Gradient Tints */
                    .premium-task-card.type-commessa { 
                        background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(219, 234, 254, 0.85));
                        border-color: rgba(59, 130, 246, 0.15); 
                    }
                    .premium-task-card.type-commessa:hover { 
                        background: linear-gradient(135deg, rgba(255, 255, 255, 1), rgba(191, 219, 254, 0.95));
                        border-color: rgba(59, 130, 246, 0.4); 
                        box-shadow: 0 8px 24px rgba(59, 130, 246, 0.15);
                    }
                    
                    .premium-task-card.type-interno { 
                        background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(238, 242, 255, 0.85));
                        border-color: rgba(99, 102, 241, 0.15); 
                    }
                    .premium-task-card.type-interno:hover { 
                        background: linear-gradient(135deg, rgba(255, 255, 255, 1), rgba(224, 231, 255, 0.95));
                        border-color: rgba(99, 102, 241, 0.4); 
                        box-shadow: 0 8px 24px rgba(99, 102, 241, 0.15);
                    }
                    
                    .premium-task-card:hover { transform: translateY(-2px) scale(1.01); }
                    .premium-task-card { min-height: 110px; }
                    .card-title { font-family: 'Satoshi', sans-serif; font-size: 0.95rem; font-weight: 700; color: #1a1f36; line-height: 1.3; margin: 0; padding-right: 30px; letter-spacing: -0.01em; flex: 1; }
                    .card-check-btn { position: absolute; top: 1.15rem; right: 1.15rem; width: 24px; height: 24px; border-radius: 50%; border: 1.5px solid #cbd5e1; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); background: rgba(255,255,255,0.8); color: #94a3b8; z-index: 10; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
                    .card-check-btn:hover { background: #10b981 !important; border-color: #10b981 !important; color: #fff !important; transform: scale(1.2) rotate(15deg); box-shadow: 0 8px 20px rgba(16,185,129,0.35); }
                    
                    /* COMPLETION ANIMATION */
                    @keyframes taskOutcome {
                        0% { transform: scale(1) translateY(0); opacity: 1; filter: blur(0); }
                        35% { transform: scale(1.02) translateY(-4px); opacity: 0.8; filter: blur(2px); }
                        100% { transform: scale(0.95) translateY(20px); opacity: 0; filter: blur(12px); }
                    }
                    .task-completing { animation: taskOutcome 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards; pointer-events: none; z-index: 9; }

                    .card-path { font-family: 'Plus Jakarta Sans', sans-serif !important; font-size: 0.58rem !important; font-weight: 500 !important; color: #94a3b8 !important; text-transform: uppercase !important; line-height: 1.4 !important; letter-spacing: 0.05em !important; margin-top: 2px; margin-bottom: 2px; }
                    .card-footer { display: flex; align-items: center; justify-content: space-between; border-top: 1.2px solid #f8fafc; padding-top: 10px; margin-top: 6px; }
                    .card-footer-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
                    .card-footer-right { display: flex; align-items: center; gap: 4px; flex-shrink: 0; white-space: nowrap; }
                    .meta-id { font-size: 0.65rem; font-weight: 800; color: #614aa2; font-family: 'Plus Jakarta Sans', sans-serif; letter-spacing: 0.02em; }
                    .meta-client { font-size: 0.65rem; font-weight: 500; color: #697386; text-transform: uppercase; font-family: 'Plus Jakarta Sans', sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; }
                    .meta-date { font-size: 0.72rem; font-weight: 800; font-family: 'Plus Jakarta Sans', sans-serif; white-space: nowrap; }
                    
                    /* MOBILE */
                    .tasks-premium-viewport.is-mobile { background: #fafbfc; height: 100vh; }
                    .is-mobile .mobile-scroll-container { 
                        flex: 1; overflow-y: scroll; -webkit-overflow-scrolling: touch; padding: 20px 1.25rem 240px 1.25rem; display: flex; flex-direction: column; gap: 14px;
                    }

                    /* FIXED BOTTOM NAV */
                    .is-mobile .bottom-nav-container {
                        position: fixed; bottom: 0; left: 0; width: 100%; z-index: 5000;
                        background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(40px) saturate(230%); -webkit-backdrop-filter: blur(40px) saturate(230%); border-top: 1.2px solid rgba(0, 0, 0, 0.06); 
                        padding: 16px 1.25rem calc(16px + env(safe-area-inset-bottom, 0px)) 1.25rem; box-shadow: 0 -20px 50px rgba(0,0,0,0.12);
                        display: flex; flex-direction: column; gap: 14px; border-radius: 32px 32px 0 0;
                    }
                    .is-mobile .bucket-nav { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; width: 100%; }
                    .is-mobile .bucket-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 4px; border-radius: 20px; background: #f8fafc; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); border: 1px solid #f1f5f9; width: 100%; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
                    .is-mobile .bucket-btn.active { background: #fff !important; border-color: rgba(78, 146, 216, 0.2); box-shadow: 0 10px 25px rgba(0,0,0,0.08); transform: translateY(-3px); }
                    .is-mobile .bucket-count { font-size: 1.45rem; font-weight: 800; line-height: 1; margin-bottom: 3px; font-family: 'Satoshi', sans-serif; letter-spacing: -0.01em; }
                    .is-mobile .btn-label { font-size: 0.6rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; font-family: 'Plus Jakarta Sans', sans-serif; }
                    .is-mobile .bucket-btn.active .btn-label { color: #1a1f36; opacity: 1; }
                    
                    .is-mobile .lower-controls-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; }
                    .is-mobile .mobile-toggles-row { flex: 1; display: flex; gap: 4px; min-width: 0; align-items: center; background: rgba(0,0,0,0.05); padding: 5px; border-radius: 16px; }
                    .is-mobile .mobile-fab { width: 52px; height: 52px; border-radius: 18px; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 20px rgba(0,0,0,0.25); border: none; flex-shrink: 0; cursor: pointer; transform: scale(1); transition: all 0.2s; }
                    .is-mobile .mobile-fab:active { transform: scale(0.92); }
                    .is-mobile .premium-pill-toggle { height: 38px; padding: 2px; background: transparent; gap: 1px; flex: 1; box-shadow: none; border: none; }
                    .is-mobile .premium-pill-toggle button { padding: 0; height: 34px; border-radius: 12px; flex: 1; }
                    .is-mobile .premium-pill-toggle button.active { background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
                    
                    /* ELITE CARDS */
                    .premium-task-card { border: none !important; box-shadow: 0 2px 8px rgba(0,0,0,0.03) !important; background: white !important; }
                    .premium-task-card:hover { transform: none !important; }
                    .card-check-btn { border-color: #f1f5f9 !important; background: #f8fafc !important; }
                </style>

                ${!isMobile ? `
                <div class="tasks-toolbar-wrapper">
                    <div class="tasks-toolbar-glass">
                        <div style="display: flex; gap: 1.5rem; align-items: center;">
                            <div class="premium-pill-toggle">
                                <button class="${this.state.groupBy === 'time' ? 'active' : ''}" onclick="window._dash.setGroupBy('time')"><span class="material-icons-round">schedule</span></button>
                                <button class="${this.state.groupBy === 'priority' ? 'active' : ''}" onclick="window._dash.setGroupBy('priority')"><span class="material-icons-round">segment</span></button>
                            </div>
                            <div class="premium-pill-toggle">
                                <button class="${this.state.filterMode === 'all' ? 'active' : ''}" onclick="window._dash.setMode('all')" title="Tutto quello che mi tocca"><span class="material-icons-round">public</span></button>
                                <button class="${this.state.filterMode === 'my_tasks' ? 'active' : ''}" onclick="window._dash.setMode('my_tasks')" title="Le mie task individuali"><span class="material-icons-round">person</span></button>
                                <button class="${this.state.filterMode === 'as_responsible' ? 'active' : ''}" onclick="window._dash.setMode('as_responsible')" title="Sono responsabile"><span class="material-icons-round">verified</span></button>
                                <button class="${this.state.filterMode === 'to_review' ? 'active' : ''}" onclick="window._dash.setMode('to_review')" title="Devo revisionare"><span class="material-icons-round">rate_review</span></button>
                                <button class="${this.state.filterMode === 'delegated' ? 'active' : ''}" onclick="window._dash.setMode('delegated')" title="Ho delegato a qualcuno"><span class="material-icons-round">share</span></button>
                            </div>
                            <div class="premium-pill-toggle">
                                <button class="${this.state.spaceFilter === 'all' ? 'active' : ''}" onclick="window._dash.setSpaceFilter('all')"><span class="material-icons-round">layers</span></button>
                                <button class="${this.state.spaceFilter === 'commessa' ? 'active' : ''}" onclick="window._dash.setSpaceFilter('commessa')"><span class="material-icons-round">business</span></button>
                                <button class="${this.state.spaceFilter === 'interno' ? 'active' : ''}" onclick="window._dash.setSpaceFilter('interno')"><span class="material-icons-round">home</span></button>
                            </div>
                        </div>
                        <button class="nt-btn-premium" onclick="window.openHubDrawer('', '')"><i class="material-icons-round" style="font-size: 1.1rem;">add</i> NUOVA TASK</button>
                    </div>
                </div>
                ` : ''}

                <div class="${isMobile ? 'mobile-scroll-container custom-scrollbar' : 'kanban-view'}">
                    ${isMobile ? `
                        ${(buckets[this.state.activeBucket] || []).map(i => this.renderCard(i)).join('')}
                        ${!buckets[this.state.activeBucket]?.length ? `
                            <div style="padding: 12rem 0; text-align: center; color: #94a3b8; font-family: 'Outfit', sans-serif; display: flex; flex-direction: column; align-items: center; gap: 16px;">
                                <span class="material-icons-round" style="font-size: 4rem; opacity: 0.1;">task_alt</span>
                                <div style="font-size: 1.1rem; font-weight: 700; color: #cbd5e1;">Tutto programmato</div>
                                <div style="font-size: 0.85rem; font-weight: 500; opacity: 0.6; max-width: 200px;">Ottimo lavoro! Non ci sono task urgenti in questa sezione.</div>
                            </div>` : ''}
                    ` : this.renderKanban(buckets, cols)}
                </div>

                ${isMobile ? `
                <div class="bottom-nav-container">
                    <div class="bucket-nav">
                        ${cols.map(c => `
                            <button class="bucket-btn ${this.state.activeBucket === c.id ? 'active' : ''}" onclick="window._dash.setBucket('${c.id}')">
                                <div class="bucket-count" style="color: ${c.color}">${buckets[c.id]?.length || 0}</div>
                                <span class="btn-label" style="${this.state.activeBucket === c.id ? 'color:#1e293b' : ''}">${c.label}</span>
                            </button>
                        `).join('')}
                    </div>
                    <div class="lower-controls-bar">
                         <div class="mobile-toggles-row">
                            <div class="premium-pill-toggle" style="flex-shrink:0;">
                                <button class="${this.state.groupBy === 'time' ? 'active' : ''}" onclick="window._dash.setGroupBy('time')"><span class="material-icons-round" style="font-size:18px;">schedule</span></button>
                                <button class="${this.state.groupBy === 'priority' ? 'active' : ''}" onclick="window._dash.setGroupBy('priority')"><span class="material-icons-round" style="font-size:18px;">segment</span></button>
                            </div>
                            <div class="premium-pill-toggle" style="flex:1;">
                                <button class="${this.state.filterMode === 'all' ? 'active' : ''}" onclick="window._dash.setMode('all')" style="flex:1;" title="Tutto"><span class="material-icons-round" style="font-size:18px;">public</span></button>
                                <button class="${this.state.filterMode === 'my_tasks' ? 'active' : ''}" onclick="window._dash.setMode('my_tasks')" style="flex:1;" title="Le mie"><span class="material-icons-round" style="font-size:18px;">person</span></button>
                                <button class="${this.state.filterMode === 'as_responsible' ? 'active' : ''}" onclick="window._dash.setMode('as_responsible')" style="flex:1;" title="Responsabile"><span class="material-icons-round" style="font-size:18px;">verified</span></button>
                                <button class="${this.state.filterMode === 'to_review' ? 'active' : ''}" onclick="window._dash.setMode('to_review')" style="flex:1;" title="Da revisionare"><span class="material-icons-round" style="font-size:18px;">rate_review</span></button>
                                <button class="${this.state.filterMode === 'delegated' ? 'active' : ''}" onclick="window._dash.setMode('delegated')" style="flex:1;" title="Delegate"><span class="material-icons-round" style="font-size:18px;">share</span></button>
                            </div>
                            <div class="premium-pill-toggle" style="flex:1;">
                                <button class="${this.state.spaceFilter === 'all' ? 'active' : ''}" onclick="window._dash.setSpaceFilter('all')" style="flex:1;"><span class="material-icons-round" style="font-size:18px;">layers</span></button>
                                <button class="${this.state.spaceFilter === 'commessa' ? 'active' : ''}" onclick="window._dash.setSpaceFilter('commessa')" style="flex:1;"><span class="material-icons-round" style="font-size:18px;">business</span></button>
                                <button class="${this.state.spaceFilter === 'interno' ? 'active' : ''}" onclick="window._dash.setSpaceFilter('interno')" style="flex:1;"><span class="material-icons-round" style="font-size:18px;">home</span></button>
                            </div>
                         </div>
                         <button class="mobile-fab" onclick="window.openHubDrawer('', '')"><span class="material-icons-round">add</span></button>
                    </div>
                </div>
                ` : ''}
            </div>
        `;

        window._dash = {
            setGroupBy: (g) => { this.state.groupBy = g; this.state.activeBucket = null; this.render(); },
            setMode: (m) => { this.state.filterMode = m; this.render(); },
            setSpaceFilter: (s) => { this.state.spaceFilter = s; this.render(); },
            setBucket: (b) => { this.state.activeBucket = b; this.render(); },
            completeTask: (id) => { this.completeTask(id); }
        };
    }

    renderKanban(buckets, cols) {
        return cols.map(c => `
            <div class="kanban-col">
                <div class="kanban-col-head">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="material-icons-round" style="color: ${c.color}; font-size: 1.25rem;">${c.icon}</i>
                        <span class="label">${c.label}</span>
                    </div>
                    <span class="count">${buckets[c.id]?.length || 0}</span>
                </div>
                <div class="col-scroll-area custom-scrollbar">
                    ${(buckets[c.id] || []).map(i => this.renderCard(i)).join('')}
                    ${!buckets[c.id]?.length ? `
                        <div style="padding: 6rem 0; text-align: center; color: #e2e8f0; font-family: 'Outfit', sans-serif; display: flex; flex-direction: column; align-items: center; gap: 12px;">
                            <span class="material-icons-round" style="font-size: 3rem; opacity: 0.2;">auto_awesome</span>
                            <div style="font-size: 0.85rem; font-weight: 700;">Nessuna attività</div>
                        </div>` : ''}
                </div>
            </div>
        `).join('');
    }

    renderCard(item) {
        const pr = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG['medium'];
        const isWorking = item.status === 'working' || item.status === 'doing';
        const spaceRef = item.space_ref;
        
        let pathParts = [];
        if (spaceRef?.type === 'commessa') {
            const orderTitle = spaceRef?.order?.title;
            const activityName = spaceRef?.name;
            if (orderTitle) pathParts.push(orderTitle);
            if (activityName && activityName !== 'Inbox') pathParts.push(activityName);
        } else if (spaceRef?.type === 'interno') {
            const cluster = spaceRef?.parent?.name;
            const project = spaceRef?.name;
            if (cluster) pathParts.push(cluster);
            if (project) pathParts.push(project);
        }
        if (item.parent?.title) pathParts.push(item.parent.title);
        if (pathParts.length === 0) pathParts.push('<span style="opacity: 0.6;">Generale / Inbox</span>');
        const pathHtml = pathParts.join(' <span style="opacity: 0.4;">&rsaquo;</span> ');
        
        let orderId = spaceRef?.order?.order_number || '';
        const clientShort = spaceRef?.order?.clients?.client_code || '';

        let dateColor = '#94a3b8';
        let dateText = item.due_date ? formatDate(item.due_date) : '';
        if (item.due_date) {
            const now = new Date(); now.setHours(0,0,0,0);
            const d = new Date(item.due_date); d.setHours(0,0,0,0);
            if (d < now) dateColor = '#ef4444';
            else if (d.getTime() === now.getTime()) { dateColor = '#f59e0b'; dateText = 'Oggi'; }
        }

        const typeClass = spaceRef?.type === 'interno' ? 'type-interno' : 'type-commessa';
        
        return `
            <div id="card-${item.id}" data-task-id="${item.id}" class="premium-task-card ${typeClass}" onclick="window.openHubDrawer('${item.id}', '${item.space_ref?.id || ''}')">
                <div class="card-check-btn" onclick="event.stopPropagation(); window._dash.completeTask('${item.id}')"><i class="material-icons-round" style="font-size: 14px;">done</i></div>
                <div class="card-title-row">
                    <h4 class="card-title">${item.title} ${isWorking ? `<div style="display:inline-flex; align-items:center; gap:4px; font-size:0.55rem; color:#3b82f6; font-weight:800; margin-left:8px;"><span class="pulsing-dot" style="width:4px; height:4px; background: #3b82f6;"></span>IN CORSO</div>` : ''}</h4>
                </div>
                ${pathHtml ? `<div class="card-path">${pathHtml}</div>` : `<div class="card-path" style="opacity:0">&nbsp;</div>`}
                <div class="card-footer">
                    <div class="card-footer-left">
                        ${orderId ? `<span class="meta-id">${orderId}</span>` : `<span class="meta-id" style="opacity:0.25;">#TASK-${item.id.slice(0,4)}</span>`}
                        ${clientShort ? `
                            <div style="width: 1px; height: 10px; background: rgba(0,0,0,0.06);"></div>
                            <span class="meta-client" title="${clientShort}">${clientShort}</span>
                        ` : ''}
                    </div>
                    <div class="card-footer-right">
                        <i class="material-icons-round" style="color: ${pr.color}; font-size: 0.9rem;">${pr.icon}</i>
                        ${dateText ? `<span class="meta-date" style="color: ${dateColor}">${dateText}</span>` : `<span class="meta-date" style="color: #cbd5e1; font-weight:400; opacity:0.6;">&mdash;</span>`}
                    </div>
                </div>
            </div>
        `;
    }
}

window.openHubDrawer = openHubDrawer;
export async function renderMyWork(container) {
    container.innerHTML = `<div id="tasks-dashboard-container" style="min-height: 400px; padding: 0;"></div>`;
    const dashboard = new TasksDashboard(container.querySelector('#tasks-dashboard-container'));
    await dashboard.init();
    window.__currentDashboard = dashboard;
}
