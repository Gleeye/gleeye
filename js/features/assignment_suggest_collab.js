// Tariffario Mina 6 — Suggerimento collab giusto AI
// Modal su assignment-detail (admin view): AI suggerisce top 3 collab
// per i servizi assegnati basandosi su tags/ruolo + storia commesse simili.

import { supabase } from '/js/modules/config.js?v=8000';
import { ai } from '/js/modules/ai_client.js?v=8000';

const SYSTEM_PROMPT = `Sei l'assistente operativo di Gleeye, agenzia di comunicazione di Genova.
Dato un INCARICO con i suoi servizi assegnati, e la LISTA dei collaboratori attivi dell'agenzia con tags/ruoli/storia, suggerisci i TOP 3 collaboratori più adatti.

REGOLE FERREE (anti-allucinazione):
- USA SOLO i collaboratori presenti nella LISTA. NON inventare nomi.
- Match basato su: tags (es. "fotografo", "social-media", "video"), ruolo, storia (numero commesse simili gi completate).
- Distinguere chiaramente chi è "perfect fit" (tag esatto) da chi è "possibile" (tag affine).
- Se nessun collab nella lista è adatto, dillo esplicitamente in "warning".

RISPONDI in JSON:
{
  "suggestions": [
    {
      "collab_id": "uuid esatto dalla lista",
      "collab_name": "nome esatto dalla lista (per verifica)",
      "fit_score": 1-10,
      "fit_level": "perfect|good|maybe",
      "reasoning": "perché lo suggerisci, max 1 frase, riferimenti concreti a tags/storia"
    }
  ],
  "warning": "(opzionale) avvertenza se la lista non copre la richiesta"
}`;

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

const FIT_META = {
    perfect: { color: '#10b981', bg: 'rgba(16,185,129,.12)', label: 'Perfect fit' },
    good:    { color: '#3b82f6', bg: 'rgba(59,130,246,.12)', label: 'Buon match' },
    maybe:   { color: '#f59e0b', bg: 'rgba(245,158,11,.12)', label: 'Forse' },
};

window.openCollabSuggestModal = async function (assignmentId) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:16px;max-width:680px;width:100%;max-height:92vh;display:flex;flex-direction:column;">
            <div style="padding:1.25rem 1.5rem;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;">
                <div>
                    <h3 style="margin:0;font-size:1.125rem;display:flex;align-items:center;gap:.5rem;">
                        <span style="color:#8b5cf6;">✨</span> Suggerisci collaboratore
                    </h3>
                    <div style="font-size:.75rem;color:#6b7280;margin-top:.15rem;">
                        L'AI analizza i servizi dell'incarico e propone i collab più adatti.
                    </div>
                </div>
                <button class="scs-close" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#6b7280;">×</button>
            </div>
            <div style="padding:1.5rem;overflow-y:auto;flex:1;min-height:200px;">
                <div id="scs-body" style="display:flex;align-items:center;justify-content:center;gap:.6rem;padding:1.5rem;color:#6b7280;font-size:.9rem;">
                    <span class="material-icons-round" style="color:#8b5cf6;animation:spin 1s linear infinite;">refresh</span>
                    L'AI sta analizzando i collaboratori…
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelectorAll('.scs-close').forEach(b => b.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', ev => { if (ev.target === modal) modal.remove(); });

    const body = modal.querySelector('#scs-body');

    try {
        // 1. Fetch assignment + ordine + servizi
        const { data: assignment, error: aErr } = await supabase
            .from('assignments')
            .select('id, order_id, collaborator_id, description, notes, scope')
            .eq('id', assignmentId)
            .single();
        if (aErr || !assignment) throw new Error('Assignment non trovato');

        const { data: order } = assignment.order_id
            ? await supabase.from('orders').select('id, title, order_number, description').eq('id', assignment.order_id).single()
            : { data: null };

        const { data: services } = assignment.order_id && assignment.collaborator_id
            ? await supabase
                .from('collaborator_services')
                .select('quantity, legacy_service_name, services(name, description, tags)')
                .eq('order_id', assignment.order_id)
                .eq('collaborator_id', assignment.collaborator_id)
            : { data: [] };

        // 2. Fetch tutti collab attivi (con storia compatta)
        const { data: collabs, error: cErr } = await supabase
            .from('collaborators')
            .select('id, full_name, name, role, tags')
            .eq('is_active', true)
            .neq('id', assignment.collaborator_id || '00000000-0000-0000-0000-000000000000');
        if (cErr) throw cErr;

        // 3. Conteggio commesse storia per ogni collab (compatto)
        const { data: history } = await supabase
            .from('assignments')
            .select('collaborator_id, status')
            .eq('status', 'Completato');
        const completedByCollab = {};
        (history || []).forEach(h => {
            if (!h.collaborator_id) return;
            completedByCollab[h.collaborator_id] = (completedByCollab[h.collaborator_id] || 0) + 1;
        });

        // 4. Build prompt
        const servicesText = (services || []).map(s => {
            const name = s.services?.name || s.legacy_service_name || 'Servizio';
            const desc = s.services?.description ? ` (${s.services.description.slice(0, 80)})` : '';
            const tags = Array.isArray(s.services?.tags) ? ` [tags: ${s.services.tags.join(', ')}]` : '';
            return `- ${name}${desc}${tags}`;
        }).join('\n') || '(nessun servizio specificato)';

        const collabsText = collabs.map(c => {
            const name = c.full_name || c.name || c.id;
            const tags = Array.isArray(c.tags) ? c.tags.join(', ') : (c.tags || '');
            const completed = completedByCollab[c.id] || 0;
            return `id:${c.id} | ${name} | ruolo: ${c.role || '-'} | tags: ${tags || '-'} | commesse completate: ${completed}`;
        }).join('\n');

        const prompt = `=== INCARICO ===
Commessa: ${order?.title || '(senza titolo)'} ${order?.order_number ? `(${order.order_number})` : ''}
Descrizione commessa: ${order?.description || '(non fornita)'}
Descrizione incarico: ${assignment.description || '(non fornita)'}
Scope: ${assignment.scope || '(non fornito)'}
Note: ${assignment.notes || '(nessuna)'}

Servizi assegnati:
${servicesText}

=== COLLABORATORI ATTIVI ===
${collabsText}

=== FINE ===
Suggerisci i TOP 3 collab più adatti. Usa SOLO collab dalla lista sopra.`;

        const result = await ai.completeJSON(prompt, {
            suggestions: [{ collab_id: 'uuid', collab_name: 'string', fit_score: 1, fit_level: 'perfect|good|maybe', reasoning: 'string' }],
            warning: 'string'
        }, {
            feature: 'assignment_collab_suggestion',
            system: SYSTEM_PROMPT,
            temperature: 0.1,
        });

        renderSuggestions(body, result, collabs, assignmentId, modal);

    } catch (err) {
        body.innerHTML = `
            <div style="padding:1rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.22);border-radius:10px;color:#dc2626;font-size:.9rem;">
                Errore: ${escapeHtml(err.message || String(err))}
            </div>
        `;
    }
};

