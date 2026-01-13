import { state } from './state.js?v=115';
import { renderDashboard } from '../features/dashboard.js?v=115';
import { renderClients, renderClientDetail } from '../features/clients.js?v=115';
import { renderCollaborators, renderCollaboratorDetail } from '../features/collaborators.js?v=115';
import { renderContacts } from '../features/contacts.js?v=115';
import { renderOrderDetail } from '../features/orders.js?v=115';
import { renderInvoices, renderPassiveInvoicesCollab, renderPassiveInvoicesSuppliers } from '../features/invoices.js?v=115';
import { renderInvoicesDashboard } from '../features/dashboard.js?v=115';
import { renderBankTransactions } from '../features/bank_transactions.js?v=115';
import { renderSuppliers, initSupplierModals } from '../features/suppliers_v2.js?v=115';
import { renderBankStatements } from '../features/bank_statements.js?v=115';
import { renderServices } from '../features/services.js?v=115';
import { renderCollaboratorServices } from '../features/collaborator_services.js?v=115';
import { renderAssignmentDetail, renderAssignmentsDashboard } from '../features/assignments.js?v=115';
import { renderPaymentsDashboard, initPaymentModals } from '../features/payments.js?v=115';
import { renderBooking } from '../features/booking.js?v=115';
import { renderUserProfile } from '../features/user_dashboard.js?v=115';

export function router() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    const [page, id] = hash.split('/');
    console.log(`Router handling hash: #${hash} -> page: ${page}, id: ${id}`);

    state.currentPage = page;
    state.currentId = id || null;

    // --- ACCESS CONTROL / IMPERSONATION ---
    const activeRole = state.impersonatedRole || state.profile?.role || 'collaborator';

    // List of pages allowed for Collaborators
    const allowedPagesForCollaborator = ['booking', 'profile'];

    if (activeRole !== 'admin' && !allowedPagesForCollaborator.includes(state.currentPage)) {
        console.warn(`[Router] Access denied for role '${activeRole}' to page '${state.currentPage}'. Redirecting...`);
        // Force redirect to a safe page
        state.currentPage = 'booking';
        window.location.hash = 'booking';
        return; // Stop here, the hash change will trigger router again
    }

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

    switch (state.currentPage) {
        case 'dashboard':
            if (pageTitle) pageTitle.textContent = 'Ordini';
            renderDashboard(contentArea);
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
        // ... Add other routes as needed
        default:
            contentArea.innerHTML = '<p style="padding:2rem;">Pagina non trovata o in costruzione.</p>';
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
