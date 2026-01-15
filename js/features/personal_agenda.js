import { supabase } from '../modules/config.js?v=123';
import { state } from '../modules/state.js?v=123';
import { fetchAvailabilityRules, fetchRestDays, fetchAvailabilityOverrides } from '../modules/api.js?v=123';
import { openAvailabilityModal, checkAndHandleGoogleCallback } from './availability_manager.js?v=123';

let currentDate = new Date(); // Represents the start of the week or current view date
let eventsCache = [];
let availabilityCache = { rules: [], restDays: [], overrides: [] };
let currentCollaboratorId = null;
let currentView = 'week'; // 'week', 'day'
let miniCalendarDate = new Date(); // Separate state for mini calendar

let filters = {
    bookings: true,
    deadlines: true,
    reminders: true
};

export async function renderAgenda(container) {
    console.log("[Agenda] renderAgenda called. Container:", container);

    // Set Page Title
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = 'Agenda';

    if (!container) {
        console.error("[Agenda] Container not found!");
        return;
    }

    container.innerHTML = `
        <div class="agenda-container animate-fade-in" id="agenda-view-wrapper">
            
            <!-- SIDEBAR -->
            <aside class="agenda-sidebar">
                <div class="agenda-sidebar-header">
                    <h2>Agenda</h2>
                    <p>Overview Appuntamenti</p>
                </div>

                <!-- Mini Calendar -->
                <div class="mini-calendar" id="mini-calendar">
                    <!-- Rendered via JS -->
                </div>

                <!-- Filters -->
                <div class="agenda-filters">
                    <div class="filter-group-title">Filtri Calendario</div>
                    
                    <div class="filter-item active" data-filter="bookings" onclick="toggleFilter('bookings')">
                        <div class="filter-checkbox" style="background: #0ea5e9; border-color: #0ea5e9;">
                            <i class="material-icons-round">check</i>
                        </div>
                        <span>Prenotazioni</span>
                    </div>

                    <div class="filter-item active" data-filter="deadlines" onclick="toggleFilter('deadlines')">
                        <div class="filter-checkbox" style="background: #f59e0b; border-color: #f59e0b;">
                            <i class="material-icons-round">check</i>
                        </div>
                        <span>Scadenze</span>
                    </div>

                     <div class="filter-item" data-filter="reminders" onclick="toggleFilter('reminders')">
                        <div class="filter-checkbox">
                             <i class="material-icons-round">check</i>
                        </div>
                        <span>Promemoria</span>
                    </div>
                </div>

                <div class="agenda-quick-add" style="margin-top: auto; padding-top: 2rem;">
                   <div class="filter-group-title" style="margin-bottom: 1rem;">Azioni Rapide</div>
                   
                   <button class="quick-add-btn" id="btn-manage-availability" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.8rem; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--glass-border); border-radius: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s; margin-bottom: 0.75rem;">
                        <span class="material-icons-round" style="color: var(--brand-blue);">event_available</span>
                        <span>Disponibilità</span>
                   </button>

                   <button class="quick-add-btn" onclick="window.showAlert('Funzione in arrivo', 'info')" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.8rem; background: var(--brand-blue); color: white; border: none; border-radius: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(var(--brand-blue-rgb, 78, 146, 216), 0.3);">
                        <span class="material-icons-round">add</span>
                        <span>Nuovo Evento</span>
                   </button>
                </div>
            </aside>

            <!-- MAIN CONTENT -->
            <div class="agenda-main">
                <!-- Toolbar -->
                <div class="agenda-main-header">
                    <div class="header-left">
                        <h2 class="date-range-display" id="period-label">
                            <!-- Date Range -->
                        </h2>
                    </div>

                    <div class="header-actions">
                         <div class="view-mode-toggle">
                            <button class="mode-btn active" id="view-week" onclick="switchView('week')">Settimana</button>
                            <button class="mode-btn" id="view-day" onclick="switchView('day')">Giorno</button>
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
                <div class="timeline-wrapper">
                    <!-- Header Row (Days) -->
                    <div class="timeline-header-row" id="timeline-header">
                         <!-- Day Headers injected here -->
                    </div>

                    <!-- Scrollable Body -->
                    <div class="timeline-body">
                        <!-- Time Gutter -->
                        <div class="time-gutter">
                             <!-- 08:00, 09:00 ... -->
                        </div>
                        
                        <!-- Main Grid -->
                        <div class="main-grid" id="main-grid">
                            <!-- Columns & Events -->
                             <div class="grid-lines-layer">
                                <!-- Horizontal Lines -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
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
        renderMiniCalendar();
        updateView();
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
                    // renderTimeline is called inside fetchMyBookings generally, but let's be safe
                });
            } else {
                window.showAlert('Profilo collaboratore non trovato', 'error');
            }
        };
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
                eventsCache = [];
                // Do not return immediately, allow rendering empty agenda
            } else {
                collaboratorId = collabRecord.id;
                console.log("[Agenda] Found collaborator ID:", collaboratorId);
            }
        }

        currentCollaboratorId = collaboratorId;

        if (!collaboratorId) {
            console.warn("[Agenda] No collaborator ID available");
            eventsCache = [];
            availabilityCache = { rules: [], restDays: [], overrides: [] };
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

        const [bookingsRes, rules, restDays, overrides] = await Promise.all([
            bookingsQuery,
            fetchAvailabilityRules(collaboratorId),
            fetchRestDays(collaboratorId),
            fetchAvailabilityOverrides(collaboratorId)
        ]);

        if (bookingsRes.error) {
            console.error("[Agenda] Supabase Error:", bookingsRes.error);
            throw bookingsRes.error;
        }

        eventsCache = bookingsRes.data || [];
        availabilityCache = {
            rules: rules || [],
            restDays: restDays || [],
            overrides: overrides || []
        };

        console.log("[Agenda] Fetched events:", eventsCache.length, "Rules:", availabilityCache.rules.length);

    } catch (err) {
        console.error("[Agenda] Critical fetch error:", err);
    }
}

function renderTimeline() {
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
        endOfPeriod = new Date(startOfPeriod);
        endOfPeriod.setDate(startOfPeriod.getDate() + 6);

        label.innerHTML = `
            ${formatDate(startOfPeriod)} <span class="date-arrow">&rarr;</span> ${formatDate(endOfPeriod)}
            <span style="font-size:0.8rem; color:var(--text-tertiary); display:block; margin-top:2px;">Vista Settimanale</span>
        `;
    } else {
        startOfPeriod = new Date(currentDate);
        endOfPeriod = new Date(currentDate);
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
    const startHour = 7;
    const endHour = 22; // Extended range
    const totalHours = endHour - startHour;

    let gutterHtml = '';
    let gridLinesHtml = '';
    for (let h = startHour; h <= endHour; h++) {
        gutterHtml += `<div class="time-slot-label"><span>${h}:00</span></div>`;
        gridLinesHtml += `<div class="grid-line-hour"></div>`;
    }
    gutter.innerHTML = gutterHtml;

    if (bgLayer) bgLayer.innerHTML = gridLinesHtml;


    // 4. Render Grid Columns & Events
    let columnsHtml = '';

    days.forEach((dayDate) => {
        const dateStr = dayDate.toISOString().split('T')[0];
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
        if (isRest) {
            activeSlots = [];
        } else if (dayOverrides.length > 0) {
            activeSlots = dayOverrides;
        } else {
            activeSlots = availabilityCache.rules.filter(r => r.day_of_week === dayId);
        }

        // Render Availability Background
        // We assume day-col has a grayish background, and we paint "Available" slots as white.
        let availabilityHtml = '';

        const parseTime = (t) => {
            if (!t) return 0;
            const [h, m] = t.split(':').map(Number);
            return h + (m / 60);
        };

        if (!isRest) {
            activeSlots.forEach(slot => {
                const sH = parseTime(slot.start_time);
                const eH = parseTime(slot.end_time);

                // Clip to view range
                if (eH <= startHour || sH >= endHour) return;
                const effectiveStart = Math.max(sH, startHour);
                const effectiveEnd = Math.min(eH, endHour);

                const topPx = (effectiveStart - startHour) * 60;
                const heightPx = (effectiveEnd - effectiveStart) * 60;

                // Color based on service restriction? (Optional: if slot.service_id is set, maybe separate color)
                const isDedicated = !!slot.service_id;
                const borderStyle = isDedicated ? 'border-left: 3px solid #F59E0B;' : 'border-left: 3px solid #667eea;';
                const bgStyle = isDedicated ? 'background: #fffbf0;' : 'background: #ffffff;';

                availabilityHtml += `
                    <div class="availability-slot" style="position: absolute; top: ${topPx}px; height: ${heightPx}px; left: 0; right: 0; ${bgStyle} ${borderStyle} z-index: 0; opacity: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                        ${isDedicated ? '<div style="font-size:0.7rem; color:#d97706; padding:2px 4px; font-weight:500;">Dedicato</div>' : ''}
                    </div>
                `;
            });
        }

        // Filter events
        const dayEvents = eventsCache.filter(e => e.start_time.startsWith(dateStr));

        let eventsHtml = '';

        if (filters.bookings) {
            dayEvents.forEach(ev => {
                const start = new Date(ev.start_time);
                let end = new Date(ev.end_time);

                // Fallback duration
                if (!ev.end_time && ev.booking_items?.duration_minutes) {
                    end = new Date(start.getTime() + ev.booking_items.duration_minutes * 60000);
                }

                const startH = start.getHours() + start.getMinutes() / 60;
                let endH = end.getHours() + end.getMinutes() / 60;

                if (endH === 0 && end.getDate() !== start.getDate()) endH = 24;

                if (startH < startHour) return;

                const topPx = (startH - startHour) * 60;
                const heightPx = (endH - startH) * 60;

                const statusClass = `status-${ev.status}`;

                const evtId = `evt_${ev.id.replace(/-/g, '_')}`;
                window[evtId] = ev;

                eventsHtml += `
                    <div class="agenda-event type-booking ${statusClass}" 
                         style="top: ${topPx}px; height: ${heightPx}px; z-index: 10;"
                         onclick="openEventDetails(window['${evtId}'])">
                        <span class="event-time">${start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                        <div class="event-title">${ev.booking_items?.name || 'Prenotazione'}</div>
                        ${ev.guest_info?.first_name ? `<div class="event-subtitle">con ${ev.guest_info.first_name} ${ev.guest_info.last_name || ''}</div>` : ''}
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
                nowHtml = `
                    <div class="now-indicator" style="top: ${topPx}px; z-index: 20;">
                         <div class="now-dot"></div>
                         <div class="now-line"></div>
                    </div>
                `;
            }
        }

        // Day Column Background
        // If Rest Day -> Striped Gray
        // If Normal Day -> Light Gray (defined in CSS, or inline here)
        // We rely on .day-col styling, but we enforce specific background here if rest day

        let colStyle = 'background-color: #f8fafc;'; // Default light gray
        if (isRest) {
            colStyle = `
                background-color: #f1f5f9; 
                background-image: repeating-linear-gradient(45deg, #e2e8f0 0, #e2e8f0 10px, #f1f5f9 10px, #f1f5f9 20px);
            `;
        }

        columnsHtml += `
            <div class="day-col" data-date="${dateStr}" style="${colStyle} position: relative; border-right: 1px solid var(--glass-border); min-width: 150px;">
                ${availabilityHtml}
                ${eventsHtml}
                ${nowHtml}
            </div>
        `;
    });

    // Reconstruct Main Grid
    grid.innerHTML = `
        <div class="grid-lines-layer">${gridLinesHtml}</div>
        ${columnsHtml}
    `;

    // CSS Grid Cols
    const cols = currentView === 'week' ? 7 : 1;
    header.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
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
        updateView();
        // Sync mini cal date 
        miniCalendarDate = new Date(currentDate);
        renderMiniCalendar();
    };
}


