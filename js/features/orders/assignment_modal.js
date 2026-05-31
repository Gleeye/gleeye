// Assignment modal — multi-step wizard to attach a collaborator + services to an order.
// Extracted from orders.js. Side effects on import:
//   - window.openAddAssignmentModal(orderId)
//   - window.asgNextStep / asgPrevStep / updateAsgStepUI
//   - window.filterAssignmentCollaborators / selectAssignmentCollaborator / clearAssignmentCollaborator
//   - window.loadCollaboratorServicesForAssignment / onAssignmentServiceSelect
//   - window.addServiceToAssignmentList / renderSelectedServicesList / removeServiceFromAssignmentList
//   - window.formatMoney
//   - window.saveAssignmentMultiStep + alias window.saveAssignment
//
// Public exports:
//   - initOrderAssignmentModal()
//
// Internal dynamic imports were patched: paths shifted from '../modules/' to '../../modules/'
// after the move into js/features/orders/. The renderOrderDetail circular call was
// replaced with a hash-route refresh.

import { state } from '/js/modules/state.js?v=8000';
import { supabase } from '../../modules/config.js?v=8000';
import { formatAmount, showGlobalAlert, showConfirm, renderAvatar } from '../../modules/utils.js?v=8000';
import { upsertAssignment, upsertCollaboratorService, fetchCollaboratorServices, fetchAssignments, upsertPayment, deletePayment, fetchPayments, fetchOrders, fetchCollaborators, fetchServices } from '../../modules/api.js?v=8000';
import { CustomSelect } from '../../components/CustomSelect.js?v=8000';
import { getCollaboratorServiceRate, rateSourceLabel } from '../../modules/collab_rate.js?v=8000';

