// SAP-7+8 — PM Template Generator
//
// SAP-7: quando SAP viene venduto in un ordine, il template pm_space viene clonato
//        automaticamente nella commessa. Il clone logic è in order_from_sap.js.
//
// SAP-8: genera con AI il template di processo operativo (task, milestone, checklist)
//        partendo dai 7 campi input del SAP e lo scrive nel pm_space del SAP template.
//        La prossima volta che si crea un ordine da quel SAP, parte già strutturato.

import { supabase } from '../../modules/config.js?v=8000';
import { state } from '../../modules/state.js?v=8000';
import { chat, parseAiJson } from '../../modules/ai_client.js?v=8000';
import { fetchProjectSpaceForSapService, createPMItem } from '../../modules/pm_api.js?v=8000';

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function openPmTemplateGenerator(serviceId) {
    const service = state.sapServices?.find(s => s.id === serviceId);
    if (!service) { await window.showAlert('Servizio SAP non trovato.', 'error'); return; }

    const missingFields = [];
    if (!service.value_proposition) missingFields.push('Value Proposition');
    if (!service.package_includes?.length) missingFields.push('Cosa include il pacchetto');
    if (!service.delivery_time_days) missingFields.push('Tempo di consegna');

    if (missingFields.length > 0) {
        await window.showAlert(
            `Prima di generare il template PM, compila nella sezione "Dati per AI":\n• ${missingFields.join('\n• ')}`,
            'warning'
        );
        return;
    }

    const existing = document.getElementById('sap-pm-gen-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'sap-pm-gen-modal';
    modal.className = 'modal';
    modal.innerHTML = _buildShellHTML(service);
    document.body.appendChild(modal);
    modal.classList.add('active');
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    document.getElementById('sap-pmgen-start').addEventListener('click', () => _runGeneration(service, modal));
}

// ─── Generation engine ────────────────────────────────────────────────────────

async function _runGeneration(service, modal) {
    const btn = document.getElementById('sap-pmgen-start');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round" style="font-size:1rem; animation:spin 1s linear infinite;">autorenew</span> Generando…';

    const statusEl = document.getElementById('sap-pmgen-status');
    if (statusEl) statusEl.textContent = 'Claude sta progettando il workflow operativo…';

    try {
        // 1. Genera il template con AI
        const template = await _generateTemplate(service);

        if (statusEl) statusEl.textContent = 'Salvando le attività nel pm_space del SAP…';

        // 2. Ottieni/crea il pm_space del SAP (base, senza variant)
        const space = await fetchProjectSpaceForSapService(service.id, null);
        if (!space?.id) throw new Error('Impossibile creare il pm_space per il SAP');

        // 3. Svuota i pm_items esistenti nel template (rimpiazza tutto)
        const confirmed = await window.showConfirm(
            `Il template PM del SAP ha ${template.activities?.length || 0} attività generate da AI.\nVuoi sovrascrivere le attività esistenti nel template?`,
            { confirmText: 'Sì, sovrascrivi', type: 'warning' }
        );
        if (!confirmed) { modal.remove(); return; }

        await supabase.from('pm_items').delete().eq('space_ref', space.id);

        // 4. Inserisci le nuove attività (con gerarchia)
        const idMap = {};
        let inserted = 0;

        for (const activity of (template.activities || [])) {
            const actItem = await createPMItem({
                space_ref: space.id,
                title: activity.title,
                item_type: 'attivita',
                notes: activity.description || null,
                status: 'todo',
                priority: activity.priority || 'medium',
            });
            if (!actItem?.id) continue;
            idMap[activity.id] = actItem.id;
            inserted++;

            for (const task of (activity.tasks || [])) {
                const taskItem = await createPMItem({
                    space_ref: space.id,
                    title: task.title,
                    item_type: 'task',
                    parent_ref: actItem.id,
                    notes: task.notes || null,
                    status: 'todo',
                    priority: task.priority || 'medium',
                });
                if (taskItem?.id) inserted++;
            }
        }

        modal.remove();
        await window.showAlert(
            `Template PM generato! ${inserted} voci inserite nel pm_space del SAP.\nLa prossima volta che crei un ordine da questo SAP, il workflow sarà copiato automaticamente.`,
            'success'
        );

    } catch (err) {
        console.error('[pm_template_generator]', err);
        await window.showAlert('Errore: ' + err.message, 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-round" style="font-size:1rem;">auto_awesome</span> Genera template';
        }
    }
}

// ─── AI prompt ────────────────────────────────────────────────────────────────

async function _generateTemplate(service) {
    const includes = (service.package_includes || []).map(i => typeof i === 'string' ? i : (i.label || '')).join('; ');

    const prompt = `Sei un project manager esperto di agenzie di comunicazione italiane.
Crea un **template di processo operativo** completo per questo Servizio a Pacchetto.
Il template diventerà la struttura standard di ogni commessa venduta con questo SAP.

## SAP: ${service.name}
- Value proposition: ${service.value_proposition}
- Target: ${service.target_customer || 'N/D'}
- Deliverable inclusi: ${includes || 'N/D'}
- Team: ${service.team_required || 'N/D'}
- Tempo consegna: ${service.delivery_time_days} giorni

## Istruzioni
- Crea 3-5 macro-attività (Phases/Milestones del progetto)
- Ogni macro-attività ha 3-6 task specifici
- I task devono essere concreti e direttamente eseguibili
- Ogni attività ha una priorità: high/medium/low
- I nomi devono essere operativi, non marketing

Rispondi SOLO con JSON valido:
{
  "activities": [
    {
      "id": "act_1",
      "title": "Nome macro-attività",
      "description": "Breve descrizione (opzionale)",
      "priority": "high|medium|low",
      "tasks": [
        {
          "title": "Nome task concreto",
          "notes": "Note o dettagli aggiuntivi (opzionale)",
          "priority": "high|medium|low"
        }
      ]
    }
  ]
}`;

    const resp = await chat({
        feature: 'doc_generator',
        messages: [
            { role: 'system', content: 'Sei un project manager esperto. Rispondi solo con JSON valido, nessun testo prima o dopo.' },
            { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
        temperature: 0.3,
        feature_context: { entity_type: 'core_service', entity_id: service.id, doc_type: 'pm_template' },
    });

    const raw = resp?.choices?.[0]?.message?.content;
    return parseAiJson(raw);
}

// ─── Modal HTML ───────────────────────────────────────────────────────────────

function _buildShellHTML(service) {
    const includes = (service.package_includes || []).slice(0, 4).map(i => {
        const label = typeof i === 'string' ? i : (i.label || '');
        return `<li style="font-size:0.82rem; color:var(--text-secondary);">${label}</li>`;
    }).join('');

    return `
        <div class="modal-content" style="max-width:500px; width:95vw; padding:0; border-radius:20px; overflow:hidden; background:var(--card-bg); border:1px solid var(--glass-border); box-shadow:var(--shadow-xl);">
            <div style="padding:1.25rem 1.75rem; background:var(--brand-gradient); color:white; display:flex; align-items:center; gap:0.75rem;">
                <span class="material-icons-round" style="font-size:1.4rem;">account_tree</span>
                <div>
                    <div style="font-weight:800; font-size:1.05rem; font-family:var(--font-titles);">Genera template PM da AI</div>
                    <div style="font-size:0.8rem; opacity:0.85;">${service.name}</div>
                </div>
            </div>

            <div style="padding:1.5rem 1.75rem; display:flex; flex-direction:column; gap:1rem;">
                <div style="padding:0.9rem 1.1rem; background:rgba(99,102,241,0.06); border:1px solid rgba(99,102,241,0.15); border-radius:12px; font-size:0.85rem; color:var(--text-secondary); line-height:1.5;">
                    Claude genererà 3-5 macro-attività con task specifici per il processo operativo di questo SAP.
                    Il template verrà salvato nel pm_space del SAP e sarà <strong>copiato automaticamente</strong> in ogni commessa creata da questo SAP.
                </div>

                ${includes ? `
                    <div>
                        <div style="font-size:0.65rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary); margin-bottom:0.5rem;">Deliverable inclusi (input per AI)</div>
                        <ul style="margin:0; padding-left:1.25rem; display:flex; flex-direction:column; gap:0.25rem;">${includes}</ul>
                    </div>
                ` : ''}

                <div id="sap-pmgen-status" style="font-size:0.82rem; color:var(--text-tertiary); min-height:1.2rem;"></div>
            </div>

            <div style="padding:1rem 1.75rem 1.5rem 1.75rem; display:flex; gap:0.75rem; justify-content:flex-end; border-top:1px solid var(--glass-border);">
                <button onclick="document.getElementById('sap-pm-gen-modal').remove()" style="padding:0.6rem 1.25rem; border-radius:10px; border:1px solid var(--glass-border); background:white; color:var(--text-primary); font-weight:700; font-size:0.875rem; cursor:pointer;">Annulla</button>
                <button id="sap-pmgen-start" style="display:flex; align-items:center; gap:0.5rem; padding:0.6rem 1.5rem; border-radius:10px; border:none; background:var(--brand-gradient); color:white; font-weight:700; font-size:0.875rem; cursor:pointer; box-shadow:0 4px 12px rgba(99,102,241,0.3);">
                    <span class="material-icons-round" style="font-size:1rem;">auto_awesome</span> Genera template
                </button>
            </div>
        </div>
    `;
}
