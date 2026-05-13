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

// ─── MODAL PROSPECT ───────────────────────────────────────────────────────────

export function openProspectModal(prospect, sapServices, onSave) {
    const isNew = !prospect;
    const p = prospect || {};

    const sapOptions = (sapServices || []).map(s =>
        '<option value="' + s.id + '"' + (p.target_sap_id === s.id ? ' selected' : '') + '>' + escHtml(s.name) + '</option>'
    ).join('');

    const sourceOptions = ACQUISITION_SOURCES.map(s =>
        '<option value="' + s.key + '"' + (p.acquisition_source === s.key ? ' selected' : '') + '>' + s.label + '</option>'
    ).join('');

    const stageOptions = PIPELINE_STAGES.map(s =>
        '<option value="' + s.key + '"' + (p.pipeline_stage === s.key ? ' selected' : '') + '>' + s.label + '</option>'
    ).join('');

    // Tab system: Dati / Arricchimento AI / Discovery / Offerta / Outreach
    const tabsHTML = !isNew
        ? '<div style="display:flex;gap:0.25rem;margin-bottom:1.5rem;border-bottom:1px solid var(--glass-border);padding-bottom:0;flex-wrap:wrap;">' +
            '<button class="prospect-tab active" data-tab="data" style="padding:0.5rem 1rem;border:none;background:transparent;font-size:0.82rem;font-weight:700;color:var(--brand-blue);border-bottom:2px solid var(--brand-blue);cursor:pointer;">Dati</button>' +
            '<button class="prospect-tab" data-tab="enrich" style="padding:0.5rem 1rem;border:none;background:transparent;font-size:0.82rem;font-weight:600;color:var(--text-secondary);cursor:pointer;">Arricchimento AI</button>' +
            '<button class="prospect-tab" data-tab="discovery" style="padding:0.5rem 1rem;border:none;background:transparent;font-size:0.82rem;font-weight:600;color:var(--text-secondary);cursor:pointer;">Discovery</button>' +
            '<button class="prospect-tab" data-tab="offer" style="padding:0.5rem 1rem;border:none;background:transparent;font-size:0.82rem;font-weight:600;color:var(--text-secondary);cursor:pointer;">Offerta</button>' +
            '<button class="prospect-tab" data-tab="outreach" style="padding:0.5rem 1rem;border:none;background:transparent;font-size:0.82rem;font-weight:600;color:var(--text-secondary);cursor:pointer;">Outreach</button>' +
          '</div>'
        : '';

    const formHTML =
        '<div id="prospect-tab-data">' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">' +
                field('business_name', 'Azienda *', p.business_name, 'text', true) +
                field('contact_name', 'Referente', p.contact_name) +
                field('contact_email', 'Email', p.contact_email, 'email') +
                field('contact_phone', 'Telefono', p.contact_phone, 'tel') +
                field('website', 'Sito web', p.website, 'url') +
                field('linkedin_url', 'LinkedIn URL', p.linkedin_url, 'url') +
                field('industry', 'Settore', p.industry) +
                field('company_size', 'Dimensione team', p.company_size) +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem;">' +
                '<div>' +
                    '<label style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">Fonte</label>' +
                    '<select name="acquisition_source" style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;">' +
                        sourceOptions +
                    '</select>' +
                '</div>' +
                '<div>' +
                    '<label style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">Stadio pipeline</label>' +
                    '<select name="pipeline_stage" style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;">' +
                        stageOptions +
                    '</select>' +
                '</div>' +
            '</div>' +
            '<div style="margin-top:1rem;">' +
                '<label style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">SAP target</label>' +
                '<select name="target_sap_id" style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;">' +
                    '<option value="">Nessuno</option>' + sapOptions +
                '</select>' +
            '</div>' +
            '<div style="margin-top:1rem;">' +
                '<label style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">Note</label>' +
                '<textarea name="notes" rows="3" style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;resize:vertical;box-sizing:border-box;">' + escHtml(p.notes || '') + '</textarea>' +
            '</div>' +
        '</div>' +
        (!isNew ? '<div id="prospect-tab-enrich" style="display:none;"></div>' : '') +
        (!isNew ? '<div id="prospect-tab-discovery" style="display:none;"></div>' : '') +
        (!isNew ? '<div id="prospect-tab-offer" style="display:none;"></div>' : '') +
        (!isNew ? '<div id="prospect-tab-outreach" style="display:none;"></div>' : '');

    const modalId = 'modal-prospect';
    let overlay = document.getElementById(modalId + '-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = modalId + '-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.75);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';

    overlay.innerHTML =
        '<div style="background:var(--bg-primary, #ffffff);border-radius:20px;padding:2rem;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 25px 80px rgba(0,0,0,0.35);border:1px solid var(--glass-border, rgba(0,0,0,0.08));">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">' +
                '<h2 style="font-size:1.3rem;font-weight:800;font-family:var(--font-titles);margin:0;">' +
                    (isNew ? 'Nuovo Prospect' : escHtml(p.business_name)) +
                '</h2>' +
                '<div style="display:flex;gap:0.5rem;align-items:center;">' +
                    (!isNew ? '<button id="btn-delete-prospect" data-id="' + p.id + '" style="background:#ef444415;color:#ef4444;border:none;border-radius:10px;padding:0.4rem 0.75rem;font-size:0.78rem;font-weight:700;cursor:pointer;">Elimina</button>' : '') +
                    '<button id="btn-close-prospect" style="background:var(--bg-tertiary);color:var(--text-secondary);border:none;border-radius:10px;padding:0.4rem 0.75rem;font-size:0.78rem;cursor:pointer;">✕</button>' +
                '</div>' +
            '</div>' +
            tabsHTML +
            '<form id="form-prospect">' + formHTML + '</form>' +
            '<div style="display:flex;justify-content:flex-end;gap:0.75rem;margin-top:1.5rem;">' +
                '<button id="btn-cancel-prospect" style="padding:0.6rem 1.2rem;border-radius:12px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-secondary);font-size:0.85rem;font-weight:600;cursor:pointer;">Annulla</button>' +
                '<button id="btn-save-prospect" class="primary-btn" style="padding:0.6rem 1.4rem;border-radius:12px;font-size:0.85rem;font-weight:700;">Salva</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#btn-close-prospect').addEventListener('click', close);
    overlay.querySelector('#btn-cancel-prospect').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

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
                if (enrichDiv) enrichDiv.style.display = tabName === 'enrich' ? '' : 'none';
                if (discoveryDiv) discoveryDiv.style.display = tabName === 'discovery' ? '' : 'none';
                if (offerDiv) offerDiv.style.display = tabName === 'offer' ? '' : 'none';
                if (outreachDiv) outreachDiv.style.display = tabName === 'outreach' ? '' : 'none';

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
