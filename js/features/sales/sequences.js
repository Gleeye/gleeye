/**
 * sales/sequences.js
 * Sequence Builder per le sequenze outreach.
 *
 * Due viste:
 * - renderSalesSequences(container)         → lista sequenze (#sales-sequences)
 * - renderSequenceDetail(container, seqId)  → detail builder (#sales-sequence/:id)
 *
 * Una sequenza = nicchia + SAP target + tono + N step (ognuno con channel, delay_days, step_type, subject/body templates).
 * I template li scrive l'Outreach Writer Agent (Gemini) — Davide può poi editarli.
 */

import {
    fetchSequences, fetchSequenceWithSteps, upsertSequence, deleteSequence,
    upsertStep, deleteStep,
    fetchNiches, fetchSapServicesForSales,
    STEP_CHANNELS, STEP_TYPES, TONES,
} from './api.js?v=8001';
import { showGlobalAlert, showConfirm } from '../../modules/utils.js?v=8000';
import { generateOutreachStepTemplate, extractTemplateFields } from './outreach_writer.js?v=8001';

const STATUS_CONFIG = {
    draft:     { label: 'Bozza',      color: '#94a3b8', icon: 'edit' },
    active:    { label: 'Attiva',     color: '#10b981', icon: 'play_circle' },
    paused:    { label: 'In pausa',   color: '#f59e0b', icon: 'pause_circle' },
    completed: { label: 'Completata', color: '#6366f1', icon: 'check_circle' },
};

// ═══════════════════════════════════════════════════════════════════════════
// LISTA SEQUENZE (#sales-sequences)
// ═══════════════════════════════════════════════════════════════════════════

export async function renderSalesSequences(container) {
    container.innerHTML = loadingHTML('Caricamento sequenze…');
    try {
        const [sequences, niches, sapServices] = await Promise.all([
            fetchSequences(),
            fetchNiches(),
            fetchSapServicesForSales(),
        ]);
        container.innerHTML = buildListHTML(sequences, niches, sapServices);
        bindListEvents(container, niches, sapServices);
    } catch (err) {
        container.innerHTML = '<div style="padding:2rem;color:red;">Errore: ' + escHtml(err.message) + '</div>';
    }
}

function buildListHTML(sequences, niches, sapServices) {
    const total = sequences.length;
    const active = sequences.filter(s => s.status === 'active').length;
    const draft = sequences.filter(s => s.status === 'draft').length;

    return (
        '<div class="animate-fade-in" style="max-width:1200px;margin:0 auto;padding:1.5rem;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">' +
                '<div>' +
                    '<h1 style="font-size:1.75rem;font-weight:800;font-family:var(--font-titles);color:var(--text-primary);margin:0;letter-spacing:-0.02em;">Sequenze Outreach</h1>' +
                    '<div style="font-size:0.85rem;color:var(--text-tertiary);margin-top:0.25rem;">' + total + ' sequenze · ' + active + ' attive · ' + draft + ' bozze</div>' +
                '</div>' +
                '<div style="display:flex;gap:0.5rem;">' +
                    '<a href="#sales-niches" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.82rem;padding:0.5rem 1rem;border-radius:10px;font-weight:600;color:var(--text-secondary);border:1px solid var(--glass-border);text-decoration:none;background:var(--bg-secondary);">' +
                        '<span class="material-icons-round" style="font-size:1rem;">explore</span>Nicchie' +
                    '</a>' +
                    '<button id="btn-new-sequence" class="primary-btn" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.82rem;padding:0.5rem 1rem;border-radius:12px;font-weight:700;">' +
                        '<span class="material-icons-round" style="font-size:1rem;">add</span>Nuova sequenza' +
                    '</button>' +
                '</div>' +
            '</div>' +
            (sequences.length === 0
                ? buildEmptyState()
                : '<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(380px, 1fr));gap:1rem;">' +
                    sequences.map(s => buildSequenceCard(s)).join('') +
                  '</div>'
            ) +
        '</div>'
    );
}

