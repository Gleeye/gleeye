/**
 * sales/niches.js
 * Niche Research Center (#sales-niches).
 *
 * Modello AI-first:
 * - Davide scrive solo il NOME della nicchia.
 * - L'AI (niche_analyzer) genera tutto: descrizione, geo_scope granulare,
 *   validazione 5 criteri Parozzi, pain points, linguaggio, SAP candidati con angle.
 * - Davide rivede e salva.
 */

import { fetchNiches, upsertNiche, deleteNiche, fetchProspectsByNiche, promoteProspectsToPipeline, bulkDeleteProspects, upsertProspect, fetchSapServicesForSales } from './api.js?v=8000';
import { showGlobalAlert, showConfirm } from '../../modules/utils.js?v=8000';
import { analyzeNiche, saveNicheAnalysis, fetchNicheSapRelevance, PAROZZI_CRITERIA } from './niche_analyzer.js?v=8000';
import { openSourcingModal } from './sourcing.js?v=8000';
import { runLayer1AI, runLayer2AI, scrapeProspectSite } from './enrichment.js?v=8001';
import { openProspectModal } from './pipeline_board.js?v=8000';
import { openOverlay, buildModalShell, closeOverlay, bindModalCloseButtons } from './_modal.js?v=8001';
import { buildLeanUpdatePayload } from './completeness.js?v=8001';

const STATUS_CONFIG = {
    researching: { label: 'In ricerca',  color: '#f59e0b', icon: 'search' },
    active:      { label: 'Attiva',       color: '#10b981', icon: 'play_circle' },
    paused:      { label: 'In pausa',     color: '#6366f1', icon: 'pause_circle' },
    exhausted:   { label: 'Esaurita',     color: '#94a3b8', icon: 'check_circle' },
};

export async function renderSalesNiches(container) {
    container.innerHTML = buildLoadingHTML();

    try {
        const niches = await fetchNiches();
        container.innerHTML = buildPageHTML(niches);
        bindEvents(container, niches);
    } catch (err) {
        container.innerHTML = '<p style="padding:2rem;color:red;">Errore: ' + escHtml(err.message) + '</p>';
    }
}

// ─── PAGE HTML ────────────────────────────────────────────────────────────────

function buildLoadingHTML() {
    return '<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--text-secondary);gap:0.75rem;"><span class="material-icons-round" style="animation:spin 1s linear infinite;">refresh</span>Caricamento nicchie…</div>';
}

function buildPageHTML(niches) {
    const totalNiches = niches.length;
    const activeNiches = niches.filter(n => n.status === 'active').length;
    const analyzedNiches = niches.filter(n => n.analyzed_at).length;
    const totalProspects = niches.reduce((sum, n) => sum + (n.prospects_count || 0), 0);

    return (
        '<div class="animate-fade-in" style="max-width:1200px;margin:0 auto;padding:1.5rem;">' +
            buildHeader(totalNiches, activeNiches, analyzedNiches, totalProspects) +
            (niches.length === 0
                ? buildEmptyState()
                : '<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(380px, 1fr));gap:1rem;">' +
                    niches.map(n => buildNicheCard(n)).join('') +
                  '</div>'
            ) +
        '</div>'
    );
}

function buildHeader(total, active, analyzed, prospects) {
    return (
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">' +
            '<div>' +
                '<h1 style="font-size:1.75rem;font-weight:800;font-family:var(--font-titles);color:var(--text-primary);margin:0;letter-spacing:-0.02em;">Niche Research</h1>' +
                '<div style="font-size:0.85rem;color:var(--text-tertiary);margin-top:0.25rem;">' +
                    total + ' nicchie · ' + active + ' attive · ' + analyzed + ' analizzate AI · ' + prospects + ' prospect' +
                '</div>' +
            '</div>' +
            '<div style="display:flex;gap:0.5rem;align-items:center;">' +
                '<a href="#sales-pipeline" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.82rem;padding:0.5rem 1rem;border-radius:10px;font-weight:600;color:var(--text-secondary);border:1px solid var(--glass-border);text-decoration:none;background:var(--bg-secondary);">' +
                    '<span class="material-icons-round" style="font-size:1rem;">view_kanban</span>Pipeline' +
                '</a>' +
                '<button id="btn-new-niche" class="primary-btn" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.82rem;padding:0.5rem 1rem;border-radius:12px;font-weight:700;">' +
                    '<span class="material-icons-round" style="font-size:1rem;">add</span>Nuova nicchia' +
                '</button>' +
            '</div>' +
        '</div>'
    );
}

function buildEmptyState() {
    return (
        '<div style="text-align:center;padding:4rem 2rem;color:var(--text-tertiary);border:2px dashed var(--glass-border);border-radius:18px;">' +
            '<span class="material-icons-round" style="font-size:4rem;opacity:0.3;display:block;margin-bottom:1rem;">explore</span>' +
            '<div style="font-size:1.05rem;font-weight:700;color:var(--text-primary);margin-bottom:0.5rem;">Nessuna nicchia ancora</div>' +
            '<div style="font-size:0.88rem;max-width:520px;margin:0 auto 1.5rem;line-height:1.5;">' +
                'Scrivi il nome di un segmento di mercato (es. "Strutture ricettive Liguria") e l\'AI fa il resto: ' +
                'analisi mercato, pain points, comuni da attaccare, SAP candidati con angle di vendita.' +
            '</div>' +
            '<button id="btn-new-niche-empty" class="primary-btn" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.85rem;padding:0.65rem 1.3rem;border-radius:12px;font-weight:700;">' +
                '<span class="material-icons-round" style="font-size:1rem;">auto_awesome</span>Crea + analizza prima nicchia' +
            '</button>' +
        '</div>'
    );
}

