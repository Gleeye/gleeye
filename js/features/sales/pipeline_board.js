/**
 * sales/pipeline_board.js
 * Kanban a 5 colonne per la pipeline outbound: Cold → Convertito.
 */

import { PIPELINE_STAGES, ACQUISITION_SOURCES, fetchProspects, fetchSapServicesForSales, upsertProspect, deleteProspect, moveProspectStage } from './api.js?v=8001';
import { showGlobalAlert, showConfirm } from '../../modules/utils.js?v=8000';
import { renderEnrichmentTab } from './enrichment.js?v=8001';
import { renderOutreachDrafter } from './outreach.js?v=8001';
import { renderDiscoveryTab } from './discovery_notes.js?v=8001';
import { renderOfferBuilderTab } from './offer_builder.js?v=8001';

// ─── RENDER PRINCIPALE ────────────────────────────────────────────────────────

export async function renderPipelineBoard(container) {
    container.innerHTML = buildLoadingHTML();

    try {
        const [allProspects, sapServices] = await Promise.all([
            fetchProspects(),
            fetchSapServicesForSales(),
        ]);
        // Esclude prospect 'sourced' (vivono dentro la nicchia, non ancora in outreach attivo).
        const prospects = allProspects.filter(p => p.pipeline_stage !== 'sourced');
        const sourcedCount = allProspects.length - prospects.length;
        container.innerHTML = buildBoardHTML(prospects, sapServices, sourcedCount);
        bindBoardEvents(container, prospects, sapServices);
    } catch (err) {
        console.error('[Pipeline] render error', err);
        container.innerHTML = '<p style="padding:2rem;color:red;">Errore caricamento pipeline: ' + err.message + '</p>';
    }
}

// ─── HTML HELPERS ─────────────────────────────────────────────────────────────

function buildLoadingHTML() {
    return '<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--text-secondary);gap:0.75rem;"><span class="material-icons-round" style="animation:spin 1s linear infinite;">refresh</span>Caricamento pipeline…</div>';
}

function buildBoardHTML(prospects, sapServices, sourcedCount) {
    const stageCounts = {};
    PIPELINE_STAGES.forEach(s => { stageCounts[s.key] = 0; });
    prospects.forEach(p => { if (stageCounts[p.pipeline_stage] !== undefined) stageCounts[p.pipeline_stage]++; });

    const totalActive = prospects.filter(p => p.pipeline_stage !== 'converted').length;
    const totalConverted = stageCounts['converted'] || 0;

    const columnsHTML = PIPELINE_STAGES.map(stage => buildColumnHTML(stage, prospects.filter(p => p.pipeline_stage === stage.key))).join('');

    const sourcedNote = sourcedCount > 0
        ? ' · <a href="#sales-niches" style="color:#8b5cf6;text-decoration:none;font-weight:600;">' + sourcedCount + ' nelle nicchie da promuovere</a>'
        : '';

    return (
        '<div class="animate-fade-in" style="max-width:100%;padding:1.5rem;">' +
            // header
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">' +
                '<div>' +
                    '<h1 style="font-size:1.75rem;font-weight:800;font-family:var(--font-titles);color:var(--text-primary);margin:0;letter-spacing:-0.02em;">Pipeline Vendite</h1>' +
                    '<div style="font-size:0.85rem;color:var(--text-tertiary);margin-top:0.25rem;">' +
                        totalActive + ' prospect attivi · ' + totalConverted + ' convertiti' + sourcedNote +
                    '</div>' +
                '</div>' +
                '<div style="display:flex;gap:0.75rem;">' +
                    '<a href="#sales-metrics" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.82rem;padding:0.5rem 1rem;border-radius:10px;font-weight:600;color:var(--text-secondary);border:1px solid var(--glass-border);text-decoration:none;background:var(--bg-secondary);">' +
                        '<span class="material-icons-round" style="font-size:1rem;">bar_chart</span>Metriche' +
                    '</a>' +
                    '<button id="btn-new-prospect" class="primary-btn" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.82rem;padding:0.5rem 1rem;border-radius:10px;font-weight:700;">' +
                        '<span class="material-icons-round" style="font-size:1rem;">add</span>Nuovo Prospect' +
                    '</button>' +
                '</div>' +
            '</div>' +
            // kanban board
            '<div style="display:flex;gap:1rem;overflow-x:auto;padding-bottom:1rem;min-height:500px;">' +
                columnsHTML +
            '</div>' +
        '</div>'
    );
}

