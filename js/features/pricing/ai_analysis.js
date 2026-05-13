/**
 * pricing/ai_analysis.js
 * 5 funzioni di analisi AI per Pricing Intelligence.
 * Ogni funzione: verifica cache (24h) → genera analisi → salva run.
 */

import { chat, AI_MODELS } from '../../modules/ai_client.js?v=8000';
import {
    fetchOrdersDataset, fetchServicesDataset, fetchLastRun, saveRun,
    aggregateWinLoss, aggregateMargins, aggregateSensitivity,
    aggregatePricingSuggestions, aggregateLostDeals,
} from './data.js?v=8000';

const MODEL = AI_MODELS.pricing_ai;
const CACHE_HOURS = 24;

function isCacheValid(run) {
    if (!run) return false;
    const age = (Date.now() - new Date(run.created_at)) / 3600000;
    return age < CACHE_HOURS;
}

async function runAnalysis({ analysisType, buildMessages, parseResult }) {
    const cached = await fetchLastRun(analysisType);
    if (isCacheValid(cached)) return { ...cached.result_json, _cached: true, _cached_at: cached.created_at };

    let runId;
    try {
        const messages = await buildMessages();
        const resp = await chat({
            feature: 'pricing_ai',
            model:   MODEL,
            messages,
            max_tokens: 1500,
            temperature: 0.3,
        });

        const raw = resp.choices?.[0]?.message?.content || '';
        const result = parseResult(raw);
        const tokens = resp.usage?.total_tokens ?? null;

        await saveRun({ analysisType, status: 'done', resultJson: result, modelUsed: MODEL, tokensUsed: tokens });
        return result;
    } catch (err) {
        await saveRun({ analysisType, status: 'error', errorMessage: err.message }).catch(() => {});
        throw err;
    }
}

// ─── Fase 1: Win/Loss Analysis ────────────────────────────────────────────

export async function analyzeWinLoss() {
    return runAnalysis({
        analysisType: 'win_loss',
        buildMessages: async () => {
            const orders = await fetchOrdersDataset();
            const stats = aggregateWinLoss(orders);
            return [{
                role: 'user',
                content: `Sei un consulente commerciale esperto di agenzie di comunicazione italiane.

Analizza questi dati Win/Loss di Gleeye, agenzia di comunicazione a Genova:

DATI AGGREGATI:
- Ordini totali (accettati+rifiutati): ${stats.accepted + stats.rejected}
- Accettati: ${stats.accepted} (${stats.win_rate}% win rate)
- Rifiutati: ${stats.rejected}
- Prezzo medio accettati: €${stats.avg_price_accepted}
- Prezzo medio rifiutati: €${stats.avg_price_rejected}
- Fatturato da accettati: €${stats.revenue_accepted}
- Fatturato perso su rifiutati: €${stats.revenue_rejected}

PER CATEGORIA:
${stats.by_category.map(c =>
    `- ${c.category}: ${c.accepted} vinte / ${c.rejected} perse → ${c.win_rate}% win rate | Prezzo medio vinte: €${c.avg_price_won} | Prezzo medio perse: €${c.avg_price_lost}`
).join('\n')}

Nota: le categorie sono inferite dal titolo dell'ordine, quindi "Altro" include ordini con titolo generico.

Fornisci un'analisi concisa (max 300 parole) con:
1. GIUDIZIO GENERALE: interpretazione del win rate globale nel contesto agenzie italiane
2. PATTERN CHIAVE: 2-3 insight specifici dai dati per categoria
3. AREE DI ATTENZIONE: categorie dove il win rate suggerisce problema di pricing o posizionamento
4. RACCOMANDAZIONE IMMEDIATA: 1 azione concreta che Gleeye può fare subito`
            }];
        },
        parseResult: raw => ({ narrative: raw }),
    });
}

// ─── Fase 2: Margin Calibration ───────────────────────────────────────────

export async function analyzeMargins() {
    return runAnalysis({
        analysisType: 'margin',
        buildMessages: async () => {
            const orders = await fetchOrdersDataset();
            const stats = aggregateMargins(orders);
            return [{
                role: 'user',
                content: `Sei un consulente finanziario esperto di agenzie creative italiane.

Analizza la marginalità di Gleeye, agenzia di comunicazione a Genova:

MARGINALITÀ COMPLESSIVA (su ordini accettati con dati prezzo/costo):
- Ordini analizzati: ${stats.orders.length}
- Fatturato totale: €${stats.total_revenue}
- Costo totale: €${stats.total_cost}
- Margine totale: €${stats.total_margin}
- Margine medio: ${stats.avg_margin_pct}%

PER CATEGORIA (margine %):
${stats.by_category.map(c =>
    `- ${c.category}: ${c.margin_pct}% margine su €${c.revenue} fatturato (${c.count} ordini)`
).join('\n')}

OUTLIER (ordini con margine sotto 20%):
${stats.orders.filter(o => o.margin_pct < 20 && o.price > 0).slice(0, 5).map(o =>
    `- "${o.title}" | €${o.price} | margine ${o.margin_pct}%`
).join('\n') || 'Nessuno'}

Fornisci analisi concisa (max 300 parole) con:
1. SALUTE FINANZIARIA: interpretazione del margine medio nel contesto agenzie italiane (benchmark 35-55%)
2. CATEGORIE CRITICHE: quali categorie rischiano di essere non sostenibili
3. PRICING vs COSTO: il problema è sotto-prezzo o sovra-costo?
4. RACCOMANDAZIONE: 1 intervento prioritario sulla struttura dei costi o prezzi`
            }];
        },
        parseResult: raw => ({ narrative: raw }),
    });
}

// ─── Fase 3: Sensitivity Analysis ────────────────────────────────────────

