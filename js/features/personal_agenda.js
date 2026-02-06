import { supabase } from '../modules/config.js?v=157';
import { state } from '../modules/state.js?v=157';
import { fetchAvailabilityRules, fetchRestDays, fetchAvailabilityOverrides } from '../modules/api.js?v=157';
import { fetchCollaboratorAppointments } from '../modules/pm_api.js?v=157';
import { openAvailabilityModal, checkAndHandleGoogleCallback } from './availability_manager.js?v=157';
import { fetchAppointment } from '../modules/pm_api.js?v=157';

let currentDate = new Date(); // Represents the start of the week or current view date
let eventsCache = [];
let availabilityCache = { rules: [], restDays: [], overrides: [], googleBusy: [], collaboratorTimezone: null };
let currentCollaboratorId = null;
let currentView = 'week'; // 'week', 'day'
let miniCalendarDate = new Date(); // Separate state for mini calendar
let currentGoogleFetchId = 0; // Track latest Google fetch to prevent race conditions

let filters = {
    bookings: true,
    appointments: true,
    deadlines: false,
    reminders: false
};

export async function renderAgenda(container) {
    console.log("[Agenda] renderAgenda called. Container:", container);

    // Inject critical styles immediately
    injectAgendaStyles();

    // Set Page Title
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = 'Agenda';

    if (!container) {
        console.error("[Agenda] Container not found!");
        return;
    }

    container.innerHTML = `
        <div class="agenda-container animate-fade-in" id="agenda-view-wrapper" style="display: flex !important; flex-direction: row !important;">
            
            <!-- MAIN CONTENT (Now on Left) -->
            <div class="agenda-main" style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
                <!-- Toolbar -->
                <div class="agenda-main-header">
                    <div class="header-left">
                        <h2 class="date-range-display" id="period-label">
                            <!-- Date Range -->
                        </h2>
                    </div>

                <div class="header-actions">
                     
                     <!-- Google Sync Indicator -->
                     <div id="google-sync-indicator" class="sync-indicator hidden" title="Google Calendar: In attesa..." style="display: flex; align-items: center; gap: 6px; margin-right: 12px; padding: 4px 8px; border-radius: 12px; background: rgba(255,255,255,0.5); border: 1px solid var(--glass-border); transition: all 0.2s;">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" alt="GCal" style="width: 14px; height: 14px;">
                        <span id="sync-status-dot-header" style="width: 6px; height: 6px; border-radius: 50%; background: #9ca3af;"></span>
                     </div>

                     <button class="icon-nav-btn" id="btn-manage-availability" title="Modifica Disponibilità" style="margin-right: 0.5rem; width: auto; padding: 0 12px; gap: 6px;">
                        <span class="material-icons-round" style="color: var(--brand-blue);">event_available</span>
                        <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-secondary);">Disponibilità</span>
                     </button>

                     <div class="view-mode-toggle">
                        <button class="mode-btn" id="view-day" onclick="switchView('day')">Giorno</button>
                        <button class="mode-btn active" id="view-week" onclick="switchView('week')">Settimana</button>
                        <button class="mode-btn" id="view-month" onclick="switchView('month')">Mese</button>
                    </div>

                     <div class="calendar-nav-controls" style="display:flex; gap: 0.5rem">
                        <button class="icon-nav-btn" id="prev-period">
                            <span class="material-icons-round">chevron_left</span>
                        </button>
                        <button class="icon-nav-btn" id="next-period">
                            <span class="material-icons-round">chevron_right</span>
                        </button>
                         <button class="today-btn" id="today-btn">Oggi</button>
                    </div>
                </div>
                </div>
                 <!-- Timeline Grid -->
                <div class="timeline-wrapper" style="flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column;">
                    <!-- Fixed Header Wrapper to handle scroll sync manually if needed, or let sticky work -->
                     <div class="timeline-scroll-container" id="agenda-grid-container">
                        <!-- 1. Corner (Sticky Top-Left) -->
                        <div class="time-gutter-header"></div>

                        <!-- 2. Day Headers (Sticky Top) -->
                        <div class="timeline-header-row" id="timeline-header">
                             <!-- Day Headers injected here -->
                        </div>

                        <!-- 3. Time Gutter (Sticky Left) -->
                        <div class="time-gutter">
                             <!-- 00:00, 01:00 ... -->
                        </div>
                        
                        <!-- 4. Main Grid (Scrollable Content) -->
                        <div class="main-grid" id="main-grid">
                            <!-- Columns & Events -->
                             <div class="grid-lines-layer">
                                <!-- Horizontal Lines -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- SIDEBAR (Now on Right) -->
            <aside class="agenda-sidebar" style="width: 340px !important; flex-shrink: 0 !important; overflow-y: auto !important; height: 100% !important; min-height: 0 !important; border-right: none; border-left: 1px solid rgba(0,0,0,0.05);">
                <div class="agenda-sidebar-header">
                    <h2>Agenda</h2>
                </div>

                <div class="mini-calendar" id="mini-calendar">
                    <!-- Injected by JS -->
                </div>

                <!-- Filters (Now above list) -->
                <div class="agenda-filters-chips">
                    <div class="filter-chip ${filters.bookings ? 'active' : ''}" onclick="toggleFilter('bookings')">
                        Prenotazioni
                    </div>
                    <div class="filter-chip ${filters.appointments ? 'active' : ''}" onclick="toggleFilter('appointments')">
                        Appuntamenti
                    </div>
                    <!-- Optional: Add more if needed, but keeping it simple as requested -->
                </div>

                <!-- Event List Container -->
                <div id="agenda-sidebar-list" class="agenda-sidebar-list">
                    <!-- Events injected here -->
                </div>

                <div class="agenda-quick-add">
                   <button class="quick-add-btn" onclick="window.showAlert('Funzione in arrivo', 'info')" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.8rem; background: var(--brand-blue); color: white; border: none; border-radius: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(var(--brand-blue-rgb, 78, 146, 216), 0.3);">
                        <span class="material-icons-round">add</span>
                        <span>Nuovo Evento</span>
                   </button>
                </div>
            </aside>
        </div>
    `;

    // Bind Global Controls
    window.toggleFilter = toggleFilter;
    window.switchView = switchView;

    // Bind Nav Controls
    document.getElementById('prev-period').onclick = () => changePeriod(-1);
    document.getElementById('next-period').onclick = () => changePeriod(1);
    document.getElementById('today-btn').onclick = () => {
        currentDate = new Date();
        // Reset Google Cache logic
        availabilityCache.googleBusy = [];
        window._googleBusyFetchInProgress = false;

        renderMiniCalendar();
        fetchMyBookings().then(() => updateView());
    };

    // Initial Fetch & Render
    renderMiniCalendar();
    await fetchMyBookings();

    // Check for Google OAuth Callback (now that we have ID)
    if (currentCollaboratorId) {
        const handled = await checkAndHandleGoogleCallback(currentCollaboratorId);
        if (handled) {
            // Success
        }
    }

    // Bind Actions


    // Bind Actions
    const btnManage = container.querySelector('#btn-manage-availability');
    if (btnManage) {
        btnManage.onclick = () => {
            if (currentCollaboratorId) {
                openAvailabilityModal(currentCollaboratorId, async () => {
                    await fetchMyBookings();
                    renderTimeline();
                });
            } else {
                window.showAlert('Profilo collaboratore non trovato', 'error');
            }
        };
    }

    // Sync Scroll Header with Body
    const tBody = container.querySelector('.timeline-body');
    const tHeader = container.querySelector('#timeline-header');
    if (tBody && tHeader) {
        tBody.addEventListener('scroll', () => {
            tHeader.scrollLeft = tBody.scrollLeft;
        });
    }

    renderTimeline();
}