function buildNicheCard(n) {
    const statusConf = STATUS_CONFIG[n.status] || STATUS_CONFIG.researching;
    const validation = n.criteria_validation || {};
    const validCount = PAROZZI_CRITERIA.filter(c => validation[c.key]?.verdict === true).length;
    const totalCriteria = PAROZZI_CRITERIA.length;
    const geoScope = Array.isArray(n.geo_scope) ? n.geo_scope : [];
    const pain = Array.isArray(n.pain_points) ? n.pain_points : [];
    const isAnalyzed = !!n.analyzed_at;

    const validColor = validCount >= 4 ? '#10b981' : validCount >= 2 ? '#f59e0b' : '#ef4444';

    return (
        '<div class="niche-card" data-id="' + n.id + '" style="background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:16px;padding:1.25rem;cursor:pointer;transition:transform 0.2s, box-shadow 0.2s;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.75rem;gap:0.5rem;">' +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="font-size:1rem;font-weight:800;color:var(--text-primary);font-family:var(--font-titles);line-height:1.2;">' + escHtml(n.name) + '</div>' +
                    (isAnalyzed
                        ? '<div style="font-size:0.7rem;color:#8b5cf6;margin-top:3px;display:inline-flex;align-items:center;gap:3px;"><span class="material-icons-round" style="font-size:0.8rem;">auto_awesome</span>Analizzata AI</div>'
                        : '<div style="font-size:0.7rem;color:#f59e0b;margin-top:3px;display:inline-flex;align-items:center;gap:3px;"><span class="material-icons-round" style="font-size:0.8rem;">pending</span>Da analizzare</div>') +
                '</div>' +
                '<span style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.7rem;padding:3px 9px;border-radius:8px;background:' + statusConf.color + '15;color:' + statusConf.color + ';font-weight:700;flex-shrink:0;">' +
                    '<span class="material-icons-round" style="font-size:0.8rem;">' + statusConf.icon + '</span>' + statusConf.label +
                '</span>' +
            '</div>' +
            (n.description
                ? '<div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:0.75rem;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + escHtml(n.description) + '</div>'
                : '') +
            '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-bottom:0.75rem;padding:0.6rem;background:var(--bg-tertiary);border-radius:10px;">' +
                statCell('Prospect', n.prospects_count || 0, 'var(--text-primary)') +
                statCell('Comuni', geoScope.length, geoScope.length > 0 ? '#3b82f6' : 'var(--text-tertiary)') +
                statCell('Criteri', validCount + '/' + totalCriteria, validColor) +
            '</div>' +
            (pain.length > 0
                ? '<div style="margin-bottom:0.6rem;">' +
                    '<div style="font-size:0.66rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:3px;">Pain principale</div>' +
                    '<div style="font-size:0.78rem;color:var(--text-primary);line-height:1.4;">' + escHtml(truncate(pain[0], 110)) + '</div>' +
                  '</div>'
                : '') +
            (geoScope.length > 0
                ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:0.5rem;">' +
                    geoScope.slice(0, 5).map(c => '<span style="font-size:0.68rem;padding:2px 7px;border-radius:6px;background:#3b82f615;color:#3b82f6;font-weight:600;">' + escHtml(c) + '</span>').join('') +
                    (geoScope.length > 5 ? '<span style="font-size:0.68rem;color:var(--text-tertiary);padding:2px 4px;">+' + (geoScope.length - 5) + '</span>' : '') +
                  '</div>'
                : '') +
        '</div>'
    );
}

function statCell(label, value, color) {
    return (
        '<div>' +
            '<div style="font-size:0.62rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;">' + label + '</div>' +
            '<div style="font-size:1.05rem;font-weight:900;color:' + color + ';">' + value + '</div>' +
        '</div>'
    );
}

// ─── EVENTS ───────────────────────────────────────────────────────────────────

function bindEvents(container, niches) {
    const openNew = () => openNewNicheModal(() => renderSalesNiches(container));
    container.querySelector('#btn-new-niche')?.addEventListener('click', openNew);
    container.querySelector('#btn-new-niche-empty')?.addEventListener('click', openNew);

    container.querySelectorAll('.niche-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-2px)';
            card.style.boxShadow = 'var(--shadow-lg)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
            card.style.boxShadow = '';
        });
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            if (id) window.location.hash = 'sales-niche/' + id;
        });
    });
}

// ─── MODAL: NEW NICHE (AI-first) ─────────────────────────────────────────────

function openNewNicheModal(onSave) {
    const overlay = openOverlay('modal-new-niche');
    overlay.innerHTML = buildModalShell({
        title: 'Nuova nicchia',
        body:
            '<div id="new-niche-body">' +
                '<div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:1.25rem;line-height:1.5;">' +
                    'Scrivi il nome della nicchia. L\'AI analizza mercato, pain, linguaggio, comuni target e SAP candidati. ' +
                    'Poi rivedi e salvi.' +
                '</div>' +
                '<div>' +
                    '<label style="font-size:0.74rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">Nome nicchia *</label>' +
                    '<input id="new-niche-name" type="text" placeholder="Es. Strutture ricettive Liguria" ' +
                        'style="width:100%;padding:0.75rem;border-radius:12px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.95rem;box-sizing:border-box;">' +
                '</div>' +
                '<div id="new-niche-analysis" style="margin-top:1.25rem;"></div>' +
            '</div>',
        footer:
            '<button data-modal-close="1" style="padding:0.6rem 1.2rem;border-radius:12px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-secondary);font-size:0.85rem;font-weight:600;cursor:pointer;">Annulla</button>' +
            '<button id="btn-analyze-niche" class="primary-btn" style="padding:0.6rem 1.4rem;border-radius:12px;font-size:0.85rem;font-weight:700;display:inline-flex;align-items:center;gap:0.4rem;">' +
                '<span class="material-icons-round" style="font-size:1rem;">auto_awesome</span>Analizza con AI' +
            '</button>',
    });
    bindModalCloseButtons(overlay);

    const close = () => closeOverlay(overlay);

    overlay.querySelector('#btn-analyze-niche').addEventListener('click', async () => {
        const nameInput = overlay.querySelector('#new-niche-name');
        const name = nameInput?.value?.trim();
        if (!name) { showGlobalAlert('Scrivi il nome della nicchia', 'error'); return; }
        await runAnalyzeAndPreview(overlay, name, onSave, close);
    });

    overlay.querySelector('#new-niche-name')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') overlay.querySelector('#btn-analyze-niche').click();
    });
    setTimeout(() => overlay.querySelector('#new-niche-name')?.focus(), 100);
}

