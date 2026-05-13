import { state } from '/js/modules/state.js?v=8000';
import { formatAmount } from '../modules/utils.js?v=8000';
import { upsertCollaboratorService, deleteCollaboratorService, fetchCollaboratorServices, fetchOrders, fetchCollaborators } from '../modules/api.js?v=8000';
import { CustomSelect } from '../components/CustomSelect.js?v=8000';
import { supabase } from '../modules/config.js?v=8000';

/**
 * Collaborator Services Feature
 * Registro Servizi (Anomalia 17 del quaderno UX 12/5/26):
 * tabella granulare delle istanze servizio collegate a incarichi/ordini.
 * Stile "movimenti bancari" — lista filtrabile.
 */

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRO SERVIZI — vista principale (#collaborator-services)
// ─────────────────────────────────────────────────────────────────────────────

let _regState = { yearFilter: 'all', orderFilter: 'all', collabFilter: 'all', search: '' };

export async function renderCollaboratorServices(container) {
    container.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:300px;"><div class="loader"></div></div>`;

    try {
        // Carica i dati se non ancora in state
        if (!state.collaboratorServices || state.collaboratorServices.length === 0) {
            await fetchCollaboratorServices();
        }
        if (!state.orders || state.orders.length === 0) {
            await fetchOrders();
        }
        if (!state.collaborators || state.collaborators.length === 0) {
            await fetchCollaborators();
        }
        if (!state.services || state.services.length === 0) {
            const { data } = await supabase.from('services').select('id, name, category').order('name');
            state.services = data || [];
        }

        _renderRegistroServizi(container);
    } catch (err) {
        console.error('[CollaboratorServices]', err);
        container.innerHTML = `<div style="padding:2rem;color:#ef4444;">Errore: ${err.message}</div>`;
    }
}

function _renderRegistroServizi(container) {
    const all = state.collaboratorServices || [];
    const ordersById = Object.fromEntries((state.orders || []).map(o => [o.id, o]));
    const collabsById = Object.fromEntries((state.collaborators || []).map(c => [c.id, c]));
    const servicesById = Object.fromEntries((state.services || []).map(s => [s.id, s]));

    // Filtri attivi
    let rows = all.slice();
    if (_regState.yearFilter !== 'all') {
        rows = rows.filter(r => {
            const d = r.created_at || r.updated_at;
            return d && new Date(d).getFullYear() === Number(_regState.yearFilter);
        });
    }
    if (_regState.orderFilter !== 'all') rows = rows.filter(r => r.order_id === _regState.orderFilter);
    if (_regState.collabFilter !== 'all') rows = rows.filter(r => r.collaborator_id === _regState.collabFilter);
    if (_regState.search.trim()) {
        const q = _regState.search.toLowerCase();
        rows = rows.filter(r => {
            const svc = servicesById[r.service_id]?.name || r.legacy_service_name || r.name || '';
            const ord = ordersById[r.order_id];
            const ordLabel = ord ? `${ord.order_number} ${ord.title || ''} ${ord.short_name || ''}` : '';
            const collab = collabsById[r.collaborator_id]?.full_name || '';
            return (svc + ' ' + ordLabel + ' ' + collab).toLowerCase().includes(q);
        });
    }

    rows.sort((a, b) => {
        const da = new Date(a.created_at || a.updated_at || 0);
        const db = new Date(b.created_at || b.updated_at || 0);
        return db - da;
    });

    // KPI aggregati (sulle righe filtrate)
    const totalRows = rows.length;
    const totalCost = rows.reduce((s, r) => s + (parseFloat(r.total_cost) || 0), 0);
    const totalPrice = rows.reduce((s, r) => s + (parseFloat(r.total_price) || 0), 0);
    const totalMargin = totalPrice - totalCost;
    const marginPct = totalPrice > 0 ? Math.round((totalMargin / totalPrice) * 100) : 0;

    // Anni disponibili
    const yearsSet = new Set();
    all.forEach(r => {
        const d = r.created_at || r.updated_at;
        if (d) yearsSet.add(new Date(d).getFullYear());
    });
    const years = [...yearsSet].sort((a, b) => b - a);

    container.innerHTML = `
        <div class="animate-fade-in" style="padding: 2rem; display: flex; flex-direction: column; gap: 1.5rem;">

            <!-- HEADER -->
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h2 style="margin: 0; font-family: var(--font-titles); font-size: 1.6rem; font-weight: 700; color: var(--text-primary);">Registro Servizi</h2>
                    <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--text-secondary);">
                        Tutte le istanze atomiche di servizio collegate a incarichi e commesse.
                    </p>
                </div>
                <div style="font-size: 0.78rem; color: var(--text-tertiary); text-align: right;">
                    ${totalRows} righe · totale tariffario € ${formatAmount(totalPrice)} · costo € ${formatAmount(totalCost)} · margine ${marginPct}%
                </div>
            </div>

            <!-- KPI cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;">
                ${_regKpi('format_list_numbered', 'Righe', totalRows.toLocaleString('it-IT'), '#3b82f6')}
                ${_regKpi('sell', 'Totale prezzo', '€ ' + formatAmount(totalPrice), '#10b981')}
                ${_regKpi('attach_money', 'Totale costo', '€ ' + formatAmount(totalCost), '#ef4444')}
                ${_regKpi('trending_up', 'Margine', '€ ' + formatAmount(totalMargin) + ' (' + marginPct + '%)', totalMargin >= 0 ? '#10b981' : '#ef4444')}
            </div>

            <!-- FILTRI -->
            <div class="glass-card" style="padding: 1rem 1.25rem; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                <span style="font-size: 0.7rem; color: var(--text-tertiary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Filtri</span>

                <input type="search" id="reg-search" placeholder="Cerca per servizio / commessa / collab..." value="${escapeAttr(_regState.search)}"
                    style="flex: 1; min-width: 240px; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--glass-border); font-size: 0.85rem;">

                <select id="reg-year" style="padding: 7px 10px; border-radius: 8px; border: 1px solid var(--glass-border); font-size: 0.8rem;">
                    <option value="all" ${_regState.yearFilter === 'all' ? 'selected' : ''}>Tutti gli anni</option>
                    ${years.map(y => `<option value="${y}" ${_regState.yearFilter == y ? 'selected' : ''}>${y}</option>`).join('')}
                </select>

                <select id="reg-order" style="padding: 7px 10px; border-radius: 8px; border: 1px solid var(--glass-border); font-size: 0.8rem; max-width: 240px;">
                    <option value="all">Tutte le commesse</option>
                    ${Object.values(ordersById).map(o => `<option value="${o.id}" ${_regState.orderFilter === o.id ? 'selected' : ''}>${escapeAttr(o.order_number)} · ${escapeAttr(o.short_name || o.title || '')}</option>`).join('')}
                </select>

                <select id="reg-collab" style="padding: 7px 10px; border-radius: 8px; border: 1px solid var(--glass-border); font-size: 0.8rem; max-width: 220px;">
                    <option value="all">Tutti i collab</option>
                    ${Object.values(collabsById).map(c => `<option value="${c.id}" ${_regState.collabFilter === c.id ? 'selected' : ''}>${escapeAttr(c.full_name || '')}</option>`).join('')}
                </select>

                <button id="reg-reset" style="padding: 7px 12px; border-radius: 8px; border: 1px solid var(--glass-border); background: white; cursor: pointer; font-size: 0.8rem; color: var(--text-secondary);">
                    Reset
                </button>
            </div>

            <!-- TABELLA -->
            <div class="glass-card" style="padding: 0; overflow: hidden; border-radius: 14px;">
                <div style="overflow-x: auto; max-height: 65vh; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                        <thead style="position: sticky; top: 0; background: var(--bg-secondary); z-index: 1;">
                            <tr style="border-bottom: 1px solid var(--glass-border); text-align: left;">
                                <th style="padding: 0.75rem 1rem; font-weight: 700; font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em;">Data</th>
                                <th style="padding: 0.75rem 1rem; font-weight: 700; font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em;">Servizio</th>
                                <th style="padding: 0.75rem 1rem; font-weight: 700; font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em;">Commessa</th>
                                <th style="padding: 0.75rem 1rem; font-weight: 700; font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em;">Collaboratore</th>
                                <th style="padding: 0.75rem 1rem; font-weight: 700; font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; text-align: right;">Quantità</th>
                                <th style="padding: 0.75rem 1rem; font-weight: 700; font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; text-align: right;">Costo</th>
                                <th style="padding: 0.75rem 1rem; font-weight: 700; font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; text-align: right;">Prezzo</th>
                                <th style="padding: 0.75rem 1rem; font-weight: 700; font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; text-align: right;">Margine</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.length === 0 ? `
                                <tr><td colspan="8" style="padding: 3rem; text-align: center; color: var(--text-tertiary);">
                                    Nessuna riga corrisponde ai filtri.
                                </td></tr>
                            ` : rows.map(r => _regRow(r, ordersById, collabsById, servicesById)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // Listeners
    container.querySelector('#reg-search').addEventListener('input', _debounce((e) => {
        _regState.search = e.target.value;
        _renderRegistroServizi(container);
    }, 250));
    container.querySelector('#reg-year').addEventListener('change', (e) => { _regState.yearFilter = e.target.value; _renderRegistroServizi(container); });
    container.querySelector('#reg-order').addEventListener('change', (e) => { _regState.orderFilter = e.target.value; _renderRegistroServizi(container); });
    container.querySelector('#reg-collab').addEventListener('change', (e) => { _regState.collabFilter = e.target.value; _renderRegistroServizi(container); });
    container.querySelector('#reg-reset').addEventListener('click', () => {
        _regState = { yearFilter: 'all', orderFilter: 'all', collabFilter: 'all', search: '' };
        _renderRegistroServizi(container);
    });
}

function _regKpi(icon, label, value, color) {
    return `
        <div class="glass-card" style="padding: 0.9rem 1rem; display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 36px; height: 36px; border-radius: 9px; background: ${color}14; color: ${color}; display: flex; align-items: center; justify-content: center;">
                <span class="material-icons-round" style="font-size: 18px;">${icon}</span>
            </div>
            <div>
                <div style="font-size: 0.6rem; color: var(--text-tertiary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.1rem;">${label}</div>
                <div style="font-size: 1.05rem; font-weight: 800; color: var(--text-primary); font-family: 'Plus Jakarta Sans', sans-serif; line-height: 1.1;">${value}</div>
            </div>
        </div>
    `;
}

function _regRow(r, ordersById, collabsById, servicesById) {
    const date = r.created_at || r.updated_at;
    const dateStr = date ? new Date(date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
    const svcName = servicesById[r.service_id]?.name || r.legacy_service_name || r.name || '<em>senza nome</em>';
    const order = ordersById[r.order_id];
    const orderLabel = order ? `<a onclick="window.location.hash='order-detail/${order.id}'" style="color: var(--brand-blue); text-decoration: none; cursor: pointer;">${escapeAttr(order.order_number)}</a> <span style="color: var(--text-tertiary);">· ${escapeAttr(order.short_name || order.title || '')}</span>` : (r.legacy_order_id ? `<span style="color: var(--text-tertiary);">${escapeAttr(r.legacy_order_id)}</span>` : '<span style="color: var(--text-tertiary);">-</span>');
    const collab = collabsById[r.collaborator_id];
    const collabLabel = collab ? `<a onclick="window.location.hash='collaborator-detail/${collab.id}'" style="color: var(--text-primary); text-decoration: none; cursor: pointer;">${escapeAttr(collab.full_name)}</a>` : '<span style="color: var(--text-tertiary);">-</span>';

    const totalCost = parseFloat(r.total_cost) || 0;
    const totalPrice = parseFloat(r.total_price) || 0;
    const margin = totalPrice - totalCost;

    return `
        <tr style="border-bottom: 1px solid var(--glass-border); transition: background 0.15s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background=''">
            <td style="padding: 0.7rem 1rem; color: var(--text-secondary); font-variant-numeric: tabular-nums; white-space: nowrap;">${dateStr}</td>
            <td style="padding: 0.7rem 1rem; font-weight: 600; color: var(--text-primary);">${svcName}</td>
            <td style="padding: 0.7rem 1rem; font-size: 0.8rem;">${orderLabel}</td>
            <td style="padding: 0.7rem 1rem; font-size: 0.85rem;">${collabLabel}</td>
            <td style="padding: 0.7rem 1rem; text-align: right; font-variant-numeric: tabular-nums; color: var(--text-secondary);">${r.quantity || r.hours || '-'}</td>
            <td style="padding: 0.7rem 1rem; text-align: right; font-variant-numeric: tabular-nums; color: #ef4444; font-weight: 600;">€ ${formatAmount(totalCost)}</td>
            <td style="padding: 0.7rem 1rem; text-align: right; font-variant-numeric: tabular-nums; color: #10b981; font-weight: 600;">€ ${formatAmount(totalPrice)}</td>
            <td style="padding: 0.7rem 1rem; text-align: right; font-variant-numeric: tabular-nums; color: ${margin >= 0 ? '#10b981' : '#ef4444'}; font-weight: 700;">€ ${formatAmount(margin)}</td>
        </tr>
    `;
}

function _debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function escapeAttr(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Robust Math Engine
 */
const updateTotals = () => {
    const qVal = document.getElementById('cs-quantity')?.value || "0";
    const q = parseFloat(qVal.replace(',', '.')) || 0;
    const c = parseFloat(document.getElementById('cs-unit_cost')?.value) || 0;
    const p = parseFloat(document.getElementById('cs-unit_price')?.value) || 0;

    const totalCost = q * c;
    const totalPrice = q * p;

    const costDisplay = document.getElementById('cs-total-cost-display');
    const priceDisplay = document.getElementById('cs-total-price-display');

    if (costDisplay) costDisplay.textContent = '€ ' + formatAmount(totalCost);
    if (priceDisplay) priceDisplay.textContent = '€ ' + formatAmount(totalPrice);
    
    console.log(`[CS Math] Q:${q} * C:${c} = ${totalCost} | Q:${q} * P:${p} = ${totalPrice}`);
};
window.calculateCsTotals = updateTotals;

/**
 * Robust Filtering Engine
 */
window.csOnDeptChange = () => {
    const dept = document.getElementById('cs-dept').value;
    const selector = document.getElementById('cs-service-id-ref');
    const collabSelector = document.getElementById('cs-collaborator');
    
    if (!selector || !collabSelector) return;

    // 1. Services Filtering - PROPER MAPPING: s.cost and s.price!
    const allServices = state.services || [];
    const filteredServices = allServices.filter(s => {
        if (!dept) return true;
        const tags = Array.isArray(s.tags) ? s.tags : (typeof s.tags === 'string' ? s.tags.split(',') : []);
        return tags.some(t => t.trim().toLowerCase() === dept.toLowerCase());
    }).sort((a,b) => a.name.localeCompare(b.name));
    
    selector.innerHTML = '<option value="">' + (dept ? 'Seleziona un servizio...' : 'Seleziona un reparto...') + '</option>' +
        filteredServices.map(s => `<option value="${s.id}" data-type="${s.type || 'tariffa spot'}" data-cost="${s.cost || 0}" data-price="${s.price || 0}">${s.name}</option>`).join('');
    
    // 2. Collaborators Filtering
    const allCollabs = state.collaborators || [];
    const currentAssignmentId = document.getElementById('cs-assignment-id').value;
    const currentAsg = state.assignments?.find(a => a.id === currentAssignmentId);
    const existingCollabId = currentAsg?.collaborator_id || document.getElementById('cs-collaborator').value;

    const filteredCollabs = allCollabs.filter(c => {
        if (existingCollabId && c.id === existingCollabId) return true;
        if (!dept) return true;
        let tags = c.tags || [];
        if (typeof tags === 'string') tags = tags.split(',').map(t => t.trim());
        return tags.some(t => t.toLowerCase() === dept.toLowerCase());
    }).sort((a,b) => a.full_name.localeCompare(b.full_name));
    
    collabSelector.innerHTML = '<option value="">Seleziona...</option>' +
        filteredCollabs.map(c => `<option value="${c.id}">${c.full_name}</option>`).join('');

    if (existingCollabId) collabSelector.value = existingCollabId;

    if (window.csSelectInstances) {
        window.csSelectInstances['cs-service-id-ref']?.refresh();
        window.csSelectInstances['cs-collaborator']?.refresh();
    }
    
    window.calculateCsTotals();
};

window.csOnServiceChange = () => {
    const selector = document.getElementById('cs-service-id-ref');
    const option = selector?.selectedOptions[0];
    if (!option || !option.value) {
        document.getElementById('cs-tariff-type').value = '';
        document.getElementById('cs-tariff-display').textContent = '-';
        document.getElementById('cs-unit_cost').value = 0;
        document.getElementById('cs-unit_price').value = 0;
        window.calculateCsTotals();
        return;
    }

    const type = option.getAttribute('data-type') || 'tariffa spot';
    const cost = parseFloat(option.getAttribute('data-cost')) || 0;
    const price = parseFloat(option.getAttribute('data-price')) || 0;
    const name = option.text;

    document.getElementById('cs-tariff-type').value = type;
    document.getElementById('cs-tariff-display').textContent = type.replace('tariffa ', '').toUpperCase();
    document.getElementById('cs-unit_cost').value = cost;
    document.getElementById('cs-unit_price').value = price;
    document.getElementById('cs-name-hidden').value = name;

    const qtyLabel = document.getElementById('cs-qty-label');
    if (qtyLabel) {
        if (type === 'tariffa oraria') qtyLabel.textContent = 'Ore';
        else if (type === 'tariffa mensile') qtyLabel.textContent = 'Mesi';
        else qtyLabel.textContent = 'Quantità';
    }

    window.calculateCsTotals();
};

export function initCollaboratorServiceModals() {
    if (!document.getElementById('collab-service-detail-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="collab-service-detail-modal" class="modal">
                <div class="modal-content" style="max-width: 500px;">
                    <button class="close-modal material-icons-round" onclick="closeCollabServiceDetail()">close</button>
                    <div id="collab-service-detail-content"></div>
                </div>
            </div>

            <div id="collab-service-edit-modal" class="modal">
                <div class="modal-content" style="max-width: 550px; padding: 0; background: var(--card-bg); border-radius: 16px; overflow: hidden; border: 1px solid var(--glass-border); box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
                    <div class="modal-header" style="padding: 1.25rem 1.5rem; background: var(--bg-color); border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="width: 40px; height: 40px; border-radius: 12px; background: var(--brand-gradient); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(var(--brand-blue-rgb), 0.2);">
                                <span class="material-icons-round" style="color: white; font-size: 1.4rem;">playlist_add</span>
                            </div>
                            <h2 id="cs-edit-title" style="margin: 0; font-family: var(--font-titles); font-weight: 700; font-size: 1.2rem;">Inserimento Servizio</h2>
                        </div>
                        <button class="close-modal material-icons-round" onclick="closeCollabServiceEdit()" style="position: static; cursor: pointer; background: none; border: none; color: var(--text-tertiary); font-size: 1.5rem;">close</button>
                    </div>
                    
                    <form id="collab-service-edit-form" style="padding: 1.5rem;">
                        <input type="hidden" id="cs-id">
                        <input type="hidden" id="cs-order-id">
                        <input type="hidden" id="cs-assignment-id">
                        <input type="hidden" id="cs-tariff-type">
                        <input type="hidden" id="cs-name-hidden">
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
                            <div class="form-group">
                                <label class="text-caption">Reparto</label>
                                <select id="cs-dept" class="modal-input" style="width: 100%;" onchange="window.csOnDeptChange()">
                                    <option value="">Seleziona...</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="text-caption">Tipo Tariffa</label>
                                <div id="cs-tariff-display" class="modal-input" style="background: var(--bg-secondary); font-weight: 600; color: var(--brand-blue); border: 1px solid var(--glass-border); display: flex; align-items: center; padding: 0 0.75rem; min-height: 42px;">-</div>
                            </div>
                        </div>

                        <div class="form-group" style="margin-bottom: 1.25rem;">
                            <label class="text-caption">Servizio a Catalogo (Tariffario)</label>
                            <select id="cs-service-id-ref" class="modal-input" style="width: 100%;" onchange="window.csOnServiceChange()">
                                <option value="">Seleziona un reparto...</option>
                            </select>
                        </div>

                        <div class="form-group" style="margin-bottom: 1.25rem;">
                            <label class="text-caption">Collaboratore Assegnato</label>
                            <select id="cs-collaborator" class="modal-input" style="width: 100%;">
                                <option value="">Seleziona...</option>
                            </select>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                            <div class="form-group">
                                <label id="cs-qty-label" class="text-caption">Quantità</label>
                                <input type="number" id="cs-quantity" class="modal-input" value="1" step="0.5" min="0" 
                                       oninput="window.calculateCsTotals()" onchange="window.calculateCsTotals()">
                            </div>
                            <div class="form-group">
                                <label class="text-caption">Costo Unit.</label>
                                <input type="number" id="cs-unit_cost" class="modal-input" value="0" readonly style="background: var(--bg-secondary); color: var(--text-tertiary); cursor: not-allowed; border: 1px solid var(--glass-border); font-weight: 600;">
                            </div>
                            <div class="form-group">
                                <label class="text-caption">Prezzo Unit.</label>
                                <input type="number" id="cs-unit_price" class="modal-input" value="0" readonly style="background: var(--bg-secondary); color: var(--text-tertiary); cursor: not-allowed; border: 1px solid var(--glass-border); font-weight: 600;">
                            </div>
                        </div>

                        <div id="cs-totals-preview" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; padding: 1.25rem; background: var(--bg-secondary); border-radius: 12px; border: 1px solid var(--glass-border); box-shadow: inset 0 2px 8px rgba(0,0,0,0.03);">
                            <div>
                                <div class="text-caption" style="margin-bottom: 0.25rem; font-weight: 600;">Costo Totale Incarico</div>
                                <div id="cs-total-cost-display" style="font-weight: 800; color: #ef4444; font-size: 1.6rem; font-family: var(--font-titles);">€ 0,00</div>
                            </div>
                            <div style="text-align: right;">
                                <div class="text-caption" style="margin-bottom: 0.25rem; font-weight: 600;">Prezzo Totale Ordine</div>
                                <div id="cs-total-price-display" style="font-weight: 800; color: #22c55e; font-size: 1.6rem; font-family: var(--font-titles);">€ 0,00</div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 0.75rem;">
                            <button type="button" id="cs-delete-btn" class="icon-btn-danger" onclick="window.deleteCollabService()" style="display: none; height: 48px; width: 48px;">
                                <span class="material-icons-round">delete</span>
                            </button>
                            <button type="button" class="primary-btn secondary" onclick="closeCollabServiceEdit()" style="flex: 1; padding: 0.75rem;">Annulla</button>
                            <button type="submit" class="primary-btn" style="flex: 2; font-weight: 800; height: 48px; font-size: 1rem;">Salva Servizio</button>
                        </div>
                    </form>
                </div>
            </div>
        `);
    }
}

