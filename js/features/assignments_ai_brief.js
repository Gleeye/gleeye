// Mina E — Briefing AI per assignment (collab side)
// Card "Briefing AI" su assignment-detail: genera brief operativo
// personalizzato per il collab usando ordine + assignment + servizi + cliente.

import { supabase } from '/js/modules/config.js?v=8000';
import { ai, AI_MODELS } from '/js/modules/ai_client.js?v=8000';

const CACHE_TTL_HOURS = 24;

const SYSTEM_PROMPT = `Sei l'assistente operativo di un collaboratore freelance di Gleeye, agenzia di comunicazione di Genova.
Dato il contesto della commessa e dell'incarico, scrivi un BRIEFING operativo per il collaboratore.

LINEE GUIDA:
- Italiano semplice, diretto, max 250 parole.
- Inizia con 1 frase che riassume il senso dell'incarico ("Cosa stai facendo, perché conta").
- Poi 3-5 punti operativi concreti su cosa fare prima.
- Evidenzia eventuali insidie, vincoli o priorità del cliente che emergono dal contesto.
- Se mancano informazioni importanti, indica esplicitamente cosa chiedere all'account.
- Niente jargon, niente "Spero che questo aiuti".
- Usa **grassetto** per i punti chiave (saranno renderizzati).
- Sezioni separate con riga vuota.`;

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function renderMarkdown(md) {
    if (!md) return '';
    const escaped = escapeHtml(md);
    return escaped
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n+/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/^/, '<p>')
        .replace(/$/, '</p>');
}

function isFresh(iso) {
    if (!iso) return false;
    const ageHours = (Date.now() - new Date(iso).getTime()) / 1000 / 3600;
    return ageHours < CACHE_TTL_HOURS;
}

