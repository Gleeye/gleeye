// Hub Overview Tab - Progress, Urgenze, Activity Feed

export function renderHubOverview(container, items, kpis, spaceId) {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get overdue items
    const overdueItems = items
        .filter(i => i.due_date && i.status !== 'done' && new Date(i.due_date) < now)
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
        .slice(0, 5);

    // Get due soon items
    const dueSoonItems = items
        .filter(i => {
            if (!i.due_date || i.status === 'done') return false;
            const due = new Date(i.due_date);
            return due >= now && due <= weekFromNow;
        })
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
        .slice(0, 5);

    container.innerHTML = `
        <div class="hub-overview" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.5rem;">
            
            <!-- Progress Block -->
            <div class="overview-card" style="background: white; border-radius: 12px; padding: 1.5rem;">
                <h3 style="margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-icons-round" style="color: var(--brand-color);">pie_chart</span>
                    Progresso
                </h3>
                
                <!-- Progress Bar -->
                <div style="margin-bottom: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span class="text-secondary">Completamento</span>
                        <span style="font-weight: 600;">${kpis.progress}%</span>
                    </div>
                    <div style="height: 8px; background: var(--surface-2); border-radius: 4px; overflow: hidden;">
                        <div style="height: 100%; width: ${kpis.progress}%; background: linear-gradient(90deg, var(--brand-color), #10b981); border-radius: 4px; transition: width 0.3s;"></div>
                    </div>
                </div>
                
                <!-- Stats Grid -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
                    <div style="padding: 1rem; background: var(--surface-1); border-radius: 8px;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--brand-color);">${kpis.total}</div>
                        <div class="text-xs text-secondary">Totali</div>
                    </div>
                    <div style="padding: 1rem; background: #eff6ff; border-radius: 8px;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: #3b82f6;">${kpis.total - kpis.done}</div>
                        <div class="text-xs text-secondary">Aperte</div>
                    </div>
                    <div style="padding: 1rem; background: #ecfdf5; border-radius: 8px;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: #10b981;">${kpis.done}</div>
                        <div class="text-xs text-secondary">Complete</div>
                    </div>
                </div>
            </div>
            
            <!-- Overdue Block -->
            <div class="overview-card" style="background: white; border-radius: 12px; padding: 1.5rem;">
                <h3 style="margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-icons-round" style="color: #ef4444;">warning</span>
                    Scadute
                    ${kpis.overdue > 0 ? `<span style="background: #fef2f2; color: #ef4444; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 600;">${kpis.overdue}</span>` : ''}
                </h3>
                
                ${overdueItems.length === 0 ? `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        <span class="material-icons-round" style="font-size: 2rem; opacity: 0.3;">celebration</span>
                        <p style="margin: 0.5rem 0 0;">Nessuna attività scaduta!</p>
                    </div>
                ` : `
                    <div class="urgenze-list">
                        ${overdueItems.map(item => renderUrgentItem(item, 'overdue')).join('')}
                    </div>
                `}
            </div>
            
            <!-- Due Soon Block -->
            <div class="overview-card" style="background: white; border-radius: 12px; padding: 1.5rem;">
                <h3 style="margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-icons-round" style="color: #f59e0b;">schedule</span>
                    In Scadenza
                    ${kpis.dueSoon > 0 ? `<span style="background: #fffbeb; color: #f59e0b; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 600;">${kpis.dueSoon}</span>` : ''}
                </h3>
                
                ${dueSoonItems.length === 0 ? `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        <span class="material-icons-round" style="font-size: 2rem; opacity: 0.3;">event_available</span>
                        <p style="margin: 0.5rem 0 0;">Nessuna scadenza imminente</p>
                    </div>
                ` : `
                    <div class="urgenze-list">
                        ${dueSoonItems.map(item => renderUrgentItem(item, 'soon')).join('')}
                    </div>
                `}
            </div>
            
            <!-- Quick Actions -->
            <div class="overview-card" style="background: white; border-radius: 12px; padding: 1.5rem;">
                <h3 style="margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-icons-round" style="color: var(--brand-color);">flash_on</span>
                    Azioni Rapide
                </h3>
                
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    <button class="quick-action-btn" data-action="add-activity" style="
                        display: flex; 
                        align-items: center; 
                        gap: 1rem; 
                        padding: 1rem; 
                        background: var(--surface-1); 
                        border: none; 
                        border-radius: 8px; 
                        cursor: pointer;
                        text-align: left;
                        transition: background 0.2s;
                    ">
                        <span class="material-icons-round" style="color: var(--brand-color);">add_circle</span>
                        <div>
                            <div style="font-weight: 600;">Nuova Attività</div>
                            <div class="text-xs text-secondary">Crea un gruppo di task</div>
                        </div>
                    </button>
                    
                    <button class="quick-action-btn" data-action="add-task" style="
                        display: flex; 
                        align-items: center; 
                        gap: 1rem; 
                        padding: 1rem; 
                        background: var(--surface-1); 
                        border: none; 
                        border-radius: 8px; 
                        cursor: pointer;
                        text-align: left;
                        transition: background 0.2s;
                    ">
                        <span class="material-icons-round" style="color: #10b981;">add_task</span>
                        <div>
                            <div style="font-weight: 600;">Nuova Task</div>
                            <div class="text-xs text-secondary">Aggiungi un compito specifico</div>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    `;

    // Attach click handlers for urgent items
    container.querySelectorAll('.urgent-item').forEach(el => {
        el.addEventListener('click', () => {
            const itemId = el.dataset.id;
            import('./hub_drawer.js?v=155').then(mod => {
                mod.openHubDrawer(itemId, spaceId);
            });
        });
    });

    // Quick actions
    container.querySelectorAll('.quick-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            import('./hub_drawer.js?v=155').then(mod => {
                mod.openHubDrawer(null, spaceId, null, action === 'add-activity' ? 'attivita' : 'task');
            });
        });
    });
}

function renderUrgentItem(item, type) {
    const dueDate = item.due_date ? new Date(item.due_date) : null;
    const dueDateStr = dueDate ? dueDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : '';
    const isOverdue = type === 'overdue';

    return `
        <div class="urgent-item" data-id="${item.id}" style="
            display: flex; 
            align-items: center; 
            gap: 1rem; 
            padding: 0.75rem; 
            background: ${isOverdue ? '#fef2f2' : '#fffbeb'}; 
            border-radius: 8px; 
            margin-bottom: 0.5rem;
            cursor: pointer;
            transition: transform 0.2s;
        ">
            <span class="material-icons-round" style="color: ${isOverdue ? '#ef4444' : '#f59e0b'}; font-size: 1.25rem;">
                ${item.item_type === 'attivita' ? 'folder' : 'check_circle_outline'}
            </span>
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.title}</div>
                <div class="text-xs text-secondary">${item.status || 'todo'}</div>
            </div>
            <div style="text-align: right; flex-shrink: 0;">
                <div style="font-size: 0.8rem; font-weight: 600; color: ${isOverdue ? '#ef4444' : '#f59e0b'};">${dueDateStr}</div>
            </div>
        </div>
    `;
}
