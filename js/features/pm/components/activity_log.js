import { fetchPMActivityLogs } from '../../../modules/pm_api.js?v=1000';

/**
 * Render the Activity Log for a specific space or item
 * @param {HTMLElement} container - Where to render the logs
 * @param {string} spaceId - The PM Space ID (optional)
 * @param {string} itemId - The PM Item ID (optional)
 */
export async function renderActivityLog(container, spaceId = null, itemId = null) {
    if (!container) return;

    container.innerHTML = `
        <div class="activity-log-container" style="padding: 1rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-icons-round" style="color: var(--text-secondary);">history</span>
                    Log Attività
                </h3>
                <button class="icon-btn refresh-log-btn" title="Aggiorna">
                    <span class="material-icons-round">refresh</span>
                </button>
            </div>
            <div class="activity-log-list" style="position: relative;">
                <div class="loader-container" style="text-align: center; padding: 2rem;"><div class="loader"></div></div>
            </div>
        </div>
    `;

    const listContainer = container.querySelector('.activity-log-list');
    const refreshBtn = container.querySelector('.refresh-log-btn');

    const loadLogs = async () => {
        listContainer.innerHTML = '<div class="loader-container" style="text-align: center; padding: 2rem;"><div class="loader"></div></div>';

        try {
            const logs = await fetchPMActivityLogs(spaceId, itemId);

            if (!logs || logs.length === 0) {
                listContainer.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        <span class="material-icons-round" style="font-size: 2rem; opacity: 0.5;">history_edu</span>
                        <p style="margin-top: 0.5rem; font-size: 0.9rem;">Nessuna attività registrata</p>
                    </div>
                `;
                return;
            }

            let html = '<div style="display: flex; flex-direction: column; gap: 1rem; position: relative; padding-left: 1rem; border-left: 2px solid var(--border-color);">';

            logs.forEach(log => {
                const date = new Date(log.created_at);
                const timeString = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                const dateString = date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

                let actionText = '';
                let icon = 'info';
                let iconColor = 'var(--text-secondary)';

                switch (log.action_type) {
                    case 'workspace_created':
                        actionText = `Ha creato lo spazio <b>${log.details?.name || ''}</b>`;
                        icon = 'folder_special';
                        break;
                    case 'workspace_updated':
                        actionText = `Ha modificato lo spazio da <i>${log.details?.old_name || ''}</i> a <b>${log.details?.new_name || ''}</b>`;
                        icon = 'edit';
                        break;
                    case 'item_created':
                        actionText = `Ha creato ${log.details?.type === 'task' ? 'il task' : "l'attività"} <b>${log.details?.title || ''}</b>`;
                        icon = 'add_task';
                        iconColor = 'var(--success-color)';
                        break;
                    case 'status_changed':
                        actionText = `Ha cambiato lo stato in <span class="badge" style="font-size: 0.75rem;">${log.details?.new_status || ''}</span>`;
                        icon = 'published_with_changes';
                        iconColor = 'var(--warning-color)';
                        break;
                    case 'comment_added':
                        actionText = `Ha commentato: "<i>${log.details?.comment_snippet || ''}...</i>"`;
                        icon = 'forum';
                        iconColor = 'var(--brand-blue)';
                        break;
                    case 'assignee_added':
                        actionText = `Ha assegnato un nuovo utente`;
                        icon = 'person_add';
                        break;
                    case 'document_created':
                        actionText = `Ha creato il documento <b>${log.details?.doc_title || ''}</b>`;
                        icon = 'note_add';
                        iconColor = 'var(--brand-blue)';
                        break;
                    case 'document_updated':
                        actionText = `Ha rinominato un documento in <b>${log.details?.new_title || ''}</b>`;
                        icon = 'edit_document';
                        break;
                    case 'appointment_participant_added':
                        actionText = `Ha invitato un partecipante all'appuntamento <b>${log.details?.appointment_title || ''}</b>`;
                        icon = 'event_available';
                        iconColor = 'var(--warning-color)';
                        break;
                    default:
                        actionText = `Azione: ${log.action_type}`;
                }

                html += `
                    <div class="activity-item" style="position: relative;">
                        <!-- Timeline dot -->
                        <div style="position: absolute; left: -1.35rem; top: 0.25rem; width: 0.6rem; height: 0.6rem; border-radius: 50%; background: ${iconColor}; border: 2px solid var(--bg-primary);"></div>
                        
                        <div style="display: flex; gap: 0.75rem; align-items: flex-start; background: var(--bg-secondary); padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border-color);">
                            <img src="${log.avatarUrl}" alt="${log.authorName}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;">
                            
                            <div style="flex: 1; min-width: 0;">
                                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.25rem;">
                                    <span style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary);">${log.authorName}</span>
                                    <span style="font-size: 0.75rem; color: var(--text-tertiary);" title="${dateString} alle ${timeString}">${dateString} ${timeString}</span>
                                </div>
                                <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4;">
                                    <span class="material-icons-round" style="font-size: 1rem; vertical-align: middle; margin-right: 0.25rem; color: ${iconColor};">${icon}</span>
                                    <span>${actionText}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });

            html += '</div>';
            listContainer.innerHTML = html;
        } catch (err) {
            console.error("Error loading activity logs:", err);
            listContainer.innerHTML = `<div class="error-msg">Errore caricamento log attività</div>`;
        }
    };

    refreshBtn.addEventListener('click', loadLogs);
    loadLogs();
}
