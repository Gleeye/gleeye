export function renderHubAppointments(container, appointments, types, contextId, contextType = 'order') {
    // 1. Setup Layout
    container.innerHTML = `
        <div class="appointments-hub" style="height: 100%; display: flex; flex-direction: column; position: relative;">
            
            <!-- HEADER -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600;">Calendario Progetto</h3>
                
                <div style="display: flex; align-items: center; gap: 0.5rem; background: white; padding: 4px; border-radius: 8px; border: 1px solid var(--surface-2);">
                    <button id="appt-view-list" class="view-toggle active" style="
                        border: none; background: var(--surface-2); padding: 4px 8px; border-radius: 6px; cursor: pointer; color: var(--text-main); display: flex;
                    ">
                        <span class="material-icons-round" style="font-size: 1.2rem;">view_list</span>
                    </button>
                    <button id="appt-view-calendar" class="view-toggle" style="
                        border: none; background: transparent; padding: 4px 8px; border-radius: 6px; cursor: pointer; color: var(--text-tertiary); display: flex;
                    ">
                        <span class="material-icons-round" style="font-size: 1.2rem;">calendar_month</span>
                    </button>
                </div>
            </div>

            <!-- CONTENT AREA -->
            <div id="appt-content-area" style="flex: 1; overflow-y: auto;">
                <!-- Injected here -->
            </div>
        </div>
    `;

    const contentArea = container.querySelector('#appt-content-area');
    const viewListBtn = container.querySelector('#appt-view-list');
    const viewCalBtn = container.querySelector('#appt-view-calendar');

    let currentView = 'list';

    // Toggle Logic
    const setView = (view) => {
        currentView = view;
        if (view === 'list') {
            viewListBtn.style.background = 'var(--surface-2)';
            viewListBtn.style.color = 'var(--text-main)';
            viewCalBtn.style.background = 'transparent';
            viewCalBtn.style.color = 'var(--text-tertiary)';
            renderListView(contentArea, appointments, types, contextId, contextType);
        } else {
            viewCalBtn.style.background = 'var(--surface-2)';
            viewCalBtn.style.color = 'var(--text-main)';
            viewListBtn.style.background = 'transparent';
            viewListBtn.style.color = 'var(--text-tertiary)';
            renderCalendarView(contentArea, appointments, types, contextId, contextType);
        }
    };

    viewListBtn.addEventListener('click', () => setView('list'));
    viewCalBtn.addEventListener('click', () => setView('calendar'));

    // Initial Render
    setView('list');
}

function renderListView(container, appointments, types, contextId, contextType) {
    if (!appointments || appointments.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-tertiary);">
                <span class="material-icons-round" style="font-size: 3rem; opacity: 0.5;">event_busy</span>
                <p>Nessun appuntamento in programma.</p>
            </div>
        `;
        return;
    }

    // Group by Date
    const grouped = {};
    appointments.forEach(appt => {
        const d = new Date(appt.start_time);
        const dateKey = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(appt);
    });

    container.innerHTML = Object.entries(grouped).map(([date, items]) => `
        <div style="margin-bottom: 2.5rem;">
            <div style="
                position: sticky; 
                top: 0; 
                background: var(--surface-1); 
                padding: 1rem 0; 
                z-index: 10;
                margin-bottom: 1rem;
                border-bottom: 1px solid var(--surface-2);
            ">
                <h4 style="margin: 0; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;">
                    ${date}
                </h4>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                ${items.map(appt => renderAppointmentCard(appt)).join('')}
            </div>
        </div>
    `).join('');

    // Attach Listeners
    container.querySelectorAll('.appointment-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            const appt = appointments.find(a => a.id === id);
            if (appt) {
                import('./hub_appointment_drawer.js?v=317').then(mod => {
                    mod.openAppointmentDrawer(appt, contextId, contextType);
                });
            }
        });
    });
}

function renderAppointmentCard(appt) {
    const start = new Date(appt.start_time);
    const end = new Date(appt.end_time);
    const timeStr = `${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')} - ${end.getHours()}:${String(end.getMinutes()).padStart(2, '0')}`;

    // Status visual
    const statusColors = {
        'confermato': '#10b981',
        'bozza': '#94a3b8',
        'annullato': '#ef4444'
    };
    const statusColor = statusColors[appt.status] || '#94a3b8';

    // Types
    const typeBadges = appt.types.map(t => `
        <span style="font-size: 0.7rem; background: ${t.color}20; color: ${t.color}; padding: 2px 6px; border-radius: 4px; font-weight: 500;">
            ${t.name}
        </span>
    `).join('');

    // Participants Avatars (Internal)
    const avatars = (appt.participants?.internal || []).map(p => `
        <div title="${p.user?.full_name}" style="
            width: 24px; height: 24px; border-radius: 50%; background: var(--surface-2); 
            border: 1px solid white; margin-left: -8px; 
            display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--text-secondary);
            overflow: hidden;
        ">
            ${p.user?.avatar_url ? `<img src="${p.user.avatar_url}" style="width:100%;height:100%;object-fit:cover;">` : (p.user?.full_name || 'U')[0]}
        </div>
    `).join('');

    // Client Participants
    const clientCount = (appt.participants?.client || []).length;
    const clientBadge = clientCount > 0 ? `
        <div title="${clientCount} Clienti" style="
            width: 24px; height: 24px; border-radius: 50%; background: #e0f2fe; 
            border: 1px solid white; margin-left: -8px; 
            display: flex; align-items: center; justify-content: center; font-size: 10px; color: #0284c7;
        ">+${clientCount}</div>
    ` : '';

    return `
        <div class="glass-card appointment-card" data-id="${appt.id}" style="
            padding: 0.85rem 1rem; border-left: 4px solid ${statusColor}; 
            display: flex; gap: 1rem; align-items: center;
            cursor: pointer; transition: transform 0.2s;
            margin-bottom: 0.5rem;
        " onmouseover="this.style.transform='translateX(4px)'" onmouseout="this.style.transform='translateX(0)'">
            <!-- Time Column -->
            <div style="min-width: 70px; display: flex; flex-direction: column; align-items: flex-end; border-right: 1px solid var(--surface-2); padding-right: 1rem;">
                <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')}</div>
                <div style="font-size: 0.75rem; color: var(--text-tertiary);">${end.getHours()}:${String(end.getMinutes()).padStart(2, '0')}</div>
            </div>

            <!-- Details -->
            <div style="flex: 1; min-width: 0;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h4 style="margin: 0; font-size: 0.95rem; font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${appt.title}</h4>
                    <div style="display: flex; gap: 4px; align-items: center;">
                        ${typeBadges}
                        <div style="font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600; margin-left: 8px;">
                            ${appt.status}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderCalendarView(container, appointments, types, orderId) {
    container.innerHTML = `
        <div style="text-align: center; padding: 3rem; background: white; border-radius: 12px; border: 1px dashed var(--surface-2);">
            <h4 style="margin-bottom: 0.5rem;">Vista Calendario</h4>
            <p style="color: var(--text-secondary);">La visualizzazione calendario sarà disponibile a breve.</p>
            <div style="margin-top: 1rem; font-family: monospace; font-size: 0.8rem; background: var(--surface-1); padding: 1rem; border-radius: 8px; text-align: left; opacity: 0.7;">
                // TODO: Implement FullCalendar or Custom Grid
                // Events: ${appointments.length}
            </div>
        </div>
    `;
}
