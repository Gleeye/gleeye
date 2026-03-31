/**
 * Helper module to humanize PM Activity Logs consistently across the app.
 */
import { renderAvatar } from './utils.js';

export const activityVocabulary = {
    // Tasks & Commesse
    'todo': 'Da Fare',
    'in_progress': 'In Corso',
    'blocked': 'Bloccato',
    'review': 'In Revisione',
    'done': 'Completata',
    'active': 'Attivo/a',
    'completed': 'Completato/a',
    'on_hold': 'In Pausa',
    'archived': 'Archiviata',
    
    // Ordini (status_works)
    'da_iniziare': 'Da Iniziare',
    'in_svolgimento': 'In Svolgimento',
    'in_pausa': 'In Pausa',
    'completato': 'Completato',
    'manutenzione': 'Manutenzione',
    
    // Offerta (offer_status)
    'draft': 'Bozza',
    'in_lavorazione': 'In Lavorazione',
    'invio_programmato': 'Invio Programmato',
    'inviata': 'Inviata',
    'accettata': 'Accettata',
    'rifiutata': 'Rifiutata',
    
    // Stato Commerciale (status_sales)
    'contratto_da_inviare': 'Contratto da Inviare',
    'contratto_inviato': 'Contratto Inviato',
    'contratto_firmato': 'Contratto Firmato',
    'lavori_in_corso': 'Lavori in Corso',
    'in_fatturazione': 'In Fatturazione',
    'chiuso': 'Chiuso',
    
    // Incarichi (assignments)
    'cancelled': 'Annullato',
    
    // Fatture & Pagamenti
    'paid': 'Pagata',
    'overdue': 'Scaduta',
    
    // Appuntamenti
    'scheduled': 'Programmato',
    
    // Priorità
    'low': 'Bassa',
    'medium': 'Media',
    'high': 'Alta',
    'urgent': 'Urgente',
    
    // Tipi entità
    'attivita': 'Attività',
    'task': 'Task',
    'commessa': 'Commessa',
    'incarico': 'Incarico'
};

/**
 * Translates a raw database value into a human-readable string.
 * Supports case-insensitive lookup and handles mixed casing from older records.
 */
export const activityTranslate = (val) => {
    if (!val) return val;
    const strVal = String(val).toLowerCase().trim();
    return activityVocabulary[strVal] || val;
};

const ACTION_TYPE_ALIASES = {
    'INSERT': 'new_item',
    'UPDATE': 'item_updated',
    'DELETE': 'item_deleted',
    'status_changed': 'task_updated:status',
    'pm_items:update:status': 'task_updated:status',
    'pm_items:created': 'new_task',
    'pm_item_assignees:created': 'new_assignment',
    'pm_item_assignees:deleted': 'assignment_removed',
    'doc_pages:created': 'new_document'
};

const normalizeActionType = (type) => ACTION_TYPE_ALIASES[type] || type;

/**
 * Turns a raw activity log into a human-readable description and HTML structure.
 * @param {Object} log - The raw log from pm_activity_logs
 * @param {Object} context - Optional context (e.g. { hideContainer: true })
 */
export function humanizeActivity(log, context = {}) {
    const details = log.details || log.metadata || {};
    const rawAction = (log.action_type || '').toLowerCase();
    const actionType = normalizeActionType(rawAction);
    
    // 1. Data Prep & Robust Translation
    const oldValRaw = details.old || details.old_value;
    const newValRaw = details.new || details.new_value;
    const oldValTr = activityTranslate(oldValRaw);
    const newValTr = activityTranslate(newValRaw);
    
    const actorName = log.actor?.full_name || log.authorName || (log.actor_user_ref ? 'Utente' : 'Sistema');
    
    // Resolve Entity Name
    let isFallback = false;
    let entityName = details.entity_name || details.title || details.name || details.description || log.item?.title;
    
    if (!entityName) {
        if (log.order?.title && !log.item?.id && !log.space?.id) entityName = log.order.title;
        else if (log.space?.name && !log.item?.id) entityName = log.space.name;
        else {
            entityName = details.page_name || details.file_name || details.business_name || details.full_name || 'un\'attività';
            if (entityName === 'un\'attività') isFallback = true;
        }
    }
    
    const assignee = details.user_ref_name || details.new_value_name || details.assignee_name;
    const containerName = log.order?.title || log.space?.name;

    // Rule: Prevent redundancy (Entity == Container)
    const isRedundant = containerName && entityName && String(entityName).trim().toLowerCase() === String(containerName).trim().toLowerCase();
    const showContainer = containerName && !context.hideContainer && !isRedundant;
    const containerRef = showContainer ? ` in **${containerName}**` : '';

    // 2. Build Description
    let description = details.description || log.description || '';
    const isGeneric = !description || description === 'UPDATE' || description === 'INSERT' || description.includes('updated:');

    // If description is missing or generic, we rebuild it from actionType
    if (isGeneric) {
        const eStr = isFallback ? entityName : `**${entityName}**`;

        if (actionType.includes('status')) {
            description = `ha spostato ${eStr}${containerRef} da **${oldValTr}** a **${newValTr}**`;
            if (!oldValRaw) description = `ha cambiato lo stato di ${eStr}${containerRef} in **${newValTr}**`;
        } else if (actionType.includes('priority')) {
            description = `ha impostato la priorità di ${eStr}${containerRef} a **${newValTr}**`;
        } else if (actionType.includes('user_ref') || actionType.includes('p_m')) {
            const targetUser = details.new_value_name || details.new_name || newValTr || 'un utente';
            description = `ha assegnato ${eStr}${containerRef} a **${targetUser}**`;
        } else if (actionType.includes('created') || actionType.includes('new_')) {
            description = `ha creato ${eStr}`;
            if (assignee) description += ` per **${assignee}**`;
            description += containerRef;
        } else if (actionType.includes('deleted') || actionType.includes('removed')) {
            description = `ha rimosso ${eStr}${containerRef}`;
        } else if (actionType.includes('comment')) {
            description = `ha aggiunto un commento in ${eStr}${containerRef}`;
        } else if (actionType.includes('due_date')) {
            const dateStr = newValRaw ? new Date(newValRaw).toLocaleDateString('it-IT') : 'una nuova data';
            description = `ha cambiato la scadenza di ${eStr}${containerRef} al **${dateStr}**`;
        } else {
            description = `ha modificato ${eStr}${containerRef}`;
        }
    } else {
        // Description exists (from DB Trigger). 
        // Sync-Humanization: Replace enums that might have leaked as raw values
        if (newValRaw && newValRaw !== newValTr) description = description.replace(new RegExp(`\\b${newValRaw}\\b`, 'g'), newValTr);
        if (oldValRaw && oldValRaw !== oldValTr) description = description.replace(new RegExp(`\\b${oldValRaw}\\b`, 'g'), oldValTr);
        
        // Final Placeholder Guard (Bug 1 & 3 rescue)
        const someone = (details || {}).user_ref_name || (details || {}).new_value_name || (details || {}).assignee_name || (details || {}).full_name || "qualcuno";
        description = (description || "")
            .replace(/{user_ref}|{target_ref}|{item_ref}/g, someone)
            .replace('{entity}', entityName)
            .replace('{title}', (details || {}).title || entityName);
    }

    // Format Markdown to HTML (Subtle Highlight)
    const formattedDesc = description.replace(/\*\*(.*?)\*\*/g, '<span style="font-weight: 600; color: #1e293b;">$1</span>');
    
    return {
        actorName,
        formattedDesc,
        description,
        containerName,
        entityName,
        timeStr: log.created_at
    };
}
