import { state } from '../modules/state.js?v=116';
import { formatAmount, showGlobalAlert } from '../modules/utils.js?v=116';
import { upsertPayment, deletePayment, upsertOrder, updateOrder, updateOrderEconomics, fetchPayments, fetchOrders, fetchAssignments, fetchCollaborators, fetchServices, addOrderAccount, removeOrderAccount, addOrderContact, removeOrderContact, fetchOrderContacts } from '../modules/api.js?v=116';
import { openPaymentModal } from './payments.js?v=116';

// ... (existing code) ...

function getStatusColor(status) {
    const s = status?.toLowerCase() || '';
    if (s.includes('prev')) return '#3b82f6';
    if (s.includes('lavo') || s.includes('corso')) return '#f59e0b';
    if (s.includes('chiuso') || s.includes('finito') || s.includes('complet')) return '#10b981';
    if (s.includes('annull')) return '#94a3b8';
    return '#6366f1';
}

export async function renderOrderDetail(container, orderId) {
    if (!orderId) {
        const hash = window.location.hash;
        const parts = hash.split('/');
        orderId = parts[parts.length - 1];
    }
    if (!orderId) {
        orderId = state.currentId;
    }
    if (!orderId) return;

    if (!state.orders || state.orders.length === 0) await fetchOrders();
    if (!state.collaborators || state.collaborators.length === 0) await fetchCollaborators();
    if (!state.payments) await fetchPayments();
    if (!state.assignments) await fetchAssignments();
    if (!state.services) await fetchServices();
    if (!state.collaboratorServices || state.collaboratorServices.length === 0) {
        const { fetchCollaboratorServices } = await import('../modules/api.js?v=116');
        await fetchCollaboratorServices();
    }

    renderManualPaymentModal();
    initOrderPaymentModals();
    initOrderEconomicsModal();
    initOrderPeopleModals();
    initOrderPaymentModals();
    initOrderEconomicsModal();
    initOrderPeopleModals();
    initOrderAssignmentModal();
    initOrderModal();

    const order = state.orders.find(o => o.id === orderId);
    if (!order) {
        container.innerHTML = '<div class="p-4">Ordine non trovato.</div>';
        return;
    }

    let accountList = (order.order_collaborators || [])
        .filter(oc => oc.role_in_order === 'Account')
        .map(oc => oc.collaborators);

    if (accountList.length === 0 && order.account) {
        accountList.push(order.account);
    }
    accountList = [...new Map(accountList.filter(Boolean).map(item => [item['id'], item])).values()];

    let contactsList = [];
    try {
        const rawContacts = await fetchOrderContacts(orderId);
        contactsList = rawContacts.map(rc => rc.contacts);
    } catch (e) {
        console.warn("Error fetching contacts list", e);
    }
    if (contactsList.length === 0 && order.contacts) {
        contactsList.push(order.contacts);
    }
    contactsList = [...new Map(contactsList.filter(Boolean).map(item => [item['id'], item])).values()];

    const linkedServices = state.collaboratorServices ? state.collaboratorServices.filter(s => s.order_id === order.id) : [];
    const servicesPrice = linkedServices.reduce((sum, s) => sum + (parseFloat(s.total_price) || 0), 0);
    const servicesCost = linkedServices.reduce((sum, s) => sum + (parseFloat(s.total_cost) || 0), 0);

    const priceFinal = parseFloat(order.price_final) || 0;
    const costFinal = parseFloat(order.cost_final) || 0;
    const revenueFinal = priceFinal - costFinal;
    const marginFinal = priceFinal > 0 ? Math.round((revenueFinal / priceFinal) * 100) : 0;

    const priceDelta = servicesPrice > 0 ? parseFloat(((priceFinal - servicesPrice) / servicesPrice * 100).toFixed(1)) : 0;
    const costDelta = servicesCost > 0 ? parseFloat(((costFinal - servicesCost) / servicesCost * 100).toFixed(1)) : 0;

    const statusColor = getStatusColor(order.status_works || order.status);

    const linkedAssignments = state.assignments ? state.assignments.filter(a =>
        a.order_id === order.id ||
        (a.orders && a.orders.order_id === order.id) ||
        (a.legacy_order_id && a.legacy_order_id === order.order_number)
    ) : [];

    const getInitials = (name) => {
        if (!name) return '??';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    const getAvatarColor = (name) => {
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    container.innerHTML = `
        <div class="animate-fade-in" style="max-width: 1400px; margin: 0 auto; padding: 1rem;">
            <!-- Header Section -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; background: var(--bg-secondary); padding: 1.5rem 2rem; border-radius: 16px; border: 1px solid var(--glass-border);">
                <div style="display: flex; align-items: center; gap: 1.25rem;">
                    <div style="width: 56px; height: 56px; border-radius: 14px; background: linear-gradient(135deg, var(--brand-blue), #2563eb); display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(37, 99, 235, 0.2);">
                        <span class="material-icons-round" style="color: white; font-size: 28px;">receipt</span>
                    </div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.4rem;">
                             <h1 style="font-size: 1.75rem; font-weight: 700; margin: 0; color: var(--text-primary); font-family: var(--font-titles); letter-spacing: -0.02em;">Ordine ${order.order_number}</h1>
                             <span class="status-badge" style="background: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}30; font-size: 0.75rem; padding: 4px 12px; border-radius: 2rem; font-weight: 600;">${order.status_works || order.status}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 1rem; color: var(--text-tertiary); font-size: 0.85rem;">
                            <span style="display: flex; align-items: center; gap: 0.4rem;"><span class="material-icons-round" style="font-size: 1rem;">calendar_today</span> ${new Date(order.created_at).toLocaleDateString()}</span>
                            <span style="display: flex; align-items: center; gap: 0.4rem;"><span class="material-icons-round" style="font-size: 1rem;">business</span> ${order.clients?.client_code || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                <div style="display: flex; gap: 0.75rem;">
                    <button class="primary-btn secondary" onclick="window.history.back()" style="padding: 0.6rem 1.25rem; border-radius: 10px;">
                        <span class="material-icons-round">arrow_back</span> Indietro
                    </button>
                    <button class="primary-btn" onclick="window.editOrder('${order.id}')" style="padding: 0.6rem 1.25rem; border-radius: 10px;">
                        <span class="material-icons-round">edit</span> Modifica Ordine
                    </button>
                    <button class="primary-btn secondary" style="padding: 0.6rem; border-radius: 10px;"><span class="material-icons-round">more_vert</span></button>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; align-items: start;">
                <!-- Column 1: Basics & Team -->
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <div class="glass-card" style="padding: 1.25rem;">
                        <div style="color: var(--text-tertiary); font-size: 0.65rem; font-weight: 500; text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 0.05em;">Cliente</div>
                        <div style="font-size: 0.95rem; font-weight: 600; color: var(--brand-blue); margin-bottom: 0.2rem;">${order.clients?.client_code || '-'}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary); opacity: 0.8;">${order.clients?.business_name || '-'}</div>
                    </div>

                    <div class="glass-card" style="padding: 1.5rem;">
                        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem;">Persone & Team</h3>
                        
                        <div style="margin-bottom: 1.5rem;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);">Account Manager</label>
                                <button onclick="window.openAddOrderAccountModal('${order.id}')" style="background:none; border:none; color:var(--brand-blue); font-size:0.7rem; cursor:pointer;">+ Aggiungi</button>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                ${accountList.map(acc => `
                                    <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-secondary); padding: 0.5rem; border-radius: 8px;">
                                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                                            <div style="width: 24px; height: 24px; border-radius: 50%; background: ${getAvatarColor(acc.full_name)}; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.65rem;">${getInitials(acc.full_name)}</div>
                                            <span style="font-size: 0.85rem; font-weight: 600;">${acc.full_name}</span>
                                        </div>
                                        <button onclick="window.removeOrderAccount('${order.id}', '${acc.id}')" style="background:none; border:none; color:var(--text-tertiary); cursor:pointer;"><span class="material-icons-round" style="font-size: 1rem;">close</span></button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);">Referenti Cliente</label>
                                <button onclick="window.openAddOrderContactModal('${order.id}')" style="background:none; border:none; color:var(--brand-blue); font-size:0.7rem; cursor:pointer;">+ Aggiungi</button>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                ${contactsList.map(cont => `
                                    <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-secondary); padding: 0.5rem; border-radius: 8px;">
                                        <span style="font-size: 0.85rem; font-weight: 600;">${cont.full_name}</span>
                                        <button onclick="window.removeOrderContact('${order.id}', '${cont.id}')" style="background:none; border:none; color:var(--text-tertiary); cursor:pointer;"><span class="material-icons-round" style="font-size: 1rem;">close</span></button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Column 2: Team & Assignments -->
                <div class="glass-card" style="padding: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem;">
                        <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0;">Team & Incarichi</h3>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="badge" style="background: rgba(59, 130, 246, 0.1); color: var(--brand-blue); font-weight: 600;">${linkedAssignments.length}</span>
                            <button onclick="window.openAddAssignmentModal('${order.id}')" style="background:none; border:none; color:var(--brand-blue); font-size:0.7rem; cursor:pointer; font-weight: 600;">+ Aggiungi</button>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">

                        ${linkedAssignments.map(a => {
        // Find linked services for this assignment
        // We need to ensure state.collaboratorServices is populated or available
        const linkedServices = (state.collaboratorServices || []).filter(s => s.assignment_id === a.id);

        return `
                                <div class="glass-card clickable-card" style="padding: 1rem; background: var(--bg-secondary); cursor: pointer; display: flex; flex-direction: column; gap: 0.75rem;" onclick="window.location.hash='#assignment-detail/${a.id}'">
                                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                                        <div style="width: 36px; height: 36px; border-radius: 50%; background: ${getAvatarColor(a.collaborators?.full_name || 'C')}; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; box-shadow: var(--shadow-sm);">${getInitials(a.collaborators?.full_name || 'C')}</div>
                                        <div style="flex: 1;">
                                            <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">${a.collaborators?.full_name || 'Collaboratore'}</div>
                                            <div style="font-size: 0.75rem; color: var(--text-tertiary); display: flex; align-items: center; gap: 0.4rem;">
                                                <span class="status-dot ${a.status === 'Completed' ? 'success' : (a.status === 'In Progress' ? 'warning' : 'neutral')}"></span>
                                                ${a.status || 'Attivo'}
                                            </div>
                                        </div>
                                        <div style="text-align: right;">
                                             <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">${formatAmount(a.total_amount)}€</div>
                                             <div style="font-size: 0.7rem; color: var(--text-tertiary);">Totale</div>
                                        </div>
                                    </div>

                                    ${linkedServices.length > 0 ? `
                                        <div style="border-top: 1px solid var(--glass-border); padding-top: 0.75rem;">
                                            <div style="font-size: 0.65rem; text-transform: uppercase; color: var(--text-tertiary); font-weight: 600; margin-bottom: 0.4rem; letter-spacing: 0.05em;">Servizi Inclusi</div>
                                            <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
                                                ${linkedServices.map(s => `
                                                    <span style="background: white; border: 1px solid var(--glass-border); padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; color: var(--text-secondary); display: inline-flex; align-items: center;">
                                                        ${s.name} ${s.quantity > 1 ? `<span style="opacity: 0.6; margin-left: 4px; font-size: 0.7rem;">x${s.quantity}</span>` : ''}
                                                    </span>
                                                `).join('')}
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            `;
    }).join('')}
                    </div>
                </div>

                <!-- Column 3: Economics & Modules -->
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <!-- Prezzi Finali Card -->
                    <div class="glass-card editable-card" onclick="window.editOrderEconomics('${order.id}')" style="padding: 1.5rem; background: var(--bg-secondary); cursor: pointer; border: 1px solid var(--glass-border);">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
                            <div style="display: flex; align-items: center; gap: 0.6rem;">
                                <div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; background: rgba(59, 130, 246, 0.1);">
                                    <span class="material-icons-round" style="font-size: 1.1rem; color: var(--brand-blue);">receipt_long</span>
                                </div>
                                <span style="font-weight: 700; font-size: 1rem; color: var(--text-primary); font-family: var(--font-titles);">Prezzi Finali</span>
                            </div>
                            <span class="material-icons-round" style="font-size: 1rem; color: var(--text-tertiary); opacity: 0.5;">edit</span>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                            <!-- Prezzi section -->
                            <div>
                                <div style="font-size: 0.65rem; text-transform: uppercase; color: var(--text-tertiary); font-weight: 700; letter-spacing: 0.05em; margin-bottom: 0.4rem;">Prezzi</div>
                                <div style="font-size: 1.75rem; font-weight: 800; color: #10b981; font-family: var(--font-titles); line-height: 1;">
                                    ${priceFinal > 0 ? formatAmount(priceFinal) + '€' : '—'}
                                </div>
                                ${priceDelta != 0 ? `
                                    <div style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: ${priceDelta < 0 ? '#ef4444' : '#10b981'}; font-weight: 600; margin-top: 0.6rem;">
                                        <span class="material-icons-round" style="font-size: 1rem;">${priceDelta < 0 ? 'arrow_downward' : 'arrow_upward'}</span>
                                        <span>${priceDelta > 0 ? '+' : ''}${priceDelta}% vs tariffario</span>
                                    </div>
                                ` : ''}
                            </div>

                            <div style="height: 1px; background: var(--glass-border); opacity: 0.6;"></div>

                            <!-- Costi section -->
                            <div>
                                <div style="font-size: 0.65rem; text-transform: uppercase; color: var(--text-tertiary); font-weight: 700; letter-spacing: 0.05em; margin-bottom: 0.4rem;">Costi</div>
                                <div style="font-size: 1.75rem; font-weight: 800; color: #ef4444; font-family: var(--font-titles); line-height: 1;">
                                    ${costFinal > 0 ? formatAmount(costFinal) + '€' : '—'}
                                </div>
                                ${costDelta != 0 ? `
                                    <div style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: ${costDelta > 0 ? '#ef4444' : '#10b981'}; font-weight: 600; margin-top: 0.6rem;">
                                        <span class="material-icons-round" style="font-size: 1rem;">${costDelta > 0 ? 'arrow_upward' : 'arrow_downward'}</span>
                                        <span>${costDelta > 0 ? '+' : ''}${costDelta}% vs tariffario</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Ricavi Finali Card -->
                    <div class="glass-card" style="padding: 1.25rem; background: linear-gradient(135deg, ${revenueFinal >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)'}, transparent); border: 2px solid ${revenueFinal >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'};">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                            <div style="flex: 1;">
                                <div style="font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); font-weight: 600; margin-bottom: 0.25rem;">Ricavi Finali (Margine)</div>
                                <div style="font-size: 1.6rem; font-weight: 800; line-height: 1; color: ${revenueFinal >= 0 ? '#10b981' : '#ef4444'}; font-family: var(--font-titles);">
                                    ${priceFinal > 0 && costFinal > 0 ? formatAmount(revenueFinal) + '€' : '—'}
                                </div>
                            </div>
                            <!-- Circular Progress -->
                            ${priceFinal > 0 && costFinal > 0 ? `
                                <div style="position: relative; width: 60px; height: 60px;">
                                    <svg width="60" height="60" style="transform: rotate(-90deg);">
                                        <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(0,0,0,0.05)" stroke-width="5"></circle>
                                        <circle cx="30" cy="30" r="26" fill="none" 
                                            stroke="${marginFinal >= 20 ? '#10b981' : marginFinal >= 10 ? '#f59e0b' : '#ef4444'}" 
                                            stroke-width="5" 
                                            stroke-dasharray="${(marginFinal / 100) * 163.3} 163.3"
                                            stroke-linecap="round">
                                        </circle>
                                    </svg>
                                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                                        <div style="font-size: 0.85rem; font-weight: 800; color: ${marginFinal >= 20 ? '#10b981' : marginFinal >= 10 ? '#f59e0b' : '#ef4444'};">${marginFinal}%</div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>



                    <div class="glass-card" style="padding: 1rem; background: var(--bg-tertiary); cursor: pointer;" onclick="const d = this.querySelector('.servizi-details'); d.style.display = d.style.display === 'none' ? 'block' : 'none';">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 600; font-size: 0.85rem;"><span class="material-icons-round" style="font-size: 1rem; color: var(--text-secondary);">construction</span> Servizi</div>
                            <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary);">expand_more</span>
                        </div>
                        
                        <div class="servizi-summary" style="margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.4rem;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase;">
                                <span>Prezzo da Tariffario</span>
                                <span style="font-weight: 700; color: var(--text-primary);">${formatAmount(servicesPrice)}€</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase;">
                                <span>Costi da Tariffario</span>
                                <span style="font-weight: 700; color: var(--text-primary);">${formatAmount(servicesCost)}€</span>
                            </div>
                        </div>
                        
                        <div class="servizi-details" style="display: none; margin-top: 1rem; border-top: 1px solid var(--glass-border); padding-top: 1rem;" onclick="event.stopPropagation();">
                             ${linkedServices.map(s => {
        const serviceName = s.services?.name || s.legacy_service_name || s.name || 'Servizio';
        const collabName = s.collaborators?.full_name || s.legacy_collaborator_name || 'Non assegnato';
        return `
                                 <div style="padding: 0.6rem; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 0.6rem; border: 1px solid var(--glass-border); cursor: pointer;" onclick="window.openCollaboratorServiceDetail('${s.id}')">
                                     <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.15rem;">${serviceName}</div>
                                     <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.7rem; color: var(--text-tertiary);">
                                         <span>${collabName}</span>
                                         <span style="font-weight: 600; color: #ef4444;">${formatAmount(s.total_cost)}€</span>
                                     </div>
                                 </div>
                                 `;
    }).join('')}
                             <button onclick="window.openCollaboratorServiceEdit(null, '${order.id}')" style="width: 100%; border: none; background: var(--brand-gradient); color: white; font-size: 0.75rem; font-weight: 500; padding: 0.7rem; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.4rem; margin-top: 0.5rem;">
                                 <span class="material-icons-round" style="font-size: 1rem;">add</span>
                                 <span>Aggiungi Servizio</span>
                             </button>
                        </div>
                    </div>

                    <!-- Payments Collapsible -->
                    ${(() => {
            const orderPayments = state.payments ? state.payments.filter(p => p.order_id === order.id) : [];
            const activeOnes = orderPayments.filter(p => p.payment_type === 'Cliente' || !p.payment_type);
            const passiveOnes = orderPayments.filter(p => p.payment_type === 'Collaboratore');
            const isSaldato = (s) => s && ['DONE', 'SALDATA', 'SALDATO', 'COMPLETATO'].includes(s.toUpperCase());

            return `
                            <div class="glass-card" style="padding: 1rem; background: var(--bg-tertiary); cursor: pointer;" onclick="const d = this.querySelector('.pagamenti-details'); d.style.display = d.style.display === 'none' ? 'block' : 'none';">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 600; font-size: 0.85rem;"><span class="material-icons-round" style="font-size: 1rem; color: var(--text-secondary);">payments</span> Pagamenti</div>
                                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                                        <div style="font-size: 0.6rem; padding: 2px 5px; border-radius: 4px; background: rgba(59, 130, 246, 0.1); color: #3b82f6; font-weight: 700;">${activeOnes.length} A</div>
                                        <div style="font-size: 0.6rem; padding: 2px 5px; border-radius: 4px; background: rgba(239, 68, 68, 0.1); color: #ef4444; font-weight: 700;">${passiveOnes.length} P</div>
                                        <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary);">expand_more</span>
                                    </div>
                                </div>

                                <div class="pagamenti-summary" style="display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.5rem; border-top: 1px solid var(--glass-border); padding-top: 0.5rem;">
                                    ${(() => {
                    const getSums = (list, total) => {
                        const done = list.filter(p => isSaldato(p.status)).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                        const todo = list.filter(p => !isSaldato(p.status)).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                        return { done, todo };
                    };
                    const clientSums = getSums(activeOnes, order.total_price || 0);
                    const collabSums = getSums(passiveOnes, servicesCost || 0);

                    return `
                                            <div style="display: flex; justify-content: space-between; font-size: 0.65rem; align-items: center;">
                                                <span style="color: var(--text-tertiary); text-transform: uppercase; font-weight: 500;">Clienti</span>
                                                <div style="display: flex; gap: 0.5rem; align-items: center;">
                                                    <span style="color: var(--text-secondary);">Saldato <b style="color: var(--text-primary); font-weight: 600;">${formatAmount(clientSums.done)}€</b></span>
                                                    ${clientSums.todo > 0.9 ? `<span style="color: var(--text-tertiary);">Attesa <b style="color: var(--warning-soft); font-weight: 600;">${formatAmount(clientSums.todo)}€</b></span>` : ''}
                                                </div>
                                            </div>
                                            <div style="display: flex; justify-content: space-between; font-size: 0.65rem; align-items: center;">
                                                <span style="color: var(--text-tertiary); text-transform: uppercase; font-weight: 500;">Collaboratori</span>
                                                <div style="display: flex; gap: 0.5rem; align-items: center;">
                                                    <span style="color: var(--text-secondary);">Saldato <b style="color: var(--text-primary); font-weight: 600;">${formatAmount(collabSums.done)}€</b></span>
                                                    ${collabSums.todo > 0.9 ? `<span style="color: var(--text-tertiary);">Attesa <b style="color: var(--warning-soft); font-weight: 600;">${formatAmount(collabSums.todo)}€</b></span>` : ''}
                                                </div>
                                            </div>
                                        `;
                })()}
                                </div>
                                <div class="pagamenti-details" style="display: none; margin-top: 1rem; border-top: 1px solid var(--glass-border); padding-top: 1rem;" onclick="event.stopPropagation();">
                                    <div id="order-payment-config-container-${order.id}" style="margin-bottom: 1rem; padding: 0.75rem; background: var(--glass-highlight); border-radius: 12px; border: 1px solid var(--glass-border);">
                                        ${renderOrderPaymentConfigUI(order)}
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                        ${activeOnes.length > 0 ? activeOnes.map(p => `
                                            <div style="padding: 0.6rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--glass-border); cursor: pointer;" onclick="window.openPaymentModal('${p.id}')">
                                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
                                                    <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary);">${p.title || 'Pagamento'}</span>
                                                    <span style="font-size: 0.8rem; font-weight: 700; color: var(--brand-blue);">${formatAmount(p.amount)}€</span>
                                                </div>
                                                <div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: var(--text-tertiary);">
                                                    <span>${p.due_date ? new Date(p.due_date).toLocaleDateString() : '-'}</span>
                                                    <span class="status-badge" style="padding: 2px 6px; font-size: 0.6rem; border-radius: 4px; background: ${isSaldato(p.status) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'}; color: ${isSaldato(p.status) ? 'var(--success-soft)' : 'var(--warning-soft)'}; border: none;">${p.status}</span>
                                                </div>
                                            </div>
                                        `).join('') : '<div style="font-size: 0.7rem; color: var(--text-tertiary); text-align: center; padding: 1rem;">Nessun pagamento generato</div>'}
                                    </div>

                                    ${passiveOnes.length > 0 ? `
                                        <div style="margin-top: 1.25rem;">
                                            <div style="font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.75rem; font-weight: 700; border-top: 1px solid var(--glass-border); padding-top: 1rem;">Uscite (Collaboratori)</div>
                                            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                                ${passiveOnes.map(p => `
                                                    <div style="padding: 0.6rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--glass-border); cursor: pointer;" onclick="window.openPaymentModal('${p.id}')">
                                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
                                                            <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary);">${p.collaborators?.full_name || 'Collaboratore'}</span>
                                                            <span style="font-size: 0.8rem; font-weight: 700; color: #ef4444;">${formatAmount(p.amount)}€</span>
                                                        </div>
                                                        <div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: var(--text-tertiary);">
                                                            <span>${p.due_date ? new Date(p.due_date).toLocaleDateString() : '-'}</span>
                                                            <span class="status-badge" style="padding: 2px 6px; font-size: 0.6rem; border-radius: 4px; background: ${isSaldato(p.status) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'}; color: ${isSaldato(p.status) ? 'var(--success-soft)' : 'var(--warning-soft)'}; border: none;">${p.status}</span>
                                                        </div>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `;
        })()}
                </div>
            </div>
        </div>
    `;
}

// Order Payment Config
window.orderConfigEditState = {};

function formatPaymentMode(mode) {
    const map = { 'saldo': 'Saldo Completo', 'rate': 'Rate', 'anticipo_rate': 'Anticipo + Rate', 'anticipo_saldo': 'Anticipo + Saldo', 'as_rate': 'A&S + Rate' };
    return map[mode] || mode || 'Non configurato';
}

function renderOrderPaymentConfigUI(order) {
    if (window.orderConfigEditState[order.id]) return renderOrderPaymentConfigEdit(order);
    return renderOrderPaymentConfigDisplay(order);
}

function renderOrderPaymentConfigDisplay(order) {
    return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: rgba(0,0,0,0.02); border-radius: 8px;">
            <div style="font-size: 0.75rem; font-weight: 600;">${formatPaymentMode(order.payment_mode)}</div>
            <button onclick="window.toggleOrderConfigEdit('${order.id}', true)" style="background:none; border:none; cursor:pointer;"><span class="material-icons-round" style="font-size: 1rem;">edit</span></button>
        </div>
        <button onclick="window.openPaymentGenerationModal('${order.id}', '${order.price_final || order.total_price}')" style="width: 100%; margin-top: 0.5rem; padding: 0.5rem; background: var(--brand-gradient); color: white; border: none; border-radius: 8px; font-size: 0.75rem; cursor: pointer;">Genera Piano</button>
    `;
}

function renderOrderPaymentConfigEdit(order) {
    const currentMode = order.payment_mode || 'saldo';
    return `
        <div style="background: var(--bg-secondary); padding: 0.75rem; border-radius: 8px; border: 1px solid var(--brand-blue);">
            <select id="ord-pay-mode-${order.id}" class="modal-input small" style="font-size: 0.75rem; width: 100%;">
                <option value="saldo" ${currentMode === 'saldo' ? 'selected' : ''}>Saldo Completo</option>
                <option value="anticipo_saldo" ${currentMode === 'anticipo_saldo' ? 'selected' : ''}>Anticipo + Saldo</option>
                <option value="anticipo_rate" ${currentMode === 'anticipo_rate' ? 'selected' : ''}>Anticipo + Rate</option>
                <option value="rate" ${currentMode === 'rate' ? 'selected' : ''}>Rate</option>
                <option value="as_rate" ${currentMode === 'as_rate' ? 'selected' : ''}>Anticipo + Rate + Saldo</option>
            </select>
            <div class="flex-end" style="gap: 0.5rem; margin-top: 0.5rem;">
                <button class="btn-link small" onclick="window.toggleOrderConfigEdit('${order.id}', false)">Annulla</button>
                <button class="primary-btn small" onclick="window.saveOrderConfig('${order.id}')">Salva</button>
            </div>
        </div>
    `;
}

window.toggleOrderConfigEdit = (orderId, isEdit) => {
    window.orderConfigEditState[orderId] = isEdit;
    const container = document.getElementById(`order-payment-config-container-${orderId}`);
    const order = state.orders.find(o => o.id == orderId);
    if (container && order) container.innerHTML = renderOrderPaymentConfigUI(order);
};

window.saveOrderConfig = async (orderId) => {
    const mode = document.getElementById(`ord-pay-mode-${orderId}`).value;
    try {
        await updateOrder(orderId, { payment_mode: mode });
        await fetchOrders();
        window.toggleOrderConfigEdit(orderId, false);
        showGlobalAlert('Configurazione salvata', 'success');
        renderOrderDetail(document.getElementById('content-area'), orderId);
    } catch (e) {
        showGlobalAlert('Errore nel salvataggio', 'error');
    }
};

export function initOrderPaymentModals() {
    const existing = document.getElementById('payment-gen-modal');
    if (existing) return;
    document.body.insertAdjacentHTML('beforeend', `
        <div id="payment-gen-modal" class="modal">
            <div class="modal-content" style="max-width: 500px; padding: 2rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2rem;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(59, 130, 246, 0.1); display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons-round" style="color: var(--brand-blue);">payment</span>
                    </div>
                    <h2 style="margin: 0; font-family: var(--font-titles); font-weight: 700;">Genera Piano Pagamenti</h2>
                </div>
                
                <div style="margin-bottom: 2rem;">
                    <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Modalità di Pagamento</label>
                    <select id="pg-mode" class="modal-input" style="width: 100%;">
                        <option value="saldo">Saldo Completo</option>
                        <option value="rate">Rate</option>
                        <option value="anticipo_saldo">Anticipo e Saldo</option>
                        <option value="anticipo_rate">Anticipo + Rate</option>
                        <option value="as_rate">Anticipo + Rate + Saldo</option>
                    </select>
                </div>

                <div class="flex-end" style="gap: 1rem;">
                    <button class="primary-btn secondary" onclick="document.getElementById('payment-gen-modal').classList.remove('active')">Annulla</button>
                    <button class="primary-btn" id="pg-btn-confirm">Genera Ora</button>
                </div>
            </div>
        </div>
    `);

    const modal = document.getElementById('payment-gen-modal');
    window.openPaymentGenerationModal = (orderId, total) => {
        state.currentOrderId = orderId;
        state.currentTotal = parseFloat(total);
        modal.classList.add('active');
    };

    document.getElementById('pg-btn-confirm').addEventListener('click', async () => {
        const orderId = state.currentOrderId;
        const total = state.currentTotal;
        const mode = document.getElementById('pg-mode').value;
        try {
            await upsertPayment({ title: 'Saldo', amount: total, due_date: new Date().toISOString().split('T')[0], status: 'To Do', payment_type: 'Cliente', order_id: orderId });
            modal.classList.remove('active');
            renderOrderDetail(document.getElementById('content-area'), orderId);
            showGlobalAlert('Piano generato!');
        } catch (e) {
            showGlobalAlert('Errore generazione', 'error');
        }
    });
}

export function renderManualPaymentModal() {
    const existing = document.getElementById('payment-manual-modal');
    if (existing) return;
    document.body.insertAdjacentHTML('beforeend', `
        <div id="payment-manual-modal" class="modal">
            <div class="modal-content" style="max-width: 450px; padding: 2rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2rem;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(59, 130, 246, 0.1); display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons-round" style="color: var(--brand-blue);">add_card</span>
                    </div>
                    <h2 style="margin: 0; font-family: var(--font-titles); font-weight: 700;">Nuovo Pagamento</h2>
                </div>

                <div style="display: flex; flex-direction: column; gap: 1.25rem; margin-bottom: 2rem;">
                    <div>
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Descrizione</label>
                        <input type="text" id="pm-desc" class="modal-input" placeholder="Es: Acconto 30%" style="width: 100%;">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Importo (€)</label>
                            <input type="number" id="pm-amount" class="modal-input" placeholder="0.00" style="width: 100%;">
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Scadenza</label>
                            <input type="date" id="pm-date" class="modal-input" style="width: 100%;">
                        </div>
                    </div>
                </div>

                <div class="flex-end" style="gap: 1rem;">
                    <button class="primary-btn secondary" onclick="document.getElementById('payment-manual-modal').classList.remove('active')">Annulla</button>
                    <button class="primary-btn" id="pm-btn-save">Registra Pagamento</button>
                </div>
            </div>
        </div>
    `);

    let currentOrder, currentClient;
    window.openManualPaymentModal = (oid, cid) => { currentOrder = oid; currentClient = cid; document.getElementById('payment-manual-modal').classList.add('active'); };
    document.getElementById('pm-btn-save').addEventListener('click', async () => {
        try {
            await upsertPayment({ title: document.getElementById('pm-desc').value, amount: parseFloat(document.getElementById('pm-amount').value), due_date: document.getElementById('pm-date').value, status: 'To Do', payment_type: 'Cliente', order_id: currentOrder, client_id: currentClient });
            document.getElementById('payment-manual-modal').classList.remove('active');
            renderOrderDetail(document.getElementById('content-area'), currentOrder);
            showGlobalAlert('Aggiunto!');
        } catch (e) { showGlobalAlert('Errore', 'error'); }
    });
}

window.editOrderEconomics = function (orderId) {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;
    state.currentOrderId = orderId;
    const modal = document.getElementById('economics-modal');
    document.getElementById('eco-price').value = order.price_final || 0;
    document.getElementById('eco-cost').value = order.cost_final || 0;
    modal.classList.add('active');
};

export function initOrderEconomicsModal() {
    const existing = document.getElementById('economics-modal');
    if (existing) return;
    document.body.insertAdjacentHTML('beforeend', `
        <div id="economics-modal" class="modal">
            <div class="modal-content" style="max-width: 450px; padding: 2rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2rem;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(16, 185, 129, 0.1); display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons-round" style="color: #10b981;">account_balance_wallet</span>
                    </div>
                    <h2 style="margin: 0; font-family: var(--font-titles); font-weight: 700;">Dati Economici</h2>
                </div>

                <div style="display: flex; flex-direction: column; gap: 1.5rem; margin-bottom: 2rem;">
                    <div>
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Prezzo Finale (€)</label>
                        <div style="position: relative;">
                            <span class="material-icons-round" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); font-size: 1.2rem; color: #10b981;">trending_up</span>
                            <input type="number" id="eco-price" class="modal-input" style="width: 100%; padding-left: 3rem;" placeholder="0.00">
                        </div>
                        <p style="font-size: 0.65rem; color: var(--text-tertiary); margin-top: 0.4rem;">Il prezzo definitivo concordato con il cliente.</p>
                    </div>

                    <div>
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Costo Finale (€)</label>
                        <div style="position: relative;">
                            <span class="material-icons-round" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); font-size: 1.2rem; color: #ef4444;">trending_down</span>
                            <input type="number" id="eco-cost" class="modal-input" style="width: 100%; padding-left: 3rem;" placeholder="0.00">
                        </div>
                        <p style="font-size: 0.65rem; color: var(--text-tertiary); margin-top: 0.4rem;">Il costo totale effettivo sostenuto per la commessa.</p>
                    </div>
                </div>

                <div class="flex-end" style="gap: 1rem;">
                    <button class="primary-btn secondary" onclick="document.getElementById('economics-modal').classList.remove('active')">Annulla</button>
                    <button class="primary-btn" id="btn-save-economics">Salva Modifiche</button>
                </div>
            </div>
        </div>
    `);

    document.getElementById('btn-save-economics').addEventListener('click', async () => {
        const orderId = state.currentOrderId;
        try {
            await updateOrderEconomics(orderId, { price_final: parseFloat(document.getElementById('eco-price').value), cost_final: parseFloat(document.getElementById('eco-cost').value) });
            showGlobalAlert('Aggiornato');
            document.getElementById('economics-modal').classList.remove('active');
            renderOrderDetail(document.getElementById('content-area'), orderId);
            await fetchOrders();
        } catch (e) { showGlobalAlert('Errore', 'error'); }
    });
}

export function initOrderPeopleModals() {
    if (!document.getElementById('add-account-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="add-account-modal" class="modal">
                <div class="modal-content" style="max-width: 500px; padding: 2rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(59, 130, 246, 0.1); display: flex; align-items: center; justify-content: center;">
                                <span class="material-icons-round" style="color: var(--brand-blue); font-size: 1.25rem;">person_add</span>
                            </div>
                            <h2 style="margin: 0; font-family: var(--font-titles); font-weight: 700; font-size: 1.25rem;">Assegna Account</h2>
                        </div>
                        <button class="icon-btn" onclick="document.getElementById('add-account-modal').classList.remove('active')">
                            <span class="material-icons-round">close</span>
                        </button>
                    </div>
                    
                    <div style="position: relative; margin-bottom: 1rem;">
                        <span class="material-icons-round" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 1.1rem; color: var(--text-tertiary);">search</span>
                        <input type="text" id="acc-search" class="modal-input" placeholder="Cerca account..." style="width: 100%; padding-left: 2.5rem;" oninput="window.filterAccountList()">
                    </div>

                    <div id="sea-list" style="max-height: 350px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; padding-right: 0.25rem;">
                        <!-- List populated via JS -->
                    </div>
                </div>
            </div>
        `);
    }

    if (!document.getElementById('add-contact-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="add-contact-modal" class="modal">
                <div class="modal-content" style="max-width: 500px; padding: 2rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(139, 92, 246, 0.1); display: flex; align-items: center; justify-content: center;">
                                <span class="material-icons-round" style="color: #8b5cf6; font-size: 1.25rem;">contact_page</span>
                            </div>
                            <h2 style="margin: 0; font-family: var(--font-titles); font-weight: 700; font-size: 1.25rem;">Aggiungi Referente</h2>
                        </div>
                        <button class="icon-btn" onclick="document.getElementById('add-contact-modal').classList.remove('active')">
                            <span class="material-icons-round">close</span>
                        </button>
                    </div>

                    <div style="position: relative; margin-bottom: 1rem;">
                        <span class="material-icons-round" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 1.1rem; color: var(--text-tertiary);">search</span>
                        <input type="text" id="cont-search" class="modal-input" placeholder="Cerca referente..." style="width: 100%; padding-left: 2.5rem;" oninput="window.filterContactList()">
                    </div>

                    <div id="sec-list" style="max-height: 350px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; padding-right: 0.25rem;">
                        <!-- List populated via JS -->
                    </div>
                </div>
            </div>
        `);
    }
}

window.openAddOrderAccountModal = (orderId) => {
    state.currentOrderId = orderId;
    document.getElementById('acc-search').value = '';
    window.filterAccountList();
    document.getElementById('add-account-modal').classList.add('active');
};

window.filterAccountList = () => {
    const list = document.getElementById('sea-list');
    const search = document.getElementById('acc-search').value.toLowerCase();

    // Filter by tag "Account" and search term
    const accounts = (state.collaborators || []).filter(c => {
        const hasAccountTag = (Array.isArray(c.tags) ? c.tags : (c.tags || '').split(',')).some(t => t.trim().toLowerCase() === 'account');
        const matchesSearch = c.full_name.toLowerCase().includes(search);
        return hasAccountTag && matchesSearch;
    });

    if (accounts.length === 0) {
        list.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-tertiary); font-size: 0.85rem;">Nessun account trovato${search ? ' per questa ricerca' : ''}</div>`;
        return;
    }

    list.innerHTML = accounts.map(c => `
        <div onclick="window.confirmAddAccount('${c.id}')" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--bg-secondary); border-radius: 10px; cursor: pointer; transition: all 0.2s; border: 1px solid transparent;" onmouseover="this.style.borderColor='var(--brand-blue)'; this.style.background='white';" onmouseout="this.style.borderColor='transparent'; this.style.background='var(--bg-secondary)';">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--brand-blue); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600;">
                ${c.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
            </div>
            <div style="flex: 1;">
                <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">${c.full_name}</div>
                <div style="font-size: 0.7rem; color: var(--text-tertiary);">${c.role || 'Collaboratore'}</div>
            </div>
            <span class="material-icons-round" style="color: var(--brand-blue); font-size: 1.25rem;">add_circle_outline</span>
        </div>
    `).join('');
};