async function runAnalyzeAndPreview(overlay, name, onSave, close) {
    const btn = overlay.querySelector('#btn-analyze-niche');
    const analysisDiv = overlay.querySelector('#new-niche-analysis');

    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round" style="font-size:1rem;animation:spin 1s linear infinite;">refresh</span>Analizzo…';

    analysisDiv.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;padding:2rem;gap:0.75rem;color:var(--text-secondary);background:var(--bg-tertiary);border-radius:14px;">' +
            '<span class="material-icons-round" style="animation:spin 1s linear infinite;">auto_awesome</span>' +
            'AI sta analizzando "' + escHtml(name) + '"…' +
        '</div>';

    try {
        const analysis = await analyzeNiche(name);
        analysisDiv.innerHTML = buildAnalysisPreview(analysis);

        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons-round" style="font-size:1rem;">save</span>Salva nicchia';
        btn.onclick = async () => {
            await saveNewNicheFromAnalysis(name, analysis, onSave, close);
        };

        if (!overlay.querySelector('#btn-reanalyze')) {
            const reBtn = document.createElement('button');
            reBtn.id = 'btn-reanalyze';
            reBtn.style.cssText = 'padding:0.6rem 1.1rem;border-radius:12px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-secondary);font-size:0.82rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem;margin-right:0.5rem;';
            reBtn.innerHTML = '<span class="material-icons-round" style="font-size:1rem;">refresh</span>Rianalizza';
            reBtn.onclick = () => runAnalyzeAndPreview(overlay, name, onSave, close);
            btn.parentNode.insertBefore(reBtn, btn);
        }

    } catch (err) {
        console.error('[NicheAnalyzer] error', err);
        analysisDiv.innerHTML = '<div style="padding:1rem;color:#ef4444;font-size:0.85rem;background:#ef444408;border-radius:10px;">Errore AI: ' + escHtml(err.message) + '</div>';
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons-round" style="font-size:1rem;">auto_awesome</span>Riprova';
    }
}

async function saveNewNicheFromAnalysis(name, analysis, onSave, close) {
    try {
        const created = await upsertNiche({ name, status: 'researching' });
        await saveNicheAnalysis(created.id, analysis);
        showGlobalAlert('Nicchia creata + analizzata', 'success');
        close();
        onSave && onSave();
    } catch (err) {
        showGlobalAlert('Errore salvataggio: ' + err.message, 'error');
    }
}

function buildAnalysisPreview(a) {
    return (
        '<div style="border:1px solid #8b5cf622;background:linear-gradient(135deg, #8b5cf606, #3b82f606);border-radius:14px;padding:1.25rem;">' +
            '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:1rem;">' +
                '<span class="material-icons-round" style="font-size:1rem;color:#8b5cf6;">auto_awesome</span>' +
                '<span style="font-size:0.78rem;font-weight:800;color:#8b5cf6;text-transform:uppercase;letter-spacing:0.05em;">Anteprima analisi AI</span>' +
            '</div>' +
            (a.warnings && a.warnings.length > 0
                ? '<div style="background:#f59e0b15;border:1px solid #f59e0b40;border-radius:10px;padding:0.6rem 0.8rem;margin-bottom:1rem;font-size:0.78rem;color:#92400e;">' +
                    '⚠ ' + a.warnings.map(w => escHtml(w)).join(' · ') +
                  '</div>'
                : '') +
            (a.description ? section('Descrizione', '<div style="font-size:0.85rem;line-height:1.5;color:var(--text-primary);">' + escHtml(a.description) + '</div>') : '') +
            (a.market_size_estimate ? section('Dimensione mercato', '<div style="font-size:0.82rem;color:var(--text-primary);">' + escHtml(a.market_size_estimate) + '</div>') : '') +
            (a.criteria_validation ? section('Validazione 5 criteri', buildCriteriaList(a.criteria_validation)) : '') +
            (a.pain_points && a.pain_points.length > 0
                ? section('Pain points',
                    '<ul style="margin:0;padding-left:1.2rem;font-size:0.82rem;color:var(--text-primary);line-height:1.5;">' +
                        a.pain_points.map(p => '<li>' + escHtml(p) + '</li>').join('') +
                    '</ul>')
                : '') +
            (a.niche_language && Object.keys(a.niche_language).length > 0
                ? section('Linguaggio della nicchia', buildLanguageList(a.niche_language))
                : '') +
            (a.geo_scope && a.geo_scope.length > 0
                ? section('Comuni da attaccare (' + a.geo_scope.length + ')',
                    '<div style="display:flex;flex-wrap:wrap;gap:4px;">' +
                        a.geo_scope.map(c => '<span style="font-size:0.74rem;padding:3px 9px;border-radius:8px;background:#3b82f615;color:#3b82f6;font-weight:600;">' + escHtml(c) + '</span>').join('') +
                    '</div>')
                : '') +
            (a.sap_candidates && a.sap_candidates.length > 0
                ? section('SAP candidati', buildSapCandidatesList(a.sap_candidates))
                : '<div style="font-size:0.78rem;color:var(--text-tertiary);font-style:italic;padding:0.5rem;">Nessun SAP candidato (catalogo Gleeye poco documentato).</div>') +
        '</div>'
    );
}

