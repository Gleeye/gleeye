import { fetchPMActivityLogs } from '../../../modules/pm_api.js?v=1004';

/**
 * Render the Activity Log with the EXACT style of the Reference image
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
        <div class="activity-log-wrapper" style="padding: 1.5rem; height: 100%; display: flex; flex-direction: column; background: var(--bg-color);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem;">
                <h3 style="margin: 0; font-size: 1.25rem; color: var(--text-primary); font-family: var(--font-titles); font-weight: 700;">Log Attività</h3>
                <button class="refresh-log-btn icon-btn" title="Aggiorna">
                    <span class="material-icons-round" style="font-size: 1.25rem;">refresh</span>
                </button>
            </div>
            
            <div class="activity-log-list" style="flex: 1; overflow-y: auto; padding-right: 1rem; position: relative;">
                <div class="loader-container" style="text-align: center; padding: 3rem;"><div class="loader"></div></div>
            </div>
        </div>
        <style>
            .activity-log-list::-webkit-scrollbar { width: 4px; }
            .activity-log-list::-webkit-scrollbar-track { background: transparent; }
            .activity-log-list::-webkit-scrollbar-thumb { background: var(--glass-border); border-radius: 10px; }
            
            .day-group-title {
                font-family: var(--font-titles);
                font-size: 1.1rem;
                font-weight: 700;
                color: var(--text-primary);
                margin: 2rem 0 1.5rem 0;
            }

            .timeline-item {
                position: relative;
                padding-bottom: 2rem;
                display: flex;
                gap: 1.25rem;
            }

            .timeline-item:last-child {
                padding-bottom: 1rem;
            }

            /* Vertical dashed line */
            .timeline-item::before {
                content: '';
                position: absolute;
                left: 17px; /* center of avatar */
                top: 40px;
                bottom: 0;
                width: 1px;
                border-left: 1px dashed var(--text-tertiary);
                opacity: 0.3;
                z-index: 0;
            }
            .timeline-item:last-child::before {
                display: none;
            }

            .timeline-avatar {
                position: relative;
                z-index: 1;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                overflow: hidden;
                background: var(--glass-bg);
                flex-shrink: 0;
                box-shadow: 0 0 0 4px var(--bg-color);
            }

            .timeline-content {
                flex: 1;
                padding-top: 4px;
                min-width: 0;
            }

            .timeline-text {
                font-size: 0.95rem;
                color: var(--text-secondary);
                line-height: 1.4;
                margin-bottom: 0.25rem;
                word-wrap: break-word;
            }

            .timeline-text strong {
                color: var(--text-primary);
                font-weight: 700;
            }

            .timeline-time {
                font-size: 0.8rem;
                color: var(--text-tertiary);
                font-weight: 500;
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
                else label = date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });

                if (!groups[label]) groups[label] = [];
                groups[label].push(log);
            });

            let html = '';
            for (const [day, dayLogs] of Object.entries(groups)) {
                html += `<div class="day-group-title">${day}</div>`;
                dayLogs.forEach(log => {
                    html += renderTimelineItem(log);
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

/**
 * Renders a single timeline item matching the Reference image:
 * Actor (Bold) + Action (Regular) + Entity (Bold)
 */
function renderTimelineItem(log) {
    const time = new Date(log.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }).toUpperCase();

    let description = log.details?.description || log.details;
    const actionType = log.action_type || '';

    // Humanize technical fallbacks or old patterns
    const entityName = log.details?.entity_name
        || log.item?.title
        || log.order?.title
        || log.space?.name
        || 'una risorsa';

    const entityBold = `**${entityName}**`;

    if (!description || typeof description === 'object' ||
        description === 'status_changed' || description === 'UPDATE' ||
        description.includes('Stato spostato in') || description.includes('cambiato lo stato')) {

        if (actionType.includes('status')) description = `ha cambiato lo stato di ${entityBold}`;
        else if (actionType.includes('create')) description = `ha creato ${entityBold}`;
        else if (actionType.includes('comment')) description = `ha aggiunto un commento in ${entityBold}`;
        else description = `ha aggiornato i dettagli di ${entityBold}`;
    }

    // Vocabulary replacement for old strings
    const vocabulary = {
        'todo': 'Da Fare',
        'in_progress': 'In Corso',
        'review': 'In Revisione',
        'done': 'Completata',
        'blocked': 'Bloccata',
        'in_svolgimento': 'In Lavorazione',
        'lavoro_in_attesa': 'In Sospeso',
        'accettata': 'Accettata',
        'rifiutata': 'Rifiutata',
        'high': 'Alta',
        'medium': 'Media',
        'low': 'Bassa'
    };

    Object.entries(vocabulary).forEach(([key, value]) => {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        description = description.replace(regex, value);
    });

    const authorName = log.actor?.full_name || 'Sistema';
    const avatarUrl = log.actor?.avatar_url || '';

    // Ensure description words are formatted correctly (markdown to bold)
    const formattedDesc = description.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    return `
        <div class="timeline-item">
            <div class="timeline-avatar">
                <img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random&color=fff&size=64';">
            </div>
            <div class="timeline-content">
                <div class="timeline-text">
                    <strong>${authorName}</strong> ${formattedDesc}
                </div>
                <div class="timeline-time">${time}</div>
            </div>
        </div>
    `;
}
