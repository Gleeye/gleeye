// CA-8 — AI suggest per bank orphan matching
// Usa Gemini Flash 2.5 via completeJSON

import { completeJSON } from '/js/modules/ai_client.js?v=8000';

const MODEL = 'google/gemini-2.5-flash';

/**
 * Chiede all'AI il match più probabile tra il movimento e i candidati.
 * @param {{ id: string, description: string, amount: number }} tx
 * @param {Array} candidates - fatture attive o passive filtrate ±5%
 * @param {boolean} isOutflow
 * @returns {Promise<{ bestMatchId: string|null, confidence: number, reason: string }>}
 */
export async function aiSuggestMatch(tx, candidates, isOutflow) {
    if (candidates.length === 0) {
        return { bestMatchId: null, confidence: 0, reason: 'Nessun candidato disponibile nell\'intervallo ±5%.' };
    }

    const candidateList = candidates.map((c, i) => {
        const counterpart = isOutflow
            ? (c.suppliers?.name || c.collaborators?.full_name || 'Sconosciuto')
            : (c.clients?.business_name || 'Sconosciuto');
        return `${i + 1}. ID=${c.id} | Fattura #${c.invoice_number || '?'} | ${counterpart} | ${Math.abs(Number(c.amount))} € | data: ${c.invoice_date || '?'}`;
    }).join('\n');

    const prompt = `Sei un assistente contabile italiano. Devi trovare la fattura che corrisponde a questo movimento bancario.

MOVIMENTO BANCARIO:
- Descrizione: "${tx.description}"
- Importo: ${tx.amount} € (${Number(tx.amount) < 0 ? 'uscita' : 'entrata'})

CANDIDATI (fatture ${isOutflow ? 'passive' : 'attive'} con importo entro ±5%):
${candidateList}

Analizza la descrizione del movimento e la contropartita delle fatture. Scegli il match più probabile.
Se nessuno è convincente, restituisci bestMatchId=null.`;

    const schema = {
        bestMatchId: 'ID della fattura candidata più probabile, o null se nessuna è convincente',
        confidence: 'percentuale da 0 a 100 di fiducia nel match',
        reason: 'spiegazione concisa in italiano (max 2 frasi) del perché hai scelto questo match',
    };

    return completeJSON(prompt, schema, {
        feature: 'bank_match',
        model: MODEL,
        system: 'Sei un assistente contabile esperto. Rispondi sempre in italiano. Analizza con attenzione descrizione e importi.',
        temperature: 0.2,
    });
}
