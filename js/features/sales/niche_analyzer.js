/**
 * sales/niche_analyzer.js
 * Agent AI che analizza una nicchia partendo dal solo nome.
 * Genera: descrizione, validazione 5 criteri Parozzi, geo_scope suggerito,
 * market_size_estimate, pain_points, niche_language, SAP candidati con score.
 *
 * Modello: AI_MODELS.sales_drafter (= google/gemini-2.5-flash-lite).
 * NON modificare il modello AI globale.
 */

import { completeJSON, AI_MODELS } from '../../modules/ai_client.js?v=8000';
import { supabase } from '../../modules/config.js?v=8000';

const MODEL = AI_MODELS.sales_drafter;

// 5 criteri Parozzi (rimosso "Interesse personale minimo" — non si applica a un'agenzia)
const PAROZZI_CRITERIA = [
    { key: 'growing',     label: 'Mercato in crescita (non morente)' },
    { key: 'size',        label: 'Almeno 8.000-10.000 realtà raggiungibili' },
    { key: 'profitable',  label: 'Profittevole (margini, non solo fatturato)' },
    { key: 'spends_high', label: 'Abituati a spendere cifre importanti' },
    { key: 'reachable',   label: 'Raggiungibile sistematicamente via canali scalabili' },
];

/**
 * Analizza una nicchia con AI.
 * @param {string} nicheName - es. "Strutture ricettive Liguria"
 * @returns {Promise<object>} risultato strutturato
 */
export async function analyzeNiche(nicheName) {
    if (!nicheName || !nicheName.trim()) throw new Error('Nome nicchia mancante');

    const sapCatalog = await fetchSapCatalogForAnalysis();

    const prompt = buildPrompt(nicheName, sapCatalog);
    const schema = {
        description: 'string — descrizione strategica della nicchia in 2-3 frasi',
        geo_scope: ['string — lista comuni/città/aree target da attaccare uno alla volta nel sourcing'],
        market_size_estimate: 'string — stima dimensione mercato (es. "~2.500 strutture ricettive in Liguria, 12K nazionale")',
        pain_points: ['string — pain point tipici della nicchia, frasi concrete dalla loro prospettiva'],
        niche_language: { example_term: 'spiegazione del termine specifico della nicchia' },
        criteria_validation: {
            growing:     { verdict: true, rationale: 'string' },
            size:        { verdict: true, rationale: 'string' },
            profitable:  { verdict: true, rationale: 'string' },
            spends_high: { verdict: true, rationale: 'string' },
            reachable:   { verdict: true, rationale: 'string' },
        },
        sap_candidates: [
            {
                sap_id: 'string — uuid del SAP dal catalogo fornito',
                sap_name: 'string',
                relevance_score: 0,
                angle: 'string — come venderlo specificamente a questa nicchia',
                pain_addressed: 'string — quale pain della nicchia risolve',
                mock_oto_formula: 'string — esempio bozza di OTO Formula',
            },
        ],
        warnings: ['string — eventuali avvertenze (es. "SAP poco documentati, suggerimenti limitati")'],
    };

    const result = await completeJSON(prompt, schema, {
        feature: 'sales_niche_analyzer',
        model: MODEL,
        system:
            'Sei un consulente di marketing B2B esperto del mercato italiano, specializzato in agenzie di comunicazione. ' +
            'Analizza nicchie di mercato applicando il framework Parozzi (5 criteri di validazione). ' +
            'L\'agenzia analizzata è Gleeye (Genova, comunicazione & marketing). ' +
            'Sii concreto, basa le stime su dati di settore noti, dichiara incertezze. ' +
            'Il geo_scope deve essere granulare (singoli comuni/città) per permettere sourcing iterativo. ' +
            'I SAP candidati devono pescare SOLO dal catalogo fornito (mai inventare SAP che non ci sono). ' +
            'Rispondi SOLO in JSON valido.',
    });

    return normalizeResult(result, sapCatalog);
}

/**
 * Salva il risultato dell'analisi nella nicchia + popola niche_sap_relevance.
 */
export async function saveNicheAnalysis(nicheId, analysis) {
    // 1. Update outreach_niches
    const { error: updErr } = await supabase
        .from('outreach_niches')
        .update({
            description:          analysis.description || null,
            geo_scope:            analysis.geo_scope || [],
            market_size_estimate: analysis.market_size_estimate || null,
            pain_points:          analysis.pain_points || [],
            niche_language:       analysis.niche_language || {},
            criteria_validation:  analysis.criteria_validation || {},
            analyzed_at:          new Date().toISOString(),
            analyzed_by_model:    MODEL,
        })
        .eq('id', nicheId);

    if (updErr) throw updErr;

    // 2. Wipe + insert niche_sap_relevance
    const { error: delErr } = await supabase
        .from('niche_sap_relevance')
        .delete()
        .eq('niche_id', nicheId);
    if (delErr) throw delErr;

    const candidates = (analysis.sap_candidates || []).filter(c => c.sap_id);
    if (candidates.length > 0) {
        const rows = candidates.map(c => ({
            niche_id:         nicheId,
            sap_id:           c.sap_id,
            relevance_score:  clamp(c.relevance_score, 0, 100),
            angle:            c.angle || null,
            pain_addressed:   c.pain_addressed || null,
            mock_oto_formula: c.mock_oto_formula || null,
            generated_by_ai:  true,
        }));
        const { error: insErr } = await supabase.from('niche_sap_relevance').insert(rows);
        if (insErr) throw insErr;
    }
}

export async function fetchNicheSapRelevance(nicheId) {
    const { data, error } = await supabase
        .from('niche_sap_relevance')
        .select(`*, sap:core_services(id, name)`)
        .eq('niche_id', nicheId)
        .order('relevance_score', { ascending: false });
    if (error) throw error;
    return data || [];
}

