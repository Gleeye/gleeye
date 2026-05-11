import { state } from '/js/modules/state.js?v=8000';
import { supabase } from '../modules/config.js?v=8000';
import { formatAmount, showGlobalAlert, showConfirm, getInitials, getAvatarColor, renderAvatar } from '../modules/utils.js?v=8000';
import { upsertPayment, deletePayment, upsertOrder, updateOrder, deleteOrder, updateOrderEconomics, fetchPayments, fetchOrders, fetchAssignments, fetchCollaborators, fetchServices, addOrderAccount, removeOrderAccount, fetchOrderAccounts, addOrderContact, removeOrderContact, fetchOrderContacts, updateOrderCloudLinks, generateNextOrderNumber } from '../modules/api.js?v=8000';
import { CloudLinksManager } from './components/CloudLinksManager.js?v=8000';
import { CustomSelect } from '../components/CustomSelect.js?v=8000';
import { openPaymentModal } from './payments.js?v=8000';
import { fetchProjectSpaceForOrder, fetchProjectItems, fetchAppointments } from '../modules/pm_api.js?v=8000';
import { activityTranslate } from '../modules/pm_activity_helper.js?v=8000';

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

    const statusColor = getStatusColor(order.status_works || order.status);

    const linkedAssignments = state.assignments ? state.assignments.filter(a =>
        a.order_id === order.id ||
        (a.orders && a.orders.order_id === order.id) ||
        (a.legacy_order_id && a.legacy_order_id === order.order_number)
    ) : [];

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
                        <div style="display: flex; align-items: center; gap: 1rem; color: var(--text-tertiary); font-size: 0.85rem;">
                            <span style="display: flex; align-items: center; gap: 0.4rem;"><span class="material-icons-round" style="font-size: 1rem;">calendar_today</span> ${new Date(order.created_at).toLocaleDateString()}</span>
                            <span style="display: flex; align-items: center; gap: 0.4rem;"><span class="material-icons-round" style="font-size: 1rem;">business</span> ${order.clients?.client_code || 'N/A'}</span>
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
                                                        ${a.status || 'Attivo'}
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

    // Initialize Custom Selects for Status Controls
    const s2 = container.querySelector(`#order-offer-status-select-${order.id}`);
    if (s2) new CustomSelect(s2);

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
        import('../modules/api.js?v=8000').then(({ fetchCollaborators }) => fetchCollaborators());
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
        const { fetchServices, fetchCollaborators } = await import('../modules/api.js?v=8000');
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

    // Calculate initial total (using cost)
    const total = cost * 1;
    totalDisplay.textContent = '€ ' + formatMoney(total);

    // Attach listener for dynamic calc
    qtyInput.oninput = () => {
        const qty = parseFloat(qtyInput.value) || 0;
        const subTotal = cost * qty;
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
        const { upsertAssignment, upsertCollaboratorService, fetchCollaboratorServices, fetchAssignments, upsertPayment, fetchPayments } = await import('../modules/api.js?v=8000');
        const { calculateProposedAssignmentPayments } = await import('./assignments.js?v=8000');

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

// deleteOrder + updateOrderOfferStatusQuick + updateOrderStatusQuick extracted to ./orders/status_actions.js

// ────────────────────────────────────────────────────────
// New Order Modal
// ────────────────────────────────────────────────────────

export function initNewOrderModal() {
    const existing = document.getElementById('new-order-modal');
    if (existing) existing.remove(); // always re-create to get fresh state

    // Internal wizard state
    const newOrderState = {
        selectedAccounts: [],   // { id, full_name }
        selectedClient: null,   // { id, business_name }
        selectedContacts: [],   // { id, full_name }
    };

    // Insert animation keyframes if not present
    if (!document.getElementById('new-ord-animations')) {
        document.head.insertAdjacentHTML('beforeend', `
            <style id="new-ord-animations">
                @keyframes dropdownSlide {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .new-ord-item:hover {
                    background: rgba(var(--brand-blue-rgb, 59, 130, 246), 0.05) !important;
                }
            </style>
        `);
    }

    document.body.insertAdjacentHTML('beforeend', `
        <div id="new-order-modal" class="modal">
            <div class="modal-content" style="max-width: 600px; padding: 2rem; overflow: visible !important;">

                <!-- Header -->
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(16, 185, 129, 0.1); display: flex; align-items: center; justify-content: center;">
                            <span class="material-icons-round" style="color: #10b981;">add_circle</span>
                        </div>
                        <h2 style="margin: 0; font-family: var(--font-titles); font-weight: 700;">Nuovo Ordine</h2>
                    </div>
                    <button class="icon-btn" onclick="document.getElementById('new-order-modal').classList.remove('active')">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>

                <div style="display: flex; flex-direction: column; gap: 1.5rem; margin-bottom: 2rem;">

                    <!-- 1) Titolo Commessa -->
                    <div>
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Titolo Commessa</label>
                        <input type="text" id="new-ord-title" class="modal-input" style="width: 100%;" placeholder="Es: Campagna Social Estate 2026">
                    </div>

                    <!-- 2) Account (multiselect) -->
                    <div style="position: relative;">
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Account</label>
                        <div style="position: relative;">
                            <span class="material-icons-round" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 1.1rem; color: var(--text-tertiary); pointer-events: none;">search</span>
                            <input type="text" id="new-ord-acc-search" class="modal-input" placeholder="Cerca account..." style="width: 100%; padding-left: 2.5rem;" autocomplete="off">
                        </div>
                        <div id="new-ord-acc-dropdown" style="position: absolute; top: 100%; left: 0; right: 0; z-index: 999; max-height: 300px; overflow-y: auto; display: none; background: rgba(255, 255, 255, 0.95); border: 1px solid var(--glass-border); border-radius: 16px; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.3); margin-top: 0.6rem; backdrop-filter: blur(20px); animation: dropdownSlide 0.2s ease-out;"></div>
                        <div id="new-ord-acc-chips" style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem;"></div>
                    </div>

                    <!-- 3) Cliente (single select) -->
                    <div style="position: relative;">
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Cliente</label>
                        <div style="position: relative;">
                            <span class="material-icons-round" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 1.1rem; color: var(--text-tertiary); pointer-events: none;">business</span>
                            <input type="text" id="new-ord-client-search" class="modal-input" placeholder="Cerca cliente..." style="width: 100%; padding-left: 2.5rem;" autocomplete="off">
                        </div>
                        <div id="new-ord-client-dropdown" style="position: absolute; top: 100%; left: 0; right: 0; z-index: 999; max-height: 300px; overflow-y: auto; display: none; background: rgba(255, 255, 255, 0.95); border: 1px solid var(--glass-border); border-radius: 16px; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.3); margin-top: 0.6rem; backdrop-filter: blur(20px); animation: dropdownSlide 0.2s ease-out;"></div>
                        <div id="new-ord-client-selected" style="display: none; margin-top: 0.5rem;"></div>
                    </div>

                    <!-- 4) Referente (multiselect, hidden until client selected) -->
                    <div id="new-ord-contact-section" style="display: none; position: relative;">
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Referente</label>
                        <div style="position: relative;">
                            <span class="material-icons-round" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 1.1rem; color: var(--text-tertiary); pointer-events: none;">contact_page</span>
                            <input type="text" id="new-ord-contact-search" class="modal-input" placeholder="Cerca referente..." style="width: 100%; padding-left: 2.5rem;" autocomplete="off">
                        </div>
                        <div id="new-ord-contact-dropdown" style="position: absolute; top: 100%; left: 0; right: 0; z-index: 999; max-height: 300px; overflow-y: auto; display: none; background: rgba(255, 255, 255, 0.95); border: 1px solid var(--glass-border); border-radius: 16px; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.3); margin-top: 0.6rem; backdrop-filter: blur(20px); animation: dropdownSlide 0.2s ease-out;"></div>
                        <div id="new-ord-contact-chips" style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem;"></div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="flex-end" style="gap: 1rem;">
                    <button class="primary-btn secondary" onclick="document.getElementById('new-order-modal').classList.remove('active')">Annulla</button>
                    <button class="primary-btn" id="new-ord-btn-save">
                        <span class="material-icons-round" style="font-size: 1.1rem;">save</span>
                        Crea Ordine
                    </button>
                </div>
            </div>
        </div>
    `);

    // ── Helper: render account chips ──
    const renderAccChips = () => {
        const container = document.getElementById('new-ord-acc-chips');
        container.innerHTML = newOrderState.selectedAccounts.map((a, i) => `
            <span style="display: inline-flex; align-items: center; gap: 0.35rem; background: rgba(59, 130, 246, 0.1); color: var(--brand-blue); border: 1px solid rgba(59, 130, 246, 0.2); padding: 0.3rem 0.6rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">
                ${a.full_name}
                <span class="material-icons-round" style="font-size: 0.9rem; cursor: pointer; opacity: 0.7;" data-remove-acc="${i}">close</span>
            </span>
        `).join('');
        container.querySelectorAll('[data-remove-acc]').forEach(btn => {
            btn.addEventListener('click', () => {
                newOrderState.selectedAccounts.splice(parseInt(btn.dataset.removeAcc), 1);
                renderAccChips();
            });
        });
    };

    // ── Helper: render contact chips ──
    const renderContactChips = () => {
        const container = document.getElementById('new-ord-contact-chips');
        container.innerHTML = newOrderState.selectedContacts.map((c, i) => `
            <span style="display: inline-flex; align-items: center; gap: 0.35rem; background: rgba(139, 92, 246, 0.1); color: #8b5cf6; border: 1px solid rgba(139, 92, 246, 0.2); padding: 0.3rem 0.6rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">
                ${c.full_name}
                <span class="material-icons-round" style="font-size: 0.9rem; cursor: pointer; opacity: 0.7;" data-remove-contact="${i}">close</span>
            </span>
        `).join('');
        container.querySelectorAll('[data-remove-contact]').forEach(btn => {
            btn.addEventListener('click', () => {
                newOrderState.selectedContacts.splice(parseInt(btn.dataset.removeContact), 1);
                renderContactChips();
            });
        });
    };

    // ── Account search & dropdown ──
    const accSearch = document.getElementById('new-ord-acc-search');
    const accDropdown = document.getElementById('new-ord-acc-dropdown');

    const filterAccounts = () => {
        const term = accSearch.value.toLowerCase();
        const accounts = (state.collaborators || []).filter(c => {
            if (c.is_active === false || c.active === false) return false;

            // Check in tags (array or string)
            const tags = Array.isArray(c.tags) ? c.tags : (c.tags || '').split(',');
            const hasAccountTag = tags.some(t => t.trim().toLowerCase().includes('account'));

            // Also check in role for safety
            const hasAccountRole = (c.role || '').toLowerCase().includes('account');

            const matches = c.full_name.toLowerCase().includes(term);
            const alreadySelected = newOrderState.selectedAccounts.some(a => a.id === c.id);
            return (hasAccountTag || hasAccountRole) && matches && !alreadySelected;
        });

        if (accounts.length === 0) {
            accDropdown.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--text-tertiary); font-size: 0.85rem;">Nessun account trovato</div>`;
        } else {
            accDropdown.innerHTML = accounts.map((c, i) => `
                <div class="new-ord-acc-item new-ord-item" data-id="${c.id}" data-name="${c.full_name}" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.8rem 1rem; cursor: pointer; transition: all 0.2s; ${i === accounts.length - 1 ? '' : 'border-bottom: 1px solid var(--glass-border);'}">
                    ${renderAvatar(c, { size: 32, borderRadius: '50%', fontSize: '0.7rem' })}
                    <div style="flex: 1;">
                        <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">${c.full_name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-tertiary);">${c.role || 'Collaboratore'}</div>
                    </div>
                </div>
            `).join('');
        }
        accDropdown.style.display = 'block';

        accDropdown.querySelectorAll('.new-ord-acc-item').forEach(item => {
            item.addEventListener('click', () => {
                newOrderState.selectedAccounts.push({ id: item.dataset.id, full_name: item.dataset.name });
                accSearch.value = '';
                accDropdown.style.display = 'none';
                renderAccChips();
            });
        });
    };

    accSearch.addEventListener('input', filterAccounts);
    accSearch.addEventListener('focus', filterAccounts);
    document.addEventListener('click', (e) => {
        if (!accSearch.contains(e.target) && !accDropdown.contains(e.target)) {
            accDropdown.style.display = 'none';
        }
    });

    // ── Client search & dropdown ──
    const clientSearch = document.getElementById('new-ord-client-search');
    const clientDropdown = document.getElementById('new-ord-client-dropdown');
    const clientSelected = document.getElementById('new-ord-client-selected');
    const contactSection = document.getElementById('new-ord-contact-section');

    const filterClients = () => {
        const term = clientSearch.value.toLowerCase();
        const clients = (state.clients || []).filter(c =>
            (c.business_name || '').toLowerCase().includes(term)
        );

        if (clients.length === 0) {
            clientDropdown.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--text-tertiary); font-size: 0.85rem;">Nessun cliente trovato</div>`;
        } else {
            clientDropdown.innerHTML = clients.map((c, i) => `
                <div class="new-ord-client-item new-ord-item" data-id="${c.id}" data-name="${c.business_name}" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.8rem 1rem; cursor: pointer; transition: all 0.2s; ${i === clients.length - 1 ? '' : 'border-bottom: 1px solid var(--glass-border);'}">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(16, 185, 129, 0.1); color: #10b981; display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons-round" style="font-size: 1.2rem;">business</span>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">${c.business_name}</div>
                        ${c.client_code ? `<div style="font-size: 0.75rem; color: var(--text-tertiary);">${c.client_code}</div>` : ''}
                    </div>
                </div>
            `).join('');
        }
        clientDropdown.style.display = 'block';

        clientDropdown.querySelectorAll('.new-ord-client-item').forEach(item => {
            item.addEventListener('click', () => {
                newOrderState.selectedClient = { id: item.dataset.id, business_name: item.dataset.name };
                clientSearch.style.display = 'none';
                clientDropdown.style.display = 'none';
                clientSelected.style.display = 'flex';
                clientSelected.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 12px;">
                        <span class="material-icons-round" style="color: #10b981; font-size: 1.2rem;">business</span>
                        <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary); flex: 1;">${item.dataset.name}</span>
                        <span class="material-icons-round" id="new-ord-clear-client" style="font-size: 1rem; cursor: pointer; color: var(--text-tertiary);">close</span>
                    </div>
                `;
                document.getElementById('new-ord-clear-client').addEventListener('click', () => {
                    newOrderState.selectedClient = null;
                    newOrderState.selectedContacts = [];
                    clientSearch.style.display = 'block';
                    clientSearch.value = '';
                    clientSelected.style.display = 'none';
                    contactSection.style.display = 'none';
                    renderContactChips();
                });

                // Show referente section
                contactSection.style.display = 'block';
                newOrderState.selectedContacts = [];
                renderContactChips();
            });
        });
    };

    clientSearch.addEventListener('input', filterClients);
    clientSearch.addEventListener('focus', filterClients);
    document.addEventListener('click', (e) => {
        if (!clientSearch.contains(e.target) && !clientDropdown.contains(e.target)) {
            clientDropdown.style.display = 'none';
        }
    });

    // ── Contact search & dropdown ──
    const contactSearch = document.getElementById('new-ord-contact-search');
    const contactDropdown = document.getElementById('new-ord-contact-dropdown');

    const filterContacts = () => {
        const term = contactSearch.value.toLowerCase();
        const clientId = newOrderState.selectedClient?.id;
        if (!clientId) return;

        const contacts = (state.contacts || []).filter(c => {
            if (c.client_id !== clientId) return false;
            const matches = (c.full_name || '').toLowerCase().includes(term);
            const alreadySelected = newOrderState.selectedContacts.some(s => s.id === c.id);
            return matches && !alreadySelected;
        });

        if (contacts.length === 0) {
            contactDropdown.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--text-tertiary); font-size: 0.85rem;">Nessun referente trovato per questo cliente</div>`;
        } else {
            contactDropdown.innerHTML = contacts.map((c, i) => `
                <div class="new-ord-contact-item new-ord-item" data-id="${c.id}" data-name="${c.full_name}" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.8rem 1rem; cursor: pointer; transition: all 0.2s; ${i === contacts.length - 1 ? '' : 'border-bottom: 1px solid var(--glass-border);'}">
                    ${renderAvatar(c, { size: 32, borderRadius: '50%', fontSize: '0.8rem' })}
                    <div style="flex: 1;">
                        <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">${c.full_name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-tertiary);">${c.role || 'Referente'}</div>
                    </div>
                </div>
            `).join('');
        }
        contactDropdown.style.display = 'block';

        contactDropdown.querySelectorAll('.new-ord-contact-item').forEach(item => {
            item.addEventListener('click', () => {
                newOrderState.selectedContacts.push({ id: item.dataset.id, full_name: item.dataset.name });
                contactSearch.value = '';
                contactDropdown.style.display = 'none';
                renderContactChips();
            });
        });
    };

    contactSearch.addEventListener('input', filterContacts);
    contactSearch.addEventListener('focus', filterContacts);
    document.addEventListener('click', (e) => {
        if (!contactSearch.contains(e.target) && !contactDropdown.contains(e.target)) {
            contactDropdown.style.display = 'none';
        }
    });

    // ── Save button ──
    document.getElementById('new-ord-btn-save').addEventListener('click', async () => {
        const title = document.getElementById('new-ord-title').value.trim();
        if (!title) {
            showGlobalAlert('Inserisci un titolo per la commessa', 'error');
            return;
        }

        const saveBtn = document.getElementById('new-ord-btn-save');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="loader" style="width:20px;height:20px;"></span> Creazione...';

        try {
            // 0. Generate Order Number
            const nextNumber = await generateNextOrderNumber();
            const today = new Date().toISOString().split('T')[0];

            // 1. Create the order
            const orderData = {
                title,
                order_number: nextNumber,
                order_date: today,
                offer_status: 'in_lavorazione',
                status_works: 'da_iniziare',
                status_sales: null // Prevent DB DEFAULT 'draft' from violating the check constraint
            };
            if (newOrderState.selectedClient) {
                orderData.client_id = newOrderState.selectedClient.id;
            }

            const newOrder = await upsertOrder(orderData);

            // 2. Link accounts
            for (const acc of newOrderState.selectedAccounts) {
                try { await addOrderAccount(newOrder.id, acc.id); } catch (e) { console.warn('Error adding account:', e); }
            }

            // 3. Link contacts (referenti)
            for (const cont of newOrderState.selectedContacts) {
                try { await addOrderContact(newOrder.id, cont.id); } catch (e) { console.warn('Error adding contact:', e); }
            }

            // 4. Refresh & navigate
            await fetchOrders();
            document.getElementById('new-order-modal').classList.remove('active');
            showGlobalAlert('Ordine creato con successo!', 'success');
            window.location.hash = `order-detail/${newOrder.id}`;
        } catch (e) {
            console.error('Error creating order:', e);
            showGlobalAlert('Errore durante la creazione dell\'ordine: ' + (e.message || e), 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<span class="material-icons-round" style="font-size: 1.1rem;">save</span> Crea Ordine';
        }
    });

    // ── Open helper ──
    window.openNewOrderModal = async () => {
        // Ensure data is loaded
        if (!state.collaborators || state.collaborators.length === 0) fetchCollaborators();
        if (!state.clients || state.clients.length === 0) fetchClients();
        if (!state.contacts || state.contacts.length === 0) fetchContacts();

        // Reset state
        newOrderState.selectedAccounts = [];
        newOrderState.selectedClient = null;
        newOrderState.selectedContacts = [];

        document.getElementById('new-ord-title').value = '';
        document.getElementById('new-ord-acc-search').value = '';
        document.getElementById('new-ord-acc-chips').innerHTML = '';
        document.getElementById('new-ord-client-search').value = '';
        document.getElementById('new-ord-client-search').style.display = 'block';
        document.getElementById('new-ord-client-selected').style.display = 'none';
        document.getElementById('new-ord-client-dropdown').style.display = 'none';
        document.getElementById('new-ord-acc-dropdown').style.display = 'none';
        document.getElementById('new-ord-contact-section').style.display = 'none';
        document.getElementById('new-ord-contact-search').value = '';
        document.getElementById('new-ord-contact-chips').innerHTML = '';

        const saveBtn = document.getElementById('new-ord-btn-save');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span class="material-icons-round" style="font-size: 1.1rem;">save</span> Crea Ordine';

        document.getElementById('new-order-modal').classList.add('active');
    };
}
