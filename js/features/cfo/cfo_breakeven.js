import { formatAmount } from '/js/modules/utils.js?v=8000';
import { supabase } from '/js/modules/config.js?v=8000';

let currentRenderId = 0;
let servicesCache = null;

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function loadServices() {
    if (servicesCache) return servicesCache;
    const { data } = await supabase
        .from('core_services')
        .select('id, name, description')
        .order('name');
    servicesCache = data || [];
    return servicesCache;
}

async function loadConfig(serviceId) {
    const { data } = await supabase
        .from('cfo_distinta_config')
        .select('*')
        .eq('service_id', serviceId)
        .maybeSingle();
    return data;
}

async function loadCostItems(serviceId) {
    const { data } = await supabase
        .from('cfo_cost_items')
        .select('*')
        .eq('service_id', serviceId)
        .order('cost_type');
    return data || [];
}

async function saveConfig(serviceId, sellingPrice, allocationPct) {
    const payload = {
        service_id: serviceId,
        selling_price: parseFloat(sellingPrice) || 0,
        updated_at: new Date().toISOString(),
    };
    if (allocationPct !== undefined) {
        payload.fixed_cost_allocation_pct = allocationPct !== null && allocationPct !== ''
            ? parseFloat(allocationPct) || null
            : null;
    }
    await supabase.from('cfo_distinta_config').upsert(payload, { onConflict: 'service_id' });
}

// ─── Global fixed costs ───────────────────────────────────────────────────────

async function loadGlobalFixedCosts() {
    const { data } = await supabase
        .from('cfo_global_fixed_costs')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('name');
    return data || [];
}

async function saveGlobalCost(cost) {
    if (cost.id) {
        await supabase.from('cfo_global_fixed_costs')
            .update({ name: cost.name, amount: cost.amount, frequency: cost.frequency, category: cost.category })
            .eq('id', cost.id);
    } else {
        await supabase.from('cfo_global_fixed_costs')
            .insert({ name: cost.name, amount: cost.amount, frequency: cost.frequency, category: cost.category, year: new Date().getFullYear() });
    }
}

async function deleteGlobalCost(id) {
    await supabase.from('cfo_global_fixed_costs').update({ is_active: false }).eq('id', id);
}

// Converte tutti i costi fissi globali in valore annuale
function calcAnnualTotal(costs) {
    const multipliers = { monthly: 12, quarterly: 4, biannual: 2, annual: 1, once: 1 };
    return costs.reduce((sum, c) => sum + (parseFloat(c.amount) || 0) * (multipliers[c.frequency] || 1), 0);
}

async function addCostItem(serviceId, name, costType, amount, unit) {
    const { data, error } = await supabase
        .from('cfo_cost_items')
        .insert({ service_id: serviceId, name, cost_type: costType, amount: parseFloat(amount) || 0, unit: unit || null })
        .select()
        .single();
    return { data, error };
}

async function deleteCostItem(id) {
    await supabase.from('cfo_cost_items').delete().eq('id', id);
}

// ─── break-even calc ─────────────────────────────────────────────────────────

function computeBreakeven(sellingPrice, items) {
    const fixed = items.filter(i => i.cost_type === 'fixed').reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const variable = items.filter(i => i.cost_type === 'variable').reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const price = parseFloat(sellingPrice) || 0;
    const contribution = price - variable;
    const breakEvenUnits = contribution > 0 ? Math.ceil(fixed / contribution) : null;
    const marginPct = price > 0 ? ((contribution / price) * 100) : null;
    return { fixed, variable, contribution, breakEvenUnits, marginPct };
}

// Formula PEF (consulente CdC): BE ricavi = costi_fissi_globali × alloc% / MdC%
// Risponde a: "quanti ricavi da questo servizio coprono la sua quota di struttura aziendale?"
function computeBevenPEF(sellingPrice, items, globalFixedTotal, allocationPct) {
    const variable = items.filter(i => i.cost_type === 'variable').reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const price = parseFloat(sellingPrice) || 0;
    const contribution = price - variable;
    const mdcPct = price > 0 ? contribution / price : null;
    const alloc = parseFloat(allocationPct) / 100;
    if (!mdcPct || mdcPct <= 0 || !alloc || !globalFixedTotal) return null;
    return Math.ceil(globalFixedTotal * alloc / mdcPct);
}

