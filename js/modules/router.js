import { state } from '/js/modules/state.js';
window.addEventListener('unhandledrejection', event => {
    console.error('Unhandled Promise Rejection:', event.reason);
    const contentArea = document.getElementById('content-area');
    if (contentArea) {
        contentArea.innerHTML = `<div style="padding: 2rem; color: red; border: 2px solid red; border-radius: 8px; background: #fff0f0;">
            <h3 style="margin-top:0;">ERRORE FATALE (Asincrono)</h3>
            <p>${event.reason?.message || event.reason || 'Errore sconosciuto'}</p>
            <pre style="font-size: 0.7rem; overflow: auto; max-height: 200px;">${event.reason?.stack || ''}</pre>
        </div>`;
    }
});
// Feature modules are now loaded dynamically in the router to improve performance
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
    const parts = hash.split('/').map(p => decodeURIComponent(p));
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
            userTags = (Array.isArray(tags) ? tags : []).map(t => t.toLowerCase());
        }
    } else {
        // Use real user tags
        const tags = state.profile?.tags;
        userTags = (Array.isArray(tags) ? tags : []).map(t => t.toLowerCase());
    }

    const isPrivilegedCollaborator = userTags.some(t => t === 'partner' || t === 'amministrazione');
    const isAccount = userTags.includes('account');
    const isProjectManager = userTags.includes('project manager');

    // List of pages allowed for Collaborators (standard - no special tags)
    const allowedPagesForCollaborator = ['home', 'profile', 'agenda', 'my-assignments', 'booking', 'notifications', 'chat', 'assignment-detail', 'assignments', 'pm', 'leads', 'lead-detail', 'contact-forms'];

    if (isPrivilegedCollaborator || isAccount || isProjectManager) {
        allowedPagesForCollaborator.push('dashboard', 'sap-services', 'sap-service-detail');
    }

    // Specific check for Project Management page access
    const canAccessPM = activeRole === 'admin' || isPrivilegedCollaborator;

    // Don't redirect if we are still fetching profile/auth - wait for it
    if (state.isFetching && activeRole === 'collaborator') {
        console.log("[Router] Still fetching profile, delaying access check...");
        return;
    }

    console.log(`[Router] Routing to: ${state.currentPage}, Role: ${activeRole}, Privileged: ${isPrivilegedCollaborator}`);

    // Allow if Admin OR Privileged OR Page is Allowed
    if (activeRole !== 'admin' && !isPrivilegedCollaborator && !allowedPagesForCollaborator.includes(state.currentPage)) {
        console.warn(`[Router] Access denied for role '${activeRole}' to page '${state.currentPage}'. Redirecting...`);
        // Force redirect to a safe page - Agenda is the default for standard collaborators
        state.currentPage = 'home';
        window.location.hash = 'home';
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
    // Trigger page transition animation
    contentArea.classList.add('page-loading');

    // Default Title Update
    if (pageTitle) {
        pageTitle.classList.remove('solid-title');
        pageTitle.textContent = state.currentPage.charAt(0).toUpperCase() + state.currentPage.slice(1);
    }

    console.log(`[Router] Final state.currentPage before switch: "${state.currentPage}"`);

    const finalizeRender = () => {
        setTimeout(() => contentArea.classList.remove('page-loading'), 150);
    };

    // Small delay to let current page fade out before swapping content
    setTimeout(async () => {
        contentArea.innerHTML = '';
        
        try {
            switch (state.currentPage) {
            case 'home':
                if (pageTitle) pageTitle.textContent = 'Homepage';
                import('../features/homepage.js?v=1003').then(m => m.renderHomepage(contentArea));
                break;
            case 'dashboard':
                if (pageTitle) pageTitle.textContent = 'Commercial Dashboard';
                import('../features/dashboard.js?v=1000').then(m => m.renderDashboard(contentArea));
                break;
            case 'agenda':
                if (pageTitle) pageTitle.textContent = 'Agenda Personale';
                import('../features/personal_agenda.js?v=1000').then(m => m.renderAgenda(contentArea));
                break;
            case 'my-assignments':
                if (pageTitle) pageTitle.textContent = 'I Miei Incarichi';
                import('../features/dashboard/TasksDashboard.js?v=1000').then(m => m.renderMyWork(contentArea));
                break;
            case 'sales': // Clients list
                if (pageTitle) pageTitle.textContent = 'Anagrafica Clienti';
                import('../features/clients.js?v=1000').then(m => m.renderClients(contentArea));
                break;
            case 'client-detail':
                if (pageTitle) pageTitle.textContent = 'Dettaglio Cliente';
                import('../features/clients.js?v=1000').then(m => m.renderClientDetail(contentArea));
                break;
            case 'employees':
                if (pageTitle) pageTitle.textContent = 'Collaboratori';
                import('../features/collaborators.js?v=1000').then(m => m.renderCollaborators(contentArea));
                break;
            case 'collaborator-detail':
                if (pageTitle) pageTitle.textContent = 'Dettaglio Collaboratore';
                import('../features/collaborators.js?v=1000').then(m => m.renderCollaboratorDetail(contentArea));
                break;
            case 'white-label-partners':
                if (pageTitle) pageTitle.textContent = 'Partner White Label';
                import('../features/white_label_partners.js').then(m => {
                    m.initWhiteLabelPartnerModals();
                    m.renderWhiteLabelPartners(contentArea);
                });
                break;
            case 'white-label-partner-detail':
                if (pageTitle) pageTitle.textContent = 'Dettaglio Partner WL';
                import('../features/white_label_partners.js').then(m => m.renderWhiteLabelPartnerDetail(contentArea));
                break;
            case 'contacts':
                if (pageTitle) pageTitle.textContent = 'Anagrafica Referenti';
                import('../features/contacts.js?v=1000').then(m => m.renderContacts(contentArea));
                break;
            case 'invoices': // Active Invoices List
                if (pageTitle) pageTitle.textContent = 'Fatture Attive';
                import('../features/invoices.js?v=1000').then(m => m.renderActiveInvoicesSafe(contentArea));
                break;
            case 'invoices-dashboard':
                if (pageTitle) pageTitle.textContent = 'Dashboard Fatturato';
                import('../features/revenue_dashboard.js?v=1000').then(m => m.renderRevenueDashboard(contentArea));
                break;
            case 'passive-invoices-collab':
                if (pageTitle) pageTitle.textContent = 'Fatture Collaboratori';
                import('../features/invoices.js?v=1000').then(m => m.renderPassiveInvoicesCollab(contentArea));
                break;
            case 'passive-invoices-suppliers':
                if (pageTitle) pageTitle.textContent = 'Fatture Fornitori';
                import('../features/invoices.js?v=1000').then(m => m.renderPassiveInvoicesSuppliers(contentArea));
                break;
            case 'passive-invoices-partners':
                if (pageTitle) pageTitle.textContent = 'Fatture Partner WL';
                import('../features/invoices.js?v=1000').then(m => m.renderPassiveInvoicesPartners(contentArea));
                break;
            case 'bank-transactions':
                if (pageTitle) pageTitle.textContent = 'Registro Movimenti';
                import('../features/bank_transactions.js?v=1000').then(m => m.renderBankTransactions(contentArea).catch(err => console.error('Error rendering bank transactions:', err)));
                break;
            case 'bank-statements':
                if (pageTitle) pageTitle.textContent = 'Estratti Conto';
                import('../features/bank_statements.js?v=1000').then(m => m.renderBankStatements(contentArea));
                break;
            case 'invoices-archive':
                if (pageTitle) pageTitle.textContent = 'Archivio Storico';
                renderPlaceholder(contentArea, 'Archivio Storico');
                break;
            case 'settings':
                if (pageTitle) pageTitle.textContent = 'Impostazioni';
                import('../features/settings.js?v=1000').then(module => {
                    module.renderSettings(contentArea);
                });
                break;
            case 'order-detail':
                if (pageTitle) pageTitle.textContent = 'Dettaglio Ordine';
                import('../features/orders.js?v=1001').then(m => m.renderOrderDetail(contentArea));
                break;
            case 'suppliers':
                state.currentPage = 'suppliers';
                import('../features/suppliers_v2.js?v=1000').then(m => {
                    m.initSupplierModals();
                    m.renderSuppliers(contentArea);
                });
                break;
            case 'services':
                if (pageTitle) pageTitle.textContent = 'Catalogo Servizi';
                import('../features/services.js?v=1000').then(m => m.renderServices(contentArea));
                break;
            case 'sap-services':
                if (pageTitle) pageTitle.textContent = 'Servizi SAP';
                import('../features/sap_services.js').then(m => m.renderSapServices(contentArea));
                break;
            case 'sap-service-detail':
                if (pageTitle) pageTitle.textContent = 'Dettaglio Servizio SAP';
                import('../features/sap_services.js').then(m => m.renderSapServiceDetail(contentArea));
                break;
            case 'leads':
                if (pageTitle) pageTitle.textContent = 'Gestione Leads';
                import('../features/leads.js?v=1001').then(m => m.renderLeads(contentArea));
                break;
            case 'lead-detail':
                if (pageTitle) pageTitle.textContent = 'Dettaglio Lead';
                import('../features/leads.js?v=1001').then(m => m.renderLeadDetail(contentArea));
                break;
            case 'contact-forms':
                if (pageTitle) pageTitle.textContent = 'Moduli Contatto';
                import('../features/contact_forms.js?v=1003').then(m => m.renderContactForms(contentArea));
                break;
            case 'collaborator-services':
                if (pageTitle) pageTitle.textContent = 'Servizi Collaboratori';
                import('../features/collaborator_services.js?v=1000').then(m => m.renderCollaboratorServices(contentArea));
                break;
            case 'assignment-detail':
                if (pageTitle) pageTitle.textContent = 'Dettaglio Incarico';
                import('../features/assignments.js?v=1000').then(m => m.renderAssignmentDetail(contentArea));
                break;
            case 'assignments':
                if (pageTitle) pageTitle.textContent = 'Incarichi';
                import('../features/assignments.js?v=1000').then(m => m.renderAssignmentsDashboard(contentArea));
                break;
            case 'payments':
                if (pageTitle) pageTitle.textContent = 'Dashboard Pagamenti';
                import('../features/payments.js?v=1001').then(m => {
                    m.initPaymentModals();
                    m.renderPaymentsDashboard(contentArea);
                });
                break;
            case 'booking':
                import('../features/booking.js?v=1000').then(m => m.renderBooking(contentArea));
                break;
            case 'profile':
                if (pageTitle) pageTitle.textContent = 'Il Mio Profilo';
                import('../features/user_dashboard.js?v=1000').then(m => m.renderUserProfile(contentArea));
                break;
            case 'notifications':
                if (pageTitle) pageTitle.textContent = 'Centro Notifiche';
                import('../features/notifications.js?v=1000').then(m => m.renderNotificationCenter(contentArea));
                break;
            case 'admin':
                if (pageTitle) pageTitle.textContent = 'Amministrazione';
                import('../features/admin/admin-dashboard.js?v=1000').then(module => {
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

                // Route: Commessa Detail (#pm/commessa/:orderId)
                if (state.currentSubPage === 'commessa' && state.currentId) {
                    if (pageTitle) pageTitle.textContent = 'Dettaglio Commessa';
                    import('../features/pm/commessa_detail.js?v=1243')
                        .then(async module => {
                            try {
                                await module.renderCommessaDetail(contentArea, state.currentId, false);
                            } catch (renderErr) {
                                console.error("Error rendering commessa detail:", renderErr);
                                contentArea.innerHTML = `<div class="error-state" style="padding: 2rem; color: red;">Errore caricamento dettagli: ${renderErr.message}</div>`;
                            }
                        })
                        .catch(err => {
                            console.error("Failed to load commessa detail module:", err);
                            contentArea.innerHTML = `<div class="error-state" style="padding: 2rem; color: red;">Errore modulo: ${err.message}</div>`;
                        });

                    // Route: Internal Project Detail (#pm/space/:spaceId)
                } else if (state.currentSubPage === 'space' && state.currentId) {
                    if (pageTitle) pageTitle.textContent = 'Workspace';
                    import('../features/pm/commessa_detail.js?v=1243')
                        .then(async module => {
                            try {
                                await module.renderCommessaDetail(contentArea, state.currentId, true);
                            } catch (err) {
                                console.error("Failed to render project detail:", err);
                                contentArea.innerHTML = `<div class="error-state">Errore caricamento: ${err.message}</div>`;
                            }
                        })
                        .catch(err => {
                            console.error("Failed to load project detail:", err);
                            contentArea.innerHTML = `<div class="error-state">Errore caricamento: ${err.message}</div>`;
                        });

                    // Route: Internal Projects List (#pm/interni)
                } else if (state.currentSubPage === 'interni') {
                    if (pageTitle) pageTitle.textContent = 'Progetti Interni';
                    import('../features/pm/internal_list.js?v=1243')
                        .then(module => {
                            module.renderInternalProjects(contentArea, state.currentId);
                        })
                        .catch(err => {
                            console.error("Failed to load internal projects:", err);
                            contentArea.innerHTML = `<div class="error-state">Errore caricamento: ${err.message}</div>`;
                        });

                } else if (state.currentSubPage === 'task' && state.currentId) {
                    if (pageTitle) pageTitle.textContent = 'Dettaglio Attività';
                    import('../features/pm/components/hub_drawer.js?v=1243').then(m => {
                        m.openHubDrawer(state.currentId, null);
                    });
                    // Show dashboard in background
                    import('../features/pm/index.js?v=1243').then(module => {
                        module.renderPM(contentArea);
                    });;
                } else if (state.currentSubPage === 'my-work') {
                    if (pageTitle) pageTitle.textContent = 'Le Mie Attività';
                    import('../features/dashboard/TasksDashboard.js?v=1000').then(m => m.renderMyWork(contentArea));

                } else {
                    // Standard PM views (Dashboard)
                    import('../features/pm/index.js?v=1241')
                        .then(module => {
                            module.renderPM(contentArea);
                        })
                        .catch(err => {
                            console.error("Failed to load PM module:", err);
                            contentArea.innerHTML = `<div class="error-state">Errore caricamento modulo PM: ${err.message}</div>`;
                        });
                }
                break;
            case 'agenda':
                if (pageTitle) pageTitle.textContent = 'La Mia Agenda';
                import('../features/personal_agenda.js?v=1000').then(m => m.renderAgenda(contentArea));
                break;
            case 'admin-notifications':
                if (pageTitle) pageTitle.textContent = 'Notifiche Admin';
                import('../features/admin_notifications.js?v=1000').then(m => m.renderAdminNotifications(contentArea));
                break;
            // ... Add other routes as needed
            default:
                console.log(`[Router] Hit default case for page: "${state.currentPage}"`);
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
    } finally {
        finalizeRender();
    }
    }, 50);
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
