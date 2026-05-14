import { state } from '/js/modules/state.js?v=8000';
import { supabase } from '../modules/config.js?v=8000';
import { formatAmount, showGlobalAlert, showConfirm, getInitials, getAvatarColor, renderAvatar } from '../modules/utils.js?v=8000';
import { upsertPayment, deletePayment, upsertOrder, updateOrder, deleteOrder, updateOrderEconomics, fetchPayments, fetchOrders, fetchAssignments, fetchCollaborators, fetchServices, addOrderAccount, removeOrderAccount, fetchOrderAccounts, addOrderContact, removeOrderContact, fetchOrderContacts, updateOrderCloudLinks, generateNextOrderNumber } from '../modules/api.js?v=8000';
import { CloudLinksManager } from './components/CloudLinksManager.js?v=8000';
import { CustomSelect } from '../components/CustomSelect.js?v=8000';
import { openPaymentModal } from './payments.js?v=8000';
import { fetchProjectSpaceForOrder, fetchProjectItems, fetchAppointments } from '../modules/pm_api.js?v=8000';
import { activityTranslate } from '../modules/pm_activity_helper.js?v=8000';
import { tAssignment } from '../modules/i18n_labels.js?v=8002';
import { inlineHelpButton, attachInlineHelp } from '../modules/help_inline_ai.js?v=8001';

// Payment config helpers + window handlers (extracted).
// Importing also installs window.orderConfigEditState + window.toggleOrderConfig*/saveOrderConfig.
import {
    formatPaymentMode,
    calculateProposedOrderPayments,
    renderOrderPaymentConfigUI,
    renderOrderPaymentConfigDisplay,
    renderOrderPaymentConfigEdit,
} from './orders/payment_config.js?v=8000';

// Order modals (extracted). Importing installs window.editOrder/editOrderEconomics handlers.
import { initOrderEconomicsModal } from './orders/economics_modal.js?v=8000';
import { initOrderModal } from './orders/order_modal.js?v=8000';

// Quick status actions: window.deleteOrder, updateOrderOfferStatusQuick, updateOrderStatusQuick.
import './orders/status_actions.js?v=8000';

// Action UI window handlers: generateQuote, openOrderDocsModal, openAccountActivitiesModal, openOrderCloudResourcesModal.
import './orders/actions_ui.js?v=8000';

// Payment generation + manual payment modals (init).
import { initOrderPaymentModals, renderManualPaymentModal } from './orders/payment_modals.js?v=8000';

// People modal: Account collaborators + Contacts on an order (init + window handlers).
import { initOrderPeopleModals } from './orders/people_modal.js?v=8000';

// Assignment modal (multi-step wizard). init + 13 window handlers as side effects.
import { initOrderAssignmentModal } from './orders/assignment_modal.js?v=8000';

// New Order modal (used also by dashboard.js — re-exported below to preserve public surface).
import { initNewOrderModal } from './orders/new_order_modal.js?v=8000';
export { initNewOrderModal };


