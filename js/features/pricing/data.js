/**
 * pricing/data.js
 * Aggrega dati reali da DB per le 5 fasi di Pricing Intelligence.
 * Non modifica mai dati — solo SELECT.
 */

import { supabase } from '../../modules/config.js?v=8000';

// ─── helpers ────────────────────────────────────────────────────────────────

function safeNum(v) { return parseFloat(v) || 0; }

/**
 * Estrae categoria di servizio dal titolo ordine.
 * Semplice keyword matching — non perfetto, ma senza schema FK è tutto ciò che abbiamo.
 */
export function inferCategory(title = '') {
    const t = title.toLowerCase();
    if (/foto|fotograf|immagine|shoot/.test(t))       return 'Fotografia';
    if (/video|ripresa|regia|montaggio|film/.test(t)) return 'Video';
    if (/web|sito|wordpress|landing|ecommerce/.test(t)) return 'Web';
    if (/podcast|audio|intervista|radio/.test(t))     return 'Podcast';
    if (/grafica|graphic|design|logo|brand/.test(t))  return 'Grafica';
    if (/social|instagram|facebook|tiktok|linkedin/.test(t)) return 'Social';
    if (/copy|testo|articolo|contenuto|redazion/.test(t))    return 'Copywriting';
    if (/pr|relazion|stampa|comunicato|ufficio stampa/.test(t)) return 'PR';
    if (/evento|event|inauguraz|cerimoni/.test(t))    return 'Eventi';
    if (/istituzion|comunicazione|support/.test(t))   return 'Comunicazione';
    return 'Altro';
}

// ─── fetch completo ordini ────────────────────────────────────────────────

export async function fetchOrdersDataset() {
    const { data, error } = await supabase
        .from('orders')
        .select(`
            id, title, offer_status, created_at,
            price_final, cost_final,
            total_price, total_cost,
            client_id,
            clients!left(business_name)
        `)
        .not('offer_status', 'is', null)
        .order('created_at', { ascending: false });

    if (error) throw new Error(`fetchOrdersDataset: ${error.message}`);

    return (data || []).map(o => ({
        id:           o.id,
        title:        o.title || '',
        offer_status: o.offer_status,
        created_at:   o.created_at,
        price:        safeNum(o.price_final) || safeNum(o.total_price),
        cost:         safeNum(o.cost_final)  || safeNum(o.total_cost),
        client_name:  o.clients?.business_name || 'Cliente sconosciuto',
        category:     inferCategory(o.title),
    }));
}

// ─── fetch tariffario (services) ─────────────────────────────────────────

export async function fetchServicesDataset() {
    const { data, error } = await supabase
        .from('services')
        .select('id, name, price, cost, margin, margin_percent, type, tags')
        .order('name');

    if (error) throw new Error(`fetchServicesDataset: ${error.message}`);
    return data || [];
}

// ─── fetch ultimo run cached ──────────────────────────────────────────────

export async function fetchLastRun(analysisType) {
    const { data } = await supabase
        .from('pricing_analysis_runs')
        .select('id, created_at, result_json, status, model_used, tokens_used')
        .eq('analysis_type', analysisType)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    return data || null;
}

export async function saveRun({ analysisType, status, resultJson, modelUsed, tokensUsed, errorMessage }) {
    const { data, error } = await supabase
        .from('pricing_analysis_runs')
        .insert({
            analysis_type:  analysisType,
            status,
            result_json:    resultJson ?? null,
            model_used:     modelUsed ?? null,
            tokens_used:    tokensUsed ?? null,
            error_message:  errorMessage ?? null,
        })
        .select('id')
        .single();
    if (error) throw new Error(`saveRun: ${error.message}`);
    return data.id;
}

// ─── aggregazioni per fase ────────────────────────────────────────────────

/**
 * Fase 1 — Win/Loss
 * Tasso accettazione complessivo + per categoria servizio.
 */