function section(title, content) {
    return (
        '<div style="margin-bottom:1rem;">' +
            '<div style="font-size:0.7rem;font-weight:800;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.4rem;">' + title + '</div>' +
            content +
        '</div>'
    );
}

function buildCriteriaList(validation) {
    return (
        '<div style="display:flex;flex-direction:column;gap:0.5rem;">' +
            PAROZZI_CRITERIA.map(c => {
                const v = validation[c.key] || {};
                const passed = v.verdict === true;
                const color = passed ? '#10b981' : '#ef4444';
                const icon = passed ? 'check_circle' : 'cancel';
                return (
                    '<div style="display:grid;grid-template-columns:auto 1fr;gap:0.5rem;align-items:flex-start;padding:0.5rem 0.7rem;background:' + color + '08;border-radius:8px;border-left:3px solid ' + color + ';">' +
                        '<span class="material-icons-round" style="font-size:1rem;color:' + color + ';margin-top:2px;">' + icon + '</span>' +
                        '<div>' +
                            '<div style="font-size:0.78rem;font-weight:700;color:var(--text-primary);">' + c.label + '</div>' +
                            (v.rationale ? '<div style="font-size:0.74rem;color:var(--text-secondary);line-height:1.4;margin-top:2px;">' + escHtml(v.rationale) + '</div>' : '') +
                        '</div>' +
                    '</div>'
                );
            }).join('') +
        '</div>'
    );
}

function buildLanguageList(lang) {
    const entries = Object.entries(lang);
    if (entries.length === 0) return '<div style="font-size:0.78rem;color:var(--text-tertiary);">—</div>';
    return (
        '<div style="display:flex;flex-direction:column;gap:0.3rem;">' +
            entries.map(([term, meaning]) =>
                '<div style="display:grid;grid-template-columns:140px 1fr;gap:0.5rem;font-size:0.78rem;line-height:1.4;">' +
                    '<span style="font-weight:700;color:#8b5cf6;">' + escHtml(term) + '</span>' +
                    '<span style="color:var(--text-secondary);">' + escHtml(typeof meaning === 'string' ? meaning : JSON.stringify(meaning)) + '</span>' +
                '</div>'
            ).join('') +
        '</div>'
    );
}

function buildSapCandidatesList(sapCandidates) {
    const sorted = [...sapCandidates].sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
    return (
        '<div style="display:flex;flex-direction:column;gap:0.6rem;">' +
            sorted.map(s => {
                const score = s.relevance_score || 0;
                const scoreColor = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#94a3b8';
                return (
                    '<div style="background:var(--bg-primary);border:1px solid var(--glass-border);border-radius:10px;padding:0.7rem 0.9rem;">' +
                        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">' +
                            '<div style="font-size:0.85rem;font-weight:700;color:var(--text-primary);">' + escHtml(s.sap_name || '?') + '</div>' +
                            '<span style="font-size:0.7rem;font-weight:800;padding:2px 8px;border-radius:8px;background:' + scoreColor + '20;color:' + scoreColor + ';">' + score + '/100</span>' +
                        '</div>' +
                        (s.angle ? '<div style="font-size:0.76rem;color:var(--text-secondary);line-height:1.45;margin-bottom:0.3rem;"><strong>Angle:</strong> ' + escHtml(s.angle) + '</div>' : '') +
                        (s.pain_addressed ? '<div style="font-size:0.74rem;color:var(--text-secondary);line-height:1.45;"><strong>Pain:</strong> ' + escHtml(s.pain_addressed) + '</div>' : '') +
                        (s.mock_oto_formula ? '<div style="font-size:0.74rem;color:#8b5cf6;line-height:1.45;margin-top:0.3rem;font-style:italic;">"' + escHtml(s.mock_oto_formula) + '"</div>' : '') +
                    '</div>'
                );
            }).join('') +
        '</div>'
    );
}

// ─── PAGE: NICHE DETAIL (full-page, non più modal) ───────────────────────────

