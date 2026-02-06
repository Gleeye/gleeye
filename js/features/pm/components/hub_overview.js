// Hub Overview Tab - Progress, Urgenze, Appuntamenti, Azioni Rapide

const ITEM_STATUS = {
    'todo': { label: 'Da Fare', color: '#64748b', bg: '#f1f5f9' },
    'in_progress': { label: 'In Corso', color: '#3b82f6', bg: '#eff6ff' },
    'blocked': { label: 'Bloccato', color: '#ef4444', bg: '#fef2f2' },
    'review': { label: 'Revisione', color: '#f59e0b', bg: '#fffbeb' },
    'done': { label: 'Completata', color: '#10b981', bg: '#ecfdf5' }
};

export async function renderHubOverview(container, items, kpis, spaceId) {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const orderId = window._hubContext?.orderId;

    // Fetch appointments
    let appointments = [];
    if (orderId) {
        try {
            const { fetchAppointments } = await import('../../../modules/pm_api.js?v=159');
            appointments = await fetchAppointments(orderId);
        } catch (err) {
            console.error("Error fetching appointments for overview:", err);
        }
    }

    // Get overdue + soon items merged into "Urgenze"
    const urgentItems = items
        .filter(i => {
            if (!i.due_date || i.status === 'done') return false;
            const due = new Date(i.due_date);
            return due <= weekFromNow;
        })
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
        .slice(0, 10);

    // Get upcoming appointments (today and future, not cancelled)
    const upcomingAppts = appointments
        .filter(a => a.status !== 'annullato' && new Date(a.end_time) >= now)
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
        .slice(0, 5);

    container.innerHTML = `
        <div class="hub-overview" style="display: grid; grid-template-columns: 300px 1fr 1fr; gap: 1.5rem; align-items: start;">
            
            <!-- Left Column: KPIs & Actions -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                
                <!-- Progress Card (Donut Chart) -->
                <div class="overview-card" style="background: white; border-radius: 16px; padding: 1.5rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; align-items: center;">
                    <div style="width: 100%; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem;">
                        <span class="material-icons-round" style="color: var(--brand-color);">analytics</span>
                        <span style="font-weight: 700; font-size: 1rem; color: var(--text-primary);">Stato Progetto</span>
                    </div>

                    <!-- SVG Donut Chart -->
                    <div style="position: relative; width: 160px; height: 160px; margin-bottom: 1.5rem;">
                        <svg viewBox="0 0 36 36" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                            <!-- Background Circle -->
                            <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="var(--surface-1)" stroke-width="3"></circle>
                            
                            <!-- Status Segments -->
                            ${(() => {
            const total = items.length || 1;
            const counts = {
                done: items.filter(i => i.status === 'done').length,
                doing: items.filter(i => ['in_progress', 'review'].includes(i.status)).length,
                blocked: items.filter(i => i.status === 'blocked').length,
                todo: items.filter(i => (i.status === 'todo' || !i.status)).length
            };

            let offset = 0;
            const segments = [
                { count: counts.done, color: '#10b981' },    // Green
                { count: counts.doing, color: '#3b82f6' },   // Blue
                { count: counts.blocked, color: '#ef4444' }, // Red
                { count: counts.todo, color: '#e2e8f0' }     // Grey
            ];

            return segments.map(seg => {
                if (seg.count === 0) return '';
                const percent = (seg.count / total) * 100;
                const strokeDash = `${percent} ${100 - percent}`;
                const dashOffset = -offset;
                offset += percent;
                return `<circle cx="18" cy="18" r="15.915" fill="transparent" stroke="${seg.color}" stroke-width="3.5" stroke-dasharray="${strokeDash}" stroke-dashoffset="${dashOffset}" stroke-linecap="round" style="transition: stroke-dashoffset 0.6s ease;"></circle>`;
            }).join('');
        })()}
                        </svg>
                        
                        <!-- Center Text -->
                        <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; transform: none;">
                            <div style="font-size: 1.75rem; font-weight: 800; color: var(--text-primary); line-height: 1;">${kpis.progress}%</div>
                            <div style="font-size: 0.65rem; color: var(--text-tertiary); font-weight: 700; text-transform: uppercase; margin-top: 2px;">Completato</div>
                        </div>
                    </div>

                    <!-- Legend Grid -->
                    <div style="width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; padding-top: 1rem; border-top: 1px solid var(--surface-1);">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <div style="width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></div>
                            <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Finiti: ${kpis.done}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <div style="width: 8px; height: 8px; border-radius: 50%; background: #3b82f6;"></div>
                            <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">In corso: ${items.filter(i => ['in_progress', 'review'].includes(i.status)).length}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <div style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444;"></div>
                            <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Bloccati: ${kpis.blocked}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <div style="width: 8px; height: 8px; border-radius: 50%; background: #e2e8f0;"></div>
                            <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Da fare: ${items.filter(i => (i.status === 'todo' || !i.status)).length}</div>
                        </div>
                    </div>
                </div>

                <!-- Quick Actions -->
                <div class="overview-card" style="background: white; border-radius: 16px; padding: 1.25rem; box-shadow: var(--shadow-sm);">
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <button class="quick-action-btn" data-action="add-activity" style="
                            display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; 
                            background: var(--surface-1); border: 1px solid transparent; border-radius: 12px; 
                            cursor: pointer; text-align: left; transition: all 0.2s;
                        " onmouseover="this.style.background='white'; this.style.borderColor='var(--brand-color)'; this.style.boxShadow='var(--shadow-sm)';" onmouseout="this.style.background='var(--surface-1)'; this.style.borderColor='transparent'; this.style.boxShadow='none';">
                            <div style="width: 32px; height: 32px; border-radius: 8px; background: #fff7ed; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <span class="material-icons-round" style="color: #f59e0b; font-size: 1.25rem;">folder</span>
                            </div>
                            <div>
                                <div style="font-weight: 600; font-size: 0.85rem;">Nuova Attività</div>
                                <div style="font-size: 0.75rem; color: var(--text-secondary);">Organizza task</div>
                            </div>
                        </button>
                        
                        <button class="quick-action-btn" data-action="add-task" style="
                            display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; 
                            background: var(--surface-1); border: 1px solid transparent; border-radius: 12px; 
                            cursor: pointer; text-align: left; transition: all 0.2s;
                        " onmouseover="this.style.background='white'; this.style.borderColor='var(--brand-color)'; this.style.boxShadow='var(--shadow-sm)';" onmouseout="this.style.background='var(--surface-1)'; this.style.borderColor='transparent'; this.style.boxShadow='none';">
                            <div style="width: 32px; height: 32px; border-radius: 8px; background: #f0fdf4; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <span class="material-icons-round" style="color: #10b981; font-size: 1.25rem;">check_circle</span>
                            </div>
                            <div>
                                <div style="font-weight: 600; font-size: 0.85rem;">Nuova Task</div>
                                <div style="font-size: 0.75rem; color: var(--text-secondary);">Compito rapido</div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Middle Column: Urgent Activities -->
            <div class="overview-card" style="background: white; border-radius: 16px; padding: 1.5rem; box-shadow: var(--shadow-sm); min-height: 400px; display: flex; flex-direction: column;">
                <div style="width: 100%; display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;">
                    <div style="width: 36px; height: 36px; border-radius: 10px; background: #fef2f2; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <span class="material-icons-round" style="color: #ef4444; font-size: 1.25rem;">assignment_late</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
                        <span style="font-weight: 700; font-size: 1rem; color: var(--text-primary);">Urgenze & Scadenze</span>
                        ${urgentItems.length > 0 ? `<span style="background: #fef2f2; color: #ef4444; padding: 2px 8px; border-radius: 8px; font-size: 0.75rem; font-weight: 700;">${urgentItems.length}</span>` : ''}
                    </div>
                </div>
                
                ${urgentItems.length === 0 ? `
                    <div style="text-align: center; padding: 4rem 1rem; color: var(--text-secondary); flex: 1; display: flex; flex-direction: column; justify-content: center;">
                        <div style="width: 64px; height: 64px; border-radius: 50%; background: #f0fdf4; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                            <span class="material-icons-round" style="color: #10b981; font-size: 2rem;">done_all</span>
                        </div>
                        <p style="font-weight: 600; color: var(--text-primary); margin: 0;">Tutto sotto controllo!</p>
                        <p style="font-size: 0.85rem; margin: 0.25rem 0 0;">Non ci sono attività in scadenza.</p>
                    </div>
                ` : `
                    <div class="urgenze-list">
                        ${urgentItems.map(item => renderUrgentItem(item)).join('')}
                    </div>
                `}
            </div>

            <!-- Right Column: Appointments -->
            <div class="overview-card" style="background: white; border-radius: 16px; padding: 1.5rem; box-shadow: var(--shadow-sm); min-height: 400px; display: flex; flex-direction: column;">
                <div style="width: 100%; display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;">
                    <div style="width: 36px; height: 36px; border-radius: 10px; background: #f5f3ff; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <span class="material-icons-round" style="color: #8b5cf6; font-size: 1.25rem;">event_available</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
                        <span style="font-weight: 700; font-size: 1rem; color: var(--text-primary);">Appuntamenti</span>
                        ${upcomingAppts.length > 0 ? `<span style="background: var(--surface-1); color: var(--brand-color); padding: 2px 8px; border-radius: 8px; font-size: 0.75rem; font-weight: 700;">${upcomingAppts.length}</span>` : ''}
                    </div>
                </div>
                
                ${upcomingAppts.length === 0 ? `
                    <div style="text-align: center; padding: 4rem 1rem; color: var(--text-secondary); flex: 1; display: flex; flex-direction: column; justify-content: center;">
                        <div style="width: 64px; height: 64px; border-radius: 50%; background: var(--surface-1); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                            <span class="material-icons-round" style="color: var(--text-tertiary); font-size: 2rem;">calendar_today</span>
                        </div>
                        <p style="font-weight: 600; color: var(--text-primary); margin: 0;">Nessun impegno</p>
                        <p style="font-size: 0.85rem; margin: 0.25rem 0 0;">Non ci sono appuntamenti in programma.</p>
                    </div>
                ` : `
                    <div class="appointments-list">
                        ${upcomingAppts.map(appt => renderAppointmentItem(appt)).join('')}
                    </div>
                `}
            </div>
        </div>
    `;

    // Event handlers
    container.querySelectorAll('.urgent-item').forEach(el => {
        el.addEventListener('click', () => {
            const itemId = el.dataset.id;
            import('./hub_drawer.js?v=157').then(mod => {
                mod.openHubDrawer(itemId, spaceId);
            });
        });
    });

    container.querySelectorAll('.appointment-item').forEach(el => {
        el.addEventListener('click', () => {
            const apptId = el.dataset.id;
            import('./hub_appointment_drawer.js?v=157').then(mod => {
                mod.openAppointmentDrawer(apptId, orderId);
            });
        });
    });

    container.querySelectorAll('.quick-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            import('./hub_drawer.js?v=157').then(mod => {
                mod.openHubDrawer(null, spaceId, null, action === 'add-activity' ? 'attivita' : 'task');
            });
        });
    });
}