// --- LOGIC ---

async function fetchMyBookings() {
    try {
        // 1. Ensure we have the Auth User
        let authUserId = state.profile?.id;
        let authEmail = state.profile?.email;

        // DEBUG: Force fetch session if missing
        if (!authUserId) {
            console.log("[Agenda] state.profile missing, fetching user from Supabase...");
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                authUserId = user.id;
                authEmail = user.email;
                console.log("[Agenda] User fetched directly from Supabase:", authEmail);
            } else {
                console.error("[Agenda] No user session found even after direct fetch.");
            }
        }

        const impersonatedCollabId = state.impersonatedCollaboratorId;

        console.log("[Agenda] Fetching for:", { authUserId, authEmail, impersonatedCollabId });

        let collaboratorId = impersonatedCollabId;

        // If not impersonating, find the collaborator record for this auth user
        if (!collaboratorId && authUserId) {
            // First try by user_id
            let { data: collabRecord, error: collabError } = await supabase
                .from('collaborators')
                .select('*')
                .eq('user_id', authUserId)
                .maybeSingle();

            // If not found by user_id, try by Email (Robust Fallback)
            if (!collabRecord) {
                const userEmail = state.profile?.email || state.session?.user?.email;
                if (userEmail) {
                    console.log("[Agenda] Fallback: Searching collaborator by email:", userEmail);
                    const { data: emailMatch } = await supabase
                        .from('collaborators')
                        .select('id')
                        .eq('email', userEmail)
                        .maybeSingle();

                    if (emailMatch) {
                        collabRecord = emailMatch;
                        // Self-Heal: Link user_id for future
                        supabase.from('collaborators')
                            .update({ user_id: authUserId })
                            .eq('id', emailMatch.id)
                            .then(({ error }) => {
                                if (error) console.warn("Failed to auto-link user_id:", error);
                                else console.log("Auto-linked user_id to collaborator");
                            });
                    }
                }
            }

            if (!collabRecord) {
                console.warn("[Agenda] No collaborator record found for user:", authUserId);
                updateSyncStatus('error', 'Profilo non trovato');
                window.showGlobalAlert('Nessun profilo collaboratore associato a questo utente.', 'error');
                eventsCache = [];
                // Do not return immediately, allow rendering empty agenda
            } else {
                collaboratorId = collabRecord.id;
                console.log("[Agenda] Found collaborator ID:", collaboratorId);
            }
        }

        currentCollaboratorId = collaboratorId;

        // Debug Indicator
        if (collaboratorId) {
            console.log(`[Agenda] Active Collaborator ID: ${collaboratorId}`);
        } else {
            updateSyncStatus('error', 'Nessun ID');
        }

        if (!collaboratorId) {
            console.warn("[Agenda] No collaborator ID available");
            eventsCache = [];
            availabilityCache = { rules: [], restDays: [], overrides: [], googleBusy: [], collaboratorTimezone: null };
            return;
        }

        // Fetch bookings and availability data in parallel
        const bookingsQuery = supabase
            .from('bookings')
            .select(`
                *,
                booking_items ( name, duration_minutes ),
                booking_assignments!inner ( collaborator_id )
            `)
            .eq('booking_assignments.collaborator_id', collaboratorId)
            .order('start_time', { ascending: true });

        // Get collaborator User ID to fetch Timezone
        const collabUserQuery = supabase.from('collaborators').select('user_id').eq('id', collaboratorId).single();

        const [bookingsRes, rules, restDays, overrides, collabUserRes, appointmentsData] = await Promise.all([
            bookingsQuery,
            fetchAvailabilityRules(collaboratorId),
            fetchRestDays(collaboratorId),
            supabase.from('availability_overrides').select('*, booking_items(name)').eq('collaborator_id', collaboratorId),
            collabUserQuery,
            fetchCollaboratorAppointments(collaboratorId)
        ]);

        let fetchedTimezone = null;
        if (collabUserRes.data && collabUserRes.data.user_id) {
            const { data: profileData } = await supabase
                .from('profiles')
                .select('timezone')
                .eq('id', collabUserRes.data.user_id)
                .single();
            if (profileData && profileData.timezone) {
                fetchedTimezone = profileData.timezone;
            }
        }
        console.log("[Agenda] Collaborator Timezone:", fetchedTimezone);

        const overridesData = overrides.data || [];

        if (bookingsRes.error) {
            console.error("[Agenda] Supabase Error:", bookingsRes.error);
            throw bookingsRes.error;
        }

        // Merge Bookings and Appointments
        const bookings = bookingsRes.data || [];
        const appointments = (appointmentsData || []).map(appt => ({
            ...appt,
            isAppointment: true,
            color: appt.appointment_types?.color || '#a855f7'
        }));

        eventsCache = [...bookings, ...appointments];

        // Preserve existing googleBusy if we have it (prevents race condition on double-render)
        const existingGoogleBusy = availabilityCache.googleBusy || [];

        availabilityCache = {
            rules: rules || [],
            restDays: restDays || [],
            overrides: overridesData,
            googleBusy: existingGoogleBusy,
            collaboratorTimezone: fetchedTimezone
        };

        // Fetch Google Calendar busy slots (async, non-blocking for initial render)
        // Reset in-progress flag if it's stale (e.g. > 10s old)
        if (window._googleBusyFetchStart && (Date.now() - window._googleBusyFetchStart > 10000)) {
            window._googleBusyFetchInProgress = false;
        }

        console.log('[Agenda] Google fetch check:', { existingLen: existingGoogleBusy.length, inProgress: window._googleBusyFetchInProgress, collaboratorId });

        if (existingGoogleBusy.length === 0 && !window._googleBusyFetchInProgress) {
            window._googleBusyFetchInProgress = true;
            window._googleBusyFetchStart = Date.now();
            updateSyncStatus('syncing', 'Sincronizzazione...');

            const fetchId = ++currentGoogleFetchId;

            fetchGoogleCalendarBusy(collaboratorId).then(busySlots => {
                // Check if this fetch is stale (superseded by a newer one)
                if (fetchId !== currentGoogleFetchId) {
                    console.log('[Agenda] Stale fetch ignored:', fetchId, 'Current:', currentGoogleFetchId);
                    return;
                }

                window._googleBusyFetchInProgress = false;
                window._googleBusyFetchStart = null;
                console.log('[Agenda] Raw Busy Response:', busySlots);

                if (busySlots && busySlots.length > 0) {
                    // Check for Auth Error
                    if (busySlots[0]?.error === 'AUTH_ERROR') {
                        console.warn('[Agenda] Auth Error detected:', busySlots[0]);
                        updateSyncStatus('error', 'Errore Autenticazione');
                        window.showGlobalAlert('Autorizzazione Google scaduta. Ricollega il calendario dal tuo profilo.', 'error');
                        return;
                    }
                    // Check for API Error
                    if (busySlots[0]?.error === 'API_ERROR') {
                        console.warn('[Agenda] Google API Error:', busySlots[0]);
                        updateSyncStatus('error', 'Errore Google');
                        return;
                    }

                    availabilityCache.googleBusy = busySlots;
                    updateSyncStatus('success', 'Sincronizzato');
                    console.log('[Agenda] Google Calendar busy slots fetched:', busySlots.length);
                    renderTimeline(); // Re-render with calendar data
                } else {
                    // Start of buffer logic - maybe retry with wider range if needed in future
                    updateSyncStatus('success', 'Nessun evento');
                    console.log('[Agenda] No Google Calendar busy slots found or empty array');
                }
            }).catch(err => {
                if (fetchId === currentGoogleFetchId) {
                    window._googleBusyFetchInProgress = false;
                    window._googleBusyFetchStart = null;
                    updateSyncStatus('error', 'Errore Rete');
                }
                console.error('[Agenda] Google Calendar fetch failed DETAILS:', err);
                console.error('[Agenda] Error Name:', err?.name);
                console.error('[Agenda] Error Message:', err?.message);
            });
        } else if (existingGoogleBusy.length > 0) {
            availabilityCache.googleBusy = existingGoogleBusy;
            updateSyncStatus('success', 'Cache utilizzata');
        }

        console.log("[Agenda] Fetched events:", eventsCache.length, "Rules:", availabilityCache.rules.length);

        // Render immediately with SQL data, then Google will re-render when ready
        renderTimeline();

    } catch (err) {
        console.error("[Agenda] Critical fetch error:", err);
    }
}

