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

/**
 * Turns a raw activity log into a human-readable description and HTML structure.
 * @param {Object} log - The raw log from pm_activity_logs
 * @param {Object} context - Optional context (e.g. { hideContainer: true })
 */
export function humanizeActivity(log, context = {}) {
    const details = log.details || log.metadata || {};
    let description = details.description || log.description || '';
    const actionType = (log.action_type || '').toLowerCase();
    
    // BUG 2 Fix: Pre-translate metadata values
    const oldValRaw = details.old || details.old_value;
    const newValRaw = details.new || details.new_value;
    const oldValTr = activityTranslate(oldValRaw);
    const newValTr = activityTranslate(newValRaw);
    
    const actorName = log.actor?.full_name || log.authorName || (log.actor_user_ref ? 'Utente' : 'Gleeye');
    
    // Resolve Entity Name and catch fallbacks
    let isFallback = false;
    let entityName = details.entity_name || details.title || details.name || details.description || log.item?.title;
    
    if (!entityName) {
        if (log.order?.title && !log.item?.id && !log.space?.id) {
            entityName = log.order.title;
        } else if (log.space?.name && !log.item?.id) {
            entityName = log.space.name;
        } else {
            // Check metadata again for common title fields
            entityName = details.page_name || details.file_name || details.business_name || details.full_name || 'un\'attività';
            if (entityName === 'un\'attività') isFallback = true;
        }
    }
    
    const assignee = details.user_ref_name || details.new_value_name || details.assignee_name;
    const containerName = log.order?.title || log.space?.name;

    // Rule 1: Prevent redundancy (Entity == Container)
    const isRedundant = containerName && entityName && String(entityName).trim().toLowerCase() === String(containerName).trim().toLowerCase();
    const showContainer = containerName && !context.hideContainer && !isRedundant;
    const containerRef = showContainer ? ` in **${containerName}**` : '';

    // BUG 2 Fix: If the description from DB contains raw enums, we attempt to translate it.
    // However, most descriptions are rebuilt here for accuracy.
    const isKnownAction = actionType.includes('status') || actionType.includes('priority') || actionType.includes('user_ref') || actionType.includes('created') || actionType.includes('assignment') || actionType.includes('comment') || actionType.includes('cloud_links') || actionType.includes('due_date');

    if (!description || description === 'UPDATE' || isKnownAction) {
        // Build generic entity strings if it's a fallback
        const eStr = isFallback ? entityName : `**${entityName}**`;

        if (actionType.includes('status')) {
            description = `ha cambiato lo stato di ${eStr}${containerRef} ${oldValRaw && newValRaw ? `da **${oldValTr}** a **${newValTr}**` : `in **${newValTr}**`}`;
        } else if (actionType.includes('priority')) {
            description = `ha cambiato la priorità di ${eStr}${containerRef} ${oldValRaw && newValRaw ? `da **${oldValTr}** a **${newValTr}**` : `in **${newValTr}**`}`;
        } else if (actionType.includes('user_ref')) {
            const targetUser = details.new_value_name || details.new_name || newValTr || 'un utente';
            description = `ha assegnato ${eStr}${containerRef} a **${targetUser}**`;
        } else if (actionType.includes('created') || actionType.includes('new_')) {
            description = `ha creato ${eStr}`;
            if (assignee) description += ` per **${assignee}**`;
            description += containerRef;
        } else if (actionType.includes('comment')) {
            description = `ha aggiunto un commento in ${eStr}${containerRef}`;
        } else if (actionType.includes('cloud_links')) {
            description = `ha aggiunto un documento a ${eStr}${containerRef}`;
        } else if (actionType.includes('due_date')) {
             const date = newValRaw;
             const dateStr = date ? new Date(date).toLocaleDateString('it-IT') : 'una nuova data';
             description = `ha cambiato la scadenza di ${eStr}${containerRef} al **${dateStr}**`;
        } else if (actionType.includes('assignment')) {
            description = actionType.includes('removed') ? `ha rimosso un membro da ${eStr}${containerRef}` : `ha aggiunto un membro a ${eStr}${containerRef}`;
        } else if (!description || description === 'UPDATE') {
            description = `ha modificato ${eStr}${containerRef}`;
        }
    } else {
        // Fallback: the description is from DB. We try to translate common enums if they are at the end of the string.
        // This is a safety net for DB actions not caught by isKnownAction.
        if (newValRaw && !newValTr.includes('{') && newValRaw !== newValTr) {
             description = description.replace(new RegExp(`\\b${newValRaw}\\b`, 'g'), newValTr);
        }
        if (oldValRaw && !oldValTr.includes('{') && oldValRaw !== oldValTr) {
             description = description.replace(new RegExp(`\\b${oldValRaw}\\b`, 'g'), oldValTr);
        }
        // Normalize placeholders that might have leaked from BUG 1
        description = description.replace('{entity}', entityName);
    }

    // Format Markdown to HTML (Subtle Highlight, NO BOLD)
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