window.openAddOrderContactModal = (orderId) => {
    state.currentOrderId = orderId;
    document.getElementById('cont-search').value = '';
    window.filterContactList();
    document.getElementById('add-contact-modal').classList.add('active');
};

window.filterContactList = () => {
    const list = document.getElementById('sec-list');
    const search = document.getElementById('cont-search').value.toLowerCase();

    // Get current order to find client_id
    const order = state.orders.find(o => o.id === state.currentOrderId);
    const clientId = order ? order.client_id : null;

    const filtered = (state.contacts || []).filter(c => {
        // Strict filter: Must belong to the filtered client (if order has a client)
        if (clientId && c.client_id !== clientId) return false;

        return c.full_name.toLowerCase().includes(search) ||
            (c.clients?.business_name || '').toLowerCase().includes(search);
    });

    if (filtered.length === 0) {
        list.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-tertiary); font-size: 0.85rem;">Nessun referente trovato${clientId ? ' per questo cliente' : ''}</div>`;
        return;
    }

    list.innerHTML = filtered.map(c => `
        <div onclick="window.confirmAddContact('${c.id}')" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--bg-secondary); border-radius: 10px; cursor: pointer; transition: all 0.2s; border: 1px solid transparent;" onmouseover="this.style.borderColor='#8b5cf6'; this.style.background='white';" onmouseout="this.style.borderColor='transparent'; this.style.background='var(--bg-secondary)';">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #8b5cf6; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600;">
                ${c.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
            </div>
            <div style="flex: 1;">
                <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">${c.full_name}</div>
                <div style="font-size: 0.7rem; color: var(--text-tertiary);">${c.clients?.business_name || 'Referente'}</div>
            </div>
            <span class="material-icons-round" style="color: #8b5cf6; font-size: 1.25rem;">add_circle_outline</span>
        </div>
    `).join('');
};