// --- GOOGLE CALENDAR INTEGRATION ---

async function fetchGoogleCalendarBusy(collaboratorId) {
    try {
        // Calculate date range based on current view
        let timeMin, timeMax;

        if (currentView === 'month') {
            const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            timeMin = firstDay.toISOString();
            timeMax = lastDay.toISOString();
        } else if (currentView === 'week') {
            const day = currentDate.getDay();
            const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
            const weekStart = new Date(currentDate);
            weekStart.setDate(diff);
            weekStart.setHours(0, 0, 0, 0);

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 7);
            weekEnd.setHours(23, 59, 59, 999);

            timeMin = weekStart.toISOString();
            timeMax = weekEnd.toISOString();
        } else {
            const dayStart = new Date(currentDate);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(currentDate);
            dayEnd.setHours(23, 59, 59, 999);
            timeMin = dayStart.toISOString();
            timeMax = dayEnd.toISOString();
        }

        console.log('[Agenda] Fetching Google Calendar busy for:', { collaboratorId, timeMin, timeMax });

        const { data, error } = await supabase.functions.invoke('check-google-availability', {
            body: { collaborator_id: collaboratorId, timeMin, timeMax }
        });

        if (error) {
            console.warn('[Agenda] Google Calendar fetch error:', error.message);
            return [];
        }

        if (data?.error) {
            // Likely no Google connection - that's OK
            console.log('[Agenda] Google Calendar not connected:', data.error);
            return [];
        }

        return data?.busy || [];

    } catch (err) {
        console.error('[Agenda] Google Calendar integration error DETAILS:', err);
        console.error('[Agenda] Error Name:', err?.name);
        console.error('[Agenda] Error Message:', err?.message);
        console.error('[Agenda] Error Stack:', err?.stack);
        return [];
    }
}

