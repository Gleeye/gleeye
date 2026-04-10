import { state } from '/js/modules/state.js';
import { formatAmount } from '../modules/utils.js?v=1000';
import { upsertCollaboratorService, deleteCollaboratorService } from '../modules/api.js';
import { CustomSelect } from '../components/CustomSelect.js';

/**
 * Collaborator Services Feature
 * Manages the "Registro Servizi Collaboratori" and provide modals 
 * for adding/editing services linked to assignments/orders.
 */

export function renderCollaboratorServices(container) {
    const render = () => {
        // standalone page rendering logic...
        const availableYears = [...new Set(state.collaboratorServices.map(s => {
            if (s.legacy_order_id && s.legacy_order_id.match(/^\d{2}/)) {
                return 2000 + parseInt(s.legacy_order_id.substring(0, 2));
            }
            if (s.created_at) return new Date(s.created_at).getFullYear();
            return new Date().getFullYear();
        }))].sort((a,b) => b-a);

        if (!state.collaboratorServicesYear) state.collaboratorServicesYear = availableYears[0] || new Date().getFullYear();

        const filtered = state.collaboratorServices.filter(s => {
            let sYear;
            if (s.legacy_order_id && s.legacy_order_id.match(/^\d{2}/)) {
                sYear = 2000 + parseInt(s.legacy_order_id.substring(0, 2));
            } else if (s.created_at) {
                sYear = new Date(s.created_at).getFullYear();
            } else {
                sYear = new Date().getFullYear();
            }
            return sYear === state.collaboratorServicesYear;
        }).sort((a, b) => (b.legacy_order_id || '').localeCompare(a.legacy_order_id || ''));

        const totalCost = filtered.reduce((sum, s) => sum + (s.total_cost || 0), 0);
        const totalPrice = filtered.reduce((sum, s) => sum + (s.total_price || 0), 0);
        const margin = totalPrice - totalCost;
        const marginPerc = totalPrice > 0 ? (margin / totalPrice) * 100 : 0;

        return `
            <div class="feature-header">
                <div class="header-content">
                    <h1>Registro Servizi Collaboratori</h1>
                    <p>Panoramica economica e operativa dei servizi assegnati</p>
                </div>
                <div class="header-actions">
                    <div class="year-selector" style="display: flex; gap: 0.5rem; background: var(--card-bg); padding: 0.5rem; border-radius: 12px; border: 1px solid var(--glass-border);">
                        ${availableYears.map(y => `
                            <button class="year-btn ${y === state.collaboratorServicesYear ? 'active' : ''}" 
                                    onclick="setCollabServicesYear(${y})"
                                    style="padding: 0.4rem 1rem; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; font-size: 0.85rem; transition: all 0.2s;
                                           background: ${y === state.collaboratorServicesYear ? 'var(--brand-gradient)' : 'transparent'};
                                           color: ${y === state.collaboratorServicesYear ? 'white' : 'var(--text-secondary)'};">
                                ${y}
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 2rem;">
                <div class="stat-card">
                    <div class="stat-label">Costo Totale</div>
                    <div class="stat-value error">${formatAmount(totalCost)} €</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Prezzo Totale</div>
                    <div class="stat-value success">${formatAmount(totalPrice)} €</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Margine Lordo</div>
                    <div class="stat-value" style="color: ${margin >= 0 ? 'var(--success-color)' : 'var(--error-color)'}">${formatAmount(margin)} €</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">% Margine</div>
                    <div class="stat-value">${marginPerc.toFixed(1)}%</div>
                </div>
            </div>

            <div class="card glass">
                <div class="table-container">
                    <table class="modern-table">
                        <thead>
                            <tr>
                                <th>Ordine</th>
                                <th>Servizio</th>
                                <th>Reparto</th>
                                <th>Collaboratore</th>
                                <th class="text-right">Q.tà</th>
                                <th class="text-right">Costo Tot.</th>
                                <th class="text-right">Prezzo Tot.</th>
                                <th class="text-center">Azioni</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.map(s => {
                                const serviceName = s.services?.name || s.legacy_service_name || s.name;
                                const collabName = s.collaborators?.full_name || s.legacy_collaborator_name || 'Non assegnato';
                                const qty = s.hours || s.months || s.spot_quantity || s.quantity || 0;
                                return `
                                    <tr>
                                        <td style="font-weight: 700; color: var(--brand-blue);">${s.legacy_order_id || '-'}</td>
                                        <td>
                                            <div style="font-weight: 600;">${serviceName}</div>
                                            <div style="font-size: 0.75rem; color: var(--text-tertiary);">${s.name}</div>
                                        </td>
                                        <td><span class="badge" style="background: rgba(var(--brand-blue-rgb), 0.1); color: var(--brand-blue); border: none;">${s.department || '-'}</span></td>
                                        <td>${collabName}</td>
                                        <td class="text-right">${qty}</td>
                                        <td class="text-right" style="color: var(--error-color);">${formatAmount(s.total_cost)} €</td>
                                        <td class="text-right" style="color: var(--success-color); font-weight: 600;">${formatAmount(s.total_price)} €</td>
                                        <td class="text-center">
                                            <button class="icon-btn" onclick="openCollaboratorServiceDetail('${s.id}')">
                                                <span class="material-icons-round">visibility</span>
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    };

    container.innerHTML = render();
}

/**
 * GLOBAL FUNCTIONS for Modal logic (accessible from HTML onchange/onclick)
 */

window.csOnDeptChange = () => {
    const dept = document.getElementById('cs-dept').value;
    const selector = document.getElementById('cs-service-id-ref');
    const collabSelector = document.getElementById('cs-collaborator');
    
    if (!selector || !collabSelector) return;

    // 1. Update Services Filter (same logic as orders.js)
    const allServices = state.services || [];
    const filteredServices = allServices.filter(s => !dept || s.department === dept);
    
    selector.innerHTML = '<option value="">' + (dept ? 'Seleziona un servizio...' : 'Seleziona un reparto prima...') + '</option>' +
        filteredServices.map(s => `<option value="${s.id}" data-type="${s.type || 'tariffa spot'}" data-cost="${s.unit_cost || 0}" data-price="${s.unit_price || 0}">${s.name}</option>`).join('');
    
    // 2. Update Collaborators Filter
    const allCollabs = state.collaborators || [];
    const filteredCollabs = allCollabs.filter(c => !dept || c.department === dept);
    collabSelector.innerHTML = '<option value="">Seleziona...</option>' +
        filteredCollabs.map(c => `<option value="${c.id}">${c.full_name}</option>`).join('');

    // 3. Refresh CustomSelects
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

    // Lock Tariff Type (read only)
    document.getElementById('cs-tariff-type').value = type;
    document.getElementById('cs-tariff-display').textContent = type.replace('tariffa ', '').toUpperCase();
    
    // Auto-fill defaults
    document.getElementById('cs-unit_cost').value = cost;
    document.getElementById('cs-unit_price').value = price;
    document.getElementById('cs-name').value = name;

    // Update Quantity Label
    const qtyLabel = document.getElementById('cs-qty-label');
    if (qtyLabel) {
        if (type === 'tariffa oraria') qtyLabel.textContent = 'Ore';
        else if (type === 'tariffa mensile') qtyLabel.textContent = 'Mesi';
        else qtyLabel.textContent = 'Quantità';
    }

    // Trigger calculation
    document.getElementById('cs-quantity').dispatchEvent(new Event('input'));
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
                <div class="modal-content" style="max-width: 600px; padding: 0; background: var(--card-bg); border-radius: 16px; overflow: hidden; border: 1px solid var(--glass-border); box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
                    <div class="modal-header" style="padding: 1rem 1.5rem; background: var(--bg-color); border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; margin-bottom: 0;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="width: 36px; height: 36px; border-radius: 10px; background: var(--brand-gradient); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(var(--brand-blue-rgb), 0.25);">
                                <span class="material-icons-round" style="color: white; font-size: 1.25rem;">playlist_add</span>
                            </div>
                            <div>
                                <h2 id="cs-edit-title" style="margin: 0; font-family: var(--font-titles); font-weight: 700; font-size: 1.15rem; color: var(--text-primary);">Aggiungi Servizio</h2>
                                <p style="margin: 0; font-size: 0.75rem; color: var(--text-tertiary);">Servizio tecnico/operativo da tariffario</p>
                            </div>
                        </div>
                        <button class="close-modal material-icons-round" onclick="closeCollabServiceEdit()" style="position: static; color: var(--text-tertiary); background: none; border: none; cursor: pointer;">close</button>
                    </div>
                    
                    <form id="collab-service-edit-form" style="padding: 1.5rem;">
                        <input type="hidden" id="cs-id">
                        <input type="hidden" id="cs-order-id">
                        <input type="hidden" id="cs-assignment-id">
                        <input type="hidden" id="cs-tariff-type">
                        
                        <!-- Block 1: Context -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
                            <div class="form-group">
                                <label style="display: block; font-size: 0.7rem; font-weight: 700; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Reparto</label>
                                <select id="cs-dept" class="modal-input" style="width: 100%;" onchange="window.csOnDeptChange()">
                                    <option value="">Seleziona...</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label style="display: block; font-size: 0.7rem; font-weight: 700; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Tipo Tariffa</label>
                                <div id="cs-tariff-display" style="padding: 0.65rem 1rem; background: var(--bg-secondary); border: 1px solid var(--glass-border); border-radius: 10px; font-weight: 600; color: var(--brand-blue); font-size: 0.9rem;">-</div>
                            </div>
                        </div>

                        <!-- Block 2: Service Selection -->
                        <div class="form-group" style="margin-bottom: 1.25rem;">
                            <label style="display: block; font-size: 0.7rem; font-weight: 700; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Servizio a Catalogo (Tariffario)</label>
                            <select id="cs-service-id-ref" class="modal-input" style="width: 100%;" onchange="window.csOnServiceChange()">
                                <option value="">Seleziona un reparto prima...</option>
                            </select>
                        </div>

                        <div class="form-group" style="margin-bottom: 1.25rem;">
                            <label style="display: block; font-size: 0.7rem; font-weight: 700; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Nome Visualizzato (Override)</label>
                            <input type="text" id="cs-name" class="modal-input" placeholder="Esempio: Allestimento Set..." style="width: 100%;">
                        </div>

                        <!-- Block 3: Assignment -->
                        <div class="form-group" style="margin-bottom: 1.25rem;" id="cs-collaborator-field">
                            <label style="display: block; font-size: 0.7rem; font-weight: 700; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Collaboratore Assegnato</label>
                            <select id="cs-collaborator" class="modal-input" style="width: 100%;">
                                <option value="">Seleziona...</option>
                            </select>
                        </div>

                        <!-- Block 4: Economics -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-secondary); border-radius: 12px; border: 1px solid var(--glass-border);">
                            <div class="form-group">
                                <label id="cs-qty-label" style="display: block; font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Quantità</label>
                                <input type="number" id="cs-quantity" class="modal-input" value="1" step="0.5" min="0" style="width: 100%;">
                            </div>
                            <div class="form-group">
                                <label style="display: block; font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Costo Unit.</label>
                                <input type="number" id="cs-unit_cost" class="modal-input" value="0" step="0.01" style="width: 100%;">
                            </div>
                            <div class="form-group">
                                <label style="display: block; font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Prezzo Unit.</label>
                                <input type="number" id="cs-unit_price" class="modal-input" value="0" step="0.01" style="width: 100%;">
                            </div>
                        </div>

                        <!-- Totals Preview -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; padding: 0 1rem;">
                            <div style="text-align: left;">
                                <div style="font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.2rem;">Costo Totale</div>
                                <div id="cs-total-cost-display" style="font-weight: 800; color: #ef4444; font-size: 1.25rem;">€ 0,00</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.2rem;">Prezzo Totale</div>
                                <div id="cs-total-price-display" style="font-weight: 800; color: #22c55e; font-size: 1.25rem;">€ 0,00</div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
                            <button type="button" id="cs-delete-btn" class="primary-btn secondary danger" onclick="window.deleteCollabService()" style="display: none; padding: 0.6rem 1rem;">
                                <span class="material-icons-round">delete</span>
                            </button>
                            <button type="button" class="primary-btn secondary" onclick="closeCollabServiceEdit()" style="flex: 1; padding: 0.75rem;">Annulla</button>
                            <button type="submit" class="primary-btn" style="flex: 2; padding: 0.75rem; font-weight: 700;">Salva Servizio</button>
                        </div>
                    </form>
                </div>
            </div>
        `);

        // Preview Calculations
        ['cs-quantity', 'cs-unit_cost', 'cs-unit_price'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    const q = parseFloat(document.getElementById('cs-quantity').value) || 0;
                    const c = parseFloat(document.getElementById('cs-unit_cost').value) || 0;
                    const p = parseFloat(document.getElementById('cs-unit_price').value) || 0;
                    
                    document.getElementById('cs-total-cost-display').textContent = '€ ' + formatAmount(q * c);
                    document.getElementById('cs-total-price-display').textContent = '€ ' + formatAmount(q * p);
                });
            }
        });
    }
}

