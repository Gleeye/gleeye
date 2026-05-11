/**
 * Helper module to humanize PM Activity Logs consistently across the app.
 * Single source of truth — all views should use humanizeActivity().
 */
import { renderAvatar } from './utils.js?v=8000';

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
    'sospeso': 'Sospeso',

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
 */
export const activityTranslate = (val) => {
    if (!val) return val;
    const strVal = String(val).toLowerCase().trim();
    return activityVocabulary[strVal] || val;
};

/**
 * Normalizes action_type to canonical form.
 *
 * Lo storico dei log è stato consolidato con la migration
 * `normalize_activity_log_action_types` (12 maggio 2026): tutti gli action_type
 * legacy in DB sono già stati riscritti ai canonici. Questa mappa serve solo
 * come safety-net se il trigger SQL produce ancora formati grezzi (es. dopo
 * un import/script di backfill).
 *
 * Se vedi un action_type non riconosciuto qui, è normale: il fallback nel
 * `humanizeActivity()` produce comunque una frase sensata leggendo
 * `metadata.col`. Aggiungere un alias qui solo se la frase fallback è povera.
 */
const ACTION_TYPE_ALIASES = {
    // Trigger grezzi (mai dovrebbero arrivare in feed, ma copertura difensiva)
    'INSERT': 'new_item',
    'UPDATE': 'item_updated',
    'DELETE': 'item_deleted',
    'created': 'new_item',
    'updated': 'item_updated',
    'deleted': 'item_deleted',
};

const normalizeActionType = (type) => ACTION_TYPE_ALIASES[type] || type;

// Log "orfani" del passato (action_type='legacy_orphan' dopo la migration di
// pulizia): non hanno contesto recuperabile (no item_ref/space_ref/order_ref,
// no metadata). Li mostriamo con una stringa neutra invece di nasconderli del
// tutto, così l'audit storico resta consultabile.
const LEGACY_ORPHAN = 'legacy_orphan';

/**
 * Column-name to human-readable label map for update descriptions.
 */
const COLUMN_LABELS = {
    'status': 'lo stato',
    'priority': 'la priorità',
    'title': 'il titolo',
    'name': 'il nome',
    'due_date': 'la scadenza',
    'start_date': 'la data di inizio',
    'notes': 'le note',
    'description': 'la descrizione',
    'pm_user_ref': 'l\'assegnazione',
    'p_m': 'il project manager',
    'parent_ref': 'la sezione',
    'cloud_links': 'i documenti allegati',
    'offer_status': 'lo stato offerta',
    'status_works': 'lo stato lavori',
    'status_sales': 'lo stato commerciale',
    'collaborator_id': 'il collaboratore',
    'budget': 'il budget',
};

/**
 * Resolves the best entity name from a log entry.
 * Prefers the joined item/space/order title over details.entity_name
 * when details.entity_name is a generic fallback like "una risorsa".
 */
function resolveEntityName(log, details) {
    const detailName = details.entity_name || details.title || details.name || details.item_title || details.appointment_title;

    // If details has a real name (not the fallback), use it
    if (detailName && detailName !== 'una risorsa') {
        return { name: detailName, isFallback: false };
    }

    // Try joined relations (these come from the Supabase select)
    if (log.item?.title) return { name: log.item.title, isFallback: false };
    if (log.order?.title && !log.item?.id && !log.space?.id) return { name: log.order.title, isFallback: false };
    if (log.space?.name && !log.item?.id) return { name: log.space.name, isFallback: false };

    // Secondary detail fields
    const secondary = details.page_name || details.file_name || details.business_name || details.full_name;
    if (secondary) return { name: secondary, isFallback: false };

    return { name: "un'attività", isFallback: true };
}

/**
 * Turns a raw activity log into a human-readable description and HTML structure.
 * @param {Object} log - The raw log from pm_activity_logs (with joined actor, item, order, space)
 * @param {Object} context - Optional { hideContainer: true }
 * @returns {{ actorName, formattedDesc, description, containerName, entityName, timeStr }}
 */