export async function analyzeSensitivity() {
    return runAnalysis({
        analysisType: 'sensitivity',
        buildMessages: async () => {
            const orders = await fetchOrdersDataset();
            const stats = aggregateSensitivity(orders);
            return [{
                role: 'user',
                content: `Sei un pricing analyst esperto. Analizza l'elasticità al prezzo di Gleeye, agenzia di comunicazione genovese.

DATI DI SENSITIVITY PER CATEGORIA:
${stats.map(s =>
    `- ${s.category}: win rate attuale ${s.win_rate}% | prezzo medio vinte €${s.avg_price_won} | prezzo medio perse €${s.avg_price_lost ?? 'N/D'} | headroom stimato +${s.headroom_pct}%`
).join('\n')}

SIMULAZIONE +10% PREZZO (stima impatto win rate):
${stats.map(s =>
    `- ${s.category}: da ${s.win_rate}% → ~${s.estimated_new_win_rate}% | recupero unitario stimato: €${s.sim_increase_10} per ordine`
).join('\n')}

Fornisci analisi concisa (max 300 parole) con:
1. CATEGORIE SICURE: dove aumentare i prezzi del 10-15% con basso rischio
2. CATEGORIE RISCHIOSE: dove il pricing è già al limite
3. LOGICA CAVEATS: ricorda che "rifiutata" non sempre = "troppo caro" (può essere timing, fit, scope)
4. SCENARIO OTTIMISTICO: se Gleeye alzasse selettivamente del 10% le 2 categorie più safe, stima impatto annuo`
            }];
        },
        parseResult: raw => ({ narrative: raw }),
    });
}

// ─── Fase 4: Suggerimento prezzi ottimali ────────────────────────────────

export async function analyzePricingSuggestions() {
    return runAnalysis({
        analysisType: 'suggestions',
        buildMessages: async () => {
            const [orders, services] = await Promise.all([fetchOrdersDataset(), fetchServicesDataset()]);
            const suggestions = aggregatePricingSuggestions(orders, services);
            const toRevise = suggestions.filter(s => s.delta_pct !== 0).slice(0, 10);
            const stable = suggestions.filter(s => s.delta_pct === 0).slice(0, 5);

            return [{
                role: 'user',
                content: `Sei un consulente di pricing per agenzie creative italiane.

Gleeye ha un tariffario di ${services.length} servizi. Basandomi su dati storici win/loss e margini, ho identificato questi aggiustamenti:

SERVIZI DA RIVEDERE (top 10 per impatto):
${toRevise.map(s =>
    `- "${s.name}" (${s.category}): €${s.current_price} → €${s.suggested_price} (+${s.delta_pct}%) | margine attuale ${s.current_margin_pct}% | ${s.rationale}`
).join('\n')}

SERVIZI STABILI (campione):
${stable.map(s => `- "${s.name}": €${s.current_price} (nessuna variazione raccomandata)`).join('\n')}

Fornisci raccomandazioni concise (max 400 parole) con:
1. PRIORITÀ IMMEDIATA: top 3 prezzi da aggiornare subito e perché
2. APPROCCIO: come comunicare l'aumento ai clienti (nuovi vs storici)
3. QUICK WIN: il singolo cambiamento con maggiore impatto su revenue annua
4. CAUTELE: cosa non fare (alzare tutto, comunicarlo male, ecc.)
5. NOTE: sottolinea che i suggerimenti si basano su dati interni senza benchmark mercato esterno`
            }];
        },
        parseResult: raw => ({ narrative: raw }),
    });
}

// ─── Fase 5: Lost Deal Recovery ───────────────────────────────────────────

export async function analyzeLostDeals() {
    return runAnalysis({
        analysisType: 'lost_deal',
        buildMessages: async () => {
            const orders = await fetchOrdersDataset();
            const deals = aggregateLostDeals(orders);

            return [{
                role: 'user',
                content: `Sei un sales coach esperto nel recupero di trattative perse per agenzie di comunicazione italiane.

Gleeye ha ${deals.length} offerte rifiutate negli ultimi 6 mesi:

${deals.slice(0, 10).map(d =>
    `- "${d.title}" | Cliente: ${d.client_name} | €${d.price} | Categoria: ${d.category} | ${d.days_ago} giorni fa`
).join('\n')}${deals.length > 10 ? `\n... e altri ${deals.length - 10} ordini.` : ''}

VALORE TOTALE POTENZIALMENTE RECUPERABILE: €${deals.reduce((s, d) => s + d.price, 0).toLocaleString('it-IT')}

Fornisci un piano di recovery conciso (max 400 parole) con:
1. PRIORITÀ: quali 3 deal vale più la pena re-approciare (per valore + tempistica)
2. TEMPLATE EMAIL: bozza email di re-engagement professionale e non invasiva (in italiano, max 5 righe + oggetto) applicabile ai top deal
3. TIMING: il momento migliore per contattare (stagionalità, cicli di budget)
4. ANGOLO: come proporre un'offerta rivista senza sembrare disperati
5. REALISMO: stima recovery rate realistico (25-30%) e valore potenziale recuperabile`
            }];
        },
        parseResult: raw => ({ narrative: raw }),
    });
}

// ─── helper per UI: carica tutti i dataset statici ───────────────────────

export async function loadAllStaticData() {
    const [orders, services] = await Promise.all([fetchOrdersDataset(), fetchServicesDataset()]);
    return {
        orders,
        services,
        winLoss:     aggregateWinLoss(orders),
        margins:     aggregateMargins(orders),
        sensitivity: aggregateSensitivity(orders),
        suggestions: aggregatePricingSuggestions(orders, services),
        lostDeals:   aggregateLostDeals(orders),
    };
}
