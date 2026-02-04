import { state } from './state.js?v=156';
import { renderDashboard } from '../features/dashboard.js?v=156';
import { renderClients, renderClientDetail } from '../features/clients.js?v=156';
import { renderCollaborators, renderCollaboratorDetail } from '../features/collaborators.js?v=156';
import { renderContacts } from '../features/contacts.js?v=156';
import { renderOrderDetail } from '../features/orders.js?v=156';
import { renderActiveInvoicesSafe, renderPassiveInvoicesCollab, renderPassiveInvoicesSuppliers } from '../features/invoices.js?v=156';
import { renderRevenueDashboard } from '../features/revenue_dashboard.js?v=156';
import { renderBankTransactions } from '../features/bank_transactions.js?v=156';
import { renderSuppliers, initSupplierModals } from '../features/suppliers_v2.js?v=156';
import { renderBankStatements } from '../features/bank_statements.js?v=156';
import { renderServices } from '../features/services.js?v=156';
import { renderCollaboratorServices } from '../features/collaborator_services.js?v=156';
import { renderAssignmentDetail, renderAssignmentsDashboard } from '../features/assignments.js?v=156';
import { renderPaymentsDashboard, initPaymentModals } from '../features/payments.js?v=156';
import { renderBooking } from '../features/booking.js?v=156';
import { renderUserProfile } from '../features/user_dashboard.js?v=156';
import { renderAgenda } from '../features/personal_agenda.js?v=287';
import { renderHomepage } from '../features/homepage.js?v=1';
import { renderNotificationCenter } from '../features/notifications.js?v=156';
import { renderAdminNotifications } from '../features/admin_notifications.js?v=156';
// Chat is loaded dynamically to avoid slowing down app startup