// ─── PRIVATE ──────────────────────────────────────────────────────────────────

async function fetchSapCatalogForAnalysis() {
    const { data, error } = await supabase
        .from('core_services')
        .select('id, name, description, value_proposition, target_customer, delivery_time_days')
        .order('name');
    if (error) throw error;
    return data || [];
}

function buildPrompt(nicheName, sapCatalog) {
    const lines = [
        'Analizza questa nicchia di mercato dal punto di vista di un\'agenzia di comunicazione genovese (Gleeye) che vuole acquisire clienti via outreach.',
        '',
        '## NICCHIA',
        nicheName,
        '',
        '## OUTPUT RICHIESTO',
        '',
        '### 1. Descrizione (2-3 frasi)',
        'Chi sono questi clienti, cosa li caratterizza dal punto di vista marketing/comunicazione.',
        '',
        '### 2. Geo scope (granulare)',
        'Lista di comuni/città/aree dove attaccare la nicchia, UNO PER UNO. Esempio per "Strutture ricettive Liguria": ["Genova","Albisola Superiore","Albisola Marina","Varazze","Bogliasco","Santa Margherita Ligure","Portofino","Rapallo","Sestri Levante","Camogli","Sanremo","Imperia","La Spezia","Lerici","Portovenere",...]. Includi i comuni più rilevanti, non solo 3-4.',
        '',
        '### 3. Stima dimensione mercato',
        'Numeri concreti su quante realtà esistono nel scope geografico indicato (anche stime approssimate dichiarate come tali).',
        '',
        '### 4. Pain points tipici (4-8)',
        'Frasi concrete dalla LORO prospettiva. Es: "Pago 18% di commissione a Booking.com per ogni prenotazione". Non parolaio marketing.',
        '',
        '### 5. Linguaggio della nicchia',
        'Termini specifici che la nicchia usa al posto di quelli generici. Es: per medici "pazienti" non "clienti", per ristoranti "coperti" non "clienti".',
        '',
        '### 6. Validazione 5 criteri Parozzi',
        'Per ognuno: verdict (true/false) + rationale concreta (1-2 frasi, con numeri se possibile).',
        '- growing: mercato in crescita o morente?',
        '- size: 8K-100K realtà raggiungibili nel scope geografico?',
        '- profitable: la nicchia ha margini sufficienti per pagare €3K-6K di servizi?',
        '- spends_high: sono abituati a investimenti €10K+ (macchinari, software, consulenze)?',
        '- reachable: raggiungibili via email/LinkedIn/Google Maps in modo scalabile?',
        '',
        '### 7. SAP candidati con angle di vendita',
        'Dal catalogo Gleeye sotto, scegli quali SAP sono RILEVANTI per questa nicchia (relevance_score 0-100). Per ogni SAP rilevante (score ≥40):',
        '- angle: come venderlo specificamente a QUESTA nicchia (linguaggio + esempi + leva emotiva)',
        '- pain_addressed: quale pain risolve',
        '- mock_oto_formula: esempio bozza "Aiuto [nicchia] a ottenere [risultato] in [tempo] attraverso [meccanismo] senza [dolore]"',
        '',
        'NON inventare SAP che non sono nel catalogo. Se nessun SAP è davvero pertinente, lista comunque i 2-3 più vicini con score basso e angle che spieghi i limiti.',
        '',
        '## CATALOGO SAP GLEEYE',
    ];

    if (sapCatalog.length === 0) {
        lines.push('Nessun SAP nel catalogo. Aggiungi warning: "Catalogo SAP vuoto, suggerimenti non possibili".');
    } else {
        sapCatalog.forEach(s => {
            lines.push('');
            lines.push('### SAP id=' + s.id);
            lines.push('- Nome: ' + s.name);
            if (s.description) lines.push('- Descrizione: ' + s.description.slice(0, 400));
            if (s.value_proposition) lines.push('- Value proposition: ' + s.value_proposition.slice(0, 300));
            if (s.target_customer) lines.push('- Cliente ideale: ' + s.target_customer.slice(0, 200));
            if (s.delivery_time_days) lines.push('- Delivery: ' + s.delivery_time_days + ' giorni');
        });
        lines.push('');
        lines.push('IMPORTANTE: i SAP del catalogo Gleeye sono poco documentati. Se mancano value_proposition/description, dichiaralo in `warnings` e fornisci suggerimenti limitati.');
    }

    return lines.join('\n');
}

function normalizeResult(result, sapCatalog) {
    // Sanity: assicura che i sap_id ritornati esistano nel catalogo
    const validSapIds = new Set(sapCatalog.map(s => s.id));
    if (result.sap_candidates) {
        result.sap_candidates = result.sap_candidates.filter(c => {
            if (!c.sap_id) return false;
            if (!validSapIds.has(c.sap_id)) {
                console.warn('[NicheAnalyzer] AI returned invalid sap_id', c.sap_id);
                return false;
            }
            return true;
        });
    }
    // Sanity geo_scope
    if (!Array.isArray(result.geo_scope)) result.geo_scope = [];
    if (!Array.isArray(result.pain_points)) result.pain_points = [];
    if (typeof result.niche_language !== 'object' || result.niche_language === null) {
        result.niche_language = {};
    }
    if (typeof result.criteria_validation !== 'object' || result.criteria_validation === null) {
        result.criteria_validation = {};
    }
    return result;
}

function clamp(n, min, max) {
    const v = Number(n);
    if (isNaN(v)) return min;
    return Math.max(min, Math.min(max, Math.round(v)));
}

export { PAROZZI_CRITERIA };