export function aggregateWinLoss(orders) {
    const total = orders.length;
    const accepted   = orders.filter(o => o.offer_status === 'accettata');
    const rejected   = orders.filter(o => o.offer_status === 'rifiutata');
    const pending    = orders.filter(o => !['accettata','rifiutata'].includes(o.offer_status));

    const byCategory = {};
    for (const o of orders) {
        if (!['accettata','rifiutata'].includes(o.offer_status)) continue;
        const cat = o.category;
        if (!byCategory[cat]) byCategory[cat] = { accepted: 0, rejected: 0, total_price_accepted: 0, total_price_rejected: 0 };
        if (o.offer_status === 'accettata') {
            byCategory[cat].accepted++;
            byCategory[cat].total_price_accepted += o.price;
        } else {
            byCategory[cat].rejected++;
            byCategory[cat].total_price_rejected += o.price;
        }
    }

    const categoryStats = Object.entries(byCategory).map(([cat, v]) => {
        const tot = v.accepted + v.rejected;
        return {
            category:      cat,
            accepted:      v.accepted,
            rejected:      v.rejected,
            total:         tot,
            win_rate:      tot > 0 ? Math.round(v.accepted / tot * 100) : 0,
            avg_price_won: v.accepted > 0 ? Math.round(v.total_price_accepted / v.accepted) : 0,
            avg_price_lost:v.rejected > 0 ? Math.round(v.total_price_rejected / v.rejected) : 0,
        };
    }).sort((a, b) => b.total - a.total);

    const avgPriceAccepted = accepted.length ? Math.round(accepted.reduce((s, o) => s + o.price, 0) / accepted.length) : 0;
    const avgPriceRejected = rejected.length ? Math.round(rejected.reduce((s, o) => s + o.price, 0) / rejected.length) : 0;

    return {
        total,
        accepted:           accepted.length,
        rejected:           rejected.length,
        pending:            pending.length,
        win_rate:           total > 0 ? Math.round(accepted.length / (accepted.length + rejected.length) * 100) : 0,
        avg_price_accepted: avgPriceAccepted,
        avg_price_rejected: avgPriceRejected,
        revenue_accepted:   Math.round(accepted.reduce((s, o) => s + o.price, 0)),
        revenue_rejected:   Math.round(rejected.reduce((s, o) => s + o.price, 0)),
        by_category:        categoryStats,
    };
}

/**
 * Fase 2 — Margin Calibration
 * Margine per ordine e statistiche aggregate.
 */
export function aggregateMargins(orders) {
    const withData = orders
        .filter(o => o.price > 0 && o.offer_status === 'accettata')
        .map(o => ({
            ...o,
            margin:         Math.round(o.price - o.cost),
            margin_pct:     o.price > 0 ? Math.round((o.price - o.cost) / o.price * 100) : 0,
        }))
        .sort((a, b) => a.margin_pct - b.margin_pct);

    const total_revenue = withData.reduce((s, o) => s + o.price, 0);
    const total_cost    = withData.reduce((s, o) => s + o.cost, 0);
    const total_margin  = total_revenue - total_cost;
    const avg_margin_pct = total_revenue > 0 ? Math.round(total_margin / total_revenue * 100) : 0;

    const byCategory = {};
    for (const o of withData) {
        if (!byCategory[o.category]) byCategory[o.category] = { revenue: 0, cost: 0, count: 0 };
        byCategory[o.category].revenue += o.price;
        byCategory[o.category].cost    += o.cost;
        byCategory[o.category].count++;
    }

    const categoryMargins = Object.entries(byCategory).map(([cat, v]) => ({
        category:   cat,
        count:      v.count,
        revenue:    Math.round(v.revenue),
        cost:       Math.round(v.cost),
        margin:     Math.round(v.revenue - v.cost),
        margin_pct: v.revenue > 0 ? Math.round((v.revenue - v.cost) / v.revenue * 100) : 0,
    })).sort((a, b) => b.margin_pct - a.margin_pct);

    return {
        orders:           withData,
        total_revenue:    Math.round(total_revenue),
        total_cost:       Math.round(total_cost),
        total_margin:     Math.round(total_margin),
        avg_margin_pct,
        by_category:      categoryMargins,
    };
}

/**
 * Fase 3 — Sensitivity
 * Simulazione: se alzassi il prezzo del X%, quanti ordini aggiuntivi rischierei di perdere?
 * Modello semplificato: elasticità stimata dalla differenza tra prezzi vinti vs persi per categoria.
 */
