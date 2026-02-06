import { state } from '../modules/state.js?v=157';
import { formatAmount, showGlobalAlert } from '../modules/utils.js?v=157';
import { fetchAssignmentDetail, upsertPayment, deletePayment, fetchPayments, upsertAssignment, deleteAssignment } from '../modules/api.js?v=157';
import { openPaymentModal } from './payments.js?v=157';
import { CustomSelect } from '../components/CustomSelect.js?v=157';

// Helper functions
function getStatusColor(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('complet') || s.includes('terminato') || s.includes('chiuso')) return '#10b981';
    if (s.includes('corso') || s.includes('lavo') || s.includes('progress')) return '#f59e0b';
    if (s.includes('sospeso') || s.includes('hold')) return '#ef4444';
    if (s.includes('attesa') || s.includes('wait')) return '#3b82f6';
    return '#6366f1';
}

function getInitials(name) {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function getAvatarColor(name) {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

export async function renderAssignmentDetail(container) {
    const id = state.currentId;
    container.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 50vh;">
            <div class="loader"></div>
        </div>
    `;

    try {
        if (!state.payments || state.payments.length === 0) {
            await fetchPayments();
        }
        const assignment = await fetchAssignmentDetail(id);
        if (!assignment) {
            container.innerHTML = '<div class="alert error">Incarico non trovato</div>';
            return;
        }

        // Ensure it's in global state
        if (!state.assignments) state.assignments = [];
        const existingIdx = state.assignments.findIndex(a => a.id === assignment.id);
        if (existingIdx >= 0) {
            state.assignments[existingIdx] = { ...state.assignments[existingIdx], ...assignment };
        } else {
            state.assignments.push(assignment);
        }

        // Fetch collaborator services if not loaded
        if (!state.collaboratorServices || state.collaboratorServices.length === 0) {
            console.log('DEBUG: collaboratorServices missing or empty, fetching...');
            const { fetchCollaboratorServices } = await import('../modules/api.js?v=157');
            await fetchCollaboratorServices();
        }

        console.log('DEBUG: Current Assignment ID:', assignment.id);
        console.log('DEBUG: Mapping logic - Order ID:', assignment.order_id, 'Legacy Order ID:', assignment.orders?.order_number, 'Collaborator ID:', assignment.collaborator_id);

        // Find associated services
        const linkedServices = (state.collaboratorServices || []).filter(s => {
            const matchOrder = s.order_id === assignment.order_id;
            const matchLegacyOrder = s.legacy_order_id && assignment.orders && s.legacy_order_id === assignment.orders.order_number;
            const matchCollaborator = s.collaborator_id === assignment.collaborator_id;

            if (matchOrder || matchLegacyOrder || matchCollaborator) {
                console.log(`DEBUG: Checking service ${s.name} (${s.id}): OrderMatch=${matchOrder}, LegacyOrderMatch=${matchLegacyOrder}, CollabMatch=${matchCollaborator}`);
            }

            return (matchOrder || matchLegacyOrder) && matchCollaborator;
        });

        console.log('DEBUG: Linked Services Count:', linkedServices.length);
        console.log('DEBUG: Linked Services:', linkedServices);

        const totalCost = linkedServices.reduce((sum, s) => sum + (parseFloat(s.total_cost) || 0), 0);
        const totalRevenue = linkedServices.reduce((sum, s) => sum + (parseFloat(s.total_price) || 0), 0);
        const budget = parseFloat(assignment.total_amount) || 0;
        const margin = totalRevenue - totalCost;
        const marginPct = totalRevenue > 0 ? Math.round((margin / totalRevenue) * 100) : 0;

        // Linked payments
        const linkedPayments = (state.payments || []).filter(p => p.assignment_id === assignment.id);
        const totalPaid = linkedPayments.filter(p => p.status === 'Completato' || p.status === 'Done').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const totalPending = linkedPayments.filter(p => p.status !== 'Completato' && p.status !== 'Done').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

        const statusColor = getStatusColor(assignment.status);
        const collabName = assignment.collaborators?.full_name || 'Collaboratore';
        const orderNumber = assignment.orders?.order_number || 'Ordine';
        const orderTitle = assignment.orders?.title || '';
        const clientName = assignment.orders?.clients?.business_name || '';

        container.innerHTML = `
            <div class="animate-fade-in" style="max-width: 1400px; margin: 0 auto; padding: 1rem;">
                <!-- Header Section -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; background: var(--bg-secondary); padding: 1.5rem 2rem; border-radius: 16px; border: 1px solid var(--glass-border);">
                    <div style="display: flex; align-items: center; gap: 1.25rem;">
                        <div style="width: 56px; height: 56px; border-radius: 14px; background: linear-gradient(135deg, #8b5cf6, #6366f1); display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(99, 102, 241, 0.2);">
                            <span class="material-icons-round" style="color: white; font-size: 28px;">assignment</span>
                        </div>
                        <div>
                            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.4rem;">
                                 <h1 style="font-size: 1.75rem; font-weight: 700; margin: 0; color: var(--text-primary); font-family: var(--font-titles); letter-spacing: -0.02em;">Incarico ${assignment.legacy_id || id.substring(0, 8)}</h1>
                                 <div class="assignment-status-wrapper" style="min-width: 150px;">
                                    <select id="assignment-status-select" onchange="window.handleAssignmentStatusChange('${assignment.id}', this.value)">
                                        ${['Attivo', 'In Corso', 'Sospeso', 'Completato', 'Annullato'].map(s => `
                                            <option value="${s}" ${assignment.status === s ? 'selected' : ''}>${s}</option>
                                        `).join('')}
                                    </select>
                                 </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 1rem; color: var(--text-tertiary); font-size: 0.85rem;">
                                <span style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;" onclick="window.location.hash='#collaborator-detail/${assignment.collaborator_id}'">
                                    <span class="material-icons-round" style="font-size: 1rem;">person</span> ${collabName}
                                </span>
                                <span style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;" onclick="window.location.hash='#order-detail/${assignment.order_id}'">
                                    <span class="material-icons-round" style="font-size: 1rem;">shopping_bag</span> ${orderNumber} ${orderTitle ? `- ${orderTitle}` : ''}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 0.75rem;">
                        <button class="primary-btn secondary" onclick="window.history.back()" style="padding: 0.6rem 1.25rem; border-radius: 10px;">
                            <span class="material-icons-round">arrow_back</span> Indietro
                        </button>
                        <button class="primary-btn secondary" onclick="window.deleteAssignment('${assignment.id}')" style="padding: 0.6rem 1.25rem; border-radius: 10px; color: #ef4444; border-color: rgba(239, 68, 68, 0.2);">
                            <span class="material-icons-round">delete</span> Elimina
                        </button>
                        <button class="primary-btn secondary" onclick="window.editAssignment('${assignment.id}')" style="padding: 0.6rem 1.25rem; border-radius: 10px;">
                            <span class="material-icons-round">edit</span> Modifica
                        </button>
                        <button class="primary-btn" style="padding: 0.6rem 1.25rem; border-radius: 10px; background: linear-gradient(135deg, #8b5cf6, #6366f1);">
                            <span class="material-icons-round">file_download</span> Lettera Incarico
                        </button>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; align-items: start;">
                    <!-- Column 1: Basic Info -->
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <!-- Collaborator Card -->
                        <div class="glass-card" style="padding: 1.25rem; cursor: pointer;" onclick="window.location.hash='#collaborator-detail/${assignment.collaborator_id}'">
                            <div style="color: var(--text-tertiary); font-size: 0.65rem; font-weight: 500; text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 0.05em;">Collaboratore</div>
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <div style="width: 40px; height: 40px; border-radius: 50%; background: ${getAvatarColor(collabName)}; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 600;">${getInitials(collabName)}</div>
                                <div>
                                    <div style="font-size: 1rem; font-weight: 600; color: var(--text-primary);">${collabName}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-tertiary);">${assignment.collaborators?.role || 'Freelance'}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Order Link Card -->
                        <div class="glass-card" style="padding: 1.25rem; cursor: pointer;" onclick="window.location.hash='#order-detail/${assignment.order_id}'">
                            <div style="color: var(--text-tertiary); font-size: 0.65rem; font-weight: 500; text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 0.05em;">Ordine Collegato</div>
                            <div style="font-size: 0.95rem; font-weight: 600; color: var(--brand-blue); margin-bottom: 0.2rem;">${orderNumber}</div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary); opacity: 0.8;">${orderTitle}</div>
                            ${clientName ? `<div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.4rem;">${clientName}</div>` : ''}
                        </div>

                        <!-- Quick Info -->
                        <div class="glass-card" style="padding: 1.25rem;">
                            <div style="color: var(--text-tertiary); font-size: 0.65rem; font-weight: 500; text-transform: uppercase; margin-bottom: 0.75rem; letter-spacing: 0.05em;">Informazioni</div>
                            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-size: 0.8rem; color: var(--text-secondary);">Data Inizio</span>
                                    <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${assignment.start_date ? new Date(assignment.start_date).toLocaleDateString('it-IT') : '-'}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-size: 0.8rem; color: var(--text-secondary);">Termini Pagamento</span>
                                    <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${assignment.payment_terms || 'Da concordare'}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-size: 0.8rem; color: var(--text-secondary);">Stato</span>
                                    <span style="display: flex; align-items: center; gap: 0.4rem;">
                                        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor};"></span>
                                        <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${assignment.status || 'Attivo'}</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Column 2: Services & Description -->
                    <div class="glass-card" style="padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem;">
                            <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0;">Servizi & Attività</h3>
                            <span class="badge" style="background: rgba(139, 92, 246, 0.1); color: #8b5cf6; font-weight: 600;">${linkedServices.length}</span>
                        </div>
                        
                        ${linkedServices.length > 0 ? `
                            <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem;">
                                ${linkedServices.map(s => `
                                    <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 10px; border: 1px solid var(--glass-border);">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                                            <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${s.services?.name || s.legacy_service_name || s.name || 'Servizio'}</span>
                                            <span style="font-size: 0.85rem; font-weight: 700; color: #ef4444;">${formatAmount(s.total_cost)}€</span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-tertiary);">
                                            <span>${s.quantity || s.hours || '-'} unità × ${formatAmount(s.unit_cost)}€</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `
                            <div style="text-align: center; padding: 2rem; color: var(--text-tertiary); font-size: 0.85rem;">
                                <span class="material-icons-round" style="font-size: 2rem; opacity: 0.5; display: block; margin-bottom: 0.5rem;">construction</span>
                                Nessun servizio collegato
                            </div>
                        `}

                        <!-- Description -->
                        <div style="border-top: 1px solid var(--glass-border); padding-top: 1.25rem; margin-top: 0.5rem;">
                            <div style="font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.5rem;">Descrizione Attività</div>
                            <p style="font-size: 0.85rem; line-height: 1.6; color: var(--text-secondary); margin: 0;">${assignment.description || 'Nessuna descrizione specifica per questo incarico.'}</p>
                        </div>

                        ${assignment.pm_notes ? `
                            <div style="margin-top: 1.25rem; padding: 1rem; background: rgba(245, 158, 11, 0.05); border-radius: 10px; border: 1px dashed rgba(245, 158, 11, 0.3);">
                                <div style="font-size: 0.7rem; font-weight: 600; color: #f59e0b; text-transform: uppercase; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem;">
                                    <span class="material-icons-round" style="font-size: 1rem;">sticky_note_2</span> Note PM
                                </div>
                                <p style="font-size: 0.8rem; line-height: 1.5; color: var(--text-secondary); margin: 0; font-style: italic;">${assignment.pm_notes}</p>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Column 3: Economics & Payments -->
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <!-- Budget Card -->
                        <div class="glass-card" style="padding: 1.5rem; background: linear-gradient(135deg, rgba(139, 92, 246, 0.08), transparent); border: 2px solid rgba(139, 92, 246, 0.15);">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div style="flex: 1;">
                                    <div style="font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); font-weight: 600; margin-bottom: 0.25rem;">Budget Incarico</div>
                                    <div style="font-size: 2rem; font-weight: 800; line-height: 1; color: #8b5cf6; font-family: var(--font-titles);">${formatAmount(budget)}€</div>
                                </div>
                            </div>
                        </div>

                        <!-- Payments Collapsible -->
                        <div class="glass-card" style="padding: 1rem; background: var(--bg-tertiary); cursor: pointer;" onclick="const d = this.querySelector('.payments-details'); d.style.display = d.style.display === 'none' ? 'block' : 'none';">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 600; font-size: 0.85rem;"><span class="material-icons-round" style="font-size: 1rem; color: var(--text-secondary);">payments</span> Pagamenti</div>
                                <div style="display: flex; align-items: center; gap: 0.4rem;">
                                    <div style="font-size: 0.6rem; padding: 2px 5px; border-radius: 4px; background: rgba(16, 185, 129, 0.1); color: #10b981; font-weight: 700;">${linkedPayments.filter(p => p.status === 'Completato' || p.status === 'Done').length} ✓</div>
                                    <div style="font-size: 0.6rem; padding: 2px 5px; border-radius: 4px; background: rgba(245, 158, 11, 0.1); color: #f59e0b; font-weight: 700;">${linkedPayments.filter(p => p.status !== 'Completato' && p.status !== 'Done').length} ⏳</div>
                                    <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary);">expand_more</span>
                                </div>
                            </div>

                            <div class="payments-summary" style="display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.5rem; border-top: 1px solid var(--glass-border); padding-top: 0.5rem;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.65rem; align-items: center;">
                                    <span style="color: var(--text-tertiary); text-transform: uppercase; font-weight: 500;">Pagato</span>
                                    <span style="font-weight: 700; color: #10b981;">${formatAmount(totalPaid)}€</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.65rem; align-items: center;">
                                    <span style="color: var(--text-tertiary); text-transform: uppercase; font-weight: 500;">In Attesa</span>
                                    <span style="font-weight: 700; color: #f59e0b;">${formatAmount(totalPending)}€</span>
                                </div>
                            </div>

                            <div class="payments-details" style="display: none; margin-top: 1rem; border-top: 1px solid var(--glass-border); padding-top: 1rem;" onclick="event.stopPropagation();">
                                ${linkedPayments.length > 0 ? linkedPayments.map(p => `
                                    <div style="padding: 0.6rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--glass-border); cursor: pointer; margin-bottom: 0.5rem;" onclick="window.openPaymentModal('${p.id}')">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
                                            <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary);">${p.title || 'Pagamento'}</span>
                                            <span style="font-size: 0.8rem; font-weight: 700; color: #ef4444;">${formatAmount(p.amount)}€</span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: var(--text-tertiary);">
                                            <span>${p.due_date ? new Date(p.due_date).toLocaleDateString('it-IT') : '-'}</span>
                                            <span class="status-badge" style="padding: 2px 6px; font-size: 0.6rem; border-radius: 4px; background: ${(p.status === 'Completato' || p.status === 'Done') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'}; color: ${(p.status === 'Completato' || p.status === 'Done') ? '#10b981' : '#f59e0b'}; border: none;">${p.status}</span>
                                        </div>
                                    </div>
                                `).join('') : '<div style="font-size: 0.7rem; color: var(--text-tertiary); text-align: center; padding: 1rem;">Nessun pagamento</div>'}
                                
                                <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                                    <button onclick="window.openManualAssignmentPaymentModal('${assignment.id}', '${assignment.collaborator_id}')" style="flex: 1; border: none; background: var(--bg-secondary); color: var(--text-primary); font-size: 0.75rem; font-weight: 500; padding: 0.6rem; border-radius: 8px; cursor: pointer; border: 1px solid var(--glass-border);">
                                        <span class="material-icons-round" style="font-size: 0.9rem; vertical-align: middle;">add</span> Manuale
                                    </button>
                                    <button onclick="window.generateAssignmentPayments('${assignment.id}')" style="flex: 1; border: none; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; font-size: 0.75rem; font-weight: 500; padding: 0.6rem; border-radius: 8px; cursor: pointer;">
                                        <span class="material-icons-round" style="font-size: 0.9rem; vertical-align: middle;">auto_fix_high</span> Genera
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Documents Card -->
                        <div class="glass-card" style="padding: 1rem;">
                            <div style="font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.75rem;">Documenti</div>
                            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem; background: var(--bg-secondary); border-radius: 8px; cursor: pointer; border: 1px solid var(--glass-border);" onclick="window.open('${assignment.drive_link || '#'}', '_blank')">
                                    <div style="width: 32px; height: 32px; border-radius: 8px; background: #4285F4; display: flex; align-items: center; justify-content: center; color: white;">
                                        <span class="material-icons-round" style="font-size: 1rem;">folder</span>
                                    </div>
                                    <div>
                                        <div style="font-size: 0.8rem; font-weight: 600;">Google Drive</div>
                                        <div style="font-size: 0.65rem; color: var(--text-tertiary);">Materiali incarico</div>
                                    </div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem; background: var(--bg-secondary); border-radius: 8px; opacity: 0.6; border: 1px solid var(--glass-border);">
                                    <div style="width: 32px; height: 32px; border-radius: 8px; background: #DB4437; display: flex; align-items: center; justify-content: center; color: white;">
                                        <span class="material-icons-round" style="font-size: 1rem;">description</span>
                                    </div>
                                    <div>
                                        <div style="font-size: 0.8rem; font-weight: 600;">Lettera Incarico</div>
                                        <div style="font-size: 0.65rem; color: var(--text-tertiary);">Non generata</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Initialize custom selects
        const statusSelect = container.querySelector('#assignment-status-select');
        if (statusSelect) new CustomSelect(statusSelect);

    } catch (error) {
        console.error(error);
        container.innerHTML = '<div class="alert error">Errore nel caricamento dell\'incarico</div>';
    }
}

function renderAssignmentInfo(assignment) {
    return `
        <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 4rem;">
            <div>
                <h3 style="font-family: var(--font-titles); font-weight: 400; margin-bottom: 1.5rem; color: var(--brand-blue);">Dettaglio Attività</h3>
                <p style="font-size: 1.1rem; line-height: 1.6; color: var(--text-secondary); white-space: pre-wrap;">${assignment.description || 'Nessuna descrizione specifica per questo incarico.'}</p>
                
                <h3 style="font-family: var(--font-titles); font-weight: 400; margin: 2.5rem 0 1.5rem 0; color: var(--brand-blue);">Note PM</h3>
                <div style="background: rgba(0,0,0,0.03); padding: 1.5rem; border-radius: 1rem; color: var(--text-secondary); italic;">
                    ${assignment.pm_notes || 'Nessuna nota operativa inserita.'}
                </div>
            </div>
            <div>
                <h3 style="font-family: var(--font-titles); font-weight: 400; margin-bottom: 1.5rem;">Info Pagamento</h3>
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                    <div>
                        <div style="font-size: 0.75rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 400;">Metodo</div>
                        <div style="font-weight: 400;">${assignment.payment_terms || 'Bonifico Bancario'}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 400;">Dettagli</div>
                        <div style="color: var(--text-secondary);">${assignment.payment_details || '-'}</div>
                    </div>
                    <div>
                         <div style="font-size: 0.75rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 400;">Rivalsa INPS</div>
                        <div style="font-weight: 400;">4% inclusa</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderAssignmentServices(services) {
    if (!services || services.length === 0) {
        return `<div style="text-align: center; padding: 3rem; color: var(--text-tertiary);">Nessun servizio dettagliato collegato a questo incarico.</div>`;
    }

    return `
        <div style="margin-top: -1rem;">
            <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 1rem; padding: 1rem; background: rgba(0,0,0,0.02); font-size: 0.75rem; font-weight: 400; color: var(--text-tertiary); text-transform: uppercase;">
                <div>Servizio</div>
                <div style="text-align: right;">Quantità</div>
                <div style="text-align: right;">Costo Unitario</div>
                <div style="text-align: right;">Totale Costo</div>
            </div>
            ${services.map(s => `
                <div class="transaction-row" style="grid-template-columns: 2fr 1fr 1fr 1fr; padding: 1.25rem 1rem; border-bottom: 1px solid var(--glass-border);">
                    <div style="font-weight: 400; color: var(--text-primary);">${s.services?.name || s.legacy_service_name || s.name}</div>
                    <div style="text-align: right; color: var(--text-secondary);">${s.quantity || s.hours || '-'}</div>
                    <div style="text-align: right; color: var(--text-secondary);">${formatAmount(s.unit_cost)}€</div>
                    <div style="text-align: right; font-weight: 400; color: var(--brand-blue);">${formatAmount(s.total_cost)}€</div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderAssignmentDocs(assignment) {
    return `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem;">
            <div class="glass-card" style="padding: 1.5rem; display: flex; align-items: center; gap: 1rem; cursor: pointer; hover: background: rgba(0,0,0,0.02);" onclick="window.open('${assignment.drive_link || '#'}', '_blank')">
                <div style="width: 48px; height: 48px; border-radius: 50%; background: #4285F4; display: flex; align-items: center; justify-content: center; color: white;">
                    <span class="material-icons-round">folder</span>
                </div>
                <div>
                    <div style="font-weight: 400;">Google Drive Folder</div>
                    <div style="font-size: 0.8rem; color: var(--text-tertiary);">Materiali dell'incarico</div>
                </div>
            </div>
            <div class="glass-card" style="padding: 1.5rem; display: flex; align-items: center; gap: 1rem; opacity: 0.6;">
                <div style="width: 48px; height: 48px; border-radius: 50%; background: #DB4437; display: flex; align-items: center; justify-content: center; color: white;">
                    <span class="material-icons-round">description</span>
                </div>
                <div>
                    <div style="font-weight: 400;">Lettera Incarico.pdf</div>
                    <div style="font-size: 0.8rem; color: var(--text-tertiary);">Non generata</div>
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// ASSIGNMENT PAYMENT LOGIC
// ==========================================

function renderAssignmentPaymentPlan(assignment) {
    // Filter linked payments (passive/uscita for collaborator)
    const linkedPayments = state.payments ? state.payments.filter(p => p.assignment_id === assignment.id) : [];
    const totalPlanned = linkedPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const totalBudget = parseFloat(assignment.total_amount) || 0;
    const toPlan = totalBudget - totalPlanned;
    const statusColor = Math.abs(toPlan) < 1 ? 'var(--success-soft)' : (toPlan > 0 ? 'var(--warning-soft)' : 'var(--error-soft)');

    // Ensure global config object exists for this assignment if editing
    if (!window.assignmentConfigEditState) window.assignmentConfigEditState = {};

    return `
        <div>
            <!-- Header and Config -->
             <div class="glass-card" style="padding: 0; overflow: hidden; margin-bottom: 2rem;">
                 <div style="padding: 1.5rem; background: var(--bg-secondary); border-bottom: 1px solid var(--glass-border);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <h3 style="font-family: var(--font-titles); font-weight: 400; margin: 0; display: flex; align-items: center; gap: 0.75rem;">
                            <span class="material-icons-round" style="color: var(--brand-blue);">payments</span>
                            Configurazione Pagamenti
                        </h3>
                        <div style="display: flex; gap: 1rem;">
                            <button class="primary-btn secondary small" onclick="window.openManualAssignmentPaymentModal('${assignment.id}', '${assignment.collaborator_id}')">
                                <span class="material-icons-round">add</span> Manuale
                            </button>
                            <button class="primary-btn small" onclick="window.generateAssignmentPayments('${assignment.id}')">
                                <span class="material-icons-round">auto_fix_high</span> Genera Piano
                            </button>
                        </div>
                    </div>

                    <!-- Config UI -->
                    <div id="assignment-payment-config-container-${assignment.id}">
                        ${renderAssignmentPaymentConfigUI(assignment)}
                    </div>
                </div>

                <!-- Payments List -->
                <div style="padding: 0;">
                     ${linkedPayments.length > 0 ? `
                         <div style="display: grid; grid-template-columns: 1.5fr 3fr 1.5fr 1fr; gap: 1rem; padding: 0.75rem 1.5rem; background: rgba(0,0,0,0.02); font-size: 0.75rem; font-weight: 400; color: var(--text-secondary); text-transform: uppercase; border-bottom: 1px solid var(--glass-border);">
                            <div>Scadenza</div>
                            <div>Descrizione</div>
                            <div>Importo</div>
                            <div style="text-align: right;">Stato</div>
                        </div>
                        ${linkedPayments.map(p => `
                            <div class="transaction-row" onclick="window.openPaymentModal('${p.id}')" style="cursor: pointer; grid-template-columns: 1.5fr 3fr 1.5fr 1fr; padding: 1rem 1.5rem; border-bottom: 1px solid var(--glass-border);">
                                 <div style="color: var(--text-secondary);">${p.due_date ? new Date(p.due_date).toLocaleDateString() : '-'}</div>
                                 <div style="font-weight: 500; color: var(--text-primary);">${p.title || 'Pagamento'}</div>
                                 <div style="font-weight: 600; font-family: 'Outfit',sans-serif;">€ ${formatAmount(p.amount)}</div>
                                 <div style="text-align: right;"><span class="status-badge" style="font-size: 0.75rem;">${p.status}</span></div>
                            </div>
                        `).join('')}
                     ` : `
                        <div style="padding: 3rem; text-align: center; color: var(--text-tertiary);">
                            <span class="material-icons-round" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">savings</span>
                            <p>Nessun pagamento pianificato per questo incarico.</p>
                        </div>
                     `}
                </div>
                 <!-- Summary Footer -->
                <div style="padding: 1.5rem; background: var(--bg-tertiary); display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--glass-border);">
                     <div style="font-size: 0.9rem; color: var(--text-secondary);">
                        Budget Incarico: <strong>€ ${formatAmount(totalBudget)}</strong>
                     </div>
                     <div style="display: flex; gap: 2rem;">
                        <div style="text-align: right;">
                            <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Pianificato</div>
                            <div style="font-size: 1.1rem; font-weight: 400; color: var(--brand-blue);">€ ${formatAmount(totalPlanned)}</div>
                        </div>
                         <div style="text-align: right;">
                            <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Da Pianificare</div>
                            <div style="font-size: 1.1rem; font-weight: 600; color: ${statusColor};">€ ${formatAmount(toPlan)}</div>
                        </div>
                     </div>
                </div>
            </div>
        </div>
    `;
}

// Config UI Renderers
function renderAssignmentPaymentConfigUI(assignment) {
    if (window.assignmentConfigEditState[assignment.id]) {
        return renderAssignmentPaymentConfigEdit(assignment);
    }
    return renderAssignmentPaymentConfigDisplay(assignment);
}

function formatPaymentMode(mode) {
    const map = {
        'saldo': 'Saldo alla chiusura del progetto',
        'rate': 'Rate',
        'anticipo_rate': 'Anticipo + Rate',
        'anticipo_saldo': 'Anticipo e saldo alla chiusura del progetto',
        'as_rate': 'Anticipo + Rate + Saldo'
    };
    return map[mode] || mode || 'Non configurato';
}

function renderAssignmentPaymentConfigDisplay(assignment) {
    return `
        <div class="payment-config-display" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(0,0,0,0.02); border-radius: 12px; border: 1px solid var(--glass-border);">
            <div style="display: flex; gap: 2rem; align-items: center;">
                <div>
                   <div style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.25rem;">Modalità Pagamento</div>
                   <div style="font-weight: 500; color: var(--text-primary); font-size: 0.95rem;">${formatPaymentMode(assignment.payment_mode)}</div>
                </div>
                ${assignment.payment_mode && assignment.payment_mode.includes('anticipo') ? `
                    <div>
                        <div style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.25rem;">Anticipo</div>
                        <div style="font-weight: 500;">${assignment.deposit_percentage}%</div>
                    </div>
                ` : ''}
                 ${assignment.payment_mode && assignment.payment_mode.includes('rate') ? `
                    <div>
                        <div style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.25rem;">Rate</div>
                        <div style="font-weight: 500;">${assignment.installments_count} x ${(assignment.installment_type || '').toLowerCase()}</div>
                    </div>
                ` : ''}
            </div>
            <button class="btn-link" onclick="window.toggleAssignmentConfigEdit('${assignment.id}', true)">
                <span class="material-icons-round" style="font-size: 1.2rem;">edit</span> Modifica
            </button>
        </div>
    `;
}

function renderAssignmentPaymentConfigEdit(assignment) {
    const currentMode = assignment.payment_mode || 'saldo';

    return `
        <div class="payment-config-edit animate-fade-in" style="background: white; padding: 1.5rem; border-radius: 12px; border: 1px solid var(--brand-blue); box-shadow: var(--shadow-medium);">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                <div class="form-group">
                    <label>Modalità</label>
                    <select id="pay-mode-${assignment.id}" class="modal-input" onchange="window.updateAssignmentPaymentFieldsVisibility('${assignment.id}')" style="display: block !important; visibility: visible !important; opacity: 1 !important; position: static !important; width: 100% !important; height: 45px !important; appearance: menulist !important; -webkit-appearance: menulist !important; background-color: white !important; color: black !important; border: 1px solid #ccc !important; padding: 0.5rem !important; margin-top: 0.5rem !important; pointer-events: auto !important; z-index: 10 !important;">
                        <option value="saldo" ${currentMode === 'saldo' ? 'selected' : ''}>Saldo alla chiusura del progetto</option>
                        <option value="anticipo_saldo" ${currentMode === 'anticipo_saldo' ? 'selected' : ''}>Anticipo e saldo alla chiusura del progetto</option>
                        <option value="anticipo_rate" ${currentMode === 'anticipo_rate' ? 'selected' : ''}>Anticipo + Rate</option>
                        <option value="rate" ${currentMode === 'rate' ? 'selected' : ''}>Rate</option>
                    </select>
                </div>
                
                <div class="form-group pay-field-deposit" style="display: none;">
                    <label>Anticipo %</label>
                    <input type="number" id="pay-deposit-${assignment.id}" class="modal-input" value="${assignment.deposit_percentage || 30}" min="0" max="100">
                </div>

                <div class="form-group pay-field-installments" style="display: none;">
                    <label>Numero Rate</label>
                    <input type="number" id="pay-installments-count-${assignment.id}" class="modal-input" value="${assignment.installments_count || 1}" min="1">
                </div>
                
                <div class="form-group pay-field-installments" style="display: none;">
                    <label>Frequenza</label>
                    <select id="pay-installments-type-${assignment.id}" class="modal-input" style="display: block !important; visibility: visible !important; opacity: 1 !important; position: static !important; width: 100% !important; height: 45px !important; appearance: menulist !important; -webkit-appearance: menulist !important; background-color: white !important; color: black !important; border: 1px solid #ccc !important; padding: 0.5rem !important; margin-top: 0.5rem !important; pointer-events: auto !important; z-index: 10 !important;">
                        <option value="Mensile" ${assignment.installment_type === 'Mensile' ? 'selected' : ''}>Mensile</option>
                        <option value="Bimestrale" ${assignment.installment_type === 'Bimestrale' ? 'selected' : ''}>Bimestrale</option>
                         <option value="Trimestrale" ${assignment.installment_type === 'Trimestrale' ? 'selected' : ''}>trimestrale</option>
                         <option value="Quadrimestrale" ${assignment.installment_type === 'Quadrimestrale' ? 'selected' : ''}>quadrimestrale</option>
                         <option value="Semestrale" ${assignment.installment_type === 'Semestrale' ? 'selected' : ''}>semestrale</option>
                         <option value="Annuale" ${assignment.installment_type === 'Annuale' ? 'selected' : ''}>annuale</option>
                    </select>
                </div>
            </div>

            <div class="flex-end" style="gap: 1rem;">
                <button class="btn-link" onclick="window.toggleAssignmentConfigEdit('${assignment.id}', false)">Annulla</button>
                <button class="primary-btn" onclick="window.saveAssignmentConfig('${assignment.id}')">Salva Configurazione</button>
            </div>
        </div>
    `;
}

// Global window functions for Assignments
window.assignmentConfigEditState = {};

window.updateAssignmentPaymentFieldsVisibility = (assignmentId) => {
    const modeEl = document.getElementById(`pay-mode-${assignmentId}`);
    if (!modeEl) return;
    const mode = modeEl.value;
    const container = modeEl.closest('.payment-config-edit');

    const toggle = (sel, show) => {
        container.querySelectorAll(sel).forEach(el => el.style.display = show ? 'block' : 'none');
    };

    if (mode === 'saldo') {
        toggle('.pay-field-deposit', false);
        toggle('.pay-field-installments', false);
    } else if (mode === 'anticipo_saldo') {
        toggle('.pay-field-deposit', true);
        toggle('.pay-field-installments', false);
        // Balance is implicit rest
    } else if (mode === 'anticipo_rate') {
        toggle('.pay-field-deposit', true);
        toggle('.pay-field-installments', true);
    } else if (mode === 'rate') {
        toggle('.pay-field-deposit', false);
        toggle('.pay-field-installments', true);
    }
};

window.toggleAssignmentConfigEdit = (assignmentId, isEdit) => {
    window.assignmentConfigEditState[assignmentId] = isEdit;

    // Re-render just the config section
    const container = document.getElementById(`assignment-payment-config-container-${assignmentId}`);
    const assignment = state.assignments.find(a => a.id == assignmentId);
    if (container && assignment) {
        container.innerHTML = renderAssignmentPaymentConfigUI(assignment);

        // If we just enabled edit mode, trigger visibility check and init custom selects
        if (isEdit) {
            setTimeout(() => {
                window.updateAssignmentPaymentFieldsVisibility(assignmentId);

                // Initialize custom selects for the edit form
                const selects = container.querySelectorAll('select');
                selects.forEach(s => new CustomSelect(s));
            }, 0);
        }
    }
};

window.saveAssignmentConfig = async (assignmentId) => {
    const assignment = state.assignments.find(a => a.id == assignmentId);
    if (!assignment) return;

    const mode = document.getElementById(`pay-mode-${assignmentId}`).value;
    const updates = { id: assignmentId, payment_mode: mode };

    if (mode !== 'saldo' && mode !== 'rate') {
        updates.deposit_percentage = parseFloat(document.getElementById(`pay-deposit-${assignmentId}`).value) || 0;
    }
    if (mode.includes('rate') || mode === 'rate') {
        updates.installments_count = parseInt(document.getElementById(`pay-installments-count-${assignmentId}`).value) || 1;
        updates.installment_type = document.getElementById(`pay-installments-type-${assignmentId}`).value;
    }

    try {
        await upsertAssignment(updates);
        showGlobalAlert('Configurazione salvata', 'success');
        window.toggleAssignmentConfigEdit(assignmentId, false);
    } catch (e) {
        console.error("Failed to save assignment config", e);
        showGlobalAlert('Errore nel salvataggio', 'error');
    }
};

// GENERATION LOGIC
window.generateAssignmentPayments = async (assignmentId) => {
    const assignment = state.assignments.find(a => a.id == assignmentId);
    if (!assignment) return showGlobalAlert('Incarico non trovato', 'error');

    // Modal for date
    const modalId = `gen-assign-modal-${Date.now()}`;
    const modalHTML = `
        <div id="${modalId}" class="modal active" style="z-index: 10000; align-items: center; justify-content: center;">
            <div class="modal-content" style="max-width: 400px; padding: 2rem;">
                <h3 style="margin-bottom: 1rem;">Generazione Piano Pagamenti</h3>
                <p style="margin-bottom: 1.5rem; color: var(--text-secondary);">
                    Scegli la data del primo pagamento. Le rate successive saranno calcolate automaticamente.
                </p>
                <div class="flex-column" style="gap: 0.5rem; margin-bottom: 2rem;">
                    <label class="text-caption">Data Inizio</label>
                    <input type="date" id="gen-date-${modalId}" class="modal-input" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="flex-end" style="gap: 1rem;">
                    <button class="btn-link" id="gen-cancel-${modalId}">Annulla</button>
                    <button class="primary-btn" id="gen-confirm-${modalId}">Genera</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const closeModal = () => document.getElementById(modalId).remove();
    document.getElementById(`gen-cancel-${modalId}`).addEventListener('click', closeModal);

    document.getElementById(`gen-confirm-${modalId}`).addEventListener('click', async () => {
        const dateInput = document.getElementById(`gen-date-${modalId}`).value;
        closeModal();
        await executeAssignmentGeneration(assignment, dateInput);
    });
};

async function executeAssignmentGeneration(assignment, startDateStr) {
    const payments = calculateProposedAssignmentPayments(assignment, startDateStr);

    // Save all payments
    try {
        for (const p of payments) {
            await upsertPayment(p);
        }
        await fetchPayments(); // Refresh global payments

        // Refresh UI
        const container = document.getElementById('assignment-tab-content');
        if (container) container.innerHTML = renderAssignmentPaymentPlan(assignment);

        showGlobalAlert(`Piano generato con ${payments.length} pagamenti`, 'success');
    } catch (e) {
        console.error(e);
        showGlobalAlert('Errore nella generazione', 'error');
    }
}

export function calculateProposedAssignmentPayments(assignment, startDateStr) {
    const startDate = startDateStr ? new Date(startDateStr) : new Date();
    const mode = assignment.payment_mode || 'saldo';
    const total = parseFloat(assignment.total_amount) || 0;
    const payments = [];

    const getDueDate = (index, freq = 'Mensile') => {
        const d = new Date(startDate);
        let monthsToAdd = 1;
        if (freq === 'Bimestrale') monthsToAdd = 2;
        if (freq === 'Trimestrale') monthsToAdd = 3;

        d.setMonth(d.getMonth() + (index * monthsToAdd));
        return d.toISOString().split('T')[0];
    };

    if (mode === 'saldo') {
        payments.push({
            title: `Saldo Incarico ${assignment.legacy_id || ''}`,
            amount: total,
            due_date: getDueDate(0),
            payment_mode: 'Saldo',
            status: 'To Do',
            payment_type: 'Collaboratore', // Collaborator is a supplier in money flows
            assignment_id: assignment.id,
            collaborator_id: assignment.collaborator_id,
            order_id: assignment.order_id
        });
    }
    else if (mode === 'anticipo_saldo') {
        const depPct = assignment.deposit_percentage || 30;
        const depVal = total * (depPct / 100);
        payments.push({
            title: `Anticipo (${depPct}%) Incarico ${assignment.legacy_id || ''}`,
            amount: depVal,
            due_date: getDueDate(0),
            payment_mode: 'Anticipo',
            status: 'To Do',
            payment_type: 'Collaboratore',
            assignment_id: assignment.id,
            collaborator_id: assignment.collaborator_id,
            order_id: assignment.order_id
        });
        payments.push({
            title: `Saldo Incarico ${assignment.legacy_id || ''}`,
            amount: total - depVal,
            due_date: getDueDate(1),
            payment_mode: 'Saldo',
            status: 'To Do',
            payment_type: 'Collaboratore',
            assignment_id: assignment.id,
            collaborator_id: assignment.collaborator_id,
            order_id: assignment.order_id
        });
    }
    else if (mode === 'rate') {
        const n = assignment.installments_count || 1;
        const val = total / n;
        for (let i = 0; i < n; i++) {
            payments.push({
                title: `Rata ${i + 1}/${n} Incarico ${assignment.legacy_id || ''}`,
                amount: val,
                due_date: getDueDate(i, assignment.installment_type),
                payment_mode: 'Rata',
                status: 'To Do',
                payment_type: 'Collaboratore',
                assignment_id: assignment.id,
                collaborator_id: assignment.collaborator_id,
                order_id: assignment.order_id
            });
        }
    }
    // Simplification: treat anticipo_rate logic similarly if needed, currently kept basic map
    else if (mode === 'anticipo_rate') {
        const depPct = assignment.deposit_percentage || 30;
        const depVal = total * (depPct / 100);
        const remainder = total - depVal;
        const n = assignment.installments_count || 1;
        const rateVal = remainder / n;

        payments.push({
            title: `Anticipo (${depPct}%) Incarico ${assignment.legacy_id || ''}`,
            amount: depVal,
            due_date: getDueDate(0),
            payment_mode: 'Anticipo',
            status: 'To Do',
            payment_type: 'Collaboratore',
            assignment_id: assignment.id,
            collaborator_id: assignment.collaborator_id,
            order_id: assignment.order_id
        });

        for (let i = 0; i < n; i++) {
            payments.push({
                title: `Rata ${i + 1}/${n} Incarico ${assignment.legacy_id || ''}`,
                amount: rateVal,
                due_date: getDueDate(i + 1, assignment.installment_type),
                payment_mode: 'Rata',
                status: 'To Do',
                payment_type: 'Collaboratore',
                assignment_id: assignment.id,
                collaborator_id: assignment.collaborator_id,
                order_id: assignment.order_id
            });
        }
    }

    return payments;
}

// Manual Modal Wrapper
window.openManualAssignmentPaymentModal = (assignmentId, collaboratorId) => {
    // We reuse the basic openPaymentModal but pre-fill data logic would need a specific modal
    // For now, let's inject a specialized modal or rely on a generic one if exists
    // Simplest: Create a specialized manual modal for assignments
    const modalId = `manual-assign-pay-${Date.now()}`;
    const modalHTML = `
        <div id="${modalId}" class="modal active" style="z-index: 10000; align-items: center; justify-content: center;">
            <div class="modal-content" style="max-width: 500px; padding: 2rem;">
                <h3 style="margin-bottom: 1.5rem;">Nuovo Pagamento Manuale</h3>
                <div class="flex-column" style="gap: 1rem; margin-bottom: 2rem;">
                    <div class="form-group">
                        <label>Titolo</label>
                        <input type="text" id="manual-title-${modalId}" class="modal-input" placeholder="Es. Acconto Extra">
                    </div>
                    <div class="form-group">
                        <label>Importo (€)</label>
                        <input type="number" id="manual-amount-${modalId}" class="modal-input" placeholder="0.00">
                    </div>
                    <div class="form-group">
                        <label>Data Scadenza</label>
                         <input type="date" id="manual-date-${modalId}" class="modal-input">
                    </div>
                </div>
                <div class="flex-end" style="gap: 1rem;">
                    <button class="btn-link" onclick="document.getElementById('${modalId}').remove()">Annulla</button>
                    <button class="primary-btn" id="manual-save-${modalId}">Salva</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById(`manual-save-${modalId}`).addEventListener('click', async () => {
        const title = document.getElementById(`manual-title-${modalId}`).value;
        const amount = parseFloat(document.getElementById(`manual-amount-${modalId}`).value);
        const date = document.getElementById(`manual-date-${modalId}`).value;

        if (!title || !amount) return showGlobalAlert('Inserisci titolo e importo', 'error');

        await upsertPayment({
            title,
            amount,
            due_date: date || null,
            payment_type: 'Fornitore',
            status: 'To Do',
            assignment_id: assignmentId,
            collaborator_id: collaboratorId,
            // We could link order_id too if we fetch mapped assignment
        });

        document.getElementById(modalId).remove();
        await fetchPayments();
        // Refresh UI
        const assignment = state.assignments.find(a => a.id == assignmentId);
        if (assignment) {
            const container = document.getElementById('assignment-tab-content');
            if (container) container.innerHTML = renderAssignmentPaymentPlan(assignment);
        }
    });
};

export function renderAssignmentsDashboard(container) {
    const updateUI = () => {
        const selectedStatus = state.assignmentsStatusFilter || 'all';
        const uniqueStatuses = ['all', ...new Set(state.assignments.map(a => a.status).filter(s => s))].sort();

        let filtered = state.assignments.filter(a => {
            if (selectedStatus !== 'all' && a.status !== selectedStatus) return false;
            if (state.searchTerm) {
                const term = state.searchTerm.toLowerCase();
                return (
                    (a.legacy_id && a.legacy_id.toLowerCase().includes(term)) ||
                    (a.description && a.description.toLowerCase().includes(term)) ||
                    (a.collaborators?.full_name && a.collaborators.full_name.toLowerCase().includes(term)) ||
                    (a.orders?.clients?.business_name && a.orders.clients.business_name.toLowerCase().includes(term)) ||
                    (a.orders?.order_number && a.orders.order_number.toLowerCase().includes(term))
                );
            }
            return true;
        });

        const cardsHtml = filtered.map(a => {
            const collabName = a.collaborators?.full_name || 'N/A';
            const clientName = a.orders?.clients?.business_name || 'Cliente Sconosciuto';
            const orderCode = a.orders?.order_number || '';
            const legacyId = a.legacy_id || '';

            return `
            <div class="glass-card assignment-card" onclick="window.location.hash='#assignment-detail/${a.id}'" style="cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; padding: 1.5rem; display: flex; flex-direction: column; align-items: flex-start; gap: 0.4rem;">
                <h3 style="font-family: var(--font-titles); font-weight: 400; font-size: 1.2rem; margin: 0; color: var(--text-primary);">${collabName}</h3>
                
                <div style="background: white; border: 1px solid var(--glass-border); padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 400; color: var(--text-secondary); margin: 0.4rem 0 0.8rem 0; box-shadow: var(--shadow-small);">
                    ${orderCode}
                </div>
                
                <div style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.8em;">
                    ${a.description || 'Nessuna descrizione'}
                </div>

                <div style="font-size: 0.9rem; color: var(--text-tertiary); font-weight: 500;">
                    ${clientName}
                </div>

                <div style="font-size: 0.8rem; color: var(--text-tertiary); font-family: monospace; margin-top: 0.4rem; opacity: 0.7;">
                    ${legacyId}
                </div>
            </div>
           `;
        }).join('');

        container.innerHTML = `
            <div class="animate-fade-in" style="max-width: 1400px; margin: 0 auto; padding-bottom: 4rem;">
                <div class="section-header" style="background: var(--card-bg); padding: 1.5rem 1.5rem; border-radius: 20px; border: 1px solid var(--glass-border); margin-bottom: 2rem; backdrop-filter: blur(10px); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h2 style="font-family: var(--font-titles); font-weight: 400; margin: 0; font-size: 1.5rem;">Gestione Incarichi</h2>
                        <span style="font-size: 0.85rem; color: var(--text-secondary);">${filtered.length} incarichi visualizzati</span>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                        <span style="font-size: 0.75rem; font-weight: 400; color: var(--text-tertiary); text-transform: uppercase;">Stato Incarico</span>
                        <div style="display: flex; background: rgba(0,0,0,0.03); padding: 0.25rem; border-radius: 12px; border: 1px solid var(--glass-border); flex-wrap: wrap; gap: 0.25rem;">
                            ${uniqueStatuses.map(s => `
                                <button class="pill-item ${s === selectedStatus ? 'active' : ''}" data-status="${s}">
                                    ${s === 'all' ? 'Tutti' : s}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem;">
                    ${filtered.length > 0 ? cardsHtml : `
                        <div style="grid-column: 1/-1; text-align: center; padding: 6rem 2rem; background: var(--glass-bg); border-radius: 24px; border: 2px dashed var(--glass-border);">
                            <div style="width: 80px; height: 80px; background: rgba(78, 146, 216, 0.05); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                                <span class="material-icons-round" style="font-size: 3rem; color: var(--text-tertiary);">search_off</span>
                            </div>
                            <h2 style="font-family: var(--font-titles); font-weight: 400; margin-bottom: 0.5rem;">Nessun incarico trovato</h2>
                            <p style="color: var(--text-secondary);">Prova a cambiare i filtri o la ricerca.</p>
                        </div>
                    `}
                </div>
            </div>
        `;

        // Attach listeners
        container.querySelectorAll('.pill-item').forEach(btn => {
            btn.addEventListener('click', () => {
                state.assignmentsStatusFilter = btn.dataset.status;
                updateUI();
            });
        });
    };

    updateUI();

    // Auto-run migration silently
    if (window.migrateLegacyAssignments) {
        setTimeout(() => window.migrateLegacyAssignments(true), 1500);
    }
}

// MIGRATION TOOL: Fix for "Legacy Data Hole"
// User can run window.migrateLegacyAssignments() from console to fix missing configs.
window.migrateLegacyAssignments = async (auto = false) => {
    if (!state.assignments) {
        showGlobalAlert('Nessun incarico caricato. Attendi il caricamento...', 'warning');
        return;
    }

    // Helper to normalize percentage
    const parsePercent = (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            const clean = val.replace('%', '').replace(',', '.').trim();
            return clean ? parseFloat(clean) : 0;
        }
        return 0;
    };

    // Helper to normalize number
    const parseNumber = (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            const clean = val.replace(',', '.').trim();
            return clean ? parseFloat(clean) : 0;
        }
        return 0;
    };

    console.log(`Starting Migration Check on ${state.assignments.length} assignments...`);
    const updates = [];

    // MASTER MIGRATION MAP (Generated from Incarichi.csv source of truth)
    // This allows exact restoration of original payment terms.
    const masterMap = { "24-0011-zqExI": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0002-bjsuM": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0012-c0dJ9": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0010-wWYaM": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0001-FltmM": { "payment_mode": "anticipo_rate", "installments_count": 2, "deposit_percentage": 50.0, "installment_type": "Trimestrale" }, "24-0013-dsaUD": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0016-rUGsj": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0016-mHNcS": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0003-ufRay": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0003-LwGUo": { "payment_mode": "rate", "installments_count": 4, "installment_type": "Trimestrale" }, "24-0004-QZ8vY": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0008-N5Pme": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0008-H7r3s": { "payment_mode": "rate", "installments_count": 8, "installment_type": "Trimestrale" }, "24-0009-qOiD6": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0009-da7rg": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0018-yZhTN": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0011-6q9xj": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0011-hswNK": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0020-cgnI9": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0030-htmGS": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0036-ClGu4": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0031-O7SjZ": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0031-Q3DUy": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0020-v0n6o": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0020-3qTxe": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0020-t0q1B": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0031-NstGP": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0042-cgTEj": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0001-jFm9z": { "payment_mode": "anticipo_saldo", "deposit_percentage": 50.0 }, "25-0003-Wnzjv": { "payment_mode": "saldo", "balance_percentage": 100 }, "GLY-2503-cHnuG": { "payment_mode": "anticipo_saldo", "deposit_percentage": 30.0 }, "24-0018-WwSnW": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0007-7iHKK": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0018-InbqK": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0011-MaYNX": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0011-bGoMk": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0011-hGuqx": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0008-AuJCk": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0008-nmNTK": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0008-34G30": { "payment_mode": "saldo", "balance_percentage": 100 }, "24-0008-RM0hi": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0015-PC61g": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0013-2VdRI": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0014-RHPST": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0013-fJkFh": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0014-PsiU5": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0014-TzFlP": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0016-Eym6C": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0016-Z2eBI": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0017-1ghc4": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0019-xVebT": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0020-KoRww": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0022-xxd7y": { "payment_mode": "anticipo_rate", "deposit_percentage": 30.0 }, "25-0025-UHSfV": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0025-Q61CE": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0026-tYGJD": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0029-kjBcD": { "payment_mode": "saldo", "balance_percentage": 100 }, "25-0029-xwv0s": { "payment_mode": "saldo", "balance_percentage": 100 } };

    for (const a of state.assignments) {
        // Use EXACT MATCH from Master Map if available
        // Matches DB legacy_id (or description/id if legacy_id missing) against CSV 'Name'
        const legacyId = a.legacy_id || a.id;

        let exactConfig = masterMap[legacyId];

        // If no exact match, try stripping suffix (e.g. 24-0011-abc match 24-0011) ?
        // Actually the CSV keys are like 24-0011-zqExI which IS the legacy_id

        if (exactConfig) {
            // Force update if current is 'saldo' (default) but map says otherwise, 
            // OR if we just want to enforce truth.
            // Let's enforce if map is different from current.

            // Force update from Master Map if found. 
            // Trust the CSV source of truth completely, but ONLY if they actually differ
            // to avoid infinite loops.
            const needsUpdate = Object.keys(exactConfig).some(key => a[key] !== exactConfig[key]);
            if (needsUpdate) {
                updates.push({ ...a, ...exactConfig });
            }
        }
    }

    if (updates.length === 0) {
        console.log("No legacy data candidates found. Migration skipped.");
        return;
    }

    // Auto mode skips confirmation
    if (!auto) {
        if (!await window.showConfirm(`Trovati ${updates.length} incarichi legacy. Procedere con la migrazione?`)) return;
    }

    if (!auto) showGlobalAlert(`Migrazione in corso (${updates.length})...`, 'info');
    else console.log(`Auto-migrating ${updates.length} assignments...`);

    try {
        let successCount = 0;
        // Batch not supported by upsertAssignment, so loop
        for (const update of updates) {
            try {
                await upsertAssignment(update);
                successCount++;
            } catch (e) {
                console.error(`Migration failed for ${update.id}`, e);
            }
        }
        if (!auto) showGlobalAlert('Migrazione completata. Ricarico...', 'success');
        console.log('Migration completed successfully.');
        setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
        console.error(err);
        showGlobalAlert('Errore migrazione. Vedi console.', 'error');
    }
};

