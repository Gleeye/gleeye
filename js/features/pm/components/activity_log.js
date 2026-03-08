import { fetchPMActivityLogs } from '../../../modules/pm_api.js?v=1004';
import { supabase } from '../../../modules/config.js';

// Map to track active subscriptions and prevent leaks
const activitySubscriptions = new Map();

/**
 * Render the Activity Log with the EXACT style of the Reference image
 */
export async function renderActivityLog(container, options = {}) {
    if (!container) return;

    // Cleanup previous subscription for this same container element
    if (activitySubscriptions.has(container)) {
        supabase.removeChannel(activitySubscriptions.get(container));
        activitySubscriptions.delete(container);
    }

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
        <div class="activity-log-wrapper" style="padding: 0 1.5rem 1.5rem 1.5rem; height: 100%; display: flex; flex-direction: column; background: var(--bg-color);">
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
                font-size: 0.85rem;
                font-weight: 700;
                color: var(--text-primary);
                margin: 1rem 0 0.6rem 0;
                text-transform: uppercase;
                letter-spacing: 0.03em;
            }
            .activity-log-list .day-group-title:first-child {
                margin-top: 0.5rem;
            }

            .timeline-item {
                position: relative;
                padding-bottom: 1.25rem;
                display: flex;
                gap: 0.85rem;
            }

            .timeline-item:last-child {
                padding-bottom: 0.75rem;
            }

            /* Vertical dashed line */
            .timeline-item::before {
                content: '';
                position: absolute;
                left: 15px; /* center of avatar */
                top: 34px;
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
                width: 30px;
                height: 30px;
                border-radius: 50%;
                overflow: hidden;
                background: var(--glass-bg);
                flex-shrink: 0;
                box-shadow: 0 0 0 4px var(--bg-color);
            }

            .timeline-content {
                flex: 1;
                padding-top: 2px;
                min-width: 0;
            }

            .timeline-text {
                font-size: 0.8rem;
                color: var(--text-secondary);
                line-height: 1.4;
                margin-bottom: 0.15rem;
                word-wrap: break-word;
            }

            .timeline-text strong {
                color: var(--text-primary);
                font-weight: 600;
            }

            .timeline-time {
                font-size: 0.72rem;
                color: var(--text-tertiary);
                font-weight: 500;
            }
        </style>
    `;

    const listContainer = container.querySelector('.activity-log-list');

    const loadLogs = async (silent = false) => {
        if (!silent) listContainer.innerHTML = '<div class="loader-container" style="text-align: center; padding: 3rem;"><div class="loader"></div></div>';

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
                let lastActor = null;
                let lastDesc = null;
                let lastTime = null;

                dayLogs.forEach(log => {
                    const actor = log.actor?.full_name || 'Sistema';
                    const desc = log.details?.description || (typeof log.details === 'string' ? log.details : '');
                    const time = new Date(log.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

                    // SKIP IF DUPLICATE (same actor, desc, and time)
                    // But ALWAYS show cloud_links resources as they might have different resNames even if DB desc is identical
                    if (log.action_type !== 'pm_items_cloud_links_updated' && actor === lastActor && desc === lastDesc && time === lastTime) {
                        return;
                    }

                    html += renderTimelineItem(log, { itemId });

                    lastActor = actor;
                    lastDesc = desc;
                    lastTime = time;
                });
            }

            listContainer.innerHTML = html;
        } catch (err) {
            console.error("Error loading activity logs:", err);
            if (!silent) listContainer.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--error-soft); font-size: 0.85rem;">Impossibile caricare i dati.</div>`;
        }
    };

    // Realtime subscription
    const channelId = `activity-log-${Math.random().toString(36).substr(2, 9)}`;
    const channel = supabase
        .channel(channelId)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'pm_activity_logs'
        }, (payload) => {
            const row = payload.new;
            let shouldRefresh = false;

            // Logic to determine if this new log belongs to the current view
            if (itemId && String(row.item_ref) === String(itemId)) shouldRefresh = true;
            else if (orderId && String(row.order_ref) === String(orderId)) shouldRefresh = true;
            else if (spaceId && String(row.space_ref) === String(spaceId)) shouldRefresh = true;
            else if (itemIds && Array.isArray(itemIds) && itemIds.map(id => String(id)).includes(String(row.item_ref))) shouldRefresh = true;
            else if (isAccountLevel) shouldRefresh = true;

            if (shouldRefresh) {
                console.log("[ActivityLog] Realtime update detected, refreshing...");
                loadLogs(true); // Silent refresh
            }
        })
        .subscribe();

    activitySubscriptions.set(container, channel);

    loadLogs();
}