export const openCollaboratorServiceEdit = async (id = null, prefillOrderId = null, prefillAssignmentId = null) => {
    window.openCollaboratorServiceEdit = openCollaboratorServiceEdit;
    window.closeCollabServiceDetail?.(); 
    
    const modal = document.getElementById('collab-service-edit-modal');
    const form = document.getElementById('collab-service-edit-form');
    if (!form || !modal) return;
    form.reset();

    // Data bootstrap
    const { fetchServices, fetchDepartments, fetchCollaborators } = await import('../modules/api.js?v=8000');
    await Promise.all([fetchServices(), fetchDepartments(), fetchCollaborators()]);

    const deptSelect = document.getElementById('cs-dept');
    const depts = state.departments || [];
    deptSelect.innerHTML = '<option value="">Seleziona...</option>' + depts.map(d => `<option value="${d.name}">${d.name}</option>`).join('');

    if (!window.csSelectInstances) window.csSelectInstances = {};
    ['cs-dept', 'cs-service-id-ref', 'cs-collaborator'].forEach(sid => {
        const el = document.getElementById(sid);
        if (el && !el.parentNode.classList.contains('custom-select-wrapper')) {
            window.csSelectInstances[sid] = new CustomSelect(el);
        } else if (window.csSelectInstances[sid]) {
             window.csSelectInstances[sid].refresh();
        }
    });

    document.getElementById('cs-assignment-id').value = prefillAssignmentId || '';
    document.getElementById('cs-order-id').value = prefillOrderId || '';

    if (id) {
        // --- EDIT MODE ---
        document.getElementById('cs-edit-title').textContent = 'Modifica Servizio';
        document.getElementById('cs-delete-btn').style.display = 'flex';
        const s = state.collaboratorServices.find(x => x.id === id);
        if (s) {
            document.getElementById('cs-id').value = s.id;
            document.getElementById('cs-order-id').value = s.order_id || '';
            document.getElementById('cs-assignment-id').value = s.assignment_id || '';
            document.getElementById('cs-dept').value = s.department || '';
            
            window.csOnDeptChange(); 

            document.getElementById('cs-service-id-ref').value = s.service_id || '';
            document.getElementById('cs-collaborator').value = s.collaborator_id || '';
            document.getElementById('cs-tariff-type').value = s.tariff_type || 'tariffa spot';
            document.getElementById('cs-tariff-display').textContent = (s.tariff_type || 'Hr').replace('tariffa ', '').toUpperCase();
            
            const qty = s.hours || s.months || s.spot_quantity || s.quantity || 0;
            document.getElementById('cs-quantity').value = qty;
            document.getElementById('cs-unit_cost').value = s.unit_cost || 0;
            document.getElementById('cs-unit_price').value = s.unit_price || 0;
            document.getElementById('cs-name-hidden').value = s.name || '';

            Object.values(window.csSelectInstances).forEach(inst => inst.refresh());
            window.calculateCsTotals();
        }
    } else {
        // --- ADD MODE ---
        document.getElementById('cs-edit-title').textContent = 'Inserimento Servizio';
        document.getElementById('cs-id').value = '';
        document.getElementById('cs-delete-btn').style.display = 'none';

        if (prefillAssignmentId) {
            const asg = state.assignments?.find(a => a.id === prefillAssignmentId);
            const collab = state.collaborators?.find(c => c.id === asg?.collaborator_id);
            if (collab) {
                const collabTags = (Array.isArray(collab.tags) ? collab.tags : (typeof collab.tags === 'string' ? collab.tags.split(',') : [])).map(t => t.trim().toLowerCase());
                const matchingDept = state.departments?.find(d => collabTags.includes(d.name.toLowerCase()));
                if (matchingDept) {
                    document.getElementById('cs-dept').value = matchingDept.name;
                }
                window.csOnDeptChange();
                document.getElementById('cs-collaborator').value = collab.id;
                if (window.csSelectInstances['cs-collaborator']) window.csSelectInstances['cs-collaborator'].refresh();
            }
        } else {
            window.csOnDeptChange(); 
        }
        
        Object.values(window.csSelectInstances).forEach(inst => inst.refresh());
        window.calculateCsTotals();
    }

    form.onsubmit = async (e) => {
        e.preventDefault();
        const tariffType = document.getElementById('cs-tariff-type').value || 'tariffa spot';
        const q = parseFloat(document.getElementById('cs-quantity').value) || 0;
        const cost = parseFloat(document.getElementById('cs-unit_cost').value) || 0;
        const price = parseFloat(document.getElementById('cs-unit_price').value) || 0;

        const formData = {
            id: document.getElementById('cs-id').value || undefined,
            order_id: document.getElementById('cs-order-id').value || null,
            assignment_id: document.getElementById('cs-assignment-id').value || null,
            name: document.getElementById('cs-name-hidden').value,
            service_id: document.getElementById('cs-service-id-ref').value || null,
            department: document.getElementById('cs-dept').value,
            tariff_type: tariffType,
            collaborator_id: document.getElementById('cs-collaborator').value || null,
            quantity: q,
            hours: (tariffType === 'tariffa oraria') ? q : null,
            months: (tariffType === 'tariffa mensile' || tariffType === 'tariffa annuale') ? q : null,
            spot_quantity: (tariffType === 'tariffa spot') ? q : null,
            unit_cost: cost,
            unit_price: price,
            total_cost: q * cost,
            total_price: q * price
        };

        try {
            await upsertCollaboratorService(formData);
            window.closeCollabServiceEdit();
            await refreshCollaboratorServicePage();
            window.showAlert('Servizio salvato con successo', 'success');
        } catch (err) {
            window.showAlert('Errore: ' + err.message, 'error');
        }
    };

    modal.classList.add('active');
};

