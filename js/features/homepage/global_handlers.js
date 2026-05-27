// Window-bound global handlers wired by the homepage on load.
// Importing this module installs the handlers as side effects (assignments to
// window.*). HTML inline `onclick=` and other legacy callers depend on them.
//
// Side effects on import:
//   - window.openHomepageEventDetails        (re-assigned twice on purpose: first as
//     a compatibility alias to openEventDetails from agenda_utils, then overridden
//     by the appointment-aware version below)
//   - window.closeHomepageEventModal
//   - window.setHpFilter
//   - window.openPmItemDetails

import { openEventDetails } from '../agenda_utils.js?v=8000';
import { renderMyActivities } from './activity_feed.js?v=8000';
import { openHubDrawer } from '../pm/components/hub_drawer.js?v=8026';
import { openAppointmentDrawer } from '../pm/components/hub_appointment_drawer.js?v=8000';


// openEventDetails is imported at the top of this file; alias it on window
// so legacy HTML inline onclick handlers can find it.
window.openHomepageEventDetails = openEventDetails; // Compatibility Alias

window.closeHomepageEventModal = function (id) {
    const el = document.getElementById(id);
    if (el) el.remove();
};

// Helper for Filter Switching
window.setHpFilter = function (filter, btn) {
    if (!btn) return;
    window.hpActivityFilter = filter;

    // Update UI buttons
    const container = btn.closest('.hp-v6-controls');
    if (container) {
        container.querySelectorAll('.hp-v6-pill').forEach(b => b.classList.remove('active'));
    }
    btn.classList.add('active');

    // Update Footer Button and Filter visibility based on tab
    const footerBtn = document.getElementById('hp-footer-action-btn');
    const overdueFilter = document.getElementById('hp-overdue-filter');

    if (footerBtn) {
        if (filter === 'task') {
            footerBtn.innerText = 'Lista task';
            footerBtn.onclick = () => window.location.hash = '#tasks-summary';
            if (overdueFilter) overdueFilter.style.display = 'flex';
        } else if (filter === 'event') {
            footerBtn.innerText = 'Vedi Agenda';
            footerBtn.onclick = () => window.location.hash = '#agenda';
            if (overdueFilter) overdueFilter.style.display = 'none';
        } else {
            footerBtn.innerText = 'Vedi Attività';
            footerBtn.onclick = () => window.location.hash = '#assignments';
            if (overdueFilter) overdueFilter.style.display = 'none';
        }
    }

    // Re-render using the FILTERED tasks (date-filtered), not the full list
    if (window.hpData) {
        const tasksToUse = window.hpData.filteredTasks || window.hpData.tasks;
        renderMyActivities(document.getElementById('hp-activities-list'), window.hpData.timers, tasksToUse, window.hpData.events, filter);
    }
};

// Activity-feed widgets extracted to ./homepage/activity_feed.js (fase split-monstro step 1)

window.openPmItemDetails = function (itemId, spaceId) {
    if (!itemId) return;
    // openHubDrawer is already imported at the top of the module
    openHubDrawer(itemId, spaceId === 'null' ? null : spaceId);
};

window.openHomepageEventDetails = function (evtId, type) {
    if (type === 'appointment') {
        // Find event data from global cache
        const evt = window.hpData?.events?.find(e => e.id == evtId);
        let refId = null;
        let refType = 'order'; // default

        if (evt && evt.orders) {
            refId = evt.orders.id;
        }

        // openAppointmentDrawer is already imported at the top
        openAppointmentDrawer(evtId, refId, refType);
    } else {
        // Fallback for non-appointment events
        window.location.hash = 'agenda';
    }
};
