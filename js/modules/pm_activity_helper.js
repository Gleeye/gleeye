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
    
    // Resolve Entity Name and catch fallbacks
    let isFallback = false;
    let entityName = details.entity_name || log.item?.title;
    
    if (!entityName) {
        if (log.order?.title && !log.item?.id && !log.space?.id) {
            entityName = log.order.title;
        } else if (log.space?.name && !log.item?.id) {
            entityName = log.space.name;
        } else {
            entityName = 'un\'attività';
            isFallback = true;
        }
    }
    
    const assignee = details.user_ref_name || details.new_value_name || details.assignee_name;
    const containerName = log.order?.title || log.space?.name;

    // Rule 1: Prevent redundancy (Entity == Container)
    const isRedundant = containerName && entityName && (entityName.trim().toLowerCase() === containerName.trim().toLowerCase());
    const showContainer = containerName && !context.hideContainer && !isRedundant;
    const containerRef = showContainer ? ` in **${containerName}**` : '';

    const isKnownAction = actionType.includes('status') || actionType.includes('user_ref') || actionType.includes('created') || actionType.includes('comment') || actionType.includes('cloud_links') || actionType.includes('due_date');

    if (!description || description === 'UPDATE' || isKnownAction) {
        // Build generic entity strings if it's a fallback
        const eStr = isFallback ? entityName : `**${entityName}**`;

        if (actionType.includes('status')) {
            const oldVal = activityTranslate(details.old || details.old_value);
            const newVal = activityTranslate(details.new || details.new_value);
            description = `ha cambiato lo stato di ${eStr}${containerRef} ${oldVal && newVal ? `da **${oldVal}** a **${newVal}**` : `in **${newVal}**`}`;
        } else if (actionType.includes('user_ref')) {
            const targetUser = details.new_value_name || details.new || 'un utente';
            description = `ha assegnato ${eStr}${containerRef} a **${targetUser}**`;
        } else if (actionType.includes('created')) {
            description = `ha creato ${eStr}`;
            if (assignee) description += ` per **${assignee}**`;
            description += containerRef;
        } else if (actionType.includes('comment')) {
            description = `ha aggiunto un commento in ${eStr}${containerRef}`;
        } else if (actionType.includes('cloud_links')) {
            description = `ha aggiunto un documento a ${eStr}${containerRef}`;
        } else if (actionType.includes('due_date')) {
             const date = details.new || details.new_value;
             const dateStr = date ? new Date(date).toLocaleDateString('it-IT') : 'una nuova data';
             description = `ha cambiato la scadenza di ${eStr}${containerRef} al **${dateStr}**`;
        } else if (!description || description === 'UPDATE') {
            description = `ha modificato ${eStr}${containerRef}`;
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