export function initOrderAssignmentModal() {
    // Force remove existing modal to ensure latest HTML/JS functionality is applied
    const existing = document.getElementById('add-assignment-modal');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', `
        <div id="add-assignment-modal" class="modal">
            <div class="modal-content" style="max-width: 650px; padding: 2rem;">
                <!-- Header -->
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(59, 130, 246, 0.1); display: flex; align-items: center; justify-content: center;">
                            <span class="material-icons-round" style="color: var(--brand-blue);">add_task</span>
                        </div>
                        <div>
                            <h2 style="margin: 0; font-family: var(--font-titles); font-weight: 700;">Nuovo Incarico</h2>
                            <p id="asg-step-indicator" style="margin: 0; font-size: 0.8rem; color: var(--text-tertiary);">Step 1 di 3</p>
                        </div>
                    </div>
                    <button class="icon-btn" onclick="document.getElementById('add-assignment-modal').classList.remove('active')">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>

                <!-- Steps Container -->
                <div id="asg-steps-container">
                    
                    <!-- STEP 1: Collaborator -->
                    <div id="asg-step-1" class="asg-step">
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform: uppercase;">Seleziona Collaboratore</label>
                        <div style="position: relative;">
                            <span class="material-icons-round" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); pointer-events: none;">search</span>
                            <input type="text" id="asg-collab-search" class="modal-input" placeholder="Cerca collaboratore..." style="width: 100%; padding-left: 3rem;" 
                                oninput="window.filterAssignmentCollaborators()" 
                                onfocus="window.filterAssignmentCollaborators()" 
                                onclick="window.filterAssignmentCollaborators()">
                            <input type="hidden" id="asg-collab-id">
                        </div>
                        
                        <!-- Inline Error Message -->
                        <div id="asg-step1-error" style="display: none; color: #ef4444; font-size: 0.8rem; margin-top: 0.5rem; align-items: center; gap: 0.25rem;">
                            <span class="material-icons-round" style="font-size: 1rem;">error_outline</span>
                            <span>Seleziona un collaboratore dall'elenco per procedere</span>
                        </div>

                        <div id="asg-collab-list" style="margin-top: 0.5rem; max-height: 200px; overflow-y: auto; display: none; background: white; border: 1px solid var(--glass-border); border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"></div>
                        
                        <!-- Selected State -->
                        <div id="asg-collab-selected" style="margin-top: 1rem; display: none; align-items: center; gap: 0.75rem; padding: 1rem; background: rgba(59, 130, 246, 0.1); border-radius: 12px; border: 1px solid var(--brand-blue);">
                            <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--brand-blue); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600;">
                                <span id="asg-collab-avatar" class="material-icons-round" style="font-size: 1.2rem;">person</span>
                            </div>
                            <span id="asg-collab-name" style="font-weight: 600; font-size: 1rem; color: var(--text-primary);"></span>
                            <button onclick="window.clearAssignmentCollaborator()" style="margin-left: auto; background: none; border: none; cursor: pointer; color: var(--text-tertiary);"><span class="material-icons-round">close</span></button>
                        </div>
                    </div>


                    <!-- STEP 2: Services -->
                    <div id="asg-step-2" class="asg-step" style="display: none;">
                        <div style="margin-bottom: 1.5rem;">
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform: uppercase;">Aggiungi Servizio da Tariffario</label>
                            
                            <!-- Service Selection Row -->
                            <div style="display: flex; gap: 0.75rem; align-items: flex-end; margin-bottom: 0.75rem;">
                                <div style="flex: 2;">
                                    <label style="font-size: 0.7rem; color: var(--text-tertiary); margin-bottom: 0.25rem; display:block;">Servizio</label>
                                    <select id="asg-service-select" class="modal-input" style="width: 100%;" onchange="window.onAssignmentServiceSelect()">
                                        <option value="">Seleziona un servizio...</option>
                                    </select>
                                </div>
                                <div style="flex: 1;">
                                    <label id="asg-qty-label" style="font-size: 0.7rem; color: var(--text-tertiary); margin-bottom: 0.25rem; display:block;">Quantità</label>
                                    <input type="number" id="asg-service-qty" class="modal-input" style="width: 100%;" min="0" step="0.5" placeholder="0" disabled>
                                </div>
                                <div style="width: 100px;">
                                    <label style="font-size: 0.7rem; color: var(--text-tertiary); margin-bottom: 0.25rem; display:block;">Costo Totale</label>
                                    <div id="asg-service-total-display" style="padding: 0.6rem; background: var(--bg-secondary); border-radius: 8px; font-weight: 600; text-align: right; color: #ef4444;">€ 0,00</div>
                                </div>
                                <button class="primary-btn small" id="asg-add-service-btn" onclick="window.addServiceToAssignmentList()" disabled style="height: 42px; width: 42px; padding: 0; display: flex; align-items: center; justify-content: center;">
                                    <span class="material-icons-round">add</span>
                                </button>
                            </div>
                            <div id="asg-tariff-info" style="font-size: 0.75rem; color: var(--text-tertiary); padding: 0.5rem; background: rgba(59, 130, 246, 0.05); border-radius: 6px; display: none;"></div>
                            <div id="asg-rate-hint" style="font-size: 0.78rem; padding: 0.6rem 0.75rem; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 8px; margin-top: 0.5rem; display: none; align-items: center; justify-content: space-between; gap: 0.75rem;"></div>
                        </div>

                        <!-- Selected Services List -->
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform: uppercase;">Servizi Selezionati</label>
                        <div id="asg-services-list" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 200px; overflow-y: auto; min-height: 80px; background: var(--bg-secondary); border-radius: 10px; padding: 0.75rem;">
                            <!-- Populated dynamically -->
                            <div style="text-align: center; color: var(--text-tertiary); padding: 1rem; font-size: 0.85rem;">Nessun servizio selezionato</div>
                        </div>
                    </div>

                <!-- STEP 3: Details -->
                    <div id="asg-step-3" class="asg-step" style="display: none;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                            <div>
                                <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem;">DURATA (MESI)</label>
                                <input type="number" id="asg-duration" class="modal-input" style="width: 100%;" min="1" value="12">
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem;">STATO</label>
                                <select id="asg-status" class="modal-input" style="width: 100%;">
                                    <option value="Da Fare">Da Fare</option>
                                    <option value="In Corso">In Corso</option>
                                    <option value="Completato">Completato</option>
                                    <option value="Terminato">Terminato</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem;">IMPORTO TOTALE INCARICO (COSTO €)</label>
                            <input type="number" id="asg-amount" class="modal-input" style="width: 100%; font-size: 1.5rem; font-weight: 700; color: #ef4444;" placeholder="0.00">
                            <p style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.5rem;">L'importo è calcolato automaticamente in base ai <strong>costi interni</strong> dei servizi nel tariffario.</p>
                        </div>
                    </div>

                    <!-- STEP 4: Payment Config -->
                    <div id="asg-step-4" class="asg-step" style="display: none;">
                         <div style="background: white; border: 1px solid var(--glass-border); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem;">
                             <h3 style="margin-top:0; font-size: 1rem; color: var(--text-primary); margin-bottom: 1rem;">Configurazione Pagamenti</h3>
                             
                             <div style="flex-direction: column; gap: 1rem; display: flex;">
                                 <div>
                                    <label class="text-caption" style="margin-bottom: 0.5rem; display:block;">MODALITÀ PAGAMENTO</label>
                                    <select id="asg-payment-mode" class="modal-input" style="width: 100%;" onchange="window.asgUpdatePaymentFields()">
                                        <option value="saldo">Saldo alla chiusura del progetto</option>
                                        <option value="anticipo_saldo" selected>Anticipo + Saldo</option>
                                        <option value="rate">Rate</option>
                                        <option value="anticipo_rate">Anticipo + Rate</option>
                                    </select>
                                 </div>

                                 <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                                     <div id="asg-field-deposit" style="display: block;">
                                         <label class="text-caption" style="margin-bottom: 0.5rem; display:block;">ANTICIPO (%)</label>
                                         <div class="input-group">
                                             <input type="number" id="asg-deposit-pct" class="modal-input" value="30" min="0" max="100">
                                         </div>
                                     </div>
                                     
                                     <div id="asg-field-installments" style="display: none;">
                                         <label class="text-caption" style="margin-bottom: 0.5rem; display:block;">N. RATE</label>
                                         <input type="number" id="asg-installments-count" class="modal-input" value="3" min="1">
                                     </div>
                                     
                                     <div id="asg-field-installments-type" style="display: none;">
                                         <label class="text-caption" style="margin-bottom: 0.5rem; display:block;">FREQUENZA</label>
                                         <select id="asg-installments-type" class="modal-input" style="width: 100%;">
                                             <option value="Mensile" selected>Mensile</option>
                                             <option value="Bimestrale">Bimestrale</option>
                                             <option value="Trimestrale">Trimestrale</option>
                                             <option value="Quadrimestrale">Quadrimestrale</option>
                                             <option value="Semestrale">Semestrale</option>
                                             <option value="Annuale">Annuale</option>
                                         </select>
                                     </div>
                                 </div>

                                 <div>
                                     <label class="text-caption" style="margin-bottom: 0.5rem; display:block;">DATA INIZIO PAGAMENTI</label>
                                     <input type="date" id="asg-start-date" class="modal-input" style="width: 100%;" value="${new Date().toISOString().split('T')[0]}">
                                     <p style="font-size: 0.7rem; color: var(--text-tertiary); margin-top: 0.5rem;">Le scadenze successive verranno calcolate automaticamente a partire da questa data.</p>
                                 </div>
                             </div>
                         </div>
                    </div>

                </div>

                <!-- Footer / Navigation -->
                <div class="flex-end" style="gap: 1rem; margin-top: 2rem; pt-4; border-top: 1px solid var(--glass-border); padding-top: 1.5rem;">
                    <button class="primary-btn secondary" id="asg-prev-btn" onclick="window.asgPrevStep()" style="display: none;">Indietro</button>
                    <button class="primary-btn" id="asg-next-btn" onclick="window.asgNextStep()">Avanti</button>
                </div>
            </div>
        </div>
    `);

    // Helper State for Wizard
    window.asgState = {
        step: 1,
        maxSteps: 4,
        collaborator: null,
        selectedServices: []
    };

    // Define helper specifically for this modal to update UI based on payment mode
    window.asgUpdatePaymentFields = () => {
        const mode = document.getElementById('asg-payment-mode').value;
        const depositField = document.getElementById('asg-field-deposit');
        const instField = document.getElementById('asg-field-installments');
        const typeField = document.getElementById('asg-field-installments-type');

        if (mode === 'saldo') {
            depositField.style.display = 'none';
            instField.style.display = 'none';
            if (typeField) typeField.style.display = 'none';
        } else if (mode === 'anticipo_saldo') {
            depositField.style.display = 'block';
            instField.style.display = 'none';
            if (typeField) typeField.style.display = 'none';
        } else if (mode === 'rate') {
            depositField.style.display = 'none';
            instField.style.display = 'block';
            if (typeField) typeField.style.display = 'block';
        } else if (mode === 'anticipo_rate') {
            depositField.style.display = 'block';
            instField.style.display = 'block';
            if (typeField) typeField.style.display = 'block';
        }
    };

    // Bind global listener if not already bound (not standard but ensuring it is accessible)
}

window.openAddAssignmentModal = (orderId) => {
    state.currentOrderId = orderId;
    window.asgState = { step: 1, maxSteps: 4, collaborator: null, selectedServices: [] };

    // Reset inputs
    document.getElementById('asg-collab-id').value = '';
    document.getElementById('asg-collab-search').value = '';
    document.getElementById('asg-collab-search').parentElement.style.display = 'block';
    document.getElementById('asg-collab-selected').style.display = 'none';
    document.getElementById('asg-collab-list').style.display = 'none';
    if (document.getElementById('asg-step1-error')) document.getElementById('asg-step1-error').style.display = 'none';

    document.getElementById('asg-duration').value = '12';
    document.getElementById('asg-status').value = 'Da Fare';
    document.getElementById('asg-amount').value = '';

    window.updateAsgStepUI();
    document.getElementById('add-assignment-modal').classList.add('active');
};


window.asgNextStep = async () => {
    try {
        if (window.asgState.step === 1) {
            const collabId = document.getElementById("asg-collab-id").value;
            if (!collabId) {
                // Show explicit inline error
                const errDiv = document.getElementById("asg-step1-error");
                if (errDiv) errDiv.style.display = "flex";
                else showGlobalAlert("Seleziona un collaboratore per procedere", "error");
                return;
            }
            // Hide error if present
            const errDiv = document.getElementById("asg-step1-error");
            if (errDiv) errDiv.style.display = "none";

            // Validate state integrity
            if (!window.asgState.collaborator || window.asgState.collaborator.id !== collabId) {
                // Try to recover state if missing (e.g. manual DOM manipulation or race condition)
                const nameLabel = document.getElementById("asg-collab-name");
                const name = nameLabel ? nameLabel.innerText : 'Unknown';
                console.warn("Recovering missing asgState.collaborator from DOM");
                window.asgState.collaborator = { id: collabId, name: name };
            }

            // Await services loading
            await window.loadCollaboratorServicesForAssignment();
        }

        if (window.asgState.step === 2) {
            // Calculate total amount from selected services state (Switch to total_cost for Assignments)
            const total = window.asgState.selectedServices.reduce((sum, s) => sum + (s.total_cost || 0), 0);
            document.getElementById("asg-amount").value = total.toFixed(2);
        }

        if (window.asgState.step === 3) {
            // Just move to next step, no special validation needed for amount yet
        }

        if (window.asgState.step === 4) {
            await window.saveAssignmentMultiStep();
            return;
        }

        window.asgState.step++;
        window.updateAsgStepUI();
    } catch (e) {
        console.error("Assignment Wizard Error:", e);
        showGlobalAlert("Si è verificato un errore: " + e.message, "error");
    }
};

// Removed sync wrapper, directly assigned above




window.asgPrevStep = () => {
    if (window.asgState.step > 1) {
        window.asgState.step--;
        window.updateAsgStepUI();
    }
};

window.updateAsgStepUI = () => {
    const step = window.asgState.step;
    document.getElementById("asg-step-indicator").innerText = `Step ${step} di 4`;
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`asg-step-${i}`).style.display = (i === step) ? "block" : "none";
    }
    const prevBtn = document.getElementById("asg-prev-btn");
    const nextBtn = document.getElementById("asg-next-btn");
    prevBtn.style.display = step === 1 ? "none" : "block";
    nextBtn.innerText = step === 4 ? "Crea Incarico" : "Avanti";
};


window.filterAssignmentCollaborators = () => {
    const search = document.getElementById('asg-collab-search').value.toLowerCase();
    const list = document.getElementById('asg-collab-list');

    if (!state.collaborators) {
        console.warn("Collaborators state empty, refetching...");
        import('../../modules/api.js?v=8000').then(({ fetchCollaborators }) => fetchCollaborators());
        // Show temp message
        list.innerHTML = '<div style="padding: 1rem; color: var(--text-tertiary);">Caricamento...</div>';
        list.style.display = 'block';
        return;
    }

    const filtered = state.collaborators.filter(c => {
        // Filter out inactive
        if (c.is_active === false || c.active === false) return false;

        return c.full_name.toLowerCase().includes(search);
    });

    if (filtered.length === 0) {
        list.innerHTML = `<div style="padding: 1rem; color: var(--text-tertiary); text-align: center;">
            <span class="material-icons-round" style="font-size: 1.5rem; display: block; margin-bottom: 0.25rem;">person_off</span>
            Nessun collaboratore trovato
        </div>`;
        list.style.display = 'block';
        return;
    }

    list.innerHTML = filtered.map(c => `
        <div onclick="window.selectAssignmentCollaborator('${c.id}', '${c.full_name}')" style="padding: 0.75rem; border-bottom: 1px solid var(--glass-border); cursor: pointer; display: flex; align-items: center; gap: 0.75rem; transition: background 0.2s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='white'">
            ${renderAvatar(c, { size: 32, borderRadius: '50%', fontSize: '0.8rem' })}
            <div>
                <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">${c.full_name}</div>
                <div style="font-size: 0.75rem; color: var(--text-tertiary);">${c.role || 'Collaboratore'}</div>
            </div>
        </div>
    `).join('');
    list.style.display = 'block';
};


window.selectAssignmentCollaborator = (id, name) => {
    const collab = state.collaborators?.find(c => c.id === id);
    document.getElementById('asg-collab-id').value = id;
    document.getElementById('asg-collab-name').innerText = name;

    const avatarContainer = document.getElementById('asg-collab-avatar').parentElement;
    if (avatarContainer) {
        avatarContainer.innerHTML = renderAvatar(collab || { full_name: name }, { size: 32, borderRadius: '50%', fontSize: '0.8rem' });
    }

    document.getElementById('asg-collab-search').parentElement.style.display = 'none';
    document.getElementById('asg-collab-list').style.display = 'none';
    document.getElementById('asg-collab-selected').style.display = 'flex';

    window.asgState.collaborator = { id, name };
};

window.clearAssignmentCollaborator = () => {
    document.getElementById('asg-collab-id').value = '';
    document.getElementById('asg-collab-selected').style.display = 'none';
    document.getElementById('asg-collab-search').parentElement.style.display = 'block';
    document.getElementById('asg-collab-search').value = '';
    window.asgState.collaborator = null;
};


// Step 2: Load Services (Filtered by Dept)
window.loadCollaboratorServicesForAssignment = async () => {
    const selector = document.getElementById('asg-service-select');
    selector.innerHTML = '<option value="">Caricamento...</option>';

    try {
        // Clear previous state
        window.asgState.selectedServices = []; // Reset selected for new flow
        document.getElementById('asg-services-list').innerHTML = '<div style="text-align: center; color: var(--text-tertiary); padding: 1rem; font-size: 0.85rem;">Nessun servizio selezionato</div>';

        // 1. Fetch data FIRST to ensure we have collaborator details (role/tags) for filtering
        const { fetchServices, fetchCollaborators } = await import('../../modules/api.js?v=8000');
        if (!state.services || state.services.length === 0) await fetchServices();
        if (!state.collaborators || state.collaborators.length === 0) await fetchCollaborators();

        // 2. Identify collaborator and their specialized tags/roles
        const collabId = window.asgState.collaborator.id;
        const collaborator = state.collaborators.find(c => c.id === collabId);

        let normalizedCollabTags = [];
        if (collaborator) {
            let tags = [];
            if (collaborator.tags) {
                if (typeof collaborator.tags === 'string') {
                    try { 
                        const parsed = JSON.parse(collaborator.tags);
                        tags = Array.isArray(parsed) ? parsed : [collaborator.tags];
                    } catch(e) { tags = collaborator.tags.split(',').map(t => t.trim()); }
                } else if (Array.isArray(collaborator.tags)) {
                    tags = collaborator.tags;
                }
            }
            normalizedCollabTags = tags.map(t => t.trim().toLowerCase());
            if (collaborator.role) normalizedCollabTags.push(collaborator.role.trim().toLowerCase());
        }

        // 3. Filter services by department/intersecting tags
        const allServices = state.services || [];
        const filtered = allServices.filter(s => {
            // Ignore dummy/placeholder services if specifically not wanted
            if (s.name === 'Servizio Base') return false; 

            let serviceTags = [];
            if (s.tags) {
                serviceTags = Array.isArray(s.tags) ? s.tags : (typeof s.tags === 'string' ? s.tags.split(',') : []);
            }
            const normalizedServiceTags = serviceTags.map(t => t.trim().toLowerCase());

            // General services (no tags) are shown to everyone
            if (normalizedServiceTags.length === 0) return true;

            // If collaborator has no tags/roles assigned, show all services to be safe
            if (normalizedCollabTags.length === 0) return true;

            // CROSS-MATCHING Logic: Match if tag is in collab tags, OR role contains tag, OR vice-versa
            // e.g., service tag "Foto" matches role "Fotografo"
            return normalizedServiceTags.some(sTag => 
                normalizedCollabTags.some(cTag => cTag.includes(sTag) || sTag.includes(cTag))
            );
        }).sort((a, b) => a.name.localeCompare(b.name));

        // 4. Populate Dropdown (Return to filtered list as per user preference)
        if (filtered.length > 0) {
            selector.innerHTML = '<option value="">Seleziona un servizio...</option>' + 
                filtered.map(s => `<option value="${s.id}" data-type="${s.type || 'tariffa spot'}" data-price="${s.price || 0}" data-cost="${s.cost || 0}">${s.name}</option>`).join('');
            selector.disabled = false;
        } else {
            // Fallback: if no services match the specific department, show everything but labeled as full catalog
            selector.innerHTML = '<option value="">Seleziona dal catalogo completo...</option>' + 
                allServices.map(s => `<option value="${s.id}" data-type="${s.type || 'tariffa spot'}" data-price="${s.price || 0}" data-cost="${s.cost || 0}">${s.name}</option>`).join('');
            selector.disabled = allServices.length === 0;
            if (allServices.length === 0) {
                selector.innerHTML = '<option value="">Nessun servizio nel Tariffario</option>';
            }
        }

    } catch (e) {
        console.error("Load Services Error:", e);
        selector.innerHTML = '<option value="">Errore caricamento servizi</option>';
        showGlobalAlert("Errore caricamento servizi: " + e.message, "error");
    }
};

window.onAssignmentServiceSelect = () => {
    const selector = document.getElementById('asg-service-select');
    const qtyInput = document.getElementById('asg-service-qty');
    const addBtn = document.getElementById('asg-add-service-btn');
    const qtyLabel = document.getElementById('asg-qty-label');
    const tariffInfo = document.getElementById('asg-tariff-info');
    const totalDisplay = document.getElementById('asg-service-total-display');

    const serviceId = selector.value;
    if (!serviceId) {
        qtyInput.value = '';
        qtyInput.disabled = true;
        addBtn.disabled = true;
        tariffInfo.style.display = 'none';
        totalDisplay.textContent = '€ 0.00';
        return;
    }

    const option = selector.selectedOptions[0];
    const type = option.getAttribute('data-type');
    const price = parseFloat(option.getAttribute('data-price')) || 0;
    const cost = parseFloat(option.getAttribute('data-cost')) || 0;

    // Configure Inputs based on Type
    qtyInput.disabled = false;
    addBtn.disabled = false;

    // Default Qty
    qtyInput.value = 1;

    let unitLabel = 'Quantità';
    let infoText = '';

    if (type === 'tariffa oraria') {
        unitLabel = 'Ore';
        infoText = `Costo Orario: € ${formatMoney(cost)} / ora`;
    } else if (type === 'tariffa mensile') {
        unitLabel = 'Mesi';
        infoText = `Costo Mensile: € ${formatMoney(cost)} / mese`;
    } else { // 'tariffa spot' or others
        unitLabel = 'Quantità';
        infoText = `Costo Spot: € ${formatMoney(cost)} cadauno`;
    }

    qtyLabel.textContent = unitLabel;
    tariffInfo.textContent = infoText;
    tariffInfo.style.display = 'block';

    // Reset rate hint (lookup async sotto)
    const rateHint = document.getElementById('asg-rate-hint');
    if (rateHint) {
        rateHint.style.display = 'none';
        rateHint.innerHTML = '';
        rateHint.dataset.suggestedCost = '';
    }
    // Reset live override del costo per questa selezione
    selector.dataset.effectiveCost = String(cost);

    // Calculate initial total (using cost)
    const total = cost * 1;
    totalDisplay.textContent = '€ ' + formatMoney(total);

    // Attach listener for dynamic calc
    qtyInput.oninput = () => {
        const qty = parseFloat(qtyInput.value) || 0;
        const eff = parseFloat(selector.dataset.effectiveCost) || cost;
        const subTotal = eff * qty;
        totalDisplay.textContent = '€ ' + formatMoney(subTotal);
    };

    // Lookup tariffa storica/manuale per questo (collab, servizio)
    const collabId = window.asgState?.collaborator?.id
        || document.getElementById('asg-collab-id')?.value;
    if (collabId && serviceId && rateHint) {
        getCollaboratorServiceRate(collabId, serviceId).then(rate => {
            if (!rate || rate.unit_cost === null) return;
            // Skippa il template (è uguale a cost già preselezionato)
            if (rate.source === 'service_template' || rate.source === 'unknown') return;
            // Skippa se la tariffa storica coincide praticamente col listino
            if (Math.abs(rate.unit_cost - cost) < 0.01) return;

            // Verifica che ci siamo ancora sullo stesso servizio (race condition)
            if (selector.value !== serviceId) return;

            rateHint.dataset.suggestedCost = String(rate.unit_cost);
            const srcLabel = rateSourceLabel(rate.source);
            const sampleNote = rate.sample_size > 0 ? ` (${rate.sample_size} incarich${rate.sample_size === 1 ? 'o' : 'i'})` : '';
            const icon = rate.source === 'manual_override' ? 'push_pin' : 'history';

            rateHint.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0;">
                    <span class="material-icons-round" style="font-size: 18px; color: #d97706;">${icon}</span>
                    <span style="color: #92400e;">
                        ${srcLabel}: <strong>€ ${formatMoney(rate.unit_cost)}</strong>${sampleNote}.
                        Listino: € ${formatMoney(cost)}.
                    </span>
                </div>
                <button type="button" class="primary-btn small" id="asg-apply-historic-rate"
                    style="height: 30px; font-size: 0.75rem; padding: 0 0.75rem; white-space: nowrap; background: #d97706; border-color: #d97706;">
                    Usa € ${formatMoney(rate.unit_cost)}
                </button>
            `;
            rateHint.style.display = 'flex';

            const applyBtn = document.getElementById('asg-apply-historic-rate');
            if (applyBtn) {
                applyBtn.onclick = () => {
                    selector.dataset.effectiveCost = String(rate.unit_cost);
                    // Aggiorna anche data-cost dell'option corrente cosicché addService usi il nuovo valore
                    const opt = selector.selectedOptions[0];
                    if (opt) opt.setAttribute('data-cost', String(rate.unit_cost));
                    // Ricalcola subtotal
                    const qty = parseFloat(qtyInput.value) || 1;
                    totalDisplay.textContent = '€ ' + formatMoney(rate.unit_cost * qty);
                    // Aggiorna anche tariffInfo per coerenza visuale
                    if (type === 'tariffa oraria') {
                        tariffInfo.textContent = `Costo Orario: € ${formatMoney(rate.unit_cost)} / ora (storico)`;
                    } else if (type === 'tariffa mensile') {
                        tariffInfo.textContent = `Costo Mensile: € ${formatMoney(rate.unit_cost)} / mese (storico)`;
                    } else {
                        tariffInfo.textContent = `Costo Spot: € ${formatMoney(rate.unit_cost)} cadauno (storico)`;
                    }
                    rateHint.style.display = 'none';
                };
            }
        }).catch(err => console.warn('[assignment_modal] rate lookup failed:', err));
    }
};

