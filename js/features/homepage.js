import { state } from '../modules/state.js?v=151';
import { supabase } from '../modules/config.js?v=151';
import { fetchMyBookings } from '../features/personal_agenda.js?v=151';
import { formatAmount } from '../modules/utils.js?v=151';

// We reuse fetchMyBookings but we might need a tighter scoped fetch for "Today"
// Actually fetchMyBookings stores in `eventsCache` (not exported) or `window`?
// Let's create a dedicated fetch or use the general one if accessible.
// Since `personal_agenda.js` doesn't export the cache cleanly, we'll fetch explicitly here.

async function fetchTodayEvents(collaboratorId) {
    const today = new Date();
    const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today); endOfDay.setHours(23, 59, 59, 999);

    // 1. Fetch Bookings
    const { data: bookings } = await supabase
        .from('bookings')
        .select(`
            *,
            booking_items (name, duration),
            booking_assignments!inner(collaborator_id)
        `)
        .eq('booking_assignments.collaborator_id', collaboratorId)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .neq('status', 'cancelled');

    // 2. Fetch Appointments
    const { data: appointments } = await supabase
        .from('appointments')
        .select(`*`)
        .eq('collaborator_id', collaboratorId)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString());

    // Merge & normalize
    const events = [];
    if (bookings) {
        bookings.forEach(b => {
            events.push({
                id: b.id,
                title: b.booking_items?.name || 'Prenotazione',
                start: new Date(b.start_time),
                end: new Date(b.end_time),
                type: 'booking',
                client: b.guest_info?.company || (b.guest_info?.first_name + ' ' + b.guest_info?.last_name)
            });
        });
    }
    if (appointments) {
        appointments.forEach(a => {
            events.push({
                id: a.id,
                title: a.title || 'Appuntamento',
                start: new Date(a.start_time),
                end: new Date(a.end_time),
                type: 'appointment',
                client: a.client_name || ''
            });
        });
    }

    return events.sort((a, b) => a.start - b.start);
}

async function fetchRecentProjects() {
    // Assuming 'orders' or 'commesse'
    // Let's just grab the last 5 modify orders from state if available, or fetch
    if (!state.orders || state.orders.length === 0) {
        // trigger fetch if needed, but for now assuming state is populated by router or we fetch simple
        const { data } = await supabase
            .from('orders')
            .select('id, title, clients(business_name), status_works, updated_at')
            .order('updated_at', { ascending: false })
            .limit(5);
        return data || [];
    }
    return state.orders.slice(0, 5); // Simplification using existing state
}

