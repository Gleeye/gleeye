// Homepage timeline renderers (vertical day view + horizontal weekly view).
// Extracted from homepage-alt.js (Fase split-monstro step 4).
//
// Dead functions `renderMobileAgenda` and `renderTimeline` were removed at the
// same time (defined but never called from anywhere in the codebase). Their
// content is preserved in git history if ever needed again.
//
// Public exports:
//   - renderVerticalTimeline(container, events, date, rules)
//   - renderWeeklyTimeline(container, events, startDate, rules, googleBusy, overrides)
//
// External deps: only openAppointmentDrawer (for click-on-appointment).

import { openAppointmentDrawer } from '../pm/components/hub_appointment_drawer.js?v=8000';

export function renderVerticalTimeline(container, events, date, rules) {
    container.innerHTML = '';
    const pxPerHour = 80; // Standard for readability
    const totalHeight = 24 * pxPerHour;
    const pixelsPerMinute = pxPerHour / 60;
    const isToday = new Date().toDateString() === date.toDateString();

    const timelineContainer = document.createElement('div');
    timelineContainer.className = 'vertical-timeline-track';
    timelineContainer.style.position = 'relative';
    timelineContainer.style.height = `${totalHeight}px`;
    timelineContainer.style.background = '#ffffff';

    // 1. GRID LINES & LABELS (Y-AXIS)
    for (let h = 0; h < 24; h++) {
        // Grid Line
        const row = document.createElement('div');
        row.className = 'v-hour-row';
        row.style.position = 'absolute';
        row.style.top = `${h * pxPerHour}px`;
        row.style.left = '45px';
        row.style.right = '0';
        row.style.height = '1px';
        row.style.background = '#f1f5f9';
        
        // Hour Label
        const label = document.createElement('div');
        label.className = 'v-hour-label';
        label.innerText = `${h.toString().padStart(2, '0')}:00`;
        label.style.position = 'absolute';
        label.style.left = '8px';
        label.style.top = `${(h * pxPerHour) - 8}px`;
        label.style.fontSize = '0.7rem';
        label.style.color = '#94a3b8';
        label.style.fontWeight = '600';
        label.style.fontFamily = 'var(--font-titles)';
        
        timelineContainer.appendChild(row);
        timelineContainer.appendChild(label);
    }

    // Overlay for elements (Slots, Events)
    const overlay = document.createElement('div');
    overlay.className = 'v-timeline-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '45px';
    overlay.style.right = '0';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';

    // 2. RENDER AVAILABILITY SLOTS (Light background)
    const dayId = date.getDay();
    const dayRules = (rules || []).filter(r => r.day_of_week === dayId);
    dayRules.forEach(r => {
        if (!r.start_time || !r.end_time) return;
        const [sh, sm] = r.start_time.split(':').map(Number);
        const [eh, em] = r.end_time.split(':').map(Number);
        const sM = (sh * 60) + sm;
        const eM = (eh * 60) + em;

        const slot = document.createElement('div');
        slot.style.position = 'absolute';
        slot.style.top = `${sM * pixelsPerMinute}px`;
        slot.style.height = `${(eM - sM) * pixelsPerMinute}px`;
        slot.style.left = '0'; slot.style.right = '0';
        slot.style.background = '#fcfaff'; // Very subtle purple
        slot.style.zIndex = '0';
        overlay.appendChild(slot);
    });

    // 3. RENDER EVENTS (PACKING)
    const eventsSafe = events || [];
    const sortedEvents = eventsSafe.map(ev => ({
        ...ev,
        _start: (ev.start.getHours() * 60) + ev.start.getMinutes(),
        _end: (ev.end.getHours() * 60) + ev.end.getMinutes(),
        durationM: (ev.end - ev.start) / (1000 * 60)
    })).sort((a, b) => a._start - b._start);

    sortedEvents.forEach(ev => {
        const top = ev._start * pixelsPerMinute;
        const height = Math.max((ev._end - ev._start) * pixelsPerMinute, 30);

        const card = document.createElement('div');
        card.className = `v-agenda-card ${ev.type}`;
        card.style.position = 'absolute';
        card.style.top = `${top}px`;
        card.style.height = `${height}px`;
        card.style.left = '4px';
        card.style.right = '4px';
        card.style.pointerEvents = 'auto';
        card.style.zIndex = '10';
        
        card.innerHTML = `
            <div class="v-card-inner" style="display: flex; gap: 10px; align-items: flex-start; padding: 6px 10px;">
                <div style="flex-shrink: 0; margin-top: 1px;">
                    <div class="hp-status-toggle" 
                         onclick="event.stopPropagation(); window.quickCompleteTask('${ev.id}', this)" 
                         title="Segna come completata"
                         style="width: 16px; height: 16px; border: 2px solid #e2e8f0; border-radius: 5px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center;"
                         onmouseover="this.style.background='rgba(78, 146, 216, 0.05)'; this.style.borderColor='#4e92d8';"
                         onmouseout="this.style.background='transparent'; this.style.borderColor='#e2e8f0';"
                    >
                    </div>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div class="v-card-time" style="font-size: 0.62rem; color: #64748b; font-weight: 600; margin-bottom: 1px;">${ev.start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                    <div class="v-card-title" style="font-size: 0.8rem; font-weight: 700; color: #1e293b; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${ev.title}</div>
                </div>
            </div>
        `;
        card.onclick = () => {
            if (ev.type === 'appointment') openAppointmentDrawer(ev.id);
        };
        overlay.appendChild(card);
    });

    // 4. NOW LINE
    if (isToday) {
        const now = new Date();
        const nowM = (now.getHours() * 60) + now.getMinutes();
        const top = nowM * pixelsPerMinute;

        const nowLine = document.createElement('div');
        nowLine.className = 'v-now-line';
        nowLine.style.position = 'absolute';
        nowLine.style.top = `${top}px`;
        nowLine.style.left = ' -45px'; // Cover labels area too
        nowLine.style.right = '0';
        nowLine.style.height = '0';
        nowLine.style.borderTop = '2px dashed #06b6d4';
        nowLine.style.zIndex = '100';

        const timePill = document.createElement('div');
        timePill.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        timePill.className = 'v-now-pill';
        nowLine.appendChild(timePill);
        overlay.appendChild(nowLine);
    }

    timelineContainer.appendChild(overlay);
    container.appendChild(timelineContainer);
}

