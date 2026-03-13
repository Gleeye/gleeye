import { initAuth } from './features/auth.js?v=3000';
import { router } from './modules/router.js?v=3000';
import { state } from '/js/modules/state.js';
import { initLayout, renderSidebarProfile } from './features/layout.js?v=3000';
import { initNotifications } from './features/notifications.js?v=3000';
// Chat UI is loaded lazily when user navigates to #chat
import { runOneTimeFix } from './fix_phantom_data.js?v=3000';
// Utilities imported at top
import { debounce } from './modules/utils.js';
import './utils/modal-utils.js';

// Suppress benign ResizeObserver error
const resizeObserverLoopErr = 'ResizeObserver loop completed with undelivered notifications.';
window.addEventListener('error', (e) => {
    if (e.message === resizeObserverLoopErr) {
        e.stopImmediatePropagation();
        return;
    }
});

function initThemeLogic() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Theme toggle can be in sidebar now
    const themeBtn = document.getElementById('theme-toggle');
    const updateThemeIcon = (theme) => {
        const icon = themeBtn?.querySelector('span');
        if (icon) {
            icon.textContent = theme === 'light' ? 'dark_mode' : 'light_mode';
        }
    };

    updateThemeIcon(savedTheme);

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            updateThemeIcon(next);
        });
    }
}

// Bootstrapper
document.addEventListener('DOMContentLoaded', () => {
    console.log('Gleeye Workspace v291 Booting...');
    initThemeLogic();

    // Init Feature Modals
    // Init Feature Modals Lazily
    import('./features/settings.js?v=3000').then(m => m.initSettingsModals());
    import('./features/invoices.js?v=3000').then(m => m.InvoiceLogic.initInvoiceModals());
    import('./features/collaborators.js?v=3000').then(m => m.initCollaboratorModals());
    import('./features/collaborator_services.js?v=3000').then(m => m.initCollaboratorServiceModals());
    import('./features/bank_transactions.js?v=3000').then(m => m.initBankTransactionModals());
    import('./features/payments.js?v=3000').then(m => m.initPaymentModals());
    import('./features/services.js?v=3000').then(m => m.initServiceModals());
    import('./features/white_label_partners.js?v=3000').then(m => m.initWhiteLabelPartnerModals());
    import('./features/sap_services.js?v=3000').then(m => m.initSapServiceModals());

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

        // Unhide app early so router can find elements
        const app = document.getElementById('app');
        if (app) app.classList.remove('hidden');

        // Render page first
        router();
        
        // Hide Splash Screen after a tiny delay to ensure first paint
        const splash = document.getElementById('app-splash-screen');
        if (splash) {
            setTimeout(() => {
                splash.classList.add('app-hidden');
                setTimeout(() => splash.remove(), 600);
            }, 100);
        }

        renderSidebarProfile();
        initNotifications();  // Initialize notifications after auth
        // Chat initializes lazily when user navigates to #chat
        // router(); // REMOVED - already called above
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
        const debouncedRouter = debounce(() => {
            console.log('Debounced router trigger for search:', state.searchTerm);
            router();
        }, 500);

        console.log("Attaching global search listener");
        searchInput.addEventListener('input', (e) => {
            console.log('Global search input:', e.target.value);
            state.searchTerm = e.target.value;
            debouncedRouter();
        });
    } else {
        console.error("Global search input element not found during init!");
    }
});

// Global HubDrawer Opener Helper
window.openPmItemDetails = function (itemId, spaceId) {
    import('./features/pm/components/hub_drawer.js?v=5005').then(mod => {
        mod.openHubDrawer(itemId, spaceId);
    });
};