export async function renderHomepage(container) {
    console.log("Rendering Homepage...");

    const user = state.session?.user;
    if (!user) return;

    // Find curr collab
    const collab = state.collaborators.find(c => c.email === user.email);
    const firstName = collab ? collab.first_name : 'Utente';

    // Skeleton
    container.innerHTML = `
        <div class="homepage-container">
            <!-- Header -->
            <div class="homepage-header">
                <div class="greeting-section">
                    <h1>Buongiorno, ${firstName}!</h1>
                    <p>Ecco cosa c'è in programma per oggi, ${new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}.</p>
                </div>
                <div class="header-actions">
                    <button class="primary-btn" onclick="window.location.hash='booking'">
                        <span class="material-icons-round">add</span>
                        Nuovo Evento
                    </button>
                    <!-- Search could act as global search focus -->
                </div>
            </div>

            <!-- Top Grid: Timeline + Next Up -->
            <div class="dashboard-grid">
                
                <!-- Daily Timeline -->
                <div class="dashboard-widget timeline-widget">
                    <div class="widget-header">
                        <h3 class="widget-title">Orario di Oggi</h3>
                        <div class="timeline-controls">
                            <!-- Just visual for now -->
                            <button class="timeline-btn active">Oggi</button>
                            <button class="timeline-btn">Domani</button>
                        </div>
                    </div>
                    <div class="timeline-scroll-area" id="home-timeline-area">
                        <div style="padding: 2rem; width: 100%; text-align: center; color: var(--text-tertiary);">
                            <span class="loader small"></span> Caricamento impegni...
                        </div>
                    </div>
                </div>

                <!-- Next Up Widget -->
                <div class="dashboard-widget next-up-widget" id="home-next-up">
                    <div class="next-up-content">
                        <span style="opacity: 0.7;">Prossimo Impegno</span>
                        <div style="text-align: center; padding: 2rem;">
                            <span class="material-icons-round" style="font-size: 3rem; opacity: 0.5;">event_available</span>
                            <p>Nessun impegno imminente</p>
                        </div>
                    </div>
                </div>

            </div>

            <!-- Bottom Grid -->
            <div class="bottom-grid">
                
                <!-- Recent Projects -->
                <div class="dashboard-widget">
                    <div class="widget-header">
                        <h3 class="widget-title">Progetti Recenti</h3>
                        <button class="timeline-btn" onclick="window.location.hash='dashboard'">Vedi Tutti</button>
                    </div>
                    <div id="home-recent-projects" style="display: flex; flex-direction: column; gap: 0.5rem;">
                         <span class="loader small"></span>
                    </div>
                </div>

                <!-- Quick Stats (Work Hours / Productivity) - Placeholder -->
                <div class="dashboard-widget">
                    <div class="widget-header">
                        <h3 class="widget-title">Ore Lavorate (Settimana)</h3>
                    </div>
                    <div>
                         <h2 style="font-size: 2.5rem; font-weight: 700; margin: 0;">24h 12m</h2>
                         <div class="chart-bars">
                            <div class="chart-bar" style="height: 40%"></div>
                            <div class="chart-bar" style="height: 60%"></div>
                            <div class="chart-bar active" style="height: 80%"></div> <!-- Today -->
                            <div class="chart-bar" style="height: 30%"></div>
                            <div class="chart-bar" style="height: 20%"></div>
                            <div class="chart-bar" style="height: 0%"></div>
                            <div class="chart-bar" style="height: 0%"></div>
                         </div>
                    </div>
                </div>

                <!-- Recent Files / Resources -->
                <div class="dashboard-widget">
                    <div class="widget-header">
                         <h3 class="widget-title">Link Rapidi</h3>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="glass-card" style="padding: 1rem; text-align: center; cursor: pointer; transition: transform 0.2s;" onclick="window.location.hash='invoices-dashboard'">
                            <span class="material-icons-round" style="font-size: 2rem; color: var(--brand-blue);">analytics</span>
                            <div style="font-size: 0.9rem; font-weight: 600; margin-top: 0.5rem;">Fatturato</div>
                        </div>
                         <div class="glass-card" style="padding: 1rem; text-align: center; cursor: pointer; transition: transform 0.2s;" onclick="window.location.hash='agenda'">
                            <span class="material-icons-round" style="font-size: 2rem; color: #10b981;">calendar_month</span>
                            <div style="font-size: 0.9rem; font-weight: 600; margin-top: 0.5rem;">Agenda</div>
                        </div>
                         <div class="glass-card" style="padding: 1rem; text-align: center; cursor: pointer; transition: transform 0.2s;" onclick="window.location.hash='pm/commesse'">
                            <span class="material-icons-round" style="font-size: 2rem; color: #f59e0b;">folder</span>
                            <div style="font-size: 0.9rem; font-weight: 600; margin-top: 0.5rem;">Commesse</div>
                        </div>
                        <div class="glass-card" style="padding: 1rem; text-align: center; cursor: pointer; transition: transform 0.2s;" onclick="window.location.hash='payments'">
                            <span class="material-icons-round" style="font-size: 2rem; color: #ef4444;">schedule</span>
                            <div style="font-size: 0.9rem; font-weight: 600; margin-top: 0.5rem;">Scadenze</div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    `;

    // --- Load Data ---
    if (collab) {
        try {
            // 1. Load Events
            const events = await fetchTodayEvents(collab.id);
            renderTimeline(container.querySelector('#home-timeline-area'), events);
            renderNextUp(container.querySelector('#home-next-up'), events);

            // 2. Load Projects
            const projects = await fetchRecentProjects();
            renderProjects(container.querySelector('#home-recent-projects'), projects);

        } catch (e) {
            console.error("Home Data Load Error:", e);
        }
    }
}