function buildEmptyState() {
    return (
        '<div style="text-align:center;padding:4rem 2rem;color:var(--text-tertiary);border:2px dashed var(--glass-border);border-radius:18px;">' +
            '<span class="material-icons-round" style="font-size:4rem;opacity:0.3;display:block;margin-bottom:1rem;">forward_to_inbox</span>' +
            '<div style="font-size:1.05rem;font-weight:700;color:var(--text-primary);margin-bottom:0.5rem;">Nessuna sequenza ancora</div>' +
            '<div style="font-size:0.88rem;max-width:520px;margin:0 auto 1.5rem;line-height:1.5;">' +
                'Una sequenza è una serie di messaggi multi-canale (email, DM, Loom) per i prospect di una nicchia. ' +
                'L\'AI scrive i template basandosi su nicchia + SAP + tono.' +
            '</div>' +
            '<button id="btn-new-sequence-empty" class="primary-btn" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.85rem;padding:0.65rem 1.3rem;border-radius:12px;font-weight:700;">' +
                '<span class="material-icons-round" style="font-size:1rem;">add</span>Crea prima sequenza' +
            '</button>' +
        '</div>'
    );
}

function buildSequenceCard(s) {
    const conf = STATUS_CONFIG[s.status] || STATUS_CONFIG.draft;
    const stats = s.stats || {};
    return (
        '<div class="sequence-card" data-id="' + s.id + '" style="background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:16px;padding:1.25rem;cursor:pointer;transition:transform 0.2s, box-shadow 0.2s;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;margin-bottom:0.75rem;">' +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="font-size:1rem;font-weight:800;color:var(--text-primary);font-family:var(--font-titles);line-height:1.2;">' + escHtml(s.name) + '</div>' +
                    '<div style="font-size:0.72rem;color:var(--text-tertiary);margin-top:3px;">' +
                        (s.niche ? '📌 ' + escHtml(s.niche.name) : 'Nessuna nicchia') +
                        (s.target_sap ? ' · 🎯 ' + escHtml(s.target_sap.name) : '') +
                    '</div>' +
                '</div>' +
                '<span style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.7rem;padding:3px 9px;border-radius:8px;background:' + conf.color + '15;color:' + conf.color + ';font-weight:700;flex-shrink:0;">' +
                    '<span class="material-icons-round" style="font-size:0.8rem;">' + conf.icon + '</span>' + conf.label +
                '</span>' +
            '</div>' +
            // Stats riga
            '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:0.4rem;padding:0.6rem;background:var(--bg-tertiary);border-radius:10px;">' +
                statCell('Invii', stats.sent || 0) +
                statCell('Aperti', stats.opened || 0) +
                statCell('Risposte', stats.replied || 0) +
                statCell('Call', stats.calls || 0) +
            '</div>' +
            '<div style="font-size:0.72rem;color:var(--text-tertiary);margin-top:0.6rem;">Tono: ' + escHtml(s.tone || 'professionale') + '</div>' +
        '</div>'
    );
}

function statCell(label, value) {
    return (
        '<div style="text-align:center;">' +
            '<div style="font-size:0.6rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;">' + label + '</div>' +
            '<div style="font-size:1rem;font-weight:900;color:var(--text-primary);">' + value + '</div>' +
        '</div>'
    );
}

function bindListEvents(container, niches, sapServices) {
    const openNew = () => openNewSequenceModal(niches, sapServices, () => renderSalesSequences(container));
    container.querySelector('#btn-new-sequence')?.addEventListener('click', openNew);
    container.querySelector('#btn-new-sequence-empty')?.addEventListener('click', openNew);

    container.querySelectorAll('.sequence-card').forEach(card => {
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
            if (id) window.location.hash = 'sales-sequence/' + id;
        });
    });
}

// ─── MODAL NEW SEQUENCE ──────────────────────────────────────────────────────

