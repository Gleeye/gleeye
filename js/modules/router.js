import { state } from './state.js?v=123';
import { renderDashboard } from '../features/dashboard.js?v=123';
import { renderClients, renderClientDetail } from '../features/clients.js?v=123';
import { renderCollaborators, renderCollaboratorDetail } from '../features/collaborators.js?v=123';
import { renderContacts } from '../features/contacts.js?v=123';
import { renderOrderDetail } from '../features/orders.js?v=123';
import { renderInvoices, renderPassiveInvoicesCollab, renderPassiveInvoicesSuppliers } from '../features/invoices.js?v=123';
import { renderInvoicesDashboard } from '../features/dashboard.js?v=123';
import { renderBankTransactions } from '../features/bank_transactions.js?v=123';
import { renderSuppliers, initSupplierModals } from '../features/suppliers_v2.js?v=123';
import { renderBankStatements } from '../features/bank_statements.js?v=123';
import { renderServices } from '../features/services.js?v=123';
import { renderCollaboratorServices } from '../features/collaborator_services.js?v=123';
import { renderAssignmentDetail, renderAssignmentsDashboard } from '../features/assignments.js?v=123';
import { renderPaymentsDashboard, initPaymentModals } from '../features/payments.js?v=123';
import { renderBooking } from '../features/booking.js?v=123';
import { renderUserProfile } from '../features/user_dashboard.js?v=123';
import { renderAgenda } from '../features/personal_agenda.js?v=125';
import { renderNotificationCenter } from '../features/notifications.js?v=123';
import { renderAdminNotifications } from '../features/admin_notifications.js?v=123';

export function router() {
    // Try to restore saved route on initial load (no hash but has saved route)
    const savedRoute = sessionStorage.getItem('gleeye_current_route');
    let hash = window.location.hash.slice(1);

    // If no hash but we have a saved route, restore it
    if (!hash && savedRoute) {
        console.log(`[Router] Restoring saved route: ${savedRoute}`);
        hash = savedRoute;
        window.location.hash = savedRoute;
        return; // The hash change will re-trigger router
    }

    // Default to dashboard if no hash
    hash = hash || 'dashboard';
    const [page, id] = hash.split('/');
    console.log(`Router handling hash: #${hash} -> page: ${page}, id: ${id}`);

    state.currentPage = page;
    state.currentId = id || null;

    // --- ACCESS CONTROL / IMPERSONATION ---
    const activeRole = state.impersonatedRole || state.profile?.role || 'collaborator';

    // List of pages allowed for Collaborators
    const allowedPagesForCollaborator = ['booking', 'profile', 'agenda', 'my-assignments'];

    // Don't redirect if we are still fetching profile/auth - wait for it
    if (state.isFetching && activeRole === 'collaborator') {
        console.log("[Router] Still fetching profile, delaying access check...");
        return;
    }

    console.log(`[Router] Routing to: ${state.currentPage}, Role: ${activeRole}`);

    if (activeRole !== 'admin' && !allowedPagesForCollaborator.includes(state.currentPage)) {
        console.warn(`[Router] Access denied for role '${activeRole}' to page '${state.currentPage}'. Redirecting...`);
        // Force redirect to a safe page
        state.currentPage = 'booking';
        window.location.hash = 'booking';
        return; // Stop here, the hash change will trigger router again
    }

    // SAVE current route to sessionStorage for persistence across reloads
    sessionStorage.setItem('gleeye_current_route', hash);

    render();
    updateActiveLink();
}