export async function renderNicheDetail(container, nicheId) {
    container.innerHTML = buildLoadingHTML();

    try {
        const niches = await fetchNiches();
        const niche = niches.find(n => n.id === nicheId);
        if (!niche) {
            container.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-tertiary);">Nicchia non trovata. <a href="#sales-niches" style="color:var(--brand-blue);">Torna alla lista</a></div>';
            return;
        }

        let relevance = [];
        let prospects = [];
        try {
            [relevance, prospects] = await Promise.all([
                fetchNicheSapRelevance(niche.id),
                fetchProspectsByNiche(niche.id),
            ]);
        } catch (err) {
            console.warn('[NicheDetail] load error', err);
        }

        const statusConf = STATUS_CONFIG[niche.status] || STATUS_CONFIG.researching;
        const onReload = () => renderNicheDetail(container, nicheId);

        container.innerHTML =
            '<div class="animate-fade-in" style="max-width:1200px;margin:0 auto;padding:1.5rem;">' +
                // Breadcrumb + Header
                '<div style="margin-bottom:1.5rem;">' +
                    '<a href="#sales-niches" style="display:inline-flex;align-items:center;gap:4px;font-size:0.78rem;color:var(--text-secondary);text-decoration:none;margin-bottom:0.5rem;font-weight:600;">' +
                        '<span class="material-icons-round" style="font-size:1rem;">arrow_back</span>Niche Research' +
                    '</a>' +
                    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">' +
                        '<div>' +
                            '<div style="display:flex;align-items:center;gap:0.6rem;">' +
                                '<h1 style="font-size:1.75rem;font-weight:800;font-family:var(--font-titles);color:var(--text-primary);margin:0;letter-spacing:-0.02em;">' + escHtml(niche.name) + '</h1>' +
                                '<span style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.75rem;padding:4px 10px;border-radius:8px;background:' + statusConf.color + '15;color:' + statusConf.color + ';font-weight:700;">' +
                                    '<span class="material-icons-round" style="font-size:0.85rem;">' + statusConf.icon + '</span>' + statusConf.label +
                                '</span>' +
                            '</div>' +
                            (niche.analyzed_at
                                ? '<div style="font-size:0.75rem;color:#8b5cf6;margin-top:4px;display:inline-flex;align-items:center;gap:3px;"><span class="material-icons-round" style="font-size:0.85rem;">auto_awesome</span>Analizzata AI · ' + new Date(niche.analyzed_at).toLocaleString('it-IT') + '</div>'
                                : '<div style="font-size:0.75rem;color:#f59e0b;margin-top:4px;">⚠ Non ancora analizzata</div>'
                            ) +
                        '</div>' +
                        '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
                            '<button id="btn-reanalyze-detail" style="padding:0.55rem 1rem;border-radius:10px;border:1px solid #8b5cf640;background:#8b5cf608;color:#8b5cf6;font-size:0.8rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem;">' +
                                '<span class="material-icons-round" style="font-size:1rem;">auto_awesome</span>' + (niche.analyzed_at ? 'Rianalizza' : 'Analizza con AI') +
                            '</button>' +
                            '<button id="btn-source-prospects" class="primary-btn" style="padding:0.55rem 1rem;border-radius:10px;font-size:0.82rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem;">' +
                                '<span class="material-icons-round" style="font-size:1rem;">travel_explore</span>Cerca prospect' +
                            '</button>' +
                            '<button id="btn-delete-niche" style="padding:0.55rem 0.9rem;border-radius:10px;background:#ef444415;color:#ef4444;border:none;font-size:0.78rem;font-weight:700;cursor:pointer;">Elimina</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                // Status + note quick edit
                '<div style="display:grid;grid-template-columns:1fr 2fr auto;gap:0.6rem;margin-bottom:1.5rem;align-items:flex-end;">' +
                    '<div>' +
                        '<label style="font-size:0.7rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:3px;">Status</label>' +
                        '<select id="detail-status" style="width:100%;padding:0.5rem 0.7rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;">' +
                            Object.entries(STATUS_CONFIG).map(([k, v]) =>
                                '<option value="' + k + '"' + (niche.status === k ? ' selected' : '') + '>' + v.label + '</option>'
                            ).join('') +
                        '</select>' +
                    '</div>' +
                    '<div>' +
                        '<label style="font-size:0.7rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:3px;">Note operative</label>' +
                        '<input id="detail-notes" type="text" value="' + escHtml(niche.notes || '') + '" placeholder="—" style="width:100%;padding:0.5rem 0.7rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;box-sizing:border-box;">' +
                    '</div>' +
                    '<button id="btn-save-meta" style="font-size:0.78rem;padding:0.5rem 0.9rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-secondary);cursor:pointer;font-weight:600;height:fit-content;">Salva</button>' +
                '</div>' +
                // Body: analisi AI + prospect
                '<div id="niche-detail-body">' +
                    (niche.analyzed_at
                        ? buildAnalysisPreviewFromNiche(niche, relevance)
                        : '<div style="text-align:center;padding:2rem;border:2px dashed var(--glass-border);border-radius:14px;color:var(--text-tertiary);margin-bottom:1.5rem;">' +
                            '<span class="material-icons-round" style="font-size:2.5rem;opacity:0.4;display:block;margin-bottom:0.5rem;">psychology</span>' +
                            '<div style="font-size:0.88rem;font-weight:600;color:var(--text-primary);margin-bottom:0.3rem;">Nicchia non ancora analizzata</div>' +
                            '<div style="font-size:0.78rem;">Clicca "Analizza con AI" in alto per popolare descrizione, criteri, pain, comuni, SAP candidati.</div>' +
                          '</div>'
                    ) +
                    buildProspectsSection(prospects) +
                '</div>' +
            '</div>';

        bindDetailPageEvents(container, niche, prospects, onReload);

    } catch (err) {
        console.error('[NicheDetail] render error', err);
        container.innerHTML = '<div style="padding:2rem;color:red;">Errore: ' + escHtml(err.message) + '</div>';
    }
}

function bindDetailPageEvents(container, niche, prospects, onReload) {
    bindProspectsSectionEvents(container, niche, onReload, prospects || []);

    container.querySelector('#btn-delete-niche')?.addEventListener('click', async () => {
        const ok = await showConfirm('Eliminare la nicchia "' + niche.name + '"? L\'azione cancella anche analisi AI, SAP relevance e prospect collegati.', 'Elimina', 'Annulla');
        if (!ok) return;
        try {
            await deleteNiche(niche.id);
            showGlobalAlert('Nicchia eliminata', 'success');
            window.location.hash = 'sales-niches';
        } catch (err) {
            showGlobalAlert('Errore: ' + err.message, 'error');
        }
    });

    container.querySelector('#btn-save-meta')?.addEventListener('click', async () => {
        const status = container.querySelector('#detail-status').value;
        const notes  = container.querySelector('#detail-notes').value.trim() || null;
        try {
            await upsertNiche({ id: niche.id, status, notes });
            showGlobalAlert('Salvato', 'success');
            onReload();
        } catch (err) {
            showGlobalAlert('Errore: ' + err.message, 'error');
        }
    });

    container.querySelector('#btn-source-prospects')?.addEventListener('click', () => {
        openSourcingModal(niche, () => onReload());
    });

    container.querySelector('#btn-reanalyze-detail')?.addEventListener('click', async () => {
        const btn = container.querySelector('#btn-reanalyze-detail');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-icons-round" style="font-size:1rem;animation:spin 1s linear infinite;">refresh</span>Analizzo…';
        try {
            const analysis = await analyzeNiche(niche.name);
            await saveNicheAnalysis(niche.id, analysis);
            showGlobalAlert('Nicchia rianalizzata', 'success');
            onReload();
        } catch (err) {
            console.error('[NicheReanalyze] error', err);
            showGlobalAlert('Errore AI: ' + err.message, 'error');
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-round" style="font-size:1rem;">auto_awesome</span>Riprova';
        }
    });
}