export function humanizeActivity(log, context = {}) {
    const details = log.details || log.metadata || {};
    const rawAction = log.action_type || '';
    const actionType = normalizeActionType(rawAction.toLowerCase());

    // Legacy orphan: log storici senza contesto recuperabile (no ref, no metadata).
    // Restituiamo una frase neutra senza tentare di costruire una narrazione.
    if (rawAction === LEGACY_ORPHAN) {
        const actorName = log.actor?.full_name || (log.actor_user_ref ? 'Utente' : 'Sistema');
        return {
            actorName,
            formattedDesc: 'ha registrato un\'attività di sistema',
            description: 'ha registrato un\'attività di sistema',
            containerName: null,
            entityName: null,
            timeStr: log.created_at,
            isLegacyOrphan: true
        };
    }

    // 1. Translate values (support old + new detail key formats)
    const oldValRaw = details.old || details.old_value || details.old_status;
    const newValRaw = details.new || details.new_value || details.new_status;
    const oldValTr = activityTranslate(oldValRaw);
    const newValTr = activityTranslate(newValRaw);
    const col = details.col; // tracked column name (from new trigger)

    const actorName = log.actor?.full_name || log.authorName || (log.actor_user_ref ? 'Utente' : 'Sistema');

    // 2. Resolve Entity Name
    const { name: entityName, isFallback } = resolveEntityName(log, details);

    // 3. Container (order/space context)
    const containerName = log.order?.title || log.space?.name;
    const isRedundant = containerName && entityName &&
        String(entityName).trim().toLowerCase() === String(containerName).trim().toLowerCase();
    const showContainer = containerName && !context.hideContainer && !isRedundant;
    const containerRef = showContainer ? ` in **${containerName}**` : '';

    // 4. Build description
    const eStr = isFallback ? entityName : `**${entityName}**`;
    let description = '';

    // --- Granular UPDATE with col info (new trigger format) ---
    if (col && (actionType.includes('updated') || actionType.includes(':') )) {
        const colLabel = COLUMN_LABELS[col] || col;

        if (col === 'status' || col === 'status_works' || col === 'status_sales' || col === 'offer_status') {
            if (oldValRaw && newValRaw) {
                description = `ha spostato ${eStr} da **${oldValTr}** a **${newValTr}**`;
            } else {
                description = `ha cambiato ${colLabel} di ${eStr} in **${newValTr}**`;
            }
        } else if (col === 'priority') {
            description = `ha impostato la priorità di ${eStr} a **${newValTr}**`;
        } else if (col === 'due_date' || col === 'start_date') {
            const dateStr = newValRaw ? new Date(newValRaw).toLocaleDateString('it-IT') : 'una nuova data';
            const label = col === 'due_date' ? 'la scadenza' : 'l\'inizio';
            description = `ha cambiato ${label} di ${eStr} al **${dateStr}**`;
        } else if (col === 'title' || col === 'name') {
            description = `ha rinominato ${eStr} in **${newValRaw || 'nuovo nome'}**`;
        } else if (col === 'notes' || col === 'description') {
            description = `ha aggiornato le note di ${eStr}`;
        } else if (col === 'pm_user_ref' || col === 'p_m' || col === 'collaborator_id') {
            const targetUser = details.new_value_name || details.new_name || newValTr || 'un utente';
            description = `ha assegnato ${eStr} a **${targetUser}**`;
        } else if (col === 'cloud_links') {
            description = `ha allegato un documento a ${eStr}`;
        } else if (col === 'parent_ref') {
            description = `ha spostato ${eStr} in un'altra sezione`;
        } else {
            description = `ha aggiornato ${colLabel} di ${eStr}`;
        }
        description += containerRef;

    // --- Template from DB (details.description exists) ---
    } else if (details.description && details.description !== 'UPDATE' && details.description !== 'INSERT') {
        description = details.description;

        // Replace known placeholders
        const assigneeName = details.assignee_name || details.user_ref_name || details.new_value_name || details.full_name || 'un membro';
        const amount = details.amount;

        description = description
            .replace(/\{entity\}/g, entityName)
            .replace(/\{title\}/g, details.title || entityName)
            .replace(/\{name\}/g, details.name || entityName)
            .replace(/\{assignee_name\}/g, assigneeName)
            .replace(/\{user_ref\}/g, assigneeName)
            .replace(/\{target_ref\}/g, assigneeName)
            .replace(/\{item_ref\}/g, entityName)
            .replace(/\{amount\}/g, amount ? Number(amount).toLocaleString('it-IT', { minimumFractionDigits: 2 }) : '—')
            .replace(/\{file_name\}/g, details.file_name || entityName)
            .replace(/\{business_name\}/g, details.business_name || entityName)
            .replace(/\{full_name\}/g, details.full_name || entityName)
            .replace(/\{description\}/g, entityName)
            .replace(/\{invoice_number\}/g, details.invoice_number || entityName)
            .replace(/\{supplier_name\}/g, details.supplier_name || entityName)
            .replace(/\{linked_entity_type\}/g, details.linked_entity_type || 'risorsa');

        // Translate any remaining raw enum values
        if (newValRaw && newValRaw !== newValTr) {
            description = description.replace(new RegExp(`\\b${newValRaw}\\b`, 'g'), newValTr);
        }
        if (oldValRaw && oldValRaw !== oldValTr) {
            description = description.replace(new RegExp(`\\b${oldValRaw}\\b`, 'g'), oldValTr);
        }

        // Append container context to template-based descriptions too
        if (containerRef) description += containerRef;

    // --- Fallback: rebuild from action type ---
    } else {
        if (actionType.includes('status')) {
            description = `ha spostato ${eStr}${containerRef} da **${oldValTr}** a **${newValTr}**`;
            if (!oldValRaw) description = `ha cambiato lo stato di ${eStr}${containerRef} in **${newValTr}**`;
        } else if (actionType.includes('priority')) {
            description = `ha impostato la priorità di ${eStr}${containerRef} a **${newValTr}**`;
        } else if (actionType.includes('user_ref') || actionType.includes('p_m')) {
            const targetUser = details.new_value_name || details.new_name || newValTr || 'un utente';
            description = `ha assegnato ${eStr}${containerRef} a **${targetUser}**`;
        } else if (actionType === 'appointment_participant_added') {
            const partName = details.participant_name || details.assignee_name || 'un partecipante';
            description = `ha aggiunto **${partName}** all'appuntamento ${eStr}${containerRef}`;
        } else if (actionType.includes('new_') || actionType.includes('created') || actionType === 'new_item') {
            description = `ha creato ${eStr}${containerRef}`;
        } else if (actionType.includes('deleted') || actionType.includes('removed')) {
            description = `ha rimosso ${eStr}${containerRef}`;
        } else if (actionType.includes('comment') || actionType === 'commento') {
            description = `ha commentato su ${eStr}${containerRef}`;
        } else if (actionType.includes('due_date')) {
            const dateStr = newValRaw ? new Date(newValRaw).toLocaleDateString('it-IT') : 'una nuova data';
            description = `ha cambiato la scadenza di ${eStr}${containerRef} al **${dateStr}**`;
        } else {
            description = `ha modificato ${eStr}${containerRef}`;
        }
    }

    // 5. Self-assignment detection
    if (log.actor_user_ref && (details.user_ref === log.actor_user_ref || details.new === log.actor_user_ref)) {
        description = description.replace(/ha assegnato \*\*(.*?)\*\*/g, 'si è assegnato');
    }

    // 6. Format Markdown to HTML
    const formattedDesc = description.replace(/\*\*(.*?)\*\*/g, '<span style="font-weight: 600; color: var(--text-primary, inherit);">$1</span>');

    return {
        actorName,
        formattedDesc,
        description,
        containerName,
        entityName,
        timeStr: log.created_at
    };
}