function renderTimeline(container, events) {
    if (!events || events.length === 0) {
        container.innerHTML = `
            <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary);">
                <span class="material-icons-round" style="margin-right: 8px;">event_busy</span> Nessun impegno oggi
            </div>
        `;
        return;
    }

    // Determine range: 8:00 to 20:00 default, or expand if events outside
    let startHour = 8;
    let endHour = 20;

    // Adjust logic if events are earlier/later
    // ... skipping for brevity, sticking to 8-20 for MVP view

    let html = '';
    // Generate Hours Cols
    for (let h = startHour; h <= endHour; h++) {
        html += `
            <div class="timeline-hour-col">
                <div class="timeline-hour-label">${h}:00</div>
            </div>
        `;
    }

    container.innerHTML = `<div style="display: flex; position: relative;">${html}</div>`;

    // Calculate Pixels
    // Assuming 100px min-width plus gap per hour. 
    // Actually, simple position absolute relative to the container based on % or px.
    // Let's use PX: 100px per hour + padding.

    const hourWidth = 117; // Roughly 100px + some padding/border adjustment (approx)
    const startPx = 0; // Relative to container

    // Inject Cards on top (overlay)
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.height = '100%';
    overlay.style.width = '100%';
    overlay.style.pointerEvents = 'none'; // allow click through to cards but not blocking

    events.forEach(ev => {
        const startH = ev.start.getHours();
        const startM = ev.start.getMinutes();
        const durationM = (ev.end - ev.start) / (1000 * 60);

        // Calculate offset from startHour
        const offsetM = ((startH - startHour) * 60) + startM;
        if (offsetM < 0) return; // Skip if before view

        // Scale: 1 hour = 117px (approximate based on CSS col width of 100px + padding/border)
        // Better: Find the .timeline-hour-col elements and measure?
        // For MVP, raw calc:
        const pixelsPerMinute = 117 / 60;
        const left = offsetM * pixelsPerMinute;
        const width = durationM * pixelsPerMinute;

        const el = document.createElement('div');
        el.className = `timeline-event-card ${ev.end < new Date() ? 'past' : ''}`;
        el.style.left = `${left + 10}px`; // +10 for padding
        el.style.width = `${Math.max(width - 20, 100)}px`; // min width visual
        el.style.pointerEvents = 'auto'; // Re-enable clicks
        el.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 4px;">${ev.title}</div>
            <div style="font-size: 0.8rem; opacity: 0.9;">${ev.client}</div>
            <div style="font-size: 0.75rem; margin-top: 8px; opacity: 0.8;">
                ${ev.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${ev.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
        `;

        // Style based on type
        if (ev.type === 'appointment') {
            el.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            el.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
        }

        overlay.appendChild(el);
    });

    container.appendChild(overlay);
}

function renderNextUp(container, events) {
    const now = new Date();
    // Find first event that hasn't ended yet
    const next = events.find(e => e.end > now);

    if (!next) {
        container.innerHTML = `
             <div class="next-up-content">
                <span style="opacity: 0.7;">Prossimo Impegno</span>
                <div style="text-align: center; padding: 2rem;">
                    <span class="material-icons-round" style="font-size: 3rem; opacity: 0.5;">done_all</span>
                    <p style="margin-top: 1rem;">Tutto fatto per oggi!</p>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="next-up-content">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <span style="opacity: 0.7; font-weight: 600; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em;">In Arrivo</span>
                <span class="meeting-time-badge">${next.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            
            <div>
                <div class="meeting-title">${next.title}</div>
                <div style="opacity: 0.8; margin-top: 0.5rem;">${next.client || 'Nessun dettaglio'}</div>
            </div>

            <div style="margin-top: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                <span class="material-icons-round" style="font-size: 1rem;">schedule</span>
                <span style="font-size: 0.9rem;">${Math.round((next.end - next.start) / (1000 * 60))} min</span>
            </div>

            <button class="join-btn" onclick="window.location.hash='agenda'">
                Vedi in Agenda
            </button>
        </div>
    `;
}

function renderProjects(container, projects) {
    if (!projects.length) {
        container.innerHTML = `<div style="padding:1rem; color:var(--text-tertiary);">Nessun progetto recente.</div>`;
        return;
    }

    container.innerHTML = projects.map(p => `
        <div class="project-item" onclick="window.location.hash='order-detail/${p.id}'">
            <div class="project-icon">
                <span class="material-icons-round">folder</span>
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 600; color: var(--text-primary);">${p.title || 'Senza Titolo'}</div>
                <div style="font-size: 0.8rem; color: var(--text-tertiary);">${p.clients?.business_name || 'Cliente N/D'}</div>
            </div>
            <div style="text-align: right;">
                 <div style="font-size: 0.75rem; color: var(--text-tertiary);">Aggiornato</div>
                 <div style="font-size: 0.8rem; font-weight: 500;">${new Date(p.updated_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}</div>
            </div>
        </div>
    `).join('');
}