function buildProspectsSection(prospects) {
    const total = prospects.length;
    const sourced = prospects.filter(p => p.pipeline_stage === 'sourced').length;
    const inPipeline = prospects.filter(p => p.pipeline_stage && p.pipeline_stage !== 'sourced').length;
    const analyzed = prospects.filter(p => p.ai_enrichment_data && p.ai_enrichment_data.layer1_at).length;
    const promising = prospects.filter(p => {
        const s = p.ai_enrichment_data && p.ai_enrichment_data.promising_score;
        return s != null && s >= 70;
    }).length;

    return (
        '<div style="margin-top:2rem;padding-top:1.5rem;border-top:2px solid var(--glass-border);">' +
            // Header sezione
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:0.5rem;">' +
                '<div>' +
                    '<div style="font-size:0.95rem;font-weight:800;color:var(--text-primary);font-family:var(--font-titles);">Prospect della nicchia</div>' +
                    '<div style="font-size:0.72rem;color:var(--text-tertiary);margin-top:2px;">' +
                        total + ' totali · ' + sourced + ' sourceati · ' + analyzed + ' analizzati AI · ' + promising + ' promettenti · ' + inPipeline + ' in pipeline' +
                    '</div>' +
                '</div>' +
            '</div>' +
            (total === 0
                ? '<div style="padding:1.5rem;text-align:center;border:2px dashed var(--glass-border);border-radius:12px;color:var(--text-tertiary);">' +
                    '<div style="font-size:0.85rem;">Nessun prospect ancora. Clicca <strong>"Cerca prospect"</strong> in basso per sourceare via OSM.</div>' +
                  '</div>'
                : buildProspectsTable(prospects)
            ) +
        '</div>'
    );
}

function buildProspectsTable(prospects) {
    // Ordina: promettenti ≥70 prima, poi analizzati, poi resto
    const sorted = [...prospects].sort((a, b) => {
        const sa = (a.ai_enrichment_data && a.ai_enrichment_data.promising_score) || -1;
        const sb = (b.ai_enrichment_data && b.ai_enrichment_data.promising_score) || -1;
        return sb - sa;
    });

    return (
        // Toolbar bulk actions
        '<div id="np-toolbar" style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;margin-bottom:0.6rem;padding:0.5rem;background:var(--bg-tertiary);border-radius:10px;">' +
            '<label style="display:inline-flex;align-items:center;gap:5px;font-size:0.78rem;color:var(--text-secondary);font-weight:600;cursor:pointer;">' +
                '<input type="checkbox" id="np-select-all" style="cursor:pointer;">' +
                '<span>Seleziona tutti</span>' +
            '</label>' +
            '<span id="np-selected-count" style="font-size:0.74rem;color:var(--text-tertiary);font-weight:600;">0 selezionati</span>' +
            '<div style="flex:1;"></div>' +
            '<button id="np-bulk-analyze" disabled style="font-size:0.74rem;padding:5px 10px;border-radius:8px;border:1px solid #8b5cf640;background:#8b5cf608;color:#8b5cf6;cursor:pointer;font-weight:700;display:inline-flex;align-items:center;gap:4px;opacity:0.5;">' +
                '<span class="material-icons-round" style="font-size:0.85rem;">auto_awesome</span>Analizza AI' +
            '</button>' +
            '<button id="np-bulk-promote" disabled style="font-size:0.74rem;padding:5px 10px;border-radius:8px;border:1px solid #10b98140;background:#10b98108;color:#10b981;cursor:pointer;font-weight:700;display:inline-flex;align-items:center;gap:4px;opacity:0.5;">' +
                '<span class="material-icons-round" style="font-size:0.85rem;">arrow_forward</span>Promuovi in pipeline' +
            '</button>' +
            '<button id="np-bulk-delete" disabled style="font-size:0.74rem;padding:5px 10px;border-radius:8px;border:1px solid #ef444440;background:#ef444408;color:#ef4444;cursor:pointer;font-weight:700;opacity:0.5;">Elimina</button>' +
        '</div>' +
        // Progress bar (hidden)
        '<div id="np-progress" style="display:none;margin-bottom:0.6rem;padding:0.6rem 0.8rem;background:#8b5cf608;border:1px solid #8b5cf640;border-radius:10px;font-size:0.78rem;color:#8b5cf6;font-weight:600;"></div>' +
        // Tabella
        '<div style="max-height:400px;overflow-y:auto;border:1px solid var(--glass-border);border-radius:10px;">' +
            sorted.map(p => buildProspectRow(p)).join('') +
        '</div>'
    );
}