function renderAppointmentItem(appt) {
    const start = new Date(appt.start_time);
    const day = start.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    const time = start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    return `
        <div class="appointment-item" data-id="${appt.id}" style="
            display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--surface-1); 
            border-radius: 12px; margin-bottom: 0.75rem; cursor: pointer; transition: all 0.2s;
            border: 1px solid transparent;
        " onmouseover="this.style.background='white'; this.style.borderColor='var(--brand-color)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.background='var(--surface-1)'; this.style.borderColor='transparent'; this.style.transform='none';">
            <div style="text-align: center; min-width: 45px; padding-right: 12px; border-right: 2px solid var(--surface-2);">
                <div style="font-size: 0.95rem; font-weight: 800; color: var(--brand-color); text-transform: uppercase;">${day}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;">${time}</div>
            </div>
            
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${appt.title}</div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.7rem; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;">
                        <span class="material-icons-round" style="font-size: 0.85rem;">${appt.mode === 'online' ? 'videocam' : 'place'}</span>
                        ${appt.location || (appt.mode === 'online' ? 'Videochiamata' : 'In presenza')}
                    </span>
                </div>
            </div>
        </div>
    `;
}

function renderUrgentItem(item) {
    const dueDate = item.due_date ? new Date(item.due_date) : null;
    const now = new Date();
    const isOverdue = dueDate && dueDate < now;
    const dueDateStr = dueDate ? dueDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : '';

    const statusKey = item.status || 'todo';
    const statusCfg = ITEM_STATUS[statusKey] || { label: statusKey, color: '#64748b', bg: '#f1f5f9' };

    return `
        <div class="urgent-item" data-id="${item.id}" style="
            display: flex; align-items: center; gap: 1rem; padding: 1rem; background: #f8fafc; 
            border-radius: 12px; margin-bottom: 0.75rem; cursor: pointer; transition: all 0.2s;
            border: 1px solid ${isOverdue ? '#fef2f2' : 'var(--surface-1)'};
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-md)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.05)';">
            <div style="
                width: 36px; height: 36px; border-radius: 10px; 
                background: ${isOverdue ? '#fef2f2' : '#f8fafc'}; 
                display: flex; align-items: center; justify-content: center; flex-shrink: 0;
            ">
                <span class="material-icons-round" style="color: ${isOverdue ? '#ef4444' : '#64748b'}; font-size: 1.25rem;">
                    ${item.item_type === 'attivita' ? 'folder' : 'check_circle'}
                </span>
            </div>
            
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;">${item.title}</div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="
                        font-size: 0.65rem; padding: 2px 8px; border-radius: 6px; 
                        background: ${statusCfg.bg}; color: ${statusCfg.color}; 
                        font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em;
                    ">${statusCfg.label}</span>
                    <span style="font-size: 0.75rem; font-weight: 700; color: ${isOverdue ? '#ef4444' : '#f59e0b'}; display: flex; align-items: center; gap: 4px;">
                        <span class="material-icons-round" style="font-size: 0.9rem;">${isOverdue ? 'history' : 'event'}</span>
                        ${dueDateStr}
                    </span>
                </div>
            </div>
        </div>
    `;
}
