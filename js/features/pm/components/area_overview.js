import { fetchAppointments, fetchPMActivityLogs, fetchSpaceComments } from '../../../modules/pm_api.js?v=8000';
import { supabase } from '../../../modules/config.js?v=8000';
import { renderAvatar } from '../../../modules/utils.js?v=8000';
import { humanizeActivity } from '../../../modules/pm_activity_helper.js?v=8000';

export async function renderAreaOverview(container, spaceIds, spaceNamesMap, cloudLinks = []) {
    container.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:300px;"><span class="loader"></span></div>';

    try {
        // Fetch Items for the given spaces
        const { data: items } = await supabase
            .from('pm_items')
            .select(`id, space_ref, title, status, due_date, item_type`)
            .in('space_ref', spaceIds)
            .is('archived_at', null);

        // Fetch Appointments, Logs, Comments
        // Since the pm_api.js functions might expect a single spaceId, we might need to fetch manually for multiple
        const { data: appts } = await supabase
            .from('pm_appointments')
            .select('*')
            .in('space_ref', spaceIds)
            .gte('date_start', new Date(new Date().setHours(0,0,0,0)).toISOString())
            .order('date_start', { ascending: true })
            .limit(10);
            
        const { data: logs } = await supabase
            .from('pm_activity_logs')
            .select(`
                *,
                actor:actor_user_ref(id, full_name, avatar_url, role),
                item:item_ref(id, title),
                space:space_ref(id, name)
            `)
            .in('space_ref', spaceIds)
            .order('created_at', { ascending: false })
            .limit(15);
            
        const { data: comments } = await supabase
            .from('pm_item_comments')
            .select(`
                id, body, created_at, pm_item_ref,
                profiles!author_user_ref ( full_name, avatar_url ),
                pm_items!pm_item_ref!inner ( title, space_ref )
            `)
            .in('pm_items.space_ref', spaceIds)
            .order('created_at', { ascending: false })
            .limit(10);

        // 1. Calculate Activities Stats
        const now = new Date();
        const safeItems = items || [];
        const total = safeItems.length;
        const comp = safeItems.filter(i => i.status === 'done').length;
        const corso = safeItems.filter(i => i.status === 'in_progress' || i.status === 'ongoing').length;
        const pausa = safeItems.filter(i => i.status === 'blocked').length;
        const fare = safeItems.filter(i => i.status === 'todo' || !i.status).length;
        
        const urgencies = safeItems.filter(i => {
            if (!i.due_date || i.status === 'done') return false;
            const due = new Date(i.due_date);
            return due <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        }).sort((a,b) => new Date(a.due_date) - new Date(b.due_date)).slice(0, 5);

        // Docs
        const docs = (cloudLinks || []).slice(0, 4);
        const upcomingAppts = (appts || []).slice(0, 3);
        const recentLogs = (logs || []).slice(0, 5);
        const recentComments = (comments || []).slice(0, 5);

        container.innerHTML = `
            <style>
                .overview-dash { display: grid; grid-template-columns: 340px 1fr 1fr; gap: 1.5rem; animation: fadeIn 0.3s ease; }
                @media (max-width: 1200px) { .overview-dash { grid-template-columns: 1fr 1fr; } }
                @media (max-width: 768px) { .overview-dash { grid-template-columns: 1fr; } }
                
                .dash-box { background: white; border: none; border-radius: 16px; padding: 1.5rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 1rem; }
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
                
                .urg-item { display: flex; gap: 12px; padding: 1rem; background: var(--surface-1); border-radius: 12px; align-items: center; cursor: pointer; transition: 0.2s; border: 1px solid transparent; }
                .urg-item:hover { border-color: #ef4444; background: white; box-shadow: var(--shadow-sm); }
                .urg-item .icon { width: 32px; height: 32px; border-radius: 8px; background: rgba(239, 68, 68, 0.1); color: #ef4444; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .urg-item .icon .material-icons-round { font-size: 1.2rem; }
                
                .doc-item { display: flex; gap: 12px; align-items: start; padding: 0.5rem; border-radius: 8px; transition: 0.2s; }
                .doc-item:hover { background: var(--bg-secondary); }
                .doc-item .material-icons-round { color: var(--brand-blue); font-size: 1.2rem; margin-top: 2px; }
                
                .feed-item { display: flex; gap: 12px; position: relative; padding-bottom: 1rem;}
                .feed-item::before { content: ''; position: absolute; left: 16px; top: 32px; bottom: 0; width: 2px; background: var(--surface-2); }
                .feed-item:last-child::before { display: none; }
                .feed-item:last-child { padding-bottom: 0; }
                
                .dash-empty { padding: 3.5rem 1rem; text-align: center; color: var(--text-tertiary); font-size: 0.8rem; font-style: italic; background: var(--bg-secondary); border-radius: 12px; border: none; }
            </style>
            
            <div class="overview-dash">
                <!-- COL 1: ATTIVITA E SCADENZE -->
                <div class="dash-box" style="grid-row: span 2;">
                    <div class="dash-title">
                        <div style="display:flex; align-items:center; gap:8px;"><span class="material-icons-round" style="color:var(--brand-viola); font-size: 1.2rem;">assessment</span> Stato delle Attività</div>
                        <span class="material-icons-round" style="cursor:pointer;" onclick="document.querySelector('.tab-btn[data-tab=tree]')?.click()">arrow_forward</span>
                    </div>
                    
                    <div class="stat-grid">
                        <div class="stat-box tot"><div class="l">Totale</div><div class="v">${total}</div></div>
                        <div class="stat-box comp"><div class="l">Comp.</div><div class="v">${comp}</div></div>
                        <div class="stat-box corso"><div class="l">Corso</div><div class="v">${corso}</div></div>
                        <div class="stat-box"><div class="l">Fare</div><div class="v">${fare}</div></div>
                        <div class="stat-box"><div class="l">Pausa</div><div class="v">${pausa}</div></div>
                    </div>
                    
                    <div style="margin-top: 1.5rem; display:flex; align-items:center; gap:8px;">
                        <span class="material-icons-round" style="color:#ef4444; font-size: 1.2rem;">notification_important</span>
                        <h4 style="margin:0; font-size: 1rem; font-weight: 800; color: var(--text-primary); font-family: var(--font-titles);">Urgenze & Scadenze</h4>
                        ${urgencies.length > 0 ? `<span style="background: #fef2f2; color: #ef4444; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 800;">${urgencies.length}</span>` : ''}
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem;">
                        ${urgencies.length === 0 ? `<div class="dash-empty" style="margin-top:0;">Tutto sotto controllo! Nessuna scadenza.</div>` : urgencies.map(u => `
                            <div class="urg-item" onclick="import('./hub_drawer.js?v=8023').then(m => m.openHubDrawer('${u.id}', '${u.space_ref}'))">
                                <div class="icon"><span class="material-icons-round">${u.item_type === 'attivita' ? 'folder' : 'check_circle'}</span></div>
                                <div style="flex:1; min-width:0;">
                                    <div style="font-size: 0.55rem; color: var(--text-tertiary); font-weight: 800; text-transform: uppercase;">${spaceNamesMap[u.space_ref] || 'Progetto'}</div>
                                    <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 2px 0;">${u.title}</div>
                                    <div style="display: flex; gap: 8px; margin-top: 4px; align-items: center;">
                                        <span style="font-size: 0.6rem; font-weight: 800; color: #3b82f6;">${u.status === 'in_progress' ? 'IN CORSO' : 'DA FARE'}</span>
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
                        <span class="material-icons-round" style="cursor:pointer;" onclick="document.querySelector('.tab-btn[data-tab=appointments]')?.click()">arrow_forward</span>
                    </div>
                    <div style="display:flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">
                        ${upcomingAppts.length === 0 ? `<div class="dash-empty">Nessun impegno pianificato.</div>` : upcomingAppts.map(a => `
                            <div style="display:flex; gap:12px; align-items:center; padding: 0.75rem; background: var(--surface-1); border-radius: 12px; cursor:pointer;" onclick="import('./hub_appointment_drawer.js?v=8000').then(m => m.openAppointmentDrawer({id: '${a.id}'}, null))">
                                <div style="text-align:center; padding-right:12px; border-right:2px solid var(--surface-2); min-width: 50px;">
                                    <div style="font-size:0.65rem; color:var(--brand-viola); font-weight:800; text-transform:uppercase;">${new Date(a.date_start).toLocaleDateString('it-IT', { month: 'short' })}</div>
                                    <div style="font-size:1.1rem; color:var(--text-primary); font-weight:800; line-height:1; margin-top:2px;">${new Date(a.date_start).getDate()}</div>
                                </div>
                                <div style="flex:1; min-width:0;">
                                    <div style="font-size:0.85rem; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${a.title}</div>
                                    <div style="font-size:0.7rem; color:var(--text-secondary); display:flex; align-items:center; gap:4px; margin-top:4px;">
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
                        <div style="display:flex; align-items:center; gap:8px;"><div style="width:28px; height:28px; border-radius:8px; background:rgba(59, 130, 246, 0.1); color:var(--brand-blue); display:flex; align-items:center; justify-content:center;"><span class="material-icons-round" style="font-size: 1.1rem;">folder</span></div> Documenti Recenti</div>
                        <span class="material-icons-round" style="cursor:pointer;" onclick="document.querySelector('.tab-btn[data-tab=docs]')?.click()">swap_horiz</span>
                    </div>
                    <div style="display:flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">
                        ${docs.length === 0 ? `<div class="dash-empty">Nessun documento collegato.</div>` : docs.map(d => `
                            <a href="${d.url}" target="_blank" class="doc-item" style="text-decoration:none;">
                                <span class="material-icons-round">description</span>
                                <div style="flex:1; min-width:0;">
                                    <div style="font-size:0.85rem; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${d.title || 'Documento'}</div>
                                    <div style="font-size:0.65rem; color:var(--text-tertiary); margin-top:2px;">${new Date(d.added_at || new Date()).toLocaleDateString('it-IT')}</div>
                                </div>
                            </a>
                        `).join('')}
                    </div>
                </div>
                
                <!-- COL 2 BOTTOM: COMMENTI -->
                 <div class="dash-box">
                    <div class="dash-title">
                        <div style="display:flex; align-items:center; gap:8px;"><div style="width:28px; height:28px; border-radius:8px; background:rgba(6, 182, 212, 0.1); color:#06b6d4; display:flex; align-items:center; justify-content:center;"><span class="material-icons-round" style="font-size: 1.1rem;">chat_bubble_outline</span></div> Commenti Recenti</div>
                        <span class="material-icons-round" style="cursor:pointer;" onclick="document.querySelector('.tab-btn[data-tab=tree]')?.click()">arrow_forward</span>
                    </div>
                    <div style="display:flex; flex-direction: column; gap: 1rem; margin-top: 0.5rem;">
                        ${recentComments.length === 0 ? `<div class="dash-empty">Nessun commento recente</div>` : recentComments.map(c => `
                            <div class="feed-item" style="padding-bottom:0.5rem; cursor:pointer;" onclick="import('./hub_drawer.js?v=8023').then(m => m.openHubDrawer('${c.pm_item_ref}', '${c.pm_items?.space_ref}'))">
                                ${renderAvatar(c.profiles || { full_name: 'Utente' }, { size: 32, borderRadius: '50%' })}
                                <div style="flex:1; min-width:0;">
                                    <div style="display:flex; justify-content:space-between; align-items:baseline;">
                                        <div style="font-size:0.8rem; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:60%;">${c.profiles?.full_name || 'Utente'}</div>
                                        <div style="font-size:0.6rem; color:var(--text-tertiary);">${new Date(c.created_at).toLocaleString('it-IT', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}</div>
                                    </div>
                                    <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${c.body}</div>
                                    <div style="font-size:0.6rem; color:var(--brand-blue); font-weight:700; margin-top:6px; display:inline-block; padding:3px 8px; background:rgba(59, 130, 246, 0.1); border-radius:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%;"><span class="material-icons-round" style="font-size:0.8rem; vertical-align:text-bottom;">subdirectory_arrow_right</span> ${c.pm_items?.title}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- COL 3 BOTTOM: FEED -->
                <div class="dash-box">
                    <div class="dash-title">
                        <div style="display:flex; align-items:center; gap:8px;"><div style="width:28px; height:28px; border-radius:8px; background:rgba(245, 158, 11, 0.1); color:#f59e0b; display:flex; align-items:center; justify-content:center;"><span class="material-icons-round" style="font-size: 1.1rem;">history</span></div> Attività Recenti</div>
                        <span class="material-icons-round" style="cursor:pointer;" onclick="document.querySelector('.tab-btn[data-tab=feed]')?.click()">arrow_forward</span>
                    </div>
                    <div style="display:flex; flex-direction: column; gap: 1rem; margin-top: 0.5rem;" class="custom-scrollbar">
                        ${recentLogs.length === 0 ? `<div class="dash-empty">Nessuna attività registrata</div>` : recentLogs.map(l => {
                            const human = humanizeActivity(l);
                            return `
                            <div class="feed-item" style="cursor:pointer;" onclick="import('./hub_drawer.js?v=8023').then(m => m.openHubDrawer('${l.item_ref}', '${l.space_ref}'))">
                                ${renderAvatar(l.actor || { full_name: 'S' }, { size: 32, borderRadius: '50%' })}
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.3;">
                                        <strong style="color:var(--text-primary);">${human.actorName}</strong> ${human.formattedDesc}
                                    </div>
                                    <div style="font-size: 0.65rem; color: var(--text-tertiary); margin-top: 4px;">${new Date(l.created_at).toLocaleString('it-IT', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}</div>
                                </div>
                            </div>
                        `}).join('')}
                    </div>
                </div>

            </div>
        `;
    } catch (e) {
        console.error("Error rendering area dashboard:", e);
        container.innerHTML = `<div class="dash-empty">Errore caricamento Dashboard: ${e.message}</div>`;
    }
}