function trafficLight(marginPct) {
    if (marginPct === null || marginPct < 0) return { color: '#dc2626', label: 'In perdita', icon: 'cancel' };
    if (marginPct < 20) return { color: '#f97316', label: 'Margine basso', icon: 'warning' };
    if (marginPct < 40) return { color: '#ca8a04', label: 'Margine accettabile', icon: 'info' };
    return { color: '#16a34a', label: 'Margine sano', icon: 'check_circle' };
}

// ─── global fixed costs panel ────────────────────────────────────────────────

const FREQ_LABELS = { monthly: 'Mensile', quarterly: 'Trimestrale', biannual: 'Semestrale', annual: 'Annuale', once: 'Una tantum' };
const FREQ_OPTIONS = Object.entries(FREQ_LABELS).map(([v, l]) => '<option value="' + v + '">' + l + '</option>').join('');

function buildGlobalCostRow(c) {
    const multipliers = { monthly: 12, quarterly: 4, biannual: 2, annual: 1, once: 1 };
    const annual = (parseFloat(c.amount) || 0) * (multipliers[c.frequency] || 1);
    return '<div class="gfc-row" data-id="' + c.id + '" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:8px;align-items:center;padding:0.4rem 0;border-bottom:1px solid var(--glass-border);">' +
        '<span style="font-size:0.875rem;">' + c.name + '</span>' +
        '<span style="font-size:0.8rem;color:var(--text-secondary);">' + formatAmount(parseFloat(c.amount) || 0) + ' €</span>' +
        '<span style="font-size:0.8rem;color:var(--text-secondary);">' + (FREQ_LABELS[c.frequency] || c.frequency) + '</span>' +
        '<span style="font-size:0.8rem;font-weight:600;color:var(--brand-blue);">' + formatAmount(annual) + ' €/anno</span>' +
        '<button class="del-gfc" data-id="' + c.id + '" style="background:none;border:none;cursor:pointer;color:var(--text-secondary);padding:2px 4px;">' +
        '<span class="material-icons-round" style="font-size:1rem;">delete_outline</span></button>' +
        '</div>';
}

async function renderGlobalCostsPanel(panelEl) {
    const costs = await loadGlobalFixedCosts();
    const total = calcAnnualTotal(costs);

    let rows = costs.length
        ? costs.map(buildGlobalCostRow).join('')
        : '<div style="font-size:0.875rem;color:var(--text-secondary);padding:0.5rem 0;">Nessun costo inserito. Aggiungi le voci dalla lista del PEF.</div>';

    panelEl.innerHTML =
        '<div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;padding:1.25rem;margin-bottom:1.5rem;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.875rem;">' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
        '<span class="material-icons-round" style="color:var(--brand-blue);font-size:1.1rem;">account_balance</span>' +
        '<span style="font-size:0.875rem;font-weight:600;">Costi Fissi Aziendali Globali</span>' +
        '</div>' +
        '<span style="font-size:1rem;font-weight:700;color:#dc2626;">' + formatAmount(total) + ' €/anno</span>' +
        '</div>' +
        '<div id="gfc-list">' + rows + '</div>' +
        '<details style="margin-top:0.875rem;">' +
        '<summary style="font-size:0.8rem;color:var(--brand-blue);cursor:pointer;font-weight:500;">+ Aggiungi voce</summary>' +
        '<div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;align-items:end;margin-top:0.75rem;">' +
        '<div><label style="font-size:0.75rem;color:var(--text-secondary);">Nome</label>' +
        '<input id="gfc-name" placeholder="es. Commercialista" style="width:100%;padding:0.4rem 0.6rem;border:1px solid var(--glass-border);border-radius:6px;background:var(--card-bg);color:var(--text-primary);font-size:0.85rem;box-sizing:border-box;"></div>' +
        '<div><label style="font-size:0.75rem;color:var(--text-secondary);">Importo €</label>' +
        '<input id="gfc-amount" type="number" min="0" step="0.01" placeholder="0" style="width:100%;padding:0.4rem 0.6rem;border:1px solid var(--glass-border);border-radius:6px;background:var(--card-bg);color:var(--text-primary);font-size:0.85rem;box-sizing:border-box;"></div>' +
        '<div><label style="font-size:0.75rem;color:var(--text-secondary);">Frequenza</label>' +
        '<select id="gfc-freq" style="width:100%;padding:0.4rem 0.6rem;border:1px solid var(--glass-border);border-radius:6px;background:var(--card-bg);color:var(--text-primary);font-size:0.85rem;">' +
        FREQ_OPTIONS + '</select></div>' +
        '<button id="gfc-add-btn" style="background:var(--brand-blue);color:#fff;border:none;border-radius:6px;padding:0.45rem 0.75rem;font-size:0.85rem;cursor:pointer;white-space:nowrap;">Aggiungi</button>' +
        '</div></details>' +
        '</div>';

    panelEl.querySelector('#gfc-add-btn').addEventListener('click', async () => {
        const name = panelEl.querySelector('#gfc-name').value.trim();
        const amount = parseFloat(panelEl.querySelector('#gfc-amount').value) || 0;
        const frequency = panelEl.querySelector('#gfc-freq').value;
        if (!name) return;
        await saveGlobalCost({ name, amount, frequency, category: 'altro' });
        await renderGlobalCostsPanel(panelEl);
    });

    panelEl.querySelectorAll('.del-gfc').forEach(btn => {
        btn.addEventListener('click', async () => {
            await deleteGlobalCost(btn.dataset.id);
            await renderGlobalCostsPanel(panelEl);
        });
    });
}