function getStatusColor(status) {
    const s = status?.toLowerCase() || '';
    if (s.includes('prev')) return '#3b82f6';
    if (s.includes('lavo') || s.includes('corso') || s === 'in_svolgimento') return '#f59e0b';
    if (s.includes('chiuso') || s.includes('finito') || s.includes('complet') || s === 'completato') return '#10b981';
    if (s.includes('annull')) return '#94a3b8';
    if (s === 'da_iniziare') return '#6366f1';
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
        const { fetchCollaboratorServices } = await import('../modules/api.js?v=8000');
        await fetchCollaboratorServices();
    }

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

    let accountList = [];
    try {
        const rawAccounts = await fetchOrderAccounts(orderId);
        accountList = rawAccounts.map(ra => ra.collaborators);
    } catch (e) {
        console.warn("Error fetching accounts list", e);
    }
    
    if (accountList.length === 0 && order.order_collaborators) {
        accountList = order.order_collaborators
            .filter(oc => oc.role_in_order === 'Account')
            .map(oc => oc.collaborators);
    }

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

    // === Role-based view (Hub commessa) ===
    // Chi vede i dati economici interni (cost_final, margine, delta tariffario,
    // prezzo del tariffario suggerito): admin + partner + amministrazione + socio
    // + ACCOUNT. I PM puri / collab base NON vedono questi dati.
    // (Davide 14/5: "il tariffario lo devono vedere gli account, e come se lo devono
    // vedere, sia account che partner".)
    const activeRole = state.impersonatedRole || state.profile?.role || 'collaborator';
    const userTags = (state.profile?.tags || []).map(t => (t || '').toString().toLowerCase());
    const canSeeInternals = activeRole === 'admin'
        || userTags.includes('partner')
        || userTags.includes('amministrazione')
        || userTags.includes('socio')
        || userTags.includes('account');

    const statusColor = getStatusColor(order.status_works || order.status);

    const linkedAssignments = state.assignments ? state.assignments.filter(a =>
        a.order_id === order.id ||
        (a.orders && a.orders.order_id === order.id) ||
        (a.legacy_order_id && a.legacy_order_id === order.order_number)
    ) : [];

    // === Margine Effettivo ===
    // Mostra quanto costa DAVVERO la commessa sommando i contratti effettivi
    // firmati con i collab (assignment.amount), confrontato con il preventivato
    // (cost_final) per evidenziare erosione di margine in tempo reale.
    const actualAssignmentCost = linkedAssignments.reduce((sum, a) => {
        return sum + (parseFloat(a.amount) || 0);
    }, 0);
    const hasActualCost = linkedAssignments.length > 0 && actualAssignmentCost > 0;
    const actualMargin = priceFinal - actualAssignmentCost;
    const actualMarginPct = priceFinal > 0 ? Math.round((actualMargin / priceFinal) * 100) : 0;
    const costErosion = actualAssignmentCost - costFinal; // > 0 = sforato budget
    const costErosionPct = costFinal > 0 ? Math.round((costErosion / costFinal) * 100) : 0;

    // === Fatturato vs Da fatturare ===
    // Per la CTA "Genera fattura saldo": calcola quanto è stato già fatturato
    // su questa commessa e quanto resta da fatturare al cliente.
    const linkedInvoicesForOrder = (state.invoices || []).filter(i => {
        if (Array.isArray(i.linked_orders) && i.linked_orders.includes(order.id)) return true;
        return i.order_id === order.id;
    });
    const totalInvoicedOnOrder = linkedInvoicesForOrder.reduce((s, i) => s + (parseFloat(i.amount_tax_excluded) || 0), 0);
    const toBeInvoiced = Math.max(0, priceFinal - totalInvoicedOnOrder);
    const isOrderClosed = (order.status_works || '').toLowerCase() === 'completato';
    const showInvoiceCTA = canSeeInternals && priceFinal > 0 && toBeInvoiced > 0.5;

    // --- PM Data Fetching ---
    const pmSpace = await fetchProjectSpaceForOrder(orderId);
    let pmKPIs = { total: 0, done: 0, overdue: 0, dueSoon: 0, progress: 0 };
    let upcomingActivities = [];

    if (pmSpace) {
        let [items, appointments] = await Promise.all([
            fetchProjectItems(pmSpace.id),
            fetchAppointments(pmSpace.id, 'space')
        ]);

        // Filter out Account-level items
        items = items.filter(i => {
            const isAccount = i.is_account_level || i.pm_item_assignees?.some(a => a.role === 'account') || i.notes?.toLowerCase().includes('[account]');
            return !isAccount;
        });

        // Filter out Account-level appointments
        appointments = appointments.filter(appt => {
            const isAccount = appt.is_account_level || appt.appointment_internal_participants?.some(p => p.role === 'account') || appt.note?.toLowerCase().includes('[account]');
            return !isAccount;
        });

        // Calculate KPIs
        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const total = items.length;
        const done = items.filter(i => i.status === 'done').length;
        const overdue = items.filter(i => {
            if (!i.due_date || i.status === 'done') return false;
            return new Date(i.due_date) < now;
        }).length;
        const dueSoon = items.filter(i => {
            if (!i.due_date || i.status === 'done') return false;
            const due = new Date(i.due_date);
            return due >= now && due <= weekFromNow;
        }).length;
        pmKPIs = {
            total, done, overdue, dueSoon,
            progress: total > 0 ? Math.round((done / total) * 100) : 0
        };

        // Get activities for Account Highlights
        upcomingActivities = [
            ...items.filter(i => i.status !== 'done' && i.due_date).map(i => ({ ...i, type: 'task' })),
            ...appointments.map(a => ({ ...a, type: 'appointment', due_date: a.start_time }))
        ].sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).slice(0, 5);
    }

    // Move Back Button to Top Bar (before Dettaglio Ordine)
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
        pageTitle.style.opacity = '1';
        pageTitle.style.display = 'flex';
        pageTitle.style.alignItems = 'center';
        pageTitle.style.gap = '1.25rem';

        pageTitle.innerHTML = `
            <div onclick="window.history.back()" 
                 style="
                    width: 42px; 
                    height: 42px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    cursor: pointer; 
                    position: relative;
                    transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    z-index: 10;
                 "
                 onmouseover="this.style.transform='scale(1.12)'" 
                 onmouseout="this.style.transform='scale(1)'">
                
                <!-- SVG for mathematically perfect circle with gradient -->
                <svg width="42" height="42" style="position: absolute; top: 0; left: 0; transform: rotate(-90deg);">
                    <defs>
                        <linearGradient id="back-btn-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color: #4e92d8" />
                            <stop offset="100%" style="stop-color: #614aa2" />
                        </linearGradient>
                    </defs>
                    <circle cx="21" cy="21" r="19.5" 
                            fill="none" 
                            stroke="url(#back-btn-grad)" 
                            stroke-width="2.5" 
                            stroke-linecap="round" />
                </svg>

                <span class="material-icons-round" style="
                    font-size: 1.4rem; 
                    background: linear-gradient(135deg, #4e92d8, #614aa2);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    font-weight: 900;
                    position: relative;
                    z-index: 2;
                ">arrow_back</span>
            </div>
            <span style="color: var(--text-primary); font-weight: 700; font-size: 1.55rem; letter-spacing: -0.015em;">Dettaglio Ordine</span>
        `;
    }

    container.innerHTML = `
        <div class="animate-fade-in" style="max-width: 1400px; margin: 0 auto; padding: 1.5rem;">
            <!-- Header Section -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; background: var(--bg-secondary); padding: 1.5rem 2rem; border-radius: 16px; border: 1px solid var(--glass-border);">
                <div style="display: flex; align-items: center; gap: 1.25rem;">
                    ${(() => {
            const parts = (order.order_number || '00-0000').split('-');
            const yearPrefix = parts[0] || '00';
            const seqNumber = parts[1] || '0000';
            return `
                            <div style="width: 56px; height: 56px; border-radius: 14px; background: var(--brand-gradient); display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(97, 74, 162, 0.2); color: white; line-height: 1;">
                                <div style="font-size: 0.85rem; font-weight: 800; opacity: 0.85; margin-bottom: 1px;">${yearPrefix}</div>
                                <div style="font-size: 1.1rem; font-weight: 900; letter-spacing: 0.05em;">${seqNumber}</div>
                            </div>
                        `;
        })()}
                    <div>
                        <div style="display: flex; flex-direction: column; gap: 0.15rem; margin-bottom: 0.25rem;">
                             <div style="font-size: 0.65rem; text-transform: uppercase; font-weight: 700; color: var(--text-tertiary); letter-spacing: 0.05em;">Ordine ${order.order_number}</div>
                             <h1 style="font-size: 1.75rem; font-weight: 700; margin: 0; color: var(--text-primary); font-family: var(--font-titles); letter-spacing: -0.02em; line-height: 1.2;">${order.title || 'Senza Titolo'}</h1>
                        </div>
                        <div style="display: flex; align-items: center; gap: 1rem; color: var(--text-tertiary); font-size: 0.85rem; flex-wrap: wrap;">
                            <span style="display: flex; align-items: center; gap: 0.4rem;"><span class="material-icons-round" style="font-size: 1rem;">calendar_today</span> ${new Date(order.created_at).toLocaleDateString('it-IT')}</span>
                            <span style="display: flex; align-items: center; gap: 0.4rem;"><span class="material-icons-round" style="font-size: 1rem;">business</span> ${order.clients?.client_code || 'N/A'}</span>
                            ${inlineHelpButton({ id: order.id, contextType: 'order', label: 'Spiegami', icon: 'auto_awesome' })}
                        </div>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <!-- Note Button -->
                    <button onclick="window.openOrderDocsModal('${pmSpace?.id}')" 
                            style="padding: 0.5rem 0.85rem 0.5rem 0.5rem; border-radius: 12px; display: flex; align-items: center; gap: 0.6rem; background: white; border: 1px solid var(--glass-border); cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: var(--shadow-sm);"
                            onmouseover="this.style.borderColor='var(--brand-blue)'; this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.05)'"
                            onmouseout="this.style.borderColor='var(--glass-border)'; this.style.transform='translateY(0)'; this.style.boxShadow='var(--shadow-sm)'">
                        <div style="width: 30px; height: 30px; border-radius: 8px; background: rgba(59, 130, 246, 0.08); display: flex; align-items: center; justify-content: center;">
                            <span class="material-icons-round" style="font-size: 1.1rem; color: var(--brand-blue);">description</span>
                        </div>
                        <span style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem; letter-spacing: -0.01em;">Note</span>
                    </button>

                    <!-- Attività Button -->
                    <button onclick="window.openAccountActivitiesModal('${order.id}', '${pmSpace?.id}')" 
                            style="padding: 0.5rem 0.85rem 0.5rem 0.5rem; border-radius: 12px; display: flex; align-items: center; gap: 0.6rem; background: white; border: 1px solid var(--glass-border); cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: var(--shadow-sm);"
                            onmouseover="this.style.borderColor='var(--brand-blue)'; this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.05)'"
                            onmouseout="this.style.borderColor='var(--glass-border)'; this.style.transform='translateY(0)'; this.style.boxShadow='var(--shadow-sm)'">
                        <div style="width: 30px; height: 30px; border-radius: 8px; background: rgba(59, 130, 246, 0.08); display: flex; align-items: center; justify-content: center;">
                            <span class="material-icons-round" style="font-size: 1.10rem; color: var(--brand-blue);">assignment</span>
                        </div>
                        <span style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem; letter-spacing: -0.01em;">Attività</span>
                    </button>

                    <!-- Risorse Button -->
                    <button onclick="window.openOrderCloudResourcesModal('${order.id}')" 
                            style="padding: 0.5rem 0.85rem 0.5rem 0.5rem; border-radius: 12px; display: flex; align-items: center; gap: 0.6rem; background: white; border: 1px solid var(--glass-border); cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: var(--shadow-sm);"
                            onmouseover="this.style.borderColor='var(--brand-blue)'; this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.05)'"
                            onmouseout="this.style.borderColor='var(--glass-border)'; this.style.transform='translateY(0)'; this.style.boxShadow='var(--shadow-sm)'">
                        <div style="width: 30px; height: 30px; border-radius: 8px; background: rgba(59, 130, 246, 0.08); display: flex; align-items: center; justify-content: center;">
                            <span class="material-icons-round" style="font-size: 1.10rem; color: var(--brand-blue);">cloud_queue</span>
                        </div>
                        <span style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem; letter-spacing: -0.01em;">Risorse</span>
                    </button>

                    <div class="order-actions-menu" style="position: relative;">
                        <button class="icon-btn" onclick="const m = this.nextElementSibling; m.style.display = m.style.display === 'block' ? 'none' : 'block'; event.stopPropagation();" 
                                style="width: 40px; height: 40px; border-radius: 12px; background: white; border: 1px solid var(--glass-border); color: var(--text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; box-shadow: var(--shadow-sm);"
                                onmouseover="this.style.borderColor='var(--brand-blue)'; this.style.color='var(--brand-blue)'"
                                onmouseout="this.style.borderColor='var(--glass-border)'; this.style.color='var(--text-secondary)'">
                            <span class="material-icons-round">more_vert</span>
                        </button>
                        <div class="actions-dropdown-content" style="display: none; position: absolute; right: 0; top: calc(100% + 8px); background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-radius: 12px; border: 1px solid var(--glass-border); box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); z-index: 1000; min-width: 190px; overflow: hidden; transform-origin: top right; animation: dropdownScale 0.2s ease-out;">
                            <div onclick="window.editOrder('${order.id}')" style="padding: 0.85rem 1rem; display: flex; align-items: center; gap: 0.75rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(59, 130, 246, 0.05)'" onmouseout="this.style.background='transparent'">
                                <span class="material-icons-round" style="font-size: 1.2rem; color: var(--brand-blue);">edit</span>
                                <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">Modifica Ordine</span>
                            </div>
                            <div onclick="window.deleteOrder('${order.id}')" style="padding: 0.85rem 1rem; display: flex; align-items: center; gap: 0.75rem; cursor: pointer; border-top: 1px solid rgba(0,0,0,0.05); transition: all 0.2s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.05)'" onmouseout="this.style.background='transparent'">
                                <span class="material-icons-round" style="font-size: 1.2rem; color: #ef4444;">delete</span>
                                <span style="font-size: 0.9rem; font-weight: 600; color: #ef4444;">Elimina Ordine</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Content Grid Layout -->
            <div style="display: grid; grid-template-columns: 320px 1fr 340px; gap: 1.5rem; align-items: start;">
                
                <!-- Column 1: Client, People, Assignments -->
                <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                    <!-- Cliente -->
                    <div class="glass-card" style="padding: 1.5rem;">
                        <div style="color: var(--text-tertiary); font-size: 0.65rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.75rem; letter-spacing: 0.05em;">Soggetto Cliente</div>
                        <div style="margin-bottom: 1.5rem;">
                            <div style="font-size: 1.1rem; font-weight: 700; color: var(--brand-blue); margin-bottom: 0.25rem;">${order.clients?.client_code || '-'}</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4;">${order.clients?.business_name || '-'}</div>
                        </div>

                        <div style="border-top: 1px solid var(--glass-border); padding-top: 1.25rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                                <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.02em;">Referenti Cliente</label>
                                <button onclick="window.openAddOrderContactModal('${order.id}')" style="background:none; border:none; color:var(--brand-blue); font-size:0.7rem; cursor:pointer; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                    <span class="material-icons-round" style="font-size: 14px;">add</span> Aggiungi
                                </button>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                                ${contactsList.length > 0 ? contactsList.map(cont => `
                                    <div style="display: flex; align-items: center; justify-content: space-between; background: white; padding: 0.6rem 0.75rem; border-radius: 10px; border: 1px solid var(--glass-border);">
                                        <div style="display: flex; align-items: center; gap: 0.6rem;">
                                            ${renderAvatar(cont, { size: 24, borderRadius: '6px', fontSize: '0.6rem' })}
                                            <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${cont.full_name}</span>
                                        </div>
                                        <button onclick="window.removeOrderContact('${order.id}', '${cont.id}')" style="background:none; border:none; color:var(--text-tertiary); cursor:pointer; display: flex; align-items: center; opacity: 0.5; transition: all 0.2s;" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.5">
                                            <span class="material-icons-round" style="font-size: 1.1rem;">close</span>
                                        </button>
                                    </div>
                                `).join('') : `
                                    <div style="font-size: 0.75rem; color: var(--text-tertiary); text-align: center; padding: 1.5rem; background: rgba(0,0,0,0.02); border-radius: 12px; border: 1px dashed var(--glass-border);">
                                        Nessun referente collegato
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>

                    <!-- Team Interno ed Incarichi Unificati -->
                    <div class="glass-card" style="padding: 1.5rem;">
                        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1.25rem; font-family: var(--font-titles);">Team Interno</h3>
                        
                        <!-- Account Manager Section -->
                        <div style="margin-bottom: 1.5rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                                <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.02em;">Account Manager</label>
                                <button onclick="window.openAddOrderAccountModal('${order.id}')" style="background:none; border:none; color:var(--brand-blue); font-size:0.7rem; cursor:pointer; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                    <span class="material-icons-round" style="font-size: 14px;">add</span> Aggiungi
                                </button>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                                ${accountList.length > 0 ? accountList.map(acc => `
                                    <div style="display: flex; align-items: center; justify-content: space-between; background: white; padding: 0.6rem 0.75rem; border-radius: 10px; border: 1px solid var(--glass-border);">
                                        <div style="display: flex; align-items: center; gap: 0.6rem;">
                                            ${renderAvatar(acc)}
                                            <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${acc.full_name}</span>
                                        </div>
                                        <button onclick="window.removeOrderAccount('${order.id}', '${acc.id}')" style="background:none; border:none; color:var(--text-tertiary); cursor:pointer; display: flex; align-items: center; opacity: 0.5; transition: all 0.2s;" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.5">
                                            <span class="material-icons-round" style="font-size: 1.1rem;">close</span>
                                        </button>
                                    </div>
                                `).join('') : `
                                    <div style="font-size: 0.75rem; color: var(--text-tertiary); text-align: center; padding: 1rem; background: rgba(0,0,0,0.02); border-radius: 12px; border: 1px dashed var(--glass-border);">
                                        Nessun Account assegnato
                                    </div>
                                `}
                            </div>
                        </div>

                        <!-- Incarichi Section -->
                        <div style="border-top: 1px solid var(--glass-border); padding-top: 1.5rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                                <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.02em;">Incarichi</label>
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <span class="badge" style="background: rgba(59, 130, 246, 0.1); color: var(--brand-blue); font-weight: 600;">${linkedAssignments.length}</span>
                                    <button onclick="window.openAddAssignmentModal('${order.id}')" style="background:none; border:none; color:var(--brand-blue); font-size:0.7rem; cursor:pointer; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                        <span class="material-icons-round" style="font-size: 14px;">add</span> Aggiungi
                                    </button>
                                </div>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                                ${linkedAssignments.length > 0 ? linkedAssignments.map(a => {
            const linkedServices = (state.collaboratorServices || []).filter(s => s.assignment_id === a.id);
            return `
                                        <div class="glass-card clickable-card" style="padding: 1rem; background: var(--bg-secondary); cursor: pointer; display: flex; flex-direction: column; gap: 0.75rem; border: 1px solid var(--glass-border);" onclick="window.location.hash='#assignment-detail/${a.id}'">
                                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                                ${renderAvatar(a.collaborators, { size: 36, borderRadius: '50%', fontSize: '0.8rem' })}
                                                <div style="flex: 1;">
                                                    <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">${a.collaborators?.full_name || 'Collaboratore'}</div>
                                                    <div style="font-size: 0.75rem; color: var(--text-tertiary); display: flex; align-items: center; gap: 0.4rem;">
                                                        <span class="status-dot ${a.status === 'Completed' ? 'status-dot-success' : (a.status === 'In Progress' ? 'status-dot-warning' : 'status-dot-info')}"></span>
                                                        ${tAssignment(a.status) || 'In Corso'}
                                                    </div>
                                                </div>
                                                <div style="text-align: right;">
                                                     <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary);">${formatAmount(a.total_amount)}€</div>
                                                     <div style="font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase;">Totale</div>
                                                </div>
                                            </div>
        
                                            ${linkedServices.length > 0 ? `
                                                <div style="border-top: 1px solid var(--glass-border); padding-top: 0.75rem;">
                                                    <div style="font-size: 0.65rem; text-transform: uppercase; color: var(--text-tertiary); font-weight: 600; margin-bottom: 0.4rem; letter-spacing: 0.05em;">Servizi Inclusi</div>
                                                    <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
                                                        ${linkedServices.map(s => `
                                                            <span style="background: white; border: 1px solid var(--glass-border); padding: 2px 8px; border-radius: 6px; font-size: 0.7rem; color: var(--text-secondary); display: inline-flex; align-items: center; font-weight: 500;">
                                                                ${s.services?.name || s.name} ${s.quantity > 1 ? `<span style="opacity: 0.6; margin-left: 4px; font-size: 0.65rem;">x${s.quantity}</span>` : ''}
                                                            </span>
                                                        `).join('')}
                                                    </div>
                                                </div>
                                            ` : ''}
                                        </div>
                                    `;
        }).join('') : `
                                    <div style="font-size: 0.75rem; color: var(--text-tertiary); text-align: center; padding: 1.5rem; background: rgba(0,0,0,0.02); border-radius: 12px; border: 1px dashed var(--glass-border);">
                                        Nessun incarico creato
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>


                </div>

                <!-- Column 2: Status & Health -->
                <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                    <div class="glass-card" style="padding: 2rem; background: linear-gradient(135deg, white, #f8fafc); border: 1px solid var(--glass-border);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                            <h3 style="font-size: 1.5rem; font-weight: 800; margin: 0; color: var(--text-primary); font-family: var(--font-titles);">Stato Commessa</h3>
                            <button onclick="window.location.hash='#pm/space/${pmSpace?.id}'" style="background:var(--bg-tertiary); border:1px solid var(--glass-border); color:var(--brand-blue); font-size:0.75rem; cursor:pointer; font-weight: 700; display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px;">
                                Hub Operativo <span class="material-icons-round" style="font-size: 14px;">arrow_forward</span>
                            </button>
                        </div>

                        <!-- Stato Lavorazione (Sola Lettura) -->
                        <div style="margin-bottom: 2rem; padding: 1.25rem; background: rgba(var(--brand-blue-rgb), 0.03); border-radius: 16px; border: 1px solid var(--glass-border);">
                            <div style="color: var(--text-tertiary); font-size: 0.65rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.75rem; letter-spacing: 0.05em;">Stato Lavorazione</div>
                            <div style="background: white; border: 1px solid var(--glass-border); padding: 0.75rem 1rem; border-radius: 12px; display: flex; align-items: center; gap: 0.75rem; box-shadow: var(--shadow-sm);">
                                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor}; box-shadow: 0 0 8px ${statusColor}60;"></div>
                                <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); text-transform: capitalize;">${activityTranslate(order.status_works) || 'Da Iniziare'}</span>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                            <div style="padding: 2rem 1rem; background: white; border-radius: 16px; border: 1px solid var(--glass-border); text-align: center; box-shadow: var(--shadow-sm);">
                                <div style="font-size: 2.5rem; font-weight: 900; color: ${pmKPIs.overdue > 0 ? '#ef4444' : 'var(--text-secondary)'}; line-height: 1;">${pmKPIs.overdue}</div>
                                <div style="font-size: 0.75rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 800; margin-top: 8px; letter-spacing: 0.05em;">In Ritardo</div>
                            </div>
                            <div style="padding: 2rem 1rem; background: white; border-radius: 16px; border: 1px solid var(--glass-border); text-align: center; box-shadow: var(--shadow-sm);">
                                <div style="font-size: 2.5rem; font-weight: 900; color: var(--brand-blue); line-height: 1;">${pmKPIs.progress}%</div>
                                <div style="font-size: 0.75rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 800; margin-top: 8px; letter-spacing: 0.05em;">Avanzamento</div>
                            </div>
                        </div>

                        <div>
                            <div style="font-size: 0.85rem; font-weight: 800; color: var(--text-secondary); margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.1em; display: flex; align-items: center; gap: 8px;">
                                <span class="material-icons-round" style="font-size: 1.2rem; color: var(--brand-blue);">event_note</span> Prossime Scadenze
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                                ${upcomingActivities.length > 0 ? upcomingActivities.map(act => `
                                    <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: white; border-radius: 12px; border: 1px solid var(--glass-border); transition: all 0.2s ease;">
                                        <div style="width: 36px; height: 36px; border-radius: 10px; background: ${act.type === 'task' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(139, 92, 246, 0.1)'}; color: ${act.type === 'task' ? '#3b82f6' : '#8b5cf6'}; display: flex; align-items: center; justify-content: center;">
                                            <span class="material-icons-round" style="font-size: 1.25rem;">
                                                ${act.type === 'task' ? 'check_circle_outline' : 'event'}
                                            </span>
                                        </div>
                                        <div style="flex: 1; min-width: 0;">
                                            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${act.title || act.name}</div>
                                            <div style="font-size: 0.75rem; color: var(--text-tertiary);">${new Date(act.due_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</div>
                                        </div>
                                    </div>
                                `).join('') : '<div style="font-size: 0.85rem; color: var(--text-tertiary); text-align: center; font-style: italic; padding: 2rem; background: rgba(0,0,0,0.02); border-radius: 12px;">Nessuna attività programmata</div>'}
                            </div>
                        </div>
                    </div>

                    <!-- Activity Log Section -->
                    <div id="order-activity-log-container-${order.id}" class="glass-card" style="background: white; border: 1px solid var(--glass-border); border-radius: 16px; overflow: hidden; margin-top: 0.25rem;">
                        <!-- Logs will be loaded here -->
                    </div>
                </div>

                <!-- Column 3: Economics -->
                <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                    <!-- Stato Offerta Quick Control -->
                    <div class="glass-card" style="padding: 1.25rem; background: var(--bg-secondary); border: 1px solid var(--glass-border);">
                        <div style="color: var(--text-tertiary); font-size: 0.65rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.75rem; letter-spacing: 0.05em;">Stato Offerta</div>
                         <select id="order-offer-status-select-${order.id}" class="order-status-select" onchange="window.updateOrderOfferStatusQuick('${order.id}', this.value)">
                             <option value="in_lavorazione" data-dot="var(--brand-viola)" ${order.offer_status === 'in_lavorazione' ? 'selected' : ''}>In Lavorazione</option>
                             <option value="invio_programmato" data-dot="#3b82f6" ${order.offer_status === 'invio_programmato' ? 'selected' : ''}>Invio Programmato</option>
                             <option value="inviata" data-dot="#f59e0b" ${order.offer_status === 'inviata' ? 'selected' : ''}>Inviata</option>
                             <option value="accettata" data-dot="#10b981" ${order.offer_status === 'accettata' ? 'selected' : ''}>Offerta Accettata</option>
                             <option value="rifiutata" data-dot="#ef4444" ${order.offer_status === 'rifiutata' ? 'selected' : ''}>Offerta Rifiutata</option>
                         </select>
                    </div>
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
                        ${canSeeInternals && priceDelta != 0 ? `
                                    <div style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: ${priceDelta < 0 ? '#ef4444' : '#10b981'}; font-weight: 600; margin-top: 0.6rem;">
                                        <span class="material-icons-round" style="font-size: 1rem;">${priceDelta < 0 ? 'arrow_downward' : 'arrow_upward'}</span>
                                        <span>${priceDelta > 0 ? '+' : ''}${priceDelta}% vs tariffario</span>
                                    </div>
                                ` : ''}
                    </div>

                    ${canSeeInternals ? `
                        <div style="height: 1px; background: var(--glass-border); opacity: 0.6;"></div>

                        <!-- Costi section (solo admin/privileged) -->
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
                    ` : ''}
                </div>
            </div>

            ${canSeeInternals ? `
                <!-- Ricavi Finali Card (solo admin/privileged) -->
                <div class="glass-card" style="padding: 1.25rem; background: linear-gradient(135deg, ${revenueFinal >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)'}, transparent); border: 2px solid ${revenueFinal >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'};">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                        <div style="flex: 1;">
                            <div style="font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); font-weight: 600; margin-bottom: 0.25rem;">Margine Teorico (da preventivo)</div>
                            <div style="font-size: 1.6rem; font-weight: 800; line-height: 1; color: ${revenueFinal >= 0 ? '#10b981' : '#ef4444'}; font-family: var(--font-titles);">
                                ${priceFinal > 0 && costFinal > 0 ? formatAmount(revenueFinal) + '€' : '—'}
                            </div>
                        </div>
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

                ${hasActualCost ? `
                <!-- Margine Effettivo Card (basato sui contratti reali con i collab) -->
                <div class="glass-card" style="padding: 1.25rem; background: linear-gradient(135deg, ${actualMargin >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)'}, transparent); border: 2px solid ${actualMargin >= 0 ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)'};">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); font-weight: 600; margin-bottom: 0.25rem;">
                                Margine Effettivo
                                <span title="Calcolato dagli ${linkedAssignments.length} incarichi reali firmati con i collab (assignment.amount), non dal preventivo iniziale." style="cursor: help; color: var(--brand-blue); font-size: 0.85rem;">ⓘ</span>
                            </div>
                            <div style="font-size: 1.6rem; font-weight: 800; line-height: 1; color: ${actualMargin >= 0 ? '#10b981' : '#ef4444'}; font-family: var(--font-titles);">
                                ${priceFinal > 0 ? formatAmount(actualMargin) + '€' : '—'}
                            </div>
                        </div>
                        ${priceFinal > 0 ? `
                            <div style="position: relative; width: 60px; height: 60px;">
                                <svg width="60" height="60" style="transform: rotate(-90deg);">
                                    <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(0,0,0,0.05)" stroke-width="5"></circle>
                                    <circle cx="30" cy="30" r="26" fill="none"
                                        stroke="${actualMarginPct >= 20 ? '#10b981' : actualMarginPct >= 10 ? '#f59e0b' : '#ef4444'}"
                                        stroke-width="5"
                                        stroke-dasharray="${(Math.max(0, Math.min(100, actualMarginPct)) / 100) * 163.3} 163.3"
                                        stroke-linecap="round">
                                    </circle>
                                </svg>
                                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                                    <div style="font-size: 0.85rem; font-weight: 800; color: ${actualMarginPct >= 20 ? '#10b981' : actualMarginPct >= 10 ? '#f59e0b' : '#ef4444'};">${actualMarginPct}%</div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <!-- Erosion vs preventivo -->
                    <div style="font-size: 0.78rem; padding: 0.5rem 0.6rem; background: ${costErosion > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)'}; border-radius: 8px; display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
                        <span class="material-icons-round" style="font-size: 16px; color: ${costErosion > 0 ? '#ef4444' : '#10b981'};">${costErosion > 0 ? 'trending_up' : 'trending_down'}</span>
                        <span style="color: var(--text-secondary); flex: 1; min-width: 0;">
                            Costo reale: <strong style="color: ${costErosion > 0 ? '#ef4444' : '#10b981'};">${formatAmount(actualAssignmentCost)}€</strong>
                            ${costFinal > 0 ? ` vs ${formatAmount(costFinal)}€ previsto` : ''}
                            ${costFinal > 0 ? ` <strong style="color: ${costErosion > 0 ? '#ef4444' : '#10b981'};">(${costErosion > 0 ? '+' : ''}${costErosionPct}%)</strong>` : ''}
                        </span>
                    </div>
                </div>
                ` : ''}
            ` : ''}


            ${showInvoiceCTA ? `
            <!-- Smart "Da Fatturare" Card -->
            <div class="glass-card" style="padding: 1.25rem; background: ${isOrderClosed ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.10), rgba(16, 185, 129, 0.02))' : 'var(--bg-secondary)'}; border: ${isOrderClosed ? '2px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--glass-border)'};">
                <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.85rem;">
                    <div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; background: rgba(16, 185, 129, 0.15);">
                        <span class="material-icons-round" style="font-size: 1.1rem; color: #10b981;">receipt</span>
                    </div>
                    <span style="font-weight: 700; font-size: 1rem; color: var(--text-primary); font-family: var(--font-titles);">Da Fatturare</span>
                    ${isOrderClosed ? '<span style="font-size: 0.65rem; padding: 2px 8px; border-radius: 999px; background: #10b981; color: white; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Lavoro chiuso</span>' : ''}
                </div>
                <div style="display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <span style="font-size: 1.6rem; font-weight: 800; color: #10b981; font-family: var(--font-titles); line-height: 1;">${formatAmount(toBeInvoiced)}€</span>
                    <span style="font-size: 0.75rem; color: var(--text-tertiary);">residuo</span>
                </div>
                <div style="font-size: 0.72rem; color: var(--text-secondary); margin-bottom: 0.85rem;">
                    Fatturato finora: <strong>${formatAmount(totalInvoicedOnOrder)}€</strong>
                    ${linkedInvoicesForOrder.length > 0 ? ` su ${linkedInvoicesForOrder.length} fattur${linkedInvoicesForOrder.length === 1 ? 'a' : 'e'}` : ' — nessuna fattura emessa'}
                    · prezzo commessa <strong>${formatAmount(priceFinal)}€</strong>
                </div>
                <button onclick="window.prefillInvoiceFromOrder('${order.id}', ${toBeInvoiced.toFixed(2)})" class="primary-btn" style="width: 100%; justify-content: center; gap: 0.5rem; background: #10b981; color: white; border: none; padding: 0.7rem; border-radius: 10px; font-weight: 600; cursor: pointer;">
                    <span class="material-icons-round">add_circle</span>
                    ${linkedInvoicesForOrder.length === 0 ? 'Genera fattura' : 'Genera fattura saldo'} ${formatAmount(toBeInvoiced)}€
                </button>
            </div>
            ` : ''}

            <!-- Preventivo Automation Card -->
            <div class="glass-card" style="padding: 1.25rem; background: var(--bg-secondary); border: 1px solid var(--glass-border);">
                <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem;">
                    <div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; background: rgba(139, 92, 246, 0.1);">
                        <span class="material-icons-round" style="font-size: 1.1rem; color: #8b5cf6;">request_quote</span>
                    </div>
                    <span style="font-weight: 700; font-size: 1rem; color: var(--text-primary); font-family: var(--font-titles);">Preventivo</span>
                </div>
                ${(() => {
            const quoteLinks = (order.cloud_links || []).filter(l => l.type === 'quote');
            const latestQuote = quoteLinks.sort((a, b) => new Date(b.generated_at || b.date) - new Date(a.generated_at || a.date))[0];

            if (latestQuote) {
                return `
                            <button onclick="window.open('${latestQuote.url}', '_blank')" class="primary-btn" style="width: 100%; justify-content: center; gap: 0.5rem; background: var(--success-color); color: white; border: none; padding: 0.8rem; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                                <span class="material-icons-round">open_in_new</span> Apri Preventivo
                            </button>
                            <div style="margin-top: 0.6rem; text-align: center;">
                                <button onclick="window.generateQuote('${order.id}', this.parentElement.previousElementSibling)" style="background: none; border: none; font-size: 0.75rem; color: var(--text-tertiary); cursor: pointer; text-decoration: underline;">Rigenera preventivo</button>
                            </div>
                        `;
            }
            return `
                        <button onclick="window.generateQuote('${order.id}', this)" class="primary-btn" style="width: 100%; justify-content: center; gap: 0.5rem; background: var(--brand-gradient); color: white; border: none; padding: 0.8rem; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                            <span class="material-icons-round">bolt</span> Genera Preventivo
                        </button>
                    `;
        })()}
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
                                                    <span>${p.due_date ? new Date(p.due_date).toLocaleDateString('it-IT') : '-'}</span>
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
                                                            <span>${p.due_date ? new Date(p.due_date).toLocaleDateString('it-IT') : '-'}</span>
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

    // Initialize Custom Selects for Status Controls
    const s2 = container.querySelector(`#order-offer-status-select-${order.id}`);
    if (s2) new CustomSelect(s2);

    // Help inline AI: bottone "Spiegami" sul titolo commessa (è nel pageTitle, fuori dal container)
    const pageTitleEl = document.getElementById('page-title');
    if (pageTitleEl) attachInlineHelp(pageTitleEl, _buildOrderHelpContext);

    // Global click listener to close the actions dropdown
    window.addEventListener('click', () => {
        const dropdowns = container.querySelectorAll('.actions-dropdown-content');
        dropdowns.forEach(d => d.style.display = 'none');
    });

    // Render Activity Log
    const logContainer = container.querySelector(`#order-activity-log-container-${order.id}`);
    if (logContainer) {
        import('./pm/components/activity_log.js?v=8000').then(mod => {
            mod.renderActivityLog(logContainer, { orderId: order.id });
        }).catch(err => console.error("Error loading activity log module:", err));
    }
}

// 4 order action UI window handlers (generateQuote, openOrderDocsModal, openAccountActivitiesModal, openOrderCloudResourcesModal)
// extracted to ./orders/actions_ui.js

// Payment config + window handlers extracted to ./orders/payment_config.js

// initOrderPaymentModals + renderManualPaymentModal extracted to ./orders/payment_modals.js

// editOrderEconomics + initOrderEconomicsModal extracted to ./orders/economics_modal.js

// initOrderPeopleModals + 8 window handlers extracted to ./orders/people_modal.js





// editOrder + initOrderModal extracted to ./orders/order_modal.js

// Assignment modal (multi-step wizard) + 13 window handlers extracted
// to ./orders/assignment_modal.js (Fase split-monstro orders step 4)

// deleteOrder + updateOrderOfferStatusQuick + updateOrderStatusQuick extracted to ./orders/status_actions.js

// ────────────────────────────────────────────────────────
// New Order Modal
// ────────────────────────────────────────────────────────


// initNewOrderModal extracted to ./orders/new_order_modal.js

// ─────────────────────────────────────────────────────────────────────────────
// Help inline AI: context loader per "Spiegami questa commessa"
// ─────────────────────────────────────────────────────────────────────────────
async function _buildOrderHelpContext(orderId, contextType) {
    if (contextType !== 'order') return null;
    const order = state.orders?.find(o => o.id === orderId);
    if (!order) return null;

    const client = order.clients?.business_name || (state.clients || []).find(c => c.id === order.client_id)?.business_name || 'cliente non specificato';
    const services = (state.collaboratorServices || []).filter(s => s.order_id === orderId);
    const assignments = (state.assignments || []).filter(a => a.order_id === orderId);
    const payments = (state.payments || []).filter(p => p.order_id === orderId);
    const invoices = (state.invoices || []).filter(i => i.order_id === orderId);

    const paid = payments.filter(p => /completat|saldato|pagato/i.test(p.status || '')).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const pending = payments.filter(p => !/completat|saldato|pagato/i.test(p.status || '')).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

    const text = `
Sto guardando questa commessa:

- Codice ordine: ${order.order_number || '?'}
- Titolo: ${order.title || 'senza titolo'}
- Cliente: ${client}
- Stato offerta: ${order.offer_status || 'non specificato'}
- Stato lavori: ${order.status_works || 'non specificato'}
- Data creazione: ${order.created_at ? new Date(order.created_at).toLocaleDateString('it-IT') : '?'}
- Prezzo finale al cliente: ${order.price_final ? '€ ' + Number(order.price_final).toFixed(2) : 'non valorizzato'}
- Costo finale: ${order.cost_final ? '€ ' + Number(order.cost_final).toFixed(2) : 'non valorizzato'}

Servizi del tariffario collegati: ${services.length}
${services.slice(0, 8).map(s => `  - ${s.services?.name || s.legacy_service_name || s.name || 'servizio'} (${s.quantity || s.hours || '?'} unità)`).join('\n')}
${services.length > 8 ? `  - …e altri ${services.length - 8}\n` : ''}

Incarichi a collaboratori: ${assignments.length}
${assignments.slice(0, 5).map(a => `  - ${a.collaborators?.full_name || '?'} (€ ${a.total_amount || 0}, stato: ${a.status || '?'})`).join('\n')}

Fatturazione:
- Fatture emesse al cliente: ${invoices.length}
- Pagamenti pianificati: ${payments.length} (saldato € ${paid.toFixed(2)}, in attesa € ${pending.toFixed(2)})

Spiegami in 4-5 frasi:
1. Cos'è questa commessa in sintesi (per chi non l'ha mai vista)
2. A che punto siamo (offerta? lavori in corso? consegnata?)
3. C'è qualcosa che richiede attenzione adesso? (scadenze, ritardi, fatture aperte, costi sopra preventivo)
4. Suggerimento di prossimo passo se evidente

Italiano colloquiale, niente bullet point.
`.trim();

    return { text };
}