function renderTimeline() {
    if (currentView === 'month') {
        renderMonthlyView();
        return;
    }

    // Show normal timeline elements
    const timelineWrapper = document.querySelector('.timeline-wrapper');
    if (timelineWrapper) {
        timelineWrapper.innerHTML = `
            <div class="timeline-scroll-container" id="agenda-grid-container">
                <div class="time-gutter-header"></div>
                <div class="timeline-header-row" id="timeline-header"></div>
                <div class="time-gutter"></div>
                <div class="main-grid" id="main-grid">
                    <div class="grid-lines-layer"></div>
                </div>
            </div>
        `;
    }

    const header = document.getElementById('timeline-header');
    const grid = document.getElementById('main-grid');
    const label = document.getElementById('period-label');
    const gutter = document.querySelector('.time-gutter');
    const bgLayer = document.querySelector('.grid-lines-layer');

    if (!header || !grid) return;

    // 1. Determine Range
    let startOfPeriod, endOfPeriod;
    const today = new Date();

    if (currentView === 'week') {
        const day = currentDate.getDay(); // 0 (Sun) - 6 (Sat)
        // Adjust to Monday start
        const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
        startOfPeriod = new Date(currentDate);
        startOfPeriod.setDate(diff);
        startOfPeriod.setHours(0, 0, 0, 0);

        endOfPeriod = new Date(startOfPeriod);
        endOfPeriod.setDate(startOfPeriod.getDate() + 6);
        endOfPeriod.setHours(23, 59, 59, 999);

        label.innerHTML = `
            ${formatDate(startOfPeriod)} <span class="date-arrow">&rarr;</span> ${formatDate(endOfPeriod)}
            <span style="font-size:0.8rem; color:var(--text-tertiary); display:block; margin-top:2px;">Vista Settimanale</span>
        `;
    } else {
        startOfPeriod = new Date(currentDate);
        startOfPeriod.setHours(0, 0, 0, 0);
        endOfPeriod = new Date(currentDate);
        endOfPeriod.setHours(23, 59, 59, 999);
        label.textContent = formatDate(startOfPeriod, true);
    }

    // 2. Render Headers
    let headerHtml = '';
    const days = [];
    let loopDate = new Date(startOfPeriod);

    while (loopDate <= endOfPeriod) {
        days.push(new Date(loopDate));
        const isToday = loopDate.toDateString() === today.toDateString();

        // Capitalize day name
        const dayName = loopDate.toLocaleDateString('it-IT', { weekday: 'short' }).toUpperCase();

        headerHtml += `
            <div class="day-col-header ${isToday ? 'today' : ''}">
                <span class="day-name">${dayName.replace('.', '')}</span>
                <span class="day-num">${loopDate.getDate()}</span>
            </div>
        `;
        loopDate.setDate(loopDate.getDate() + 1);
    }
    header.innerHTML = headerHtml;

    // 3. Render Gutter & Grid Lines
    const startHour = 0;
    const endHour = 24; // Full day range

    // Reset styles
    gutter.style.position = '';
    gutter.style.height = '';

    let gutterHtml = '';
    let gridLinesHtml = '';

    // INLINE STYLES to guarantee alignment and bypass CSS specificity issues
    // INLINE STYLES to guarantee alignment and bypass CSS specificity issues
    const labelContainerStyle = 'position: relative; height: 60px; margin: 0; padding: 0; pointer-events: none;';
    const spanStyle = 'position: absolute; top: 0; right: 12px; transform: translateY(-50%); display: block; background: #ffffff; padding: 0 4px; z-index: 50; font-weight: 600; color: #64748b; font-size: 0.75rem;';

    // FIX V247: ABSOLUTE POSITIONING STRATEGY
    gutter.style.position = 'relative';
    gutter.style.paddingTop = '0';
    gutter.style.marginTop = '0';
    // Ensure height is explicit
    const totalHeight = (endHour - startHour + 1) * 60;
    gutter.style.height = `${totalHeight}px`;

    // We need to ensure the time gutter container allows overflow so 00:00 isn't cut off
    gutter.style.overflow = 'visible';
    // Gutter needs position relative for absolute children
    gutter.style.position = 'relative';

    let contentHtml = '';

    // FIX V248: STRICT ABSOLUTE ALIGNMENT
    // Using absolute positioning for labels to guarantee pixel-perfect alignment with grid lines.
    // We enforce translateY(-50%) on ALL labels, including 00:00, to satisfy user demand for "correct" alignment.

    // FIX V250: STRICT ABSOLUTE ALIGNMENT OVERRIDE
    // We explicitly override ALL external CSS properties that might shift the label.
    // padding: 0 !important; transform: none !important; margin: 0 !important; border: 0 !important;
    // The inner span handles the vertical centering (-50%).

    // FIX V251: PURE GRID LINES (No CSS Class)
    // We remove 'grid-line-hour' class to avoid the "Double Border" issue (Solid Bottom from CSS vs Dashed Top from JS).
    // Now we get exactly ONE line per hour (Dashed Top). This solves the "Every two lines" visual glitch.

    // FIX V252: DEBUG RED LINES
    // User reports no change. We MUST verify if code is running.
    // Changing lines to BRIGHT RED and THICK.

    for (let h = 0; h <= endHour; h++) {
        const topPx = (h - startHour) * 60;
        let zIndex = h === 0 ? 101 : 50;

        // FIX V259: CLEAN LABELS & CSS OVERRIDES
        // We use a clean DIV container (no class) to avoid global CSS.
        // We ensure strict vertical alignment: line-height: 1, top: -0.4em offset.
        // Cushion padding is zeroed as requested.
        contentHtml += `
            <div style="position: absolute; top: ${topPx}px; left: 0; width: 100%; height: 0; pointer-events: none; z-index: ${zIndex};">
                <span style="position: absolute; top: -0.4em; right: 8px; transform: translateY(-50%); display: block; line-height: 1 !important; margin: 0 !important; padding: 0 !important; font-weight: 600; color: #64748b; font-size: 0.75rem; background: transparent;">
                    ${h}:00
                </span>
            </div>`;

        // Grid line - just a horizontal dashed line (no label)
        gridLinesHtml += `<div style="height: 60px; width: 100%; border-top: 1px dashed rgba(0,0,0,0.06); box-sizing: border-box; margin: 0; padding: 0;"></div>`;
    }
    // Labels go in the gutter column
    gutter.innerHTML = contentHtml;

    if (bgLayer) bgLayer.innerHTML = gridLinesHtml;


    // 4. Render Grid Columns & Events
    let columnsHtml = '';

    days.forEach((dayDate) => {
        // Fix: Use local date formatting to avoid UTC off-by-one errors
        const y = dayDate.getFullYear();
        const m = String(dayDate.getMonth() + 1).padStart(2, '0');
        const d = String(dayDate.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        const dayId = dayDate.getDay();

        // --- AVAILABILITY LOGIC ---
        // 1. Check Rest Day
        const isRest = availabilityCache.restDays.some(r => {
            return dateStr >= r.start_date && dateStr <= r.end_date;
        });

        // 2. Check Overrides
        const dayOverrides = availabilityCache.overrides.filter(o => o.date === dateStr);

        // 3. Determine Active Slots
        let activeSlots = [];
        const hasSpecificOverrides = dayOverrides.length > 0;

        if (isRest) {
            activeSlots = [];
        } else if (hasSpecificOverrides) {
            // ONLY use the overrides that are marked as available
            activeSlots = dayOverrides.filter(o => o.is_available);
        } else {
            activeSlots = availabilityCache.rules.filter(r => r.day_of_week === dayId);
        }

        // Render Availability Background
        // We assume day-col has a grayish background, and we paint "Available" slots as white.
        let availabilityHtml = '';

        // Parse ISO time/Date/String to "Wall Time" Hours
        const getWallTime = (input) => {
            if (!input) return null; // Return null if invalid
            // Handle Date object (use its local time)
            if (input instanceof Date) {
                return input.getHours() + input.getMinutes() / 60;
            }
            // Handle String
            if (typeof input === 'string') {
                // CASE 1: ISO String (has T, Z, or +) -> Use Browser Timezone
                // This converts 11:00 UTC -> 12:00 Local (Italy)
                if (input.includes('T') || input.includes('Z') || input.includes('+')) {
                    const d = new Date(input);
                    if (!isNaN(d.getTime())) {
                        return d.getHours() + d.getMinutes() / 60;
                    }
                }

                // CASE 2: Simple Time String (HH:MM:SS) -> Naive Parse
                // Used for availability rules e.g. "09:00:00" -> 9
                try {
                    let timePart = input;
                    // Fallback cleanup if T exists but Date fail (unlikely but safe)
                    if (input.includes('T')) timePart = input.split('T')[1];
                    else if (input.includes(' ')) timePart = input.split(' ')[1];

                    const clean = timePart.split(/[Z+\-]/)[0];
                    const [h, m] = clean.split(':').map(Number);
                    if (isNaN(h)) return null;
                    return h + (m / 60);
                } catch (e) {
                    console.warn("Time parse warn:", input, e);
                    return null;
                }
            }
            return null;
        };

        if (!isRest) {
            // Get busy intervals - Precise Timestamp Overlap Logic
            const dayStartMs = dayDate.getTime();
            const dayEndMs = dayStartMs + 86400000;

            const dayBusy = availabilityCache.googleBusy.filter(b => {
                const bStart = new Date(b.start).getTime();
                const bEnd = new Date(b.end).getTime();
                return bStart < dayEndMs && bEnd > dayStartMs;
            }).map(b => {
                const bStart = new Date(b.start).getTime();
                const bEnd = new Date(b.end).getTime();
                let startH = (bStart - dayStartMs) / 3600000;
                let endH = (bEnd - dayStartMs) / 3600000;

                if (startH < 0) startH = 0;
                if (endH > 24) endH = 24;
                return { start: startH, end: endH, original: b };
            });

            // RENDER GOOGLE BUSY BLOCKS
            dayBusy.forEach(busy => {
                const topPx = (busy.start - startHour) * 60;
                const heightPx = (busy.end - busy.start) * 60;

                // Render Gray Block for Google Event
                availabilityHtml += `
                    <div class="agenda-google-block" 
                         style="
                            position: absolute; 
                            top: ${topPx}px; 
                            height: ${heightPx}px; 
                            left: 0; right: 0; 
                            background: repeating-linear-gradient(45deg, rgba(241, 245, 249, 0.5), rgba(241, 245, 249, 0.5) 10px, rgba(226, 232, 240, 0.5) 10px, rgba(226, 232, 240, 0.5) 20px);
                            border: 1px solid rgba(203, 213, 225, 0.2);
                            z-index: 6;
                            pointer-events: none;
                            opacity: 0.4;
                        ">
                        <span style="position: absolute; top: 2px; right: 4px; font-size: 10px; color: #64748b; font-weight: 600; opacity: 0.5;">Google</span>
                    </div>
                `;
            });

            // SPLIT AVAILABILITY SLOTS BASED ON GOOGLE BUSY
            let finalAvailabilitySlots = [];

            activeSlots.forEach(slot => {
                const sH = getWallTime(slot.start_time);
                let eH = getWallTime(slot.end_time);
                if (eH === 0 && slot.end_time === '23:59:00') eH = 24;

                // Start with the full slot as one piece
                let currentPieces = [{ start: sH, end: eH }];

                // Subtract each busy block from the pieces
                dayBusy.forEach(busy => {
                    let nextPieces = [];
                    currentPieces.forEach(piece => {
                        // Check overlap
                        const overlapStart = Math.max(piece.start, busy.start);
                        const overlapEnd = Math.min(piece.end, busy.end);

                        if (overlapStart < overlapEnd) {
                            // There is an overlap, we need to split (result is the non-overlapping parts)

                            // Part BEFORE the busy block
                            if (piece.start < overlapStart) {
                                nextPieces.push({ start: piece.start, end: overlapStart });
                            }
                            // Part AFTER the busy block
                            if (piece.end > overlapEnd) {
                                nextPieces.push({ start: overlapEnd, end: piece.end });
                            }
                        } else {
                            // No overlap, keep original piece
                            nextPieces.push(piece);
                        }
                    });
                    currentPieces = nextPieces;
                });

                finalAvailabilitySlots.push(...currentPieces);
            });

            // Render Final (Fragmented) Availability Slots
            finalAvailabilitySlots.forEach(slot => {
                // effective range check
                if (slot.end <= startHour || slot.start >= endHour) return;
                const effectiveStart = Math.max(slot.start, startHour);
                const effectiveEnd = Math.min(slot.end, endHour);

                if (effectiveEnd <= effectiveStart) return;

                const topPx = (effectiveStart - startHour) * 60;
                const heightPx = (effectiveEnd - effectiveStart) * 60;

                availabilityHtml += `
                    <div class="agenda-availability-slot" 
                         style="
                            position: absolute; 
                            top: ${topPx}px; 
                            height: ${heightPx}px; 
                            left: 2px;
                            width: 2px;
                            background: #a855f7;
                            border-radius: 4px;
                            box-shadow: 0 0 8px rgba(168, 85, 247, 0.6), 0 0 4px rgba(168, 85, 247, 0.4);
                            z-index: 5;
                            pointer-events: none;
                        ">
                    </div>
                `;
            });

            // Render Google Busy Blocks (Visuals disabled)
        }

        // Filter events
        const dayEvents = eventsCache.filter(e => e.start_time.startsWith(dateStr));

        let eventsHtml = '';

        // Render Events & Appointments
        if (dayEvents.length > 0) {
            dayEvents.forEach(ev => {
                // Use Wall Time for Events too
                const startH = getWallTime(ev.start_time);
                let endH = getWallTime(ev.end_time);

                const startRaw = new Date(ev.start_time);
                const endRaw = new Date(ev.end_time);

                if (endH === 0) endH = 24; // Handle midnight wrap if needed

                if (startH < startHour) return;

                const topPx = (startH - startHour) * 60;
                const heightPx = Math.max((endH - startH) * 60, 30);

                const statusClass = `status-${ev.status || 'scheduled'}`;
                const bgColor = ev.color || '#a855f7';

                const evtId = `evt_appt_${ev.id.replace(/-/g, '_')}`;
                window[evtId] = ev;

                // FIX V263: Use Local Time (no UTC param)
                const timeStr = `${startRaw.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} - ${endRaw.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;

                // NEW V262 DESIGN: Pro Card Look
                const accentColor = ev.color || '#a855f7';

                // Construct richer subtitle with Order/Client info
                let richerSubtitle = '';
                if (ev.isAppointment && ev.orders) {
                    const orderInfo = ev.orders.order_number ? `#${ev.orders.order_number}` : '';
                    const clientInfo = ev.orders.clients?.business_name || ev.client_name || '';
                    if (clientInfo && orderInfo) {
                        richerSubtitle = `<div class="event-subtitle" style="color: #475569; font-size: 0.7rem; margin-top: 2px;">
                            <span style="font-weight: 600;">${clientInfo}</span> • ${orderInfo}
                        </div>`;
                    } else if (clientInfo || orderInfo) {
                        richerSubtitle = `<div class="event-subtitle" style="color: #475569; font-size: 0.7rem; margin-top: 2px;">
                            ${clientInfo || orderInfo}
                        </div>`;
                    }
                } else if (ev.client_name) {
                    richerSubtitle = `<div class="event-subtitle" style="color: #475569; font-size: 0.7rem; margin-top: 2px;">${ev.client_name}</div>`;
                }

                eventsHtml += `
                    <div class="agenda-event type-appointment ${statusClass}" 
                         style="
                            position: absolute;
                            top: ${topPx + 1}px; 
                            height: ${heightPx - 2}px; 
                            left: 2px; right: 2px;
                            z-index: 10; 
                            background: color-mix(in srgb, ${accentColor}, white 85%); 
                            border: 1px solid rgba(0,0,0,0.05);
                            border-left: 4px solid ${accentColor};
                            border-radius: 6px;
                            box-shadow: 0 4px 6px rgba(0,0,0,0.02);
                            padding: 6px 8px;
                            display: flex;
                            flex-direction: column;
                            gap: 2px;
                            overflow: hidden;
                            transition: all 0.2s;
                            cursor: pointer;
                        "
                         onclick="openEventDetails(window['${evtId}'])"
                         onmouseover="this.style.boxShadow='0 8px 15px rgba(0,0,0,0.06)'; this.style.transform='translateY(-1px)'"
                         onmouseout="this.style.boxShadow='0 4px 6px rgba(0,0,0,0.02)'; this.style.transform='none'"
                    >
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                            <span class="event-time" style="font-size: 0.65rem; font-weight: 700; color: ${accentColor}; text-transform: uppercase;">${timeStr}</span>
                            ${ev.status === 'confermato' ? '<span style="color: #22c55e; font-size: 10px;">●</span>' : ''}
                        </div>
                        <div class="event-title" style="font-weight: 700; color: #1e293b; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;">
                            ${ev.title || ev.appointment_types?.name || 'Appuntamento'}
                        </div>
                        ${richerSubtitle}
                    </div>
                `;
            });
        }

        // Current Time Indicator
        let nowHtml = '';
        const now = new Date();
        if (dayDate.toDateString() === now.toDateString()) {
            const nowH = now.getHours() + now.getMinutes() / 60;
            if (nowH >= startHour && nowH <= endHour) {
                const topPx = (nowH - startHour) * 60;
                nowHtml = `<div class="current-time-line" style="top: ${topPx}px;"></div>`;
            }
        }

        // Day Column Background
        // If Rest Day -> Striped Gray
        // Normal -> Transparent
        let colStyle = 'background-color: transparent;';
        if (isRest) {
            colStyle = `
                background-color: #f8fafc; 
                background-image: repeating-linear-gradient(45deg, #f1f5f9 0, #f1f5f9 10px, #f8fafc 10px, #f8fafc 20px);
            `;
        }

        columnsHtml += `
            <div class="day-col" data-date="${dateStr}" style="${colStyle} position: relative; border-right: 1px solid rgba(0,0,0,0.05); min-width: 100px;">
                ${availabilityHtml}
                ${eventsHtml}
                ${nowHtml}
            </div>
        `;
    });

    // Reconstruct Main Grid
    // Important: .grid-lines-layer must be ABSOLUTELY positioned, not in grid flow
    grid.style.position = 'relative';
    grid.style.minHeight = `${24 * 60}px`; // 24 hours * 60px per hour

    grid.innerHTML = `
        <div class="grid-lines-layer" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 0; pointer-events: none;">
            ${gridLinesHtml}
        </div>
        <div class="grid-columns-container" style="display: grid; position: relative; z-index: 1;">
            ${columnsHtml}
        </div>
    `;

    // Remove Debug Overlay if exists
    const existingDebug = document.getElementById('agenda-debug-overlay');
    if (existingDebug) existingDebug.remove();

    // CSS Grid Cols
    const cols = currentView === 'week' ? 7 : 1;
    const colsContainer = grid.querySelector('.grid-columns-container');
    if (colsContainer) {
        colsContainer.style.cssText = `
            display: grid;
            position: absolute; 
            top: 0; left: 0; right: 0; bottom: 0;
            z-index: 1;
            grid-template-columns: repeat(${cols}, 1fr);
        `;
    }
    header.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    // --- NOW LINE INTEGRATION ---
    if (nowLineInterval) clearInterval(nowLineInterval);
    renderNowLine();
    nowLineInterval = setInterval(renderNowLine, 60000); // Update every minute
    // Auto-scroll (only if we just rendered today's view)
    // Simple heuristic: if we have a .now-line, scroll to it.
    setTimeout(() => {
        if (document.querySelector('.now-line')) {
            scrollToNow();
        }
    }, 100);

    renderSideEventList();
}

