import { supabase } from '../modules/config.js?v=117';
import { state } from '../modules/state.js?v=117';

let currentDate = new Date(); // Represents the start of the week or current view date
let eventsCache = [];
let currentView = 'week'; // 'week', 'day'

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
            <!-- Header / Toolbar -->
            <div class="agenda-toolbar">
                <div class="calendar-nav">
                    <div class="nav-controls">
                        <button class="icon-nav-btn" id="prev-period">
                            <span class="material-icons-round">chevron_left</span>
                        </button>
                        <button class="icon-nav-btn" id="next-period">
                            <span class="material-icons-round">chevron_right</span>
                        </button>
                    </div>
                    <h2 class="current-period-label" id="period-label">
                        <!-- Date Range -->
                    </h2>
                    <button class="today-btn" id="today-btn">Oggi</button>
                </div>
                
                <div class="actions">
                     <div class="view-toggles">
                        <button class="view-btn active" data-view="week">Settimana</button>
                        <button class="view-btn" data-view="day">Giorno</button>
                    </div>
                    <button class="primary-btn" onclick="window.location.hash = 'new-appointment'">
                        <span class="material-icons-round">add</span>
                        Nuovo
                    </button>
                </div>
            </div>

            <!-- Timeline View -->
            <div class="timeline-wrapper">
                <div class="timeline-header" id="timeline-header">
                    <div class="time-col-header"></div> <!-- Corner -->
                    <!-- Header Columns (Days) -->
                </div>
                <div class="timeline-body">
                    <div class="time-gutter">
                        <!-- Time labels (08:00, 09:00...) -->
                    </div>
                    <div class="events-grid" id="events-grid">
                        <!-- Grid Lines & Events -->
                    </div>
                </div>
            </div>
        </div>
    `;

    // Bind Controls
    document.getElementById('prev-period').onclick = () => changePeriod(-1);
    document.getElementById('next-period').onclick = () => changePeriod(1);
    document.getElementById('today-btn').onclick = () => {
        currentDate = new Date();
        updateView();
    };

    // View Toggles
    const viewBtns = container.querySelectorAll('.view-btn');
    viewBtns.forEach(btn => {
        btn.onclick = () => {
            viewBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;
            updateView();
        }
    });

    console.log("[Agenda] Initializing...");
    await fetchMyBookings();
    renderTimeline();
}

async function fetchMyBookings() {
    try {
        const authUserId = state.profile?.id;
        const impersonatedCollabId = state.impersonatedCollaboratorId;

        console.log("[Agenda] Auth User ID:", authUserId);
        console.log("[Agenda] Impersonated Collab ID:", impersonatedCollabId);

        let collaboratorId = impersonatedCollabId;

        // If not impersonating, find the collaborator record for this auth user
        if (!collaboratorId && authUserId) {
            const { data: collabRecord, error: collabError } = await supabase
                .from('collaborators')
                .select('id')
                .eq('user_id', authUserId)
                .single();

            if (collabError) {
                console.warn("[Agenda] No collaborator record found for user:", authUserId, collabError);
                eventsCache = [];
                return;
            }

            collaboratorId = collabRecord?.id;
            console.log("[Agenda] Found collaborator ID:", collaboratorId);
        }

        if (!collaboratorId) {
            console.warn("[Agenda] No collaborator ID available");
            eventsCache = [];
            return;
        }

        // Fetch bookings where this collaborator is assigned
        let query = supabase
            .from('bookings')
            .select(`
                *,
                booking_items ( name, color, duration_minutes ),
                booking_assignments!inner ( collaborator_id )
            `)
            .eq('booking_assignments.collaborator_id', collaboratorId)
            .order('start_time', { ascending: true });

        const { data, error } = await query;
        if (error) {
            console.error("[Agenda] Supabase Error:", error);
            throw error;
        }

        eventsCache = data || [];
        console.log("[Agenda] Successfully fetched events count:", eventsCache.length);
        console.log("[Agenda] Events data:", eventsCache);

    } catch (err) {
        console.error("[Agenda] Critical fetch error:", err);
    }
}

function renderTimeline() {
    const header = document.getElementById('timeline-header');
    const grid = document.getElementById('events-grid');
    const label = document.getElementById('period-label');
    const gutter = document.querySelector('.time-gutter');

    if (!header || !grid) return;

    // 1. Determine Date Range
    let startOfPeriod, endOfPeriod;
    const today = new Date();

    if (currentView === 'week') {
        const day = currentDate.getDay();
        const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
        startOfPeriod = new Date(currentDate);
        startOfPeriod.setDate(diff);
        endOfPeriod = new Date(startOfPeriod);
        endOfPeriod.setDate(startOfPeriod.getDate() + 6);

        label.textContent = `${formatDate(startOfPeriod)} - ${formatDate(endOfPeriod)}`;
    } else {
        startOfPeriod = new Date(currentDate);
        endOfPeriod = new Date(currentDate);
        label.textContent = formatDate(startOfPeriod, true);
    }

    // 2. Render Headers
    let headerHtml = `<div class="time-col-header"></div>`;
    const days = [];
    let loopDate = new Date(startOfPeriod);

    while (loopDate <= endOfPeriod) {
        days.push(new Date(loopDate));
        const isToday = loopDate.toDateString() === today.toDateString();

        headerHtml += `
            <div class="day-header ${isToday ? 'today' : ''}">
                <div class="day-name">${loopDate.toLocaleDateString('it-IT', { weekday: 'short' })}</div>
                <div class="day-num">${loopDate.getDate()}</div>
            </div>
        `;
        loopDate.setDate(loopDate.getDate() + 1);
    }
    header.innerHTML = headerHtml;

    // 3. Render Time Grid Content
    const startHour = 8;
    const endHour = 20;
    const totalHours = endHour - startHour;

    // Gutter Labels
    let gutterHtml = '';
    for (let h = startHour; h <= endHour; h++) {
        gutterHtml += `<div class="time-label"><span>${h}:00</span></div>`;
    }
    gutter.innerHTML = gutterHtml;


    let gridHtml = '';

    days.forEach((dayDate, index) => {
        const dateStr = dayDate.toISOString().split('T')[0];
        // Filter events for this day
        const dayEvents = eventsCache.filter(e => e.start_time.startsWith(dateStr));

        let eventsHtml = '';
        dayEvents.forEach(ev => {
            const start = new Date(ev.start_time);
            const end = new Date(ev.end_time);

            // Calc Top & Height
            const startH = start.getHours() + start.getMinutes() / 60;
            let endH = end.getHours() + end.getMinutes() / 60;
            // Fix for events ending at the exact hour if not accounted for
            if (endH === 0 && end.getDate() !== start.getDate()) endH = 24;

            if (startH < startHour) return;

            const topPercent = ((startH - startHour) / totalHours) * 100;
            const heightPercent = ((endH - startH) / totalHours) * 100;

            const statusColor = getStatusColor(ev.status);

            eventsHtml += `
                <div class="timeline-event" style="top: ${topPercent}%; height: ${heightPercent}%; background: ${statusColor};" 
                     title="${ev.booking_items?.name}">
                    <div class="event-time">${start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
                    <div class="event-title">${ev.booking_items?.name}</div>
                </div>
            `;
        });

        // Current Time Indicator (if Today)
        let indicatorHtml = '';
        if (dayDate.toDateString() === today.toDateString()) {
            const now = new Date();
            const nowH = now.getHours() + now.getMinutes() / 60;
            if (nowH >= startHour && nowH <= endHour) {
                const topP = ((nowH - startHour) / totalHours) * 100;
                indicatorHtml = `<div class="current-time-line" style="top: ${topP}%"></div>`;
            }
        }

        gridHtml += `
            <div class="day-column" data-date="${dateStr}">
                <div class="grid-lines">
                    ${Array(totalHours).fill(0).map(() => `<div class="hour-cell"></div>`).join('')}
                </div>
                ${eventsHtml}
                ${indicatorHtml}
            </div>
        `;
    });

    grid.innerHTML = gridHtml;

    // Set column grid template based on day count
    const cols = currentView === 'week' ? 7 : 1;
    header.style.gridTemplateColumns = `50px repeat(${cols}, 1fr)`;
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
}

function getStatusColor(status) {
    if (status === 'confirmed') return 'var(--brand-blue)';
    if (status === 'hold') return '#f59e0b';
    if (status === 'cancelled') return '#ef4444';
    return '#6b7280';
}

function changePeriod(delta) {
    if (currentView === 'week') {
        currentDate.setDate(currentDate.getDate() + (delta * 7));
    } else {
        currentDate.setDate(currentDate.getDate() + delta);
    }
    updateView();
}

function updateView() {
    renderTimeline();
}

function formatDate(date, full = false) {
    if (full) return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}