function renderSuggestions(container, result, collabs, assignmentId, modal) {
    const collabsMap = Object.fromEntries(collabs.map(c => [c.id, c]));
    const suggestions = (result.suggestions || []).filter(s => collabsMap[s.collab_id]);

    if (suggestions.length === 0) {
        container.innerHTML = `
            <div style="padding:1.5rem;text-align:center;color:#6b7280;">
                L'AI non ha trovato collab adatti tra quelli attivi.<br>
                ${result.warning ? `<span style="font-size:.85rem;color:#d97706;">${escapeHtml(result.warning)}</span>` : ''}
            </div>
        `;
        return;
    }

    container.innerHTML = `
        ${result.warning ? `
            <div style="padding:.75rem;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.22);border-radius:8px;font-size:.82rem;color:#92400e;margin-bottom:1rem;">
                ⚠ ${escapeHtml(result.warning)}
            </div>
        ` : ''}
        <div style="font-size:.72rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin-bottom:.75rem;">
            Top ${suggestions.length} collaborator${suggestions.length === 1 ? 'e' : 'i'} suggerit${suggestions.length === 1 ? 'o' : 'i'}
        </div>
        <div style="display:flex;flex-direction:column;gap:.65rem;">
            ${suggestions.map(s => {
                const collab = collabsMap[s.collab_id];
                const fit = FIT_META[s.fit_level] || FIT_META.maybe;
                const name = collab.full_name || collab.name || 'Collab';
                return `
                    <div style="padding:1rem;border:1px solid #e5e7eb;border-radius:12px;background:#fff;display:flex;gap:1rem;align-items:flex-start;">
                        <div style="width:42px;height:42px;border-radius:50%;background:${fit.bg};color:${fit.color};display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;font-size:1.05rem;">
                            ${escapeHtml(name[0]?.toUpperCase() || '?')}
                        </div>
                        <div style="flex:1;min-width:0;">
                            <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.3rem;">
                                <span style="font-weight:600;color:#1f2937;">${escapeHtml(name)}</span>
                                <span style="font-size:.65rem;padding:2px 8px;border-radius:999px;background:${fit.bg};color:${fit.color};font-weight:700;text-transform:uppercase;letter-spacing:.04em;">${fit.label} · ${s.fit_score}/10</span>
                            </div>
                            ${collab.role ? `<div style="font-size:.72rem;color:#6b7280;margin-bottom:.35rem;">${escapeHtml(collab.role)}</div>` : ''}
                            <div style="font-size:.82rem;color:#374151;font-style:italic;">${escapeHtml(s.reasoning || '')}</div>
                        </div>
                        <button onclick="window.assignCollabToAssignment('${assignmentId}', '${s.collab_id}', this)"
                            style="padding:.5rem .9rem;border-radius:8px;border:none;background:#8b5cf6;color:#fff;cursor:pointer;font-size:.8rem;font-weight:500;flex-shrink:0;">
                            Assegna
                        </button>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

window.assignCollabToAssignment = async function (assignmentId, collabId, btn) {
    if (!confirm('Cambiare il collaboratore di questo incarico?')) return;
    btn.disabled = true;
    btn.textContent = 'Assegno…';
    const { error } = await supabase
        .from('assignments')
        .update({ collaborator_id: collabId })
        .eq('id', assignmentId);
    if (error) {
        alert('Errore: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Assegna';
        return;
    }
    document.querySelectorAll('.scs-close').forEach(b => b.click());
    if (window.location.hash.startsWith('#assignment-detail')) {
        location.reload();
    }
};
