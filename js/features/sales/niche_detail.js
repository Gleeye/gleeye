/**
 * sales/niche_detail.js
 * Pagina detail di una nicchia (#sales-niche/:id).
 *
 * Layout strutturato:
 * - Header compatto: nome + settore + status + meta + azioni
 * - Tab bar: Panoramica AI | Prospect | Sequenze | KPI
 * - Ogni tab ha il suo contenuto strutturato
 *
 * NIENTE pagina-modal-espanso: layout pensato come pagina di lavoro.
 */

import { supabase } from '../../modules/config.js?v=8001';
import {
    fetchNiches, upsertNiche, deleteNiche,
    fetchProspectsByNiche, bulkDeleteProspects, upsertProspect,
    fetchIndustrySectors, fetchSequences, fetchSapServicesForSales,
} from './api.js?v=8001';
import { showGlobalAlert, showConfirm } from '../../modules/utils.js?v=8000';
import { analyzeNiche, saveNicheAnalysis, fetchNicheSapRelevance, PAROZZI_CRITERIA } from './niche_analyzer.js?v=8001';
import { openSourcingModal } from './sourcing.js?v=8002';
import { runLayer1AI, runLayer2AI, scrapeProspectSite } from './enrichment.js?v=8002';
import { openProspectModal } from './pipeline_board.js?v=8002';
import { buildLeanUpdatePayload, extractEnrichmentDataFromScrape } from './completeness.js?v=8002';
import { getSectorSchema } from './sector_schema_builder.js?v=8001';

const STATUS_CONFIG = {
    researching: { label: 'In ricerca',  color: '#f59e0b', icon: 'search' },
    active:      { label: 'Attiva',       color: '#10b981', icon: 'play_circle' },
    paused:      { label: 'In pausa',     color: '#6366f1', icon: 'pause_circle' },
    exhausted:   { label: 'Esaurita',     color: '#94a3b8', icon: 'check_circle' },
};

// Stato locale della pagina (filtri tab Prospect)
const _pageState = new WeakMap();

// ═══════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