function buildColumnHTML(stage, cards) {
    const cardsHTML = cards.length > 0
        ? cards.map(p => buildCardHTML(p, stage)).join('')
        : '<div style="text-align:center;padding:2rem 1rem;color:var(--text-tertiary);font-size:0.8rem;border:2px dashed var(--glass-border);border-radius:12px;margin-top:0.5rem;">Nessun prospect</div>';

    return (
        '<div class="pipeline-col" data-stage="' + stage.key + '" style="min-width:260px;flex:1;background:var(--bg-secondary);border-radius:16px;padding:1rem;border:1px solid var(--glass-border);">' +
            '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;padding-bottom:0.75rem;border-bottom:2px solid ' + stage.color + '30;">' +
                '<span class="material-icons-round" style="font-size:1.1rem;color:' + stage.color + ';">' + stage.icon + '</span>' +
                '<span style="font-weight:700;font-size:0.85rem;color:var(--text-primary);">' + stage.label + '</span>' +
                '<span style="margin-left:auto;background:' + stage.color + '20;color:' + stage.color + ';padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:800;">' + cards.length + '</span>' +
            '</div>' +
            '<div class="pipeline-cards">' + cardsHTML + '</div>' +
        '</div>'
    );
}

function buildCardHTML(prospect, stage) {
    const sourceLabel = ACQUISITION_SOURCES.find(s => s.key === prospect.acquisition_source)?.label || prospect.acquisition_source || 'Outreach';
    const sapName = prospect.target_sap?.name || '';
    const enriched = prospect.ai_enrichment_data && Object.keys(prospect.ai_enrichment_data).length > 0;
    const hasEmail = !!prospect.contact_email;

    const stageOptions = PIPELINE_STAGES.map(s =>
        '<option value="' + s.key + '"' + (s.key === stage.key ? ' selected' : '') + '>' + s.label + '</option>'
    ).join('');

    return (
        '<div class="prospect-card" data-id="' + prospect.id + '" style="background:var(--bg-primary);border:1px solid var(--glass-border);border-radius:12px;padding:0.85rem;margin-bottom:0.6rem;cursor:pointer;transition:box-shadow 0.2s,transform 0.15s;" ' +
            'onmouseover="this.style.boxShadow=\'var(--shadow-md)\';this.style.transform=\'translateY(-1px)\'" ' +
            'onmouseout="this.style.boxShadow=\'none\';this.style.transform=\'none\'">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;">' +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="font-weight:700;font-size:0.85rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escHtml(prospect.business_name) + '</div>' +
                    (prospect.contact_name ? '<div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">' + escHtml(prospect.contact_name) + '</div>' : '') +
                '</div>' +
                '<span style="font-size:0.65rem;color:var(--text-tertiary);white-space:nowrap;flex-shrink:0;">' + escHtml(prospect.prospect_code) + '</span>' +
            '</div>' +
            // tags
            '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:0.6rem;">' +
                '<span style="font-size:0.67rem;padding:2px 7px;border-radius:10px;background:var(--bg-tertiary);color:var(--text-tertiary);font-weight:600;">' + escHtml(sourceLabel) + '</span>' +
                (sapName ? '<span style="font-size:0.67rem;padding:2px 7px;border-radius:10px;background:#8b5cf615;color:#8b5cf6;font-weight:600;">' + escHtml(sapName) + '</span>' : '') +
                (enriched ? '<span style="font-size:0.67rem;padding:2px 7px;border-radius:10px;background:#10b98115;color:#10b981;font-weight:600;">✦ AI</span>' : '') +
            '</div>' +
            // stage selector + actions row
            '<div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.75rem;" onclick="event.stopPropagation();">' +
                '<select class="stage-select" data-id="' + prospect.id + '" style="flex:1;font-size:0.72rem;padding:4px 6px;border-radius:8px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);cursor:pointer;">' +
                    stageOptions +
                '</select>' +
                (hasEmail
                    ? '<button class="card-action-btn btn-outreach" data-id="' + prospect.id + '" title="Genera email outreach" style="background:#3b82f615;color:#3b82f6;border:none;border-radius:8px;padding:4px 7px;cursor:pointer;font-size:0.75rem;display:flex;align-items:center;gap:3px;font-weight:600;">' +
                        '<span class="material-icons-round" style="font-size:0.9rem;">auto_awesome</span>' +
                      '</button>'
                    : '') +
                '<button class="card-action-btn btn-open" data-id="' + prospect.id + '" title="Apri dettaglio" style="background:var(--bg-tertiary);color:var(--text-secondary);border:none;border-radius:8px;padding:4px 7px;cursor:pointer;font-size:0.75rem;display:flex;align-items:center;">' +
                    '<span class="material-icons-round" style="font-size:0.9rem;">open_in_full</span>' +
                '</button>' +
            '</div>' +
        '</div>'
    );
}