export function renderWeeklyTimeline(container, events, startDate, rules, googleBusy, overrides) {
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

        // 2. RENDER EVENTS - COLUMN PACKING (Google Calendar Style)

        // Define day range for filtering
        const dayStart = new Date(currentD); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentD); dayEnd.setHours(23, 59, 59, 999);

        // Group overlapping events
        const sortedEvents = (events || [])
            .filter(ev => {
                const evStart = new Date(ev.start);
                const evEnd = new Date(ev.end);
                return (evStart < dayEnd && evEnd > dayStart);
            })
            .map(ev => ({
                ...ev,
                _start: new Date(ev.start).getTime(),
                _end: new Date(ev.end).getTime()
            }))
            .sort((a, b) => {
                if (a._start !== b._start) return a._start - b._start;
                return b._end - a._end; // Longer first
            });

        const clusters = [];
        let currentCluster = [];
        let clusterEnd = 0;

        sortedEvents.forEach(ev => {
            if (currentCluster.length === 0) {
                currentCluster.push(ev);
                clusterEnd = ev._end;
            } else {
                if (ev._start < clusterEnd) {
                    currentCluster.push(ev);
                    clusterEnd = Math.max(clusterEnd, ev._end);
                } else {
                    clusters.push(currentCluster);
                    currentCluster = [ev];
                    clusterEnd = ev._end;
                }
            }
        });
        if (currentCluster.length > 0) clusters.push(currentCluster);

        // Process clusters
        clusters.forEach(cluster => {
            const columns = [];
            cluster.forEach(ev => {
                let placed = false;
                for (let i = 0; i < columns.length; i++) {
                    const col = columns[i];
                    const last = col[col.length - 1];
                    if (ev._start >= last._end) {
                        col.push(ev);
                        placed = true;
                        break;
                    }
                }
                if (!placed) columns.push([ev]);
            });

            const widthPercent = 100 / columns.length;

            columns.forEach((col, colIndex) => {
                col.forEach(ev => {
                    const evStart = new Date(ev.start);
                    const evEnd = new Date(ev.end);

                    // Calculate Top & Height
                    let startMins = evStart.getHours() * 60 + evStart.getMinutes();
                    let endMins = evEnd.getHours() * 60 + evEnd.getMinutes();

                    if (evStart < dayStart) startMins = 0;
                    if (evEnd > dayEnd) endMins = 1440;

                    const top = (startMins / 60) * pxPerHour;
                    const height = Math.max(((endMins - startMins) / 60) * pxPerHour, 20);

                    // Render Card
                    const el = document.createElement('div');
                    el.className = 'timeline-event-card';

                    let bgColor = '#60a5fa';
                    let glowColor = '#3b82f6';

                    if (ev.type === 'appointment') {
                        bgColor = '#c084fc';
                        glowColor = '#a855f7';
                    } else if (ev.type === 'booking') {
                        bgColor = '#60a5fa';
                        glowColor = '#3b82f6';
                    } else if (ev.title && ev.title.toLowerCase().includes('google')) {
                        bgColor = '#fcd34d';
                        glowColor = '#f59e0b';
                    }

                    el.style.cssText = `
                         position: absolute;
                         top: ${top}px;
                         left: calc(${colIndex * widthPercent}% + 2px); 
                         width: calc(${widthPercent}% - 4px);
                         height: ${height}px;
                         background: linear-gradient(135deg, ${bgColor} 0%, ${glowColor} 100%);
                         border-radius: 8px;
                         padding: 4px 6px;
                         color: white;
                         font-size: 0.75rem;
                         overflow: hidden;
                         box-shadow: 0 2px 8px ${glowColor}40;
                         cursor: pointer;
                         z-index: 5;
                         transition: transform 0.2s, z-index 0s;
                         display: flex; flex-direction: column; justify-content: start;
                     `;

                    el.innerHTML = `
                         <div style="font-weight:700; line-height:1.1; margin-bottom:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.75rem;">${ev.title}</div>
                         ${widthPercent > 30 ? `<div style="opacity:0.9; font-size:0.65rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ev.client || ''}</div>` : ''}
                     `;

                    // Hover Logic for Expanding Z-Index
                    el.onmouseenter = function () {
                        this.style.zIndex = '50';
                        this.style.minWidth = '140px'; // Expand if too small? Na, just tooltip
                        // If width is tiny, maybe expand? no just tooltip is safer.

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
                        this.style.minWidth = '';
                        const t = document.getElementById('timeline-custom-tooltip');
                        if (t) t.remove();
                    };

                    const evtId = `evt_hp_w_${ev.id.replace(/-/g, '_')}`;
                    window[evtId] = ev;
                    el.setAttribute('onclick', `openHomepageEventDetails(window['${evtId}'])`);

                    dayCol.appendChild(el);
                });
            });
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
