import { fetchAppointments, fetchPMActivityLogs, fetchSpaceComments } from '../../../modules/pm_api.js?v=8000';
import { state } from '../../../modules/state.js?v=8000';
import { renderAvatar } from '../../../modules/utils.js?v=8000';
import { humanizeActivity } from '../../../modules/pm_activity_helper.js?v=8000';

export async function renderSpaceOverview(container, spaceId, items, space) {
    container.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:300px;"><span class="loader"></span></div>';

    try {
        const [appointments, logs, comments] = await Promise.all([
            fetchAppointments(spaceId, 'space'),
            fetchPMActivityLogs(null, null, spaceId, null),
            fetchSpaceComments(spaceId, 10)
        ]);

        // 1. Calculate Activities Stats
        const now = new Date();
        const total = items.length;
        const comp = items.filter(i => i.status === 'done').length;
        const corso = items.filter(i => i.status === 'in_progress' || i.status === 'ongoing').length;
        const pausa = items.filter(i => i.status === 'blocked').length;
        const fare = items.filter(i => i.status === 'todo' || !i.status).length;
        
        const urgencies = items.filter(i => {
            if (!i.due_date || i.status === 'done') return false;
            const due = new Date(i.due_date);
            return due <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        }).sort((a,b) => new Date(a.due_date) - new Date(b.due_date));

        // Docs
        const docs = (space.cloud_links || []).slice(0, 4);

        // Appts
        const upcomingAppts = appointments.filter(a => new Date(a.date_start) >= new Date(new Date().setHours(0,0,0,0))).sort((a,b) => new Date(a.date_start) - new Date(b.date_start)).slice(0, 3);

        container.innerHTML = `
            <style>
                .overview-dash { display: grid; grid-template-columns: 340px 1fr 1fr; gap: 1.5rem; }
                @media (max-width: 1200px) { .overview-dash { grid-template-columns: 1fr 1fr; } }
                @media (max-width: 768px) { .overview-dash { grid-template-columns: 1fr; } }
                
                .dash-box { background: white; border: 1px solid var(--glass-border); border-radius: 16px; padding: 1.5rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 1rem; }
                .dash-title { font-size: 1.1rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; justify-content: space-between; font-family: var(--font-titles); margin: 0 0 0.5rem 0;}
                .dash-title .material-icons-round { color: var(--text-tertiary); font-size: 1.25rem; font-weight: normal; }
                
                .stat-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem; text-align: center; }
                .stat-box { background: var(--surface-1); border-radius: 8px; padding: 0.75rem 0.25rem; border: 1px solid var(--surface-2); }
                .stat-box .l { font-size: 0.55rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;}
                .stat-box .v { font-size: 1.2rem; font-weight: 800; color: var(--text-primary); line-height: 1; }
                
                .stat-box.tot { border-color: transparent; background: transparent; }
                .stat-box.comp { background: #ecfdf5; border-color: #a7f3d0; }
                .stat-box.comp .v, .stat-box.comp .l { color: #10b981; }
                .stat-box.corso { background: #eff6ff; border-color: #bfdbfe; }
                .stat-box.corso .v, .stat-box.corso .l { color: #3b82f6; }
                
                .urg-item { display: flex; gap: 12px; padding: 1rem; background: var(--surface-1); border-radius: 12px; align-items: center; }
                .urg-item .icon { width: 32px; height: 32px; border-radius: 8px; background: rgba(239, 68, 68, 0.1); color: #ef4444; display: flex; align-items: center; justify-content: center; }
                .urg-item .icon .material-icons-round { font-size: 1.2rem; }
                
                .doc-item { display: flex; gap: 12px; align-items: start; }
                .doc-item .material-icons-round { color: var(--text-tertiary); font-size: 1.1rem; margin-top: 2px; }
                
                .feed-item { display: flex; gap: 12px; position: relative; padding-bottom: 1rem;}
                .feed-item::before { content: ''; position: absolute; left: 16px; top: 32px; bottom: 0; width: 2px; background: var(--surface-2); }
                .feed-item:last-child::before { display: none; }
                .feed-item:last-child { padding-bottom: 0; }
                
                .dash-empty { padding: 3rem 1rem; text-align: center; color: var(--text-tertiary); font-size: 0.8rem; font-style: italic; }
            </style>
            
            <div class="overview-dash">
                <!-- COL 1: ATTIVITA E SCADENZE -->
                <div class="dash-box" style="grid-row: span 2;">
                    <div class="dash-title">
                        <div style="display:flex; align-items:center; gap:8px;"><span class="material-icons-round" style="color:var(--brand-viola); font-size: 1.2rem;">assessment</span> Stato delle Attività</div>
                        <span class="material-icons-round" style="cursor:pointer;" onclick="document.querySelector('.tab-btn[data-view=tree]').click()">arrow_forward</span>
                    </div>
                    
                    <div class="stat-grid">
                        <div class="stat-box tot"><div class="l">Totale</div><div class="v">${total}</div></div>
                        <div class="stat-box comp"><div class="l">Comp.</div><div class="v">${comp}</div></div>
                        <div class="stat-box corso"><div class="l">Corso</div><div class="v">${corso}</div></div>
                        <div class="stat-box"><div class="l">Fare</div><div class="v">${fare}</div></div>
                        <div class="stat-box"><div class="l">Pausa</div><div class="v">${pausa}</div></div>
                    </div>
                    
                    <div style="margin-top: 1rem; display:flex; align-items:center; gap:8px;">
                        <span class="material-icons-round" style="color:#ef4444; font-size: 1.2rem;">notification_important</span>
                        <h4 style="margin:0; font-size: 1rem; font-weight: 800; color: var(--text-primary); font-family: var(--font-titles);">Urgenze & Scadenze</h4>
                        ${urgencies.length > 0 ? `<span style="background: #fef2f2; color: #ef4444; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 800;">${urgencies.length}</span>` : ''}
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        ${urgencies.length === 0 ? `<div class="dash-empty">Nessuna scadenza imminente</div>` : urgencies.slice(0,5).map(u => `
                            <div class="urg-item cursor-pointer" onclick="import('./hub_drawer.js?v=8021').then(m => m.openHubDrawer('${u.id}', '${spaceId}'))">
                                <div class="icon"><span class="material-icons-round">folder</span></div>
                                <div style="flex:1; min-width:0;">
                                    <div style="font-size: 0.55rem; color: var(--text-tertiary); font-weight: 800; text-transform: uppercase;">${u.item_type || 'Task'}</div>
                                    <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${u.title}</div>
                                    <div style="display: flex; gap: 8px; margin-top: 4px; align-items: center;">
                                        <span style="font-size: 0.6rem; font-weight: 800; color: #3b82f6;">${u.status === 'in_progress' ? 'IN CORSO' : 'IN SCADENZA'}</span>
                                        <span style="font-size: 0.65rem; color: #ef4444; font-weight: 700; display:flex; align-items:center; gap:2px;"><span class="material-icons-round" style="font-size:0.8rem;">schedule</span> ${new Date(u.due_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short'})}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- COL 2 TOP: APPUNTAMENTI -->
                <div class="dash-box">
                    <div class="dash-title">
                        <div style="display:flex; align-items:center; gap:8px;"><div style="width:28px; height:28px; border-radius:8px; background:rgba(139, 92, 246, 0.1); color:var(--brand-viola); display:flex; align-items:center; justify-content:center;"><span class="material-icons-round" style="font-size: 1.1rem;">event</span></div> Appuntamenti</div>
                        <span class="material-icons-round" style="cursor:pointer;" onclick="document.querySelector('.tab-btn[data-view=appointments]').click()">arrow_forward</span>
                    </div>
                    <div style="display:flex; flex-direction: column; gap: 1rem;">
                        ${upcomingAppts.length === 0 ? `<div class="dash-empty">Nessun impegno in programma.</div>` : upcomingAppts.map(a => `
                            <div style="display:flex; gap:12px; align-items:center;">
                                <div style="text-align:center; padding-right:12px; border-right:2px solid var(--surface-2); min-width: 50px;">
                                    <div style="font-size:0.65rem; color:var(--text-tertiary); font-weight:800; text-transform:uppercase;">${new Date(a.date_start).toLocaleDateString('it-IT', { month: 'short' })}</div>
                                    <div style="font-size:1.1rem; color:var(--text-primary); font-weight:800; line-height:1;">${new Date(a.date_start).getDate()}</div>
                                </div>
                                <div style="flex:1;">
                                    <div style="font-size:0.85rem; font-weight:700; color:var(--text-primary);">${a.title}</div>
                                    <div style="font-size:0.7rem; color:var(--text-secondary); display:flex; align-items:center; gap:4px; margin-top:2px;">
                                        <span class="material-icons-round" style="font-size:0.9rem;">schedule</span> ${new Date(a.date_start).toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- COL 3 TOP: DOCUMENTI -->
                <div class="dash-box">
                    <div class="dash-title">
                        <div style="display:flex; align-items:center; gap:8px;"><span class="material-icons-round" style="color:var(--text-primary); font-size: 1.3rem;">folder</span> Documenti Recenti</div>
                        <span class="material-icons-round" style="cursor:pointer;" onclick="document.querySelector('.tab-btn[data-view=docs]').click()">swap_horiz</span>
                    </div>
                    <div style="display:flex; flex-direction: column; gap: 1rem;">
                        ${docs.length === 0 ? `<div class="dash-empty">Nessun documento collegato.</div>` : docs.map(d => `
                            <a href="${d.url}" target="_blank" class="doc-item" style="text-decoration:none;">
                                <span class="material-icons-round">description</span>
                                <div>
                                    <div style="font-size:0.85rem; font-weight:700; color:var(--text-primary);">${d.title || 'Documento'}</div>
                                    <div style="font-size:0.65rem; color:var(--text-tertiary);">${new Date(d.added_at || new Date()).toLocaleDateString('it-IT')}</div>
                                </div>
                            </a>
                        `).join('')}
                    </div>
                </div>
                
                <!-- COL 2 BOTTOM: COMMENTI -->
                 <div class="dash-box">
                    <div class="dash-title">
                        <div style="display:flex; align-items:center; gap:8px;"><div style="width:28px; height:28px; border-radius:8px; background:rgba(6, 182, 212, 0.1); color:#06b6d4; display:flex; align-items:center; justify-content:center;"><span class="material-icons-round" style="font-size: 1.1rem;">chat_bubble_outline</span></div> Commenti Recenti</div>
                        <span class="material-icons-round" style="cursor:pointer;" onclick="document.querySelector('.tab-btn[data-view=tree]').click()">arrow_forward</span>
                    </div>
                    <div style="display:flex; flex-direction: column; gap: 1rem;">
                        ${comments.length === 0 ? `<div class="dash-empty">Nessun commento recente</div>` : comments.map(c => `
                            <div class="feed-item" style="padding-bottom:0.5rem;">
                                ${renderAvatar(c.profiles || { full_name: 'Utente' }, { size: 28, borderRadius: '50%' })}
                                <div style="flex:1;">
                                    <div style="display:flex; justify-content:space-between; align-items:baseline;">
                                        <div style="font-size:0.8rem; font-weight:700; color:var(--text-primary);">${c.profiles?.full_name || 'Utente'}</div>
                                        <div style="font-size:0.6rem; color:var(--text-tertiary);">${new Date(c.created_at).toLocaleString('it-IT')}</div>
                                    </div>
                                    <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">${c.body}</div>
                                    <div style="font-size:0.65rem; color:var(--brand-blue); font-weight:700; margin-top:4px; display:inline-block; padding:2px 6px; background:rgba(59, 130, 246, 0.1); border-radius:4px;">${c.pm_items?.title}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- COL 3 BOTTOM: FEED -->
                <div class="dash-box">
                    <div class="dash-title">
                        <div style="display:flex; align-items:center; gap:8px;"><div style="width:28px; height:28px; border-radius:8px; background:rgba(245, 158, 11, 0.1); color:#f59e0b; display:flex; align-items:center; justify-content:center;"><span class="material-icons-round" style="font-size: 1.1rem;">history</span></div> Attività Recenti</div>
                        <span class="material-icons-round" style="cursor:pointer;" onclick="document.querySelector('.tab-btn[data-view=activity_log]').click()">arrow_forward</span>
                    </div>
                    <div style="display:flex; flex-direction: column; gap: 1rem;">
                        ${logs.length === 0 ? `<div class="dash-empty">Nessuna attività registrata</div>` : logs.slice(0, 5).map(l => {
                            const human = humanizeActivity(l);
                            return `
                            <div class="feed-item">
                                ${renderAvatar(l.actor || { full_name: 'S' }, { size: 32, borderRadius: '50%' })}
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.3;">
                                        <strong style="color:var(--text-primary);">${human.actorName}</strong> ${human.formattedDesc}
                                    </div>
                                    <div style="font-size: 0.65rem; color: var(--text-tertiary); margin-top: 4px;">${new Date(l.created_at).toLocaleString('it-IT')}</div>
                                </div>
                            </div>
                        `}).join('')}
                    </div>
                </div>

            </div>
        `;
    } catch (e) {
        console.error("Error rendering dashboard:", e);
        container.innerHTML = `<div class="dash-empty">Errore: ${e.message}</div>`;
    }
}
