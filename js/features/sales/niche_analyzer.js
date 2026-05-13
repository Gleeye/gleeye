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
 * @param {object} [sector] - opzionale: oggetto industry_sector (slug, name, description) per contestualizzare
 * @returns {Promise<object>} risultato strutturato
 */
export async function analyzeNiche(nicheName, sector) {
    if (!nicheName || !nicheName.trim()) throw new Error('Nome nicchia mancante');

    const sapCatalog = await fetchSapCatalogForAnalysis(sector);

    const prompt = buildPrompt(nicheName, sapCatalog, sector);
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
            'Sii concreto MA dichiara incertezze: per le stime numeriche (market size, n. aziende), preferisci range piuttosto che numeri puntuali. Il verdict dei criteri sii prudente — meglio false con rationale onesto che true allucinato. ' +
            'Il geo_scope deve essere granulare (singoli comuni/città) per permettere sourcing iterativo. ' +
            'I SAP candidati devono pescare SOLO dal catalogo fornito (mai inventare SAP che non ci sono). ' +
            'Rispondi SOLO in JSON valido.',
    });

    const normalized = normalizeResult(result, sapCatalog);

    // Verifica numerica via Perplexity (web search) sulle claim quantitative.
    // Non rigenera l'analisi: arricchisce con dati verificati + fonti.
    try {
        const verification = await verifyMarketDataWithPerplexity(nicheName, sector, normalized);
        if (verification) {
            normalized.market_data_verified = verification;
            // Se la verifica conferma o aggiusta il market size, lo riflettiamo nel campo principale.
            if (verification.verified_market_size && verification.verified_market_size_text) {
                normalized.market_size_estimate = verification.verified_market_size_text + (verification.sources?.length ? ' [fonti web verificate]' : '');
            }
        }
    } catch (err) {
        console.warn('[NicheAnalyzer] verification failed (proseguo con dati Gemini)', err);
        normalized.warnings = [...(normalized.warnings || []), 'Verifica web (Perplexity) non disponibile: dati Gemini non confermati esternamente.'];
    }

    return normalized;
}

/**
 * Verifica con Perplexity (web search) le claim numeriche della prima passata.
 * NON rifa tutta l'analisi: solo controlla dimensione mercato + criterio "size" (8-100K realtà).
 * Costo: ~0.3 centesimi a verifica.
 */
async function verifyMarketDataWithPerplexity(nicheName, sector, analysis) {
    const sizeRationale = analysis.criteria_validation?.size?.rationale || '';
    const marketEstimate = analysis.market_size_estimate || '';

    const prompt =
        'Verifica con fonti reali (ISTAT, Camere di Commercio, registri di settore, news verificabili) i dati seguenti sulla nicchia di mercato italiana "' + nicheName + '"' +
        (sector ? ' (settore: ' + sector.name + ')' : '') + ':\n\n' +
        '1. CLAIM DIMENSIONE MERCATO: "' + marketEstimate + '"\n' +
        '2. CRITERIO SIZE (≥8K realtà raggiungibili): rationale="' + sizeRationale + '"\n\n' +
        'Ricerca dati pubblici reali e rispondi in JSON:\n' +
        '{\n' +
        '  "verified_market_size": <numero|null>,         // n. realtà stimato verificato\n' +
        '  "verified_market_size_text": "<testo>",         // es. "~2.300 strutture ricettive in Liguria (ISTAT 2024), 32K nazionale"\n' +
        '  "size_criterion_met": <true|false|null>,        // verdict finale: la nicchia ha ≥8K realtà raggiungibili?\n' +
        '  "confidence": "alta|media|bassa",\n' +
        '  "sources": [{"title":"","url":"","note":""}],   // 2-5 fonti reali\n' +
        '  "discrepancies": "<testo>"                       // dove le claim AI iniziali erano sbagliate (se lo erano)\n' +
        '}\n\n' +
        'Solo JSON. Niente testo extra.';

    const schema = {
        verified_market_size: 0,
        verified_market_size_text: 'string',
        size_criterion_met: true,
        confidence: 'string',
        sources: [{ title: 'string', url: 'string', note: 'string' }],
        discrepancies: 'string',
    };

    const result = await completeJSON(prompt, schema, {
        feature: 'sales_niche_verify',
        model: 'perplexity/sonar', // web search incluso
        system: 'Sei un analista di mercato che verifica dati con fonti pubbliche reali (ISTAT, Camera di Commercio, registri settoriali, dati istituzionali italiani). Rispondi SOLO in JSON valido. Se non trovi dati affidabili, dichiaralo con confidence=bassa e sources=[].',
    });

    return result;
}

/**
 * Salva il risultato dell'analisi nella nicchia + popola niche_sap_relevance.
 *
 * IMPORTANTE: geo_scope viene scritto SOLO se attualmente è vuoto.
 * Una volta che Davide lo ha curato manualmente, la rianalisi non lo sovrascrive.
 */
