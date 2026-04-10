import { state } from '/js/modules/state.js';
import { formatAmount } from '../modules/utils.js?v=1000';
import { upsertCollaboratorService, deleteCollaboratorService } from '../modules/api.js';
import { CustomSelect } from '../components/CustomSelect.js';

/**
 * Collaborator Services Feature
 * Final Polish: Calculations and UI consistency.
 */

export function renderCollaboratorServices(container) {
    // Standalone register page...
}

/**
 * CALCULATE Totals Helper
 */
window.calculateCsTotals = () => {
    const qEl = document.getElementById('cs-quantity');
    const cEl = document.getElementById('cs-unit_cost');
    const pEl = document.getElementById('cs-unit_price');
    const totalCostEl = document.getElementById('cs-total-cost-display');
    const totalPriceEl = document.getElementById('cs-total-price-display');

    if (!qEl || !cEl || !pEl || !totalCostEl || !totalPriceEl) return;

    const q = parseFloat(qEl.value) || 0;
    const c = parseFloat(cEl.value) || 0;
    const p = parseFloat(pEl.value) || 0;

    totalCostEl.textContent = '€ ' + formatAmount(q * c);
    totalPriceEl.textContent = '€ ' + formatAmount(q * p);
};

window.csOnDeptChange = () => {
    const dept = document.getElementById('cs-dept').value;
    const selector = document.getElementById('cs-service-id-ref');
    const collabSelector = document.getElementById('cs-collaborator');
    
    if (!selector || !collabSelector) return;

    const allServices = state.services || [];
    const filteredServices = allServices.filter(s => {
        if (!dept) return true;
        const tags = Array.isArray(s.tags) ? s.tags : (typeof s.tags === 'string' ? s.tags.split(',') : []);
        return tags.some(t => t.trim().toLowerCase() === dept.toLowerCase());
    });
    
    selector.innerHTML = '<option value="">' + (dept ? 'Seleziona un servizio...' : 'Seleziona un reparto prima...') + '</option>' +
        filteredServices.map(s => `<option value="${s.id}" data-type="${s.type || 'tariffa spot'}" data-cost="${s.unit_cost || 0}" data-price="${s.unit_price || 0}">${s.name}</option>`).join('');
    
    const allCollabs = state.collaborators || [];
    const filteredCollabs = allCollabs.filter(c => {
        if (!dept) return true;
        let tags = c.tags || [];
        if (typeof tags === 'string') {
            tags = tags.split(',').map(t => t.trim());
        }
        return tags.some(t => t.toLowerCase() === dept.toLowerCase());
    });
    
    collabSelector.innerHTML = '<option value="">Seleziona...</option>' +
        filteredCollabs.map(c => `<option value="${c.id}">${c.full_name}</option>`).join('');

    if (window.csSelectInstances) {
        window.csSelectInstances['cs-service-id-ref']?.refresh();
        window.csSelectInstances['cs-collaborator']?.refresh();
    }
};