// ─── service drawer ───────────────────────────────────────────────────────────

async function openServiceDrawer(service, drawerEl, globalFixedTotal) {
    drawerEl.innerHTML = '<div style="padding:1rem;color:var(--text-secondary);font-size:0.875rem;">Caricamento...</div>';

    const [config, items] = await Promise.all([loadConfig(service.id), loadCostItems(service.id)]);
    const sellingPrice = config ? config.selling_price : 0;
    const allocationPct = config ? config.fixed_cost_allocation_pct : null;

    function renderDrawerContent(currentItems, currentPrice, currentAllocPct) {
        const beCalc = computeBreakeven(currentPrice, currentItems);
        const tlCalc = trafficLight(beCalc.marginPct);
        const bePEF = (globalFixedTotal && currentAllocPct)
            ? computeBevenPEF(currentPrice, currentItems, globalFixedTotal, currentAllocPct)
            : null;

        const itemRows = currentItems.map(item => {
            const typeLabel = item.cost_type === 'fixed' ? 'Fisso' : 'Variabile';
            const typeBg = item.cost_type === 'fixed' ? 'rgba(59,130,246,0.08)' : 'rgba(139,92,246,0.08)';
            const typeColor = item.cost_type === 'fixed' ? '#3b82f6' : '#8b5cf6';
            return '<div style="display:flex;align-items:center;gap:8px;padding:0.5rem 0;border-bottom:1px solid var(--glass-border);">' +
                '<span style="flex:1;font-size:0.875rem;">' + item.name + (item.unit ? ' <span style="color:var(--text-secondary);font-size:0.78rem;">/ ' + item.unit + '</span>' : '') + '</span>' +
                '<span style="background:' + typeBg + ';color:' + typeColor + ';font-size:0.75rem;padding:2px 8px;border-radius:20px;">' + typeLabel + '</span>' +
                '<span style="font-size:0.875rem;font-weight:600;min-width:70px;text-align:right;">' + formatAmount(item.amount) + ' €</span>' +
                '<button class="del-item" data-id="' + item.id + '" style="background:none;border:none;cursor:pointer;color:var(--text-secondary);padding:2px 4px;" title="Rimuovi">' +
                '<span class="material-icons-round" style="font-size:1rem;">delete_outline</span></button>' +
                '</div>';
        }).join('');

        const beHtml = beCalc.breakEvenUnits !== null
            ? '<div style="font-size:0.875rem;">Break-even: <strong>' + beCalc.breakEvenUnits + ' unità</strong>' +
              ' (copertura costi fissi ' + formatAmount(beCalc.fixed) + ' €)</div>'
            : '<div style="font-size:0.875rem;color:#dc2626;">Margine contribuzione negativo — impossibile coprire i fissi a questo prezzo.</div>';

        drawerEl.innerHTML =
            '<div style="padding:1.25rem;">' +

            // Header
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;">' +
            '<h3 style="margin:0;font-size:1rem;font-weight:600;">' + service.name + '</h3>' +
            '<button id="drawer-close" style="background:none;border:none;cursor:pointer;color:var(--text-secondary);">' +
            '<span class="material-icons-round">close</span></button>' +
            '</div>' +

            // Prezzo vendita + allocazione %
            '<div style="margin-bottom:1.25rem;">' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">' +
            '<div><label style="font-size:0.8rem;color:var(--text-secondary);font-weight:600;display:block;margin-bottom:4px;">Prezzo di vendita (€)</label>' +
            '<input id="selling-price-input" type="number" value="' + (currentPrice || '') + '" min="0" step="0.01" placeholder="es. 1500" ' +
            'style="width:100%;padding:0.5rem 0.75rem;border:1px solid var(--glass-border);border-radius:8px;background:var(--card-bg);color:var(--text-primary);font-size:0.875rem;box-sizing:border-box;"></div>' +
            '<div><label style="font-size:0.8rem;color:var(--text-secondary);font-weight:600;display:block;margin-bottom:4px;">% costi fissi aziendali</label>' +
            '<input id="alloc-pct-input" type="number" value="' + (currentAllocPct != null ? currentAllocPct : '') + '" min="0" max="100" step="0.1" placeholder="es. 15" ' +
            'style="width:100%;padding:0.5rem 0.75rem;border:1px solid var(--glass-border);border-radius:8px;background:var(--card-bg);color:var(--text-primary);font-size:0.875rem;box-sizing:border-box;">' +
            '<div style="font-size:0.72rem;color:var(--text-secondary);margin-top:2px;">Quota % struttura aziendale allocata a questo SAP</div></div>' +
            '</div>' +
            '<button id="save-price-btn" style="background:var(--brand-blue);color:#fff;border:none;border-radius:8px;padding:0.5rem 1rem;font-size:0.875rem;cursor:pointer;width:100%;">Salva configurazione</button>' +
            '</div>' +

            // Break-even summary (distinta base classica)
            '<div style="background:rgba(' + (tlCalc.color === '#16a34a' ? '22,163,74' : tlCalc.color === '#f97316' ? '249,115,22' : tlCalc.color === '#ca8a04' ? '202,138,4' : '220,38,38') + ',0.08);border:1px solid rgba(' + (tlCalc.color === '#16a34a' ? '22,163,74' : tlCalc.color === '#f97316' ? '249,115,22' : tlCalc.color === '#ca8a04' ? '202,138,4' : '220,38,38') + ',0.25);border-radius:10px;padding:0.875rem;margin-bottom:' + (bePEF ? '0.75rem' : '1.25rem') + ';">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
            '<span class="material-icons-round" style="color:' + tlCalc.color + ';font-size:1.1rem;">' + tlCalc.icon + '</span>' +
            '<span style="font-weight:600;color:' + tlCalc.color + ';">' + tlCalc.label + '</span>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;font-size:0.8rem;color:var(--text-secondary);">' +
            '<div>Costi fissi: <strong>' + formatAmount(beCalc.fixed) + ' €</strong></div>' +
            '<div>Costi variabili: <strong>' + formatAmount(beCalc.variable) + ' €</strong></div>' +
            '<div>Margine contrib.: <strong style="color:' + tlCalc.color + ';">' + (beCalc.marginPct !== null ? beCalc.marginPct.toFixed(1) + '%' : '—') + '</strong></div>' +
            '</div>' +
            beHtml +
            '</div>' +

            // Break-even PEF (formula CdC) — solo se allocazione % configurata
            (bePEF ? '<div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:0.75rem;margin-bottom:1.25rem;">' +
            '<div style="font-size:0.75rem;color:var(--brand-blue);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Break-even aziendale (formula PEF)</div>' +
            '<div style="font-size:0.875rem;">Ricavi minimi per coprire il ' + currentAllocPct + '% dei costi fissi aziendali: ' +
            '<strong>' + formatAmount(bePEF) + ' €</strong></div>' +
            '<div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">= ' + formatAmount(globalFixedTotal) + ' € fissi globali × ' + currentAllocPct + '% / ' + (beCalc.marginPct !== null ? beCalc.marginPct.toFixed(1) : '?') + '% MdC</div>' +
            '</div>' : '') +

            // Cost items list
            '<div style="margin-bottom:0.875rem;">' +
            '<div style="font-size:0.8rem;font-weight:600;color:var(--text-secondary);margin-bottom:0.5rem;">Voci di costo</div>' +
            (currentItems.length ? itemRows : '<div style="font-size:0.875rem;color:var(--text-secondary);padding:0.5rem 0;">Nessuna voce inserita.</div>') +
            '</div>' +

            // Add form
            '<div style="background:var(--glass-bg,rgba(0,0,0,0.02));border:1px solid var(--glass-border);border-radius:10px;padding:1rem;">' +
            '<div style="font-size:0.8rem;font-weight:600;color:var(--text-secondary);margin-bottom:0.75rem;">Aggiungi voce</div>' +
            '<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:8px;align-items:end;">' +
            '<div><label style="font-size:0.75rem;color:var(--text-secondary);">Nome</label>' +
            '<input id="new-item-name" placeholder="es. Ore grafico" style="width:100%;padding:0.4rem 0.6rem;border:1px solid var(--glass-border);border-radius:6px;background:var(--card-bg);color:var(--text-primary);font-size:0.85rem;box-sizing:border-box;"></div>' +
            '<div><label style="font-size:0.75rem;color:var(--text-secondary);">Tipo</label>' +
            '<select id="new-item-type" style="width:100%;padding:0.4rem 0.6rem;border:1px solid var(--glass-border);border-radius:6px;background:var(--card-bg);color:var(--text-primary);font-size:0.85rem;">' +
            '<option value="variable">Variabile</option><option value="fixed">Fisso</option>' +
            '</select></div>' +
            '<div><label style="font-size:0.75rem;color:var(--text-secondary);">Importo €</label>' +
            '<input id="new-item-amount" type="number" min="0" step="0.01" placeholder="0" style="width:100%;padding:0.4rem 0.6rem;border:1px solid var(--glass-border);border-radius:6px;background:var(--card-bg);color:var(--text-primary);font-size:0.85rem;box-sizing:border-box;"></div>' +
            '<button id="add-item-btn" style="background:var(--brand-blue);color:#fff;border:none;border-radius:6px;padding:0.45rem 0.75rem;font-size:0.85rem;cursor:pointer;">Aggiungi</button>' +
            '</div></div>' +

            '</div>';

        // Events
        drawerEl.querySelector('#drawer-close').addEventListener('click', () => {
            drawerEl.innerHTML = '';
            drawerEl.style.display = 'none';
        });

        drawerEl.querySelector('#save-price-btn').addEventListener('click', async () => {
            const price = parseFloat(drawerEl.querySelector('#selling-price-input').value) || 0;
            const allocRaw = drawerEl.querySelector('#alloc-pct-input').value;
            const alloc = allocRaw !== '' ? parseFloat(allocRaw) : null;
            await saveConfig(service.id, price, alloc);
            const fresh = await loadCostItems(service.id);
            renderDrawerContent(fresh, price, alloc);
        });

        drawerEl.querySelectorAll('.del-item').forEach(btn => {
            btn.addEventListener('click', async () => {
                await deleteCostItem(btn.dataset.id);
                const price = parseFloat(drawerEl.querySelector('#selling-price-input')?.value) || 0;
                const allocRaw = drawerEl.querySelector('#alloc-pct-input')?.value;
                const alloc = allocRaw !== '' ? parseFloat(allocRaw) : null;
                const fresh = await loadCostItems(service.id);
                renderDrawerContent(fresh, price, alloc);
            });
        });

        drawerEl.querySelector('#add-item-btn').addEventListener('click', async () => {
            const name = drawerEl.querySelector('#new-item-name').value.trim();
            const type = drawerEl.querySelector('#new-item-type').value;
            const amount = drawerEl.querySelector('#new-item-amount').value;
            const price = parseFloat(drawerEl.querySelector('#selling-price-input')?.value) || 0;
            const allocRaw = drawerEl.querySelector('#alloc-pct-input')?.value;
            const alloc = allocRaw !== '' ? parseFloat(allocRaw) : null;
            if (!name || !amount) return;
            await addCostItem(service.id, name, type, amount, null);
            const fresh = await loadCostItems(service.id);
            renderDrawerContent(fresh, price, alloc);
        });
    }

    renderDrawerContent(items, sellingPrice, allocationPct);
}

