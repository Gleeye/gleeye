import { renderAvatar } from '../../../modules/utils.js?v=1241';
import { supabase } from '../../../modules/config.js';
import { state } from '../../../modules/state.js';
import { fetchPMActivityLogs } from '../../../modules/pm_api.js?v=1241';

const activitySubscriptions = new Map();

/**
 * Initializes and renders the Activity Log for a specific context
 */
export async function renderActivityLog(container, options = {}) {
    const { itemId, orderId, spaceId, itemIds, isAccountLevel = false, limit = 50 } = options;

    container.innerHTML = `
        <div class="activity-log-container" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem;">
            <div id="activity-log-list" style="display: flex; flex-direction: column;">
                <div style="padding: 2rem; text-align: center; color: var(--text-tertiary);">
                    <div class="activity-shimmer" style="width: 100%; height: 60px; border-radius: 12px; margin-bottom: 1rem;"></div>
                    <div class="activity-shimmer" style="width: 80%; height: 60px; border-radius: 12px;"></div>
                </div>
            </div>
        </div>
        <style>
            .activity-shimmer {
                background: linear-gradient(90deg, #f1f5f9 25%, #f8fafc 50%, #f1f5f9 75%);
                background-size: 200% 100%;
                animation: shimmer 1.5s infinite;
            }
            @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
            
            .timeline-item { animation: fadeInActivity 0.4s ease forwards; opacity: 0; }
            @keyframes fadeInActivity { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            
            .timeline-avatar { 
                width: 32px; height: 32px; border-radius: 50%; overflow: hidden; border: 2px solid #fff; 
                box-shadow: 0 2px 8px rgba(0,0,0,0.05); flex-shrink: 0; 
            }
        </style>
    `;

    const logList = container.querySelector('#activity-log-list');

    const loadLogs = async (isSilent = false) => {
        try {
            if (!isSilent) logList.innerHTML = `<div style="text-align: center; padding: 2rem; color: #94a3b8;">Caricamento attività...</div>`;
            
            const logs = await fetchPMActivityLogs({ itemId, orderId, spaceId, itemIds, isAccountLevel, limit });
            
            if (!logs || logs.length === 0) {
                logList.innerHTML = `
                    <div style="text-align: center; padding: 3rem 1.5rem; background: #f8fafc; border: 1.5px dashed #e2e8f0; border-radius: 16px; display: flex; flex-direction: column; align-items: center; gap: 1rem;">
                        <span class="material-icons-round" style="font-size: 3rem; color: #cbd5e1;">history</span>
                        <div style="font-size: 0.9rem; color: #64748b; font-weight: 500;">Nessuna attività registrata.</div>
                    </div>
                `;
                return;
            }

            // Separate logs by date
            const grouped = {};
            logs.forEach(log => {
                const dateKey = new Date(log.created_at).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
                if (!grouped[dateKey]) grouped[dateKey] = [];
                grouped[dateKey].push(log);
            });

            logList.innerHTML = Object.entries(grouped).map(([date, items]) => `
                <div class="date-group" style="margin-top: 1rem;">
                    <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 1.25rem; letter-spacing: 0.05em; display: flex; align-items: center; gap: 12px;">
                        ${date}
                        <div style="flex: 1; height: 1px; background: #f1f5f9;"></div>
                    </div>
                    ${items.map(log => renderTimelineItem(log, { itemId, orderId, spaceId })).join('')}
                </div>
            `).join('');

        } catch (e) {
            console.error("[ActivityLog] Error loading logs:", e);
            logList.innerHTML = `<div style="color: #ef4444; padding: 1rem; text-align: center;">Errore nel caricamento delle attività.</div>`;
        }
    };

    // Subscriptions Cleanup and Setup
    if (activitySubscriptions.has(container)) {
        supabase.removeChannel(activitySubscriptions.get(container));
    }

    const channel = supabase.channel(`activity_log_realtime_${itemId || spaceId || 'all'}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pm_activity_logs' }, (payload) => {
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
 * Standard translations and formatting
 */
const vocabulary = {
    'todo': 'Da Fare',
    'in_progress': 'In Corso',
    'blocked': 'Bloccato',
    'review': 'In Revisione',
    'done': 'Completata',
    'attivita': 'Attività',
    'task': 'Task'
};

const t = (val) => vocabulary[val?.toLowerCase()] || val;

/**
 * Renders a single timeline item
 */
function renderTimelineItem(log, context = {}) {
    const details = log.details || {};
    let description = details.description || '';
    const actionType = (log.action_type || '').toLowerCase();
    
    // Humanize technical fallbacks or old patterns
    const entityName = details.entity_name || log.item?.title || log.order?.title || log.space?.name || 'una risorsa';
    const entityBold = `**${entityName}**`;
    const isDedicatedView = context.itemId && String(log.item_ref).trim() === String(context.itemId).trim();
    const entityRef = isDedicatedView ? '' : ` di ${entityBold}`;

    // 1. Rebuild description if missing (Fallback Logic)
    if (!description || description === 'UPDATE') {
        if (actionType.includes('status')) {
            const oldVal = t(details.old);
            const newVal = t(details.new);
            description = `ha cambiato lo stato${entityRef} ${oldVal && newVal ? `da **${oldVal}** a **${newVal}**` : `in **${newVal}**`}`;
        } else if (actionType.includes('pm_user_ref') || actionType.includes('user_ref')) {
            const targetUser = details.new_value || details.new || 'un utente';
            description = `ha assegnato ${entityBold} a **${targetUser}**`;
        } else if (actionType.includes('created')) {
            description = `ha creato l'attività ${entityBold}`;
        } else if (actionType.includes('comment')) {
            description = isDedicatedView ? `ha aggiunto un commento` : `ha aggiunto un commento in ${entityBold}`;
        } else {
            description = `ha effettuato una modifica a ${entityBold}`;
        }
    }

    // 2. Natural Language: Handle self-assignments
    if (log.actor_user_ref && (details.user_ref === log.actor_user_ref || details.new === log.actor_user_ref)) {
        description = description.replace(/ha assegnato \*\*(.*?)\*\*/g, 'si è assegnato');
        const actorName = log.actor?.full_name || 'se stesso';
        const actorRegex = new RegExp(`\\*\\*${actorName}\\*\\*`, 'g');
        description = description.replace(actorRegex, 'se stesso');
    }

    // 3. Final Vocabulary translation pass (only for specific bolded keys to avoid title corruption)
    Object.entries(vocabulary).forEach(([key, value]) => {
        const regex = new RegExp(`\\*\\*${key}\\*\\*`, 'gi');
        description = description.replace(regex, `**${value}**`);
    });

    // 4. Render Layout
    const timeStr = new Date(log.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const actorName = log.actor?.full_name || 'Sistema';

    // Format Markdown to HTML
    let formattedDesc = description.replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--text-primary);">$1</strong>');

    // Handle Cloud Links extra content if present
    let extraContent = '';
    if (actionType.includes('cloud_links')) {
         const links = Array.isArray(details.new) ? details.new : [];
         if (links.length > 0) {
             const last = links[links.length - 1];
             extraContent = `
                <div style="margin-top: 0.75rem; padding: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; align-items: center; gap: 12px; max-width: 320px;">
                    <span class="material-icons-round" style="font-size: 1.2rem; color: var(--brand-blue);">${last.type === 'drive' ? 'description' : 'link'}</span>
                    <div style="flex: 1; min-width: 0; font-size: 0.8rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${last.label || 'Link Esterno'}</div>
                    <a href="${last.url}" target="_blank" style="color: var(--text-tertiary);"><span class="material-icons-round" style="font-size: 1.1rem;">open_in_new</span></a>
                </div>
             `;
         }
    }

    let clickHandler = '';
    let style = 'cursor: default;';
    if (log.item_ref && !isDedicatedView) {
        clickHandler = `onclick="window.openPmItemDetails('${log.item_ref}', '${log.space_ref || ''}')"`;
        style = 'cursor: pointer;';
    }

    return `
        <div class="timeline-item" ${clickHandler} style="display: flex; gap: 1rem; position: relative; padding-bottom: 1.5rem; ${style}">
            <!-- Timeline Line -->
            <div style="position: absolute; left: 15px; top: 32px; bottom: 0; width: 2px; background: #f1f5f9; z-index: 1;"></div>
            
            <div class="actor-avatar" style="flex-shrink: 0; position: relative; z-index: 2;">
                ${renderAvatar(log.actor, { size: 32, borderRadius: '50%' })}
            </div>
            
            <div class="log-content" style="flex: 1; padding-top: 4px;">
                <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;">
                    <span style="font-weight: 700; color: var(--text-primary);">${actorName}</span> 
                    ${formattedDesc}
                </div>
                ${extraContent}
                <div style="font-size: 0.7rem; color: var(--text-tertiary); margin-top: 4px; display: flex; align-items: center; gap: 6px;">
                    <span class="material-icons-round" style="font-size: 0.8rem;">schedule</span>
                    ${timeStr}
                </div>
            </div>
        </div>
    `;
}