function openNewSequenceModal(niches, sapServices, onSave) {
    const overlay = buildOverlay('modal-new-sequence');
    const nicheOptions = '<option value="">— scegli nicchia —</option>' +
        niches.map(n => '<option value="' + n.id + '">' + escHtml(n.name) + '</option>').join('');
    const sapOptions = '<option value="">— opzionale —</option>' +
        sapServices.map(s => '<option value="' + s.id + '">' + escHtml(s.name) + '</option>').join('');
    const toneOptions = TONES.map(t => '<option value="' + t.key + '">' + t.label + '</option>').join('');

    overlay.innerHTML = buildModalShell('Nuova sequenza', '',
        '<div>' +
            '<div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:1.25rem;line-height:1.5;">' +
                'Una sequenza è una serie di messaggi multi-canale per una nicchia. Crea ora la struttura base, poi nel dettaglio aggiungi gli step (5 consigliati: initial + 3 follow-up + final).' +
            '</div>' +
            '<div style="margin-bottom:0.75rem;">' +
                fieldLabel('Nome sequenza *') +
                '<input id="seq-name" type="text" placeholder="Es. Hotel liguri — Brand Refresh Q1" ' +
                    'style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.88rem;box-sizing:border-box;">' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;margin-bottom:0.75rem;">' +
                '<div>' + fieldLabel('Nicchia') +
                    '<select id="seq-niche" style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;">' + nicheOptions + '</select>' +
                '</div>' +
                '<div>' + fieldLabel('SAP target (opzionale)') +
                    '<select id="seq-sap" style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;">' + sapOptions + '</select>' +
                '</div>' +
            '</div>' +
            '<div>' + fieldLabel('Tono') +
                '<select id="seq-tone" style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;">' + toneOptions + '</select>' +
            '</div>' +
        '</div>',
        '<button class="btn-cancel-modal" style="padding:0.6rem 1.2rem;border-radius:12px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-secondary);font-size:0.85rem;font-weight:600;cursor:pointer;">Annulla</button>' +
        '<button id="btn-save-sequence" class="primary-btn" style="padding:0.6rem 1.4rem;border-radius:12px;font-size:0.85rem;font-weight:700;">Crea</button>'
    );

    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.btn-cancel-modal').addEventListener('click', close);
    overlay.querySelector('.modal-close-x').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    overlay.querySelector('#btn-save-sequence').addEventListener('click', async () => {
        const name = overlay.querySelector('#seq-name').value.trim();
        const niche_id = overlay.querySelector('#seq-niche').value || null;
        const target_sap_id = overlay.querySelector('#seq-sap').value || null;
        const tone = overlay.querySelector('#seq-tone').value;
        if (!name) { showGlobalAlert('Nome obbligatorio', 'error'); return; }

        const btn = overlay.querySelector('#btn-save-sequence');
        btn.disabled = true; btn.textContent = 'Creo…';
        try {
            const created = await upsertSequence({ name, niche_id, target_sap_id, tone, status: 'draft' });
            showGlobalAlert('Sequenza creata', 'success');
            close();
            window.location.hash = 'sales-sequence/' + created.id;
        } catch (err) {
            showGlobalAlert('Errore: ' + err.message, 'error');
            btn.disabled = false; btn.textContent = 'Crea';
        }
    });

    setTimeout(() => overlay.querySelector('#seq-name')?.focus(), 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// DETAIL SEQUENZA (#sales-sequence/:id)
// ═══════════════════════════════════════════════════════════════════════════

export async function renderSequenceDetail(container, seqId) {
    container.innerHTML = loadingHTML('Caricamento sequenza…');
    try {
        const [seq, niches, sapServices] = await Promise.all([
            fetchSequenceWithSteps(seqId),
            fetchNiches(),
            fetchSapServicesForSales(),
        ]);
        if (!seq) {
            container.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-tertiary);">Sequenza non trovata. <a href="#sales-sequences" style="color:var(--brand-blue);">Torna alla lista</a></div>';
            return;
        }
        const onReload = () => renderSequenceDetail(container, seqId);
        container.innerHTML = buildDetailHTML(seq, niches, sapServices);
        bindDetailEvents(container, seq, niches, sapServices, onReload);
    } catch (err) {
        container.innerHTML = '<div style="padding:2rem;color:red;">Errore: ' + escHtml(err.message) + '</div>';
    }
}

function buildDetailHTML(seq, niches, sapServices) {
    const conf = STATUS_CONFIG[seq.status] || STATUS_CONFIG.draft;
    const stepsHTML = (seq.steps || []).map((step, idx) => buildStepCard(step, idx)).join('');
    const nicheOptions = '<option value="">— nessuna —</option>' +
        niches.map(n => '<option value="' + n.id + '"' + (seq.niche_id === n.id ? ' selected' : '') + '>' + escHtml(n.name) + '</option>').join('');
    const sapOptions = '<option value="">— nessun SAP —</option>' +
        sapServices.map(s => '<option value="' + s.id + '"' + (seq.target_sap_id === s.id ? ' selected' : '') + '>' + escHtml(s.name) + '</option>').join('');
    const toneOptions = TONES.map(t => '<option value="' + t.key + '"' + (seq.tone === t.key ? ' selected' : '') + '>' + t.label + '</option>').join('');
    const statusOptions = Object.entries(STATUS_CONFIG).map(([k, v]) => '<option value="' + k + '"' + (seq.status === k ? ' selected' : '') + '>' + v.label + '</option>').join('');

    return (
        '<div class="animate-fade-in" style="max-width:1100px;margin:0 auto;padding:1.5rem;">' +
            '<a href="#sales-sequences" style="display:inline-flex;align-items:center;gap:4px;font-size:0.78rem;color:var(--text-secondary);text-decoration:none;margin-bottom:0.75rem;font-weight:600;">' +
                '<span class="material-icons-round" style="font-size:1rem;">arrow_back</span>Sequenze' +
            '</a>' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap;">' +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="display:flex;align-items:center;gap:0.6rem;">' +
                        '<h1 style="font-size:1.6rem;font-weight:800;font-family:var(--font-titles);color:var(--text-primary);margin:0;letter-spacing:-0.02em;">' + escHtml(seq.name) + '</h1>' +
                        '<span style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.72rem;padding:3px 9px;border-radius:8px;background:' + conf.color + '15;color:' + conf.color + ';font-weight:700;">' +
                            '<span class="material-icons-round" style="font-size:0.85rem;">' + conf.icon + '</span>' + conf.label +
                        '</span>' +
                    '</div>' +
                    '<div style="font-size:0.78rem;color:var(--text-tertiary);margin-top:3px;">' +
                        (seq.niche ? '📌 ' + escHtml(seq.niche.name) : 'Nessuna nicchia') +
                        (seq.target_sap ? ' · 🎯 ' + escHtml(seq.target_sap.name) : '') +
                        ' · Tono: ' + escHtml(seq.tone || 'professionale') +
                        ' · ' + (seq.steps || []).length + ' step' +
                    '</div>' +
                '</div>' +
                '<button id="btn-delete-seq" style="padding:0.5rem 0.9rem;border-radius:10px;background:#ef444415;color:#ef4444;border:none;font-size:0.78rem;font-weight:700;cursor:pointer;">Elimina sequenza</button>' +
            '</div>' +
            // Quick edit settings
            '<div style="background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:14px;padding:1rem 1.2rem;margin-bottom:1.5rem;">' +
                '<div style="font-size:0.72rem;font-weight:800;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.6rem;">Impostazioni sequenza</div>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:0.6rem;align-items:end;">' +
                    '<div>' + fieldLabel('Nicchia') +
                        '<select id="seq-edit-niche" style="width:100%;padding:0.5rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-primary);color:var(--text-primary);font-size:0.82rem;">' + nicheOptions + '</select></div>' +
                    '<div>' + fieldLabel('SAP target') +
                        '<select id="seq-edit-sap" style="width:100%;padding:0.5rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-primary);color:var(--text-primary);font-size:0.82rem;">' + sapOptions + '</select></div>' +
                    '<div>' + fieldLabel('Tono') +
                        '<select id="seq-edit-tone" style="width:100%;padding:0.5rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-primary);color:var(--text-primary);font-size:0.82rem;">' + toneOptions + '</select></div>' +
                    '<div>' + fieldLabel('Status') +
                        '<select id="seq-edit-status" style="width:100%;padding:0.5rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-primary);color:var(--text-primary);font-size:0.82rem;">' + statusOptions + '</select></div>' +
                    '<button id="btn-save-seq-meta" style="font-size:0.78rem;padding:0.45rem 0.9rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-tertiary);color:var(--text-secondary);cursor:pointer;font-weight:600;height:fit-content;">Salva</button>' +
                '</div>' +
            '</div>' +
            // Steps
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">' +
                '<div style="font-size:0.95rem;font-weight:800;color:var(--text-primary);font-family:var(--font-titles);">Step della sequenza</div>' +
                '<div style="display:flex;gap:0.4rem;">' +
                    '<button id="btn-add-default-steps" style="font-size:0.74rem;padding:5px 11px;border-radius:8px;border:1px solid #8b5cf640;background:#8b5cf608;color:#8b5cf6;cursor:pointer;font-weight:700;display:inline-flex;align-items:center;gap:4px;">' +
                        '<span class="material-icons-round" style="font-size:0.85rem;">auto_awesome</span>Genera 5 step di default' +
                    '</button>' +
                    '<button id="btn-add-step" class="primary-btn" style="font-size:0.78rem;padding:5px 14px;border-radius:8px;font-weight:700;display:inline-flex;align-items:center;gap:4px;">' +
                        '<span class="material-icons-round" style="font-size:0.85rem;">add</span>Step manuale' +
                    '</button>' +
                '</div>' +
            '</div>' +
            (seq.steps && seq.steps.length > 0
                ? '<div id="steps-list" style="display:flex;flex-direction:column;gap:0.6rem;">' + stepsHTML + '</div>'
                : '<div style="padding:2rem;text-align:center;border:2px dashed var(--glass-border);border-radius:12px;color:var(--text-tertiary);">' +
                    '<div style="font-size:0.88rem;font-weight:600;color:var(--text-primary);margin-bottom:0.3rem;">Nessuno step ancora</div>' +
                    '<div style="font-size:0.78rem;">Clicca "Genera 5 step di default" per costruire la struttura standard Bani/Parozzi automaticamente.</div>' +
                  '</div>'
            ) +
        '</div>'
    );
}

function buildStepCard(step, idx) {
    const channelInfo = STEP_CHANNELS.find(c => c.key === step.channel) || { label: step.channel, icon: 'send' };
    const typeInfo = STEP_TYPES.find(t => t.key === step.step_type) || { label: step.step_type };
    const hasTemplate = !!(step.subject_template || step.body_template || step.loom_script_template);

    const previewBody = step.body_template ? truncate(step.body_template, 200) : (step.loom_script_template ? truncate(step.loom_script_template, 200) : '');

    return (
        '<div class="step-card" data-step-id="' + step.id + '" style="background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:14px;padding:1rem 1.2rem;">' +
            // Riga header
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.6rem;gap:0.6rem;flex-wrap:wrap;">' +
                '<div style="display:flex;align-items:center;gap:0.5rem;flex:1;min-width:0;">' +
                    '<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--brand-blue);color:#fff;font-size:0.82rem;font-weight:900;flex-shrink:0;">' + step.step_number + '</span>' +
                    '<span class="material-icons-round" style="font-size:1.1rem;color:var(--brand-blue);">' + channelInfo.icon + '</span>' +
                    '<div style="min-width:0;">' +
                        '<div style="font-size:0.88rem;font-weight:700;color:var(--text-primary);">' + escHtml(channelInfo.label) + ' · ' + escHtml(typeInfo.label) + '</div>' +
                        '<div style="font-size:0.7rem;color:var(--text-tertiary);">Delay: +' + (step.delay_days || 0) + 'gg' + (step.is_active ? '' : ' · ⚠ disattivato') + '</div>' +
                    '</div>' +
                '</div>' +
                '<div style="display:flex;gap:0.3rem;">' +
                    '<button class="btn-gen-template" data-step-id="' + step.id + '" style="font-size:0.72rem;padding:4px 10px;border-radius:7px;border:1px solid #8b5cf640;background:#8b5cf608;color:#8b5cf6;cursor:pointer;font-weight:700;display:inline-flex;align-items:center;gap:3px;">' +
                        '<span class="material-icons-round" style="font-size:0.8rem;">auto_awesome</span>' + (hasTemplate ? 'Rigenera' : 'Genera AI') +
                    '</button>' +
                    '<button class="btn-edit-step" data-step-id="' + step.id + '" style="font-size:0.72rem;padding:4px 10px;border-radius:7px;border:1px solid var(--glass-border);background:var(--bg-tertiary);color:var(--text-secondary);cursor:pointer;font-weight:600;">Modifica</button>' +
                    '<button class="btn-delete-step" data-step-id="' + step.id + '" style="font-size:0.72rem;padding:4px 8px;border-radius:7px;border:none;background:#ef444415;color:#ef4444;cursor:pointer;font-weight:700;">✕</button>' +
                '</div>' +
            '</div>' +
            // Preview template
            (hasTemplate
                ? '<div style="background:var(--bg-tertiary);border-radius:8px;padding:0.65rem 0.8rem;font-size:0.78rem;color:var(--text-secondary);line-height:1.5;">' +
                    (step.subject_template ? '<div style="font-weight:700;color:var(--text-primary);margin-bottom:3px;">Oggetto: ' + escHtml(step.subject_template) + '</div>' : '') +
                    '<div style="white-space:pre-wrap;">' + escHtml(previewBody) + (step.body_template && step.body_template.length > 200 ? '…' : '') + '</div>' +
                  '</div>'
                : '<div style="font-size:0.74rem;color:var(--text-tertiary);font-style:italic;padding:0.4rem 0;">Template vuoto. Clicca "Genera AI" o "Modifica" per scriverlo.</div>'
            ) +
        '</div>'
    );
}

function bindDetailEvents(container, seq, niches, sapServices, onReload) {
    // Delete sequenza
    container.querySelector('#btn-delete-seq')?.addEventListener('click', async () => {
        const ok = await showConfirm('Eliminare la sequenza "' + seq.name + '" e tutti i suoi step?', 'Elimina', 'Annulla');
        if (!ok) return;
        try {
            await deleteSequence(seq.id);
            showGlobalAlert('Sequenza eliminata', 'success');
            window.location.hash = 'sales-sequences';
        } catch (err) {
            showGlobalAlert('Errore: ' + err.message, 'error');
        }
    });

    // Save meta
    container.querySelector('#btn-save-seq-meta')?.addEventListener('click', async () => {
        const payload = {
            id: seq.id,
            niche_id: container.querySelector('#seq-edit-niche').value || null,
            target_sap_id: container.querySelector('#seq-edit-sap').value || null,
            tone: container.querySelector('#seq-edit-tone').value,
            status: container.querySelector('#seq-edit-status').value,
        };
        try {
            await upsertSequence(payload);
            showGlobalAlert('Salvato', 'success');
            onReload();
        } catch (err) {
            showGlobalAlert('Errore: ' + err.message, 'error');
        }
    });

    // Add 5 default steps (Bani/Parozzi)
    container.querySelector('#btn-add-default-steps')?.addEventListener('click', async () => {
        if (seq.steps && seq.steps.length > 0) {
            const ok = await showConfirm('La sequenza ha già ' + seq.steps.length + ' step. Aggiungere comunque i 5 di default in coda?', 'Aggiungi', 'Annulla');
            if (!ok) return;
        }
        try {
            const baseNumber = (seq.steps?.length || 0) + 1;
            const defaults = [
                { step_number: baseNumber,     channel: 'email', step_type: 'initial',         delay_days: 0  },
                { step_number: baseNumber + 1, channel: 'email', step_type: 'followup_light', delay_days: 2  },
                { step_number: baseNumber + 2, channel: 'email', step_type: 'followup_value', delay_days: 5  },
                { step_number: baseNumber + 3, channel: 'email', step_type: 'followup_gif',   delay_days: 10 },
                { step_number: baseNumber + 4, channel: 'email', step_type: 'final_close',    delay_days: 15 },
            ];
            for (const s of defaults) {
                await upsertStep({ ...s, sequence_id: seq.id, is_active: true });
            }
            showGlobalAlert('5 step base creati. Clicca "Genera AI" su ogni step per i template.', 'success');
            onReload();
        } catch (err) {
            showGlobalAlert('Errore: ' + err.message, 'error');
        }
    });

    // Add step manuale
    container.querySelector('#btn-add-step')?.addEventListener('click', () => {
        openStepEditorModal(null, seq, onReload);
    });

    // Per ogni step
    container.querySelectorAll('.btn-edit-step').forEach(btn => {
        btn.addEventListener('click', () => {
            const stepId = btn.dataset.stepId;
            const step = (seq.steps || []).find(s => s.id === stepId);
            if (step) openStepEditorModal(step, seq, onReload);
        });
    });
    container.querySelectorAll('.btn-delete-step').forEach(btn => {
        btn.addEventListener('click', async () => {
            const stepId = btn.dataset.stepId;
            const ok = await showConfirm('Eliminare questo step?', 'Elimina', 'Annulla');
            if (!ok) return;
            try {
                await deleteStep(stepId);
                showGlobalAlert('Step eliminato', 'success');
                onReload();
            } catch (err) {
                showGlobalAlert('Errore: ' + err.message, 'error');
            }
        });
    });
    container.querySelectorAll('.btn-gen-template').forEach(btn => {
        btn.addEventListener('click', async () => {
            const stepId = btn.dataset.stepId;
            const step = (seq.steps || []).find(s => s.id === stepId);
            if (!step) return;
            await generateAndSaveTemplate(btn, step, seq, niches, sapServices, onReload);
        });
    });
}

async function generateAndSaveTemplate(btn, step, seq, niches, sapServices, onReload) {
    const origLabel = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round" style="font-size:0.8rem;animation:spin 1s linear infinite;">refresh</span>AI…';
    try {
        const niche = seq.niche_id ? niches.find(n => n.id === seq.niche_id) : null;
        const sap = seq.target_sap_id ? sapServices.find(s => s.id === seq.target_sap_id) : null;
        const previousMessage = findPreviousMessage(seq.steps, step.step_number);

        const generated = await generateOutreachStepTemplate({
            step,
            niche,
            sap,
            tone: seq.tone || 'professionale',
            previousMessage,
        });

        const fields = extractTemplateFields(step.channel, generated);
        await upsertStep({
            id: step.id,
            sequence_id: seq.id,
            step_number: step.step_number,
            channel: step.channel,
            step_type: step.step_type,
            delay_days: step.delay_days,
            subject_template: fields.subject || null,
            body_template: fields.body || null,
            loom_script_template: fields.loom_script || null,
            is_active: step.is_active,
        });
        showGlobalAlert('Template generato + salvato', 'success');
        onReload();
    } catch (err) {
        console.error('[OutreachWriter] error', err);
        showGlobalAlert('Errore AI: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = origLabel;
    }
}

function findPreviousMessage(steps, currentStepNumber) {
    if (!Array.isArray(steps)) return null;
    const sorted = [...steps].sort((a, b) => a.step_number - b.step_number);
    let prev = null;
    for (const s of sorted) {
        if (s.step_number >= currentStepNumber) break;
        if (s.body_template) prev = s.body_template;
    }
    return prev;
}

// ─── MODAL STEP EDITOR ───────────────────────────────────────────────────────

function openStepEditorModal(step, seq, onSave) {
    const isNew = !step;
    const s = step || {
        step_number: (seq.steps?.length || 0) + 1,
        channel: 'email',
        step_type: 'initial',
        delay_days: 0,
        is_active: true,
    };

    const channelOptions = STEP_CHANNELS.map(c => '<option value="' + c.key + '"' + (s.channel === c.key ? ' selected' : '') + '>' + c.label + '</option>').join('');
    const typeOptions = STEP_TYPES.map(t => '<option value="' + t.key + '"' + (s.step_type === t.key ? ' selected' : '') + '>' + t.label + '</option>').join('');

    const overlay = buildOverlay('modal-step-editor');
    overlay.innerHTML = buildModalShell(
        isNew ? 'Nuovo step #' + s.step_number : 'Step #' + s.step_number,
        '',
        '<div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:0.6rem;margin-bottom:0.75rem;">' +
                '<div>' + fieldLabel('Step #') +
                    '<input id="se-num" type="number" value="' + s.step_number + '" style="width:100%;padding:0.55rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;box-sizing:border-box;"></div>' +
                '<div>' + fieldLabel('Canale') +
                    '<select id="se-channel" style="width:100%;padding:0.55rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;">' + channelOptions + '</select></div>' +
                '<div>' + fieldLabel('Tipo step') +
                    '<select id="se-type" style="width:100%;padding:0.55rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;">' + typeOptions + '</select></div>' +
                '<div>' + fieldLabel('Delay (gg)') +
                    '<input id="se-delay" type="number" min="0" value="' + (s.delay_days || 0) + '" style="width:100%;padding:0.55rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;box-sizing:border-box;"></div>' +
            '</div>' +
            '<div style="margin-bottom:0.75rem;">' + fieldLabel('Oggetto (solo email/Loom)') +
                '<input id="se-subject" type="text" value="' + escHtml(s.subject_template || '') + '" placeholder="Es: Domanda veloce, {{business_name}}" ' +
                    'style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;box-sizing:border-box;"></div>' +
            '<div style="margin-bottom:0.75rem;">' + fieldLabel('Corpo messaggio') +
                '<textarea id="se-body" rows="8" placeholder="Usa placeholder {{business_name}}, {{contact_name}}, {{nome_mittente}}" ' +
                    'style="width:100%;padding:0.7rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;resize:vertical;box-sizing:border-box;font-family:inherit;">' + escHtml(s.body_template || '') + '</textarea></div>' +
            '<div style="margin-bottom:0.75rem;">' + fieldLabel('Script Loom (solo se canale Loom)') +
                '<textarea id="se-loom" rows="5" placeholder="Script video 3-6 min" ' +
                    'style="width:100%;padding:0.7rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;resize:vertical;box-sizing:border-box;font-family:inherit;">' + escHtml(s.loom_script_template || '') + '</textarea></div>' +
            '<label style="display:inline-flex;align-items:center;gap:6px;font-size:0.82rem;color:var(--text-secondary);font-weight:600;cursor:pointer;">' +
                '<input id="se-active" type="checkbox" ' + (s.is_active !== false ? 'checked' : '') + '><span>Step attivo</span>' +
            '</label>' +
        '</div>',
        '<button class="btn-cancel-modal" style="padding:0.6rem 1.2rem;border-radius:12px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-secondary);font-size:0.85rem;font-weight:600;cursor:pointer;">Annulla</button>' +
        '<button id="btn-save-step" class="primary-btn" style="padding:0.6rem 1.4rem;border-radius:12px;font-size:0.85rem;font-weight:700;">Salva</button>'
    );

    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.btn-cancel-modal').addEventListener('click', close);
    overlay.querySelector('.modal-close-x').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    overlay.querySelector('#btn-save-step').addEventListener('click', async () => {
        const payload = {
            sequence_id: seq.id,
            step_number: parseInt(overlay.querySelector('#se-num').value, 10) || 1,
            channel: overlay.querySelector('#se-channel').value,
            step_type: overlay.querySelector('#se-type').value,
            delay_days: parseInt(overlay.querySelector('#se-delay').value, 10) || 0,
            subject_template: overlay.querySelector('#se-subject').value.trim() || null,
            body_template: overlay.querySelector('#se-body').value.trim() || null,
            loom_script_template: overlay.querySelector('#se-loom').value.trim() || null,
            is_active: overlay.querySelector('#se-active').checked,
        };
        if (s.id) payload.id = s.id;
        try {
            await upsertStep(payload);
            showGlobalAlert(isNew ? 'Step creato' : 'Step salvato', 'success');
            close();
            onSave && onSave();
        } catch (err) {
            showGlobalAlert('Errore: ' + err.message, 'error');
        }
    });
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function loadingHTML(label) {
    return '<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--text-secondary);gap:0.75rem;"><span class="material-icons-round" style="animation:spin 1s linear infinite;">refresh</span>' + label + '</div>';
}

function fieldLabel(label) {
    return '<label style="font-size:0.7rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:3px;">' + label + '</label>';
}

function buildOverlay(id) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.75);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
    return overlay;
}

function buildModalShell(title, headerExtra, bodyHTML, footerHTML) {
    return (
        '<div style="background:var(--bg-primary, #ffffff);border-radius:20px;padding:2rem;max-width:760px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 25px 80px rgba(0,0,0,0.35);border:1px solid var(--glass-border, rgba(0,0,0,0.08));">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;">' +
                '<h2 style="font-size:1.25rem;font-weight:800;font-family:var(--font-titles);margin:0;">' + title + '</h2>' +
                '<div style="display:flex;gap:0.4rem;align-items:center;">' +
                    headerExtra +
                    '<button class="modal-close-x" style="background:var(--bg-tertiary);color:var(--text-secondary);border:none;border-radius:10px;padding:0.4rem 0.75rem;font-size:0.78rem;cursor:pointer;">✕</button>' +
                '</div>' +
            '</div>' +
            bodyHTML +
            '<div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--glass-border);">' +
                footerHTML +
            '</div>' +
        '</div>'
    );
}

function truncate(s, n) {
    if (!s) return '';
    return s.length > n ? s.slice(0, n) : s;
}

function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