// --- SIDEBAR EVENT LIST ---
function renderSideEventList() {
    const listContainer = document.getElementById('agenda-sidebar-list');
    if (!listContainer) return;

    // Determine current view range
    let start, end;
    if (currentView === 'day') {
        start = new Date(currentDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(currentDate);
        end.setHours(23, 59, 59, 999);
    } else if (currentView === 'week') {
        const day = currentDate.getDay(); // 0 (Sun) - 6 (Sat)
        // Adjust to Monday start
        const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(currentDate);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);

        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
    } else {
        start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
    }

    // Filter events in range
    const relevantEvents = eventsCache.filter(ev => {
        // Check filters
        if (ev.isAppointment && !filters.appointments) return false;
        if (!ev.isAppointment && !filters.bookings) return false;

        const evStart = new Date(ev.start_time);
        return evStart >= start && evStart <= end;
    });

    // Sort by Date then Time
    relevantEvents.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    // Group by Day
    const grouped = {};
    relevantEvents.forEach(ev => {
        const d = new Date(ev.start_time);
        const dateKey = d.toDateString();
        if (!grouped[dateKey]) {
            grouped[dateKey] = {
                date: d,
                events: []
            };
        }
        grouped[dateKey].events.push(ev);
    });

    if (Object.keys(grouped).length === 0) {
        listContainer.innerHTML = '<div class="sidebar-empty-state">Nessun evento in questo periodo</div>';
        return;
    }

    let html = '';
    const sortedKeys = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));

    sortedKeys.forEach(key => {
        const group = grouped[key];
        const dayName = group.date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });

        html += `
            <div class="sidebar-day-group">
                <div class="sidebar-day-header">${dayName}</div>
        `;

        group.events.forEach(ev => {
            const startT = new Date(ev.start_time);
            const endT = new Date(ev.end_time);
            // Format time: "14:30"
            const startTimeStr = startT.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
            const endTimeStr = endT.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

            const typeClass = ev.isAppointment ? 'type-appointment' : 'type-booking';
            const title = ev.isAppointment ? (ev.title || 'Appuntamento') : (ev.booking_items?.name || 'Prenotazione');
            let subtitle = '';

            if (ev.isAppointment && ev.orders) {
                subtitle = ev.orders.clients?.business_name || ev.client_name || '';
            } else if (ev.client_name) {
                subtitle = ev.client_name;
            }

            const evtId = `evt_side_${ev.id.replace(/-/g, '_')}`;
            window[evtId] = ev;

            html += `
                <div class="sidebar-event-row" onclick="openEventDetails(window['${evtId}'])">
                    <div class="sidebar-row-time">
                        <span>${startTimeStr}</span>
                        <span class="end-time">${endTimeStr}</span>
                    </div>
                    <div class="sidebar-row-dot ${typeClass}"></div>
                    <div class="sidebar-row-content">
                        <div class="sidebar-row-title">${title}</div>
                        ${subtitle ? `<div class="sidebar-row-subtitle">${subtitle}</div>` : ''}
                    </div>
                </div>
            `;
        });

        html += `</div>`;
    });

    listContainer.innerHTML = html;
}