// --- NEW INTERACTIVE FUNCTIONS ---

window.deleteAssignment = async (id) => {
    const confirmed = await window.showConfirm('Sei sicuro di voler eliminare questo incarico? L\'azione è irreversibile.', 'Elimina Incarico');
    if (!confirmed) return;

    try {
        await deleteAssignment(id);

        // --- REACTIVE STATE UPDATE ---
        if (state.assignments) {
            state.assignments = state.assignments.filter(a => a.id !== id);
        }

        showGlobalAlert('Incarico eliminato con successo', 'success');

        // --- SMART NAVIGATION ---
        // Instead of hardcoding #assignments, we go back to the previous context
        // (which could be the order detail or the assignments list)
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.hash = '#assignments';
        }
    } catch (e) {
        console.error('Delete failed:', e);
        showGlobalAlert('Errore durante l\'eliminazione', 'error');
    }
};

window.handleAssignmentStatusChange = async (id, newStatus) => {
    try {
        const updated = await upsertAssignment({ id, status: newStatus });

        // --- REACTIVE STATE UPDATE ---
        if (state.assignments) {
            const index = state.assignments.findIndex(a => a.id === id);
            if (index !== -1) {
                state.assignments[index] = { ...state.assignments[index], ...updated };
            }
        }

        showGlobalAlert(`Stato aggiornato a ${newStatus}`, 'success');

        // Refresh the current detail view if we are on it
        const container = document.getElementById('main-content');
        if (container && window.location.hash.includes(`assignment-detail/${id}`)) {
            // Re-render the detail page with the updated state
            // Note: renderAssignmentDetail uses fetchAssignmentDetail, which will get fresh data
            await renderAssignmentDetail(container);
        }
    } catch (e) {
        console.error('Status update failed:', e);
        showGlobalAlert('Errore nell\'aggiornamento dello stato', 'error');
    }
};

// Global listener to close status selector when clicking outside
// (Note: CustomSelect handles its own closing, this was for the manual menu)
