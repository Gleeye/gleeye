import { state } from '../modules/state.js?v=151';
import { supabase } from '../modules/config.js?v=151';
import { formatAmount } from '../modules/utils.js?v=151';

import { fetchAvailabilityRules, fetchAvailabilityOverrides, fetchCollaborators, fetchAssignments, upsertAssignment } from '../modules/api.js?v=151';
import { fetchAppointment } from '../modules/pm_api.js?v=151';

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
                color: color,
                // Full attributes for Modal
                orders: a.orders,
                appointment_internal_participants: a.appointment_internal_participants,
                appointment_client_participants: a.appointment_client_participants, // If available
                location: a.location,
                mode: a.mode,
                note: a.note,
                status: a.status
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
    const myId = myCollab.id;

    // --- FETCH DATA FOR "MY ACTIVITIES" ---
    let myTasks = [], activeTimers = [], events = [];
    // Default filter state (User requested: Task, Appuntamenti, Attività)
    if (!window.hpActivityFilter) window.hpActivityFilter = 'task';

    try {
        // 1. TIMERS (Active)
        const { data: timers } = await supabase
            .from('activity_logs')
            .select(`
                *,
                orders (id, order_number, title)
            `)
            .eq('collaborator_id', myId)
            .is('end_time', null);
        activeTimers = timers || [];

        // 2. TASKS (From PM Items)
        // Use user_ref (Auth ID) for assignment check.
        const targetUserId = myCollab.user_id || state.session?.user?.id;

        const { data: pmTasks, error: pmError } = await supabase
            .from('pm_items')
            .select(`
                *,
                pm_spaces (
                    ref_ordine,
                    orders (order_number, title)
                ),
                pm_item_assignees!inner(user_ref)
            `)
            .eq('pm_item_assignees.user_ref', targetUserId)
            .neq('status', 'done')
            .neq('status', 'completed');

        if (pmError) console.error("PM Tasks fetch error:", pmError);

        myTasks = (pmTasks || []).map(t => {
            // Robustly extract order
            let ord = null;
            if (t.pm_spaces) {
                const space = Array.isArray(t.pm_spaces) ? t.pm_spaces[0] : t.pm_spaces;
                if (space && space.orders) {
                    ord = Array.isArray(space.orders) ? space.orders[0] : space.orders;
                }
            }
            return {
                id: t.id,
                title: t.title,
                status: t.status,
                due_date: t.due_date,
                orders: ord,
                type: 'pm_task'
            };
        });

        // 3. EVENTS (Today/Upcoming)
        events = await fetchDateEvents(myId, new Date());

    } catch (err) {
        console.error("Error fetching My Activities data:", err);
    }

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

            <!-- Top Grid: Timeline + My Activities -->
            <div style="height: 100%; display: flex; gap: 1.5rem; overflow: hidden;">
                <!-- LEFT: TIMELINE (Main) -->
                <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                    <!-- HEADER (Date Nav) -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex: 0 0 auto;">
                         <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); font-family: var(--font-titles);">Oggi</h2>
                         <div style="display: flex; gap: 0.5rem;">
                             <button class="icon-btn" onclick="changeHomepageDate(-1)"><span class="material-icons-round">chevron_left</span></button>
                             <button class="btn btn-secondary" onclick="resetHomepageDate()">Oggi</button>
                             <button class="icon-btn" onclick="changeHomepageDate(1)"><span class="material-icons-round">chevron_right</span></button>
                         </div>
                    </div>

                    <!-- TIMELINE WRAPPER -->
                    <div id="hp-timeline-wrapper" style="flex: 1; position: relative; background: white; border-radius: 16px; border: 1px solid var(--glass-border); box-shadow: var(--shadow-sm); overflow: hidden;">
                        <!-- Rendered by JS -->
                    </div>
                </div>

                <!-- RIGHT: MY ACTIVITIES (Side Panel) -->
                <div style="width: 320px; flex: 0 0 auto; display: flex; flex-direction: column; gap: 1rem;">
                    <!-- "MY ACTIVITIES" CARD -->
                    <div class="glass-card" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; flex: 1; overflow: hidden; background: #1e293b; color: white;">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;">
                             <!-- TEXT TABS -->
                             <div style="display: flex; gap: 1rem; font-size: 0.85rem; font-weight: 600;">
                                <button onclick="window.setHpFilter('task', this)" class="tab-btn ${window.hpActivityFilter === 'task' ? 'active' : ''}">Task</button>
                                <button onclick="window.setHpFilter('event', this)" class="tab-btn ${window.hpActivityFilter === 'event' ? 'active' : ''}">Appuntamenti</button>
                                <button onclick="window.setHpFilter('timer', this)" class="tab-btn ${window.hpActivityFilter === 'timer' ? 'active' : ''}">Attività</button>
                             </div>
                        </div>

                        <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; padding-right: 4px;" id="hp-activities-list">
                            <!-- Content Injected Below -->
                        </div>

                        <button class="btn btn-primary" style="width: 100%; justify-content: center; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);" onclick="window.location.hash='agenda'">
                            Vedi Agenda
                        </button>
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
    // Store current date for timeline navigation
    window.homepageCurrentDate = new Date();
    window.homepageCollaboratorId = myCollab.id;

    // Function to update timeline and header date
    window.updateHomepageTimeline = async (date) => {
        const timelineWrapper = document.getElementById('hp-timeline-wrapper');
        const headerDate = container.querySelector('.homepage-header h1').nextElementSibling; // The <p> tag
        const headerTitle = container.querySelector('.homepage-header h1');

        // Update header date
        headerDate.innerHTML = `Ecco cosa c'è in programma per ${date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}.`;
        headerTitle.textContent = `Buongiorno, ${firstName}!`; // Reset if it changed

        timelineWrapper.innerHTML = `<div style="padding: 2rem; width: 100%; text-align: center; color: var(--text-tertiary);"><span class="loader small"></span> Caricamento...</div>`;

        try {
            // Parallel Fetch: Events + Availability + Google + Overrides
            const [events, rules, googleBusy, overrides] = await Promise.all([
                fetchDateEvents(window.homepageCollaboratorId, date),
                fetchAvailabilityRules(window.homepageCollaboratorId),
                fetchGoogleCalendarBusy(window.homepageCollaboratorId, date),
                fetchAvailabilityOverrides(window.homepageCollaboratorId) // from api.js
            ]);

            // Filter rules for specific day of week
            const dayId = date.getDay(); // 0-6
            const dayRules = rules.filter(r => r.day_of_week === dayId);

            renderTimeline(timelineWrapper, events, date, dayRules, googleBusy, overrides);
        } catch (e) {
            console.error(e);
            timelineWrapper.innerHTML = `<div style="color:red; text-align:center;">Errore caricamento</div>`;
        }
    };

    window.changeHomepageDate = (offset) => {
        window.homepageCurrentDate.setDate(window.homepageCurrentDate.getDate() + offset);
        window.updateHomepageTimeline(window.homepageCurrentDate);
    };

    window.resetHomepageDate = () => {
        window.homepageCurrentDate = new Date();
        window.updateHomepageTimeline(window.homepageCurrentDate);
    };

    // --- Initial Load ---
    try {
        // 1. Timeline (Default Today)
        window.updateHomepageTimeline(window.homepageCurrentDate);

        // 2. Render My Activities
        // Store data for filtering reference
        window.hpData = {
            timers: activeTimers,
            tasks: myTasks,
            events: events
        };
        // Initial render with current filter
        renderMyActivities(document.getElementById('hp-activities-list'), activeTimers, myTasks, events, window.hpActivityFilter);

        // 3. Load Projects
        const projects = await fetchRecentProjects();
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

    // A. RENDER AVAILABILITY (Purple Line at TOP)
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

    // 2b. MASK with Google Busy (User request: "lascialo bianco... se su calendar è occupato")
    // This means we remove the "Available" line where Google says it's busy.
    // We do NOT draw gray blocks.

    // Simplify algorithm: We subtract Google Busy intervals from Open Slots.
    let finalSlots = [];

    openSlots.forEach(slot => {
        let pieces = [slot]; // Start with the full slot

        googleBusy.forEach(busy => {
            const startD = new Date(busy.start);
            const endD = new Date(busy.end);

            // Normalize busy time to minutes of current view day
            const viewStartD = new Date(date).setHours(0, 0, 0, 0);
            const viewEndD = new Date(date).setHours(23, 59, 59, 999);

            const bStartMs = Math.max(startD.getTime(), viewStartD);
            const bEndMs = Math.min(endD.getTime(), viewEndD);

            if (bEndMs <= bStartMs) return; // Busy slot not in today

            const bStart = (bStartMs - viewStartD) / 60000;
            const bEnd = (bEndMs - viewStartD) / 60000;

            // Subtract [bStart, bEnd] from current pieces
            let newPieces = [];
            pieces.forEach(p => {
                // No overlap
                if (bEnd <= p.start || bStart >= p.end) {
                    newPieces.push(p);
                    return;
                }

                // Overlap: Split
                if (p.start < bStart) {
                    newPieces.push({ start: p.start, end: bStart });
                }
                if (p.end > bEnd) {
                    newPieces.push({ start: bEnd, end: p.end });
                }
            });
            pieces = newPieces;
        });

        finalSlots.push(...pieces);
    });

    // Render Final Open Slots (Top Purple Line)
    finalSlots.forEach(slot => {
        if (slot.start >= slot.end) return;

        const left = slot.start * pixelsPerMinute;
        const width = (slot.end - slot.start) * pixelsPerMinute;

        // "Magari metterla in alto" + "Più leggera"
        const line = document.createElement('div');
        line.title = "Disponibile";
        line.style.position = 'absolute';
        line.style.left = `${left}px`;
        line.style.width = `${width}px`;
        line.style.top = '0'; // Top
        line.style.height = '3px'; // Thinner
        line.style.background = '#d8b4fe'; // Lighter Purple (Tailwind purple-300)
        line.style.zIndex = '5';
        line.style.borderRadius = '0 0 2px 2px';
        line.style.opacity = '0.8';
        overlay.appendChild(line);
    });

    // B. GOOGLE BUSY -> REMOVED VISUALS (User request: "lascialo in bianco")

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

        // Custom Color Logic
        // User Request: STRICT CATEGORY COLORS.
        // "Appointment" = Purple (#a855f7)
        // "Booking" = Blue (#3b82f6)
        // Ignoring specific subtype colors to avoid specific "yellow/orange" confusion.

        let bgColor = '#3b82f6'; // Default

        if (ev.type === 'appointment') {
            bgColor = '#a855f7'; // Always Purple
        } else if (ev.type === 'booking') {
            bgColor = '#3b82f6'; // Always Blue
        }

        el.style.background = bgColor;
        el.style.boxShadow = `0 4px 12px ${bgColor}40`;
        el.style.cursor = 'pointer'; // Clickable
        el.style.color = 'white'; // FORCE WHITE TEXT

        // INTERACTION
        const evtId = `evt_hp_${ev.id.replace(/-/g, '_')}`;
        window[evtId] = ev;
        el.setAttribute('onclick', `openHomepageEventDetails(window['${evtId}'])`);
        el.onmouseover = function () { this.style.transform = 'translateY(-1px)'; this.style.boxShadow = `0 6px 16px ${bgColor}50`; };
        el.onmouseout = function () { this.style.transform = 'none'; this.style.boxShadow = `0 4px 12px ${bgColor}40`; };

        // READABILITY: Handle Small Blocks
        const isSmall = width < 60;
        const isTiny = width < 30;

        if (isTiny) {
            // No Text, just tooltip
            el.title = `${ev.title} (${ev.client || '-'})`;
        } else {
            let htmlContent = `<div style="font-weight: 700; margin-bottom: ${isSmall ? '0' : '2px'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.8rem; line-height: 1.2;">${ev.title}</div>`;

            if (!isSmall) {
                htmlContent += `<div style="font-size: 0.7rem; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ev.client || ''}</div>`;
            }
            el.innerHTML = htmlContent;
        }

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

// --- EVENT DETAIL MODAL (Now unified via agenda_utils.js) ---
import { openEventDetails } from './agenda_utils.js?v=152';

window.openHomepageEventDetails = openEventDetails; // Compatibility Alias

window.closeHomepageEventModal = function (id) {
    const el = document.getElementById(id);
    if (el) el.remove();
};

// Helper for Filter Switching
window.setHpFilter = function (filter, btn) {
    if (!btn) return;
    window.hpActivityFilter = filter;

    // Update UI buttons
    const container = btn.closest('div');
    if (container) {
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    }
    btn.classList.add('active');

    // Re-render
    if (window.hpData) {
        renderMyActivities(document.getElementById('hp-activities-list'), window.hpData.timers, window.hpData.tasks, window.hpData.events, filter);
    }
};

function renderMyActivities(container, timers, tasks, events, filter = 'task') {
    if (!container) return;

    // Filter Logic
    const showTimers = filter === 'timer'; // Attività
    const showEvents = filter === 'event'; // Appuntamenti (Agenda)
    const showTasks = filter === 'task';  // Task

    let html = '';
    let hasContent = false;
    const now = new Date();

    try {
        // 1. ACTIVE TIMERS (Attività)
        if (showTimers) {
            if (timers && timers.length > 0) {
                timers.forEach(t => {
                    hasContent = true;
                    // Handle Orders
                    let title = 'Senza Commessa';
                    if (t.orders) {
                        // Check for array just in case
                        const ord = Array.isArray(t.orders) ? t.orders[0] : t.orders;
                        if (ord) title = `#${ord.order_number || '?'} - ${ord.title || '...'}`;
                    }

                    html += `
                        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 0.75rem; border-radius: 8px; display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.5rem;">
                            <div style="width: 32px; height: 32px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;">
                                <span class="material-icons-round" style="font-size: 18px;">play_arrow</span>
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-size: 0.65rem; color: #6ee7b7; font-weight: 700; text-transform: uppercase;">In Corso</div>
                                <div style="font-weight: 600; font-size: 0.85rem; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${title}">${title}</div>
                            </div>
                        </div>
                    `;
                });
            }
            if (!hasContent) html += `<div style="text-align: center; color: rgba(255,255,255,0.4); font-size: 0.8rem; padding: 2rem;">Nessuna attività in corso.</div>`;
        }

        // 2. UPCOMING APPOINTMENTS (Agenda)
        if (showEvents) {
            const upcomingEvents = (events || []).filter(e => e.end > now);
            if (upcomingEvents.length > 0) {
                upcomingEvents.forEach(evt => {
                    hasContent = true;
                    const timeStr = evt.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    html += `
                        <div style="background: transparent; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding: 0.75rem 0; display: flex; gap: 0.75rem; align-items: center; cursor: pointer;" onclick="openHomepageEventDetails(window['evt_hp_${evt.id.replace(/-/g, '_')}'])">
                            <div style="display: flex; flex-direction: column; align-items: center; width: 45px; flex-shrink: 0;">
                                <span style="font-size: 0.8rem; font-weight: 600; color: white;">${timeStr}</span>
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: 600; font-size: 0.9rem; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${evt.title}</div>
                                <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6);">${evt.client || ''}</div>
                            </div>
                        </div>
                    `;
                });
            }
            if (!hasContent) html += `<div style="text-align: center; color: rgba(255,255,255,0.4); font-size: 0.8rem; padding: 2rem;">Nessun appuntamento in programma.</div>`;
        }

        // 3. TASKS
        if (showTasks) {
            if (tasks && tasks.length > 0) {
                // Defensive Sort
                tasks.sort((a, b) => {
                    const da = a.due_date ? new Date(a.due_date) : new Date('9999-12-31');
                    const db = b.due_date ? new Date(b.due_date) : new Date('9999-12-31');
                    return da - db;
                });

                tasks.forEach(t => {
                    hasContent = true;
                    // Correctly access nested Order fields
                    let fullTitle = 'No Commessa';
                    if (t.orders) {
                        const ord = Array.isArray(t.orders) ? t.orders[0] : t.orders;
                        if (ord) fullTitle = `#${ord.order_number} - ${ord.title}`;
                    }

                    const isLate = t.due_date && new Date(t.due_date) < new Date();

                    html += `
                        <div style="background: transparent; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding: 0.75rem 0; display: flex; gap: 0.75rem; align-items: flex-start;">
                             <div style="padding-top: 2px;">
                                <input type="checkbox" style="width: 18px; height: 18px; accent-color: #10b981; cursor: pointer; border-radius: 4px;" onclick="window.quickCompleteTask('${t.id}', this)" title="Segna come completato">
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                 <div style="font-size: 0.75rem; color: #cbd5e1; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600;">
                                    ${fullTitle}
                                    ${isLate ? `<span style="color: #f87171; margin-left:6px;">!</span>` : ''}
                                </div>
                                <div style="font-size: 0.85rem; color: rgba(255,255,255,0.8); line-height: 1.3;">${t.title}</div>
                            </div>
                        </div>
                    `;
                });
            }
            if (!hasContent) html += `<div style="text-align: center; color: rgba(255,255,255,0.4); font-size: 0.8rem; padding: 2rem;">Nessun task da completare.</div>`;
        }

        container.innerHTML = html;

    } catch (e) {
        console.error("Render Activities Error:", e);
        container.innerHTML = `<div style="color: #f87171; padding: 1rem;">Errore visualizzazione: ${e.message}</div>`;
    }
}

// Helper for Task Completion
window.quickCompleteTask = async function (id, checkbox) {
    if (!confirm("Completare questo task?")) {
        checkbox.checked = false;
        return;
    }

    // Optimistic UI
    const row = checkbox.closest('div[style*="background"]');
    if (row) row.style.opacity = '0.3';

    try {
        await upsertAssignment({ id: id, status: 'completed' });
        // Refresh? For now just hide
        if (row) row.remove();
        // Update stats counter?
    } catch (e) {
        console.error("Task completion failed", e);
        checkbox.checked = false;
        if (row) row.style.opacity = '1';
        alert("Errore nel completamento task.");
    }
};

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