export function router() {
    // Try to restore saved route on initial load (no hash but has saved route)
    const savedRoute = sessionStorage.getItem('gleeye_current_route');
    let hash = window.location.hash.slice(1);

    // If no hash but we have a saved route, restore it (unless it's chat)
    if (!hash && savedRoute && savedRoute !== 'chat') {
        console.log(`[Router] Restoring saved route: ${savedRoute}`);
        hash = savedRoute;
        window.location.hash = savedRoute;
        return; // The hash change will re-trigger router
    }

    // Default to home if no hash
    hash = hash || 'home';
    const parts = hash.split('/');
    const page = parts[0];
    const subPage = parts[1];
    const id = parts[2] || parts[1]; // Fallback for 2-level routes like 'order-detail/123' where subPage IS the id

    console.log(`Router handling hash: #${hash} -> page: ${page}, sub: ${subPage}, id: ${id}`);

    state.currentPage = page;
    state.currentSubPage = subPage;
    state.currentId = id || null;

    // --- ACCESS CONTROL / IMPERSONATION ---
    const activeRole = state.impersonatedRole || state.profile?.role || 'collaborator';

    // Parse Tags for Privileged Access (Partner / Amministrazione)
    let userTags = [];
    if (state.impersonatedRole === 'collaborator' && state.impersonatedCollaboratorId) {
        // Use impersonated user tags
        const c = state.collaborators?.find(x => x.id == state.impersonatedCollaboratorId);
        if (c) {
            let tags = c.tags;
            if (typeof tags === 'string') {
                try { tags = JSON.parse(tags); } catch (e) { tags = tags.split(',').map(t => t.trim()); }
            }
            userTags = Array.isArray(tags) ? tags : [];
        }
    } else {
        // Use real user tags
        let tags = state.profile?.tags;
        if (typeof tags === 'string') {
            try { tags = JSON.parse(tags); } catch (e) { tags = tags.split(',').map(t => t.trim()); }
        }
        userTags = Array.isArray(tags) ? tags : [];
    }

    const isPrivilegedCollaborator = userTags.includes('Partner') || userTags.includes('Amministrazione') || userTags.includes('Project Manager') || userTags.includes('Account');

    // List of pages allowed for Collaborators (standard - no special tags)
    const allowedPagesForCollaborator = ['home', 'profile', 'agenda', 'my-assignments', 'booking'];

    // Specific check for Project Management page access
    const canAccessPM = activeRole === 'admin' || isPrivilegedCollaborator;

    // Don't redirect if we are still fetching profile/auth - wait for it
    if (state.isFetching && activeRole === 'collaborator') {
        console.log("[Router] Still fetching profile, delaying access check...");
        return;
    }

    console.log(`[Router] Routing to: ${state.currentPage}, Role: ${activeRole}, Privileged: ${isPrivilegedCollaborator}`);

    // Allow if Admin OR Privileged OR Page is Allowed
    if (state.currentPage === 'pm') {
        if (!canAccessPM) {
            console.warn(`[Router] Access denied to PM for standard collaborator. Redirecting to home.`);
            state.currentPage = 'home';
            window.location.hash = 'home';
            return;
        }
    } else if (activeRole !== 'admin' && !isPrivilegedCollaborator && !allowedPagesForCollaborator.includes(state.currentPage)) {
        console.warn(`[Router] Access denied for role '${activeRole}' to page '${state.currentPage}'. Redirecting...`);
        // Force redirect to a safe page - Agenda is the default for standard collaborators
        state.currentPage = 'agenda';
        window.location.hash = 'agenda';
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
            case 'home':
                if (pageTitle) pageTitle.textContent = 'Home';
                renderHomepage(contentArea);
                break;
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
                renderActiveInvoicesSafe(contentArea);
                break;
            case 'invoices-dashboard':
                if (pageTitle) pageTitle.textContent = 'Dashboard Fatturato';
                renderRevenueDashboard(contentArea);
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
                renderBankTransactions(contentArea).catch(err => console.error('Error rendering bank transactions:', err));
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
                import('../features/settings.js?v=156').then(module => {
                    module.renderSettings(contentArea);
                });
                break;
            case 'order-detail':
                if (pageTitle) pageTitle.textContent = 'Dettaglio Ordine';
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
            case 'admin':
                if (pageTitle) pageTitle.textContent = 'Amministrazione';
                import('../features/admin/admin-dashboard.js?v=156').then(module => {
                    module.renderAdminDashboard(contentArea);
                });
                break;
            case 'chat':
                if (pageTitle) pageTitle.textContent = 'Chat Team';
                contentArea.innerHTML = '<div class="loading-state"><span class="loader"></span></div>';
                import('../features/chat/chat-ui.js').then(module => {
                    module.renderChat(contentArea);
                });
                break;
            case 'pm':
                if (pageTitle) pageTitle.textContent = 'Project Management';
                // Check if it's commessa detail route: #pm/commessa/:orderId
                if (state.currentSubPage === 'commessa' && state.currentId) {
                    if (pageTitle) pageTitle.textContent = 'Dettaglio Commessa';
                    import('../features/pm/commessa_detail.js?v=156')
                        .then(module => {
                            module.renderCommessaDetail(contentArea, state.currentId);
                        })
                        .catch(err => {
                            console.error("Failed to load commessa detail:", err);
                            contentArea.innerHTML = `<div class="error-state">Errore caricamento: ${err.message}</div>`;
                        });
                } else {
                    // Standard PM views
                    import('../features/pm/index.js?v=156')
                        .then(module => {
                            module.renderPM(contentArea);
                        })
                        .catch(err => {
                            console.error("Failed to load PM module:", err);
                            contentArea.innerHTML = `<div class="error-state">Errore caricamento modulo PM: ${err.message}</div>`;
                        });
                }
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

        let target = item.dataset.target;

        // Special match for PM module sub-pages
        if (state.currentPage === 'pm') {
            if (target === `pm-${state.currentSubPage}`) {
                item.classList.add('active');
            }
        } else {
            // Normal exact match
            if (target === state.currentPage) {
                item.classList.add('active');
            }
        }
    });

    // Also handle drill-down sub-items: check if parent should be active?
    // Not strictly needed if sub-items are correctly targeted.
}