/**
 * OPENS MODAL (Logic Entry Point)
 */
export const openCollaboratorServiceEdit = async (id = null, prefillOrderId = null, prefillAssignmentId = null) => {
    window.openCollaboratorServiceEdit = openCollaboratorServiceEdit;
    window.closeCollabServiceDetail?.(); 
    
    const modal = document.getElementById('collab-service-edit-modal');
    const form = document.getElementById('collab-service-edit-form');
    if (!form || !modal) return;
    form.reset();

    // Data bootstrap (Ensure critical data is present)
    const { fetchServices, fetchDepartments, fetchCollaborators } = await import('../modules/api.js?v=2010');
    if (!state.departments || state.departments.length === 0 || !state.services || !state.collaborators) {
        await Promise.all([fetchServices(), fetchDepartments(), fetchCollaborators()]);
    }

    // 1. Initial UI Setup
    const deptSelect = document.getElementById('cs-dept');
    const depts = state.departments || [];
    deptSelect.innerHTML = '<option value="">Seleziona...</option>' + depts.map(d => `<option value="${d.name}">${d.name}</option>`).join('');

    // Native initialization of selects with CustomSelect
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
            document.getElementById('cs-name').value = s.name || '';
            document.getElementById('cs-tariff-type').value = s.tariff_type || 'tariffa oraria';
            document.getElementById('cs-tariff-display').textContent = (s.tariff_type || 'Hr').replace('tariffa ', '').toUpperCase();
            
            const qty = s.hours || s.months || s.spot_quantity || s.quantity || 0;
            document.getElementById('cs-quantity').value = qty;
            document.getElementById('cs-unit_cost').value = s.unit_cost || 0;
            document.getElementById('cs-unit_price').value = s.unit_price || 0;

            Object.values(window.csSelectInstances).forEach(inst => inst.refresh());
            document.getElementById('cs-quantity').dispatchEvent(new Event('input'));
        }
    } else {
        // --- ADD MODE ---
        document.getElementById('cs-edit-title').textContent = 'Aggiungi Servizio';
        document.getElementById('cs-id').value = '';
        document.getElementById('cs-delete-btn').style.display = 'none';
        document.getElementById('cs-order-id').value = prefillOrderId || '';
        document.getElementById('cs-assignment-id').value = prefillAssignmentId || '';
        document.getElementById('cs-tariff-display').textContent = '-';

        if (prefillAssignmentId) {
            // Assignment Context: Lock Collaborator and Reparto
            const asg = state.assignments?.find(a => a.id === prefillAssignmentId);
            const collab = state.collaborators?.find(c => c.id === asg?.collaborator_id);
            if (collab) {
                document.getElementById('cs-dept').value = collab.department || '';
                window.csOnDeptChange();
                document.getElementById('cs-collaborator').value = collab.id;
                // Hide or disable fields that are fixed by context
                // (optional visual cue, user wanted it simple)
            }
        } else {
            window.csOnDeptChange(); 
        }
        
        Object.values(window.csSelectInstances).forEach(inst => inst.refresh());
        document.getElementById('cs-total-cost-display').textContent = '€ 0,00';
        document.getElementById('cs-total-price-display').textContent = '€ 0,00';
    }

    // FORM SUBMISSION
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
            name: document.getElementById('cs-name').value,
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
            window.showAlert('Errore salvataggio: ' + err.message, 'error');
        }
    };

    modal.classList.add('active');
};