// --- MINI CALENDAR ---

function renderMiniCalendar() {
    const wrapper = document.getElementById('mini-calendar');
    if (!wrapper) return;

    const y = miniCalendarDate.getFullYear();
    const m = miniCalendarDate.getMonth();

    // First day of the month
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);

    // Determine start day index (Monday = 0)
    let startDayIdx = firstDay.getDay() - 1;
    if (startDayIdx < 0) startDayIdx = 6;

    // Italian Month Name
    const monthName = firstDay.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    let daysHtml = '';

    // Previous month filler
    const prevMonthLastDay = new Date(y, m, 0).getDate();
    for (let i = 0; i < startDayIdx; i++) {
        const dayNum = prevMonthLastDay - startDayIdx + i + 1;
        daysHtml += `<div class="mini-cal-day other-month">${dayNum}</div>`;
    }

    const todayStr = new Date().toDateString();
    const selectedStr = currentDate.toDateString();

    // Calculate week range for highlighting if in week view
    let weekStart, weekEnd;
    if (currentView === 'week') {
        const day = currentDate.getDay();
        const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
        weekStart = new Date(currentDate);
        weekStart.setDate(diff);
        weekStart.setHours(0, 0, 0, 0);

        weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
        const dDate = new Date(y, m, d);
        let classes = 'mini-cal-day';

        // Today check
        if (dDate.toDateString() === todayStr) classes += ' today';

        // Active Logic
        if (currentView === 'week') {
            if (dDate >= weekStart && dDate <= weekEnd) classes += ' active-range';
            if (dDate.toDateString() === selectedStr) classes += ' active';
        } else {
            if (dDate.toDateString() === selectedStr) classes += ' active';
        }

        daysHtml += `<div class="${classes}" onclick="selectMiniDate(${y}, ${m}, ${d})">${d}</div>`;
    }

    // Next month filler
    const totalCells = startDayIdx + lastDay.getDate();
    const nextMonthDays = 42 - totalCells; // 6 rows * 7 cols
    if (nextMonthDays > 0) {
        for (let i = 1; i <= nextMonthDays; i++) {
            daysHtml += `<div class="mini-cal-day other-month">${i}</div>`;
        }
    }

    wrapper.innerHTML = `
        <div class="mini-cal-header">
            <span class="mini-cal-month">${capitalizedMonth}</span>
            <div style="display:flex; gap:4px">
                <button class="mini-cal-nav-btn" onclick="navMiniCal(-1)"><span class="material-icons-round" style="font-size:18px">chevron_left</span></button>
                <button class="mini-cal-nav-btn" onclick="navMiniCal(1)"><span class="material-icons-round" style="font-size:18px">chevron_right</span></button>
            </div>
        </div>
        <div class="mini-cal-grid">
            <div class="mini-cal-day-name">L</div>
            <div class="mini-cal-day-name">M</div>
            <div class="mini-cal-day-name">M</div>
            <div class="mini-cal-day-name">G</div>
            <div class="mini-cal-day-name">V</div>
            <div class="mini-cal-day-name">S</div>
            <div class="mini-cal-day-name">D</div>
            ${daysHtml}
        </div>
    `;

    // Global Handlers
    window.navMiniCal = (delta) => {
        miniCalendarDate.setMonth(miniCalendarDate.getMonth() + delta);
        renderMiniCalendar();
    };
    window.selectMiniDate = (y, m, d) => {
        currentDate = new Date(y, m, d);
        // Align to Monday if week view
        if (currentView === 'week') {
            const day = currentDate.getDay();
            const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
            currentDate.setDate(diff);
        }

        // Reset Google Cache & Fetch
        availabilityCache.googleBusy = [];
        window._googleBusyFetchInProgress = false;

        fetchMyBookings().then(() => updateView());

        // Sync mini cal date 
        miniCalendarDate = new Date(currentDate);
        renderMiniCalendar();
    };
}


// --- UTILS ---

function changePeriod(delta) {
    if (currentView === 'month') {
        currentDate.setMonth(currentDate.getMonth() + delta);
    } else if (currentView === 'week') {
        currentDate.setDate(currentDate.getDate() + (delta * 7));
    } else {
        currentDate.setDate(currentDate.getDate() + delta);
    }
    // Reset google busy cache when changing period to fetch new data
    availabilityCache.googleBusy = [];
    window._googleBusyFetchInProgress = false;
    window._googleBusyFetchStart = null;

    // Re-fetch all data including calendar
    fetchMyBookings().then(() => updateView());
    miniCalendarDate = new Date(currentDate);
    renderMiniCalendar();
}

function updateView() {
    renderTimeline();
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById('view-' + currentView);
    if (activeBtn) activeBtn.classList.add('active');
}

