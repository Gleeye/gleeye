import { fetchPMActivityLogs } from '../../../modules/pm_api.js?v=1003';

/**
 * Render the Activity Log with a minimal, elegant, and standard Gleeye design
 */
export async function renderActivityLog(container, options = {}) {
    if (!container) return;

    let spaceId = null, itemId = null, orderId = null, itemIds = null, clientId = null, isAccountLevel = null;

    if (typeof options === 'object' && options !== null) {
        spaceId = options.spaceId;
        itemId = options.itemId;
        orderId = options.orderId;
        itemIds = options.itemIds;
        clientId = options.clientId;
        isAccountLevel = options.isAccountLevel;
    } else {
        spaceId = options;
    }

    container.innerHTML = `
        <div class="activity-log-wrapper" style="padding: 1.5rem; height: 100%; display: flex; flex-direction: column; background: transparent;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 1rem;">
                <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.6rem; font-family: var(--font-titles);">
                    <span class="material-icons-round" style="color: var(--text-tertiary); font-size: 1.25rem;">history</span>
                    Log Attività
                </h3>
                <button class="refresh-log-btn icon-btn" title="Aggiorna">
                    <span class="material-icons-round" style="font-size: 1.25rem;">refresh</span>
                </button>
            </div>
            
            <div class="activity-log-list" style="flex: 1; overflow-y: auto; padding-right: 0.5rem; position: relative;">
                <div class="loader-container" style="text-align: center; padding: 3rem;"><div class="loader"></div></div>
            </div>
        </div>
        <style>
            .activity-log-list::-webkit-scrollbar { width: 4px; }
            .activity-log-list::-webkit-scrollbar-track { background: transparent; }
            .activity-log-list::-webkit-scrollbar-thumb { background: var(--glass-border); border-radius: 10px; }
            
            .day-divider {
                font-family: var(--font-titles);
                font-size: 0.75rem;
                font-weight: 700;
                color: var(--text-tertiary);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin: 2rem 0 1rem 0;
            }

            .log-row {
                display: flex;
                gap: 1rem;
                padding: 1rem 0;
                border-bottom: 1px solid var(--glass-highlight);
                transition: background 0.2s ease;
            }

            .log-row:last-child {
                border-bottom: none;
            }
        </style>
    `;

    const listContainer = container.querySelector('.activity-log-list');
    const refreshBtn = container.querySelector('.refresh-log-btn');

    const loadLogs = async () => {
        listContainer.innerHTML = '<div class="loader-container" style="text-align: center; padding: 3rem;"><div class="loader"></div></div>';

        try {
            const logs = await fetchPMActivityLogs(spaceId, itemId, orderId, itemIds, clientId, { isAccountLevel });

            if (!logs || logs.length === 0) {
                listContainer.innerHTML = `
                    <div style="text-align: center; padding: 4rem 1rem; color: var(--text-tertiary);">
                        <span class="material-icons-round" style="font-size: 2.5rem; opacity: 0.3; margin-bottom: 1rem;">history_edu</span>
                        <p style="margin: 0; font-size: 0.9rem;">Nessuna attività registrata</p>
                    </div>
                `;
                return;
            }

            const groups = {};
            const today = new Date().toLocaleDateString('it-IT');
            const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
            const yesterday = yesterdayDate.toLocaleDateString('it-IT');

            logs.forEach(log => {
                const date = new Date(log.created_at);
                const dStr = date.toLocaleDateString('it-IT');
                let label = dStr;
                if (dStr === today) label = 'Oggi';
                else if (dStr === yesterday) label = 'Ieri';
                else label = date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

                if (!groups[label]) groups[label] = [];
                groups[label].push(log);
            });

            let html = '';
            for (const [day, dayLogs] of Object.entries(groups)) {
                html += `<div class="day-divider">${day}</div>`;
                dayLogs.forEach(log => {
                    html += renderMinimalLog(log);
                });
            }

            listContainer.innerHTML = html;
        } catch (err) {
            console.error("Error loading activity logs:", err);
            listContainer.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--error-soft); font-size: 0.85rem;">Impossibile caricare i dati.</div>`;
        }
    };

    refreshBtn.addEventListener('click', loadLogs);
    loadLogs();
}

function renderMinimalLog(log) {
    const time = new Date(log.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    let description = log.details?.description || log.details || log.action_type;
    if (typeof description === 'object') {
        description = log.action_type === 'updated' ? 'Modifica dati' : log.action_type;
    }

    const authorName = log.actor?.full_name || 'Sistema';
    const avatarUrl = log.actor?.avatar_url || '';

    // Standard statuses override
    description = description
        .replace(/in_progress/g, 'In Corso')
        .replace(/todo/g, 'Da Fare')
        .replace(/done/g, 'Completato')
        .replace(/blocked/g, 'Bloccato')
        .replace(/review/g, 'In Revisione');

    // Remove "Ha " for consistency
    description = description.replace(/^Ha /, '');

    return `
        <div class="log-row">
            <div style="flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%; overflow: hidden; background: var(--glass-bg);">
                <img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random&color=fff&size=64';">
            </div>
            <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.2rem;">
                    <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">${authorName}</span>
                    <span style="font-size: 0.75rem; color: var(--text-tertiary);">${time}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4;">
                    ${description}
                </div>
            </div>
        </div>
    `;
}