// ─── BIND EVENTS ──────────────────────────────────────────────────────────────

function bindBoardEvents(container, prospects, sapServices) {
    // Nuovo prospect
    container.querySelector('#btn-new-prospect')?.addEventListener('click', () => {
        openProspectModal(null, sapServices, () => renderPipelineBoard(container));
    });

    // Stage select
    container.querySelectorAll('.stage-select').forEach(sel => {
        sel.addEventListener('change', async (e) => {
            const id = e.target.dataset.id;
            const newStage = e.target.value;
            try {
                await moveProspectStage(id, newStage);
                showGlobalAlert('Stadio aggiornato', 'success');
                await renderPipelineBoard(container);
            } catch (err) {
                showGlobalAlert('Errore: ' + err.message, 'error');
            }
        });
    });

    // Open detail
    container.querySelectorAll('.btn-open').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const p = (window._salesProspects || prospects).find(x => x.id === id);
            if (p) openProspectModal(p, sapServices, () => renderPipelineBoard(container));
        });
    });

    // Card click → open detail
    container.querySelectorAll('.prospect-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            const p = (window._salesProspects || prospects).find(x => x.id === id);
            if (p) openProspectModal(p, sapServices, () => renderPipelineBoard(container));
        });
    });

    // Outreach drafter shortcut
    container.querySelectorAll('.btn-outreach').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const p = (window._salesProspects || prospects).find(x => x.id === id);
            if (p) openOutreachModal(p);
        });
    });

    // Keep a snapshot for event handlers after async refresh
    window._salesProspects = prospects;
}

// ─── MODAL PROSPECT (ridisegnato) ────────────────────────────────────────────

