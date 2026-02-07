import { state } from '../modules/state.js?v=317';
import { supabase } from '../modules/config.js?v=317';
import { formatAmount } from '../modules/utils.js?v=317';

import { fetchAvailabilityRules, fetchAvailabilityOverrides, fetchCollaborators, fetchAssignments, upsertAssignment } from '../modules/api.js?v=317';
import { fetchAppointment, updatePMItem } from '../modules/pm_api.js?v=317';

// We reuse fetchMyBookings but we might need a tighter scoped fetch for "Today"
// Actually fetchMyBookings stores in `eventsCache` (not exported) or `window`?
// Let's create a dedicated fetch or use the general one if accessible.
// Since `personal_agenda.js` doesn't export the cache cleanly, we'll fetch explicitly here.

async function fetchDateEvents(collaboratorId, startArg, endArg) {
    let start, end;
    if (endArg) {
        start = new Date(startArg);
        end = new Date(endArg);
    } else {
        start = new Date(startArg); start.setHours(0, 0, 0, 0);
        end = new Date(startArg); end.setHours(23, 59, 59, 999);
    }

    // ISO Strings for Queries
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    // 1. Fetch Bookings
    const { data: bookings } = await supabase
        .from('bookings')
        .select(`
            *,
            booking_items (name, duration_minutes),
            booking_assignments!inner(collaborator_id),
            guest_info
        `)
        .eq('booking_assignments.collaborator_id', collaboratorId)
        .gte('start_time', startIso)
        .lte('start_time', endIso)
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
        .gte('start_time', startIso)
        .lte('start_time', endIso)
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

async function fetchRecentProjects(collabId, userUuid) {
    try {
        const userId = userUuid || state.session?.user?.id;
        const collaboratorId = collabId || state.profile?.id;

        if (!userId) {
            console.log("[Homepage] No user session found for recent projects");
            return [];
        }

        // 1. Identify which orders this user technically "owns" for LINK routing only
        const { data: myManagedSpaces } = await supabase
            .from('pm_spaces')
            .select('ref_ordine')
            .eq('default_pm_user_ref', userId)
            .eq('type', 'commessa');

        const managedOrderIds = new Set((myManagedSpaces || []).map(s => s.ref_ordine).filter(Boolean));

        // 2. Filter for "In Svolgimento" only (as requested)
        const isInSvolgimento = (status) => {
            if (!status) return false;
            const s = status.toLowerCase();
            return s.includes('svolgimento') || s.includes('in corso');
        };

        const projectsMap = new Map();

        // --- STEP 1: Fetch Assigned Orders (order_collaborators) ---
        if (collaboratorId) {
            const { data: assigned } = await supabase
                .from('order_collaborators')
                .select(`
                    orders (id, title, order_number, status_works, clients(business_name), created_at)
                `)
                .eq('collaborator_id', collaboratorId);

            if (assigned) {
                assigned.forEach(item => {
                    const o = item.orders;
                    if (!o || projectsMap.has(o.id)) return;
                    if (!isInSvolgimento(o.status_works)) return;

                    projectsMap.set(o.id, {
                        id: o.id,
                        order_number: o.order_number,
                        title: o.title || 'Senza Titolo',
                        client: o.clients?.business_name || 'No Cliente',
                        status: o.status_works,
                        last_active: o.created_at,
                        link: `#pm/commessa/${o.id}` // Always Go to Hub
                    });
                });
            }
        }

        // --- STEP 2: Fetch Orders where specifically designated as PM (orders.pm_id) ---
        if (collaboratorId) {
            const { data: managed } = await supabase
                .from('orders')
                .select('id, title, order_number, status_works, clients(business_name), created_at')
                .eq('pm_id', collaboratorId);

            if (managed) {
                managed.forEach(o => {
                    if (projectsMap.has(o.id)) return;
                    if (!isInSvolgimento(o.status_works)) return;

                    projectsMap.set(o.id, {
                        id: o.id,
                        order_number: o.order_number,
                        title: o.title || 'Senza Titolo',
                        client: o.clients?.business_name || 'No Cliente',
                        status: o.status_works,
                        last_active: o.created_at,
                        link: `#pm/commessa/${o.id}`
                    });
                });
            }
        }

        // --- STEP 3: Recent Personal Activity (activity_logs) ---
        if (collaboratorId) {
            const { data: recentLogs } = await supabase
                .from('activity_logs')
                .select(`
                    created_at,
                    orders (id, title, order_number, status_works, clients(business_name))
                `)
                .eq('collaborator_id', collaboratorId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (recentLogs) {
                recentLogs.forEach(log => {
                    const o = log.orders;
                    if (!o) return;

                    if (projectsMap.has(o.id)) {
                        const existing = projectsMap.get(o.id);
                        if (new Date(log.created_at) > new Date(existing.last_active)) {
                            existing.last_active = log.created_at;
                        }
                        return;
                    }

                    if (!isInSvolgimento(o.status_works)) return;

                    projectsMap.set(o.id, {
                        id: o.id,
                        order_number: o.order_number,
                        title: o.title || 'Senza Titolo',
                        client: o.clients?.business_name || 'No Cliente',
                        status: o.status_works,
                        last_active: log.created_at,
                        link: `#pm/commessa/${o.id}`
                    });
                });
            }
        }

        // Final sort by activity date
        const results = Array.from(projectsMap.values())
            .sort((a, b) => new Date(b.last_active) - new Date(a.last_active))
            .slice(0, 20);

        console.log("[Homepage] Verified Personal Projects:", results.length, results);
        return results;

    } catch (e) {
        console.error("Error fetching recent projects:", e);
        return [];
    }
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
                pm_item_assignees!inner(user_ref, role)
            `)
            .eq('pm_item_assignees.user_ref', targetUserId)
            .neq('status', 'done');

        if (pmError) console.error("PM Tasks fetch error:", pmError);

        myTasks = (pmTasks || [])
            .map(t => {
                // Determine user's role for this item
                const myAssignment = t.pm_item_assignees.find(a => a.user_ref === targetUserId);
                const myRole = myAssignment ? myAssignment.role : 'viewer';

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
                    // Use actual item_type from DB if available, else default to 'task'
                    // Lowercase comparison to be safe
                    raw_type: t.item_type || 'task',
                    type: 'pm_task',
                    role: myRole
                };
            });
        // Removed strict role filter. 
        // The inner join on pm_item_assignees.user_ref ensures we only fetch items assigned to the user.
        // If they are assigned (even as PM), they should see it.

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
            <div style="height: 380px; display: flex; gap: 2rem; margin-top: 1rem;">
                <!-- LEFT: TIMELINE (Main) -->
                <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                    <!-- HEADER (Date Nav) -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex: 0 0 auto;">
                         <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); font-family: var(--font-titles);">Oggi</h2>
                         <div style="display: flex; background: #e5e7eb; border-radius: 20px; padding: 4px; gap: 4px;">
                             <button onclick="resetHomepageDate()" class="nav-pill active-pill" style="padding: 4px 12px; border-radius: 16px; border: none; font-weight: 600; font-size: 0.85rem; cursor: pointer; background: white; shadow: var(--shadow-sm);">Oggi</button>
                             <button onclick="changeHomepageDate(1)" class="nav-pill" style="padding: 4px 12px; border-radius: 16px; border: none; font-weight: 600; font-size: 0.85rem; cursor: pointer; background: transparent; color: #6b7280;">Domani</button>
                             <div style="position: relative; display: flex; align-items: center;">
                                <button id="hp-date-picker-btn" onclick="toggleCustomDatePicker(this)" class="nav-pill" style="padding: 4px 12px; border-radius: 16px; border: none; font-weight: 600; font-size: 0.85rem; cursor: pointer; background: transparent; color: #6b7280; display: flex; align-items: center; gap: 4px;">
                                    <span class="material-icons-round" style="font-size: 16px;">calendar_today</span> Data
                                </button>
                             </div>
                             <!-- View Switcher -->
                             <div style="height: 24px; width: 1px; background: #e5e7eb; margin: 0 4px;"></div>
                             <button onclick="toggleHomepageView('daily')" id="view-daily-btn" class="nav-pill active-pill" style="padding: 4px 12px; border-radius: 16px; border: none; font-weight: 600; font-size: 0.85rem; cursor: pointer; background: white; shadow: var(--shadow-sm);">Giorno</button>
                             <button onclick="toggleHomepageView('weekly')" id="view-weekly-btn" class="nav-pill" style="padding: 4px 12px; border-radius: 16px; border: none; font-weight: 600; font-size: 0.85rem; cursor: pointer; background: transparent; color: #6b7280;">Settimana</button>
                         </div>
                    </div>

                    <style>
                        .nav-pill:hover { background: rgba(255,255,255,0.5); }
                        .active-pill { background: white !important; color: #111 !important; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
                        /* Helper to update UI state specifically for pill highlighting would require more JS, simple toggle for now */
                    </style>

                    <!-- TIMELINE WRAPPER -->
                    <div id="hp-timeline-wrapper" style="flex: 1; position: relative; background: white; border-radius: 16px; border: 1px solid var(--glass-border); box-shadow: var(--shadow-sm); overflow-x: auto; overflow-y: hidden;">
                        <!-- Rendered by JS -->
                    </div>
                </div>

                <!-- RIGHT: MY ACTIVITIES (Side Panel) -->
                <div style="width: 340px; flex: 0 0 auto; display: flex; flex-direction: column;">
                    <!-- "MY ACTIVITIES" CARD -->
                    <div class="glass-card" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; height: 100%; overflow: hidden; background: #1e293b; color: white; border-radius: 16px;">
                        <!-- SEGMENTED CONTROL TABS (Icons) -->
                        <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 4px; display: flex; gap: 4px; flex-shrink: 0;">
                            <button onclick="window.setHpFilter('task', this)" class="tab-pill ${window.hpActivityFilter === 'task' ? 'active' : ''}" title="Task">
                                <span class="material-icons-round" style="font-size: 18px;">check_circle</span>
                                <span class="tab-count" style="margin-left: 4px;"></span>
                            </button>
                            <button onclick="window.setHpFilter('event', this)" class="tab-pill ${window.hpActivityFilter === 'event' ? 'active' : ''}" title="Appuntamenti">
                                <span class="material-icons-round" style="font-size: 18px;">event</span>
                                <span class="tab-count" style="margin-left: 4px;"></span>
                            </button>
                            <button onclick="window.setHpFilter('timer', this)" class="tab-pill ${window.hpActivityFilter === 'timer' ? 'active' : ''}" title="Attività">
                                <span class="material-icons-round" style="font-size: 18px;">schedule</span>
                                <span class="tab-count" style="margin-left: 4px;"></span>
                            </button>
                        </div>
                        
                        <style>
                            .tab-pill {
                                flex: 1;
                                border: none;
                                background: transparent;
                                color: rgba(255,255,255,0.4); /* Dimmer inactive */
                                padding: 8px 0;
                                border-radius: 8px;
                                cursor: pointer;
                                transition: all 0.2s ease;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            }
                            .tab-pill:hover {
                                color: white;
                                background: rgba(255,255,255,0.05);
                            }
                            .tab-pill.active {
                                background: rgba(255,255,255,0.15) !important;
                                color: white !important;
                                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                            }
                            .tab-count {
                                font-size: 0.75rem;
                                font-weight: 700;
                                opacity: 0.8;
                            }
                        </style>

                        <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; padding-right: 4px; min-height: 0;" id="hp-activities-list">
                            <!-- Content Injected Below -->
                        </div>

                        <button class="btn btn-primary" style="width: 100%; justify-content: center; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); flex-shrink: 0;" onclick="window.location.hash='agenda'">
                            Vedi Agenda
                        </button>
                    </div>
                </div>
            </div>

            <!-- Bottom Grid -->
            <div class="bottom-grid" style="margin-top: 3rem;">

                <!-- Recent Projects -->
                <div class="dashboard-widget">
                    <div class="widget-header">
                        <h3 class="widget-title">Progetti Recenti</h3>
                        <button class="timeline-btn" onclick="window.location.hash='dashboard'">Vedi Tutti</button>
                    </div>
                    <div id="home-recent-projects" class="custom-scrollbar" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 380px; overflow-y: auto; padding-right: 4px;">
                         <span class="loader small"></span>
                    </div>
                    <style>
                        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
                        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }
                    </style>
                </div>



            </div>
        </div>
    `;

    // --- Interaction Logic ---
    // Store current date for timeline navigation
    window.homepageCurrentDate = new Date();
    window.homepageCollaboratorId = myCollab.id;
    window.hpView = 'daily'; // 'daily' | 'weekly'

    window.toggleHomepageView = (view) => {
        window.hpView = view;

        // UI Update
        const dailyBtn = document.getElementById('view-daily-btn');
        const weeklyBtn = document.getElementById('view-weekly-btn');
        if (view === 'daily') {
            dailyBtn.classList.add('active-pill'); dailyBtn.style.background = 'white'; dailyBtn.style.color = '#111';
            weeklyBtn.classList.remove('active-pill'); weeklyBtn.style.background = 'transparent'; weeklyBtn.style.color = '#6b7280';
        } else {
            weeklyBtn.classList.add('active-pill'); weeklyBtn.style.background = 'white'; weeklyBtn.style.color = '#111';
            dailyBtn.classList.remove('active-pill'); dailyBtn.style.background = 'transparent'; dailyBtn.style.color = '#6b7280';
        }

        window.updateHomepageTimeline(window.homepageCurrentDate);
    };

    // Function to update timeline and header date
    window.updateHomepageTimeline = async (date) => {
        const timelineWrapper = document.getElementById('hp-timeline-wrapper');
        const headerDate = container.querySelector('.homepage-header h1').nextElementSibling; // The <p> tag
        const headerTitle = container.querySelector('.homepage-header h1');

        // Determine Start/End based on View
        let start = new Date(date);
        let end = new Date(date);
        let dateText = '';

        if (window.hpView === 'weekly') {
            const day = start.getDay(); // 0 (Sun) - 6 (Sat)
            const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
            start.setDate(diff); start.setHours(0, 0, 0, 0);

            end = new Date(start);
            end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);

            const startStr = start.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
            const endStr = end.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
            dateText = `Settimana dal ${startStr} al ${endStr}.`;
        } else {
            // Daily
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            dateText = `Ecco cosa c'è in programma per ${date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}.`;
        }

        // Update header date
        headerDate.innerHTML = dateText;
        headerTitle.textContent = `Buongiorno, ${firstName}!`; // Reset if it changed

        timelineWrapper.innerHTML = `<div style="padding: 2rem; width: 100%; text-align: center; color: var(--text-tertiary);"><span class="loader small"></span> Caricamento...</div>`;

        try {
            // Parallel Fetch: Events + Availability + Google + Overrides
            // Now passing (id, start, end)
            const [events, rules, googleBusy, overrides] = await Promise.all([
                fetchDateEvents(window.homepageCollaboratorId, start, end),
                fetchAvailabilityRules(window.homepageCollaboratorId),
                fetchGoogleCalendarBusy(window.homepageCollaboratorId, start, end),
                fetchAvailabilityOverrides(window.homepageCollaboratorId) // from api.js
            ]);

            // Rules filtering needs to be smarter for weekly (pass all rules? or filter inside render?)
            // For now pass all rules, render logic handles day matching

            if (window.hpView === 'weekly') {
                renderWeeklyTimeline(timelineWrapper, events, start, rules, googleBusy, overrides);
            } else {
                // Determine day ID for Daily View
                const dayId = date.getDay();
                const dayRules = rules.filter(r => r.day_of_week === dayId);
                renderTimeline(timelineWrapper, events, date, dayRules, googleBusy, overrides);
            }
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

    // --- CUSTOM DATE PICKER ---
    let pickerCurrentDate = new Date(); // Tracks the displayed month

    window.toggleCustomDatePicker = (btn) => {
        const existing = document.getElementById('custom-datepicker-popover');
        if (existing) {
            existing.remove();
            return;
        }

        // Initialize picker date to current selected date
        pickerCurrentDate = new Date(window.homepageCurrentDate);

        // Create Popover
        const rect = btn.getBoundingClientRect();
        const popoverWidth = 300;
        const popover = document.createElement('div');
        popover.id = 'custom-datepicker-popover';
        popover.className = 'glass-card'; // Reuse global class
        popover.style.cssText = `
            position: fixed;
            top: ${rect.bottom + 8}px;
            left: ${rect.right - popoverWidth}px; /* Align Right Edge */
            background: white; /* Light Theme */
            color: #1f2937; /* Gray-800 */
            padding: 16px;
            border-radius: 12px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); /* Soft shadow */
            z-index: 9999;
            width: ${popoverWidth}px;
            border: 1px solid #e5e7eb; /* Light border */
            font-family: var(--font-base, sans-serif);
        `;

        // Render Initial View
        renderCalendar(popover);
        document.body.appendChild(popover);

        // Click Outside to Close
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!popover.contains(e.target) && !btn.contains(e.target)) {
                    popover.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 0);
    };

    function renderCalendar(container) {
        const year = pickerCurrentDate.getFullYear();
        const month = pickerCurrentDate.getMonth(); // 0-11
        const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

        // Header
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <button onclick="changePickerMonth(-1)" style="background:transparent; border:none; color:#374151; cursor:pointer; padding:4px; border-radius:4px;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='transparent'">
                    <span class="material-icons-round">chevron_left</span>
                </button>
                <div style="font-weight: 700; font-size: 0.95rem; color:#111;">${monthNames[month]} ${year}</div>
                <button onclick="changePickerMonth(1)" style="background:transparent; border:none; color:#374151; cursor:pointer; padding:4px; border-radius:4px;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='transparent'">
                    <span class="material-icons-round">chevron_right</span>
                </button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 8px;">
        `;

        // Weekdays
        const days = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
        days.forEach(d => {
            html += `<div style="text-align: center; font-size: 0.75rem; color: #9ca3af; font-weight: 600;">${d}</div>`;
        });
        html += `</div><div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">`;

        // Days Grid
        const firstDay = new Date(year, month, 1).getDay(); // 0=Sun (need adjustment to Mon=0)
        const adjustedFirstDay = (firstDay === 0 ? 6 : firstDay - 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date(); // To highlight today
        const currentSelected = window.homepageCurrentDate;

        // Empty slots
        for (let i = 0; i < adjustedFirstDay; i++) {
            html += `<div></div>`;
        }

        // Day slots
        for (let i = 1; i <= daysInMonth; i++) {
            let bg = 'transparent';
            let color = '#374151'; // Gray-700
            let weight = '500';

            // Highlight Selected (Prioritize over today)
            if (i === currentSelected.getDate() && month === currentSelected.getMonth() && year === currentSelected.getFullYear()) {
                bg = 'var(--brand-purple, #a855f7)';
                color = 'white';
                weight = '700';
            }
            // Highlight Today (secondary)
            else if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                bg = '#eff6ff'; // Blue-50
                color = '#3b82f6'; // Blue-500
                weight = '700';
            }

            html += `
                <button onclick="selectPickerDate(${i})" style="
                    width: 100%; aspect-ratio: 1; border: none; background: ${bg}; color: ${color};
                    border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: ${weight};
                    display: flex; align-items: center; justify-content: center; transition: background 0.2s;
                " onmouseover="this.style.background = '${bg === 'transparent' ? '#f3f4f6' : bg}'"
                  onmouseout="this.style.background = '${bg}'">
                    ${i}
                </button>
            `;
        }

        html += `</div>`;
        container.innerHTML = html;
    }

    // Global helpers for pure HTML interaction
    window.changePickerMonth = (offset) => {
        pickerCurrentDate.setMonth(pickerCurrentDate.getMonth() + offset);
        const popover = document.getElementById('custom-datepicker-popover');
        if (popover) renderCalendar(popover);
    };

    window.selectPickerDate = (day) => {
        const newDate = new Date(pickerCurrentDate.getFullYear(), pickerCurrentDate.getMonth(), day);
        // Date input needs YYYY-MM-DD usually, but our logic handles Date obj
        const offset = newDate.getTimezoneOffset();
        const localDate = new Date(newDate.getTime() - (offset * 60 * 1000));
        const dateStr = localDate.toISOString().split('T')[0];

        window.updateHomepageDateFromInput(dateStr);

        // Remove popover
        const popover = document.getElementById('custom-datepicker-popover');
        if (popover) popover.remove();
    };

    // --- Initial Load ---
    try {
        // Date Input Handler
        window.updateHomepageDateFromInput = (val) => {
            if (!val) return;
            window.homepageCurrentDate = new Date(val);
            window.updateHomepageTimeline(window.homepageCurrentDate);
        };

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
        const targetUserId = myCollab.user_id || state.session?.user?.id;
        const projects = await fetchRecentProjects(myId, targetUserId);
        const pContainer = document.getElementById('home-recent-projects');
        if (pContainer) renderProjects(pContainer, projects);
    } catch (e) {
        console.error("Home Data Load Error:", e);
    }
}

// --- GOOGLE & AVAILABILITY HELPERS ---

async function fetchGoogleCalendarBusy(collaboratorId, startArg, endArg) {
    let start, end;
    if (endArg) {
        start = new Date(startArg);
        end = new Date(endArg);
    } else {
        start = new Date(startArg); start.setHours(0, 0, 0, 0);
        end = new Date(startArg); end.setHours(23, 59, 59, 999);
    }

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

// --- WEEKLY RENDER LOGIC ---

function renderWeeklyTimeline(container, events, startDate, rules, googleBusy, overrides) {
    container.innerHTML = '';
    const startOfWeek = new Date(startDate); // Should be Monday

    // Layout: Time Column + 7 Days
    // Grid: [Time 50px] [Day 1fr] ... [Day 1fr]

    // 1. Header Row (Day Names)
    const headerRow = document.createElement('div');
    headerRow.style.display = 'grid';
    headerRow.style.gridTemplateColumns = '50px repeat(7, 1fr)';
    headerRow.style.gap = '8px';
    headerRow.style.padding = '1rem 1rem 0 1rem';
    headerRow.style.marginBottom = '1rem';
    headerRow.style.position = 'sticky';
    headerRow.style.top = '0';
    headerRow.style.zIndex = '10';
    headerRow.style.background = 'white'; // Cover content when scrolling

    // Spacer for time column
    headerRow.innerHTML = `<div></div>`;

    const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    const todayStr = new Date().toDateString();

    for (let i = 0; i < 7; i++) {
        const currentD = new Date(startOfWeek);
        currentD.setDate(startOfWeek.getDate() + i);
        const isToday = currentD.toDateString() === todayStr;

        const colHeader = document.createElement('div');
        colHeader.style.textAlign = 'center';

        // Pill Header
        colHeader.innerHTML = `
            <div style="
                display:flex; flex-direction:column; align-items:center; justify-content:center;
                background: ${isToday ? '#1e293b' : 'transparent'};
                color: ${isToday ? 'white' : '#64748b'};
                padding: 6px; border-radius: 12px;
                box-shadow: ${isToday ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none'};
            ">
                <div style="font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">${dayNames[i]}</div>
                <div style="font-size:1.1rem; font-weight:700;">${currentD.getDate()}</div>
            </div>
        `;
        headerRow.appendChild(colHeader);
    }
    container.appendChild(headerRow);

    // 2. Main Grid (Scrollable)
    const gridBody = document.createElement('div');
    gridBody.style.display = 'grid';
    gridBody.style.gridTemplateColumns = '50px repeat(7, 1fr)';
    gridBody.style.position = 'relative';
    gridBody.style.padding = '0 1rem 2rem 1rem';
    gridBody.style.height = '500px';
    gridBody.style.overflowY = 'auto';
    gridBody.style.background = 'white';
    gridBody.style.borderRadius = '0 0 16px 16px';
    gridBody.style.paddingBottom = '250px'; // Significantly deeper buffer

    // Ensure the content inside pushes boundaries
    const pxPerHour = 60;
    const totalHeight = (24 * pxPerHour) + 50; // Add specific buffer to columns too

    // Time Labels Column
    const timeCol = document.createElement('div');
    timeCol.style.position = 'relative';
    timeCol.style.height = `${totalHeight}px`;
    timeCol.style.borderRight = '1px solid #f1f5f9';

    for (let h = 0; h < 24; h++) {
        const label = document.createElement('div');
        label.innerText = `${h.toString().padStart(2, '0')}:00`;
        label.style.position = 'absolute';
        label.style.top = `${h * pxPerHour}px`;
        label.style.fontSize = '0.7rem';
        label.style.color = '#94a3b8';
        label.style.transform = 'translateY(-50%)';
        label.style.width = '100%';
        label.style.textAlign = 'right';
        label.style.paddingRight = '8px';
        timeCol.appendChild(label);
    }
    gridBody.appendChild(timeCol);

    // Day Columns
    for (let i = 0; i < 7; i++) {
        const currentD = new Date(startOfWeek);
        currentD.setDate(startOfWeek.getDate() + i);

        const dayCol = document.createElement('div');
        dayCol.style.position = 'relative';
        dayCol.style.height = `${totalHeight}px`;
        dayCol.style.borderRight = (i < 6) ? '1px dashed #f1f5f9' : 'none';
        dayCol.style.background = '#f8fafc'; // DEFAULT CLOSED (Gray)

        // 1. RENDER AVAILABILITY (WHITE BLOCKS)
        const dayId = currentD.getDay();
        const dailyRules = (rules || []).filter(r => r.day_of_week === dayId);

        dailyRules.forEach(r => {
            if (!r.start_time || !r.end_time) return;
            const [sh, sm] = r.start_time.split(':').map(Number);
            const [eh, em] = r.end_time.split(':').map(Number);
            const sM = (sh * 60) + sm;
            const eM = (eh * 60) + em;

            const slotEl = document.createElement('div');
            slotEl.style.position = 'absolute';
            slotEl.style.top = `${(sM / 60) * pxPerHour}px`;
            slotEl.style.height = `${((eM - sM) / 60) * pxPerHour}px`;
            slotEl.style.left = '0'; slotEl.style.right = '0';
            slotEl.style.background = 'white';
            slotEl.style.zIndex = '0';
            dayCol.appendChild(slotEl);
        });

        // Background Grid Lines
        for (let h = 1; h < 24; h++) {
            const line = document.createElement('div');
            line.style.position = 'absolute';
            line.style.top = `${h * pxPerHour}px`;
            line.style.left = '0'; line.style.right = '0';
            line.style.height = '1px';
            line.style.background = '#f1f5f9';
            line.style.zIndex = '1';
            dayCol.appendChild(line);
        }

        // Filter events for this day
        // Check date range overlap or start date
        const dayStart = new Date(currentD); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentD); dayEnd.setHours(23, 59, 59, 999);

        const dayEvents = (events || []).filter(ev => {
            const evStart = new Date(ev.start);
            const evEnd = new Date(ev.end);
            return (evStart < dayEnd && evEnd > dayStart);
        });

        // Render Events
        dayEvents.forEach(ev => {
            const evStart = new Date(ev.start);
            const evEnd = new Date(ev.end);

            // Calculate Top & Height (clamped to this day)
            let startMins = evStart.getHours() * 60 + evStart.getMinutes();
            let endMins = evEnd.getHours() * 60 + evEnd.getMinutes();

            // Handle cross-day (simplified: clamp to 00:00-24:00)
            if (evStart < dayStart) startMins = 0;
            if (evEnd > dayEnd) endMins = 1440;

            const top = (startMins / 60) * pxPerHour;
            const height = Math.max(((endMins - startMins) / 60) * pxPerHour, 20); // Min height

            // Render Card
            const el = document.createElement('div');
            el.className = 'timeline-event-card'; // Reuse interactions?

            // PREMIUM STYLE
            // Strict Deterministic Logic (Database Type)
            // Appointment -> Purple
            // Booking -> Blue

            let bgColor = '#60a5fa'; // Default Blue
            let glowColor = '#3b82f6';

            if (ev.type === 'appointment') {
                bgColor = '#c084fc'; // Purple-400
                glowColor = '#a855f7'; // Purple-500
            } else if (ev.type === 'booking') {
                bgColor = '#60a5fa'; // Blue
                glowColor = '#3b82f6';
            } else if (ev.title && ev.title.toLowerCase().includes('google')) {
                // Only if no type is known (e.g. from generic feed)
                bgColor = '#fcd34d'; // Amber
                glowColor = '#f59e0b';
            }

            el.style.cssText = `
                position: absolute;
                top: ${top}px;
                left: 4px; right: 4px;
                height: ${height}px;
                background: linear-gradient(135deg, ${bgColor} 0%, ${glowColor} 100%);
                border-radius: 12px;
                padding: 6px;
                color: white;
                font-size: 0.75rem;
                overflow: hidden;
                box-shadow: 0 4px 12px ${glowColor}40;
                cursor: pointer;
                z-index: 5;
                transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                display: flex; flex-direction: column; justify-content: start;
            `;

            el.innerHTML = `
                <div style="font-weight:700; line-height:1.1; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ev.title}</div>
                <div style="opacity:0.9; font-size:0.65rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ev.client || ''}</div>
            `;

            // TOOLTIP & HOVER (Aligned with Daily)
            el.onmouseenter = function (e) {
                this.style.zIndex = '50';
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = `0 8px 20px ${glowColor}60`;

                const tooltip = document.createElement('div');
                tooltip.id = 'timeline-custom-tooltip';
                tooltip.style.cssText = `
                    position: fixed; z-index: 9999; background: rgba(255,255,255,0.98); color: #1e293b;
                    padding: 8px 12px; border-radius: 8px; font-size: 0.85rem;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); pointer-events: none;
                    backdrop-filter: blur(4px); border: 1px solid #e2e8f0; max-width: 250px;
                `;
                tooltip.innerHTML = `
                    <div style="font-weight: 600; margin-bottom: 2px;">${ev.title}</div>
                    <div style="font-size: 0.75rem; color: #64748b;">${ev.client || ''}</div>
                    <div style="font-size: 0.7rem; color: #94a3b8; margin-top:4px;">${evStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${evEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                `;
                document.body.appendChild(tooltip);
                const rect = this.getBoundingClientRect();
                tooltip.style.top = `${rect.bottom + 8}px`;
                tooltip.style.left = `${rect.left}px`;
            };

            el.onmouseleave = function () {
                this.style.zIndex = '5';
                this.style.transform = 'none';
                this.style.boxShadow = `0 4px 12px ${glowColor}40`;
                const t = document.getElementById('timeline-custom-tooltip');
                if (t) t.remove();
            };

            // Interaction matching daily
            const evtId = `evt_hp_w_${ev.id.replace(/-/g, '_')}`;
            window[evtId] = ev;
            el.setAttribute('onclick', `openHomepageEventDetails(window['${evtId}'])`);

            dayCol.appendChild(el);
        });

        // Availability / Busy Areas?
        // For V1, keep it clean. Maybe shade overrides.

        gridBody.appendChild(dayCol);
    }

    container.appendChild(gridBody);

    // 3. AUTO-SCROLL TO NOW
    const now = new Date();
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    if (now >= startOfWeek && now <= endOfWeek) {
        const nowHour = now.getHours();
        const scrollPos = Math.max(0, (nowHour * pxPerHour) - 150);
        setTimeout(() => {
            gridBody.scrollTo({ top: scrollPos, behavior: 'smooth' });
        }, 500);
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

    // 4. Generate Track (Light Modern Background)
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
                    top: 12px;
                    left: 12px;
                    font-size: 0.85rem;
                    color: var(--text-tertiary);
                    font-weight: 600;
                    font-family: var(--font-titles);
                ">${h}.00</div>
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
        // Dark Mode: Vibrant colors with glow
        let bgColor = '#3b82f6'; // Default Blue
        let glowColor = '#3b82f6';

        if (ev.type === 'appointment') {
            bgColor = '#c084fc'; // Bright Purple (Purple-400)
            glowColor = '#a855f7';
        } else if (ev.type === 'booking') {
            bgColor = '#60a5fa'; // Bright Blue (Blue-400)
            glowColor = '#3b82f6';
        }

        // Card Styling
        el.style.background = `linear-gradient(135deg, ${bgColor} 0%, ${glowColor} 100%)`;
        el.style.boxShadow = `0 4px 15px ${glowColor}60, inset 0 1px 1px rgba(255,255,255,0.3)`;
        el.style.borderRadius = '12px'; // Rounded pill-ish
        el.style.border = 'none';
        el.style.cursor = 'pointer';
        el.style.color = 'white'; // White Text for better contrast
        // Positioning (Slimmer & Detached)
        el.style.position = 'absolute';
        el.style.top = '50px'; // More breathing room
        el.style.height = '46px'; // Fixed slim height (Pill/Strip look)
        el.style.padding = '0 10px'; // Horizontal padding
        el.style.display = 'flex';
        el.style.flexDirection = 'column';
        el.style.justifyContent = 'center';

        // INTERACTION
        const evtId = `evt_hp_${ev.id.replace(/-/g, '_')}`;
        window[evtId] = ev;
        el.setAttribute('onclick', `openHomepageEventDetails(window['${evtId}'])`);

        // CUSTOM TOOLTIP LOGIC
        el.onmouseenter = function (e) {
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = `0 8px 20px ${bgColor}60`;

            // Create Tooltip
            const tooltip = document.createElement('div');
            tooltip.id = 'timeline-custom-tooltip';
            tooltip.style.position = 'fixed'; // Fixed to viewport
            tooltip.style.zIndex = '9999';
            tooltip.style.background = 'rgba(255, 255, 255, 0.98)'; // White glass
            tooltip.style.color = '#1e293b'; // Slate-800
            tooltip.style.padding = '8px 12px';
            tooltip.style.borderRadius = '8px';
            tooltip.style.fontSize = '0.85rem';
            tooltip.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)';
            tooltip.style.pointerEvents = 'none';
            tooltip.style.backdropFilter = 'blur(4px)';
            tooltip.style.border = '1px solid #e2e8f0'; // Light border
            tooltip.style.maxWidth = '250px';

            tooltip.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 2px;">${ev.title}</div>
                <div style="font-size: 0.75rem; color: #64748b;">${ev.client || ''}</div>
                <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 4px;">
                   ${ev.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${ev.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            `;

            document.body.appendChild(tooltip);

            // Position Tooltip
            const rect = this.getBoundingClientRect();
            tooltip.style.top = `${rect.bottom + 8}px`; // Below the card
            tooltip.style.left = `${rect.left}px`;
        };

        el.onmouseleave = function () {
            this.style.transform = 'none';
            this.style.boxShadow = `0 4px 12px ${bgColor}40`;

            // Remove Tooltip
            const tooltip = document.getElementById('timeline-custom-tooltip');
            if (tooltip) tooltip.remove();
        };

        // READABILITY: Handle Small Blocks
        const isSmall = width < 60;
        const isTiny = width < 30;

        if (isTiny) {
            // No Text inside, relies on Tooltip
        } else {
            let htmlContent = `<div style="font-weight: 700; margin-bottom: 0px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.85rem; line-height: 1.2; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">${ev.title}</div>`;

            if (!isSmall) {
                htmlContent += `<div style="font-size: 0.75rem; font-weight: 500; opacity: 0.95; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ev.client || ''}</div>`;
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

        // "Now" Pill + Dashed Line
        const nowLine = document.createElement('div');
        nowLine.className = 'timeline-now-line';
        nowLine.style.position = 'absolute';
        nowLine.style.left = `${left}px`;
        nowLine.style.top = '0';
        nowLine.style.height = '100%';
        nowLine.style.width = '0';
        nowLine.style.borderLeft = '2px dashed #06b6d4'; // Cyan Dashed
        nowLine.style.zIndex = '50';
        nowLine.style.pointerEvents = 'none';

        // Time Pill at Top
        const timePill = document.createElement('div');
        timePill.style.position = 'absolute';
        timePill.style.top = '10px';
        timePill.style.left = '-26px'; // Center pill (approx width 52px)
        timePill.style.background = '#06b6d4'; // Cyan
        timePill.style.color = 'white';
        timePill.style.padding = '2px 8px';
        timePill.style.borderRadius = '12px';
        timePill.style.fontWeight = '700';
        timePill.style.fontSize = '0.75rem';
        timePill.style.boxShadow = '0 2px 8px rgba(6, 182, 212, 0.4)';
        timePill.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        nowLine.appendChild(timePill);

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
import { openEventDetails } from './agenda_utils.js?v=317';

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
        container.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active'));
    }
    btn.classList.add('active');

    // Re-render
    if (window.hpData) {
        renderMyActivities(document.getElementById('hp-activities-list'), window.hpData.timers, window.hpData.tasks, window.hpData.events, filter);
    }
};

function renderMyActivities(container, timers, tasks, events, filter = 'task') {
    if (!container) return;

    // Data Safety & Counts
    const safeTimers = timers || [];
    const allPmItems = tasks || [];
    const safeEvents = events || [];

    // Separate PM Items into "Real Tasks" and "PM Activities"
    // Assumption: 'activity' type or similar distinguishes them. 
    // If not found, rely on title keywords or user feedback.
    // For now assuming 'attivita' or 'activity' in raw_type.
    const realTasks = [];
    const pmActivities = [];

    allPmItems.forEach(item => {
        const type = (item.raw_type || '').toLowerCase();
        if (type.includes('attivit') || type.includes('activity')) {
            pmActivities.push(item);
        } else {
            realTasks.push(item);
        }
    });

    // Total counts for tabs
    const countTask = realTasks.length;
    const countEvent = safeEvents.length;
    const countActivity = safeTimers.length + pmActivities.length;

    // Filter Logic
    const showTimers = filter === 'timer'; // Attività (Timers + PM Activities)
    const showEvents = filter === 'event'; // Appuntamenti (Agenda)
    const showTasks = filter === 'task';  // Task

    let html = '';
    let hasContent = false;
    const now = new Date();

    try {
        // 1. ACTIVE TIMERS & PM ACTIVITIES (Attività Tab)
        if (showTimers) {
            // A. Timers
            safeTimers.forEach(t => {
                hasContent = true;
                let title = 'Senza Commessa';
                if (t.orders) {
                    const ord = Array.isArray(t.orders) ? t.orders[0] : t.orders;
                    if (ord) title = `#${ord.order_number || '?'} - ${ord.title || '...'}`;
                }
                html += `
                    <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 0.75rem; border-radius: 8px; display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.5rem;">
                        <div style="width: 32px; height: 32px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;">
                            <span class="material-icons-round" style="font-size: 18px;">play_arrow</span>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 0.65rem; color: #6ee7b7; font-weight: 700; text-transform: uppercase;">In Corso (Timer)</div>
                            <div style="font-weight: 600; font-size: 0.85rem; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${title}">${title}</div>
                        </div>
                    </div>
                `;
            });

            // B. PM Activities (Static)
            pmActivities.forEach(t => {
                hasContent = true;
                let fullTitle = 'Attività';
                if (t.orders) {
                    const ord = Array.isArray(t.orders) ? t.orders[0] : t.orders;
                    if (ord) fullTitle = `#${ord.order_number} - ${ord.title}`;
                }

                html += `
                    <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255,255,255,0.1); padding: 0.75rem; border-radius: 8px; display: flex; gap: 0.75rem; align-items: flex-start; margin-bottom: 0.5rem;">
                        <div style="width: 32px; height: 32px; background: rgba(255,255,255,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;">
                            <span class="material-icons-round" style="font-size: 18px;">assignment</span>
                        </div>
                         <div style="flex: 1; min-width: 0;">
                             <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">
                                ${fullTitle}
                            </div>
                            <div style="font-weight: 500; font-size: 0.9rem; color: white; line-height: 1.3;">${t.title}</div>
                        </div>
                    </div>
                `;
            });

            if (!hasContent) html += `<div style="text-align: center; color: rgba(255,255,255,0.4); font-size: 0.8rem; padding: 2rem;">Nessuna attività.</div>`;
        }

        // 2. EVENTS (Agenda)
        if (showEvents) {
            if (safeEvents.length > 0) {
                // Sort by time
                safeEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

                safeEvents.forEach(evt => {
                    hasContent = true;
                    const startDate = new Date(evt.start);
                    const endDate = new Date(evt.end);
                    const timeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    // Visual style for past/current/future
                    const isPast = endDate < now;
                    const isNow = startDate <= now && endDate > now;

                    let opacity = '1';
                    let border = '1px solid rgba(255, 255, 255, 0.1)';
                    let bg = 'transparent';

                    if (isPast) opacity = '0.5';
                    if (isNow) {
                        border = '1px solid #3b82f6';
                        bg = 'rgba(59, 130, 246, 0.1)';
                    }

                    html += `
                        <div style="background: ${bg}; border-bottom: ${border}; opacity: ${opacity}; padding: 0.5rem 0; display: flex; gap: 0.75rem; align-items: center; cursor: pointer;" onclick="openHomepageEventDetails(window['evt_hp_${evt.id.replace(/-/g, '_')}'])">
                            <div style="display: flex; flex-direction: column; align-items: center; width: 40px; flex-shrink: 0;">
                                <span style="font-size: 0.75rem; font-weight: 600; color: white;">${timeStr}</span>
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: 600; font-size: 0.85rem; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${evt.title}</div>
                                <div style="font-size: 0.7rem; color: rgba(255,255,255,0.6);">${evt.client || ''}</div>
                            </div>
                        </div>
                    `;
                });
            }
            if (!hasContent) html += `<div style="text-align: center; color: rgba(255,255,255,0.4); font-size: 0.8rem; padding: 2rem;">Nessun appuntamento oggi.</div>`;
        }

        // 3. TASKS
        if (showTasks) {
            if (realTasks.length > 0) {
                // Sort by Due Date
                realTasks.sort((a, b) => {
                    const da = a.due_date ? new Date(a.due_date) : new Date('9999-12-31');
                    const db = b.due_date ? new Date(b.due_date) : new Date('9999-12-31');
                    return da - db;
                });

                realTasks.forEach(t => {
                    hasContent = true;
                    // Correctly access nested Order fields
                    let fullTitle = 'Generico';
                    if (t.orders) {
                        const ord = Array.isArray(t.orders) ? t.orders[0] : t.orders;
                        if (ord) fullTitle = `#${ord.order_number} - ${ord.title}`;
                    }

                    const isLate = t.due_date && new Date(t.due_date) < new Date();
                    const dateStr = t.due_date ? new Date(t.due_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : '';

                    html += `
                        <div style="background: transparent; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding: 0.5rem 0; display: flex; gap: 0.75rem; align-items: center; justify-content: space-between;">
                            <div style="flex: 1; min-width: 0;">
                                 <div style="font-size: 0.7rem; color: #94a3b8; margin-bottom: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">
                                    ${fullTitle}
                                </div>
                                <div style="font-weight: 500; font-size: 0.85rem; color: white; line-height: 1.2;">${t.title}</div>
                                ${isLate ? `<div style="font-size: 0.65rem; color: #f87171; margin-top: 1px;">Scaduto: ${dateStr}</div>` : ''}
                            </div>
                             <div style="padding-left: 8px;">
                                <input type="checkbox" style="width: 18px; height: 18px; accent-color: #10b981; cursor: pointer; border-radius: 4px;" onclick="window.quickCompleteTask('${t.id}', this)" title="Segna come completata">
                            </div>
                        </div>
                    `;
                });
            }
            if (!hasContent) html += `<div style="text-align: center; color: rgba(255,255,255,0.4); font-size: 0.8rem; padding: 2rem;">Nessun task da completare.</div>`;
        }

        container.innerHTML = html;

        // Try to update Tab Counts if buttons exist in parent
        // This is a bit of a hack to avoid re-rendering the whole header, but effective.
        try {
            const card = container.closest('.glass-card');
            if (card) {
                const tabs = card.querySelectorAll('.tab-pill');
                if (tabs.length === 3) {
                    // Update counts safely without killing icons
                    const setCnt = (btn, n) => {
                        const s = btn.querySelector('.tab-count');
                        if (s) s.textContent = n;
                    };
                    setCnt(tabs[0], countTask);
                    setCnt(tabs[1], countEvent);
                    setCnt(tabs[2], countActivity);
                }
            }
        } catch (e) {/* ignore */ }

    } catch (e) {
        console.error("Render Activities Error:", e);
        container.innerHTML = `<div style="color: #f87171; padding: 1rem;">Errore visualizzazione: ${e.message}</div>`;
    }
}

// Helper for Task Completion
window.quickCompleteTask = async function (id, checkbox) {
    // NO CONFIRM - Instant Action

    // Optimistic UI
    const row = checkbox.closest('div[style*="background"]');
    if (row) row.style.opacity = '0.3';

    try {
        await updatePMItem(id, { status: 'done' });
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
        <div class="project-item" onclick="window.location.hash='${p.link.replace('#', '')}'" style="align-items: flex-start;">
            <div class="project-icon" style="margin-top: 2px;">
                <span class="material-icons-round">folder</span>
            </div>
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 700; color: var(--text-primary); font-size: 1.05rem; line-height: 1.3; overflow-wrap: break-word;">
                    ${p.order_number} ${p.title}
                </div>
                <div style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${p.client}
                </div>
            </div>
            <div style="text-align: right; flex-shrink: 0;">
                 <div style="font-size: 0.75rem; color: var(--text-tertiary);">Stato</div>
                 <div style="font-size: 0.8rem; font-weight: 500; color: var(--text-primary);">${p.status || 'N/D'}</div>
            </div>
        </div>
    `).join('');
}
