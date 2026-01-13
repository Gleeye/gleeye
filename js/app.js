import './utils/modal-utils.js?v=115';
import { initAuth } from './features/auth.js?v=115';
import { router } from './modules/router.js?v=115';
import { InvoiceLogic } from './features/invoices.js?v=115';
import { state } from './modules/state.js?v=115';
import { initSettingsModals } from './features/settings.js?v=115';
import { initCollaboratorModals } from './features/collaborators.js?v=115';
import { initCollaboratorServiceModals } from './features/collaborator_services.js?v=115';
import { initBankTransactionModals } from './features/bank_transactions.js?v=115';
import { initPaymentModals } from './features/payments.js?v=115';
import { initServiceModals } from './features/services.js?v=115';
import { initLayout, renderSidebarProfile } from './features/layout.js?v=115';
import { initNotifications } from './features/notifications.js?v=115';
import { runOneTimeFix } from './fix_phantom_data.js?v=115';
// Utilities imported at top

// Init Theme
function initThemeLogic() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const icon = document.querySelector('#theme-toggle span');
    if (icon) {
        icon.textContent = savedTheme === 'light' ? 'dark_mode' : 'light_mode';
    }
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            if (icon) icon.textContent = next === 'light' ? 'dark_mode' : 'light_mode';
        });
    }
}

// Bootstrapper
document.addEventListener('DOMContentLoaded', () => {
    initThemeLogic();

    // Init Feature Modals
    initSettingsModals();
    InvoiceLogic.initInvoiceModals();
    initCollaboratorModals();
    initCollaboratorServiceModals();
    initBankTransactionModals();
    initPaymentModals(); // Init
    initServiceModals();

    // Init Layout (Sidebar toggles) - run immediately since UI is visible
    initLayout();

    // Start Auth & Routing
    initAuth();



    // Listen for app ready to start router and render user data
    window.addEventListener('app:ready', () => {
        console.log("App ready event received. Rendering profile and router.");
        renderSidebarProfile();
        initNotifications();  // Initialize notifications after auth
        router();
        // setTimeout(() => runOneTimeFix(), 1000);
    });

    // Handle hash change
    window.addEventListener('hashchange', router);

    // Global Search Listener - Moved inside DOMContentLoaded
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        console.log("Attaching global search listener");
        searchInput.addEventListener('input', (e) => {
            console.log('Global search input:', e.target.value);
            state.searchTerm = e.target.value;
            router();
        });
    } else {
        console.error("Global search input element not found during init!");
    }
});