window.csOnServiceChange = () => {
    const selector = document.getElementById('cs-service-id-ref');
    const option = selector.selectedOptions[0];
    if (!option || !option.value) {
        document.getElementById('cs-tariff-type').value = '';
        document.getElementById('cs-tariff-display').textContent = '-';
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

    // Recalculate Totals
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
                    <div class="modal-header" style="padding: 1rem 1.5rem; background: var(--bg-color); border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; margin-bottom: 0;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="width: 36px; height: 36px; border-radius: 10px; background: var(--brand-gradient); display: flex; align-items: center; justify-content: center;">
                                <span class="material-icons-round" style="color: white; font-size: 1.25rem;">playlist_add</span>
                            </div>
                            <h2 id="cs-edit-title" style="margin: 0; font-family: var(--font-titles); font-weight: 700; font-size: 1.15rem;">Configuratore Servizio</h2>
                        </div>
                        <button class="close-modal material-icons-round" onclick="closeCollabServiceEdit()" style="position: static; color: var(--text-tertiary);">close</button>
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
                                <div id="cs-tariff-display" class="modal-input" style="background: var(--bg-secondary); border: 1px solid var(--glass-border); font-weight: 600; font-size: 0.9rem; color: var(--brand-blue);">-</div>
                            </div>
                        </div>

                        <div class="form-group" style="margin-bottom: 1.25rem;">
                            <label class="text-caption">Servizio a Catalogo (Tariffario)</label>
                            <select id="cs-service-id-ref" class="modal-input" style="width: 100%;" onchange="window.csOnServiceChange()">
                                <option value="">Seleziona un reparto prima...</option>
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
                                <input type="number" id="cs-quantity" class="modal-input" value="1" step="0.5" min="0" oninput="window.calculateCsTotals()">
                            </div>
                            <div class="form-group">
                                <label class="text-caption">Costo Unit.</label>
                                <input type="number" id="cs-unit_cost" class="modal-input" value="0" readonly style="background: var(--bg-secondary); border: 1px solid var(--glass-border); color: var(--text-tertiary);">
                            </div>
                            <div class="form-group">
                                <label class="text-caption">Prezzo Unit.</label>
                                <input type="number" id="cs-unit_price" class="modal-input" value="0" readonly style="background: var(--bg-secondary); border: 1px solid var(--glass-border); color: var(--text-tertiary);">
                            </div>
                        </div>

                        <div id="cs-totals-area" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; padding: 1.25rem; background: var(--bg-secondary); border-radius: 12px; border: 1px solid var(--glass-border); box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                            <div>
                                <div class="text-caption" style="margin-bottom: 0.25rem;">Costo Totale Incarico</div>
                                <div id="cs-total-cost-display" style="font-weight: 800; color: #ef4444; font-size: 1.4rem; font-family: var(--font-titles);">€ 0,00</div>
                            </div>
                            <div style="text-align: right;">
                                <div class="text-caption" style="margin-bottom: 0.25rem;">Prezzo Totale Ordine</div>
                                <div id="cs-total-price-display" style="font-weight: 800; color: #22c55e; font-size: 1.4rem; font-family: var(--font-titles);">€ 0,00</div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 0.75rem;">
                            <button type="button" id="cs-delete-btn" class="primary-btn secondary danger" onclick="window.deleteCollabService()" style="display: none;">
                                <span class="material-icons-round">delete</span>
                            </button>
                            <button type="button" class="primary-btn secondary" onclick="closeCollabServiceEdit()" style="flex: 1;">Annulla</button>
                            <button type="submit" class="primary-btn" style="flex: 2; font-weight: 700; height: 48px;">Salva Servizio</button>
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
    const { fetchServices, fetchDepartments, fetchCollaborators } = await import('../modules/api.js?v=2012');
    await Promise.all([fetchServices(), fetchDepartments(), fetchCollaborators()]);

    // Initial Setup
    const deptSelect = document.getElementById('cs-dept');
    const depts = state.departments || [];
    deptSelect.innerHTML = '<option value="">Seleziona...</option>' + depts.map(d => `<option value="${d.name}">${d.name}</option>`).join('');

    // CustomSelect Init
    if (!window.csSelectInstances) window.csSelectInstances = {};
    ['cs-dept', 'cs-service-id-ref', 'cs-collaborator'].forEach(sid => {
        const el = document.getElementById(sid);
        if (el && !el.parentNode.classList.contains('custom-select-wrapper')) {
            window.csSelectInstances[sid] = new CustomSelect(el);
        } else if (window.csSelectInstances[sid]) {
             window.csSelectInstances[sid].refresh();
        }
    });

    if (id) {
        // --- EDIT MODE ---
        document.getElementById('cs-edit-title').textContent = 'Modifica Servizio';
        document.getElementById('cs-delete-btn').style.display = 'block';
        const s = state.collaboratorServices.find(x => x.id === id);
        if (s) {
            document.getElementById('cs-id').value = s.id;
            document.getElementById('cs-order-id').value = s.order_id || '';
            document.getElementById('cs-assignment-id').value = s.assignment_id || '';
            
            document.getElementById('cs-dept').value = s.department || '';
            window.csOnDeptChange(); 

            document.getElementById('cs-service-id-ref').value = s.service_id || '';
            document.getElementById('cs-collaborator').value = s.collaborator_id || '';
            document.getElementById('cs-tariff-type').value = s.tariff_type || 'tariffa oraria';
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
        document.getElementById('cs-order-id').value = prefillOrderId || '';
        document.getElementById('cs-assignment-id').value = prefillAssignmentId || '';

        if (prefillAssignmentId) {
            const asg = state.assignments?.find(a => a.id === prefillAssignmentId);
            const collab = state.collaborators?.find(c => c.id === asg?.collaborator_id);
            if (collab) {
                const collabTags = (Array.isArray(collab.tags) ? collab.tags : (typeof collab.tags === 'string' ? collab.tags.split(',') : [])).map(t => t.trim().toLowerCase());
                const matchingDept = state.departments?.find(d => collabTags.includes(d.name.toLowerCase()));
                if (matchingDept) {
                    document.getElementById('cs-dept').value = matchingDept.name;
                    window.csOnDeptChange();
                    document.getElementById('cs-collaborator').value = collab.id;
                }
            }
        } else {
            window.csOnDeptChange(); 
        }
        
        Object.values(window.csSelectInstances).forEach(inst => inst.refresh());
        document.getElementById('cs-total-cost-display').textContent = '€ 0,00';
        document.getElementById('cs-total-price-display').textContent = '€ 0,00';
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
    const { fetchCollaboratorServices, fetchAssignments } = await import('../modules/api.js?v=2012');
    await Promise.all([fetchCollaboratorServices(), fetchAssignments()]);
    
    if (state.currentPage === 'collaborator-services') {
        renderCollaboratorServices(document.getElementById('content-area'));
    } else if (window.location.hash.includes('assignment-detail')) {
        const { renderAssignmentDetail } = await import('./assignments.js?v=2012');
        renderAssignmentDetail(document.getElementById('content-area'));
    }
}

window.closeCollabServiceDetail = () => document.getElementById('collab-service-detail-modal')?.classList.remove('active');
window.closeCollabServiceEdit = () => document.getElementById('collab-service-edit-modal')?.classList.remove('active');