export const confirmDeleteCollabService = async (id) => {
    window.confirmDeleteCollabService = confirmDeleteCollabService;
    if (await window.showConfirm("Eliminare questo servizio permanentemente?", { type: 'danger' })) {
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
    const { fetchCollaboratorServices, fetchAssignments } = await import('../modules/api.js?v=2010');
    
    if (state.currentPage === 'collaborator-services') {
        await fetchCollaboratorServices();
        renderCollaboratorServices(document.getElementById('content-area'));
        return;
    }
    
    const hash = window.location.hash;
    if (hash.includes('order-detail')) {
        const orderId = hash.split('/').pop();
        const { renderOrderDetail } = await import('./orders.js?v=2010');
        await Promise.all([fetchCollaboratorServices(), fetchAssignments()]);
        renderOrderDetail(document.getElementById('content-area'), orderId);
    }
    if (hash.includes('assignment-detail')) {
        const { renderAssignmentDetail } = await import('./assignments.js?v=2010');
        await Promise.all([fetchCollaboratorServices(), fetchAssignments()]);
        renderAssignmentDetail(document.getElementById('content-area'));
    }
}

window.goToAssignment = (orderId, collabId) => {
    const assignment = state.assignments.find(a => a.order_id === orderId && a.collaborator_id === collabId);
    if (assignment) {
        window.location.hash = `#assignment-detail/${assignment.id}`;
        window.closeCollabServiceDetail?.();
    } else {
        window.showAlert("Incarico non trovato.", 'warning');
    }
};

window.closeCollabServiceDetail = () => document.getElementById('collab-service-detail-modal')?.classList.remove('active');
window.closeCollabServiceEdit = () => document.getElementById('collab-service-edit-modal')?.classList.remove('active');

window.openCollaboratorServiceDetail = (id) => {
    const s = state.collaboratorServices.find(x => x.id === id);
    if (!s) return;
    const content = document.getElementById('collab-service-detail-content');
    const serviceName = s.services?.name || s.legacy_service_name || s.name;
    const qty = s.hours || s.months || s.spot_quantity || s.quantity || 0;
    
    content.innerHTML = `
        <div style="text-align: center; margin-bottom: 1.5rem;">
            <h2 style="margin-bottom: 0.5rem; font-family: var(--font-titles);">${serviceName}</h2>
            <div class="badge" style="background: var(--bg-secondary); font-size: 0.9rem;">${s.collaborators?.full_name || 'Non assegnato'}</div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
            <div><label class="text-caption">Quantità</label><div style="font-weight:600;">${qty}</div></div>
            <div><label class="text-caption">Tariffa</label><div style="font-weight:600;">${s.tariff_type || '-'}</div></div>
            <div><label class="text-caption">Costo Totale</label><div style="font-weight:700; color: #ef4444;">${formatAmount(s.total_cost)} €</div></div>
            <div><label class="text-caption">Prezzo Totale</label><div style="font-weight:700; color: #22c55e;">${formatAmount(s.total_price)} €</div></div>
        </div>
        <div class="form-actions" style="justify-content: flex-end; gap: 0.5rem;">
            <button class="primary-btn secondary danger" onclick="window.confirmDeleteCollabService('${s.id}')">Elimina</button>
            <button class="primary-btn secondary" onclick="window.goToAssignment('${s.order_id}', '${s.collaborator_id}')">Vedi Incarico</button>
            <button class="primary-btn" onclick="window.openCollaboratorServiceEdit('${s.id}')">Modifica</button>
        </div>
    `;
    document.getElementById('collab-service-detail-modal').classList.add('active');
};