// ─── main render ─────────────────────────────────────────────────────────────

export async function renderCFOBreakeven(container) {
    const thisId = ++currentRenderId;
    const el = container || document.getElementById('content-area');
    if (!el) return;

    el.innerHTML = '<div style="display:flex;align-items:center;gap:12px;padding:1.5rem 1.5rem 1rem;">' +
        '<span class="material-icons-round" style="color:var(--brand-blue);">calculate</span>' +
        '<h2 style="margin:0;font-size:1.25rem;font-weight:600;">Distinta Base &amp; Break-even per Servizio</h2>' +
        '</div>' +
        '<div id="be-body" style="padding:0 1.5rem 2rem;">' +
        '<div style="display:flex;align-items:center;gap:8px;color:var(--text-secondary);font-size:0.9rem;">' +
        '<span class="material-icons-round" style="font-size:1.1rem;animation:spin 1s linear infinite;">sync</span>Caricamento...</div></div>';

    const [services, globalCosts] = await Promise.all([loadServices(), loadGlobalFixedCosts()]);
    if (thisId !== currentRenderId) return;

    const body = document.getElementById('be-body');
    if (!body) return;

    const globalFixedTotal = calcAnnualTotal(globalCosts);

    // Load configs + items for all services (summary)
    const summaries = await Promise.all(services.map(async svc => {
        const [cfg, items] = await Promise.all([loadConfig(svc.id), loadCostItems(svc.id)]);
        const price = cfg ? parseFloat(cfg.selling_price) || 0 : 0;
        const allocationPct = cfg ? cfg.fixed_cost_allocation_pct : null;
        const be = computeBreakeven(price, items);
        const bePEF = (globalFixedTotal && allocationPct)
            ? computeBevenPEF(price, items, globalFixedTotal, allocationPct)
            : null;
        return { svc, price, items, be, allocationPct, bePEF };
    }));

    // Drawer + pannello globale + card grid
    const drawerHtml = '<div id="be-drawer" style="display:none;background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;margin-bottom:1.5rem;"></div>';
    const globalPanelHtml = '<div id="gfc-panel"></div>';

    const cardGrid = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem;">' +
        summaries.map(({ svc, price, items, be, allocationPct, bePEF }) => {
            const tl = trafficLight(be.marginPct);
            const configured = items.length > 0 || price > 0;
            const statusBadge = configured
                ? '<span style="background:rgba(22,163,74,0.08);color:#16a34a;font-size:0.75rem;padding:2px 8px;border-radius:20px;">Configurato</span>'
                : '<span style="background:rgba(0,0,0,0.05);color:var(--text-secondary);font-size:0.75rem;padding:2px 8px;border-radius:20px;">Da configurare</span>';

            let beInfo = '';
            if (configured) {
                beInfo = '<div style="font-size:0.8rem;margin-top:6px;">' +
                    '<span style="color:var(--text-secondary);">Prezzo: </span><strong>' + formatAmount(price) + ' €</strong>' +
                    (be.breakEvenUnits !== null ? ' · Break-even: <strong>' + be.breakEvenUnits + ' und.</strong>' : '') +
                    '</div>' +
                    '<div style="display:flex;align-items:center;gap:4px;margin-top:4px;font-size:0.78rem;color:' + tl.color + ';">' +
                    '<span class="material-icons-round" style="font-size:0.9rem;">' + tl.icon + '</span>' + tl.label +
                    '</div>';
                if (bePEF) {
                    beInfo += '<div style="font-size:0.75rem;color:var(--brand-blue);margin-top:4px;">' +
                        'BE aziendale: <strong>' + formatAmount(bePEF) + ' €</strong> (' + allocationPct + '% fissi)</div>';
                }
            } else {
                beInfo = '<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:6px;">Inserisci prezzo e costi per calcolare il break-even.</div>';
            }

            return '<div class="be-card" data-id="' + svc.id + '" style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:12px;padding:1rem 1.25rem;cursor:pointer;transition:border-color .2s;" ' +
                'onmouseover="this.style.borderColor=\'var(--brand-blue)\'" onmouseout="this.style.borderColor=\'var(--glass-border)\'">' +
                '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;">' +
                '<span style="font-size:0.9rem;font-weight:600;">' + svc.name + '</span>' +
                statusBadge +
                '</div>' +
                (svc.description ? '<div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:4px;">' + svc.description + '</div>' : '') +
                beInfo +
                '<div style="margin-top:0.75rem;font-size:0.78rem;color:var(--brand-blue);font-weight:500;">Configura distinta base →</div>' +
                '</div>';
        }).join('') +
        '</div>';

    body.innerHTML = globalPanelHtml + drawerHtml + cardGrid;

    // Render pannello costi fissi globali
    await renderGlobalCostsPanel(document.getElementById('gfc-panel'));

    const drawerEl = document.getElementById('be-drawer');
    body.querySelectorAll('.be-card').forEach(card => {
        card.addEventListener('click', async () => {
            const svcId = card.dataset.id;
            const svc = services.find(s => s.id === svcId);
            if (!svc) return;
            drawerEl.style.display = 'block';
            drawerEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            const freshGlobal = await loadGlobalFixedCosts();
            const freshTotal = calcAnnualTotal(freshGlobal);
            await openServiceDrawer(svc, drawerEl, freshTotal);
        });
    });
}