// --- UTILS ---

function changePeriod(delta) {
    if (currentView === 'week') {
        currentDate.setDate(currentDate.getDate() + (delta * 7));
    } else {
        currentDate.setDate(currentDate.getDate() + delta);
    }
    updateView();
    miniCalendarDate = new Date(currentDate);
    renderMiniCalendar();
}

function updateView() {
    renderTimeline();
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(currentView === 'week' ? 'view-week' : 'view-day').classList.add('active');
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

function openEventDetails(event) {
    console.log("[Agenda] Opening details for event:", event);

    const start = new Date(event.start_time);
    const end = new Date(event.end_time || event.start_time);

    const dateStr = start.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = `${start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;

    const guestName = event.guest_info ? `${event.guest_info.first_name} ${event.guest_info.last_name || ''}` : 'Nessun ospite';
    const guestEmail = event.guest_info?.email || '-';
    const guestPhone = event.guest_info?.phone || '-';

    // Create Modal HTML
    const modalHtml = `
        <div class="system-modal active" id="event-detail-modal">
            <div class="system-modal-content" style="max-width: 450px;">
                <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <h3 style="margin:0; font-size:1.2rem; color:var(--text-primary);">Dettagli Appuntamento</h3>
                    <button class="icon-btn" onclick="closeEventModal()">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                
                <div class="modal-body" style="display:flex; flex-direction:column; gap:1rem;">
                    
                    <div style="background:var(--bg-secondary); padding:1rem; border-radius:8px; border-left: 4px solid #0ea5e9;">
                        <div style="font-weight:600; font-size:1.1rem; color:var(--text-primary); margin-bottom:0.25rem;">${event.booking_items?.name || 'Prenotazione'}</div>
                        <div style="font-size:0.9rem; color:var(--text-secondary); display:flex; align-items:center; gap:0.5rem;">
                             <span class="material-icons-round" style="font-size:16px;">schedule</span>
                             ${timeStr}
                        </div>
                         <div style="font-size:0.9rem; color:var(--text-secondary); margin-top:0.25rem;">
                             ${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}
                        </div>
                    </div>

                    <div class="detail-section">
                        <h4 style="font-size:0.85rem; text-transform:uppercase; color:var(--text-tertiary); margin-bottom:0.5rem;">Cliente</h4>
                        <div style="display:flex; align-items:center; gap:0.75rem;">
                            <div style="width:36px; height:36px; background:#e0e7ff; color:#4f46e5; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:600;">
                                ${guestName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style="font-weight:500; color:var(--text-primary);">${guestName}</div>
                                <div style="font-size:0.85rem; color:var(--text-secondary);">${guestEmail}</div>
                                <div style="font-size:0.85rem; color:var(--text-secondary);">${guestPhone}</div>
                            </div>
                        </div>
                    </div>

                    ${event.notes ? `
                    <div class="detail-section">
                        <h4 style="font-size:0.85rem; text-transform:uppercase; color:var(--text-tertiary); margin-bottom:0.5rem;">Note</h4>
                        <p style="font-size:0.9rem; color:var(--text-secondary); background:var(--bg-secondary); padding:0.75rem; border-radius:6px; margin:0;">
                            ${event.notes}
                        </p>
                    </div>
                    ` : ''}

                </div>

                <div class="modal-actions" style="margin-top:1.5rem; display:flex; gap:0.5rem; justify-content:flex-end;">
                     <button class="primary-btn secondary" onclick="closeEventModal()">Chiudi</button>
                     <button class="primary-btn" onclick="alert('Modifica non ancora disponibile')">Modifica</button>
                </div>
            </div>
        </div>
    `;

    // Remove existing if any
    const existing = document.getElementById('event-detail-modal');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Global close handler
    window.closeEventModal = () => {
        const m = document.getElementById('event-detail-modal');
        if (m) m.remove();
    };
}
