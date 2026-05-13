// SAP → Ordine 1-click — SAP-4
// Apre un modal che pre-popola un nuovo ordine dal SAP scelto.
// Dopo la creazione, clona i pm_items del SAP template nella commessa.

import { supabase } from '../../modules/config.js?v=8000';
import { state } from '../../modules/state.js?v=8000';
import { upsertOrder, fetchClients } from '../../modules/api.js?v=8000';

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function openOrderFromSap(serviceId) {
    const service = state.sapServices?.find(s => s.id === serviceId);
    if (!service) { await window.showAlert('Servizio SAP non trovato.', 'error'); return; }

    if (state.clients?.length === 0) await fetchClients();

    const existing = document.getElementById('order-from-sap-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'order-from-sap-modal';
    modal.className = 'modal';
    modal.innerHTML = _buildModalHTML(service);
    document.body.appendChild(modal);
    modal.classList.add('active');
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    _bindSubmit(service, modal);
}

// ─── Clone PM items (SAP-7) ───────────────────────────────────────────────────

export async function cloneSapPmTemplate(sapServiceId, targetSpaceId, variantName = null) {
    // 1. Trova il pm_space del SAP template
    const query = supabase
        .from('pm_spaces')
        .select('id')
        .eq('ref_sap_service', sapServiceId)
        .is('ref_ordine', null);

    if (variantName) {
        query.eq('variant_name', variantName);
    } else {
        query.is('variant_name', null);
    }

    const { data: spaces } = await query.limit(1);
    const sourceSpaceId = spaces?.[0]?.id;
    if (!sourceSpaceId) return { cloned: 0 };

    // 2. Leggi tutti i pm_items del template (non ricorsivi, struttura flat con parent_ref)
    const { data: items } = await supabase
        .from('pm_items')
        .select('*')
        .eq('space_ref', sourceSpaceId)
        .order('position');

    if (!items || items.length === 0) return { cloned: 0 };

    // 3. Mappa old_id → new_id per preservare gerarchia parent_ref
    const idMap = {};
    const toInsert = items.map(item => {
        const newId = crypto.randomUUID();
        idMap[item.id] = newId;
        return {
            id: newId,
            space_ref: targetSpaceId,
            title: item.title,
            notes: item.notes,
            item_type: item.item_type,
            status: 'todo',
            priority: item.priority,
            impact: item.impact,
            position: item.position,
            // parent_ref risolto dopo
        };
    });

    // Risolvi parent_ref con i nuovi ID
    items.forEach((item, i) => {
        if (item.parent_ref && idMap[item.parent_ref]) {
            toInsert[i].parent_ref = idMap[item.parent_ref];
        }
    });

    const { error } = await supabase.from('pm_items').insert(toInsert);
    if (error) {
        console.error('[cloneSapPmTemplate] errore insert:', error);
        return { cloned: 0, error: error.message };
    }

    return { cloned: toInsert.length };
}

// ─── Modal HTML ───────────────────────────────────────────────────────────────

function _buildModalHTML(service) {
    const tiers = (service.pricing_tiers || []);
    const variants = service.variations || [];
    const clients = state.clients || [];

    const clientOptions = clients
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .map(c => `<option value="${c.id}">${c.name}</option>`)
        .join('');

    const tierOptions = tiers.length > 0
        ? tiers.map((t, i) => {
            const name  = typeof t === 'string' ? t : (t.name || `Tier ${i+1}`);
            const price = typeof t === 'string' ? '' : (t.price ? ` — ${t.price}€` : '');
            return `<option value="${i}">${name}${price}</option>`;
          }).join('')
        : '<option value="">Nessun tier configurato</option>';

    const variantOptions = variants.length > 0
        ? `<option value="">Base</option>` + variants.map(v => `<option value="${v.id}">${v.name}</option>`).join('')
        : '<option value="">Base</option>';

    return `
        <div class="modal-content" style="max-width:520px; width:95vw; padding:0; border-radius:20px; overflow:hidden; background:var(--card-bg); border:1px solid var(--glass-border); box-shadow:var(--shadow-xl);">

            <div style="padding:1.25rem 1.75rem; background:var(--brand-gradient); color:white; display:flex; align-items:center; gap:0.75rem;">
                <span class="material-icons-round" style="font-size:1.4rem;">add_shopping_cart</span>
                <div>
                    <div style="font-weight:800; font-size:1.05rem; font-family:var(--font-titles);">Crea ordine da SAP</div>
                    <div style="font-size:0.8rem; opacity:0.85;">${service.name}</div>
                </div>
            </div>

            <div style="padding:1.5rem 1.75rem; display:flex; flex-direction:column; gap:1.1rem;">

                <div>
                    <label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary); display:block; margin-bottom:0.35rem;">Titolo commessa</label>
                    <input id="ofsap-title" type="text" value="${service.name}"
                        style="width:100%; padding:0.65rem 0.85rem; border-radius:10px; border:1px solid var(--glass-border); background:var(--bg-color); color:var(--text-primary); font-size:0.9rem; box-sizing:border-box;">
                </div>

                <div>
                    <label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary); display:block; margin-bottom:0.35rem;">Cliente *</label>
                    <select id="ofsap-client" style="width:100%; padding:0.65rem 0.85rem; border-radius:10px; border:1px solid var(--glass-border); background:var(--bg-color); color:var(--text-primary); font-size:0.9rem; box-sizing:border-box;">
                        <option value="">Seleziona cliente…</option>
                        ${clientOptions}
                    </select>
                </div>

                ${tiers.length > 0 ? `
                <div>
                    <label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary); display:block; margin-bottom:0.35rem;">Tier / Taglia</label>
                    <select id="ofsap-tier" style="width:100%; padding:0.65rem 0.85rem; border-radius:10px; border:1px solid var(--glass-border); background:var(--bg-color); color:var(--text-primary); font-size:0.9rem; box-sizing:border-box;">
                        ${tierOptions}
                    </select>
                </div>
                ` : ''}

                ${variants.length > 0 ? `
                <div>
                    <label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary); display:block; margin-bottom:0.35rem;">Variante</label>
                    <select id="ofsap-variant" style="width:100%; padding:0.65rem 0.85rem; border-radius:10px; border:1px solid var(--glass-border); background:var(--bg-color); color:var(--text-primary); font-size:0.9rem; box-sizing:border-box;">
                        ${variantOptions}
                    </select>
                </div>
                ` : ''}

                <div>
                    <label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary); display:block; margin-bottom:0.35rem;">Data offerta</label>
                    <input id="ofsap-date" type="date" value="${new Date().toISOString().split('T')[0]}"
                        style="width:100%; padding:0.65rem 0.85rem; border-radius:10px; border:1px solid var(--glass-border); background:var(--bg-color); color:var(--text-primary); font-size:0.9rem; box-sizing:border-box;">
                </div>

                <div style="display:flex; align-items:center; gap:0.6rem; padding:0.75rem 1rem; background:rgba(99,102,241,0.06); border-radius:10px; border:1px solid rgba(99,102,241,0.15);">
                    <input type="checkbox" id="ofsap-clone-pm" checked style="width:16px; height:16px; cursor:pointer; accent-color:var(--brand-blue);">
                    <label for="ofsap-clone-pm" style="font-size:0.85rem; color:var(--text-secondary); cursor:pointer; font-weight:600;">
                        Copia automaticamente il template PM dal SAP nella commessa
                    </label>
                </div>

            </div>

            <div style="padding:1rem 1.75rem 1.5rem 1.75rem; display:flex; gap:0.75rem; justify-content:flex-end; border-top:1px solid var(--glass-border);">
                <button onclick="document.getElementById('order-from-sap-modal').remove()" style="padding:0.6rem 1.25rem; border-radius:10px; border:1px solid var(--glass-border); background:white; color:var(--text-primary); font-weight:700; font-size:0.875rem; cursor:pointer;">Annulla</button>
                <button id="ofsap-submit" style="display:flex; align-items:center; gap:0.5rem; padding:0.6rem 1.5rem; border-radius:10px; border:none; background:var(--brand-gradient); color:white; font-weight:700; font-size:0.875rem; cursor:pointer; box-shadow:0 4px 12px rgba(99,102,241,0.3);">
                    <span class="material-icons-round" style="font-size:1rem;">add_shopping_cart</span> Crea ordine
                </button>
            </div>
        </div>
    `;
}

