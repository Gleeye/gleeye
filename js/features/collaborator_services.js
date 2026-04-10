import { state } from '/js/modules/state.js';
import { formatAmount } from '../modules/utils.js?v=1000';
import { upsertCollaboratorService, deleteCollaboratorService } from '../modules/api.js';
import { CustomSelect } from '../components/CustomSelect.js';

export function renderCollaboratorServices(container) {
    const render = () => {
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

    window.setCollabServicesYear = (year) => {
        state.collaboratorServicesYear = year;
        container.innerHTML = render();
    };
}

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
                <div class="modal-content" style="max-width: 580px; padding: 0; background: var(--card-bg); border-radius: 16px; overflow: hidden; border: 1px solid var(--glass-border); box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                    <div class="modal-header" style="padding: 0.75rem 1.25rem; background: var(--bg-color); border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; margin-bottom: 0;">
                        <div style="display: flex; align-items: center; gap: 0.6rem;">
                            <div style="width: 32px; height: 32px; border-radius: 8px; background: var(--brand-gradient); display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(var(--brand-blue-rgb), 0.2);">
                                <span class="material-icons-round" style="color: white; font-size: 1.1rem;">edit_note</span>
                            </div>
                            <h2 id="cs-edit-title" style="margin: 0; font-family: var(--font-titles); font-weight: 700; font-size: 1.1rem; color: var(--text-primary);">Aggiungi Servizio</h2>
                        </div>
                        <button class="close-modal material-icons-round" onclick="closeCollabServiceEdit()" style="position: static; color: var(--text-secondary);">close</button>
                    </div>
                    <form id="collab-service-edit-form" style="padding: 1.5rem;">
                        <input type="hidden" id="cs-id">
                        <input type="hidden" id="cs-order-id">
                        <input type="hidden" id="cs-assignment-id">
                        
                        <div style="grid-template-columns: 1fr 1fr; display: grid; gap: 1rem; margin-bottom: 1rem;">
                            <div class="form-group">
                                <label>Reparto</label>
                                <select id="cs-dept" class="modal-input" onchange="window.csOnDeptChange()">
                                    <option value="">Seleziona...</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label>Tipo Tariffa</label>
                                <select id="cs-tariff-type" class="modal-input">
                                    <option value="tariffa oraria">Tariffa Oraria (Hr)</option>
                                    <option value="tariffa mensile">Tariffa Mensile (M)</option>
                                    <option value="tariffa annuale">Tariffa Annuale (Y)</option>
                                    <option value="tariffa spot">Tariffa Spot</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label>Servizio a Catalogo (Tariffario)</label>
                            <select id="cs-service-id-ref" class="modal-input" onchange="window.csOnServiceChange()">
                                <option value="">Seleziona un reparto prima...</option>
                            </select>
                        </div>

                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label>Nome Visualizzato (Override)</label>
                            <input type="text" id="cs-name" placeholder="Nome del servizio..." style="width: 100%; padding: 0.6rem 1rem; background: var(--bg-secondary); border: 1px solid var(--glass-border); border-radius: 10px; color: var(--text-primary); font-size: 0.9rem;">
                        </div>

                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label>Collaboratore Assegnato</label>
                            <select id="cs-collaborator" class="modal-input">
                                <option value="">Seleziona...</option>
                            </select>
                        </div>

                        <div style="grid-template-columns: 1fr 1fr 1fr; display: grid; gap: 1rem; margin-bottom: 1.5rem;">
                            <div class="form-group">
                                <label id="cs-qty-label">Quantità</label>
                                <input type="number" id="cs-quantity" step="0.5" value="1" style="width: 100%; padding: 0.6rem 1rem; background: var(--bg-secondary); border: 1px solid var(--glass-border); border-radius: 10px;">
                            </div>
                            <div class="form-group">
                                <label>Costo Un.</label>
                                <input type="number" id="cs-unit-cost" step="0.01" value="0" style="width: 100%; padding: 0.6rem 1rem; background: var(--bg-secondary); border: 1px solid var(--glass-border); border-radius: 10px;">
                            </div>
                            <div class="form-group">
                                <label>Prezzo Un.</label>
                                <input type="number" id="cs-unit-price" step="0.01" value="0" style="width: 100%; padding: 0.6rem 1rem; background: var(--bg-secondary); border: 1px solid var(--glass-border); border-radius: 10px;">
                            </div>
                        </div>

                        <div style="background: rgba(var(--brand-blue-rgb), 0.05); border-radius: 12px; padding: 1rem; display: flex; justify-content: space-around; margin-bottom: 1.5rem; border: 1px solid rgba(var(--brand-blue-rgb), 0.1);">
                            <div style="text-align: center;">
                                <div style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">Costo Totale</div>
                                <div id="cs-total-cost-preview" style="font-weight: 700; color: var(--error-color); font-size: 1.1rem;">0.00 €</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">Prezzo Totale</div>
                                <div id="cs-total-price-preview" style="font-weight: 700; color: var(--success-color); font-size: 1.1rem;">0.00 €</div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                            <button type="button" id="cs-delete-btn" class="primary-btn secondary danger" onclick="window.deleteCollabService()" style="display: none;">
                                <span class="material-icons-round">delete</span>
                            </button>
                            <button type="button" class="primary-btn secondary" onclick="closeCollabServiceEdit()">Annulla</button>
                            <button type="submit" class="primary-btn" style="flex: 1;">Salva Servizio</button>
                        </div>
                    </form>
                </div>
            </div>
        `);

        // Submit logic
        const form = document.getElementById('collab-service-edit-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const tariffType = document.getElementById('cs-tariff-type').value;
                const q = parseFloat(document.getElementById('cs-quantity').value) || 0;
                const cost = parseFloat(document.getElementById('cs-unit-cost').value) || 0;
                const price = parseFloat(document.getElementById('cs-unit-price').value) || 0;

                const qtyFields = {
                    quantity: q,
                    hours: (tariffType === 'tariffa oraria') ? q : null,
                    months: (tariffType === 'tariffa mensile' || tariffType === 'tariffa annuale') ? q : null,
                    spot_quantity: (tariffType === 'tariffa spot') ? q : null,
                };

                const formData = {
                    id: document.getElementById('cs-id').value || undefined,
                    order_id: document.getElementById('cs-order-id').value || null,
                    assignment_id: document.getElementById('cs-assignment-id').value || null,
                    name: document.getElementById('cs-name').value,
                    service_id: document.getElementById('cs-service-id-ref').value || null,
                    department: document.getElementById('cs-dept').value,
                    tariff_type: tariffType,
                    collaborator_id: document.getElementById('cs-collaborator').value || null,
                    ...qtyFields,
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
            });
        }

        ['cs-quantity', 'cs-unit-cost', 'cs-unit-price'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    const q = parseFloat(document.getElementById('cs-quantity').value) || 0;
                    const c = parseFloat(document.getElementById('cs-unit-cost').value) || 0;
                    const p = parseFloat(document.getElementById('cs-unit-price').value) || 0;
                    const costText = document.getElementById('cs-total-cost-preview');
                    const priceText = document.getElementById('cs-total-price-preview');
                    if (costText) costText.textContent = formatAmount(q * c) + ' €';
                    if (priceText) priceText.textContent = formatAmount(q * p) + ' €';
                });
            }
        });
    }

    // Helper Window Functions for Logic
    window.csOnDeptChange = () => {
        const dept = document.getElementById('cs-dept').value;
        const selector = document.getElementById('cs-service-id-ref');
        const collabSelector = document.getElementById('cs-collaborator');
        
        // Update Services
        const filteredServices = state.services.filter(s => !dept || s.department === dept);
        selector.innerHTML = '<option value="">' + (dept ? 'Seleziona un servizio...' : 'Seleziona un reparto prima...') + '</option>' +
            filteredServices.map(s => `<option value="${s.id}" data-type="${s.type || 'tariffa spot'}" data-cost="${s.unit_cost || 0}" data-price="${s.unit_price || 0}">${s.name}</option>`).join('');
        
        // Update Collaborators
        const filteredCollabs = state.collaborators.filter(c => !dept || c.department === dept);
        collabSelector.innerHTML = '<option value="">Seleziona...</option>' +
            filteredCollabs.map(c => `<option value="${c.id}">${c.full_name}</option>`).join('');

        // Refresh CustomSelects
        window.csSelectInstances?.['cs-service-id-ref']?.refresh();
        window.csSelectInstances?.['cs-collaborator']?.refresh();
    };

    window.csOnServiceChange = () => {
        const selector = document.getElementById('cs-service-id-ref');
        const option = selector.selectedOptions[0];
        if (!option || !option.value) return;

        const type = option.getAttribute('data-type');
        const cost = parseFloat(option.getAttribute('data-cost')) || 0;
        const price = parseFloat(option.getAttribute('data-price')) || 0;
        const name = option.text;

        document.getElementById('cs-tariff-type').value = type;
        document.getElementById('cs-unit-cost').value = cost;
        document.getElementById('cs-unit-price').value = price;
        document.getElementById('cs-name').value = name;

        // Label update
        const qtyLabel = document.getElementById('cs-qty-label');
        if (type === 'tariffa oraria') qtyLabel.textContent = 'Ore';
        else if (type === 'tariffa mensile') qtyLabel.textContent = 'Mesi';
        else qtyLabel.textContent = 'Quantità';

        // Refresh triggers and previews
        window.csSelectInstances?.['cs-tariff-type']?.refresh();
        document.getElementById('cs-quantity').dispatchEvent(new Event('input'));
    };
}

export const openCollaboratorServiceEdit = async (id = null, prefillOrderId = null, prefillAssignmentId = null) => {
    window.openCollaboratorServiceEdit = openCollaboratorServiceEdit;
    window.closeCollabServiceDetail?.(); 
    
    const modal = document.getElementById('collab-service-edit-modal');
    const form = document.getElementById('collab-service-edit-form');
    if (!form || !modal) return;
    form.reset();

    // Data bootstrap
    if (!state.departments || !state.services || !state.collaborators) {
        const { fetchServices, fetchDepartments, fetchCollaborators } = await import('../modules/api.js?v=1000');
        await Promise.all([fetchServices(), fetchDepartments(), fetchCollaborators()]);
    }

    // Populate Depts Native
    const deptSelect = document.getElementById('cs-dept');
    const depts = state.departments || [];
    deptSelect.innerHTML = '<option value="">Seleziona...</option>' + depts.map(d => `<option value="${d.name}">${d.name}</option>`).join('');

    // Initialize/Re-init CustomSelects
    if (!window.csSelectInstances) window.csSelectInstances = {};
    ['cs-dept', 'cs-tariff-type', 'cs-service-id-ref', 'cs-collaborator'].forEach(sid => {
        const el = document.getElementById(sid);
        if (el) {
            if (!window.csSelectInstances[sid]) window.csSelectInstances[sid] = new CustomSelect(el);
            else window.csSelectInstances[sid].refresh();
        }
    });

    if (id) {
        document.getElementById('cs-edit-title').textContent = 'Modifica Servizio';
        document.getElementById('cs-delete-btn').style.display = 'block';
        const s = state.collaboratorServices.find(x => x.id === id);
        if (s) {
            document.getElementById('cs-id').value = s.id;
            document.getElementById('cs-order-id').value = s.order_id || '';
            document.getElementById('cs-assignment-id').value = s.assignment_id || '';
            
            // Set Dept first
            document.getElementById('cs-dept').value = s.department || '';
            window.csSelectInstances['cs-dept'].refresh();
            
            // Cascade update lists
            window.csOnDeptChange();
            
            // Set values
            document.getElementById('cs-service-id-ref').value = s.service_id || '';
            document.getElementById('cs-tariff-type').value = s.tariff_type || 'tariffa oraria';
            document.getElementById('cs-collaborator').value = s.collaborator_id || '';
            document.getElementById('cs-name').value = s.name || '';
            
            const qty = s.hours || s.months || s.spot_quantity || s.quantity || 0;
            document.getElementById('cs-quantity').value = qty;
            document.getElementById('cs-unit-cost').value = s.unit_cost || 0;
            document.getElementById('cs-unit-price').value = s.unit_price || 0;

            // Refresh visuals
            Object.values(window.csSelectInstances).forEach(inst => inst.refresh());
            document.getElementById('cs-quantity').dispatchEvent(new Event('input'));
        }
    } else {
        document.getElementById('cs-edit-title').textContent = 'Aggiungi Servizio';
        document.getElementById('cs-id').value = '';
        document.getElementById('cs-delete-btn').style.display = 'none';
        document.getElementById('cs-order-id').value = prefillOrderId || '';
        document.getElementById('cs-assignment-id').value = prefillAssignmentId || '';

        // If prefillAssignmentId, auto-select collaborator and dept
        if (prefillAssignmentId) {
            const asg = state.assignments?.find(a => a.id === prefillAssignmentId);
            if (asg) {
                const collab = state.collaborators?.find(c => c.id === asg.collaborator_id);
                if (collab) {
                    document.getElementById('cs-dept').value = collab.department || '';
                    window.csSelectInstances['cs-dept'].refresh();
                    window.csOnDeptChange();
                    document.getElementById('cs-collaborator').value = asg.collaborator_id;
                    window.csSelectInstances['cs-collaborator'].refresh();
                }
            }
        } else {
            window.csOnDeptChange(); // Initial empty state
        }
        
        document.getElementById('cs-total-cost-preview').textContent = '0.00 €';
        document.getElementById('cs-total-price-preview').textContent = '0.00 €';
    }
    modal.classList.add('active');
};

export const confirmDeleteCollabService = async (id) => {
    window.confirmDeleteCollabService = confirmDeleteCollabService;
    if (await window.showConfirm("Sei sicuro?", { type: 'danger' })) {
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
    if (state.currentPage === 'collaborator-services') {
        const { fetchCollaboratorServices } = await import('../modules/api.js?v=1000');
        await fetchCollaboratorServices();
        renderCollaboratorServices(document.getElementById('content-area'));
        return;
    }
    const hash = window.location.hash;
    if (hash.includes('order-detail')) {
        const orderId = hash.split('/').pop();
        const { fetchCollaboratorServices, fetchAssignments } = await import('../modules/api.js?v=1000');
        const { renderOrderDetail } = await import('./orders.js?v=1000');
        await Promise.all([fetchCollaboratorServices(), fetchAssignments()]);
        renderOrderDetail(document.getElementById('content-area'), orderId);
    }
    if (hash.includes('assignment-detail')) {
        const { fetchCollaboratorServices, fetchAssignments } = await import('../modules/api.js?v=1000');
        const { renderAssignmentDetail } = await import('./assignments.js?v=1000');
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
        window.showAlert("Nessun incarico trovato.", 'warning');
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
            <h2 style="margin-bottom: 0.5rem;">${serviceName}</h2>
            <div class="badge" style="background: var(--bg-secondary); font-size: 0.9rem;">${s.collaborators?.full_name || 'Non assegnato'}</div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
            <div><label>Quantità</label><div>${qty}</div></div>
            <div><label>Tariffa</label><div>${s.tariff_type || '-'}</div></div>
            <div><label>Costo Totale</label><div class="error">${formatAmount(s.total_cost)} €</div></div>
            <div><label>Prezzo Totale</label><div class="success">${formatAmount(s.total_price)} €</div></div>
        </div>
        <div class="form-actions" style="justify-content: flex-end; gap: 0.5rem;">
            <button class="primary-btn secondary danger" onclick="window.confirmDeleteCollabService('${s.id}')">Elimina</button>
            <button class="primary-btn secondary" onclick="window.goToAssignment('${s.order_id}', '${s.collaborator_id}')">Vedi Incarico</button>
            <button class="primary-btn" onclick="window.openCollaboratorServiceEdit('${s.id}')">Modifica</button>
        </div>
    `;
    document.getElementById('collab-service-detail-modal').classList.add('active');
};
