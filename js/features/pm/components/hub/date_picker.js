// Hub drawer — date picker popover + calendar renderer.
// Extracted from hub_drawer.js step 2.
//
// Public exports:
//   - toggleHubDatePicker(btn, onSelect, initialDate?)
//     opens an absolute-positioned date picker anchored to `btn`, calls
//     `onSelect(isoString)` when a date is picked.
//   - renderHubCalendar(container, selectedDateStr?)
//     renders the calendar grid for the current month into `container`.
//
// Module state (internal):
//   - hubPickerCurrentDate: Date currently shown in the calendar header.
//   - onHubDateSelect: latest callback set by toggleHubDatePicker.

// --- CALENDAR PICKER HELPERS ---
let hubPickerCurrentDate = new Date();
let onHubDateSelect = null;

export function toggleHubDatePicker(btn, onSelect, initialDate) {
    const existing = document.getElementById('hub-datepicker-popover');
    if (existing) {
        existing.remove();
        return;
    }

    onHubDateSelect = onSelect;
    hubPickerCurrentDate = initialDate ? new Date(initialDate) : new Date();

    const rect = btn.getBoundingClientRect();
    const popoverWidth = 300;
    let left = rect.left;
    if (left + popoverWidth > window.innerWidth) {
        left = window.innerWidth - popoverWidth - 10;
    }
    if (left < 10) left = 10;

    const popover = document.createElement('div');
    popover.id = 'hub-datepicker-popover';
    popover.style.cssText = `
        position: fixed; 
        top: ${rect.bottom + 12}px; 
        left: ${left}px; 
        background: var(--card-bg); 
        border: 1px solid #e2e8f0; 
        border-radius: 16px; 
        padding: 20px; 
        box-shadow: 0 15px 50px rgba(0,0,0,0.18); 
        z-index: 999999; 
        width: ${popoverWidth}px;
        animation: hub-pop-in 0.2s ease-out;
    `;

    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes hub-pop-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .hub-cal-day { 
            width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; 
            font-size: 0.85rem; font-weight: 500; border-radius: 50%; cursor: pointer; transition: all 0.2s;
            color: var(--text-primary);
        }
        .hub-cal-day:hover { background: #f8fafc; color: var(--brand-blue); }
        .hub-cal-day.today { color: var(--brand-blue); font-weight: 800; border: 1px solid var(--brand-blue-light); }
        .hub-cal-day.selected { background: var(--brand-blue) !important; color: white !important; font-weight: 700; }
        .hub-cal-day.other-month { opacity: 0.3; pointer-events: none; }
        .hub-cal-day-name { font-size: 0.65rem; font-weight: 800; color: var(--text-tertiary); text-align: center; text-transform: uppercase; padding-bottom: 8px; }
    `;
    document.head.appendChild(style);

    renderHubCalendar(popover, initialDate);
    document.body.appendChild(popover);

    const closeHandler = (e) => {
        if (!popover.contains(e.target) && !btn.contains(e.target)) {
            popover.remove();
            document.removeEventListener('mousedown', closeHandler);
        }
    };
    document.addEventListener('mousedown', closeHandler);
}

export function renderHubCalendar(container, selectedDateStr) {
    const y = hubPickerCurrentDate.getFullYear();
    const m = hubPickerCurrentDate.getMonth();
    const names = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    let startIdx = firstDay.getDay() - 1;
    if (startIdx < 0) startIdx = 6; // Monday start

    const prevMonthLastDay = new Date(y, m, 0).getDate();
    let daysHtml = '';

    // Prev Month
    for (let i = 0; i < startIdx; i++) {
        daysHtml += `<div class="hub-cal-day other-month">${prevMonthLastDay - startIdx + i + 1}</div>`;
    }

    // Current Month
    const today = new Date().toISOString().split('T')[0];
    const selected = selectedDateStr ? selectedDateStr.split('T')[0] : null;

    for (let d = 1; d <= lastDay.getDate(); d++) {
        const cur = new Date(y, m, d).toISOString().split('T')[0];
        let cls = 'hub-cal-day';
        if (cur === today) cls += ' today';
        if (cur === selected) cls += ' selected';
        daysHtml += `<div class="${cls}" data-day="${d}">${d}</div>`;
    }

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-primary);">${names[m]} ${y}</div>
            <div style="display: flex; gap: 4px;">
                <button id="hub-prev-month" style="background: none; border: none; cursor: pointer; padding: 4px; color: var(--text-secondary);"><span class="material-icons-round">chevron_left</span></button>
                <button id="hub-next-month" style="background: none; border: none; cursor: pointer; padding: 4px; color: var(--text-secondary);"><span class="material-icons-round">chevron_right</span></button>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">
            <div class="hub-cal-day-name">L</div><div class="hub-cal-day-name">M</div><div class="hub-cal-day-name">M</div>
            <div class="hub-cal-day-name">G</div><div class="hub-cal-day-name">V</div><div class="hub-cal-day-name">S</div><div class="hub-cal-day-name">D</div>
            ${daysHtml}
        </div>
    `;

    container.querySelector('#hub-prev-month').onclick = (e) => { e.stopPropagation(); hubPickerCurrentDate.setMonth(m - 1); renderHubCalendar(container, selectedDateStr); };
    container.querySelector('#hub-next-month').onclick = (e) => { e.stopPropagation(); hubPickerCurrentDate.setMonth(m + 1); renderHubCalendar(container, selectedDateStr); };
    container.querySelectorAll('.hub-cal-day:not(.other-month)').forEach(el => {
        el.onclick = () => {
            const d = new Date(y, m, parseInt(el.dataset.day));
            // Set time to noon to avoid timezone shift issues when converting to ISO date string
            d.setHours(12, 0, 0, 0);
            onHubDateSelect(d.toISOString());
            container.remove();
        };
    });
}
