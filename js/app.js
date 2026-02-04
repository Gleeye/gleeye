import './utils/modal-utils.js?v=156';
import { initAuth } from './features/auth.js?v=156';
import { router } from './modules/router.js?v=156';
import { InvoiceLogic } from './features/invoices.js?v=156';
import { state } from './modules/state.js?v=156';
import { initSettingsModals } from './features/settings.js?v=156';
import { initCollaboratorModals } from './features/collaborators.js?v=156';
import { initCollaboratorServiceModals } from './features/collaborator_services.js?v=156';
import { initBankTransactionModals } from './features/bank_transactions.js?v=156';
import { initPaymentModals } from './features/payments.js?v=156';
import { initServiceModals } from './features/services.js?v=156';
import { initLayout, renderSidebarProfile } from './features/layout.js?v=156';
import { initNotifications } from './features/notifications.js?v=156';
// Chat UI is loaded lazily when user navigates to #chat
import { runOneTimeFix } from './fix_phantom_data.js?v=156';
// Utilities imported at top

// Suppress benign ResizeObserver error
const resizeObserverLoopErr = 'ResizeObserver loop completed with undelivered notifications.';
window.addEventListener('error', (e) => {
    if (e.message === resizeObserverLoopErr) {
        e.stopImmediatePropagation();
        return;
    }
});

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
    console.log('Gleeye Workspace v289 Initializing...');
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

    // Admin Settings Button Listener
    const adminBtn = document.getElementById('admin-settings-btn');
    if (adminBtn) {
        adminBtn.addEventListener('click', () => {
            window.location.hash = 'admin';
        });
    }

    // Start Auth & Routing
    initAuth();



    // Listen for app ready to start router and render user data
    window.addEventListener('app:ready', () => {
        console.log("App ready event received. Rendering profile and router.");
        renderSidebarProfile();
        initNotifications();  // Initialize notifications after auth
        // Chat initializes lazily when user navigates to #chat
        router();
        // setTimeout(() => runOneTimeFix(), 1000);
    });

    // Refresh UI when data is loaded
    window.addEventListener('data:loaded', () => {
        console.log("Data loaded event received. Refreshing UI.");
        router();
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