// ─── Submit logic ─────────────────────────────────────────────────────────────

function _bindSubmit(service, modal) {
    document.getElementById('ofsap-submit').addEventListener('click', async () => {
        const title    = document.getElementById('ofsap-title')?.value?.trim();
        const clientId = document.getElementById('ofsap-client')?.value;
        const dateVal  = document.getElementById('ofsap-date')?.value;
        const tierIdx  = document.getElementById('ofsap-tier') ? parseInt(document.getElementById('ofsap-tier').value) : null;
        const variant  = document.getElementById('ofsap-variant')?.value || null;
        const clonePm  = document.getElementById('ofsap-clone-pm')?.checked ?? true;

        if (!title)    { await window.showAlert('Inserisci il titolo.', 'warning'); return; }
        if (!clientId) { await window.showAlert('Seleziona un cliente.', 'warning'); return; }

        const btn = document.getElementById('ofsap-submit');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-icons-round" style="font-size:1rem; animation:spin 1s linear infinite;">autorenew</span> Creando…';

        try {
            // Calcola prezzo dal tier selezionato
            let pricePlanned = null;
            if (tierIdx !== null && !isNaN(tierIdx)) {
                const tier = (service.pricing_tiers || [])[tierIdx];
                if (tier && typeof tier === 'object' && tier.price) pricePlanned = Number(tier.price);
            }

            const order = await upsertOrder({
                title,
                client_id: clientId,
                sap_service_id: service.id,
                order_date: dateVal || new Date().toISOString().split('T')[0],
                offer_status: 'in_lavorazione',
                price_planned: pricePlanned,
            });

            if (!order?.id) throw new Error('Ordine non creato');

            modal.remove();

            // Clone PM template se richiesto (SAP-7)
            if (clonePm) {
                // Ottieni o crea lo spazio PM dell'ordine
                const { fetchProjectSpaceForOrder } = await import('../../modules/pm_api.js?v=8000');
                const space = await fetchProjectSpaceForOrder(order.id);
                if (space?.id) {
                    const { cloned } = await cloneSapPmTemplate(service.id, space.id, variant || null);
                    if (cloned > 0) {
                        await window.showAlert(`Ordine creato! Template PM copiato (${cloned} attività).`, 'success');
                    } else {
                        await window.showAlert('Ordine creato! (Nessun template PM trovato nel SAP — aggiungilo dalla vista dettaglio SAP)', 'success');
                    }
                } else {
                    await window.showAlert('Ordine creato.', 'success');
                }
            } else {
                await window.showAlert('Ordine creato con successo.', 'success');
            }

            // Naviga all'ordine
            window.location.hash = `#order-detail/${order.id}`;

        } catch (err) {
            console.error('[order_from_sap]', err);
            await window.showAlert('Errore: ' + err.message, 'error');
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-round" style="font-size:1rem;">add_shopping_cart</span> Crea ordine';
        }
    });
}
