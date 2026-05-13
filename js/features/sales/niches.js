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

import { fetchNiches, upsertNiche, fetchIndustrySectors } from './api.js?v=8001';
import { showGlobalAlert } from '../../modules/utils.js?v=8000';
import { analyzeNiche, saveNicheAnalysis, PAROZZI_CRITERIA } from './niche_analyzer.js?v=8001';
import { openOverlay, buildModalShell, closeOverlay, bindModalCloseButtons } from './_modal.js?v=8001';

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
                    '<div style="display:flex;gap:6px;align-items:center;margin-top:3px;flex-wrap:wrap;">' +
                        (n.sector
                            ? '<span style="display:inline-flex;align-items:center;gap:3px;font-size:0.66rem;padding:2px 7px;border-radius:6px;background:#3b82f615;color:#3b82f6;font-weight:700;">' +
                                '<span class="material-icons-round" style="font-size:0.75rem;">' + (n.sector.icon || 'category') + '</span>' + escHtml(n.sector.name) +
                              '</span>'
                            : '') +
                        (isAnalyzed
                            ? '<span style="font-size:0.66rem;color:#8b5cf6;display:inline-flex;align-items:center;gap:3px;font-weight:600;"><span class="material-icons-round" style="font-size:0.75rem;">auto_awesome</span>Analizzata AI</span>'
                            : '<span style="font-size:0.66rem;color:#f59e0b;display:inline-flex;align-items:center;gap:3px;font-weight:600;"><span class="material-icons-round" style="font-size:0.75rem;">pending</span>Da analizzare</span>') +
                    '</div>' +
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

async function openNewNicheModal(onSave) {
    // Carica settori PRIMA di aprire (così il dropdown è già popolato)
    let sectors = [];
    try {
        sectors = await fetchIndustrySectors();
    } catch (err) {
        console.warn('[NewNicheModal] sectors load failed', err);
    }

    const overlay = openOverlay('modal-new-niche');
    const sectorOptionsHTML = '<option value="">— scegli settore —</option>' +
        sectors.map(s => '<option value="' + s.id + '">' + escHtml(s.name) + '</option>').join('');

    overlay.innerHTML = buildModalShell({
        title: 'Nuova nicchia',
        body:
            '<div id="new-niche-body">' +
                '<div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:1.25rem;line-height:1.5;">' +
                    'Scegli il <strong>settore di mercato</strong> e dai un nome alla nicchia. L\'AI userà il settore come contesto per filtrare SAP rilevanti, linguaggio, pain tipici.' +
                '</div>' +
                '<div style="display:grid;grid-template-columns:1fr 2fr;gap:0.75rem;">' +
                    '<div>' +
                        '<label style="font-size:0.74rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">Settore *</label>' +
                        '<select id="new-niche-sector" style="width:100%;padding:0.75rem;border-radius:12px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.95rem;box-sizing:border-box;">' +
                            sectorOptionsHTML +
                        '</select>' +
                    '</div>' +
                    '<div>' +
                        '<label style="font-size:0.74rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">Nome nicchia *</label>' +
                        '<input id="new-niche-name" type="text" placeholder="Es. Strutture ricettive Liguria" ' +
                            'style="width:100%;padding:0.75rem;border-radius:12px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.95rem;box-sizing:border-box;">' +
                    '</div>' +
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
        const sectorSelect = overlay.querySelector('#new-niche-sector');
        const name = nameInput?.value?.trim();
        const sectorId = sectorSelect?.value;
        if (!name) { showGlobalAlert('Scrivi il nome della nicchia', 'error'); return; }
        if (!sectorId) { showGlobalAlert('Scegli il settore di mercato', 'error'); return; }
        const sector = sectors.find(s => s.id === sectorId);
        await runAnalyzeAndPreview(overlay, name, sector, onSave, close);
    });

    overlay.querySelector('#new-niche-name')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') overlay.querySelector('#btn-analyze-niche').click();
    });
    setTimeout(() => overlay.querySelector('#new-niche-sector')?.focus(), 100);
}

async function runAnalyzeAndPreview(overlay, name, sector, onSave, close) {
    const btn = overlay.querySelector('#btn-analyze-niche');
    const analysisDiv = overlay.querySelector('#new-niche-analysis');

    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round" style="font-size:1rem;animation:spin 1s linear infinite;">refresh</span>Analizzo…';

    analysisDiv.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;padding:2rem;gap:0.75rem;color:var(--text-secondary);background:var(--bg-tertiary);border-radius:14px;">' +
            '<span class="material-icons-round" style="animation:spin 1s linear infinite;">auto_awesome</span>' +
            'AI sta analizzando "' + escHtml(name) + '" (settore: ' + escHtml(sector?.name || '—') + ')…' +
        '</div>';

    try {
        const analysis = await analyzeNiche(name, sector);
        analysisDiv.innerHTML = buildAnalysisPreview(analysis);

        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons-round" style="font-size:1rem;">save</span>Salva nicchia';
        btn.onclick = async () => {
            await saveNewNicheFromAnalysis(name, sector, analysis, onSave, close);
        };

        if (!overlay.querySelector('#btn-reanalyze')) {
            const reBtn = document.createElement('button');
            reBtn.id = 'btn-reanalyze';
            reBtn.style.cssText = 'padding:0.6rem 1.1rem;border-radius:12px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-secondary);font-size:0.82rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem;margin-right:0.5rem;';
            reBtn.innerHTML = '<span class="material-icons-round" style="font-size:1rem;">refresh</span>Rianalizza';
            reBtn.onclick = () => runAnalyzeAndPreview(overlay, name, sector, onSave, close);
            btn.parentNode.insertBefore(reBtn, btn);
        }

    } catch (err) {
        console.error('[NicheAnalyzer] error', err);
        analysisDiv.innerHTML = '<div style="padding:1rem;color:#ef4444;font-size:0.85rem;background:#ef444408;border-radius:10px;">Errore AI: ' + escHtml(err.message) + '</div>';
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons-round" style="font-size:1rem;">auto_awesome</span>Riprova';
    }
}

async function saveNewNicheFromAnalysis(name, sector, analysis, onSave, close) {
    try {
        const created = await upsertNiche({ name, sector_id: sector?.id || null, status: 'researching' });
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