export async function renderNicheDetail(container, nicheId) {
    container.innerHTML = loadingHTML('Caricamento nicchia…');

    try {
        const [niches, sequences] = await Promise.all([
            fetchNiches(),
            fetchSequences().catch(() => []),
        ]);
        const niche = niches.find(n => n.id === nicheId);
        if (!niche) {
            container.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-tertiary);">Nicchia non trovata. <a href="#sales-niches" style="color:var(--brand-blue);">Torna alla lista</a></div>';
            return;
        }

        const [relevance, prospects] = await Promise.all([
            fetchNicheSapRelevance(niche.id).catch(() => []),
            fetchProspectsByNiche(niche.id).catch(() => []),
        ]);

        // Stato iniziale della pagina (tab attivo + filtri prospect)
        const state = _pageState.get(container) || {
            activeTab: 'overview',
            filters: {
                search: '',
                sortBy: 'completeness',   // completeness | promising | alpha
                sortDir: 'desc',
                cities: [],               // ['Genova', 'Albisola'] empty = tutte
                minCompleteness: 0,
                minPromising: 0,
                status: 'all',            // all | sourced | in_pipeline
                // "ha-X" toggles
                has_email: false,
                has_phone: false,
                has_social: false,
                has_rating: false,
            },
        };
        _pageState.set(container, state);

        const ctx = { niche, relevance, prospects, sequences, container, state, onReload: () => renderNicheDetail(container, nicheId) };

        container.innerHTML = buildPageHTML(ctx);
        bindEvents(ctx);

    } catch (err) {
        console.error('[NicheDetail] render error', err);
        container.innerHTML = '<div style="padding:2rem;color:red;">Errore: ' + escHtml(err.message) + '</div>';
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// HTML
// ═══════════════════════════════════════════════════════════════════════════

function buildPageHTML(ctx) {
    return (
        '<div class="animate-fade-in" style="max-width:1280px;margin:0 auto;padding:1.25rem 1.5rem 2rem;">' +
            buildBreadcrumb() +
            buildHeader(ctx) +
            buildTabs(ctx) +
            '<div id="niche-tab-content">' +
                buildTabContent(ctx) +
            '</div>' +
        '</div>' +
        buildMoreMenuStyles()
    );
}

function buildBreadcrumb() {
    return (
        '<a href="#sales-niches" style="display:inline-flex;align-items:center;gap:4px;font-size:0.75rem;color:var(--text-secondary);text-decoration:none;margin-bottom:0.5rem;font-weight:600;">' +
            '<span class="material-icons-round" style="font-size:0.95rem;">arrow_back</span>Niche Research' +
        '</a>'
    );
}

function buildHeader(ctx) {
    const { niche, prospects } = ctx;
    const statusConf = STATUS_CONFIG[niche.status] || STATUS_CONFIG.researching;
    const total = prospects.length;
    const completi = prospects.filter(p => (p.completeness_score || 0) >= 60).length;
    const promettenti = prospects.filter(p => ((p.ai_enrichment_data || {}).promising_score || 0) >= 70).length;
    const inPipeline = prospects.filter(p => p.pipeline_stage && p.pipeline_stage !== 'sourced').length;

    return (
        '<div style="background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:16px;padding:1.1rem 1.4rem;margin-bottom:1rem;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">' +
                '<div style="flex:1;min-width:0;">' +
                    // Riga 1: nome + badge settore + badge status
                    '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:6px;">' +
                        '<h1 style="font-size:1.4rem;font-weight:800;font-family:var(--font-titles);color:var(--text-primary);margin:0;letter-spacing:-0.02em;">' + escHtml(niche.name) + '</h1>' +
                        (niche.sector
                            ? '<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;padding:3px 9px;border-radius:8px;background:#3b82f615;color:#3b82f6;font-weight:700;">' +
                                '<span class="material-icons-round" style="font-size:0.85rem;">' + (niche.sector.icon || 'category') + '</span>' + escHtml(niche.sector.name) +
                              '</span>'
                            : '<span style="font-size:0.7rem;padding:3px 9px;border-radius:8px;background:#f59e0b15;color:#f59e0b;font-weight:700;">⚠ Settore mancante</span>') +
                        '<span style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.7rem;padding:3px 9px;border-radius:8px;background:' + statusConf.color + '15;color:' + statusConf.color + ';font-weight:700;">' +
                            '<span class="material-icons-round" style="font-size:0.85rem;">' + statusConf.icon + '</span>' + statusConf.label +
                        '</span>' +
                    '</div>' +
                    // Riga 2: meta info compatta
                    '<div style="font-size:0.74rem;color:var(--text-tertiary);display:flex;gap:0.8rem;flex-wrap:wrap;">' +
                        (niche.analyzed_at
                            ? '<span><span class="material-icons-round" style="font-size:0.85rem;vertical-align:-2px;color:#8b5cf6;">auto_awesome</span> Analizzata AI ' + new Date(niche.analyzed_at).toLocaleDateString('it-IT') + '</span>'
                            : '<span style="color:#f59e0b;">⚠ Non ancora analizzata</span>') +
                        '<span>•</span><span><strong>' + total + '</strong> prospect</span>' +
                        '<span>•</span><span><strong style="color:#10b981;">' + completi + '</strong> completi</span>' +
                        '<span>•</span><span><strong style="color:#3b82f6;">' + promettenti + '</strong> promettenti</span>' +
                        '<span>•</span><span><strong>' + inPipeline + '</strong> in pipeline</span>' +
                    '</div>' +
                '</div>' +
                // Azioni
                '<div style="display:flex;gap:0.4rem;align-items:center;">' +
                    '<button id="btn-reanalyze-detail" style="padding:0.5rem 0.9rem;border-radius:10px;border:1px solid #8b5cf640;background:#8b5cf608;color:#8b5cf6;font-size:0.78rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:0.35rem;">' +
                        '<span class="material-icons-round" style="font-size:0.95rem;">auto_awesome</span>' + (niche.analyzed_at ? 'Rianalizza' : 'Analizza AI') +
                    '</button>' +
                    '<button id="btn-source-prospects" class="primary-btn" style="padding:0.5rem 0.9rem;border-radius:10px;font-size:0.78rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:0.35rem;">' +
                        '<span class="material-icons-round" style="font-size:0.95rem;">travel_explore</span>Cerca prospect' +
                    '</button>' +
                    // Menu "more" con elimina + edit status/note
                    '<div class="more-menu-wrap" style="position:relative;">' +
                        '<button id="btn-more-menu" style="padding:0.5rem 0.6rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-tertiary);color:var(--text-secondary);font-size:0.78rem;cursor:pointer;">⋮</button>' +
                        '<div id="more-menu-dropdown" style="display:none;position:absolute;top:calc(100% + 4px);right:0;background:var(--bg-primary);border:1px solid var(--glass-border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.15);min-width:200px;z-index:50;overflow:hidden;">' +
                            '<button class="mm-item" id="mm-edit-meta" style="display:block;width:100%;text-align:left;padding:0.55rem 0.85rem;border:none;background:none;font-size:0.8rem;cursor:pointer;color:var(--text-primary);">Modifica status / note</button>' +
                            '<button class="mm-item" id="mm-delete" style="display:block;width:100%;text-align:left;padding:0.55rem 0.85rem;border:none;background:none;font-size:0.8rem;cursor:pointer;color:#ef4444;border-top:1px solid var(--glass-border);">Elimina nicchia</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>'
    );
}

function buildTabs(ctx) {
    const tabs = [
        { key: 'overview',  label: 'Panoramica AI',     icon: 'psychology' },
        { key: 'prospects', label: 'Prospect',          icon: 'people',          badge: ctx.prospects.length },
        { key: 'sequences', label: 'Sequenze',          icon: 'forward_to_inbox', badge: ctx.sequences.filter(s => s.niche_id === ctx.niche.id).length },
        { key: 'kpi',       label: 'KPI',               icon: 'insights' },
    ];
    return (
        '<div style="display:flex;gap:2px;margin-bottom:1rem;border-bottom:1px solid var(--glass-border);overflow-x:auto;">' +
            tabs.map(t => {
                const active = ctx.state.activeTab === t.key;
                return (
                    '<button class="niche-tab" data-tab="' + t.key + '" style="padding:0.6rem 1rem;background:none;border:none;border-bottom:2px solid ' + (active ? 'var(--brand-blue)' : 'transparent') + ';color:' + (active ? 'var(--brand-blue)' : 'var(--text-secondary)') + ';font-size:0.82rem;font-weight:' + (active ? '700' : '600') + ';cursor:pointer;display:inline-flex;align-items:center;gap:0.35rem;white-space:nowrap;">' +
                        '<span class="material-icons-round" style="font-size:1rem;">' + t.icon + '</span>' +
                        t.label +
                        (t.badge != null ? '<span style="font-size:0.65rem;font-weight:800;background:' + (active ? 'var(--brand-blue)20' : 'var(--bg-tertiary)') + ';color:' + (active ? 'var(--brand-blue)' : 'var(--text-tertiary)') + ';padding:1px 6px;border-radius:6px;">' + t.badge + '</span>' : '') +
                    '</button>'
                );
            }).join('') +
        '</div>'
    );
}

function buildTabContent(ctx) {
    switch (ctx.state.activeTab) {
        case 'overview':  return buildOverviewTab(ctx);
        case 'prospects': return buildProspectsTab(ctx);
        case 'sequences': return buildSequencesTab(ctx);
        case 'kpi':       return buildKpiTab(ctx);
        default:          return buildOverviewTab(ctx);
    }
}

// ─── TAB: OVERVIEW (analisi AI nicchia) ──────────────────────────────────────

function buildOverviewTab(ctx) {
    const { niche, relevance } = ctx;
    if (!niche.analyzed_at) {
        return (
            '<div style="text-align:center;padding:3rem 2rem;border:2px dashed var(--glass-border);border-radius:14px;color:var(--text-tertiary);">' +
                '<span class="material-icons-round" style="font-size:3rem;opacity:0.4;display:block;margin-bottom:0.5rem;">psychology</span>' +
                '<div style="font-size:1rem;font-weight:700;color:var(--text-primary);margin-bottom:0.4rem;">Nicchia non ancora analizzata</div>' +
                '<div style="font-size:0.82rem;max-width:480px;margin:0 auto;">Clicca "Analizza AI" nell\'header per popolare descrizione, criteri, pain, comuni, SAP candidati. Costa pochi centesimi e dura 10-20 secondi.</div>' +
            '</div>'
        );
    }

    const validation = niche.criteria_validation || {};
    const painPoints = Array.isArray(niche.pain_points) ? niche.pain_points : [];
    const language = niche.niche_language || {};
    const verified = language.__verified__ || null;
    // language senza la chiave speciale (per la visualizzazione)
    const cleanLanguage = Object.fromEntries(Object.entries(language).filter(([k]) => k !== '__verified__'));
    const geoScope = Array.isArray(niche.geo_scope) ? niche.geo_scope : [];

    return (
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">' +
            // Card 1: descrizione + market size
            overviewCard('Descrizione + mercato', 'description',
                (niche.description ? '<div style="font-size:0.85rem;line-height:1.5;color:var(--text-primary);margin-bottom:0.75rem;">' + escHtml(niche.description) + '</div>' : '') +
                (niche.market_size_estimate ? '<div style="font-size:0.78rem;color:var(--text-secondary);padding:0.55rem 0.7rem;background:var(--bg-tertiary);border-radius:8px;"><strong>📊 Dimensione mercato:</strong> ' + escHtml(niche.market_size_estimate) + '</div>' : '')
            ) +
            // Card 1b: dati verificati con fonti (Perplexity web search)
            (verified ? buildVerifiedDataCard(verified) : '') +
            // Card 2: criteri Parozzi
            overviewCard('Validazione 5 criteri', 'fact_check', buildCriteriaCompact(validation)) +
            // Card 3: pain (full width)
            (painPoints.length > 0
                ? '<div style="grid-column:1/-1;">' + overviewCard('Pain points (' + painPoints.length + ')', 'warning_amber',
                    '<ul style="margin:0;padding-left:1.2rem;font-size:0.82rem;color:var(--text-primary);line-height:1.6;">' +
                        painPoints.map(p => '<li style="margin-bottom:4px;">' + escHtml(p) + '</li>').join('') +
                    '</ul>'
                  ) + '</div>'
                : '') +
            // Card 4: linguaggio (cleanLanguage = senza chiave __verified__)
            (Object.keys(cleanLanguage).length > 0
                ? overviewCard('Linguaggio nicchia', 'translate', buildLanguageCompact(cleanLanguage))
                : '') +
            // Card 5: località target
            (geoScope.length > 0
                ? overviewCard('Località target (' + geoScope.length + ')', 'place',
                    '<div style="display:flex;flex-wrap:wrap;gap:4px;">' +
                        geoScope.map(c => '<span style="font-size:0.72rem;padding:3px 8px;border-radius:6px;background:#3b82f615;color:#3b82f6;font-weight:600;">' + escHtml(c) + '</span>').join('') +
                    '</div>'
                  )
                : '') +
            // Card 5b: search keywords AI-suggested
            (Array.isArray(niche.search_keywords) && niche.search_keywords.length > 0
                ? overviewCard('Keyword di sourcing (' + niche.search_keywords.length + ')', 'search',
                    '<div style="display:flex;flex-wrap:wrap;gap:4px;">' +
                        niche.search_keywords.map(k => '<span style="font-size:0.72rem;padding:3px 8px;border-radius:6px;background:#10b98115;color:#10b981;font-weight:600;">' + escHtml(k) + '</span>').join('') +
                    '</div>' +
                    '<div style="font-size:0.72rem;color:var(--text-tertiary);margin-top:0.5rem;">Usate dal sourcing OSM (combo keyword × località). Aggiungi/edita lanciando "Cerca prospect".</div>'
                  )
                : '') +

            // Card 6: SAP candidati (full width)
            (relevance.length > 0
                ? '<div style="grid-column:1/-1;">' + overviewCard('SAP candidati (' + relevance.length + ')', 'campaign', buildSapCandidatesCompact(relevance)) + '</div>'
                : '') +
        '</div>'
    );
}

function overviewCard(title, icon, content) {
    return (
        '<div style="background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:14px;padding:1rem 1.1rem;">' +
            '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.6rem;">' +
                '<span class="material-icons-round" style="font-size:1rem;color:var(--brand-blue);">' + icon + '</span>' +
                '<span style="font-size:0.72rem;font-weight:800;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em;">' + title + '</span>' +
            '</div>' +
            content +
        '</div>'
    );
}

function buildCriteriaCompact(validation) {
    return '<div style="display:flex;flex-direction:column;gap:5px;">' +
        PAROZZI_CRITERIA.map(c => {
            const v = validation[c.key] || {};
            const ok = v.verdict === true;
            return (
                '<div style="display:grid;grid-template-columns:auto 1fr;gap:0.5rem;align-items:flex-start;font-size:0.78rem;">' +
                    '<span class="material-icons-round" style="font-size:0.95rem;color:' + (ok ? '#10b981' : '#ef4444') + ';margin-top:2px;">' + (ok ? 'check_circle' : 'cancel') + '</span>' +
                    '<div>' +
                        '<div style="font-weight:600;color:var(--text-primary);">' + c.label + '</div>' +
                        (v.rationale ? '<div style="font-size:0.72rem;color:var(--text-tertiary);line-height:1.4;">' + escHtml(v.rationale) + '</div>' : '') +
                    '</div>' +
                '</div>'
            );
        }).join('') +
    '</div>';
}

function buildVerifiedDataCard(v) {
    const confColor = v.confidence === 'alta' ? '#10b981' : v.confidence === 'media' ? '#f59e0b' : '#94a3b8';
    const sourcesHtml = (v.sources || []).filter(s => s.url).map(s =>
        '<a href="' + escHtml(s.url) + '" target="_blank" rel="noopener noreferrer" style="display:block;font-size:0.74rem;color:#3b82f6;text-decoration:none;padding:4px 0;border-bottom:1px dashed var(--glass-border);">' +
            '<span style="font-weight:600;">' + escHtml(s.title || s.url) + '</span>' +
            (s.note ? '<span style="color:var(--text-tertiary);font-weight:400;"> — ' + escHtml(s.note) + '</span>' : '') +
            '<span class="material-icons-round" style="font-size:0.75rem;vertical-align:-1px;margin-left:3px;opacity:0.6;">open_in_new</span>' +
        '</a>'
    ).join('');

    return overviewCard('Verificato via Perplexity (web)', 'verified',
        (v.verified_market_size_text ? '<div style="font-size:0.85rem;color:var(--text-primary);margin-bottom:0.6rem;">' + escHtml(v.verified_market_size_text) + '</div>' : '') +
        '<div style="display:flex;gap:0.5rem;align-items:center;font-size:0.74rem;color:var(--text-tertiary);margin-bottom:0.6rem;">' +
            '<span style="padding:2px 8px;border-radius:6px;background:' + confColor + '15;color:' + confColor + ';font-weight:700;">confidence ' + escHtml(v.confidence || 'n/d') + '</span>' +
            (v.size_criterion_met != null
                ? '<span>· criterio size: ' + (v.size_criterion_met ? '<strong style="color:#10b981;">soddisfatto</strong>' : '<strong style="color:#ef4444;">non soddisfatto</strong>') + '</span>'
                : '') +
        '</div>' +
        (v.discrepancies ? '<div style="font-size:0.74rem;color:#92400e;padding:0.5rem 0.7rem;background:#f59e0b08;border:1px solid #f59e0b22;border-radius:8px;margin-bottom:0.6rem;"><strong>⚠ Discrepanze:</strong> ' + escHtml(v.discrepancies) + '</div>' : '') +
        (sourcesHtml ? '<div style="font-size:0.72rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;margin-top:0.6rem;margin-bottom:0.3rem;">Fonti</div>' + sourcesHtml : '<div style="font-size:0.74rem;color:var(--text-tertiary);font-style:italic;">Nessuna fonte web disponibile per questa nicchia.</div>')
    );
}

function buildLanguageCompact(lang) {
    return '<div style="display:flex;flex-direction:column;gap:4px;font-size:0.78rem;">' +
        Object.entries(lang).map(([k, v]) =>
            '<div style="display:grid;grid-template-columns:130px 1fr;gap:0.4rem;line-height:1.4;">' +
                '<span style="font-weight:700;color:#8b5cf6;">' + escHtml(k) + '</span>' +
                '<span style="color:var(--text-secondary);">' + escHtml(typeof v === 'string' ? v : JSON.stringify(v)) + '</span>' +
            '</div>'
        ).join('') +
    '</div>';
}

function buildSapCandidatesCompact(relevance) {
    const sorted = [...relevance].sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
    return '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:0.6rem;">' +
        sorted.map(r => {
            const score = r.relevance_score || 0;
            const c = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#94a3b8';
            return (
                '<div style="background:var(--bg-primary);border:1px solid var(--glass-border);border-radius:10px;padding:0.7rem 0.85rem;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.35rem;">' +
                        '<div style="font-size:0.82rem;font-weight:700;color:var(--text-primary);">' + escHtml(r.sap?.name || '?') + '</div>' +
                        '<span style="font-size:0.7rem;font-weight:800;padding:2px 7px;border-radius:6px;background:' + c + '20;color:' + c + ';">' + score + '</span>' +
                    '</div>' +
                    (r.angle ? '<div style="font-size:0.74rem;color:var(--text-secondary);line-height:1.45;">' + escHtml(r.angle) + '</div>' : '') +
                '</div>'
            );
        }).join('') +
    '</div>';
}

// ─── TAB: PROSPECTS (con filtri/sort/bulk) ───────────────────────────────────

function buildProspectsTab(ctx) {
    const { prospects } = ctx;

    if (prospects.length === 0) {
        return (
            '<div style="text-align:center;padding:3rem 2rem;border:2px dashed var(--glass-border);border-radius:14px;color:var(--text-tertiary);">' +
                '<span class="material-icons-round" style="font-size:3rem;opacity:0.4;display:block;margin-bottom:0.5rem;">people_outline</span>' +
                '<div style="font-size:1rem;font-weight:700;color:var(--text-primary);margin-bottom:0.4rem;">Nessun prospect ancora</div>' +
                '<div style="font-size:0.82rem;">Clicca <strong>"Cerca prospect"</strong> nell\'header per importare aziende reali via OpenStreetMap.</div>' +
            '</div>'
        );
    }

    // Lista città disponibili (dai prospect esistenti)
    const cities = Array.from(new Set(prospects.map(p => (p.ai_enrichment_data || {}).city_origin).filter(Boolean))).sort();
    const filtered = applyFilters(prospects, ctx.state.filters);

    return (
        // Toolbar filtri/sort
        '<div style="background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:12px;padding:0.75rem 0.9rem;margin-bottom:0.6rem;">' +
            '<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:0.6rem;align-items:end;">' +
                // Search box
                '<div>' +
                    '<label style="font-size:0.65rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:3px;">Cerca azienda</label>' +
                    '<input id="filter-search" type="text" value="' + escHtml(ctx.state.filters.search) + '" placeholder="Nome azienda…" style="width:100%;padding:0.45rem 0.7rem;border-radius:8px;border:1px solid var(--glass-border);background:var(--bg-primary);color:var(--text-primary);font-size:0.82rem;box-sizing:border-box;">' +
                '</div>' +
                // Sort
                '<div>' +
                    '<label style="font-size:0.65rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:3px;">Ordina per</label>' +
                    '<select id="filter-sort" style="padding:0.45rem 0.7rem;border-radius:8px;border:1px solid var(--glass-border);background:var(--bg-primary);color:var(--text-primary);font-size:0.82rem;">' +
                        sortOption('completeness_desc', ctx.state.filters, 'Completezza ↓') +
                        sortOption('completeness_asc',  ctx.state.filters, 'Completezza ↑') +
                        sortOption('promising_desc',    ctx.state.filters, 'Promising AI ↓') +
                        sortOption('promising_asc',     ctx.state.filters, 'Promising AI ↑') +
                        sortOption('alpha_asc',         ctx.state.filters, 'A→Z') +
                        sortOption('alpha_desc',        ctx.state.filters, 'Z→A') +
                    '</select>' +
                '</div>' +
                // Status filter
                '<div>' +
                    '<label style="font-size:0.65rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:3px;">Stato</label>' +
                    '<select id="filter-status" style="padding:0.45rem 0.7rem;border-radius:8px;border:1px solid var(--glass-border);background:var(--bg-primary);color:var(--text-primary);font-size:0.82rem;">' +
                        statusOption('all',         ctx.state.filters, 'Tutti') +
                        statusOption('sourced',     ctx.state.filters, 'Sourceati') +
                        statusOption('in_pipeline', ctx.state.filters, 'In pipeline') +
                    '</select>' +
                '</div>' +
                // Reset
                '<button id="filter-reset" style="padding:0.45rem 0.8rem;border-radius:8px;border:1px solid var(--glass-border);background:var(--bg-tertiary);color:var(--text-secondary);font-size:0.76rem;font-weight:600;cursor:pointer;height:fit-content;">Reset</button>' +
            '</div>' +
            // Riga 2: filtri "ha-X" — facoltativi multi-toggle
            '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.6rem;padding-top:0.6rem;border-top:1px dashed var(--glass-border);align-items:center;">' +
                '<span style="font-size:0.7rem;color:var(--text-tertiary);font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">Deve avere:</span>' +
                hasFilterPill('has_email', 'Email', '✉', ctx.state.filters) +
                hasFilterPill('has_phone', 'Telefono', '☎', ctx.state.filters) +
                hasFilterPill('has_social', 'Social', '🔗', ctx.state.filters) +
                hasFilterPill('has_rating', 'Rating Google', '⭐', ctx.state.filters) +
                '<span style="margin-left:0.6rem;font-size:0.7rem;color:var(--text-tertiary);font-weight:600;">Completezza min:</span>' +
                '<input id="filter-completeness" type="number" min="0" max="100" step="10" value="' + ctx.state.filters.minCompleteness + '" style="width:60px;padding:3px 6px;border-radius:6px;border:1px solid var(--glass-border);background:var(--bg-primary);color:var(--text-primary);font-size:0.74rem;">' +
                '<span style="font-size:0.7rem;color:var(--text-tertiary);font-weight:600;">Promising min:</span>' +
                '<input id="filter-promising" type="number" min="0" max="100" step="10" value="' + ctx.state.filters.minPromising + '" style="width:60px;padding:3px 6px;border-radius:6px;border:1px solid var(--glass-border);background:var(--bg-primary);color:var(--text-primary);font-size:0.74rem;">' +
            '</div>' +
            // Riga 3: filtro località (multi-select)
            (cities.length > 0
                ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:0.6rem;padding-top:0.6rem;border-top:1px dashed var(--glass-border);align-items:center;">' +
                    '<span style="font-size:0.7rem;color:var(--text-tertiary);font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin-right:4px;">Località' + (ctx.state.filters.cities.length > 0 ? ' (' + ctx.state.filters.cities.length + ' attive)' : '') + ':</span>' +
                    cities.slice(0, 40).map(city => {
                        const cityClean = String(city).trim();
                        const selected = ctx.state.filters.cities.includes(cityClean);
                        return '<button class="city-pill" data-city="' + escHtml(cityClean) + '" style="font-size:0.7rem;padding:3px 9px;border-radius:8px;border:1px solid ' + (selected ? '#3b82f6' : 'var(--glass-border)') + ';background:' + (selected ? '#3b82f620' : 'var(--bg-tertiary)') + ';color:' + (selected ? '#3b82f6' : 'var(--text-secondary)') + ';cursor:pointer;font-weight:' + (selected ? '700' : '600') + ';">' + escHtml(cityClean) + '</button>';
                    }).join('') +
                    (cities.length > 40 ? '<span style="font-size:0.7rem;color:var(--text-tertiary);">+' + (cities.length - 40) + ' altre</span>' : '') +
                    (ctx.state.filters.cities.length > 0
                        ? '<button id="filter-cities-clear" style="margin-left:6px;font-size:0.68rem;padding:2px 8px;border-radius:6px;border:none;background:#ef444415;color:#ef4444;cursor:pointer;font-weight:700;">pulisci</button>'
                        : '') +
                  '</div>'
                : '') +
        '</div>' +
        // Toolbar bulk actions
        '<div id="np-toolbar" style="display:flex;gap:0.4rem;align-items:center;margin-bottom:0.6rem;padding:0.55rem 0.85rem;background:var(--bg-tertiary);border-radius:10px;">' +
            '<label style="display:inline-flex;align-items:center;gap:5px;font-size:0.78rem;color:var(--text-secondary);font-weight:600;cursor:pointer;">' +
                '<input type="checkbox" id="np-select-all" style="cursor:pointer;">Seleziona tutti (' + filtered.length + ')' +
            '</label>' +
            '<span id="np-selected-count" style="font-size:0.74rem;color:var(--text-tertiary);font-weight:600;">0 selezionati</span>' +
            '<div style="flex:1;"></div>' +
            '<button id="np-bulk-analyze" disabled style="font-size:0.74rem;padding:5px 10px;border-radius:8px;border:1px solid #8b5cf640;background:#8b5cf608;color:#8b5cf6;cursor:pointer;font-weight:700;display:inline-flex;align-items:center;gap:4px;opacity:0.5;">' +
                '<span class="material-icons-round" style="font-size:0.85rem;">auto_awesome</span>Analizza AI' +
            '</button>' +
            '<button id="np-bulk-delete" disabled style="font-size:0.74rem;padding:5px 10px;border-radius:8px;border:1px solid #ef444440;background:#ef444408;color:#ef4444;cursor:pointer;font-weight:700;opacity:0.5;">Elimina</button>' +
        '</div>' +
        // Progress bar (hidden by default)
        '<div id="np-progress" style="display:none;margin-bottom:0.6rem;padding:0.6rem 0.8rem;background:#8b5cf608;border:1px solid #8b5cf640;border-radius:10px;font-size:0.78rem;color:#8b5cf6;font-weight:600;"></div>' +
        // Tabella prospect filtrata
        (filtered.length > 0
            ? '<div style="background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:12px;overflow:hidden;">' +
                // Header tabella
                '<div style="display:grid;grid-template-columns:36px 1fr 90px 80px 100px;gap:0.6rem;padding:0.55rem 0.85rem;background:var(--bg-tertiary);font-size:0.68rem;font-weight:800;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;border-bottom:1px solid var(--glass-border);">' +
                    '<div></div><div>Azienda · Località</div><div style="text-align:center;">Completezza</div><div style="text-align:center;">Promising</div><div>Stato</div>' +
                '</div>' +
                // Righe
                '<div style="max-height:520px;overflow-y:auto;">' +
                    filtered.map(p => buildProspectRow(p)).join('') +
                '</div>' +
              '</div>'
            : '<div style="padding:2rem;text-align:center;color:var(--text-tertiary);border:2px dashed var(--glass-border);border-radius:12px;">' +
                '<div style="font-size:0.85rem;">Nessun prospect corrisponde ai filtri. <button id="filter-reset-empty" style="background:none;border:none;color:var(--brand-blue);cursor:pointer;font-size:0.85rem;text-decoration:underline;">Reset filtri</button></div>' +
              '</div>'
        )
    );
}

function sortOption(value, filters, label) {
    const current = filters.sortBy + '_' + filters.sortDir;
    return '<option value="' + value + '"' + (current === value ? ' selected' : '') + '>' + label + '</option>';
}

function statusOption(value, filters, label) {
    return '<option value="' + value + '"' + (filters.status === value ? ' selected' : '') + '>' + label + '</option>';
}

function applyFilters(prospects, f) {
    let out = prospects.slice();

    // Status
    if (f.status === 'sourced') out = out.filter(p => p.pipeline_stage === 'sourced');
    else if (f.status === 'in_pipeline') out = out.filter(p => p.pipeline_stage && p.pipeline_stage !== 'sourced');

    // Località — trim per evitare mismatch invisibili
    if (f.cities && f.cities.length > 0) {
        const set = new Set(f.cities.map(c => String(c).trim()));
        out = out.filter(p => {
            const c = (p.ai_enrichment_data || {}).city_origin;
            return c && set.has(String(c).trim());
        });
    }

    // "Deve avere" toggles
    if (f.has_email) out = out.filter(p => !!p.contact_email);
    if (f.has_phone) out = out.filter(p => !!p.contact_phone);
    if (f.has_social) out = out.filter(p => {
        const s = p.social_links || {};
        return Object.keys(s).filter(k => s[k]).length > 0;
    });
    if (f.has_rating) out = out.filter(p => {
        const e = p.ai_enrichment_data || {};
        return e.google_rating != null && Number(e.google_rating) > 0;
    });

    // Soglie
    if (f.minCompleteness > 0) out = out.filter(p => (p.completeness_score || 0) >= f.minCompleteness);
    if (f.minPromising > 0) out = out.filter(p => ((p.ai_enrichment_data || {}).promising_score || 0) >= f.minPromising);

    // Search
    if (f.search && f.search.trim()) {
        const q = f.search.toLowerCase().trim();
        out = out.filter(p => (p.business_name || '').toLowerCase().includes(q));
    }

    // Sort
    const dir = f.sortDir === 'desc' ? -1 : 1;
    const getCompl = p => p.completeness_score || 0;
    const getProm  = p => (p.ai_enrichment_data || {}).promising_score || 0;
    if (f.sortBy === 'completeness') out.sort((a, b) => dir * (getCompl(a) - getCompl(b)));
    else if (f.sortBy === 'promising') out.sort((a, b) => dir * (getProm(a) - getProm(b)));
    else if (f.sortBy === 'alpha') out.sort((a, b) => dir * (a.business_name || '').localeCompare(b.business_name || ''));

    return out;
}

function hasFilterPill(key, label, icon, filters) {
    const active = !!filters[key];
    return '<button class="has-filter-pill" data-key="' + key + '" style="font-size:0.7rem;padding:3px 9px;border-radius:8px;border:1px solid ' + (active ? '#10b981' : 'var(--glass-border)') + ';background:' + (active ? '#10b98120' : 'var(--bg-tertiary)') + ';color:' + (active ? '#10b981' : 'var(--text-secondary)') + ';cursor:pointer;font-weight:' + (active ? '700' : '600') + ';display:inline-flex;align-items:center;gap:3px;">' +
        '<span>' + icon + '</span>' + label +
    '</button>';
}

function buildProspectRow(p) {
    const e = p.ai_enrichment_data || {};
    const completeness = p.completeness_score;
    const promising = e.promising_score;
    const compColor = completeness == null ? '#94a3b8' : completeness >= 60 ? '#10b981' : completeness >= 30 ? '#f59e0b' : '#ef4444';
    const promColor = promising == null ? '#94a3b8' : promising >= 70 ? '#10b981' : promising >= 40 ? '#f59e0b' : '#94a3b8';
    const stage = p.pipeline_stage || 'sourced';
    const stageColors = { sourced: '#94a3b8', cold: '#3b82f6', contacted: '#3b82f6', replied: '#f59e0b', proposal_sent: '#8b5cf6', converted: '#10b981' };
    const stageColor = stageColors[stage] || '#94a3b8';
    const inPipeline = stage !== 'sourced';
    const socials = p.social_links || {};
    const socialCount = Object.keys(socials).filter(k => socials[k]).length;

    return (
        '<div class="np-row" data-id="' + p.id + '" style="display:grid;grid-template-columns:36px 1fr 90px 80px 100px;gap:0.6rem;padding:0.6rem 0.85rem;border-bottom:1px solid var(--glass-border);align-items:center;font-size:0.82rem;">' +
            '<label style="display:flex;align-items:center;justify-content:center;cursor:pointer;">' +
                '<input type="checkbox" class="np-check" data-id="' + p.id + '" style="cursor:pointer;width:16px;height:16px;">' +
            '</label>' +
            '<div class="np-row-open" data-id="' + p.id + '" style="min-width:0;cursor:pointer;">' +
                '<div style="font-weight:700;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(p.business_name) +
                    (inPipeline ? ' <span style="font-size:0.62rem;color:#10b981;font-weight:700;">● in pipeline</span>' : '') +
                '</div>' +
                '<div style="font-size:0.7rem;color:var(--text-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;gap:6px;align-items:center;">' +
                    (e.city_origin ? '<span>📍 ' + escHtml(e.city_origin) + '</span>' : '') +
                    (p.contact_email ? '<span>✉</span>' : '') +
                    (p.contact_phone ? '<span>☎</span>' : '') +
                    (socialCount > 0 ? '<span>🔗' + socialCount + '</span>' : '') +
                    (p.website ? '<span style="color:#3b82f6;overflow:hidden;text-overflow:ellipsis;">' + escHtml(p.website.replace(/^https?:\/\//, '').slice(0, 40)) + '</span>' : '') +
                '</div>' +
            '</div>' +
            '<div style="text-align:center;">' +
                (completeness != null
                    ? '<span style="font-size:0.74rem;font-weight:800;padding:3px 8px;border-radius:6px;background:' + compColor + '15;color:' + compColor + ';">' + completeness + '</span>'
                    : '<span style="font-size:0.68rem;color:var(--text-tertiary);">—</span>') +
            '</div>' +
            '<div style="text-align:center;">' +
                (promising != null
                    ? '<span style="font-size:0.74rem;font-weight:800;padding:3px 8px;border-radius:6px;background:' + promColor + '15;color:' + promColor + ';">' + promising + '</span>'
                    : '<span style="font-size:0.68rem;color:var(--text-tertiary);">—</span>') +
            '</div>' +
            '<div>' +
                '<span style="font-size:0.65rem;font-weight:700;padding:3px 7px;border-radius:6px;background:' + stageColor + '15;color:' + stageColor + ';text-transform:uppercase;letter-spacing:0.04em;">' + stage + '</span>' +
            '</div>' +
        '</div>'
    );
}

// ─── TAB: SEQUENCES ──────────────────────────────────────────────────────────

function buildSequencesTab(ctx) {
    const linked = ctx.sequences.filter(s => s.niche_id === ctx.niche.id);
    return (
        '<div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">' +
                '<div style="font-size:0.85rem;color:var(--text-secondary);">' + linked.length + ' sequenze collegate a questa nicchia</div>' +
                '<a href="#sales-sequences" style="font-size:0.78rem;padding:0.45rem 0.9rem;border-radius:10px;background:var(--brand-blue);color:white;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:0.35rem;">' +
                    '<span class="material-icons-round" style="font-size:1rem;">add</span>Nuova sequenza' +
                '</a>' +
            '</div>' +
            (linked.length === 0
                ? '<div style="text-align:center;padding:2rem;border:2px dashed var(--glass-border);border-radius:12px;color:var(--text-tertiary);">' +
                    '<div style="font-size:0.85rem;">Nessuna sequenza ancora. Crea una sequenza outreach per questa nicchia → l\'AI scrive i template basandosi su pain points, linguaggio, SAP candidati.</div>' +
                  '</div>'
                : '<div style="display:flex;flex-direction:column;gap:0.5rem;">' +
                    linked.map(s => {
                        const stats = s.stats || {};
                        return (
                            '<a href="#sales-sequence/' + s.id + '" style="display:flex;justify-content:space-between;align-items:center;padding:0.85rem 1rem;background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:10px;text-decoration:none;transition:background 0.15s;" onmouseover="this.style.background=\'var(--bg-tertiary)\'" onmouseout="this.style.background=\'var(--bg-secondary)\'">' +
                                '<div>' +
                                    '<div style="font-size:0.88rem;font-weight:700;color:var(--text-primary);">' + escHtml(s.name) + '</div>' +
                                    '<div style="font-size:0.72rem;color:var(--text-tertiary);">Tono: ' + escHtml(s.tone || '—') + ' · Status: ' + escHtml(s.status || '—') + '</div>' +
                                '</div>' +
                                '<div style="display:flex;gap:0.7rem;font-size:0.72rem;color:var(--text-secondary);">' +
                                    '<span><strong>' + (stats.sent || 0) + '</strong> inviati</span>' +
                                    '<span><strong>' + (stats.replied || 0) + '</strong> risposte</span>' +
                                    '<span><strong>' + (stats.calls || 0) + '</strong> call</span>' +
                                '</div>' +
                            '</a>'
                        );
                    }).join('') +
                  '</div>'
            ) +
        '</div>'
    );
}

// ─── TAB: KPI ────────────────────────────────────────────────────────────────

function buildKpiTab(ctx) {
    const { prospects, sequences } = ctx;
    const total = prospects.length;
    const completi = prospects.filter(p => (p.completeness_score || 0) >= 60).length;
    const parziali = prospects.filter(p => { const s = p.completeness_score || 0; return s >= 30 && s < 60; }).length;
    const incompleti = prospects.filter(p => (p.completeness_score || 0) < 30 || p.completeness_score == null).length;
    const analizzatiL1 = prospects.filter(p => (p.ai_enrichment_data || {}).layer1_at).length;
    const analizzatiL2 = prospects.filter(p => (p.ai_enrichment_data || {}).layer2_at).length;
    const promettenti = prospects.filter(p => ((p.ai_enrichment_data || {}).promising_score || 0) >= 70).length;
    const inPipeline = prospects.filter(p => p.pipeline_stage && p.pipeline_stage !== 'sourced').length;
    const converted = prospects.filter(p => p.pipeline_stage === 'converted').length;
    const linkedSequences = sequences.filter(s => s.niche_id === ctx.niche.id);

    return (
        '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:1rem;">' +
            kpiCard('Prospect totali',          total,           'people',              'var(--brand-blue)') +
            kpiCard('Completi (≥60)',           completi,        'check_circle',         '#10b981') +
            kpiCard('Parziali (30-60)',         parziali,        'pending',              '#f59e0b') +
            kpiCard('Incompleti (<30)',         incompleti,      'warning',              '#ef4444') +
            kpiCard('Analizzati Layer 1',       analizzatiL1,    'auto_awesome',         '#8b5cf6') +
            kpiCard('Analizzati Layer 2',       analizzatiL2,    'psychology',           '#8b5cf6') +
            kpiCard('Promettenti (score≥70)',   promettenti,     'trending_up',          '#10b981') +
            kpiCard('In pipeline outreach',     inPipeline,      'forward_to_inbox',     '#3b82f6') +
            kpiCard('Convertiti a cliente',     converted,       'verified',             '#10b981') +
            kpiCard('Sequenze collegate',       linkedSequences.length, 'campaign',     '#6366f1') +
        '</div>'
    );
}

function kpiCard(label, value, icon, color) {
    return (
        '<div style="background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:14px;padding:1rem 1.1rem;">' +
            '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.5rem;">' +
                '<span class="material-icons-round" style="font-size:1.1rem;color:' + color + ';">' + icon + '</span>' +
                '<span style="font-size:0.7rem;font-weight:800;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em;">' + label + '</span>' +
            '</div>' +
            '<div style="font-size:2rem;font-weight:900;color:var(--text-primary);line-height:1;font-family:var(--font-titles);">' + value + '</div>' +
        '</div>'
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════════════════

function bindEvents(ctx) {
    bindTabBar(ctx);
    bindHeader(ctx);
    bindMoreMenu(ctx);
    if (ctx.state.activeTab === 'prospects') bindProspectsTabEvents(ctx);
}

function bindTabBar(ctx) {
    ctx.container.querySelectorAll('.niche-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            ctx.state.activeTab = btn.dataset.tab;
            _pageState.set(ctx.container, ctx.state);
            // Re-render della pagina (preservando state)
            ctx.container.innerHTML = buildPageHTML(ctx);
            bindEvents(ctx);
        });
    });
}

function bindHeader(ctx) {
    ctx.container.querySelector('#btn-reanalyze-detail')?.addEventListener('click', async () => {
        const btn = ctx.container.querySelector('#btn-reanalyze-detail');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-icons-round" style="font-size:0.95rem;animation:spin 1s linear infinite;">refresh</span>Analizzo…';
        try {
            let sector = null;
            if (ctx.niche.sector_id) {
                try {
                    const sectors = await fetchIndustrySectors();
                    sector = sectors.find(s => s.id === ctx.niche.sector_id) || null;
                } catch (_) {}
            }
            const analysis = await analyzeNiche(ctx.niche.name, sector);
            await saveNicheAnalysis(ctx.niche.id, analysis);
            showGlobalAlert('Nicchia rianalizzata', 'success');
            ctx.onReload();
        } catch (err) {
            console.error('[NicheReanalyze]', err);
            showGlobalAlert('Errore AI: ' + err.message, 'error');
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-round" style="font-size:0.95rem;">auto_awesome</span>Riprova';
        }
    });

    ctx.container.querySelector('#btn-source-prospects')?.addEventListener('click', () => {
        openSourcingModal(ctx.niche, () => ctx.onReload());
    });
}

function bindMoreMenu(ctx) {
    const btn = ctx.container.querySelector('#btn-more-menu');
    const dropdown = ctx.container.querySelector('#more-menu-dropdown');
    if (!btn || !dropdown) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', () => { dropdown.style.display = 'none'; });

    ctx.container.querySelector('#mm-edit-meta')?.addEventListener('click', () => {
        dropdown.style.display = 'none';
        openEditMetaModal(ctx);
    });
    ctx.container.querySelector('#mm-delete')?.addEventListener('click', async () => {
        dropdown.style.display = 'none';
        const ok = await showConfirm('Eliminare la nicchia "' + ctx.niche.name + '"? Cancella analisi AI, SAP relevance e prospect collegati.', 'Elimina', 'Annulla');
        if (!ok) return;
        try {
            await deleteNiche(ctx.niche.id);
            showGlobalAlert('Nicchia eliminata', 'success');
            window.location.hash = 'sales-niches';
        } catch (err) {
            showGlobalAlert('Errore: ' + err.message, 'error');
        }
    });
}

function openEditMetaModal(ctx) {
    const niche = ctx.niche;
    const statusOptions = Object.entries(STATUS_CONFIG).map(([k, v]) =>
        '<option value="' + k + '"' + (niche.status === k ? ' selected' : '') + '>' + v.label + '</option>'
    ).join('');

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.75);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
    overlay.innerHTML =
        '<div style="background:var(--bg-primary, #fff);border-radius:20px;padding:1.5rem 1.75rem;max-width:480px;width:100%;box-shadow:0 25px 80px rgba(0,0,0,0.35);border:1px solid var(--glass-border, rgba(0,0,0,0.08));">' +
            '<h2 style="font-size:1.1rem;font-weight:800;font-family:var(--font-titles);margin:0 0 1rem;">Modifica status / note</h2>' +
            '<div style="margin-bottom:0.75rem;">' +
                '<label style="font-size:0.7rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:3px;">Status</label>' +
                '<select id="em-status" style="width:100%;padding:0.55rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;">' + statusOptions + '</select>' +
            '</div>' +
            '<div style="margin-bottom:0.75rem;">' +
                '<label style="font-size:0.7rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:3px;">Note operative</label>' +
                '<textarea id="em-notes" rows="3" placeholder="Note libere…" style="width:100%;padding:0.55rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;resize:vertical;box-sizing:border-box;">' + escHtml(niche.notes || '') + '</textarea>' +
            '</div>' +
            '<div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1.25rem;">' +
                '<button id="em-cancel" style="padding:0.55rem 1rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-secondary);font-size:0.82rem;font-weight:600;cursor:pointer;">Annulla</button>' +
                '<button id="em-save" class="primary-btn" style="padding:0.55rem 1.2rem;border-radius:10px;font-size:0.82rem;font-weight:700;">Salva</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#em-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#em-save').addEventListener('click', async () => {
        try {
            await upsertNiche({
                id: niche.id,
                status: overlay.querySelector('#em-status').value,
                notes: overlay.querySelector('#em-notes').value.trim() || null,
            });
            showGlobalAlert('Salvato', 'success');
            overlay.remove();
            ctx.onReload();
        } catch (err) {
            showGlobalAlert('Errore: ' + err.message, 'error');
        }
    });
}

function bindProspectsTabEvents(ctx) {
    const { container, state, prospects } = ctx;

    // Filtri
    const reRender = () => {
        const tabDiv = container.querySelector('#niche-tab-content');
        if (!tabDiv) return;
        tabDiv.innerHTML = buildProspectsTab(ctx);
        bindProspectsTabEvents(ctx);
    };

    container.querySelector('#filter-search')?.addEventListener('input', e => {
        state.filters.search = e.target.value;
        reRender();
    });
    container.querySelector('#filter-sort')?.addEventListener('change', e => {
        const [by, dir] = e.target.value.split('_');
        state.filters.sortBy = by;
        state.filters.sortDir = dir;
        reRender();
    });
    container.querySelector('#filter-status')?.addEventListener('change', e => {
        state.filters.status = e.target.value;
        reRender();
    });
    container.querySelector('#filter-completeness')?.addEventListener('change', e => {
        state.filters.minCompleteness = parseInt(e.target.value, 10) || 0;
        reRender();
    });
    container.querySelector('#filter-promising')?.addEventListener('change', e => {
        state.filters.minPromising = parseInt(e.target.value, 10) || 0;
        reRender();
    });
    container.querySelectorAll('.city-pill').forEach(p => {
        p.addEventListener('click', () => {
            const city = String(p.dataset.city || '').trim();
            if (!city) return;
            const idx = state.filters.cities.indexOf(city);
            if (idx >= 0) state.filters.cities.splice(idx, 1);
            else state.filters.cities.push(city);
            reRender();
        });
    });
    container.querySelector('#filter-cities-clear')?.addEventListener('click', () => {
        state.filters.cities = [];
        reRender();
    });
    container.querySelectorAll('.has-filter-pill').forEach(p => {
        p.addEventListener('click', () => {
            const key = p.dataset.key;
            state.filters[key] = !state.filters[key];
            reRender();
        });
    });
    const resetFn = () => {
        state.filters = { search: '', sortBy: 'completeness', sortDir: 'desc', cities: [], minCompleteness: 0, minPromising: 0, status: 'all', has_email: false, has_phone: false, has_social: false, has_rating: false };
        reRender();
    };
    container.querySelector('#filter-reset')?.addEventListener('click', resetFn);
    container.querySelector('#filter-reset-empty')?.addEventListener('click', resetFn);

    // Row open
    container.querySelectorAll('.np-row-open').forEach(opener => {
        opener.addEventListener('click', async () => {
            const id = opener.dataset.id;
            const p = prospects.find(x => x.id === id);
            if (!p) return;
            try {
                const sapServices = await fetchSapServicesForSales();
                openProspectModal(p, sapServices, () => ctx.onReload());
            } catch (err) {
                showGlobalAlert('Errore: ' + err.message, 'error');
            }
        });
    });

    // Bulk
    const checks = container.querySelectorAll('.np-check');
    const selectAll = container.querySelector('#np-select-all');
    const countSpan = container.querySelector('#np-selected-count');
    const btnAnalyze = container.querySelector('#np-bulk-analyze');
    const btnDelete = container.querySelector('#np-bulk-delete');

    const updateCount = () => {
        const n = container.querySelectorAll('.np-check:checked').length;
        if (countSpan) countSpan.textContent = n + ' selezionati';
        [btnAnalyze, btnDelete].forEach(b => {
            if (!b) return;
            b.disabled = n === 0;
            b.style.opacity = n === 0 ? '0.5' : '1';
        });
        if (selectAll && checks.length > 0) selectAll.checked = n > 0 && n === checks.length;
    };
    checks.forEach(c => c.addEventListener('change', updateCount));
    selectAll?.addEventListener('change', () => {
        checks.forEach(c => { c.checked = selectAll.checked; });
        updateCount();
    });

    const getSelectedIds = () => Array.from(container.querySelectorAll('.np-check:checked')).map(c => c.dataset.id);

    btnAnalyze?.addEventListener('click', async () => {
        const ids = getSelectedIds();
        if (ids.length === 0) return;
        await runBulkAnalyze(ctx, ids);
    });

    btnDelete?.addEventListener('click', async () => {
        const ids = getSelectedIds();
        if (ids.length === 0) return;
        const ok = await showConfirm('Eliminare ' + ids.length + ' prospect? Operazione irreversibile.', 'Elimina', 'Annulla');
        if (!ok) return;
        try {
            await bulkDeleteProspects(ids);
            showGlobalAlert(ids.length + ' prospect eliminati', 'success');
            ctx.onReload();
        } catch (err) {
            showGlobalAlert('Errore: ' + err.message, 'error');
        }
    });
}

async function runBulkAnalyze(ctx, ids) {
    const { container, prospects, niche } = ctx;
    const targets = prospects.filter(p => ids.includes(p.id));
    const progressDiv = container.querySelector('#np-progress');
    if (progressDiv) progressDiv.style.display = 'block';

    // Carica sector schema della nicchia UNA VOLTA (riusato per tutti i prospect del bulk)
    let sectorSchema = null;
    if (niche.sector_id && niche.sector) {
        try {
            sectorSchema = await getSectorSchema(niche.sector);
        } catch (err) {
            console.warn('[BulkAnalyze] sector schema fetch failed', err);
        }
    }

    let done = 0, failed = 0, l2 = 0;
    const total = targets.length;

    for (let i = 0; i < targets.length; i++) {
        const p = targets[i];
        if (progressDiv) {
            progressDiv.innerHTML = '<span class="material-icons-round" style="font-size:0.95rem;animation:spin 1s linear infinite;vertical-align:-3px;">refresh</span> Analizzo ' + (i + 1) + '/' + total + (l2 > 0 ? ' · L2 auto: ' + l2 : '') + ' — ' + escHtml(p.business_name);
        }
        try {
            let scrape = null;
            if (p.website) scrape = await scrapeProspectSite(p.website, sectorSchema);
            const r1 = await runLayer1AI(p, scrape);
            // Enrichment dati estratti deterministicamente dallo scrape (structured_fields, rating, email referenti)
            const fromScrape = extractEnrichmentDataFromScrape(scrape);
            let enrichment = {
                ...(p.ai_enrichment_data || {}),
                ...fromScrape,
                descrizione_lampo:   r1.descrizione_lampo || null,
                chi_sono_cosa_fanno: r1.chi_sono_cosa_fanno || null,
                prodotti_servizi:    r1.prodotti_servizi || null,
                clientela_target:    r1.clientela_target || null,
                punto_distintivo:    r1.punto_distintivo || null,
                industry:            r1.industry || null,
                company_size:        r1.company_size || null,
                location:            r1.location || null,
                revenue_estimate:    r1.revenue_estimate || null,
                promising_score:     r1.promising_score != null ? Number(r1.promising_score) : null,
                promising_rationale: r1.promising_rationale || null,
                layer1_at:           new Date().toISOString(),
            };
            delete enrichment.last_scrape;
            const leanFields = buildLeanUpdatePayload(p, scrape);

            if (enrichment.promising_score >= 70) {
                try {
                    const r2 = await runLayer2AI({ ...p, ai_enrichment_data: enrichment }, scrape);
                    enrichment = { ...enrichment,
                        competitor: r2.competitor || null,
                        punti_forza: r2.punti_forza || null,
                        punti_debolezza: r2.punti_debolezza || null,
                        analisi_swot: r2.analisi_swot || null,
                        news_recenti: r2.news_recenti || null,
                        testimonianze: r2.testimonianze || null,
                        presenza_online: r2.presenza_online || null,
                        opportunita_marketing: r2.opportunita_marketing || null,
                        sap_candidati: r2.sap_candidati || null,
                        fattibilita_note: r2.fattibilita_note || null,
                        fattibilita_score: r2.fattibilita_score != null ? Number(r2.fattibilita_score) : null,
                        layer2_at: new Date().toISOString(),
                    };
                    l2++;
                } catch (l2err) { console.warn('[BulkL2]', l2err); }
            }

            await upsertProspect({ id: p.id, ai_enrichment_data: enrichment, industry: p.industry || r1.industry || null, ...leanFields });
            done++;
        } catch (err) {
            console.error('[BulkL1]', err);
            failed++;
        }
    }

    if (progressDiv) progressDiv.innerHTML = '✓ ' + done + '/' + total + ' OK' + (failed ? ' · ' + failed + ' falliti' : '') + (l2 ? ' · ' + l2 + ' L2 auto' : '');
    showGlobalAlert('Bulk: ' + done + ' OK, ' + failed + ' falliti, ' + l2 + ' L2', 'success');
    setTimeout(() => ctx.onReload(), 1500);
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════════════

function loadingHTML(label) {
    return '<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--text-secondary);gap:0.75rem;"><span class="material-icons-round" style="animation:spin 1s linear infinite;">refresh</span>' + label + '</div>';
}

function buildMoreMenuStyles() {
    return '<style>.mm-item:hover { background: var(--bg-tertiary) !important; }</style>';
}

function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
