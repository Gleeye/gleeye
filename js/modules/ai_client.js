// AI Client — Gleeye ERP
// Wrapper unificato per tutte le chiamate AI dell'app.
// Tutto passa dalla Edge Function `ai-proxy` che gestisce OpenRouter + log automatico in `ai_usage_log`.
//
// Filosofia: il resto dell'app NON deve sapere quale modello sta usando, né come funziona OpenRouter,
// né come si calcola il costo. Chiama `ai.chat()` o un helper, riceve risposta.
//
// Quando vorremo cambiare modello (es. da Gemini Flash a Claude Sonnet per Documentation Generator),
// si cambia solo la stringa `model` qui o nella feature, niente refactor.

import { supabase } from './config.js?v=8000';

// Modelli scelti per ogni feature (centralized config)
// Quando vuoi cambiare modello per una feature, cambi solo qui.
export const AI_MODELS = {
    // Default: Gemini Flash 2.5 Lite — economico, veloce, ideale per UI conversational
    default: 'google/gemini-2.5-flash-lite',

    // Cmd+K palette: chiamate frequenti, basso volume → modello economico veloce
    cmd_k: 'google/gemini-2.5-flash-lite',

    // Help inline contestuale: piccole spiegazioni → modello economico
    help_inline: 'google/gemini-2.5-flash-lite',

    // Document generator (SAP): output strutturato lungo → modello migliore
    doc_generator: 'anthropic/claude-sonnet-4.5',

    // Pricing Intelligence: analisi dati interni → Gemini Flash 2.5 Lite economico
    pricing_ai: 'google/gemini-2.5-flash-lite',

    // Sales drafter (email outreach): qualità testo → modello migliore
    sales_drafter: 'anthropic/claude-sonnet-4.5',

    // Brief operativo collab: medio-economico
    brief_drafter: 'google/gemini-2.5-flash',
};

/**
 * Chiamata AI generica.
 *
 * @param {Object} options
 * @param {string} options.feature - Nome funzionale della feature (es. 'cmd_k', 'doc_generator'). Obbligatorio per il logging.
 * @param {Array} options.messages - Array di messaggi nel formato OpenAI/OpenRouter [{role, content}, ...]
 * @param {string} [options.model] - Identificatore modello su OpenRouter. Se omesso, usa AI_MODELS[feature] o AI_MODELS.default.
 * @param {Array} [options.tools] - Tool definitions per function calling.
 * @param {string|Object} [options.tool_choice] - Forzatura tool specifico.
 * @param {number} [options.temperature] - Default modello.
 * @param {number} [options.max_tokens] - Default modello.
 * @param {Object} [options.response_format] - es. {type: 'json_object'} per output JSON garantito.
 * @param {Object} [options.feature_context] - Contesto specifico salvato nel log (es. {entity_type:'pm_item', entity_id:'uuid'}).
 * @param {Object} [options.metadata] - Metadata libera per il log.
 * @param {string} [options.parent_request_id] - Per chiamate concatenate (agenti).
 *
 * @returns {Promise<Object>} Response OpenRouter (compatibile OpenAI chat completions): {id, choices:[{message:{...}}], usage:{...}}
 */
export async function chat({ feature, model, messages, tools, tool_choice, temperature, max_tokens, response_format, feature_context, metadata, parent_request_id }) {
    if (!feature) throw new Error('ai.chat(): `feature` è obbligatorio per il logging');
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('ai.chat(): `messages` deve essere un array non vuoto');

    const finalModel = model || AI_MODELS[feature] || AI_MODELS.default;

    const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: {
            feature,
            model: finalModel,
            messages,
            tools,
            tool_choice,
            temperature,
            max_tokens,
            response_format,
            feature_context,
            metadata,
            parent_request_id,
        },
    });

    if (error) {
        console.error('[ai_client] supabase.functions.invoke error', error);
        throw new Error(`AI proxy error: ${error.message || error}`);
    }

    if (data?.error) {
        console.error('[ai_client] AI proxy returned error', data);
        throw new Error(`AI call failed: ${data.message || data.error}`);
    }

    return data;
}

/**
 * Helper: estrazione testo dalla risposta (per uso generico, senza tool calling).
 */
export function extractText(response) {
    return response?.choices?.[0]?.message?.content ?? '';
}

/**
 * Helper: estrazione tool calls dalla risposta (per function calling).
 */
export function extractToolCalls(response) {
    return response?.choices?.[0]?.message?.tool_calls ?? [];
}

/**
 * Helper rapido per completamento testo "una shot".
 * @param {string} prompt - Il prompt utente.
 * @param {Object} [opts] - { feature?, model?, system? }
 * @returns {Promise<string>} Testo della risposta.
 */
export async function complete(prompt, opts = {}) {
    const feature = opts.feature || 'generic_complete';
    const messages = [];
    if (opts.system) messages.push({ role: 'system', content: opts.system });
    messages.push({ role: 'user', content: prompt });
    const resp = await chat({ feature, model: opts.model, messages, temperature: opts.temperature, max_tokens: opts.max_tokens });
    return extractText(resp);
}

/**
 * Helper: chiamata con output JSON strutturato garantito.
 * @param {string} prompt - Il prompt utente.
 * @param {Object} schema - Schema atteso (descrittivo, non strict JSON Schema).
 * @param {Object} [opts] - { feature?, model?, system? }
 * @returns {Promise<Object>} JSON parsato.
 */
export async function completeJSON(prompt, schema, opts = {}) {
    const feature = opts.feature || 'generic_json';
    const messages = [];
    const systemMsg = opts.system
        ? `${opts.system}\n\nRispondi SOLO in JSON valido con questa struttura: ${JSON.stringify(schema)}`
        : `Rispondi SOLO in JSON valido con questa struttura: ${JSON.stringify(schema)}`;
    messages.push({ role: 'system', content: systemMsg });
    messages.push({ role: 'user', content: prompt });

    const resp = await chat({
        feature,
        model: opts.model,
        messages,
        temperature: opts.temperature ?? 0.3,
        response_format: { type: 'json_object' },
    });
    const text = extractText(resp);
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error('[ai_client] JSON parse error', e, '\nRaw:', text);
        throw new Error(`AI response non era JSON valido: ${text.substring(0, 200)}...`);
    }
}

// API namespace per uso comodo: `ai.chat(...)`, `ai.complete(...)`, ecc.
export const ai = {
    chat,
    complete,
    completeJSON,
    extractText,
    extractToolCalls,
    MODELS: AI_MODELS,
};

// Espongo anche su window per uso da inline handler / debugging
if (typeof window !== 'undefined') {
    window.ai = ai;
}
