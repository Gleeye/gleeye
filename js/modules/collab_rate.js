// Collab service rate — wrapper sopra la function SQL get_collaborator_service_rate.
// Restituisce la tariffa interna suggerita per (collaboratore, servizio) usando la
// fallback chain: manual_override > historical_last > service_template > unknown.
//
// Vedi migration `collaborator_service_rates` (DB) per dettagli.

import { supabase } from './config.js?v=8000';

/**
 * @param {string} collaboratorId
 * @param {string} serviceId
 * @returns {Promise<{unit_cost: number|null, source: 'manual_override'|'historical_last'|'service_template'|'unknown', sample_size: number} | null>}
 */
export async function getCollaboratorServiceRate(collaboratorId, serviceId) {
    if (!collaboratorId || !serviceId) return null;
    try {
        const { data, error } = await supabase.rpc('get_collaborator_service_rate', {
            p_collaborator_id: collaboratorId,
            p_service_id: serviceId
        });
        if (error) {
            console.warn('[collab_rate] RPC error:', error.message);
            return null;
        }
        if (!Array.isArray(data) || data.length === 0) return null;
        const row = data[0] || {};
        return {
            unit_cost: row.unit_cost !== null && row.unit_cost !== undefined ? Number(row.unit_cost) : null,
            source: row.source || 'unknown',
            sample_size: Number(row.sample_size || 0)
        };
    } catch (err) {
        console.warn('[collab_rate] unexpected error:', err);
        return null;
    }
}

/**
 * Etichetta human-readable della sorgente.
 */
export function rateSourceLabel(source) {
    switch (source) {
        case 'manual_override': return 'Tariffa fissata manualmente';
        case 'historical_last': return 'Ultima tariffa storica';
        case 'service_template': return 'Tariffa di listino';
        default: return 'Nessun dato storico';
    }
}

/**
 * Imposta manualmente la tariffa per (collab, servizio). Marca is_manual_override=true.
 * Da usare quando l'utente vuole "fissare" un prezzo personalizzato per quel collab.
 */
export async function setManualCollabRate(collaboratorId, serviceId, unitCost) {
    const { data, error } = await supabase
        .from('collaborator_service_rates')
        .upsert({
            collaborator_id: collaboratorId,
            service_id: serviceId,
            unit_cost: unitCost,
            is_manual_override: true,
            last_cost: unitCost,
            min_cost: unitCost,
            max_cost: unitCost,
            avg_cost: unitCost
        }, { onConflict: 'collaborator_id,service_id' });
    if (error) {
        console.warn('[collab_rate] setManual error:', error.message);
        return false;
    }
    return true;
}