function switchView(view) {
    currentView = view;
    updateView();
    renderMiniCalendar();
}

function toggleFilter(filterKey) {
    filters[filterKey] = !filters[filterKey];
    const el = document.querySelector(`.filter-item[data-filter="${filterKey}"]`);
    if (el) {
        if (filters[filterKey]) el.classList.add('active');
        else el.classList.remove('active');
    }
    renderTimeline();
}

function formatDate(date, full = false) {
    // Italian Formatting
    if (full) {
        const s = date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
    // Short: "12 Gen"
    const s = date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    const parts = s.split(' ');
    // Assuming format "12 gen" or "gen 12", standardize if necessary
    // Browser implementation varies, but let's trust default 'it-IT' output for short/medium
    return s; // e.g. "12 gen"
}

// --- EVENT DETAIL MODAL ---
// Now imported from shared features/agenda_utils.js to ensure consistency with homepage
// window.openEventDetails and window.closeEventModal are handled by the import side-effect or direct assignment below.

import { openEventDetails, closeEventModal } from './agenda_utils.js?v=157';

window.openEventDetails = openEventDetails; // Ensure global availability
window.closeEventModal = closeEventModal;

function updateSyncStatus(status, text) {
    const container = document.getElementById('google-sync-indicator');
    const dot = document.getElementById('sync-status-dot-header');

    if (!container || !dot) return;

    container.classList.remove('hidden');
    container.title = `Google Calendar: ${text}`;

    // Reset styles
    dot.style.background = '#9ca3af'; // gray default
    dot.classList.remove('animate-pulse');

    if (status === 'syncing') {
        dot.style.background = '#fbbf24'; // yellow
        dot.classList.add('animate-pulse');
    } else if (status === 'success') {
        dot.style.background = '#22c55e'; // green
    } else if (status === 'error') {
        dot.style.background = '#ef4444'; // red
    }
}

function renderMonthlyView() {
    const timelineWrapper = document.querySelector('.timeline-wrapper');
    const label = document.getElementById('period-label');
    if (!timelineWrapper || !label) return;

    // 1. Determine Month Range
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);

    // Label
    const monthName = firstDay.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    label.innerHTML = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    // Determine start day index (Monday = 0)
    let startDayIdx = firstDay.getDay() - 1;
    if (startDayIdx < 0) startDayIdx = 6;

    // 2. Prepare HTML
    let daysHtml = '';

    // Previous month filler
    const prevMonthLastDay = new Date(y, m, 0).getDate();
    for (let i = 0; i < startDayIdx; i++) {
        const dNum = prevMonthLastDay - startDayIdx + i + 1;
        daysHtml += `<div class="monthly-day-box other-month">
            <div class="monthly-day-num">${dNum}</div>
        </div>`;
    }

    const todayStr = new Date().toDateString();

    // Current month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
        const dDate = new Date(y, m, d);
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = dDate.toDateString() === todayStr;

        // Check availability
        const dayId = dDate.getDay();
        const isRest = availabilityCache.restDays.some(r => dateStr >= r.start_date && dateStr <= r.end_date);
        const dayOverrides = availabilityCache.overrides.filter(o => o.date === dateStr);
        let activeSlots = [];
        if (!isRest) {
            if (dayOverrides.length > 0) {
                activeSlots = dayOverrides.filter(o => o.is_available);
            } else {
                activeSlots = availabilityCache.rules.filter(r => r.day_of_week === dayId);
            }
        }
        const isAvailable = activeSlots.length > 0;

        // Filter events for this day
        const dayEvents = eventsCache.filter(e => e.start_time.startsWith(dateStr));

        let eventsHtml = '';
        dayEvents.forEach(ev => {
            const isBooking = !ev.isAppointment;
            const isAppt = ev.isAppointment;

            if ((isBooking && filters.bookings) || (isAppt && filters.appointments)) {
                const statusClass = `status-${ev.status}`;
                const typeClass = isAppt ? 'type-appointment' : 'type-booking';
                const label = isAppt ? (ev.title || 'Appuntamento') : (ev.booking_items?.name || 'Prenotazione');

                const evtId = `evt_month_${ev.id.replace(/-/g, '_')}`;
                window[evtId] = ev;
                eventsHtml += `
                    <div class="monthly-event-dot ${typeClass} ${statusClass}" onclick="openEventDetails(window['${evtId}'])">
                        ${label}
                    </div>
                `;
            }
        });

        daysHtml += `
            <div class="monthly-day-box ${isToday ? 'today' : ''} ${isAvailable ? 'has-availability' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div class="monthly-day-num">${d}</div>
                    ${isAvailable ? '<div class="availability-indicator" title="Disponibile"></div>' : ''}
                </div>
                <div class="monthly-day-events">
                    ${eventsHtml}
                </div>
            </div>
        `;
    }

    // Next month filler
    const totalCells = startDayIdx + lastDay.getDate();
    const nextMonthDays = 42 - totalCells; // 6 rows
    if (nextMonthDays > 0) {
        for (let i = 1; i <= nextMonthDays; i++) {
            daysHtml += `<div class="monthly-day-box other-month">
                <div class="monthly-day-num">${i}</div>
            </div>`;
        }
    }

    timelineWrapper.innerHTML = `
        <div class="monthly-view-wrapper animate-fade-in">
            <div class="monthly-header">
                <div class="monthly-header-day">Lun</div>
                <div class="monthly-header-day">Mar</div>
                <div class="monthly-header-day">Mer</div>
                <div class="monthly-header-day">Gio</div>
                <div class="monthly-header-day">Ven</div>
                <div class="monthly-header-day">Sab</div>
                <div class="monthly-header-day">Dom</div>
            </div>
            <div class="monthly-grid">
                ${daysHtml}
            </div>
        </div>
    `;
}

// Global interval reference to clear it on re-renders
let nowLineInterval = null;

function renderNowLine() {
    // 1. Remove existing lines
    document.querySelectorAll('.now-line').forEach(el => el.remove());

    // Only for Week or Day view
    if (currentView === 'month') return;

    // 2. Determine "Today" column
    const grid = document.getElementById('main-grid');
    if (!grid) return;

    const today = new Date();
    const headers = document.querySelectorAll('.day-col-header');

    // Find index of today in the CURRENT view's headers
    let todayIndex = -1;
    headers.forEach((h, i) => {
        // We can check the .today class we added in renderTimeline
        if (h.classList.contains('today')) {
            todayIndex = i;
        }
    });

    if (todayIndex === -1) return; // Today not visible in this week/day view

    // 3. Calculate Top Position
    const h = today.getHours();
    const m = today.getMinutes();
    const topPx = (h * 60) + m;

    // 4. Render Line
    // We need to append it to the specific day column, typically logical 
    // BUT our columns might be virtual or just grid columns.
    // Our .main-grid is `display: grid`.
    // We can insert a div that spans valid column or is placed in that specific grid column.

    // Check if we have specific .day-events-col containers?
    // In renderTimeline -> grid-columns-container we have columns.
    const colsContainer = grid.querySelector('.grid-columns-container');
    if (colsContainer) {
        // We can append to this container? No, it's z-index 1.
        // We can append to the main-grid directly and position it with grid-column.

        // Grid column index: 
        // If 'week', columns are 1..7. todayIndex is 0..6. So column is todayIndex + 1.

        const line = document.createElement('div');
        line.className = 'now-line';
        line.style.top = `${topPx}px`;
        // Explicitly span 1 column to avoid ambiguity
        line.style.gridColumn = `${todayIndex + 1} / span 1`;
        line.style.gridRow = '1 / -1'; // Span all rows (should be just one big row relative container)

        // Use the grid container so grid-column works!
        colsContainer.appendChild(line);
    }
}