window.addServiceToAssignmentList = () => {
    const selector = document.getElementById('asg-service-select');
    const qtyInput = document.getElementById('asg-service-qty');
    const serviceId = selector.value;

    if (!serviceId) return;

    const option = selector.selectedOptions[0];
    const name = option.text;
    const type = option.getAttribute('data-type');
    const unitPrice = parseFloat(option.getAttribute('data-price')) || 0;
    const unitCost = parseFloat(option.getAttribute('data-cost')) || 0;
    const qty = parseFloat(qtyInput.value) || 0;

    if (qty <= 0) {
        showGlobalAlert('La quantità deve essere maggiore di zero', 'error');
        return;
    }

    // Add to state
    console.log("Adding service to assignment state:", { serviceId, name, qty, total_cost: unitCost * qty });
    window.asgState.selectedServices.push({
        id: serviceId, // Catalog ID
        name: name,
        type: type,
        unit_price: unitPrice,
        unit_cost: unitCost,
        quantity: qty,
        total_price: unitPrice * qty,
        total_cost: unitCost * qty
    });
    console.log("Current State Services:", window.asgState.selectedServices);

    // Reset Input
    selector.value = '';
    window.onAssignmentServiceSelect(); // Reset UI state

    window.renderSelectedServicesList();
};

window.renderSelectedServicesList = () => {
    const list = document.getElementById('asg-services-list');
    const services = window.asgState.selectedServices;

    if (services.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: var(--text-tertiary); padding: 1rem; font-size: 0.85rem;">Nessun servizio selezionato</div>';
        return;
    }

    list.innerHTML = services.map((s, index) => `
        <div class="asg-service-row" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: white; border: 1px solid var(--glass-border); border-radius: 8px;">
            <div style="flex: 1;">
                <div style="font-weight: 600; font-size: 0.9rem;">${s.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-tertiary);">
                    ${s.type === 'tariffa oraria' ? `${s.quantity} ore` : (s.type === 'tariffa mensile' ? `${s.quantity} mesi` : `Qtà: ${s.quantity}`)} @ Costo Unit: € ${formatMoney(s.unit_cost)}
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="font-weight: 700; color: #ef4444;">€ ${formatMoney(s.total_cost)}</div>
                <button class="icon-btn small" onclick="window.removeServiceFromAssignmentList(${index})" style="color: var(--error-color);">
                    <span class="material-icons-round" style="font-size: 18px;">delete</span>
                </button>
            </div>
        </div>
    `).join('');
};

