/**
 * Helper module to humanize PM Activity Logs consistently across the app.
 */
import { renderAvatar } from './utils.js';

export const activityVocabulary = {
    'todo': 'Da Fare',
    'in_progress': 'In Corso',
    'blocked': 'Bloccato',
    'review': 'In Revisione',
    'done': 'Completata',
    'attivita': 'Attività',
    'task': 'Task'
};

export const activityTranslate = (val) => activityVocabulary[val?.toLowerCase()] || val;

/**
 * Turns a raw activity log into a human-readable description and HTML structure.
 * @param {Object} log - The raw log from pm_activity_logs
 * @param {Object} context - Optional context (e.g. { hideContainer: true })
 */
export function humanizeActivity(log, context = {}) {
    const details = log.details || log.metadata || {};
    let description = details.description || log.description || '';
    const actionType = (log.action_type || '').toLowerCase();
    
    const actorName = log.actor?.full_name || log.authorName || (log.actor_user_ref ? 'Utente' : 'Sistema');
    const entityName = details.entity_name || log.item?.title || log.order?.title || log.space?.name || 'una risorsa';
    
    const assignee = details.user_ref_name || details.new_value_name || details.assignee_name;
    const containerName = log.order?.title || log.space?.name;
    const containerRef = (containerName && !context.hideContainer) ? ` in **${containerName}**` : '';

    const isKnownAction = actionType.includes('status') || actionType.includes('user_ref') || actionType.includes('created') || actionType.includes('comment') || actionType.includes('cloud_links') || actionType.includes('due_date');

    if (!description || description === 'UPDATE' || isKnownAction) {
        if (actionType.includes('status')) {
            const oldVal = activityTranslate(details.old || details.old_value);
            const newVal = activityTranslate(details.new || details.new_value);
            description = `ha cambiato lo stato di **${entityName}**${containerRef} ${oldVal && newVal ? `da **${oldVal}** a **${newVal}**` : `in **${newVal}**`}`;
        } else if (actionType.includes('user_ref')) {
            const targetUser = details.new_value_name || details.new || 'un utente';
            description = `ha assegnato **${entityName}**${containerRef} a **${targetUser}**`;
        } else if (actionType.includes('created')) {
            description = `ha creato **${entityName}**`;
            if (assignee) description += ` per **${assignee}**`;
            description += containerRef;
        } else if (actionType.includes('comment')) {
            description = `ha aggiunto un commento in **${entityName}**${containerRef}`;
        } else if (actionType.includes('cloud_links')) {
            description = `ha aggiunto un documento a **${entityName}**${containerRef}`;
        } else if (actionType.includes('due_date')) {
             const date = details.new || details.new_value;
             const dateStr = date ? new Date(date).toLocaleDateString('it-IT') : 'una nuova data';
             description = `ha cambiato la scadenza di **${entityName}**${containerRef} al **${dateStr}**`;
        } else if (!description || description === 'UPDATE') {
            description = `ha effettuato una modifica a **${entityName}**${containerRef}`;
        }
    }

    // Format Markdown to HTML
    const formattedDesc = description.replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--text-primary);">$1</strong>');
    
    return {
        actorName,
        formattedDesc,
        description,
        containerName,
        entityName,
        timeStr: log.created_at
    };
}
