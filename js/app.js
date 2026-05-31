import { initAuth } from './features/auth.js?v=8000';
import { router } from './modules/router.js?v=8003';
import { state } from '/js/modules/state.js?v=8000';
import { initLayout, renderSidebarProfile } from './features/layout.js?v=8000';
import { initNotifications } from './features/notifications.js?v=8000';
// Chat UI is loaded lazily when user navigates to #chat
import { runOneTimeFix } from './fix_phantom_data.js?v=8000';
// Utilities imported at top
import { debounce } from './modules/utils.js?v=8000';
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
    initThemeLogic();

    // Init Feature Modals Lazily — catch prevents unhandledrejection from crashing the homepage
    import('./features/settings.js?v=8000').then(m => m.initSettingsModals()).catch(e => console.warn('[app] settings modals:', e));
    import('./features/invoices.js?v=9004').then(m => m.InvoiceLogic.initInvoiceModals()).catch(e => console.warn('[app] invoices modals:', e));
    import('./features/collaborators.js?v=9000').then(m => m.initCollaboratorModals()).catch(e => console.warn('[app] collaborators modals:', e));
    import('./features/collaborator_services.js?v=8000').then(m => m.initCollaboratorServiceModals()).catch(e => console.warn('[app] collaborator_services modals:', e));
    import('./features/bank_transactions.js?v=8000').then(m => m.initBankTransactionModals()).catch(e => console.warn('[app] bank_transactions modals:', e));
    import('./features/payments.js?v=9005').then(m => m.initPaymentModals()).catch(e => console.warn('[app] payments modals:', e));
    import('./features/services.js?v=8000').then(m => m.initServiceModals()).catch(e => console.warn('[app] services modals:', e));
    import('./features/white_label_partners.js?v=8000').then(m => m.initWhiteLabelPartnerModals()).catch(e => console.warn('[app] wl_partners modals:', e));
    import('./features/sap_services.js?v=8000').then(m => m.initSapServiceModals()).catch(e => console.warn('[app] sap_services modals:', e));

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

        // Unhide app early so router can find elements
        const app = document.getElementById('app');
        if (app) app.classList.remove('hidden');

        // Render page first
        router();
        
        // Hide Splash Screen after a delay to ensure first data fetch is underway
        const splash = document.getElementById('app-splash-screen');
        if (splash) {
            setTimeout(() => {
                splash.classList.add('app-hidden');
                setTimeout(() => splash.remove(), 600);
            }, 700); // Increased from 100 to 700ms for smoother transition
        }

        renderSidebarProfile();
        initNotifications();  // Initialize notifications after auth

        // Render sidebar pinned items (sotto profilo / sopra menu principale)
        import('./features/homepage_pinned.js?v=8000')
            .then(mod => mod.renderSidebarPinned())
            .catch(err => console.warn('[sidebar-pinned]', err));

        // Quick-capture FAB (bottone "+" galleggiante)
        import('./features/quick_capture.js?v=8000')
            .then(mod => mod.mountQuickCaptureFab())
            .catch(err => console.warn('[quick-capture]', err));
        // Chat initializes lazily when user navigates to #chat
        // router(); // REMOVED - already called above
        // setTimeout(() => runOneTimeFix(), 1000);
    });

    // Refresh UI when data is loaded
    window.addEventListener('data:loaded', () => {
        router();
    });

    // Handle hash change
    window.addEventListener('hashchange', router);

    // Global Search Listener - Moved inside DOMContentLoaded
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        const debouncedRouter = debounce(() => {
            router();
        }, 500);

        searchInput.addEventListener('input', (e) => {
            state.searchTerm = e.target.value;
            debouncedRouter();
        });
    } else {
        console.error("Global search input element not found during init!");
    }
});

// Global HubDrawer Opener Helper
window.openPmItemDetails = function (itemId, spaceId) {
    import('./features/pm/components/hub_drawer.js?v=8026').then(mod => {
        mod.openHubDrawer(itemId, spaceId);
    });
};
