export function renderHubGantt(container, items, spaceId) {
    if (!container) return;
    console.log('Gleeye Gantt v3000 (Width Shield Active) Initializing...');

    // 1. Data Processing
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const processedData = items
        .filter(item => item.start_date || item.due_date)
        .map(item => {
            let s, e;
            if (item.start_date && item.due_date) {
                s = new Date(item.start_date);
                e = new Date(item.due_date);
            } else {
                const base = new Date(item.start_date || item.due_date);
                s = new Date(base);
                e = new Date(base);
            }
            s.setHours(0, 0, 0, 0);
            e.setHours(23, 59, 59, 999);
            return { ...item, _s: s, _e: e };
        });

    if (processedData.length === 0) {
        container.innerHTML = `<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-tertiary);padding:2rem;">
            <p>Nessun elemento con date nel grafico.</p>
        </div>`;
        return;
    }

    // 2. Timeline config
    const allTs = [now.getTime()];
    processedData.forEach(i => allTs.push(i._s.getTime(), i._e.getTime()));
    const minDateTs = Math.min(...allTs) - 86400000 * 5;
    const maxDateTs = Math.max(...allTs) + 86400000 * 15;
    const minDate = new Date(minDateTs);
    const totalDays = Math.ceil((maxDateTs - minDateTs) / 86400000);

    const dayWidth = 46;
    const timelineWidth = totalDays * dayWidth;
    const rowHeight = 44;
    const headerHeight = 60;

    // 3. Layout - ULTIMATE SHIELD against overflow
    // The container MUST have min-width: 0 to avoid pushing its flex parents
    container.style.height = '100%';
    container.style.width = '100%';
    container.style.minWidth = '0';
    container.style.overflow = 'hidden';
    container.style.position = 'relative';

    container.innerHTML = `
        <div id="gantt-master-scroller-v3" style="width: 100%; height: 100%; overflow: auto; background: white; border-radius: 8px; position: relative;">
            <div style="width: ${timelineWidth}px; position: relative; min-height: 100%;">
                
                <!-- STICKY HEADER - Solid Background -->
                <div style="position: sticky; top: 0; left: 0; height: ${headerHeight}px; width: 100%; z-index: 1000; background: white; border-bottom: 2px solid var(--surface-2); display: flex; align-items: flex-end;">
                    ${renderHeaderV3000(minDate, totalDays, dayWidth)}
                </div>

                <!-- BODY AREA -->
                <div style="position: relative; width: 100%;">
                    
                    <!-- GRID -->
                    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;">
                        ${renderGridV3000(totalDays, dayWidth, processedData.length, rowHeight, minDate)}
                    </div>
                    
                    <!-- BARS -->
                    <div style="position: relative; z-index: 10;">
                        ${processedData.map((item, idx) => renderBarV3000(item, idx, minDate, dayWidth, rowHeight)).join('')}
                        <div style="height: 150px;"></div>
                    </div>
                </div>
            </div>
        </div>
        
        <style>
            .gb-bar { position: absolute; height: 26px; border-radius: 6px; display: flex; align-items: center; padding: 0 10px; font-size: 11px; font-weight: 500; color: white; cursor: pointer; border: 1px solid rgba(0,0,0,0.02); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: transform 0.1s; }
            .gb-bar:hover { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 500!important; }
            .gb-bar.is-act { background: #f59e0b!important; border-color: #d97706; height: 18px; font-weight: 600; }
            
            #gantt-master-scroller-v3::-webkit-scrollbar { width: 8px; height: 8px; }
            #gantt-master-scroller-v3::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; border: 2px solid white; }
            #gantt-master-scroller-v3::-webkit-scrollbar-track { background: transparent; }
        </style>
    `;

    // 4. Listeners
    container.querySelectorAll('.gb-bar').forEach(el => {
        el.onclick = e => {
            e.stopPropagation();
            import('./hub_drawer.js?v=1000').then(m => m.openHubDrawer(el.dataset.id, spaceId));
        };
    });

    // 5. Center on TODAY
    setTimeout(() => {
        const scroller = container.querySelector('#gantt-master-scroller-v3');
        const t = new Date(); t.setHours(0, 0, 0, 0);
        const l = ((t - minDate) / 86400000) * dayWidth;
        scroller.scrollLeft = l - (scroller.clientWidth / 2);
    }, 50);
}