/**
 * Renders a single timeline item matching the Reference image:
 * Actor (Bold) + Action (Regular) + Entity (Bold)
 */
function renderTimelineItem(log, context = {}) {
    const time = new Date(log.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }).toUpperCase();

    let description = log.details?.description || log.details;
    const actionType = log.action_type || '';

    // Vocabulary for translation
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
        'low': 'Bassa',
        'urgent': 'Urgente'
    };
    const t = (val) => vocabulary[val?.toLowerCase()] || val;

    // Check if we are viewing this specific item's log
    const isDedicatedView = context.itemId && String(log.item_ref).trim() === String(context.itemId).trim();

    // Humanize technical fallbacks or old patterns
    const entityName = log.details?.entity_name
        || log.item?.title
        || log.order?.title
        || log.space?.name
        || 'una risorsa';

    const entityBold = `**${entityName}**`;
    const entityRef = isDedicatedView ? '' : ` di ${entityBold}`;
    const typeLabel = log.item?.item_type === 'task' ? 'la task' : 'l\'attività';

    // Special Handlers for specific actions
    if (actionType.includes('cloud_links')) {
        description = null; // FORCE RECALCULATION
        let oldLinks = Array.isArray(log.details?.old) ? log.details.old : (typeof log.details?.old === 'string' ? JSON.parse(log.details.old) : []);
        let newLinks = Array.isArray(log.details?.new) ? log.details.new : (typeof log.details?.new === 'string' ? JSON.parse(log.details.new) : []);

        // Handle double-encoded strings from postgrest/trigger jsonb evaluations
        if (oldLinks.length > 0 && typeof oldLinks[0] === 'string') {
            try { oldLinks = oldLinks.map(s => JSON.parse(s)); } catch (e) { }
        }
        if (newLinks.length > 0 && typeof newLinks[0] === 'string') {
            try { newLinks = newLinks.map(s => JSON.parse(s)); } catch (e) { }
        }

        let diff = null;
        let resName = 'una risorsa';

        if (newLinks.length > oldLinks.length) {
            // ADDED
            diff = newLinks.find(n => !oldLinks.some(o => o.url === n.url));
            if (diff?.label) resName = ` **${diff.label}**`;
            description = isDedicatedView ? `ha aggiunto la risorsa ${resName}` : `ha aggiunto la risorsa ${resName} a ${entityBold}`;
        } else if (newLinks.length < oldLinks.length) {
            // REMOVED
            diff = oldLinks.find(o => !newLinks.some(n => n.url === o.url));
            if (diff?.label) resName = ` **${diff.label}**`;
            description = isDedicatedView ? `ha rimosso la risorsa ${resName}` : `ha rimosso la risorsa ${resName} da ${entityBold}`;
        } else {
            // UPDATED or RE-RENDER
            diff = newLinks[newLinks.length - 1]; // Fallback to last one for visual
            if (diff?.label) resName = ` **${diff.label}**`;
            description = isDedicatedView ? `ha aggiornato le risorse` : `ha aggiornato le risorse di ${entityBold}`;
        }

        if (diff) {
            log._extraContent = `
                <div style="margin-top: 0.75rem; padding: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; align-items: center; gap: 12px; max-width: 320px;">
                    <div style="width: 36px; height: 36px; border-radius: 8px; background: #fff; border: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: center; color: var(--brand-blue);">
                        <span class="material-icons-round" style="font-size: 1.2rem;">${diff.type === 'drive' ? 'description' : (diff.type === 'dropbox' || diff.type === 'onedrive' ? 'folder' : 'link')}</span>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${diff.label || 'Link Esterno'}</div>
                        <div style="font-size: 0.65rem; color: var(--text-tertiary); text-transform: capitalize;">${(diff.type || 'link').replace('_', ' ')}</div>
                    </div>
                    <a href="${diff.url}" target="_blank" style="color: var(--text-tertiary); text-decoration: none;">
                        <span class="material-icons-round" style="font-size: 1.1rem;">open_in_new</span>
                    </a>
                </div>
            `;
        }
    }

    // Strategy: Trust the database description if it exists
    if (!description || typeof description === 'object' || description === 'UPDATE') {
        if (actionType.includes('status') || actionType.includes('status_changed')) {
            const oldVal = t(log.details?.old);
            const newVal = t(log.details?.new);
            if (oldVal && newVal) {
                description = `ha cambiato lo stato${entityRef} da **${oldVal}** a **${newVal}**`;
            } else if (newVal) {
                description = `ha cambiato lo stato${isDedicatedView ? ' in' : ' di ' + entityBold + ' in'} **${newVal}**`;
            } else {
                description = `ha cambiato lo stato${entityRef}`;
            }
        } else if (actionType.includes('comment')) {
            description = isDedicatedView ? `ha aggiunto un commento` : `ha aggiunto un commento in ${entityBold}`;
        } else if (actionType.includes('create')) {
            description = isDedicatedView ? `ha creato ${typeLabel}` : `ha creato ${entityBold}`;
        } else if (actionType.includes('assignee')) {
            const isDelete = actionType.includes('deleted');
            let targetName = log.details?.member_name || '';
            if (!targetName) {
                // EXHAUSTIVE REF CHECK including new row_data
                const row = log.details?.row_data || {};
                const ref = row.user_ref
                    || row.collaborator_ref
                    || log.details?.user_ref
                    || log.details?.collaborator_ref
                    || log.details?.new?.user_ref
                    || log.details?.new?.collaborator_ref;

                if (ref && state.collaborators) {
                    const collab = state.collaborators.find(c => c.id === ref || c.user_id === ref);
                    if (collab) targetName = collab.full_name;
                }
                if (!targetName && ref && state.profiles) {
                    const prof = state.profiles.find(p => p.id === ref);
                    if (prof) targetName = prof.full_name || `${prof.first_name} ${prof.last_name}`.trim();
                }
            }

            const row = log.details?.row_data || log.details?.new || log.details?.old || {};
            const role = row.role || log.details?.role;
            const isPM = role === 'pm' || role === 'owner';

            const memberName = targetName ? ` **${targetName}**` : '';
            if (isDelete) {
                if (isPM) {
                    description = isDedicatedView ? `ha rimosso la responsabilità a${memberName}` : `ha rimosso la responsabilità di ${entityBold} a${memberName}`;
                } else {
                    description = isDedicatedView ? `ha rimosso${memberName}` : `ha rimosso${memberName} da ${entityBold}`;
                }
            } else {
                if (isPM) {
                    description = isDedicatedView ? `ha assegnato un nuovo responsabile:${memberName}` : `ha assegnato un nuovo responsabile di ${entityBold}:${memberName}`;
                } else {
                    const prep = memberName ? ' a' : '';
                    description = isDedicatedView ? `ha assegnato ${typeLabel}${prep}${memberName}` : `ha assegnato ${entityBold}${prep}${memberName}`;
                }
            }
        } else {
            // Last resort
            description = isDedicatedView ? `ha aggiornato ${typeLabel}` : `ha aggiornato ${entityBold}`;
        }
    } else if (isDedicatedView && !actionType.includes('cloud_links')) {
        // If we have a description but we're in dedicated view, strip the entity name if present to avoid redundancy
        const stripPattern = new RegExp(`(\\s(di|in|per|dell'|dello|della|degli|delle|del|dello|da|a)\\s)?${entityBold.replace(/[*]/g, '\\*')}`, 'gi');
        description = description.replace(stripPattern, '').trim();

        // Specific fix for "aggiunto membri" / "rimosso"
        if (description.includes("aggiunto membri") || description.includes("aggiunto un membro") || description.toLowerCase().includes("membro rimosso") || description.toLowerCase().includes("rimosso")) {
            const isDelete = actionType.includes('deleted') || description.toLowerCase().includes("rimosso");
            let targetName = '';
            const row = log.details?.row_data || log.details?.new || log.details?.old || {};
            const ref = row.user_ref
                || row.collaborator_ref
                || log.details?.user_ref
                || log.details?.collaborator_ref;

            const role = row.role || log.details?.role;
            const isPM = role === 'pm' || role === 'owner';

            if (ref && state.collaborators) {
                const collab = state.collaborators.find(c => c.id === ref || c.user_id === ref);
                if (collab) targetName = ` **${collab.full_name}**`;
            }
            if (!targetName && ref && state.profiles) {
                const prof = state.profiles.find(p => p.id === ref);
                if (prof) targetName = ` **${prof.full_name || (prof.first_name + ' ' + prof.last_name).trim()}**`;
            }

            if (isDelete) {
                if (isPM) description = `ha rimosso la responsabilità a${targetName}`;
                else description = `ha rimosso${targetName}`;
            } else {
                if (isPM) description = `ha assegnato un nuovo responsabile:${targetName}`;
                else {
                    const prep = targetName ? ' a' : '';
                    description = `ha assegnato ${typeLabel}${prep}${targetName}`;
                }
            }
        }
    }

    // Apply vocabulary to any remaining technical terms in description
    Object.entries(vocabulary).forEach(([key, value]) => {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        description = description.replace(regex, value);
    });

    // Cleanup grammar after stripping (e.g. double spaces)
    description = description.replace(/\s+/g, ' ').trim();

    const authorName = log.actor?.full_name || 'Sistema';
    const avatarUrl = log.actor?.avatar_url || '';

    // Ensure description words are formatted correctly (markdown to bold)
    let formattedDesc = description.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // NEW: Format ISO dates/times to simple Italian date DD/MM/YYYY
    const isoDateRegex = /(\d{4})[-/](\d{2})[-/](\d{2})[T\s](\d{2}):(\d{2}):?(\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?/gi;
    formattedDesc = formattedDesc.replace(isoDateRegex, (match, year, month, day) => {
        return `${day}/${month}/${year}`;
    });

    let clickHandler = '';
    let style = 'cursor: default;';

    // Only allow clicking if NOT in dedicated view for this item
    if (log.item_ref && !isDedicatedView) {
        clickHandler = `onclick="window.openPmItemDetails('${log.item_ref}', '${log.space_ref || ''}')"`;
        style = 'cursor: pointer; transition: background 0.2s; border-radius: 8px; padding: 0.5rem; margin-left: -0.5rem;';
    } else if (isDedicatedView && (actionType.includes('comment') || (typeof description === 'string' && description.includes('commento')))) {
        // Inside dedicated view, clicking a comment log switches to the comments tab
        clickHandler = `onclick="if(window.setDrawerTab) window.setDrawerTab('comments')"`;
        style = 'cursor: pointer; transition: background 0.2s; border-radius: 8px; padding: 0.5rem; margin-left: -0.5rem;';
    } else if (log.order_ref && !context.orderId) {
        clickHandler = `onclick="window.location.hash = '#pm/commessa/${log.order_ref}'"`;
        style = 'cursor: pointer; transition: background 0.2s; border-radius: 8px; padding: 0.5rem; margin-left: -0.5rem;';
    }

    return `
        <div class="timeline-item activity-log-item" ${clickHandler} style="${style}" onmouseover="if(this.style.cursor==='pointer') this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
            <div class="timeline-avatar">
                <img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random&color=fff&size=64';">
            </div>
            <div class="timeline-content">
                <div class="timeline-text">
                    <strong>${authorName}</strong> ${formattedDesc}
                    ${log._extraContent || ''}
                </div>
                <div class="timeline-time">${time}</div>
            </div>
        </div>
    `;
}