function render() {
    const contentArea = document.getElementById('content-area');
    const pageTitle = document.getElementById('page-title');
    if (!contentArea) return;

    contentArea.innerHTML = '';

    // Default Title Update
    if (pageTitle) pageTitle.textContent = state.currentPage.charAt(0).toUpperCase() + state.currentPage.slice(1);

    try {
        switch (state.currentPage) {
            case 'dashboard':
                if (pageTitle) pageTitle.textContent = 'Ordini';
                renderDashboard(contentArea);
                break;
            case 'agenda':
                console.log("[Router] Rendering Agenda...");
                if (pageTitle) pageTitle.textContent = 'Agenda Personale';
                renderAgenda(contentArea);
                break;
            case 'my-assignments':
                if (pageTitle) pageTitle.textContent = 'I Miei Incarichi';
                renderPlaceholder(contentArea, 'I Miei Incarichi');
                break;
            case 'sales': // Clients list
                if (pageTitle) pageTitle.textContent = 'Anagrafica Clienti';
                renderClients(contentArea);
                break;
            case 'client-detail':
                if (pageTitle) pageTitle.textContent = 'Dettaglio Cliente';
                renderClientDetail(contentArea);
                break;
            case 'employees':
                if (pageTitle) pageTitle.textContent = 'Collaboratori';
                renderCollaborators(contentArea);
                break;
            case 'collaborator-detail':
                if (pageTitle) pageTitle.textContent = 'Dettaglio Collaboratore';
                renderCollaboratorDetail(contentArea);
                break;
            case 'contacts':
                if (pageTitle) pageTitle.textContent = 'Anagrafica Referenti';
                renderContacts(contentArea);
                break;
            case 'invoices': // Active Invoices List
                if (pageTitle) pageTitle.textContent = 'Fatture Attive';
                renderInvoices(contentArea);
                break;
            case 'invoices-dashboard':
                if (pageTitle) pageTitle.textContent = 'Dashboard Fatturato';
                renderInvoicesDashboard(contentArea);
                break;
            case 'passive-invoices-collab':
                if (pageTitle) pageTitle.textContent = 'Fatture Collaboratori';
                renderPassiveInvoicesCollab(contentArea);
                break;
            case 'passive-invoices-suppliers':
                if (pageTitle) pageTitle.textContent = 'Fatture Fornitori';
                renderPassiveInvoicesSuppliers(contentArea);
                break;
            case 'bank-transactions':
                if (pageTitle) pageTitle.textContent = 'Registro Movimenti';
                renderBankTransactions(contentArea);
                break;
            case 'bank-statements':
                if (pageTitle) pageTitle.textContent = 'Estratti Conto';
                renderBankStatements(contentArea);
                break;
            case 'invoices-archive':
                if (pageTitle) pageTitle.textContent = 'Archivio Storico';
                renderPlaceholder(contentArea, 'Archivio Storico');
                break;
            case 'settings':
                if (pageTitle) pageTitle.textContent = 'Impostazioni';
                renderPlaceholder(contentArea, 'Impostazioni Generali');
                break;
            case 'order-detail':
                if (pageTitle) pageTitle.textContent = 'Dettaglio Commessa';
                renderOrderDetail(contentArea);
                break;
            case 'suppliers':
                state.currentPage = 'suppliers';
                initSupplierModals();
                renderSuppliers(contentArea);
                break;
            case 'services':
                if (pageTitle) pageTitle.textContent = 'Catalogo Servizi';
                renderServices(contentArea);
                break;
            case 'collaborator-services':
                if (pageTitle) pageTitle.textContent = 'Servizi Collaboratori';
                renderCollaboratorServices(contentArea);
                break;
            case 'assignment-detail':
                if (pageTitle) pageTitle.textContent = 'Dettaglio Incarico';
                renderAssignmentDetail(contentArea);
                break;
            case 'assignments':
                if (pageTitle) pageTitle.textContent = 'Incarichi';
                renderAssignmentsDashboard(contentArea);
                break;
            case 'payments':
                if (pageTitle) pageTitle.textContent = 'Scadenziario Pagamenti';
                initPaymentModals();
                renderPaymentsDashboard(contentArea);
                break;
            case 'booking':
                renderBooking(contentArea);
                break;
            case 'profile':
                if (pageTitle) pageTitle.textContent = 'Il Mio Profilo';
                renderUserProfile(contentArea);
                break;
            case 'notifications':
                if (pageTitle) pageTitle.textContent = 'Centro Notifiche';
                renderNotificationCenter(contentArea);
                break;
            case 'admin-notifications':
                if (pageTitle) pageTitle.textContent = 'Impostazioni Notifiche';
                renderAdminNotifications(contentArea);
                break;
            // ... Add other routes as needed
            default:
                contentArea.innerHTML = '<p style="padding:2rem;">Pagina non trovata o in costruzione.</p>';
        }
    } catch (error) {
        console.error(`[Router] Error rendering page ${state.currentPage}:`, error);
        contentArea.innerHTML = `
            <div style="padding: 2rem; color: red; text-align: center;">
                <h3>Errore di Visualizzazione</h3>
                <p>Si è verificato un errore durante il caricamento della pagina <strong>${state.currentPage}</strong>.</p>
                <div style="background: #fff0f0; padding: 1rem; border-radius: 8px; margin: 1rem 0; text-align: left; overflow: auto;">
                    <code>${error.toString()}</code>
                </div>
                <button onclick="window.location.reload()" class="primary-btn">Ricarica Pagina</button>
            </div>
        `;
    }
}

function renderPlaceholder(container, message) {
    container.innerHTML = `
        <div class="animate-fade-in" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary);">
            <span class="material-icons-round" style="font-size: 4rem; opacity: 0.5; margin-bottom: 1rem;">construction</span>
            <h3>${message}</h3>
            <p>Questa sezione sarà disponibile a breve.</p>
        </div>
    `;
}

function updateActiveLink() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.target === state.currentPage) {
            item.classList.add('active');
        }
    });
}