export function openProspectModal(prospect, sapServices, onSave) {
    const isNew = !prospect;
    const p = prospect || {};
    const e = p.ai_enrichment_data || {};
    const socials = p.social_links || {};

    // Score badges
    const completeness = p.completeness_score;
    const promising = e.promising_score;
    const fattibilita = e.fattibilita_score;
    const compColor = completeness == null ? '#94a3b8' : completeness >= 60 ? '#10b981' : completeness >= 30 ? '#f59e0b' : '#ef4444';
    const promColor = promising == null ? '#94a3b8' : promising >= 70 ? '#10b981' : promising >= 40 ? '#f59e0b' : '#94a3b8';

    // Stage badge
    const stage = p.pipeline_stage || 'sourced';
    const stageConf = PIPELINE_STAGES.find(s => s.key === stage) || { label: stage, color: '#94a3b8', icon: 'help' };

    const sapOptions = (sapServices || []).map(s =>
        '<option value="' + s.id + '"' + (p.target_sap_id === s.id ? ' selected' : '') + '>' + escHtml(s.name) + '</option>'
    ).join('');
    const sourceOptions = ACQUISITION_SOURCES.map(s =>
        '<option value="' + s.key + '"' + (p.acquisition_source === s.key ? ' selected' : '') + '>' + s.label + '</option>'
    ).join('');
    const stageOptions = [{ key: 'sourced', label: 'Sourced (pre-pipeline)' }, ...PIPELINE_STAGES].map(s =>
        '<option value="' + s.key + '"' + (stage === s.key ? ' selected' : '') + '>' + s.label + '</option>'
    ).join('');

    // ─── HEADER VISUALE ──────────────────────────────────────────────────────
    const headerHTML = isNew
        ? '<h2 style="font-size:1.3rem;font-weight:800;font-family:var(--font-titles);margin:0;">Nuovo Prospect</h2>'
        : (
            '<div>' +
                // Riga 1: nome + close
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;margin-bottom:0.6rem;">' +
                    '<h2 style="font-size:1.4rem;font-weight:800;font-family:var(--font-titles);margin:0;line-height:1.15;flex:1;min-width:0;">' + escHtml(p.business_name) + '</h2>' +
                    '<div style="display:flex;gap:0.4rem;align-items:center;flex-shrink:0;">' +
                        '<button id="btn-delete-prospect" data-id="' + p.id + '" title="Elimina" style="background:#ef444415;color:#ef4444;border:none;border-radius:10px;padding:0.4rem 0.55rem;font-size:0.78rem;cursor:pointer;"><span class="material-icons-round" style="font-size:1rem;">delete_outline</span></button>' +
                        '<button id="btn-close-prospect" style="background:var(--bg-tertiary);color:var(--text-secondary);border:none;border-radius:10px;padding:0.4rem 0.75rem;font-size:0.78rem;cursor:pointer;">✕</button>' +
                    '</div>' +
                '</div>' +
                // Riga 2: badge stato + score
                '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;margin-bottom:0.6rem;">' +
                    '<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;padding:3px 9px;border-radius:8px;background:' + stageConf.color + '15;color:' + stageConf.color + ';font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">' +
                        '<span class="material-icons-round" style="font-size:0.85rem;">' + (stageConf.icon || 'circle') + '</span>' + stageConf.label +
                    '</span>' +
                    (completeness != null
                        ? '<span title="Layer 0 — Completezza dati (deterministico)" style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;padding:3px 9px;border-radius:8px;background:' + compColor + '15;color:' + compColor + ';font-weight:700;">' +
                            '<span class="material-icons-round" style="font-size:0.85rem;">check_circle_outline</span>L0 ' + completeness + '/100' +
                          '</span>'
                        : '') +
                    (promising != null
                        ? '<span title="Layer 1 — Promising score AI" style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;padding:3px 9px;border-radius:8px;background:' + promColor + '15;color:' + promColor + ';font-weight:700;">' +
                            '<span class="material-icons-round" style="font-size:0.85rem;">auto_awesome</span>L1 ' + promising + '/100' +
                          '</span>'
                        : '') +
                    (fattibilita != null
                        ? '<span title="Layer 2 — Fattibilità chiusura" style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;padding:3px 9px;border-radius:8px;background:#8b5cf615;color:#8b5cf6;font-weight:700;">' +
                            '<span class="material-icons-round" style="font-size:0.85rem;">psychology</span>L2 ' + fattibilita + '/100' +
                          '</span>'
                        : '') +
                '</div>' +
                // Riga 3: meta info (città · industry · prospect_code)
                '<div style="font-size:0.74rem;color:var(--text-tertiary);display:flex;gap:0.6rem;flex-wrap:wrap;align-items:center;">' +
                    (e.city_origin ? '<span><span class="material-icons-round" style="font-size:0.85rem;vertical-align:-2px;">place</span> ' + escHtml(e.city_origin) + '</span>' : '') +
                    (p.industry ? '<span>•</span><span>' + escHtml(p.industry) + '</span>' : '') +
                    (p.contact_name ? '<span>•</span><span>👤 ' + escHtml(p.contact_name) + '</span>' : '') +
                    (p.prospect_code ? '<span>•</span><span style="opacity:0.7;">#' + escHtml(p.prospect_code) + '</span>' : '') +
                '</div>' +
                // Quick actions bar (sito, telefono, email, social, maps)
                buildQuickActionsBar(p, socials) +
            '</div>'
        );

    // ─── TABS ────────────────────────────────────────────────────────────────
    const tabsHTML = !isNew
        ? '<div style="display:flex;gap:0;margin-bottom:1.25rem;border-bottom:1px solid var(--glass-border);overflow-x:auto;">' +
            ['data', 'enrich', 'discovery', 'offer', 'outreach', 'history'].map((key, i) => {
                const labels = { data: 'Anagrafica', enrich: 'AI Insights', discovery: 'Discovery', offer: 'Offerta', outreach: 'Outreach', history: 'Storia' };
                const icons  = { data: 'badge',      enrich: 'auto_awesome', discovery: 'forum', offer: 'campaign', outreach: 'forward_to_inbox', history: 'history' };
                const active = i === 0;
                return '<button class="prospect-tab' + (active ? ' active' : '') + '" data-tab="' + key + '" style="padding:0.55rem 0.9rem;background:none;border:none;border-bottom:2px solid ' + (active ? 'var(--brand-blue)' : 'transparent') + ';font-size:0.78rem;font-weight:' + (active ? '700' : '600') + ';color:' + (active ? 'var(--brand-blue)' : 'var(--text-secondary)') + ';cursor:pointer;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;">' +
                    '<span class="material-icons-round" style="font-size:0.95rem;">' + icons[key] + '</span>' + labels[key] +
                '</button>';
            }).join('') +
          '</div>'
        : '';

    // ─── TAB DATA (anagrafica + contatti + social) ──────────────────────────
    const dataTabHTML =
        '<div id="prospect-tab-data">' +
            // Sezione Anagrafica
            sectionHeader('Anagrafica', 'business') +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">' +
                field('business_name', 'Azienda *', p.business_name, 'text', true) +
                field('contact_name', 'Referente', p.contact_name) +
                field('industry', 'Settore (testo libero)', p.industry) +
                field('company_size', 'Dimensione team', p.company_size) +
            '</div>' +

            // Sezione Contatti (con campi cliccabili dove ha senso)
            sectionHeader('Contatti', 'contact_mail') +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">' +
                fieldWithAction('contact_email', 'Email', p.contact_email, 'email', p.contact_email ? 'mailto:' + p.contact_email : null, 'send', 'Componi email') +
                fieldWithAction('contact_phone', 'Telefono', p.contact_phone, 'tel', p.contact_phone ? 'tel:' + p.contact_phone.replace(/\s/g, '') : null, 'call', 'Chiama') +
                fieldWithAction('website', 'Sito web', p.website, 'url', p.website ? normalizeUrl(p.website) : null, 'open_in_new', 'Apri in nuova tab') +
                fieldWithAction('linkedin_url', 'LinkedIn URL', p.linkedin_url, 'url', p.linkedin_url || null, 'open_in_new', 'Apri LinkedIn') +
            '</div>' +

            // Sezione Social (icone cliccabili grandi)
            sectionHeader('Social presence', 'public') +
            buildSocialGrid(socials, p.linkedin_url) +

            // Sezione Pipeline
            sectionHeader('Pipeline & SAP', 'view_kanban') +
            '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;">' +
                '<div>' + fieldLabel('Stato') +
                    '<select name="pipeline_stage" style="width:100%;padding:0.55rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.82rem;">' + stageOptions + '</select></div>' +
                '<div>' + fieldLabel('Fonte') +
                    '<select name="acquisition_source" style="width:100%;padding:0.55rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.82rem;">' + sourceOptions + '</select></div>' +
                '<div>' + fieldLabel('SAP target') +
                    '<select name="target_sap_id" style="width:100%;padding:0.55rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.82rem;"><option value="">— nessuno —</option>' + sapOptions + '</select></div>' +
            '</div>' +

            // Note libere
            '<div style="margin-top:1rem;">' + fieldLabel('Note operative') +
                '<textarea name="notes" rows="3" placeholder="Note libere…" style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;resize:vertical;box-sizing:border-box;font-family:inherit;">' + escHtml(p.notes || '') + '</textarea>' +
            '</div>' +
        '</div>';

    const formHTML = dataTabHTML +
        (!isNew ? '<div id="prospect-tab-enrich" style="display:none;"></div>' : '') +
        (!isNew ? '<div id="prospect-tab-discovery" style="display:none;"></div>' : '') +
        (!isNew ? '<div id="prospect-tab-offer" style="display:none;"></div>' : '') +
        (!isNew ? '<div id="prospect-tab-outreach" style="display:none;"></div>' : '') +
        (!isNew ? '<div id="prospect-tab-history" style="display:none;">' + buildHistoryTab(p) + '</div>' : '');

    // ─── BUILD OVERLAY ──────────────────────────────────────────────────────
    const modalId = 'modal-prospect';
    let overlay = document.getElementById(modalId + '-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = modalId + '-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.75);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';

    overlay.innerHTML =
        '<div style="background:var(--bg-primary, #ffffff);border-radius:20px;padding:1.5rem 1.75rem 1.25rem;max-width:820px;width:100%;max-height:92vh;overflow-y:auto;box-shadow:0 25px 80px rgba(0,0,0,0.35);border:1px solid var(--glass-border, rgba(0,0,0,0.08));">' +
            headerHTML +
            tabsHTML +
            '<form id="form-prospect">' + formHTML + '</form>' +
            '<div style="display:flex;justify-content:flex-end;gap:0.6rem;margin-top:1.25rem;padding-top:0.85rem;border-top:1px solid var(--glass-border);">' +
                '<button id="btn-cancel-prospect" style="padding:0.55rem 1.1rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-secondary);font-size:0.82rem;font-weight:600;cursor:pointer;">Annulla</button>' +
                '<button id="btn-save-prospect" class="primary-btn" style="padding:0.55rem 1.3rem;border-radius:10px;font-size:0.82rem;font-weight:700;">Salva</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#btn-close-prospect')?.addEventListener('click', close);
    overlay.querySelector('#btn-cancel-prospect').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(ev) {
        if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });

    // Delete
    overlay.querySelector('#btn-delete-prospect')?.addEventListener('click', async () => {
        const confirmed = await showConfirm('Eliminare questo prospect?', 'Elimina', 'Annulla');
        if (!confirmed) return;
        try {
            await deleteProspect(p.id);
            close();
            onSave && onSave();
        } catch (err) {
            showGlobalAlert('Errore: ' + err.message, 'error');
        }
    });

    // Save
    overlay.querySelector('#btn-save-prospect').addEventListener('click', async () => {
        const form = overlay.querySelector('#form-prospect');
        const payload = {
            business_name:    form.querySelector('[name="business_name"]')?.value?.trim(),
            contact_name:     form.querySelector('[name="contact_name"]')?.value?.trim() || null,
            contact_email:    form.querySelector('[name="contact_email"]')?.value?.trim() || null,
            contact_phone:    form.querySelector('[name="contact_phone"]')?.value?.trim() || null,
            website:          form.querySelector('[name="website"]')?.value?.trim() || null,
            linkedin_url:     form.querySelector('[name="linkedin_url"]')?.value?.trim() || null,
            industry:         form.querySelector('[name="industry"]')?.value?.trim() || null,
            company_size:     form.querySelector('[name="company_size"]')?.value?.trim() || null,
            acquisition_source: form.querySelector('[name="acquisition_source"]')?.value || 'outreach',
            pipeline_stage:   form.querySelector('[name="pipeline_stage"]')?.value || 'cold',
            target_sap_id:    form.querySelector('[name="target_sap_id"]')?.value || null,
            notes:            form.querySelector('[name="notes"]')?.value?.trim() || null,
        };

        if (!payload.business_name) { showGlobalAlert('Il nome azienda è obbligatorio', 'error'); return; }
        if (!p.id) {
            const stage = payload.pipeline_stage;
            payload.stage_history = [{ stage, entered_at: new Date().toISOString() }];
        }
        if (p.id) payload.id = p.id;

        const btn = overlay.querySelector('#btn-save-prospect');
        btn.disabled = true;
        btn.textContent = 'Salvataggio…';

        try {
            await upsertProspect(payload);
            showGlobalAlert(isNew ? 'Prospect creato' : 'Prospect aggiornato', 'success');
            close();
            onSave && onSave();
        } catch (err) {
            showGlobalAlert('Errore: ' + err.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Salva';
        }
    });

    // Tabs (only for existing prospects)
    if (!isNew) {
        overlay.querySelectorAll('.prospect-tab').forEach(tab => {
            tab.addEventListener('click', async () => {
                overlay.querySelectorAll('.prospect-tab').forEach(t => {
                    t.style.color = 'var(--text-secondary)';
                    t.style.borderBottom = '2px solid transparent';
                    t.classList.remove('active');
                });
                tab.style.color = 'var(--brand-blue)';
                tab.style.borderBottom = '2px solid var(--brand-blue)';
                tab.classList.add('active');

                const tabName = tab.dataset.tab;
                overlay.querySelector('#prospect-tab-data').style.display = tabName === 'data' ? '' : 'none';
                const enrichDiv = overlay.querySelector('#prospect-tab-enrich');
                const discoveryDiv = overlay.querySelector('#prospect-tab-discovery');
                const offerDiv = overlay.querySelector('#prospect-tab-offer');
                const outreachDiv = overlay.querySelector('#prospect-tab-outreach');
                const historyDiv = overlay.querySelector('#prospect-tab-history');
                if (enrichDiv) enrichDiv.style.display = tabName === 'enrich' ? '' : 'none';
                if (discoveryDiv) discoveryDiv.style.display = tabName === 'discovery' ? '' : 'none';
                if (offerDiv) offerDiv.style.display = tabName === 'offer' ? '' : 'none';
                if (outreachDiv) outreachDiv.style.display = tabName === 'outreach' ? '' : 'none';
                if (historyDiv) historyDiv.style.display = tabName === 'history' ? '' : 'none';

                if (tabName === 'enrich' && enrichDiv && enrichDiv.innerHTML === '') {
                    await renderEnrichmentTab(enrichDiv, p, async (updatedProspect) => {
                        onSave && onSave();
                    });
                }
                if (tabName === 'discovery' && discoveryDiv && discoveryDiv.innerHTML === '') {
                    await renderDiscoveryTab(discoveryDiv, p);
                }
                if (tabName === 'offer' && offerDiv && offerDiv.innerHTML === '') {
                    await renderOfferBuilderTab(offerDiv, p);
                }
                if (tabName === 'outreach' && outreachDiv && outreachDiv.innerHTML === '') {
                    await renderOutreachDrafter(outreachDiv, p);
                }
            });
        });
    }
}