window.removeServiceFromAssignmentList = (index) => {
    window.asgState.selectedServices.splice(index, 1);
    window.renderSelectedServicesList();
};

window.formatMoney = (amount) => {
    return (parseFloat(amount) || 0).toFixed(2).replace('.', ',');
};



window.saveAssignmentMultiStep = async () => {
    console.log("saveAssignmentMultiStep started");
    showGlobalAlert('Salvataggio in corso...', 'info');

    const orderId = state.currentOrderId || state.currentId || (window.location.hash.includes('order-detail') ? window.location.hash.split('/').pop() : null);

    if (!orderId) {
        showGlobalAlert('Errore: ID Ordine mancante', 'error');
        console.error("Missing Order ID in saveAssignmentMultiStep");
        return;
    }

    const collaboratorId = document.getElementById('asg-collab-id').value;
    const duration = parseInt(document.getElementById('asg-duration').value) || 12;
    const status = document.getElementById('asg-status').value;

    // Safety check for amount element and value
    const amountEl = document.getElementById('asg-amount');
    const amountVal = amountEl ? amountEl.value.replace(',', '.') : '0';
    const amount = parseFloat(amountVal) || 0;

    console.log("Payload:", { orderId, collaboratorId, duration, status, amount });

    if (!collaboratorId) {
        showGlobalAlert('Seleziona un collaboratore', 'error');
        return;
    }

    // Gather payment configuration
    const paymentMode = document.getElementById('asg-payment-mode').value || 'saldo';
    const depositPct = parseFloat(document.getElementById('asg-deposit-pct').value) || 0;
    const installmentsCount = parseInt(document.getElementById('asg-installments-count').value) || 1;
    const installmentsType = document.getElementById('asg-installments-type') ? document.getElementById('asg-installments-type').value : 'Mensile';
    const startDateStr = document.getElementById('asg-start-date').value;

    try {
        const order = state.orders.find(o => o.id === orderId);

        // Dynamic import including calculateProposedAssignmentPayments
        const { upsertAssignment, upsertCollaboratorService, fetchCollaboratorServices, fetchAssignments, upsertPayment, fetchPayments } = await import('../../modules/api.js?v=8000');
        const { calculateProposedAssignmentPayments } = await import('../assignments.js?v=9003');

        console.log("Upserting Assignment...");
        const newAssignment = await upsertAssignment({
            order_id: orderId,
            collaborator_id: collaboratorId,
            contract_duration_months: duration,
            status: status,
            total_amount: amount,
            created_at: new Date().toISOString(),
            order_number: order ? order.order_number : null,
            client_code: order && order.clients ? order.clients.client_code : null,
            // Payment Meta
            payment_mode: paymentMode,
            deposit_percentage: depositPct,
            installments_count: installmentsCount,
            installment_type: installmentsType
        });
        console.log("Assignment Upserted:", newAssignment);

        // 2. Create Linked Services
        const selectedServices = window.asgState.selectedServices || [];
        console.log("Services to create:", selectedServices.length, selectedServices);

        if (selectedServices.length === 0) {
            // Warn but proceed if user confirms (confirm logic inside loop helper if needed, but handled here)
            // Logic kept from original
        }

        for (const s of selectedServices) {
            await upsertCollaboratorService({
                order_id: orderId,
                collaborator_id: collaboratorId,
                service_id: s.id, // Link to catalog
                assignment_id: newAssignment.id,
                name: s.name,
                quantity: s.quantity,
                unit_price: s.unit_price,
                unit_cost: s.unit_cost,
                total_price: s.total_price,
                total_cost: s.total_cost
            });
        }

        // 3. Generate Payment Plan Automatically
        if (amount > 0) {
            console.log("Generating initial payment plan...");
            const payments = calculateProposedAssignmentPayments(newAssignment, startDateStr);
            for (const p of payments) {
                await upsertPayment(p);
            }
            await fetchPayments();
        }

        console.log("Refreshing data...");
        // await fetchCollaboratorServices();
        // await fetchAssignments();

        showGlobalAlert('Incarico e piano pagamenti creati con successo', 'success');
        document.getElementById('add-assignment-modal').classList.remove('active');

        console.log("Rendering Order Detail...");
        // Ensure renderOrderDetail is available (it's in this file scope)
        if (typeof renderOrderDetail === 'function') {
            // Re-render via hash to avoid cyclic import with orders.js
            window.location.hash = '#order-detail/' + orderId;
        } else {
            console.warn("renderOrderDetail not found, reloading page...");
            window.location.reload();
        }

    } catch (e) {
        console.error('Save Assignment Error Full:', JSON.stringify(e, null, 2));
        showGlobalAlert('Errore salvataggio: ' + (e.message || e), 'error');
    }
};

window.saveAssignment = window.saveAssignmentMultiStep;
