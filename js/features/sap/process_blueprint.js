// SAP-PROCESS — Processo Operativo
//
// Il blueprint narrativo è l'artefatto centrale del SAP:
// - generato da Claude partendo dai campi strutturati o da una trascrizione
// - editabile manualmente
// - fonte di verità per il doc_generator e il pm_template_generator

import { supabase } from '../../modules/config.js?v=8000';
import { state } from '../../modules/state.js?v=8000';
import { chat } from '../../modules/ai_client.js?v=8000';

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function openProcessBlueprintEditor(serviceId) {
    const service = state.sapServices?.find(s => s.id === serviceId);
    if (!service) { window.showAlert('SAP non trovato.', 'error'); return; }

    const existing = document.getElementById('sap-blueprint-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'sap-blueprint-modal';
    modal.className = 'modal active';
    modal.innerHTML = _buildShellHTML(service);
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    _setupHandlers(service, modal);
}

// ─── Generate ─────────────────────────────────────────────────────────────────

async function _generateBlueprint(service) {
    const includes = (service.package_includes || [])
        .map(i => typeof i === 'string' ? i : (i.label || ''))
        .filter(Boolean)
        .join('; ');

    const hasBirthData = service.birth_transcript || service.value_proposition;
    if (!hasBirthData) {
        throw new Error('Compila almeno la Value Proposition o importa da trascrizione prima di generare il processo.');
    }

    const contextSection = service.birth_transcript
        ? `## Trascrizione originale (estratto)\n${service.birth_transcript.substring(0, 2000)}${service.birth_transcript.length > 2000 ? '\n[...]' : ''}`
        : '';

    const resp = await chat({
        feature: 'doc_generator',
        messages: [
            {
                role: 'system',
                content: `Sei un consulente di processo per agenzie di comunicazione italiane. Scrivi processi operativi chiari, pratici e direttamente utilizzabili dal team. Rispondi in italiano con testo narrativo strutturato.`
            },
            {
                role: 'user',
                content: `Scrivi il Processo Operativo completo per questo Servizio a Pacchetto di un'agenzia di comunicazione italiana.

## SAP: ${service.name}
- Value Proposition: ${service.value_proposition || 'N/D'}
- Target: ${service.target_customer || 'N/D'}
- Deliverable inclusi: ${includes || 'N/D'}
- Team richiesto: ${service.team_required || 'N/D'}
- Tempo di consegna: ${service.delivery_time_days ? service.delivery_time_days + ' giorni' : 'N/D'}

${contextSection}

## Cosa scrivere
Scrivi una guida operativa interna che descriva:
1. **Come inizia** — cosa succede dalla firma/accettazione del cliente al kick-off
2. **Le fasi principali** — descrizione narrativa di ogni macro-fase (non elenchi di task, ma descrizione di cosa accade)
3. **Touchpoint col cliente** — quando e come il cliente viene coinvolto, cosa deve fare, quando approva
4. **Coordinamento interno** — come si coordinano le figure del team, dipendenze tra attività
5. **Come finisce** — consegna finale, approvazione, archiviazione, follow-up

Scrivi come se stessi spiegando al team come si eroga questo servizio per la prima volta.
Tono: pratico, diretto, niente marketing.
Lunghezza: 250-400 parole.`
            }
        ],
        max_tokens: 1500,
        temperature: 0.3,
        feature_context: { entity_type: 'core_service', entity_id: service.id, doc_type: 'process_blueprint' },
    });

    return resp?.choices?.[0]?.message?.content?.trim() || '';
}

// ─── Save ─────────────────────────────────────────────────────────────────────

async function _saveBlueprint(serviceId, text) {
    const { error } = await supabase
        .from('core_services')
        .update({ process_blueprint: text })
        .eq('id', serviceId);

    if (error) throw error;

    const service = state.sapServices?.find(s => s.id === serviceId);
    if (service) service.process_blueprint = text;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

function _setupHandlers(service, modal) {
    const textarea = modal.querySelector('#sap-blueprint-text');
    const generateBtn = modal.querySelector('#sap-blueprint-generate');
    const saveBtn = modal.querySelector('#sap-blueprint-save');
    const statusEl = modal.querySelector('#sap-blueprint-status');

    if (service.process_blueprint) {
        textarea.value = service.process_blueprint;
        _setStatus(statusEl, 'Processo esistente — modifica e salva o rigenera.', 'info');
    }

    generateBtn.addEventListener('click', async () => {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="material-icons-round" style="font-size:1rem; animation:spin 1s linear infinite;">autorenew</span> Generando…';
        _setStatus(statusEl, 'Claude sta scrivendo il processo operativo…', 'loading');

        try {
            const text = await _generateBlueprint(service);
            textarea.value = text;
            _setStatus(statusEl, 'Processo generato — rileggi, aggiusta e salva.', 'success');
        } catch (err) {
            console.error('[process_blueprint] generate', err);
            _setStatus(statusEl, 'Errore: ' + err.message, 'error');
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<span class="material-icons-round" style="font-size:1rem;">auto_awesome</span> Rigenera';
        }
    });

    saveBtn.addEventListener('click', async () => {
        const text = textarea.value.trim();
        if (!text) { window.showAlert('Il processo non può essere vuoto.', 'warning'); return; }

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="material-icons-round" style="font-size:1rem; animation:spin 1s linear infinite;">autorenew</span> Salvando…';

        try {
            await _saveBlueprint(service.id, text);
            modal.remove();
            await window.showAlert('Processo Operativo salvato. Ora puoi generare documenti e template PM.', 'success');
        } catch (err) {
            console.error('[process_blueprint] save', err);
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<span class="material-icons-round" style="font-size:1rem;">save</span> Salva';
            window.showAlert('Errore nel salvataggio: ' + err.message, 'error');
        }
    });

    // Auto-generate if no existing blueprint and we have enough data
    if (!service.process_blueprint && (service.value_proposition || service.birth_transcript)) {
        setTimeout(() => generateBtn.click(), 300);
    }
}

function _setStatus(el, msg, type) {
    if (!el) return;
    const colors = { info: 'var(--text-tertiary)', loading: 'var(--brand-blue)', success: '#10b981', error: '#ef4444' };
    el.textContent = msg;
    el.style.color = colors[type] || 'var(--text-tertiary)';
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function _buildShellHTML(service) {
    const hasBlueprint = !!service.process_blueprint;
    const hasData = !!(service.value_proposition || service.birth_transcript);

    return `
        <div class="modal-content" style="max-width:660px; width:95vw; padding:0; border-radius:20px; overflow:hidden; background:var(--card-bg); border:1px solid var(--glass-border); box-shadow:var(--shadow-xl);">
            <div style="padding:1.25rem 1.75rem; background:var(--brand-gradient); color:white; display:flex; align-items:center; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:0.75rem;">
                    <span class="material-icons-round" style="font-size:1.4rem;">route</span>
                    <div>
                        <div style="font-weight:800; font-size:1.05rem; font-family:var(--font-titles);">Processo Operativo</div>
                        <div style="font-size:0.8rem; opacity:0.85;">${service.name}</div>
                    </div>
                </div>
                <button onclick="document.getElementById('sap-blueprint-modal').remove()" style="background:rgba(255,255,255,0.2); border:none; color:white; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                    <span class="material-icons-round" style="font-size:1.1rem;">close</span>
                </button>
            </div>

            <div style="padding:1.5rem 1.75rem; display:flex; flex-direction:column; gap:1rem;">

                <div style="padding:0.85rem 1.1rem; background:rgba(99,102,241,0.06); border:1px solid rgba(99,102,241,0.15); border-radius:12px; font-size:0.85rem; color:var(--text-secondary); line-height:1.5;">
                    Il Processo Operativo è la fonte di verità del SAP.
                    Documenti e template PM vengono generati a partire da qui.
                </div>

                ${!hasData ? `
                    <div style="padding:0.75rem 1rem; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.2); border-radius:10px; font-size:0.82rem; color:#b45309;">
                        Importa prima una trascrizione o compila la Value Proposition per poter generare il processo.
                    </div>
                ` : ''}

                <div>
                    <label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary);">Descrizione narrativa del processo</label>
                    <textarea id="sap-blueprint-text" placeholder="${hasData ? 'Sto generando il processo…' : 'Compila prima i dati base del SAP.'}"
                        style="width:100%; margin-top:0.5rem; padding:0.85rem 1rem; border:1px solid var(--glass-border); border-radius:12px; background:var(--bg-color); color:var(--text-primary); font-size:0.88rem; line-height:1.7; resize:vertical; min-height:220px; font-family:inherit; box-sizing:border-box;"
                        ${!hasData ? 'disabled' : ''}></textarea>
                </div>

                <div id="sap-blueprint-status" style="font-size:0.82rem; color:var(--text-tertiary); min-height:1.2rem;"></div>

            </div>

            <div style="padding:1rem 1.75rem 1.5rem; display:flex; gap:0.75rem; justify-content:flex-end; border-top:1px solid var(--glass-border);">
                <button onclick="document.getElementById('sap-blueprint-modal').remove()" style="padding:0.6rem 1.25rem; border-radius:10px; border:1px solid var(--glass-border); background:white; color:var(--text-primary); font-weight:700; font-size:0.875rem; cursor:pointer;">Annulla</button>
                <button id="sap-blueprint-generate" ${!hasData ? 'disabled' : ''} style="display:flex; align-items:center; gap:0.5rem; padding:0.6rem 1.25rem; border-radius:10px; border:1px solid var(--glass-border); background:white; color:var(--brand-blue); font-weight:700; font-size:0.875rem; cursor:pointer;">
                    <span class="material-icons-round" style="font-size:1rem;">auto_awesome</span>
                    ${hasBlueprint ? 'Rigenera' : 'Genera con AI'}
                </button>
                <button id="sap-blueprint-save" style="display:flex; align-items:center; gap:0.5rem; padding:0.6rem 1.5rem; border-radius:10px; border:none; background:var(--brand-gradient); color:white; font-weight:700; font-size:0.875rem; cursor:pointer; box-shadow:0 4px 12px rgba(99,102,241,0.3);">
                    <span class="material-icons-round" style="font-size:1rem;">save</span> Salva
                </button>
            </div>
        </div>
    `;
}