function formatRelative(iso) {
    if (!iso) return '';
    const ageMs = Date.now() - new Date(iso).getTime();
    const ageHours = ageMs / 1000 / 3600;
    if (ageHours < 1) return `${Math.round(ageMs / 60000)} min fa`;
    if (ageHours < 24) return `${Math.round(ageHours)} h fa`;
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

function buildPromptContext({ assignment, order, client, services, collab }) {
    const lines = [];
    if (client?.business_name) lines.push(`CLIENTE: ${client.business_name}`);
    if (order?.title) lines.push(`COMMESSA: ${order.title}`);
    if (order?.order_number) lines.push(`Riferimento: ${order.order_number}`);
    if (order?.description) lines.push(`Descrizione commessa: ${order.description}`);
    if (assignment.start_date) lines.push(`Inizio incarico: ${assignment.start_date}`);
    if (assignment.deadline) lines.push(`Scadenza incarico: ${assignment.deadline}`);
    if (assignment.notes) lines.push(`Note specifiche: ${assignment.notes}`);
    if (collab?.role || collab?.tags) {
        const role = collab.role || (Array.isArray(collab.tags) ? collab.tags.join(', ') : collab.tags);
        if (role) lines.push(`Ruolo del collaboratore: ${role}`);
    }
    if (services?.length) {
        lines.push(`SERVIZI ASSEGNATI:`);
        services.forEach(s => {
            const name = s.services?.name || s.legacy_service_name || s.name || 'Servizio';
            const qty = s.quantity || s.hours || 1;
            const unit = s.unit || 'unità';
            lines.push(`- ${name} (${qty} ${unit})`);
        });
    }
    return lines.join('\n');
}

export function buildBriefCardHtml(assignment) {
    const hasBrief = !!assignment.ai_brief;
    const fresh = isFresh(assignment.ai_brief_at);
    return `
        <div class="glass-card" id="ai-brief-card-${assignment.id}" style="padding: 1.25rem; margin-top: 1rem; background: linear-gradient(135deg, rgba(139, 92, 246, 0.06), rgba(139, 92, 246, 0.01)); border: 1px solid rgba(139, 92, 246, 0.18);">
            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.85rem;">
                <div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; background: rgba(139, 92, 246, 0.15);">
                    <span class="material-icons-round" style="font-size: 1.1rem; color: #8b5cf6;">auto_awesome</span>
                </div>
                <span style="font-weight: 700; font-size: 1rem; color: var(--text-primary); font-family: var(--font-titles);">Briefing AI</span>
                ${hasBrief && fresh ? `<span style="margin-left:auto;font-size:.65rem;color:var(--text-tertiary);">aggiornato ${formatRelative(assignment.ai_brief_at)}</span>` : ''}
            </div>
            <div id="ai-brief-body-${assignment.id}">
                ${hasBrief ? `
                    <div style="font-size:.88rem;color:var(--text-primary);line-height:1.55;">
                        ${renderMarkdown(assignment.ai_brief)}
                    </div>
                    <div style="text-align:right;margin-top:.75rem;">
                        <button onclick="window.generateAssignmentBrief('${assignment.id}', true)"
                            style="background:none;border:none;color:#8b5cf6;font-size:.78rem;cursor:pointer;font-weight:500;">
                            ${fresh ? 'Rigenera' : 'Aggiorna (cache scaduta)'}
                        </button>
                    </div>
                ` : `
                    <div style="font-size:.85rem;color:var(--text-secondary);margin-bottom:.85rem;">
                        Genera un briefing operativo personalizzato basato su ordine, servizi assegnati e cliente.
                    </div>
                    <button onclick="window.generateAssignmentBrief('${assignment.id}', false)" class="primary-btn"
                        style="width:100%;justify-content:center;gap:.5rem;background:#8b5cf6;color:#fff;border:none;padding:.7rem;border-radius:10px;font-weight:600;cursor:pointer;">
                        <span class="material-icons-round">auto_awesome</span> Genera briefing AI
                    </button>
                `}
            </div>
        </div>
    `;
}

window.generateAssignmentBrief = async function (assignmentId, isRegen) {
    const body = document.getElementById(`ai-brief-body-${assignmentId}`);
    if (!body) return;

    body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;gap:.6rem;padding:1.5rem;color:var(--text-secondary);font-size:.85rem;">
            <span class="material-icons-round" style="animation: spin 1s linear infinite;color:#8b5cf6;">refresh</span>
            <span>L'AI sta scrivendo il briefing…</span>
        </div>
    `;

    try {
        const { data: assignment, error: aErr } = await supabase
            .from('assignments')
            .select('*, collaborators(id, full_name, name, role, tags)')
            .eq('id', assignmentId)
            .single();
        if (aErr || !assignment) throw new Error('Assignment non trovato');

        const { data: order } = await supabase
            .from('orders')
            .select('id, title, order_number, description, client_id')
            .eq('id', assignment.order_id)
            .single();

        const { data: client } = order?.client_id
            ? await supabase.from('clients').select('id, business_name').eq('id', order.client_id).single()
            : { data: null };

        const { data: services } = await supabase
            .from('assignment_services')
            .select('quantity, hours, unit_cost, total_cost, legacy_service_name, services(name)')
            .eq('assignment_id', assignmentId);

        const context = buildPromptContext({
            assignment,
            order,
            client,
            services: services || [],
            collab: assignment.collaborators,
        });

        const briefText = await ai.complete(context, {
            feature: 'assignment_briefing',
            system: SYSTEM_PROMPT,
            temperature: 0.4,
        });

        if (!briefText || briefText.trim().length < 20) {
            throw new Error('AI ha restituito una risposta vuota.');
        }

        const { error: upErr } = await supabase
            .from('assignments')
            .update({
                ai_brief: briefText.trim(),
                ai_brief_at: new Date().toISOString(),
                ai_brief_model: AI_MODELS?.default || null,
            })
            .eq('id', assignmentId);

        if (upErr) console.warn('[ai-brief] save warning', upErr);

        // Rebuild card with fresh data
        const card = document.getElementById(`ai-brief-card-${assignmentId}`);
        if (card) {
            card.outerHTML = buildBriefCardHtml({
                id: assignmentId,
                ai_brief: briefText.trim(),
                ai_brief_at: new Date().toISOString(),
            });
        }
    } catch (err) {
        body.innerHTML = `
            <div style="padding:1rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.22);border-radius:10px;color:#dc2626;font-size:.85rem;">
                Errore generazione: ${escapeHtml(err.message || String(err))}
            </div>
            <div style="text-align:right;margin-top:.5rem;">
                <button onclick="window.generateAssignmentBrief('${assignmentId}', ${isRegen})"
                    style="background:none;border:none;color:#8b5cf6;font-size:.78rem;cursor:pointer;font-weight:500;">Riprova</button>
            </div>
        `;
    }
};