export const confirmDeleteCollabService = async (id) => {
    window.confirmDeleteCollabService = confirmDeleteCollabService;
    if (await window.showConfirm("Eliminare questo servizio?", { type: 'danger' })) {
        try {
            await deleteCollaboratorService(id);
            window.closeCollabServiceDetail?.();
            window.closeCollabServiceEdit?.();
            await refreshCollaboratorServicePage();
        } catch (e) {
            window.showAlert("Errore: " + e.message, 'error');
        }
    }
};

window.deleteCollabService = () => {
    const id = document.getElementById('cs-id').value;
    if (id) window.confirmDeleteCollabService(id);
};

export async function refreshCollaboratorServicePage() {
    const { fetchCollaboratorServices, fetchAssignments } = await import('../modules/api.js?v=8000');
    await Promise.all([fetchCollaboratorServices(), fetchAssignments()]);
    
    if (state.currentPage === 'collaborator-services') {
        renderCollaboratorServices(document.getElementById('content-area'));
    } else if (window.location.hash.includes('assignment-detail')) {
        const { renderAssignmentDetail } = await import('./assignments.js?v=8000');
        renderAssignmentDetail(document.getElementById('content-area'));
    }
}

window.closeCollabServiceDetail = () => document.getElementById('collab-service-detail-modal')?.classList.remove('active');
window.closeCollabServiceEdit = () => document.getElementById('collab-service-edit-modal')?.classList.remove('active');