window.confirmAddAccount = async (cid) => {
    try {
        await addOrderAccount(state.currentOrderId, cid);
        document.getElementById('add-account-modal').classList.remove('active');
        await fetchOrders();
        renderOrderDetail(document.getElementById('content-area'), state.currentOrderId);
        showGlobalAlert('Account assegnato', 'success');
    } catch (e) { showGlobalAlert('Errore', 'error'); }
};

window.removeOrderAccount = async (oid, cid) => {
    try {
        await removeOrderAccount(oid, cid);
        await fetchOrders();
        renderOrderDetail(document.getElementById('content-area'), oid);
        showGlobalAlert('Account rimosso', 'success');
    } catch (e) { showGlobalAlert('Errore', 'error'); }
};

window.confirmAddContact = async (cid) => {
    try {
        await addOrderContact(state.currentOrderId, cid);
        document.getElementById('add-contact-modal').classList.remove('active');
        await fetchOrders();
        renderOrderDetail(document.getElementById('content-area'), state.currentOrderId);
        showGlobalAlert('Referente aggiunto', 'success');
    } catch (e) { showGlobalAlert('Errore', 'error'); }
};

window.removeOrderContact = async (oid, cid) => {
    try {
        await removeOrderContact(oid, cid);
        await fetchOrders();
        renderOrderDetail(document.getElementById('content-area'), oid);
        showGlobalAlert('Referente rimosso', 'success');
    } catch (e) { showGlobalAlert('Errore', 'error'); }
};





