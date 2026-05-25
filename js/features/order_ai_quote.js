// Tariffario Mina 5 — AI preventivo da descrizione
// Modal su order detail: descrivi a parole il lavoro, AI legge tariffario
// services e propone voci con quantità ragionate. Click "Aggiungi"
// inserisce in collaborator_services con collaborator_id=NULL (da assegnare poi).

import { supabase } from '/js/modules/config.js?v=8000';
import { ai } from '/js/modules/ai_client.js?v=8000';

const SYSTEM_PROMPT = `Sei un assistente di Gleeye, agenzia di comunicazione di Genova.
Hai a disposizione il TARIFFARIO completo dei servizi dell'agenzia (con nome, descrizione, prezzo, costo).
Data una descrizione testuale di quello che il cliente vuole, il tuo compito è proporre quali voci del tariffario includere nel preventivo e in che quantità.

REGOLE FERREE:
- USA SOLO i servizi presenti nel TARIFFARIO sotto. NON inventare servizi.
- Se la richiesta tocca un'area NON coperta dal tariffario, dillo esplicitamente in "warnings".
- Sii conservativo sulle quantità: meglio sotto-stimare e segnalare incertezza che gonfiare.
- Se la descrizione è troppo vaga, ammettilo e chiedi cosa serve precisare.

RISPONDI in JSON con questa struttura:
{
  "items": [
    {
      "service_id": "uuid esatto dal tariffario",
      "service_name": "nome esatto dal tariffario (per verifica)",
      "quantity": numero_intero_o_decimale,
      "reasoning": "perché hai scelto questa voce e questa quantità, max 1 frase"
    }
  ],
  "warnings": ["eventuali aree NON coperte dal tariffario", "eventuali ambiguità nella richiesta"],
  "summary": "1 frase di sintesi del preventivo proposto"
}`;

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function fmt(n) {
    return (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

window.openAIQuoteModal = async function (orderId) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:16px;max-width:720px;width:100%;max-height:92vh;display:flex;flex-direction:column;">
            <div style="padding:1.25rem 1.5rem;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;">
                <div>
                    <h3 style="margin:0;font-size:1.125rem;display:flex;align-items:center;gap:.5rem;">
                        <span style="color:#8b5cf6;">✨</span> Suggerimento AI servizi
                    </h3>
                    <div style="font-size:.75rem;color:#6b7280;margin-top:.15rem;">
                        Descrivi a parole il lavoro, l'AI sceglie le voci giuste dal tariffario.
                    </div>
                </div>
                <button class="aiq-close" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#6b7280;">×</button>
            </div>
            <div style="padding:1.25rem 1.5rem;overflow-y:auto;flex:1;">
                <div id="aiq-step-input">
                    <label style="display:block;font-size:.85rem;color:#374151;font-weight:500;margin-bottom:.4rem;">
                        Descrivi il lavoro
                    </label>
                    <textarea id="aiq-input" placeholder="Es: Una campagna social Instagram di 3 mesi, 12 post con copy e grafiche, più 6 reel, e gestione community manager 5h/settimana."
                        style="width:100%;min-height:140px;padding:.75rem;border:1px solid #e5e7eb;border-radius:8px;font-size:.9rem;line-height:1.5;resize:vertical;box-sizing:border-box;"></textarea>
                    <div style="font-size:.72rem;color:#9ca3af;margin-top:.4rem;">
                        Tip: includi <strong>quantità</strong> (mesi, h, pezzi), <strong>scadenze</strong>, <strong>vincoli</strong> del cliente.
                    </div>
                </div>
                <div id="aiq-step-loading" style="display:none;padding:2rem;text-align:center;color:#6b7280;">
                    <div style="font-size:.95rem;margin-bottom:.5rem;">
                        <span class="material-icons-round" style="vertical-align:middle;color:#8b5cf6;animation:spin 1s linear infinite;">refresh</span>
                        L'AI sta leggendo il tariffario e componendo il preventivo…
                    </div>
                    <div style="font-size:.72rem;color:#9ca3af;">Pochi secondi.</div>
                </div>
                <div id="aiq-step-result" style="display:none;"></div>
            </div>
            <div id="aiq-actions" style="padding:1rem 1.5rem;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:.5rem;">
                <button class="aiq-close" style="padding:.6rem 1.1rem;border-radius:8px;border:1px solid #e5e7eb;background:#fff;color:#374151;cursor:pointer;">Annulla</button>
                <button id="aiq-generate" style="padding:.6rem 1.25rem;border-radius:8px;border:none;background:#8b5cf6;color:#fff;cursor:pointer;font-weight:500;">
                    Genera preventivo AI
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll('.aiq-close').forEach(b => b.addEventListener('click', close));
    modal.addEventListener('click', ev => { if (ev.target === modal) close(); });
    setTimeout(() => modal.querySelector('#aiq-input').focus(), 50);

    modal.querySelector('#aiq-generate').addEventListener('click', async () => {
        const description = modal.querySelector('#aiq-input').value.trim();
        if (description.length < 10) {
            alert('Descrizione troppo corta. Aggiungi qualche dettaglio.');
            return;
        }
        await runAIQuote(modal, orderId, description);
    });
};

async function runAIQuote(modal, orderId, description) {
    modal.querySelector('#aiq-step-input').style.display = 'none';
    modal.querySelector('#aiq-step-loading').style.display = 'block';
    modal.querySelector('#aiq-step-result').style.display = 'none';
    modal.querySelector('#aiq-actions').style.display = 'none';

    try {
        // Fetch tariffario completo
        const { data: services, error } = await supabase
            .from('services')
            .select('id, name, description, price, cost, type, tags')
            .order('name');
        if (error) throw error;

        // Costruisci catalogo per AI (compatto)
        const catalog = services.map(s => {
            const desc = s.description ? ` — ${s.description.slice(0, 120)}` : '';
            const tags = Array.isArray(s.tags) ? ` [${s.tags.join(', ')}]` : '';
            return `id:${s.id} | ${s.name}${desc}${tags} | prezzo:${s.price || 0}€ costo:${s.cost || 0}€ tipo:${s.type || '-'}`;
        }).join('\n');

        const prompt = `=== TARIFFARIO ===\n${catalog}\n=== FINE TARIFFARIO ===\n\n=== RICHIESTA DEL CLIENTE ===\n${description}\n=== FINE RICHIESTA ===\n\nProponi le voci del tariffario da includere nel preventivo, con quantità e reasoning. Risposta in JSON come da schema.`;

        const result = await ai.completeJSON(prompt, {
            items: [{ service_id: 'uuid', service_name: 'string', quantity: 1, reasoning: 'string' }],
            warnings: ['string'],
            summary: 'string',
        }, {
            feature: 'order_ai_quote',
            system: SYSTEM_PROMPT,
            temperature: 0.1,
        });

        if (!result?.items?.length) {
            throw new Error('L\'AI non ha proposto voci utilizzabili.');
        }

        // Arricchisco con dati servizio per visualizzazione
        const servicesMap = Object.fromEntries(services.map(s => [s.id, s]));
        const enriched = result.items.map(item => {
            const svc = servicesMap[item.service_id];
            return {
                ...item,
                service: svc,
                unit_cost: svc?.cost || 0,
                unit_price: svc?.price || 0,
                selected: !!svc,
                valid: !!svc,
            };
        });

        renderResult(modal, orderId, enriched, result);

    } catch (err) {
        console.error('[ai-quote]', err);
        modal.querySelector('#aiq-step-loading').style.display = 'none';
        modal.querySelector('#aiq-step-result').style.display = 'block';
        modal.querySelector('#aiq-step-result').innerHTML = `
            <div style="padding:1rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.22);border-radius:10px;color:#dc2626;">
                Errore: ${escapeHtml(err.message || String(err))}
            </div>
        `;
        modal.querySelector('#aiq-actions').style.display = 'flex';
    }
}

function renderResult(modal, orderId, items, aiResult) {
    modal.querySelector('#aiq-step-loading').style.display = 'none';
    const result = modal.querySelector('#aiq-step-result');
    result.style.display = 'block';

    const totalCost = items.reduce((s, i) => s + (i.selected ? (i.unit_cost * i.quantity) : 0), 0);
    const totalPrice = items.reduce((s, i) => s + (i.selected ? (i.unit_price * i.quantity) : 0), 0);

    result.innerHTML = `
        ${aiResult.summary ? `<div style="margin-bottom:1rem;padding:.75rem 1rem;background:rgba(139,92,246,.08);border-radius:10px;font-size:.85rem;color:#374151;">${escapeHtml(aiResult.summary)}</div>` : ''}

        ${aiResult.warnings?.length ? `
            <div style="margin-bottom:1rem;padding:.75rem;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.22);border-radius:8px;">
                <div style="font-size:.72rem;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:.04em;margin-bottom:.4rem;">⚠ Avvertenze</div>
                <ul style="margin:0;padding-left:1.25rem;font-size:.8rem;color:#92400e;">
                    ${aiResult.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}
                </ul>
            </div>
        ` : ''}

        <div style="font-size:.72rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin-bottom:.5rem;">Voci proposte (modifica/deseleziona)</div>

        <div id="aiq-items" style="display:flex;flex-direction:column;gap:.5rem;">
            ${items.map((item, idx) => `
                <div class="aiq-item" data-idx="${idx}" style="padding:.75rem;border:1px solid #e5e7eb;border-radius:10px;background:${item.valid ? '#fff' : 'rgba(239,68,68,.05)'};">
                    <label style="display:flex;align-items:flex-start;gap:.6rem;cursor:pointer;">
                        <input type="checkbox" class="aiq-check" ${item.selected ? 'checked' : ''} ${!item.valid ? 'disabled' : ''} style="margin-top:.2rem;">
                        <div style="flex:1;">
                            <div style="font-weight:600;color:#1f2937;font-size:.9rem;">
                                ${item.valid
                                    ? escapeHtml(item.service.name)
                                    : `<span style="color:#dc2626;">${escapeHtml(item.service_name)} (id non valido)</span>`}
                            </div>
                            <div style="font-size:.75rem;color:#6b7280;margin-top:.2rem;font-style:italic;">${escapeHtml(item.reasoning || '')}</div>
                            ${item.valid ? `
                                <div style="display:flex;align-items:center;gap:.75rem;margin-top:.5rem;font-size:.78rem;color:#374151;">
                                    <label>Quantità:
                                        <input type="number" class="aiq-qty" value="${item.quantity}" min="0" step="0.5" style="width:60px;padding:.2rem .35rem;border:1px solid #e5e7eb;border-radius:6px;margin-left:.3rem;">
                                    </label>
                                    <span style="color:#9ca3af;">×</span>
                                    <span><strong>${fmt(item.unit_price)}€</strong> <span style="color:#9ca3af;">prezzo</span></span>
                                    <span style="color:#9ca3af;">·</span>
                                    <span style="color:#dc2626;">${fmt(item.unit_cost)}€ <span style="color:#9ca3af;">costo</span></span>
                                </div>
                            ` : ''}
                        </div>
                    </label>
                </div>
            `).join('')}
        </div>

        <div id="aiq-totals" style="margin-top:1rem;padding:.85rem 1rem;background:#f9fafb;border-radius:10px;display:flex;justify-content:space-between;align-items:baseline;">
            <span style="font-size:.78rem;color:#6b7280;">Totale selezionato</span>
            <span style="font-weight:700;color:#1f2937;">
                <span id="aiq-tot-price">${fmt(totalPrice)}€</span>
                <span style="color:#9ca3af;font-weight:400;margin-left:.5rem;">prezzo · </span>
                <span id="aiq-tot-cost" style="color:#dc2626;">${fmt(totalCost)}€</span>
                <span style="color:#9ca3af;font-weight:400;">costo</span>
            </span>
        </div>
    `;

    // Update totals on change
    const updateTotals = () => {
        let tc = 0, tp = 0;
        result.querySelectorAll('.aiq-item').forEach(itemEl => {
            const idx = parseInt(itemEl.dataset.idx, 10);
            const item = items[idx];
            if (!item.valid) return;
            const checked = itemEl.querySelector('.aiq-check').checked;
            const qty = parseFloat(itemEl.querySelector('.aiq-qty').value) || 0;
            items[idx].selected = checked;
            items[idx].quantity = qty;
            if (checked) {
                tc += qty * item.unit_cost;
                tp += qty * item.unit_price;
            }
        });
        result.querySelector('#aiq-tot-cost').textContent = `${fmt(tc)}€`;
        result.querySelector('#aiq-tot-price').textContent = `${fmt(tp)}€`;
    };
    result.querySelectorAll('.aiq-check, .aiq-qty').forEach(el => {
        el.addEventListener('change', updateTotals);
        el.addEventListener('input', updateTotals);
    });

    // Actions
    const actions = modal.querySelector('#aiq-actions');
    actions.style.display = 'flex';
    actions.innerHTML = `
        <button class="aiq-close" style="padding:.6rem 1.1rem;border-radius:8px;border:1px solid #e5e7eb;background:#fff;color:#374151;cursor:pointer;">Annulla</button>
        <button id="aiq-retry" style="padding:.6rem 1.1rem;border-radius:8px;border:1px solid #e5e7eb;background:#fff;color:#374151;cursor:pointer;">Riprova</button>
        <button id="aiq-apply" style="padding:.6rem 1.25rem;border-radius:8px;border:none;background:#10b981;color:#fff;cursor:pointer;font-weight:500;">
            Aggiungi al preventivo
        </button>
    `;
    actions.querySelectorAll('.aiq-close').forEach(b => b.addEventListener('click', () => modal.remove()));
    actions.querySelector('#aiq-retry').addEventListener('click', () => {
        modal.querySelector('#aiq-step-input').style.display = 'block';
        modal.querySelector('#aiq-step-result').style.display = 'none';
        actions.innerHTML = `
            <button class="aiq-close" style="padding:.6rem 1.1rem;border-radius:8px;border:1px solid #e5e7eb;background:#fff;color:#374151;cursor:pointer;">Annulla</button>
            <button id="aiq-generate" style="padding:.6rem 1.25rem;border-radius:8px;border:none;background:#8b5cf6;color:#fff;cursor:pointer;font-weight:500;">Genera preventivo AI</button>
        `;
        actions.querySelector('.aiq-close').addEventListener('click', () => modal.remove());
        actions.querySelector('#aiq-generate').addEventListener('click', async () => {
            const desc = modal.querySelector('#aiq-input').value.trim();
            if (desc.length < 10) { alert('Descrizione troppo corta.'); return; }
            await runAIQuote(modal, orderId, desc);
        });
    });
    actions.querySelector('#aiq-apply').addEventListener('click', async () => {
        const toInsert = items.filter(i => i.selected && i.valid && i.quantity > 0).map(i => ({
            order_id: orderId,
            service_id: i.service_id,
            collaborator_id: null,
            quantity: i.quantity,
            unit_cost: i.unit_cost,
            unit_price: i.unit_price,
            total_cost: i.unit_cost * i.quantity,
            total_price: i.unit_price * i.quantity,
            name: i.service?.name || i.service_name,
        }));
        if (toInsert.length === 0) {
            alert('Nessuna voce selezionata.');
            return;
        }
        const btn = actions.querySelector('#aiq-apply');
        btn.disabled = true;
        btn.textContent = 'Aggiungo…';
        const { error } = await supabase.from('collaborator_services').insert(toInsert);
        if (error) {
            alert('Errore inserimento: ' + error.message);
            btn.disabled = false;
            btn.textContent = 'Aggiungi al preventivo';
            return;
        }
        modal.remove();
        // Re-render ordine
        if (window.location.hash.startsWith('#order-detail')) {
            location.reload();
        }
    });
}