function scrollToNow() {
    const today = new Date();
    // Only scroll if today is roughly in range (e.g. 0-24h)
    // Calculate position
    const h = today.getHours();
    const container = document.getElementById('agenda-grid-container');

    if (container) {
        // Center: (h * 60) - (containerHeight / 2)
        const target = (h * 60) - (container.clientHeight / 2);
        container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }
}

// --- CRITICAL CSS INJECTION ---
// --- CRITICAL CSS INJECTION ---
function injectAgendaStyles() {
    let style = document.getElementById('agenda-js-styles');
    if (!style) {
        style = document.createElement('style');
        style.id = 'agenda-js-styles';
        document.head.appendChild(style);
    }

    const css = `
        /* LOCAL RESET */
        .timeline-scroll-container * { 
            box-sizing: border-box !important; 
            margin: 0 !important; 
            padding: 0 !important; 
        }

        #agenda-view-wrapper { background: #ffffff !important; }
        
        /* GRID LAYOUT - THE FIX */
        .timeline-scroll-container {
            display: grid !important;
            grid-template-columns: 70px 1fr !important; /* Gutter | Content */
            grid-template-rows: 90px 1fr !important;    /* Header | Body */
            overflow: auto !important;
            height: 100% !important;
            background: #ffffff !important;
            scroll-behavior: smooth !important;
            position: relative !important;
        }

        /* 1. CORNER (Top-Left) - Sticky Both */
        .time-gutter-header {
            grid-column: 1 !important;
            grid-row: 1 !important;
            position: sticky !important;
            top: 0 !important;
            left: 0 !important;
            z-index: 100 !important;
            background: #ffffff !important;
            border-right: 1px solid rgba(0,0,0,0.05) !important;
            border-bottom: 1px solid rgba(0,0,0,0.05) !important;
        }

        /* 2. HEADER ROW (Top-Right) - Sticky Top */
        .timeline-header-row {
            grid-column: 2 !important;
            grid-row: 1 !important;
            position: sticky !important;
            top: 0 !important;
            z-index: 90 !important;
            background: #ffffff !important;
            border-bottom: 1px solid rgba(0,0,0,0.05) !important;
            display: flex !important;
            flex-direction: row !important;
            align-items: stretch !important;
            /* Width handled by grid/flex grow */
        }

        /* 3. TIME GUTTER (Bottom-Left) - Sticky Left */
        .time-gutter {
            grid-column: 1 !important;
            grid-row: 2 !important;
            position: sticky !important;
            left: 0 !important;
            z-index: 80 !important;
            background: #ffffff !important;
            border-right: 1px solid rgba(0,0,0,0.05) !important;
            display: flex !important;
            flex-direction: column !important;
            margin: 0 !important;
            padding: 0 !important;
            gap: 0 !important; /* Killer of unexpected spaces */
            height: max-content !important; /* let it grow as needed */
        }

        /* 4. MAIN GRID (Bottom-Right) - Scrollable Content */
        .main-grid {
            grid-column: 2 !important;
            grid-row: 2 !important;
            position: relative !important;
            display: flex !important;
            flex-direction: row !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            /* No sticky, moves freely */
        }

        /* COMPONENT STYLES */

        /* Header Cells */
        .day-col-header {
            height: 100% !important;
            flex: 1 0 100px !important; /* Matches day-col width */
            border-right: 1px solid rgba(0,0,0,0.05) !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 6px !important;
            background: #ffffff !important;
        }
        
        .day-col-header .day-name { font-size: 0.75rem !important; color: var(--text-tertiary) !important; font-weight: 600 !important; text-transform: uppercase !important; }
        .day-col-header .day-num { font-size: 1.4rem !important; color: var(--text-primary) !important; font-weight: 700 !important; }
        .day-col-header.today .day-num { color: var(--brand-blue) !important; }
        .day-col-header.today .day-name { color: var(--brand-blue) !important; }

        /* Time Slots */
        /* Time Slots - UPDATED FOR ABSOLUTE POSITIONING (V249) */
        .time-slot-label {
            /* Handled by inline styles: position: absolute, top: X, height: 0 */
            /* We remove fixed height so it doesn't push flow */
            width: 100% !important;
            border-bottom: none !important;
            padding: 0 !important;
            margin: 0 !important;
            pointer-events: none !important;
        }
        
        /* Centering the label visually ON the grid line */
        .time-slot-label span {
            position: absolute !important;
            top: 0 !important;
            right: 12px !important;
            transform: translateY(-50%) !important; /* Pull UP to center on the line */
            
            display: block !important;
            background: #ffffff !important;
            padding: 0 4px !important;
            
            font-size: 0.75rem !important;
            font-family: inherit !important;
            font-weight: 600 !important;
            color: #64748b !important;
            line-height: normal !important;
            border-radius: 4px !important;
        }

        /* Grid Background Lines */
        .grid-line-hour {
            height: 60px !important;
            border-top: 1px dashed rgba(0,0,0,0.1) !important;
            box-sizing: border-box !important;
            margin: 0 !important;
        }

        /* Days Columns */
        .day-col {
            flex: 1 0 100px !important; /* Matches header width */
            border-right: 1px solid rgba(0,0,0,0.05) !important;
            position: relative !important;
            min-width: 100px !important;
        }

        /* Events */
        .agenda-event {
            position: absolute !important;
            left: 2px !important; 
            right: 2px !important;
            border-radius: 6px !important;
            padding: 4px 8px !important;
            font-size: 0.75rem !important;
            overflow: hidden !important;
            transition: transform 0.2s !important;
            cursor: pointer !important;
            z-index: 10 !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            border-left: 3px solid transparent !important;
            /* Ensure pointer events work */
            pointer-events: auto !important;
        }

        .agenda-event:hover {
            transform: scale(1.02) !important;
            z-index: 100 !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
        }

        .event-time { font-weight: 700 !important; display: block !important; }
        .event-title { font-weight: 600 !important; }

        /* SIDEBAR */
        .agenda-sidebar {
            padding: 24px !important;
            background: var(--card-bg) !important;
            border-left: 1px solid var(--glass-border) !important;
            overflow-y: auto !important;
        }
        .agenda-sidebar * { margin: revert !important; padding: revert !important; box-sizing: border-box !important; }
        .agenda-sidebar h3 { margin-bottom: 16px !important; font-size: 1.1rem !important; }
        .mini-calendar { margin-bottom: 24px !important; }
        .filter-group { margin-top: 24px !important; }
        .filter-item { margin-bottom: 8px !important; display: flex !important; align-items: center !important; }
        .filter-item input { margin-right: 8px !important; }

        /* MODAL FIX V265 */
        .system-modal {
            position: fixed !important;
            top: 0 !important; 
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(0,0,0,0.4) !important;
            backdrop-filter: blur(4px) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 10000 !important;
            opacity: 0;
            animation: fadeIn 0.2s forwards !important;
        }

        .system-modal-content {
            background: #ffffff !important;
            border-radius: 16px !important;
            padding: 24px !important;
            width: 90% !important;
            max-width: 500px !important;
            max-height: 90vh !important;
            overflow-y: auto !important;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
            border: 1px solid rgba(255,255,255,0.7) !important;
            position: relative !important;
            transform: scale(0.95);
            animation: scaleIn 0.2s forwards !important;
        }

        @keyframes fadeIn { to { opacity: 1; } }
        @keyframes scaleIn { to { transform: scale(1); } }
    `;
    style.textContent = css;
}