export function aggregateSensitivity(orders) {
    const byCategory = {};
    for (const o of orders) {
        if (!['accettata','rifiutata'].includes(o.offer_status) || o.price === 0) continue;
        const cat = o.category;
        if (!byCategory[cat]) byCategory[cat] = { won: [], lost: [] };
        if (o.offer_status === 'accettata') byCategory[cat].won.push(o.price);
        else byCategory[cat].lost.push(o.price);
    }

    return Object.entries(byCategory)
        .filter(([, v]) => v.won.length > 0)
        .map(([category, v]) => {
            const avgWon  = v.won.reduce((s, p) => s + p, 0) / v.won.length;
            const avgLost = v.lost.length > 0 ? v.lost.reduce((s, p) => s + p, 0) / v.lost.length : null;
            const winRate = Math.round(v.won.length / (v.won.length + v.lost.length) * 100);

            // spazio di aumento: se avgLost > avgWon, c'è headroom
            const headroom_pct = avgLost !== null && avgLost > avgWon
                ? Math.round((avgLost - avgWon) / avgWon * 100)
                : 0;

            // simulazione +10%
            const sim_increase_10 = Math.round(avgWon * 0.1);
            const estimated_new_win_rate = Math.max(0, winRate - Math.round(headroom_pct > 10 ? 2 : 8));

            return {
                category,
                win_count:     v.won.length,
                lost_count:    v.lost.length,
                win_rate:      winRate,
                avg_price_won: Math.round(avgWon),
                avg_price_lost:avgLost !== null ? Math.round(avgLost) : null,
                headroom_pct,
                sim_increase_10,
                estimated_new_win_rate,
                recommendation: headroom_pct >= 15
                    ? 'Spazio di aumento significativo (+10-15% sicuro)'
                    : headroom_pct >= 5
                    ? 'Margine moderato (+5-10% con attenzione)'
                    : 'Già al limite — aumenti rischiano rifiuti',
            };
        })
        .sort((a, b) => b.headroom_pct - a.headroom_pct);
}

/**
 * Fase 4 — Suggerimento prezzi ottimali
 * Confronta tariffario corrente con performance storica degli ordini.
 */
export function aggregatePricingSuggestions(orders, services) {
    const winLoss = aggregateWinLoss(orders);
    const margins = aggregateMargins(orders);
    const sensitivity = aggregateSensitivity(orders);

    const sensitivityMap = Object.fromEntries(sensitivity.map(s => [s.category, s]));
    const marginMap = Object.fromEntries(margins.by_category.map(m => [m.category, m]));

    return services
        .filter(s => s.price > 0)
        .map(s => {
            const cat = inferCategory(s.name);
            const sens = sensitivityMap[cat];
            const marg = marginMap[cat];

            let suggested_price = s.price;
            let rationale = 'Nessun dato storico per questa categoria.';

            if (sens && sens.headroom_pct >= 10) {
                suggested_price = Math.round(s.price * 1.1);
                rationale = `Categoria "${cat}": headroom +${sens.headroom_pct}% dal confronto vinte/perse. Aumento +10% conservativo.`;
            } else if (sens && sens.headroom_pct >= 5) {
                suggested_price = Math.round(s.price * 1.05);
                rationale = `Categoria "${cat}": headroom moderato (+${sens.headroom_pct}%). Aumento +5% prudenziale.`;
            } else if (sens) {
                rationale = `Categoria "${cat}": prezzi già al livello ottimale (win rate ${sens.win_rate}%, headroom ${sens.headroom_pct}%).`;
            }

            const current_margin_pct = s.price > 0 ? Math.round((s.price - (s.cost || 0)) / s.price * 100) : 0;

            return {
                id:                  s.id,
                name:                s.name,
                type:                s.type,
                current_price:       s.price,
                current_cost:        s.cost || 0,
                current_margin_pct,
                suggested_price,
                delta_pct:           Math.round((suggested_price - s.price) / s.price * 100),
                rationale,
                category:            cat,
                historical_win_rate: sens?.win_rate ?? null,
            };
        })
        .sort((a, b) => b.delta_pct - a.delta_pct);
}

/**
 * Fase 5 — Lost Deal Recovery
 * Ordini rifiutati negli ultimi 6 mesi con dati per email di follow-up.
 */
export function aggregateLostDeals(orders) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    return orders
        .filter(o => o.offer_status === 'rifiutata' && new Date(o.created_at) >= sixMonthsAgo)
        .map(o => ({
            id:          o.id,
            title:       o.title,
            client_name: o.client_name,
            price:       o.price,
            category:    o.category,
            created_at:  o.created_at,
            days_ago:    Math.floor((Date.now() - new Date(o.created_at)) / 86400000),
        }))
        .sort((a, b) => b.price - a.price);
}