window.editOrder = (orderId) => {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;
    state.currentOrderId = orderId;
    const modal = document.getElementById('order-modal');
    if (!modal) return;

    document.getElementById('ord-title').value = order.title || '';
    document.getElementById('ord-number').value = order.order_number || '';
    document.getElementById('ord-date').value = order.order_date ? new Date(order.order_date).toISOString().split('T')[0] : '';
    document.getElementById('ord-status').value = order.status_works || 'In Corso';

    modal.classList.add('active');
};

export function initOrderModal() {
    const existing = document.getElementById('order-modal');
    if (existing) return;

    document.body.insertAdjacentHTML('beforeend', `
        <div id="order-modal" class="modal">
            <div class="modal-content" style="max-width: 550px; padding: 2rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2rem;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(59, 130, 246, 0.1); display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons-round" style="color: var(--brand-blue);">edit_note</span>
                    </div>
                    <h2 style="margin: 0; font-family: var(--font-titles); font-weight: 700;">Modifica Ordine</h2>
                </div>

                <div style="display: flex; flex-direction: column; gap: 1.25rem; margin-bottom: 2rem;">
                    <div>
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Titolo Commessa</label>
                        <input type="text" id="ord-title" class="modal-input" style="width: 100%;" placeholder="Es: Logo Design Rebranding">
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">N. Ordine</label>
                            <input type="text" id="ord-number" class="modal-input" style="width: 100%;">
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Data Ordine</label>
                            <input type="date" id="ord-date" class="modal-input" style="width: 100%;">
                        </div>
                    </div>

                    <div>
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Stato Lavori</label>
                        <select id="ord-status" class="modal-input" style="width: 100%;">
                            <option value="In Corso">In Corso</option>
                            <option value="Completato">Completato</option>
                            <option value="Finito">Finito</option>
                            <option value="Annullato">Annullato</option>
                        </select>
                    </div>
                </div>

                <div class="flex-end" style="gap: 1rem;">
                    <button class="primary-btn secondary" onclick="document.getElementById('order-modal').classList.remove('active')">Annulla</button>
                    <button class="primary-btn" id="btn-save-order">Aggiorna Ordine</button>
                </div>
            </div>
        </div>
    `);

    document.getElementById('btn-save-order').addEventListener('click', async () => {
        const orderId = state.currentOrderId;
        const updates = {
            title: document.getElementById('ord-title').value,
            order_number: document.getElementById('ord-number').value,
            order_date: document.getElementById('ord-date').value,
            status_works: document.getElementById('ord-status').value
        };

        try {
            await updateOrder(orderId, updates);
            showGlobalAlert('Ordine aggiornato con successo');
            document.getElementById('order-modal').classList.remove('active');
            await fetchOrders();
            renderOrderDetail(document.getElementById('content-area'), orderId);
        } catch (e) {
            showGlobalAlert('Errore durante l\'aggiornamento', 'error');
        }
    });
}

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
                                    <label style="font-size: 0.7rem; color: var(--text-tertiary); margin-bottom: 0.25rem; display:block;">Totale</label>
                                    <div id="asg-service-total-display" style="padding: 0.6rem; background: var(--bg-secondary); border-radius: 8px; font-weight: 600; text-align: right;">€ 0.00</div>
                                </div>
                                <button class="primary-btn small" id="asg-add-service-btn" onclick="window.addServiceToAssignmentList()" disabled style="height: 42px; width: 42px; padding: 0; display: flex; align-items: center; justify-content: center;">
                                    <span class="material-icons-round">add</span>
                                </button>
                            </div>
                            <div id="asg-tariff-info" style="font-size: 0.75rem; color: var(--text-tertiary); padding: 0.5rem; background: rgba(59, 130, 246, 0.05); border-radius: 6px; display: none;"></div>
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
                                    <option value="To Do">To Do</option>
                                    <option value="In Corso">In Corso</option>
                                    <option value="Completato">Completato</option>
                                    <option value="Terminato">Terminato</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem;">IMPORTO TOTALE (€)</label>
                            <input type="number" id="asg-amount" class="modal-input" style="width: 100%; font-size: 1.5rem; font-weight: 700; color: var(--brand-blue);" placeholder="0.00">
                            <p style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.5rem;">L'importo verrà calcolato automaticamente dai servizi selezionati, ma puoi modificarlo manualmente.</p>
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
                                        <option value="rate">Rate Mensili (Mensile)</option>
                                        <option value="anticipo_rate">Anticipo + Rate</option>
                                    </select>
                                 </div>

                                 <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
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

        if (mode === 'saldo') {
            depositField.style.display = 'none';
            instField.style.display = 'none';
        } else if (mode === 'anticipo_saldo') {
            depositField.style.display = 'block';
            instField.style.display = 'none';
        } else if (mode === 'rate') {
            depositField.style.display = 'none';
            instField.style.display = 'block';
        } else if (mode === 'anticipo_rate') {
            depositField.style.display = 'block';
            instField.style.display = 'block';
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
    document.getElementById('asg-status').value = 'To Do';
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
            // Calculate total amount from selected services state
            const total = window.asgState.selectedServices.reduce((sum, s) => sum + (s.total_price || 0), 0);
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
        import('../modules/api.js?v=116').then(({ fetchCollaborators }) => fetchCollaborators());
        // Show temp message
        list.innerHTML = '<div style="padding: 1rem; color: var(--text-tertiary);">Caricamento...</div>';
        list.style.display = 'block';
        return;
    }

    const filtered = state.collaborators.filter(c => c.full_name.toLowerCase().includes(search));

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
            <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--bg-secondary); color: var(--brand-blue); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.8rem;">
                ${c.full_name.substring(0, 2).toUpperCase()}
            </div>
            <div>
                <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">${c.full_name}</div>
                <div style="font-size: 0.75rem; color: var(--text-tertiary);">${c.role || 'Collaboratore'}</div>
            </div>
        </div>
    `).join('');
    list.style.display = 'block';
};


window.selectAssignmentCollaborator = (id, name) => {
    document.getElementById('asg-collab-id').value = id;
    document.getElementById('asg-collab-name').innerText = name;

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

        // 1. Get Collaborator Tags/Role
        // Safety check
        if (!window.asgState.collaborator) {
            console.error("Missing collaborator state in loadCollaboratorServicesForAssignment");
            throw new Error("Stato collaboratore mancante");
        }

        const collabId = window.asgState.collaborator.id;
        let collaborator = state.collaborators ? state.collaborators.find(c => c.id === collabId) : null;

        if (!collaborator) {
            console.warn("Collaborator not found in global state, attempting fetch or proceeding with limited info");
            // Attempt to use basic info from asgState if possible, or wait for fetch if we had a mechanism.
            // For now, if we can't find details, we can't filter services by tag.
            // Let's create a dummy object to allow proceeding (maybe show all services?)
            collaborator = { id: collabId, tags: [], role: '' };
        }

        let collabTags = [];
        let normalizedCollabTags = [];

        if (collaborator) {
            if (collaborator.tags) {
                collabTags = Array.isArray(collaborator.tags) ? collaborator.tags : (typeof collaborator.tags === 'string' ? collaborator.tags.split(',') : []);
            }
            normalizedCollabTags = collabTags.map(t => t.trim().toLowerCase());
            if (collaborator.role) normalizedCollabTags.push(collaborator.role.toLowerCase());
        }

        // 2. Fetch Services (if not loaded)
        const { fetchServices } = await import('../modules/api.js?v=116' + Date.now());
        if (!state.services || state.services.length === 0) {
            await fetchServices();
        }

        // 3. Filter Services
        // "filtrati per i reparti a cui appartiene il collaboratore"
        // Match if ANY of service tags overlap with collaborator tags

        const relevantServices = (state.services || []).filter(s => {
            let serviceTags = [];
            if (s.tags) {
                serviceTags = Array.isArray(s.tags) ? s.tags : (typeof s.tags === 'string' ? s.tags.split(',') : []);
            }
            // If service has no tags, should it be shown? Assuming restricted unless matched.

            // Check intersection
            const hasMatch = serviceTags.some(tag => normalizedCollabTags.includes(tag.trim().toLowerCase()));

            // Fallback: If collaborator has NO tags, maybe show nothing or all?
            // If normalizedCollabTags is empty, hasMatch is false.
            // If we want to show ALL services when no tags match (e.g. data missing), uncomment below:
            // if (normalizedCollabTags.length === 0) return true; 

            return hasMatch;
        });

        // 4. Populate Dropdown
        if (relevantServices.length === 0) {
            selector.innerHTML = '<option value="">Nessun servizio compatibile trovato</option>';
            // Fallback: allow seeing all services if filtering yielded nothing?
            // selector.innerHTML += '<option disabled>---</option>';
            // (state.services || []).forEach(s => selector.innerHTML += ...);
            selector.disabled = true;
        } else {
            selector.innerHTML = '<option value="">Seleziona un servizio...</option>' +
                relevantServices.map(s => `<option value="${s.id}" data-type="${s.type}" data-price="${s.price || 0}">${s.name}</option>`).join('');
            selector.disabled = false;
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

    // Configure Inputs based on Type
    qtyInput.disabled = false;
    addBtn.disabled = false;

    // Default Qty
    qtyInput.value = 1;

    let unitLabel = 'Quantità';
    let infoText = '';

    if (type === 'tariffa oraria') {
        unitLabel = 'Ore';
        infoText = `Tariffa Oraria: € ${formatMoney(price)} / ora`;
    } else if (type === 'tariffa mensile') {
        unitLabel = 'Mesi';
        infoText = `Tariffa Mensile: € ${formatMoney(price)} / mese`;
    } else { // 'tariffa spot' or others
        unitLabel = 'Quantità';
        infoText = `Tariffa Spot: € ${formatMoney(price)} cadauno`;
    }

    qtyLabel.textContent = unitLabel;
    tariffInfo.textContent = infoText;
    tariffInfo.style.display = 'block';

    // Calculate initial total
    const total = price * 1;
    totalDisplay.textContent = '€ ' + formatMoney(total);

    // Attach listener for dynamic calc
    qtyInput.oninput = () => {
        const qty = parseFloat(qtyInput.value) || 0;
        const subTotal = price * qty;
        totalDisplay.textContent = '€ ' + formatMoney(subTotal);
    };
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
    const qty = parseFloat(qtyInput.value) || 0;

    if (qty <= 0) {
        showGlobalAlert('La quantità deve essere maggiore di zero', 'error');
        return;
    }

    // Add to state
    console.log("Adding service to state:", { serviceId, name, qty, total: unitPrice * qty });
    window.asgState.selectedServices.push({
        id: serviceId, // Catalog ID
        name: name,
        type: type,
        unit_price: unitPrice,
        quantity: qty,
        total_price: unitPrice * qty
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
                    ${s.type === 'tariffa oraria' ? `${s.quantity} ore` : (s.type === 'tariffa mensile' ? `${s.quantity} mesi` : `Qtà: ${s.quantity}`)} @ € ${formatMoney(s.unit_price)}
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="font-weight: 700;">€ ${formatMoney(s.total_price)}</div>
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
    const startDateStr = document.getElementById('asg-start-date').value;

    try {
        const order = state.orders.find(o => o.id === orderId);

        // Dynamic import including calculateProposedAssignmentPayments
        const { upsertAssignment, upsertCollaboratorService, fetchCollaboratorServices, fetchAssignments, upsertPayment, fetchPayments } = await import('../modules/api.js?v=116' + Date.now());
        const { calculateProposedAssignmentPayments } = await import('./assignments.js?v=116');

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
            installment_type: 'Mensile' // Default for now
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
                total_price: s.total_price,
                total_cost: s.total_price
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
            renderOrderDetail(document.getElementById('content-area'), orderId);
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