export async function saveNicheAnalysis(nicheId, analysis) {
    // 0. Leggi geo_scope corrente per decidere se sovrascriverlo o no
    const { data: currentNiche, error: curErr } = await supabase
        .from('outreach_niches')
        .select('geo_scope')
        .eq('id', nicheId)
        .single();
    if (curErr) throw curErr;

    const currentGeoScope = Array.isArray(currentNiche?.geo_scope) ? currentNiche.geo_scope : [];
    const shouldOverwriteGeo = currentGeoScope.length === 0;

    // 1. Update outreach_niches
    // I dati verificati Perplexity vanno in niche_language come chiave speciale __verified__
    // (è già un jsonb generico, evitiamo migration per un campo solo)
    const enrichedLanguage = { ...(analysis.niche_language || {}) };
    if (analysis.market_data_verified) {
        enrichedLanguage.__verified__ = analysis.market_data_verified;
    }

    const updatePayload = {
        description:          analysis.description || null,
        market_size_estimate: analysis.market_size_estimate || null,
        pain_points:          analysis.pain_points || [],
        niche_language:       enrichedLanguage,
        criteria_validation:  analysis.criteria_validation || {},
        analyzed_at:          new Date().toISOString(),
        analyzed_by_model:    MODEL + ' + perplexity-verify',
    };
    if (shouldOverwriteGeo) {
        updatePayload.geo_scope = analysis.geo_scope || [];
    }

    const { error: updErr } = await supabase
        .from('outreach_niches')
        .update(updatePayload)
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

async function fetchSapCatalogForAnalysis(sector) {
    let q = supabase
        .from('core_services')
        .select('id, name, description, value_proposition, target_customer, delivery_time_days, target_sectors')
        .order('name');
    const { data, error } = await q;
    if (error) throw error;
    let catalog = data || [];

    // Se è dato un settore, prioritizza i SAP che lo includono (o sono agnostici)
    if (sector && sector.slug) {
        catalog = catalog.filter(s => {
            const ts = Array.isArray(s.target_sectors) ? s.target_sectors : [];
            return ts.length === 0 || ts.includes(sector.slug);
        });
    }
    return catalog;
}

function buildPrompt(nicheName, sapCatalog, sector) {
    const lines = [
        'Analizza questa nicchia di mercato dal punto di vista di un\'agenzia di comunicazione genovese (Gleeye) che vuole acquisire clienti via outreach.',
        '',
        '## NICCHIA',
        nicheName,
        '',
    ];
    if (sector) {
        lines.push('## SETTORE DI MERCATO');
        lines.push('Slug: ' + sector.slug + ' · Nome: ' + sector.name);
        if (sector.description) lines.push('Descrizione: ' + sector.description);
        lines.push('');
        lines.push('USA il settore come contesto: pain points, linguaggio, KPI tipici, capacità di spesa devono essere coerenti col settore. I SAP candidati sono già filtrati per essere rilevanti al settore.');
        lines.push('');
    }

    lines.push('## OUTPUT RICHIESTO');
    lines.push('');
    lines.push('### 1. Descrizione (2-3 frasi)');
    lines.push('Chi sono questi clienti, cosa li caratterizza dal punto di vista marketing/comunicazione.');
    lines.push('');
    lines.push('### 2. Geo scope (granulare)');
    lines.push('Lista di comuni/città/aree dove attaccare la nicchia, UNO PER UNO. Esempio per "Strutture ricettive Liguria": ["Genova","Albisola Superiore","Albisola Marina","Varazze","Bogliasco","Santa Margherita Ligure","Portofino","Rapallo","Sestri Levante","Camogli","Sanremo","Imperia","La Spezia","Lerici","Portovenere",...]. Includi i comuni più rilevanti, non solo 3-4.');
    lines.push('');
    lines.push('### 3. Stima dimensione mercato');
    lines.push('Numeri concreti su quante realtà esistono nel scope geografico indicato (anche stime approssimate dichiarate come tali).');
    lines.push('');
    lines.push('### 4. Pain points tipici (4-8)');
    lines.push('Frasi concrete dalla LORO prospettiva. Es: "Pago 18% di commissione a Booking.com per ogni prenotazione". Non parolaio marketing.');
    lines.push('');
    lines.push('### 5. Linguaggio della nicchia');
    lines.push('Termini specifici che la nicchia usa al posto di quelli generici. Es: per medici "pazienti" non "clienti", per ristoranti "coperti" non "clienti".');
    lines.push('');
    lines.push('### 6. Validazione 5 criteri Parozzi');
    lines.push('Per ognuno: verdict (true/false) + rationale concreta (1-2 frasi, con numeri se possibile).');
    lines.push('- growing: mercato in crescita o morente?');
    lines.push('- size: 8K-100K realtà raggiungibili nel scope geografico?');
    lines.push('- profitable: la nicchia ha margini sufficienti per pagare €3K-6K di servizi?');
    lines.push('- spends_high: sono abituati a investimenti €10K+ (macchinari, software, consulenze)?');
    lines.push('- reachable: raggiungibili via email/LinkedIn/Google Maps in modo scalabile?');
    lines.push('');
    lines.push('### 7. SAP candidati con angle di vendita');
    lines.push('Dal catalogo Gleeye sotto, scegli quali SAP sono RILEVANTI per questa nicchia (relevance_score 0-100). Per ogni SAP rilevante (score ≥40):');
    lines.push('- angle: come venderlo specificamente a QUESTA nicchia (linguaggio + esempi + leva emotiva)');
    lines.push('- pain_addressed: quale pain risolve');
    lines.push('- mock_oto_formula: esempio bozza "Aiuto [nicchia] a ottenere [risultato] in [tempo] attraverso [meccanismo] senza [dolore]"');
    lines.push('');
    lines.push('NON inventare SAP che non sono nel catalogo. Se nessun SAP è davvero pertinente, lista comunque i 2-3 più vicini con score basso e angle che spieghi i limiti.');
    lines.push('');
    lines.push('## CATALOGO SAP GLEEYE');

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