// Shortcut per aprire direttamente tab outreach
function openOutreachModal(prospect) {
    openProspectModal(prospect, window._salesSapServices || [], null);
    // Dopo il render del modal, simula click su tab outreach
    setTimeout(() => {
        const tab = document.querySelector('.prospect-tab[data-tab="outreach"]');
        if (tab) tab.click();
    }, 100);
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

function field(name, label, value, type, required) {
    return (
        '<div>' +
            '<label style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">' + label + '</label>' +
            '<input name="' + name + '" type="' + (type || 'text') + '" value="' + escHtml(value || '') + '"' +
                (required ? ' required' : '') +
                ' style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;box-sizing:border-box;">' +
        '</div>'
    );
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── HELPER: NUOVI PER MODAL PROSPECT RIDISEGNATO ───────────────────────────

function fieldLabel(label) {
    return '<label style="font-size:0.7rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:3px;">' + label + '</label>';
}

function fieldWithAction(name, label, value, type, actionUrl, actionIcon, actionTitle) {
    const v = value || '';
    const inputHTML =
        '<input name="' + name + '" type="' + (type || 'text') + '" value="' + escHtml(v) + '"' +
            ' style="width:100%;padding:0.55rem 0.65rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.82rem;box-sizing:border-box;">';
    const actionHTML = (actionUrl && v)
        ? '<a href="' + escHtml(actionUrl) + '" target="_blank" rel="noopener noreferrer" title="' + escHtml(actionTitle || '') + '" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;background:var(--brand-blue)15;color:var(--brand-blue);text-decoration:none;">' +
            '<span class="material-icons-round" style="font-size:1rem;">' + actionIcon + '</span>' +
          '</a>'
        : '';
    return (
        '<div>' + fieldLabel(label) +
            '<div style="position:relative;">' + inputHTML + actionHTML + '</div>' +
        '</div>'
    );
}

function sectionHeader(title, icon) {
    return (
        '<div style="display:flex;align-items:center;gap:0.4rem;margin:1.2rem 0 0.6rem;">' +
            '<span class="material-icons-round" style="font-size:0.95rem;color:var(--brand-blue);">' + icon + '</span>' +
            '<span style="font-size:0.72rem;font-weight:800;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em;">' + title + '</span>' +
            '<div style="flex:1;height:1px;background:var(--glass-border);"></div>' +
        '</div>'
    );
}

function normalizeUrl(u) {
    if (!u) return '';
    const t = String(u).trim();
    if (/^https?:\/\//i.test(t)) return t;
    return 'https://' + t;
}

function buildQuickActionsBar(p, socials) {
    const actions = [];
    if (p.website) actions.push({ label: 'Sito', icon: 'language', url: normalizeUrl(p.website), color: '#3b82f6' });
    if (p.contact_phone) actions.push({ label: 'Chiama', icon: 'call', url: 'tel:' + p.contact_phone.replace(/\s/g, ''), color: '#10b981' });
    if (p.contact_email) actions.push({ label: 'Email', icon: 'mail', url: 'mailto:' + p.contact_email, color: '#f59e0b' });
    const linkedin = p.linkedin_url || socials.linkedin;
    if (linkedin) actions.push({ label: 'LinkedIn', icon: 'group', url: linkedin, color: '#0a66c2' });
    // Maps link basato su city + nome
    const e = p.ai_enrichment_data || {};
    if (e.city_origin) {
        const mapsQuery = encodeURIComponent((p.business_name || '') + ' ' + e.city_origin);
        actions.push({ label: 'Maps', icon: 'place', url: 'https://www.google.com/maps/search/?api=1&query=' + mapsQuery, color: '#ef4444' });
    }

    if (actions.length === 0) return '';

    return (
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.6rem;padding-top:0.6rem;border-top:1px dashed var(--glass-border);">' +
            actions.map(a =>
                '<a href="' + escHtml(a.url) + '" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:8px;background:' + a.color + '12;color:' + a.color + ';font-size:0.74rem;font-weight:700;text-decoration:none;border:1px solid ' + a.color + '30;transition:background 0.15s;" onmouseover="this.style.background=\'' + a.color + '25\'" onmouseout="this.style.background=\'' + a.color + '12\'">' +
                    '<span class="material-icons-round" style="font-size:0.9rem;">' + a.icon + '</span>' + a.label +
                '</a>'
            ).join('') +
        '</div>'
    );
}

function buildSocialGrid(socials, linkedinFallback) {
    const platforms = [
        { key: 'facebook',  label: 'Facebook',  icon: '📘', color: '#1877f2', url: socials.facebook },
        { key: 'instagram', label: 'Instagram', icon: '📷', color: '#e1306c', url: socials.instagram },
        { key: 'linkedin',  label: 'LinkedIn',  icon: '💼', color: '#0a66c2', url: socials.linkedin || linkedinFallback },
        { key: 'youtube',   label: 'YouTube',   icon: '▶️', color: '#ff0000', url: socials.youtube },
        { key: 'tiktok',    label: 'TikTok',    icon: '🎵', color: '#000000', url: socials.tiktok },
    ];
    return (
        '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:0.5rem;">' +
            platforms.map(s => {
                if (!s.url) {
                    return '<div style="display:flex;align-items:center;gap:6px;padding:0.55rem 0.7rem;border-radius:10px;border:1px dashed var(--glass-border);background:var(--bg-tertiary);color:var(--text-tertiary);font-size:0.78rem;opacity:0.6;">' +
                        '<span style="font-size:1.1rem;filter:grayscale(1);">' + s.icon + '</span>' +
                        '<span>' + s.label + '</span>' +
                    '</div>';
                }
                return '<a href="' + escHtml(s.url) + '" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;gap:6px;padding:0.55rem 0.7rem;border-radius:10px;border:1px solid ' + s.color + '40;background:' + s.color + '08;color:' + s.color + ';font-size:0.78rem;font-weight:700;text-decoration:none;transition:background 0.15s;" onmouseover="this.style.background=\'' + s.color + '18\'" onmouseout="this.style.background=\'' + s.color + '08\'">' +
                    '<span style="font-size:1.1rem;">' + s.icon + '</span>' +
                    '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + s.label + '</span>' +
                    '<span class="material-icons-round" style="font-size:0.85rem;margin-left:auto;opacity:0.6;">open_in_new</span>' +
                '</a>';
            }).join('') +
        '</div>'
    );
}

function buildHistoryTab(p) {
    const history = Array.isArray(p.stage_history) ? p.stage_history : [];
    const e = p.ai_enrichment_data || {};
    const events = [];

    history.forEach(h => events.push({ when: h.entered_at, icon: 'change_circle', label: 'Stadio: ' + (h.stage || '?'), color: '#3b82f6' }));
    if (p.created_at) events.push({ when: p.created_at, icon: 'add_circle', label: 'Prospect creato', color: '#94a3b8' });
    if (p.last_enriched_at) events.push({ when: p.last_enriched_at, icon: 'language', label: 'Scraping sito completato', color: '#3b82f6' });
    if (e.layer1_at) events.push({ when: e.layer1_at, icon: 'auto_awesome', label: 'Layer 1 AI analizzato (score ' + (e.promising_score || '—') + ')', color: '#8b5cf6' });
    if (e.layer2_at) events.push({ when: e.layer2_at, icon: 'psychology', label: 'Layer 2 Deep Dive (fattibilità ' + (e.fattibilita_score || '—') + ')', color: '#8b5cf6' });
    if (e.sourced_at) events.push({ when: e.sourced_at, icon: 'travel_explore', label: 'Importato da ' + (e.osm_id ? 'OpenStreetMap' : 'sourcing'), color: '#10b981' });

    events.sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0));

    if (events.length === 0) {
        return '<div style="padding:2rem;text-align:center;color:var(--text-tertiary);font-size:0.85rem;">Nessun evento storico.</div>';
    }

    return (
        '<div style="padding-top:0.5rem;">' +
            '<div style="font-size:0.72rem;font-weight:800;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.75rem;">Timeline (' + events.length + ' eventi)</div>' +
            '<div style="display:flex;flex-direction:column;gap:0.5rem;">' +
                events.map(ev => {
                    const dt = ev.when ? new Date(ev.when).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—';
                    return '<div style="display:grid;grid-template-columns:32px 1fr auto;gap:0.6rem;align-items:center;padding:0.55rem 0.75rem;background:var(--bg-secondary);border-radius:10px;border-left:3px solid ' + ev.color + ';">' +
                        '<span class="material-icons-round" style="font-size:1.1rem;color:' + ev.color + ';">' + ev.icon + '</span>' +
                        '<div style="font-size:0.82rem;color:var(--text-primary);">' + escHtml(ev.label) + '</div>' +
                        '<div style="font-size:0.7rem;color:var(--text-tertiary);font-weight:600;">' + dt + '</div>' +
                    '</div>';
                }).join('') +
            '</div>' +
        '</div>'
    );
}
