import { state } from '../modules/state.js?v=151';
import { supabase } from '../modules/config.js?v=151';
import { formatAmount } from '../modules/utils.js?v=151';

import { fetchAvailabilityRules, fetchAvailabilityOverrides } from '../modules/api.js?v=151';

// We reuse fetchMyBookings but we might need a tighter scoped fetch for "Today"
// Actually fetchMyBookings stores in `eventsCache` (not exported) or `window`?
// Let's create a dedicated fetch or use the general one if accessible.
// Since `personal_agenda.js` doesn't export the cache cleanly, we'll fetch explicitly here.

async function fetchDateEvents(collaboratorId, date) {
    const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);

    // 1. Fetch Bookings
    const { data: bookings } = await supabase
        .from('bookings')
        .select(`
            *,
            booking_items (name, duration),
            booking_assignments!inner(collaborator_id),
            guest_info
        `)
        .eq('booking_assignments.collaborator_id', collaboratorId)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .neq('status', 'cancelled');

    // 2. Fetch Appointments (Use correct relation table)
    const { data: appointments } = await supabase
        .from('appointments')
        .select(`
            *,
            appointment_internal_participants!inner(collaborator_id),
            appointment_type_links (
                appointment_types (id, name, color)
            ),
            orders (
                clients (business_name)
            )
        `)
        .eq('appointment_internal_participants.collaborator_id', collaboratorId)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .neq('status', 'cancelled')
        .neq('status', 'annullato');

    // Merge & normalize
    const events = [];
    if (bookings) {
        bookings.forEach(b => {
            // Parse times (UTC -> Local)
            const start = new Date(b.start_time);
            const end = new Date(b.end_time);

            // Extract Client Name safely
            let clientName = 'Cliente';
            if (b.guest_info) {
                if (typeof b.guest_info === 'string') {
                    try { const g = JSON.parse(b.guest_info); clientName = g.company || (g.first_name + ' ' + g.last_name); } catch (e) { }
                } else {
                    clientName = b.guest_info.company || (b.guest_info.first_name + ' ' + b.guest_info.last_name);
                }
            }

            events.push({
                id: b.id,
                title: b.booking_items?.name || 'Prenotazione',
                start: start,
                end: end,
                type: 'booking',
                client: clientName
            });
        });
    }
    if (appointments) {
        appointments.forEach(a => {
            const start = new Date(a.start_time);
            const end = new Date(a.end_time);

            // Extract Client from Order
            const clientName = a.orders?.clients?.business_name || (a.client_name || 'Appuntamento');

            // Extract Color
            let color = null;
            if (a.appointment_type_links?.length > 0) {
                color = a.appointment_type_links[0].appointment_types?.color;
            }

            events.push({
                id: a.id,
                title: a.title || 'Appuntamento',
                start: start,
                end: end,
                type: 'appointment',
                client: clientName,
                color: color
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

    // Determine which collaborator to show (support impersonation)
    let myCollab;
    if (state.impersonatedCollaboratorId) {
        myCollab = state.collaborators.find(c => c.id === state.impersonatedCollaboratorId);
    }
    if (!myCollab) {
        myCollab = state.collaborators.find(c => c.email === user.email);
    }

    if (!myCollab) {
        container.innerHTML = `<div style="padding:2rem;">Profilo non trovato. Contatta l'amministratore.</div>`;
        return;
    }

    const firstName = myCollab.first_name || 'Utente';

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
                        <h3 class="widget-title" id="timeline-title">Orario di Oggi</h3>
                        <div class="timeline-controls">
                            <button class="timeline-btn active" id="btn-today">Oggi</button>
                            <button class="timeline-btn" id="btn-tomorrow">Domani</button>
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
                            <span class="loader small"></span>
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

    // --- Interaction Logic ---
    const btnToday = container.querySelector('#btn-today');
    const btnTomorrow = container.querySelector('#btn-tomorrow');
    const timelineTitle = container.querySelector('#timeline-title');
    const timelineArea = container.querySelector('#home-timeline-area');

    const loadTimeline = async (dateMode) => { // 'today' or 'tomorrow'
        timelineArea.innerHTML = `<div style="padding: 2rem; width: 100%; text-align: center; color: var(--text-tertiary);"><span class="loader small"></span> Caricamento...</div>`;

        const targetDate = new Date(); // Start with NOW
        if (dateMode === 'tomorrow') {
            targetDate.setDate(targetDate.getDate() + 1); // Move to tomorrow
            timelineTitle.textContent = "Orario di Domani";
            btnToday.classList.remove('active');
            btnTomorrow.classList.add('active');
        } else {
            timelineTitle.textContent = "Orario di Oggi";
            btnToday.classList.add('active');
            btnTomorrow.classList.remove('active');
        }

        try {
            // Parallel Fetch: Events + Availability + Google + Overrides
            const [events, rules, googleBusy, overrides] = await Promise.all([
                fetchDateEvents(myCollab.id, targetDate),
                fetchAvailabilityRules(myCollab.id),
                fetchGoogleCalendarBusy(myCollab.id, targetDate),
                fetchAvailabilityOverrides(myCollab.id) // from api.js
            ]);

            // Filter rules for specific day of week
            const dayId = targetDate.getDay(); // 0-6
            const dayRules = rules.filter(r => r.day_of_week === dayId);

            renderTimeline(timelineArea, events, targetDate, dayRules, googleBusy, overrides);
        } catch (e) {
            console.error(e);
            timelineArea.innerHTML = `<div style="color:red; text-align:center;">Errore caricamento</div>`;
        }
    };

    btnToday.onclick = () => loadTimeline('today');
    btnTomorrow.onclick = () => loadTimeline('tomorrow');

    // --- Initial Load ---
    try {
        // 1. Timeline (Default Today)
        loadTimeline('today');

        // 2. Next Up (Always dynamic from NOW)
        const todayEvents = await fetchDateEvents(myCollab.id, new Date());

        // Find immediate next event
        let nextEvent = todayEvents.find(e => e.end > new Date());

        // If nothing today, check tomorrow?
        if (!nextEvent) {
            const tom = new Date(); tom.setDate(tom.getDate() + 1);
            const tomEvents = await fetchDateEvents(myCollab.id, tom);
            if (tomEvents.length > 0) nextEvent = tomEvents[0];
        }

        renderNextUp(container.querySelector('#home-next-up'), nextEvent);

        // 3. Load Projects
        const projects = await fetchRecentProjects();
        renderProjects(container.querySelector('#home-recent-projects'), projects);

    } catch (e) {
        console.error("Home Data Load Error:", e);
    }
}

// --- GOOGLE & AVAILABILITY HELPERS ---

async function fetchGoogleCalendarBusy(collaboratorId, date) {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);

    // Call existing cloud function
    try {
        const { data, error } = await supabase.functions.invoke('check-google-availability', {
            body: {
                collaborator_id: collaboratorId,
                timeMin: start.toISOString(),
                timeMax: end.toISOString()
            }
        });
        if (error || data?.error) return [];
        return data?.busy || [];
    } catch (e) {
        console.warn("Google Fetch Error:", e);
        return [];
    }
}

// --- MAIN RENDER LOGIC ---

function renderTimeline(container, events, date = new Date(), availabilityRules = [], googleBusy = [], overrides = []) {
    // 1. Range Config: Full Day 00:00 - 24:00 (user request)
    const startHour = 0;
    const endHour = 24;
    const isToday = new Date().toDateString() === date.toDateString();

    // 2. Prepare Data
    const eventsSafe = events || [];

    // 3. Layout Constants
    // We want the whole day to be scrollable but clearly readable.
    // 00-06 is night (condensed?), 07-20 work (expanded?), 21-23 night.
    // For simplicity, consistent width.
    const colWidth = 100; // px per hour
    const totalWidth = (endHour - startHour) * colWidth;
    const pixelsPerMinute = colWidth / 60;
    const viewStartM = startHour * 60;

    // 4. Generate Track (Clean Background)
    // Clean white backbone
    let html = '';
    for (let h = startHour; h < endHour; h++) {
        html += `
            <div class="timeline-hour-col" data-hour="${h}" style="
                width: ${colWidth}px; 
                min-width: ${colWidth}px; 
                border-left: 1px solid var(--glass-border); 
                position: relative;
            ">
                <div class="timeline-hour-label" style="
                    position: absolute; 
                    top: 8px; 
                    left: 8px; 
                    font-size: 0.75rem; 
                    color: var(--text-tertiary);
                    font-weight: 500;
                ">${h}:00</div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="timeline-track" style="
            display: flex; 
            position: relative; 
            width: ${totalWidth}px; 
            min-width: ${totalWidth}px; 
            padding-left: 0; 
            background: white;
            height: 100%;
        ">
            ${html}
        </div>
    `;
    const track = container.querySelector('.timeline-track');

    // OVERLAY Container for all Blocks
    const overlay = document.createElement('div');
    overlay.className = 'timeline-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.height = '100%';
    overlay.style.width = '100%';
    overlay.style.pointerEvents = 'none';

    // A. RENDER AVAILABILITY (Purple Vertical Line)
    // Rules + Overrides (Extra specific slots for this date)

    // Merge Rules and Overrides into a "Open Slots" list
    let openSlots = [];

    // 1. Weekly Rules
    availabilityRules.forEach(r => {
        if (!r.start_time || !r.end_time) return;
        const [sh, sm] = r.start_time.split(':').map(Number);
        const [eh, em] = r.end_time.split(':').map(Number);
        const sM = (sh * 60) + sm;
        const eM = (eh * 60) + em;
        openSlots.push({ start: sM, end: eM, source: 'rule' });
    });

    // 2. Extra Overrides (Specific Date)
    overrides.forEach(o => {
        if (new Date(o.date).toDateString() !== date.toDateString()) return;
        const [sh, sm] = o.start_time.split(':').map(Number);
        const [eh, em] = o.end_time.split(':').map(Number);
        const sM = (sh * 60) + sm;
        const eM = (eh * 60) + em;
        openSlots.push({ start: sM, end: eM, source: 'override' });
    });

    // Render Open Slots (Purple Line)
    openSlots.forEach(slot => {
        if (slot.start >= slot.end) return;

        const left = slot.start * pixelsPerMinute;
        const width = (slot.end - slot.start) * pixelsPerMinute;

        // Render a purple line/bar at the bottom or top? 
        // User said "Purple Line" like in Agenda. Agenda uses a vertical line on the left of the day column or a block.
        // In a Horizontal Timeline, this usually translates to a bottom bar or a background color.
        // BUT user said "la riga viola... non sono inventate".
        // In the vertical agenda, it's a vertical line on the left.
        // In this HORIZONTAL timeline, the equivalent is a HORIZONTAL line or bar.
        // Let's render a nice Purple Bar at the bottom of the track (or top).
        // Let's put it at the bottom distinctively.

        const line = document.createElement('div');
        line.title = "Disponibile";
        line.style.position = 'absolute';
        line.style.left = `${left}px`;
        line.style.width = `${width}px`;
        line.style.bottom = '0';
        line.style.height = '4px'; // Subtle line
        line.style.background = '#a855f7'; // Purple
        line.style.zIndex = '5';
        line.style.borderRadius = '2px';
        line.style.boxShadow = '0 0 8px rgba(168, 85, 247, 0.6)';
        overlay.appendChild(line);

        // Optional: faint background to make it clearer?
        const bg = document.createElement('div');
        bg.style.position = 'absolute';
        bg.style.left = `${left}px`;
        bg.style.width = `${width}px`;
        bg.style.height = '100%';
        bg.style.background = 'rgba(168, 85, 247, 0.03)'; // Very faint purple tint
        bg.style.zIndex = '1';
        overlay.appendChild(bg);
    });

    // B. GOOGLE BUSY (Gray Blocks) - Overlaying everything
    googleBusy.forEach(busy => {
        const startD = new Date(busy.start);
        const endD = new Date(busy.end);

        const viewStartD = new Date(date).setHours(0, 0, 0, 0);
        const viewEndD = new Date(date).setHours(23, 59, 59, 999);

        const effectiveStart = Math.max(startD.getTime(), viewStartD);
        const effectiveEnd = Math.min(endD.getTime(), viewEndD);

        if (effectiveEnd <= effectiveStart) return;

        const startM = (effectiveStart - viewStartD) / 60000;
        const durationM = (effectiveEnd - effectiveStart) / 60000;

        const left = startM * pixelsPerMinute;
        const width = durationM * pixelsPerMinute;

        const block = document.createElement('div');
        block.className = 'google-busy-slot';
        block.style.position = 'absolute';
        block.style.left = `${left}px`;
        block.style.width = `${width}px`;
        block.style.height = '100%';
        block.style.background = 'repeating-linear-gradient(45deg, #e2e8f0, #e2e8f0 10px, #cbd5e1 10px, #cbd5e1 20px)';
        block.style.opacity = '0.5';
        block.style.zIndex = '20'; // Above Events? Or Below? Usually below events but above availability.
        // User said "al netto degli impegni". Usually busy slots block availability.
        block.title = "Impegnato (Google)";
        overlay.appendChild(block);
    });

    // C. INTERNAL EVENTS (Colorful Cards)
    eventsSafe.forEach(ev => {
        const startTotalM = (ev.start.getHours() * 60) + ev.start.getMinutes();
        const durationM = (ev.end - ev.start) / (1000 * 60);

        const left = startTotalM * pixelsPerMinute;
        const width = durationM * pixelsPerMinute;

        const el = document.createElement('div');
        el.className = `timeline-event-card ${ev.end < new Date() ? 'past' : ''}`;
        el.style.left = `${left}px`;
        el.style.width = `${Math.max(width - 2, 4)}px`;
        el.style.zIndex = '30'; // Top
        el.style.pointerEvents = 'auto';

        // Custom Color Logic (User Request: Appts=Purple, Bookings=Blue)
        let bgColor = '#3b82f6'; // Default Blue (Booking)

        if (ev.type === 'appointment') {
            bgColor = ev.color || '#a855f7';
        } else if (ev.type === 'booking') {
            bgColor = '#3b82f6';
        }

        el.style.background = bgColor;
        el.style.boxShadow = `0 4px 12px ${bgColor}40`;

        el.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.8rem;">${ev.title}</div>
            <div style="font-size: 0.7rem; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ev.client}</div>
        `;

        overlay.appendChild(el);
    });

    // D. "NOW" LINE
    let scrollTargetLeft = 0;
    if (isToday) {
        const now = new Date();
        const currentM = (now.getHours() * 60) + now.getMinutes();
        const left = currentM * pixelsPerMinute;

        const nowLine = document.createElement('div');
        nowLine.className = 'timeline-now-line';
        nowLine.style.position = 'absolute';
        nowLine.style.left = `${left}px`;
        nowLine.style.top = '0';
        nowLine.style.height = '100%';
        nowLine.style.width = '2px';
        nowLine.style.backgroundColor = '#ec4899';
        nowLine.style.zIndex = '50';
        nowLine.style.boxShadow = '0 0 8px rgba(236, 72, 153, 0.6)';

        const nowDot = document.createElement('div');
        nowDot.style.position = 'absolute';
        nowDot.style.top = '-4px';
        nowDot.style.left = '-3px';
        nowDot.style.width = '8px';
        nowDot.style.height = '8px';
        nowDot.style.borderRadius = '50%';
        nowDot.style.backgroundColor = '#ec4899';
        nowLine.appendChild(nowDot);

        overlay.appendChild(nowLine);

        // Auto Scroll to Now - Center
        scrollTargetLeft = Math.max(0, left - (container.clientWidth / 2));
    } else {
        // If tomorrow, scroll to first event or 08:00
        const firstEventM = openSlots.length > 0 ? openSlots[0].start : 8 * 60;
        scrollTargetLeft = Math.max(0, (firstEventM * pixelsPerMinute) - 100);
    }

    track.appendChild(overlay);

    setTimeout(() => {
        container.scrollTo({
            left: scrollTargetLeft,
            behavior: 'smooth'
        });
    }, 100);
}

function renderNextUp(container, next) {
    const now = new Date();
    // Find first event that hasn't ended yet

    if (!next) {
        container.innerHTML = `
             <div class="next-up-content">
                <span style="opacity: 0.7;">Prossimo Impegno</span>
                <div style="text-align: center; padding: 2rem;">
                    <span class="material-icons-round" style="font-size: 3rem; opacity: 0.5;">done_all</span>
                    <p style="margin-top: 1rem;">Nessun impegno in arrivo</p>
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
