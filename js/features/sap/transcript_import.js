// SAP-BIRTH — Importa SAP da trascrizione riunione
//
// Percorso: incolla trascrizione (o testo libero) → Claude estrae tutti i campi
// strutturati + bozza il Processo Operativo → crea/aggiorna il SAP in DB.
//
// Funziona sia per creare un nuovo SAP che per arricchire uno esistente.

import { supabase } from '../../modules/config.js?v=8000';
import { state } from '../../modules/state.js?v=8000';
import { chat, parseAiJson } from '../../modules/ai_client.js?v=8000';

export async function openTranscriptImport(existingServiceId = null) {
    const existing = document.getElementById('sap-transcript-modal');
    if (existing) existing.remove();

    const service = existingServiceId ? state.sapServices?.find(s => s.id === existingServiceId) : null;

    const modal = document.createElement('div');
    modal.id = 'sap-transcript-modal';
    modal.className = 'modal active';
    modal.innerHTML = _buildShellHTML(service);
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    document.getElementById('sap-transcript-analyze-btn').addEventListener('click', () => _runExtraction(modal, existingServiceId));
}

// ─── Extraction engine ────────────────────────────────────────────────────────

async function _runExtraction(modal, existingServiceId) {
    const textarea = document.getElementById('sap-transcript-text');
    const text = textarea?.value?.trim();
    if (!text || text.length < 100) {
        window.showAlert('Incolla almeno 100 caratteri di trascrizione per procedere.', 'warning');
        return;
    }

    const btn = document.getElementById('sap-transcript-analyze-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round" style="font-size:1rem; animation:spin 1s linear infinite;">autorenew</span> Analizzando…';

    const statusEl = document.getElementById('sap-transcript-status');
    if (statusEl) statusEl.textContent = 'Claude sta leggendo la trascrizione…';

    try {
        const extracted = await _extractFromTranscript(text);

        if (statusEl) statusEl.textContent = 'Estrazione completata — controlla i dati.';

        _renderPreview(modal, extracted, text, existingServiceId);

    } catch (err) {
        console.error('[transcript_import]', err);
        if (statusEl) statusEl.textContent = '';
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons-round" style="font-size:1rem;">psychology</span> Analizza trascrizione';
        window.showAlert('Errore nell\'analisi: ' + err.message, 'error');
    }
}

async function _extractFromTranscript(transcript) {
    const resp = await chat({
        feature: 'doc_generator',
        messages: [
            {
                role: 'system',
                content: `Sei un consulente strategico per agenzie di comunicazione italiane. Estrai informazioni strutturate da trascrizioni di riunioni per definire un Servizio a Pacchetto (SAP). Rispondi SOLO con JSON valido.`
            },
            {
                role: 'user',
                content: `Analizza questa trascrizione/testo e estrai le informazioni per definire un Servizio a Pacchetto (SAP) di un'agenzia di comunicazione italiana.

## Trascrizione
${transcript}

## Output richiesto (JSON)
{
  "name": "Nome commerciale del SAP (breve, memorabile)",
  "value_proposition": "Proposta di valore in 1-2 frasi (beneficio principale per il cliente)",
  "target_customer": "A chi è rivolto (tipo di cliente, settore, dimensione)",
  "package_includes": ["deliverable 1", "deliverable 2", "..."],
  "delivery_time_days": <numero intero giorni dalla firma al deliverable finale>,
  "team_required": "Ruoli/figure necessarie per erogarlo",
  "process_blueprint": "Descrizione narrativa del processo operativo completo: come viene erogato il servizio step by step, chi fa cosa, quali sono i touchpoint col cliente, le fasi di approvazione, le dipendenze tra attività. Minimo 200 parole, scritto come guida operativa interna.",
  "suggested_departments": ["reparto 1", "reparto 2"],
  "suggested_areas": ["area 1"],
  "pricing_hint": "Eventuale indicazione di pricing emersa dalla trascrizione (o null)",
  "confidence": "alta|media|bassa",
  "notes": "Eventuali ambiguità o informazioni mancanti che sarebbe utile chiarire"
}`
            }
        ],
        max_tokens: 3000,
        temperature: 0.2,
        feature_context: { entity_type: 'core_service', doc_type: 'transcript_extraction' },
    });

    const raw = resp?.choices?.[0]?.message?.content;
    return parseAiJson(raw);
}

// ─── Preview + Save ───────────────────────────────────────────────────────────

function _renderPreview(modal, data, originalTranscript, existingServiceId) {
    const body = document.getElementById('sap-transcript-body');
    if (!body) return;

    const confidenceColor = { alta: '#10b981', media: '#f59e0b', bassa: '#ef4444' };
    const col = confidenceColor[data.confidence] || '#64748b';

    body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:1.25rem;">

            <div style="padding:0.75rem 1rem; background:rgba(16,185,129,0.07); border:1px solid rgba(16,185,129,0.2); border-radius:12px; display:flex; align-items:center; gap:0.75rem;">
                <span class="material-icons-round" style="color:${col}; font-size:1.2rem;">verified</span>
                <div style="font-size:0.85rem; color:var(--text-secondary);">
                    Confidenza estrazione: <strong style="color:${col};">${data.confidence}</strong>
                    ${data.notes ? ` — ${data.notes}` : ''}
                </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                ${_field('Nome SAP', 'sap-preview-name', data.name)}
                ${_field('Target cliente', 'sap-preview-target', data.target_customer)}
            </div>
            ${_field('Value Proposition', 'sap-preview-vp', data.value_proposition)}

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                ${_field('Tempo consegna (giorni)', 'sap-preview-days', data.delivery_time_days)}
                ${_field('Team richiesto', 'sap-preview-team', data.team_required)}
            </div>

            <div>
                <label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary);">Deliverable inclusi</label>
                <div id="sap-preview-includes" style="margin-top:0.5rem; display:flex; flex-wrap:wrap; gap:0.4rem;">
                    ${(data.package_includes || []).map(i => `
                        <span style="padding:3px 10px; background:rgba(99,102,241,0.08); color:var(--brand-blue); border-radius:8px; font-size:0.8rem; font-weight:600;">${i}</span>
                    `).join('')}
                </div>
            </div>

            <div>
                <label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary);">Processo Operativo estratto</label>
                <textarea id="sap-preview-blueprint" style="width:100%; margin-top:0.5rem; padding:0.75rem 1rem; border:1px solid var(--glass-border); border-radius:12px; background:var(--bg-color); color:var(--text-primary); font-size:0.85rem; line-height:1.6; resize:vertical; min-height:140px; font-family:inherit; box-sizing:border-box;">${data.process_blueprint || ''}</textarea>
            </div>

            ${data.pricing_hint ? `
                <div style="padding:0.6rem 1rem; background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.15); border-radius:10px; font-size:0.82rem; color:var(--text-secondary);">
                    <b>Pricing emerso:</b> ${data.pricing_hint}
                </div>
            ` : ''}

            <div style="display:flex; gap:0.75rem; justify-content:flex-end; padding-top:0.5rem; border-top:1px solid var(--glass-border);">
                <button onclick="document.getElementById('sap-transcript-modal').remove()" style="padding:0.6rem 1.25rem; border-radius:10px; border:1px solid var(--glass-border); background:white; color:var(--text-primary); font-weight:700; font-size:0.875rem; cursor:pointer;">Annulla</button>
                <button id="sap-transcript-save-btn" style="display:flex; align-items:center; gap:0.5rem; padding:0.6rem 1.5rem; border-radius:10px; border:none; background:var(--brand-gradient); color:white; font-weight:700; font-size:0.875rem; cursor:pointer; box-shadow:0 4px 12px rgba(99,102,241,0.3);">
                    <span class="material-icons-round" style="font-size:1rem;">${existingServiceId ? 'save' : 'add_circle'}</span>
                    ${existingServiceId ? 'Aggiorna SAP' : 'Crea SAP'}
                </button>
            </div>
        </div>
    `;

    document.getElementById('sap-transcript-save-btn').addEventListener('click', () =>
        _saveExtracted(modal, data, originalTranscript, existingServiceId)
    );
}

function _field(label, id, value) {
    return `
        <div>
            <label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary);">${label}</label>
            <input id="${id}" type="text" value="${(value || '').toString().replace(/"/g, '&quot;')}"
                style="width:100%; margin-top:0.4rem; padding:0.6rem 0.9rem; border:1px solid var(--glass-border); border-radius:10px; background:var(--bg-color); color:var(--text-primary); font-size:0.88rem; box-sizing:border-box;">
        </div>
    `;
}

async function _saveExtracted(modal, data, originalTranscript, existingServiceId) {
    const btn = document.getElementById('sap-transcript-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round" style="font-size:1rem; animation:spin 1s linear infinite;">autorenew</span> Salvando…';

    try {
        const payload = {
            name: document.getElementById('sap-preview-name')?.value?.trim() || data.name,
            value_proposition: document.getElementById('sap-preview-vp')?.value?.trim() || data.value_proposition,
            target_customer: document.getElementById('sap-preview-target')?.value?.trim() || data.target_customer,
            delivery_time_days: parseInt(document.getElementById('sap-preview-days')?.value) || data.delivery_time_days || null,
            team_required: document.getElementById('sap-preview-team')?.value?.trim() || data.team_required,
            package_includes: data.package_includes || [],
            process_blueprint: document.getElementById('sap-preview-blueprint')?.value?.trim() || data.process_blueprint,
            birth_transcript: originalTranscript,
        };

        let serviceId = existingServiceId;

        if (existingServiceId) {
            const { error } = await supabase.from('core_services').update(payload).eq('id', existingServiceId);
            if (error) throw error;

            const idx = state.sapServices?.findIndex(s => s.id === existingServiceId);
            if (idx >= 0) Object.assign(state.sapServices[idx], payload);

        } else {
            const { data: newService, error } = await supabase
                .from('core_services')
                .insert({ ...payload, is_active: true })
                .select()
                .single();
            if (error) throw error;
            serviceId = newService.id;
            if (!state.sapServices) state.sapServices = [];
            state.sapServices.push(newService);
        }

        modal.remove();
        await window.showAlert(
            existingServiceId
                ? 'SAP aggiornato con i dati estratti dalla trascrizione.'
                : 'SAP creato! Ora puoi generare i documenti e il template PM.',
            'success'
        );

        if (serviceId) {
            window.location.hash = `#sap-service-detail/${serviceId}`;
        } else {
            window.location.reload();
        }

    } catch (err) {
        console.error('[transcript_import] save error', err);
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons-round" style="font-size:1rem;">save</span> Riprova';
        window.showAlert('Errore nel salvataggio: ' + err.message, 'error');
    }
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function _buildShellHTML(service) {
    return `
        <div class="modal-content" style="max-width:680px; width:95vw; padding:0; border-radius:20px; overflow:hidden; background:var(--card-bg); border:1px solid var(--glass-border); box-shadow:var(--shadow-xl);">
            <div style="padding:1.25rem 1.75rem; background:var(--brand-gradient); color:white; display:flex; align-items:center; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:0.75rem;">
                    <span class="material-icons-round" style="font-size:1.4rem;">record_voice_over</span>
                    <div>
                        <div style="font-weight:800; font-size:1.05rem; font-family:var(--font-titles);">
                            ${service ? 'Arricchisci SAP da trascrizione' : 'Nuovo SAP da trascrizione'}
                        </div>
                        <div style="font-size:0.8rem; opacity:0.85;">
                            ${service ? service.name : 'Claude estrae tutto dalla riunione'}
                        </div>
                    </div>
                </div>
                <button onclick="document.getElementById('sap-transcript-modal').remove()" style="background:rgba(255,255,255,0.2); border:none; color:white; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                    <span class="material-icons-round" style="font-size:1.1rem;">close</span>
                </button>
            </div>

            <div id="sap-transcript-body" style="padding:1.5rem 1.75rem; max-height:75vh; overflow-y:auto;">
                <div style="display:flex; flex-direction:column; gap:1rem;">
                    <div style="padding:0.85rem 1.1rem; background:rgba(99,102,241,0.06); border:1px solid rgba(99,102,241,0.15); border-radius:12px; font-size:0.85rem; color:var(--text-secondary); line-height:1.5;">
                        Incolla la trascrizione della riunione (o qualsiasi testo descrittivo del servizio).
                        Claude estrarrà nome, value proposition, deliverable, processo operativo e tutto il resto.
                    </div>

                    <div>
                        <label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary);">Trascrizione / Testo</label>
                        <textarea id="sap-transcript-text" placeholder="Incolla qui la trascrizione della riunione…" style="width:100%; margin-top:0.5rem; padding:0.85rem 1rem; border:1px solid var(--glass-border); border-radius:12px; background:var(--bg-color); color:var(--text-primary); font-size:0.88rem; line-height:1.6; resize:vertical; min-height:180px; font-family:inherit; box-sizing:border-box;"></textarea>
                    </div>

                    <div id="sap-transcript-status" style="font-size:0.82rem; color:var(--text-tertiary); min-height:1.2rem; text-align:center;"></div>

                    <div style="display:flex; gap:0.75rem; justify-content:flex-end;">
                        <button onclick="document.getElementById('sap-transcript-modal').remove()" style="padding:0.6rem 1.25rem; border-radius:10px; border:1px solid var(--glass-border); background:white; color:var(--text-primary); font-weight:700; font-size:0.875rem; cursor:pointer;">Annulla</button>
                        <button id="sap-transcript-analyze-btn" style="display:flex; align-items:center; gap:0.5rem; padding:0.6rem 1.5rem; border-radius:10px; border:none; background:var(--brand-gradient); color:white; font-weight:700; font-size:0.875rem; cursor:pointer; box-shadow:0 4px 12px rgba(99,102,241,0.3);">
                            <span class="material-icons-round" style="font-size:1rem;">psychology</span> Analizza trascrizione
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}