function buildProspectRow(p) {
    const e = p.ai_enrichment_data || {};
    const score = e.promising_score;
    const inPipeline = p.pipeline_stage && p.pipeline_stage !== 'sourced';
    const stageColors = {
        sourced: '#94a3b8',
        cold: '#3b82f6',
        contacted: '#3b82f6',
        replied: '#f59e0b',
        proposal_sent: '#8b5cf6',
        converted: '#10b981',
    };
    const stageColor = stageColors[p.pipeline_stage] || '#94a3b8';
    const scoreColor = score == null ? '#94a3b8' : score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';

    // Completeness Layer 0 (deterministico): badge separato dal promising_score (AI)
    const completeness = p.completeness_score != null ? Number(p.completeness_score) : null;
    const compColor = completeness == null ? '#94a3b8' : completeness >= 60 ? '#10b981' : completeness >= 30 ? '#f59e0b' : '#ef4444';
    const compIcon = completeness == null ? 'hourglass_empty' : completeness >= 60 ? 'check_circle_outline' : completeness >= 30 ? 'pending' : 'warning';

    // Il <div> esterno NON ha listener click né cursor:pointer.
    // SOLO l'area centrale `.np-row-open` ha listener (apre modal prospect).
    // Il checkbox `.np-check` è isolato, click solo lì → solo seleziona.
    return (
        '<div class="np-row" data-id="' + p.id + '" style="display:grid;grid-template-columns:auto 1fr auto auto auto auto;gap:0.6rem;align-items:center;padding:0.6rem 0.8rem;border-bottom:1px solid var(--glass-border);font-size:0.8rem;transition:background 0.15s;" onmouseover="this.style.background=\'var(--bg-tertiary)\'" onmouseout="this.style.background=\'\'">' +
            '<label style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;cursor:pointer;" title="Seleziona prospect">' +
                '<input type="checkbox" class="np-check" data-id="' + p.id + '" style="cursor:pointer;width:16px;height:16px;">' +
            '</label>' +
            '<div class="np-row-open" data-id="' + p.id + '" style="min-width:0;cursor:pointer;" title="Apri dettaglio prospect">' +
                '<div style="font-weight:700;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(p.business_name) + ' <span style="font-size:0.65rem;color:var(--text-tertiary);font-weight:500;">↗ dettaglio</span></div>' +
                '<div style="font-size:0.7rem;color:var(--text-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
                    (e.city_origin ? '📍 ' + escHtml(e.city_origin) + ' · ' : '') +
                    (p.website ? escHtml(p.website.replace(/^https?:\/\//, '').slice(0, 40)) : '') +
                '</div>' +
            '</div>' +
            // Completeness L0 (deterministico)
            '<span style="display:inline-flex;align-items:center;gap:2px;font-size:0.7rem;font-weight:800;padding:2px 7px;border-radius:6px;background:' + compColor + '15;color:' + compColor + ';white-space:nowrap;" title="Completezza dati (Layer 0)">' +
                '<span class="material-icons-round" style="font-size:0.8rem;">' + compIcon + '</span>' +
                (completeness != null ? completeness : '—') +
            '</span>' +
            // Promising L1 (AI)
            (score != null
                ? '<span style="font-size:0.7rem;font-weight:800;padding:2px 7px;border-radius:6px;background:' + scoreColor + '20;color:' + scoreColor + ';white-space:nowrap;" title="Promising score AI">' + score + '/100</span>'
                : '<span style="font-size:0.68rem;color:var(--text-tertiary);">—</span>') +
            '<span style="font-size:0.65rem;font-weight:700;padding:2px 7px;border-radius:6px;background:' + stageColor + '15;color:' + stageColor + ';text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap;">' + (p.pipeline_stage || 'sourced') + '</span>' +
            (inPipeline
                ? '<span class="material-icons-round" style="font-size:1rem;color:#10b981;" title="In pipeline outreach">check_circle</span>'
                : '<span class="material-icons-round" style="font-size:1rem;color:#cbd5e1;" title="Non in pipeline">radio_button_unchecked</span>') +
        '</div>'
    );
}

function buildAnalysisPreviewFromNiche(n, relevance) {
    const candidates = relevance.map(r => ({
        sap_id: r.sap_id,
        sap_name: r.sap?.name,
        relevance_score: r.relevance_score,
        angle: r.angle,
        pain_addressed: r.pain_addressed,
        mock_oto_formula: r.mock_oto_formula,
    }));

    return buildAnalysisPreview({
        description:          n.description,
        market_size_estimate: n.market_size_estimate,
        criteria_validation:  n.criteria_validation,
        pain_points:          n.pain_points,
        niche_language:       n.niche_language,
        geo_scope:            n.geo_scope,
        sap_candidates:       candidates,
        warnings:             [],
    });
}

// ─── PROSPECTS SECTION EVENTS ────────────────────────────────────────────────

function bindProspectsSectionEvents(overlay, niche, onSave, prospects) {
    // Click su .np-row-open (area centrale info nome) → apre modal prospect.
    // Checkbox e badge sono FUORI da .np-row-open → click su di loro NON triggera il modal.
    overlay.querySelectorAll('.np-row-open').forEach(opener => {
        opener.addEventListener('click', async (e) => {
            const id = opener.dataset.id;
            const prospect = prospects.find(p => p.id === id);
            if (!prospect) return;
            try {
                const sapServices = await fetchSapServicesForSales();
                openProspectModal(prospect, sapServices, async () => {
                    onSave && onSave();
                });
            } catch (err) {
                showGlobalAlert('Errore apertura: ' + err.message, 'error');
            }
        });
    });

    const checks = overlay.querySelectorAll('.np-check');
    if (checks.length === 0) return;
    const selectAll = overlay.querySelector('#np-select-all');
    const countSpan = overlay.querySelector('#np-selected-count');
    const btnAnalyze = overlay.querySelector('#np-bulk-analyze');
    const btnPromote = overlay.querySelector('#np-bulk-promote');
    const btnDelete = overlay.querySelector('#np-bulk-delete');

    const updateCount = () => {
        const selected = overlay.querySelectorAll('.np-check:checked');
        const n = selected.length;
        countSpan.textContent = n + ' selezionati';
        [btnAnalyze, btnPromote, btnDelete].forEach(b => {
            b.disabled = n === 0;
            b.style.opacity = n === 0 ? '0.5' : '1';
        });
        // Sync select-all checkbox
        selectAll.checked = n > 0 && n === checks.length;
    };

    checks.forEach(c => c.addEventListener('change', updateCount));
    selectAll.addEventListener('change', () => {
        checks.forEach(c => { c.checked = selectAll.checked; });
        updateCount();
    });

    const getSelectedIds = () => Array.from(overlay.querySelectorAll('.np-check:checked')).map(c => c.dataset.id);

    btnAnalyze.addEventListener('click', async () => {
        const ids = getSelectedIds();
        if (ids.length === 0) return;
        await runBulkAnalyze(overlay, niche, ids, prospects, onSave);
    });

    btnPromote.addEventListener('click', async () => {
        const ids = getSelectedIds();
        if (ids.length === 0) return;
        const ok = await showConfirm(ids.length + ' prospect spostati in pipeline outreach (stato Cold). Continuare?', 'Promuovi', 'Annulla');
        if (!ok) return;
        try {
            await promoteProspectsToPipeline(ids);
            showGlobalAlert(ids.length + ' prospect promossi in pipeline', 'success');
            onSave && onSave();
        } catch (err) {
            showGlobalAlert('Errore: ' + err.message, 'error');
        }
    });

    btnDelete.addEventListener('click', async () => {
        const ids = getSelectedIds();
        if (ids.length === 0) return;
        const ok = await showConfirm('Eliminare ' + ids.length + ' prospect? Operazione irreversibile.', 'Elimina', 'Annulla');
        if (!ok) return;
        try {
            await bulkDeleteProspects(ids);
            showGlobalAlert(ids.length + ' prospect eliminati', 'success');
            onSave && onSave();
        } catch (err) {
            showGlobalAlert('Errore: ' + err.message, 'error');
        }
    });

    updateCount();
}

async function runBulkAnalyze(overlay, niche, ids, prospects, onSave) {
    const progressDiv = overlay.querySelector('#np-progress');
    progressDiv.style.display = 'block';

    const targets = prospects.filter(p => ids.includes(p.id));
    let done = 0;
    let failed = 0;
    let l2Triggered = 0;
    const total = targets.length;

    const updateProgress = (current, t, l2) => {
        progressDiv.innerHTML = '<span class="material-icons-round" style="font-size:0.95rem;animation:spin 1s linear infinite;vertical-align:-3px;">refresh</span> Analizzo prospect ' + (current + 1) + '/' + total + (l2 > 0 ? ' · Layer 2 auto: ' + l2 : '') + ' — ' + escHtml(t.business_name);
    };

    for (let i = 0; i < targets.length; i++) {
        const p = targets[i];
        updateProgress(i, p, l2Triggered);
        try {
            // Step 1: scraping sito (se URL presente)
            let scrapeData = null;
            if (p.website) {
                scrapeData = await scrapeProspectSite(p.website);
            }

            // Step 2: Layer 1 AI
            const r1 = await runLayer1AI(p, scrapeData);
            let enrichment = {
                ...(p.ai_enrichment_data || {}),
                descrizione_lampo:      r1.descrizione_lampo || null,
                chi_sono_cosa_fanno:    r1.chi_sono_cosa_fanno || null,
                prodotti_servizi:       r1.prodotti_servizi || null,
                clientela_target:       r1.clientela_target || null,
                punto_distintivo:       r1.punto_distintivo || null,
                industry:               r1.industry || null,
                company_size:           r1.company_size || null,
                location:               r1.location || null,
                revenue_estimate:       r1.revenue_estimate || null,
                promising_score:        r1.promising_score != null ? Number(r1.promising_score) : null,
                promising_rationale:    r1.promising_rationale || null,
                layer1_at:              new Date().toISOString(),
            };
            // DB lean: il testo raw dello scraping non viene salvato. last_scrape rimosso.
            delete enrichment.last_scrape;

            // Lean update fields (email, phone, social_links, completeness_score) derivati dal scrape in memoria
            const leanFields = buildLeanUpdatePayload(p, scrapeData);

            // Step 3: Layer 2 se promettente
            if (enrichment.promising_score >= 70) {
                try {
                    const tempProspect = { ...p, ai_enrichment_data: enrichment };
                    const r2 = await runLayer2AI(tempProspect, scrapeData);
                    enrichment = {
                        ...enrichment,
                        competitor:             r2.competitor || null,
                        punti_forza:            r2.punti_forza || null,
                        punti_debolezza:        r2.punti_debolezza || null,
                        analisi_swot:           r2.analisi_swot || null,
                        news_recenti:           r2.news_recenti || null,
                        testimonianze:          r2.testimonianze || null,
                        presenza_online:        r2.presenza_online || null,
                        opportunita_marketing:  r2.opportunita_marketing || null,
                        sap_candidati:          r2.sap_candidati || null,
                        fattibilita_note:       r2.fattibilita_note || null,
                        fattibilita_score:      r2.fattibilita_score != null ? Number(r2.fattibilita_score) : null,
                        layer2_at:              new Date().toISOString(),
                    };
                    l2Triggered++;
                } catch (l2Err) {
                    console.warn('[bulk L2] error on', p.business_name, l2Err);
                }
            }
            await upsertProspect({
                id: p.id,
                ai_enrichment_data: enrichment,
                industry: p.industry || r1.industry || null,
                ...leanFields,
            });
            done++;
        } catch (err) {
            console.error('[bulk L1] error on', p.business_name, err);
            failed++;
        }
    }

    progressDiv.innerHTML = '✓ Completati: ' + done + '/' + total + (failed > 0 ? ' · Falliti: ' + failed : '') + (l2Triggered > 0 ? ' · Layer 2 auto: ' + l2Triggered : '');
    showGlobalAlert('Bulk analisi: ' + done + ' OK, ' + failed + ' falliti, ' + l2Triggered + ' Layer 2 auto', 'success');

    setTimeout(() => {
        onSave && onSave();
    }, 1500);
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(str, max) {
    if (!str) return '';
    const s = String(str);
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
