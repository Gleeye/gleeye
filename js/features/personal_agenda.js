import { supabase } from '../modules/config.js?v=117';
import { state } from '../modules/state.js?v=117';

let currentDate = new Date();
let eventsCache = [];

export async function renderAgenda(container) {
    // Set Page Title
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = 'Agenda Personale';

    container.innerHTML = `
        <div class="agenda-container animate-fade-in">
            <!-- Toolbar -->
            <div class="agenda-toolbar">
                <div class="calendar-nav">
                    <button class="icon-btn" id="prev-month">
                        <span class="material-icons-round">chevron_left</span>
                    </button>
                    <div class="current-month" id="current-month-label">
                        ${formatMonth(currentDate)}
                    </div>
                    <button class="icon-btn" id="next-month">
                        <span class="material-icons-round">chevron_right</span>
                    </button>
                    <button class="secondary-btn" id="today-btn" style="margin-left: 1rem;">
                        Oggi
                    </button>
                </div>
                
                <div class="actions">
                    <button class="primary-btn" onclick="window.location.hash = 'new-appointment'">
                        <span class="material-icons-round">add</span>
                        Nuovo Appuntamento
                    </button>
                </div>
            </div>

            <!-- Calendar View -->
            <div class="calendar-wrapper">
                <div class="calendar-header">
                    <div class="weekday-label">Lun</div>
                    <div class="weekday-label">Mar</div>
                    <div class="weekday-label">Mer</div>
                    <div class="weekday-label">Gio</div>
                    <div class="weekday-label">Ven</div>
                    <div class="weekday-label">Sab</div>
                    <div class="weekday-label">Dom</div>
                </div>
                <div class="calendar-grid" id="calendar-grid">
                    <!-- Days injected here -->
                    <div class="loading-state">
                        <span class="loader"></span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Bind Controls
    document.getElementById('prev-month').onclick = () => changeMonth(-1);
    document.getElementById('next-month').onclick = () => changeMonth(1);
    document.getElementById('today-btn').onclick = () => {
        currentDate = new Date();
        updateCalendar();
    };

    // Initial Fetch & Render
    await fetchMyBookings();
    renderCalendarGrid();
}

async function fetchMyBookings() {
    try {
        const user = state.impersonatedCollaboratorId || state.profile?.id;

        // Fetch bookings where user is assigned
        let query = supabase
            .from('bookings')
            .select(`
                *,
                booking_items ( name ),
                booking_assignments!inner ( collaborator_id )
            `)
            .eq('booking_assignments.collaborator_id', user);

        const { data, error } = await query;

        if (error) throw error;

        eventsCache = data || [];
        console.log("[Agenda] Fetched events:", eventsCache);

    } catch (err) {
        console.error("[Agenda] Error fetching events:", err);
        window.showAlert("Errore caricamento agenda", "error");
    }
}

function renderCalendarGrid() {
    const grid = document.getElementById('calendar-grid');
    const label = document.getElementById('current-month-label');

    if (!grid || !label) return;

    label.textContent = formatMonth(currentDate);
    grid.innerHTML = '';

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Number of days in month
    const lastDay = new Date(year, month + 1, 0);

    // Adjust logic for Monday start (0=Sun, 1=Mon in JS getDay())
    // We want Mon=0, Sun=6
    let startDayIndex = firstDay.getDay() - 1;
    if (startDayIndex < 0) startDayIndex = 6;

    const totalDays = lastDay.getDate();

    // Previous Month Fillers
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = 0; i < startDayIndex; i++) {
        const dayNum = prevMonthLastDay - startDayIndex + i + 1;
        const cell = createDayCell(dayNum, true);
        grid.appendChild(cell);
    }

    // Current Month Days
    const today = new Date();
    for (let i = 1; i <= totalDays; i++) {
        const isToday = (i === today.getDate() && month === today.getMonth() && year === today.getFullYear());
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

        // Find events for this day
        const dayEvents = eventsCache.filter(e => e.start_time.startsWith(dateStr));

        const cell = createDayCell(i, false, isToday, dayEvents);
        grid.appendChild(cell);
    }

    // Next Month Fillers (to fill grid, e.g. 42 cells total usually standard, or just fill row)
    // Let's just fill the last row
    const totalCells = startDayIndex + totalDays;
    const remaining = 7 - (totalCells % 7);
    if (remaining < 7) {
        for (let i = 1; i <= remaining; i++) {
            const cell = createDayCell(i, true);
            grid.appendChild(cell);
        }
    }
}

function createDayCell(dayNum, isOtherMonth, isToday = false, events = []) {
    const div = document.createElement('div');
    div.className = `calendar-day ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`;

    let html = `<div class="day-number">${dayNum}</div>`;

    // Add Events
    if (events.length > 0) {
        html += `<div class="events-list" style="display:flex; flex-direction:column; gap:2px; margin-top:4px; overflow:hidden;">`;
        events.forEach(ev => {
            const time = new Date(ev.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
            const statusClass = `event-${ev.status}`;
            const title = ev.booking_items?.name || 'Evento';

            html += `
                <div class="agenda-event ${statusClass}" title="${time} - ${title}">
                    <span style="font-size:0.7em; opacity:0.8;">${time}</span>
                    <span>${title}</span>
                </div>
            `;
        });
        html += `</div>`;
    }

    div.innerHTML = html;

    // interaction
    if (!isOtherMonth) {
        div.onclick = () => {
            // Handle day click (maybe open a modal for that day?)
            console.log("Clicked day", dayNum);
        };
    }

    return div;
}

function changeMonth(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    // Maybe refetch logic if we want to support range-based fetching
    // For now we fetched everything (optimization: fetch by range)
    // Let's refetch to be safe if range changes significantly? 
    // Actually fetching ALL user bookings is risky if many. 
    // Ideally we fetch by range. I'll stick to simple logic for MVP.
    // Re-rendering is fast.
    renderCalendarGrid();
}

async function updateCalendar() {
    await fetchMyBookings(); // Refresh data
    renderCalendarGrid();
}

function formatMonth(date) {
    return date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}