function renderHeaderV3000(minDate, totalDays, dayWidth) {
    const months = [];
    const daysHtml = [];
    let cur = new Date(minDate);
    for (let i = 0; i < totalDays; i++) {
        const d = cur.getDate();
        if (d === 1 || i === 0) months.push({ label: cur.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }).toUpperCase(), left: i * dayWidth });
        const isW = cur.getDay() === 0 || cur.getDay() === 6;
        daysHtml.push(`
            <div style="width:${dayWidth}px; border-right:1px solid rgba(0,0,0,0.04); display:flex; flex-direction:column; align-items:center; justify-content:center; height:34px; ${isW ? 'background:rgba(0,0,0,0.01);' : ''}">
                <span style="font-size:0.45rem; color:var(--text-tertiary); text-transform:uppercase;">${cur.toLocaleDateString('it-IT', { weekday: 'short' }).charAt(0)}</span>
                <span style="font-size:0.75rem; font-weight:400; color:${isW ? 'var(--text-tertiary)' : 'var(--text-secondary)'}">${d}</span>
            </div>
        `);
        cur.setDate(cur.getDate() + 1);
    }
    const monthsHtml = months.map(m => `<div style="position:absolute; left:${m.left}px; top:4px; height:24px; display:flex; align-items:center; padding:0 12px; font-size:0.65rem; font-weight:700; color:var(--brand-blue); text-transform:uppercase; z-index:100; background:white; white-space:nowrap;">${m.label}</div>`).join('');
    return `
        <div style="width:100%; height:100%; display:flex; align-items:flex-end; position:relative;">
            ${monthsHtml}
            ${daysHtml.join('')}
        </div>
    `;
}

function renderGridV3000(totalDays, dayWidth, rowCount, rowHeight, minDate) {
    let h = '';
    for (let i = 0; i < totalDays; i++) {
        h += `<div style="position:absolute; left:${i * dayWidth}px; width:1px; height:100%; border-left:1px solid rgba(0,0,0,0.02);"></div>`;
    }
    for (let i = 0; i <= rowCount; i++) {
        h += `<div style="position:absolute; top:${i * rowHeight}px; left:0; width:100%; height:1px; border-top:1px solid rgba(0,0,0,0.02);"></div>`;
    }
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const l = ((t - minDate) / 86400000) * dayWidth;
    h += `<div style="position:absolute; left:${l}px; width:2px; height:100%; background:#ef4444; opacity:0.4; z-index:5;"><div style="width:6px; height:6px; background:#ef4444; border-radius:50%; position:absolute; top:-3px; left:-2px; border:1.5px solid white;"></div></div>`;
    return h;
}

function renderBarV3000(item, idx, minDate, dayWidth, rowHeight) {
    const l = ((item._s - minDate) / 86400000) * dayWidth;
    const span = Math.max(1, Math.round((item._e - item._s) / 86400000) + 1);
    const w = (span * dayWidth) - 10;
    const top = idx * rowHeight + (rowHeight - 26) / 2;
    const isAct = item.item_type === 'attivita';
    const bg = isAct ? '#f59e0b' : ({ 'todo': '#94a3b8', 'in_progress': '#3b82f6', 'blocked': '#ef4444', 'review': '#f59e0b', 'done': '#10b981' }[item.status] || '#94a3b8');
    const pref = (item._depth || 0) > 0 ? '↳ ' : '';

    return `<div class="gb-bar ${isAct ? 'is-act' : ''}" data-id="${item.id}" style="left:${l}px; width:${w}px; top:${top}px; background:${bg}; z-index:${idx + 5};">
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${pref}${item.title}</span>
    </div>`;
}
