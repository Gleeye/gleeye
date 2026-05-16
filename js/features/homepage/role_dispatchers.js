// Homepage role dispatchers and shared rendering helpers.
// Extracted from homepage-alt.js (Fase split-monstro step 3).
//
// Public exports:
//   - renderAdminAlerts(alerts)
//   - renderInternalDashboard(hubs, clusters)
//   - initClusterSortable(container, clusters)
//   - renderMainContent(container, role, data)
//   - renderMainContent_Partner / Amministrazione / Account / PM / Collaboratore
//   - setupHomepageFeed(data)
//   - renderAssignments(pmList, assignments, clusters?, events?)
//   - renderProjects(pmList, pmProjects)
//
// External deps:
//   - state, supabase, formatAmount, renderAvatar
//   - data_fetchers: fetchAdminOperationalAlerts, fetchCollaboratorAssignments,
//     fetchInternalHubsAndClusters, fetchInternalProjects, fetchRecentProjects
//   - activity_feed: renderActivityFeed, renderBottomTasks
//   - pm_api: fetchPMActivityLogs, fetchSmartPersonalFeed

import { state } from '/js/modules/state.js?v=8000';
import { supabase } from '../../modules/config.js?v=8000';
import { formatAmount, renderAvatar } from '../../modules/utils.js?v=8000';
import { fetchPMActivityLogs, fetchSmartPersonalFeed } from '../../modules/pm_api.js?v=8000';

import {
    fetchAdminOperationalAlerts,
    fetchCollaboratorAssignments,
    fetchInternalHubsAndClusters,
    fetchInternalProjects,
    fetchRecentProjects,
} from './data_fetchers.js?v=8000';

import {
    renderActivityFeed,
    renderBottomTasks,
} from './activity_feed.js?v=8000';

import { renderAlertsWidget } from './alerts_widget.js?v=8010';
import { renderMorningBriefing } from './morning_briefing.js?v=8001';

export function renderAdminAlerts(alerts) {
    const block = document.getElementById('hp-accounting-alerts-block');
    const grid = document.getElementById('hp-admin-alert-list');
    if (!block || !grid) return;

    // Safety check: skip if user is ONLY account/pm (without higher tier roles)
    const tags = window.normalizedTagsForHtml || [];
    const isTrueAdmin = tags.includes('partner') || tags.includes('amministrazione') || tags.includes('socio') || state.profile?.role === 'admin';
    const isAccountOrPM = tags.includes('account') || tags.includes('project manager') || tags.includes('pm');
    
    if (isAccountOrPM && !isTrueAdmin) {
        block.style.display = 'none';
        return;
    }

    if (alerts.length === 0) {
        grid.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; padding: 10px 0; color: #166534; opacity: 0.7;">
                <span class="material-icons-round" style="font-size: 16px;">check_circle</span>
                <span style="font-size: 0.8rem; font-weight: 500;">Tutto in ordine</span>
            </div>
        `;
    } else {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        const sorted = [...alerts].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        grid.innerHTML = sorted.map(alert => `
            <div class="hp-alert-item" onclick="window.location.hash='${alert.link}'" style="
                display: flex; align-items: center; gap: 12px;
                padding: 10px 0; cursor: pointer;
                border-bottom: 1px solid rgba(0, 0, 0, 0.03);
                transition: all 0.2s;">
                <span style="font-size: 1.05rem; font-weight: 800; color: #1e293b; min-width: 24px; line-height: 1; text-align: center;">${alert.count}</span>
                <span style="font-size: 0.75rem; font-weight: 500; color: #475569; flex: 1; line-height: 1.2;">${alert.label}</span>
                <span class="material-icons-round" style="color: #94a3b8; font-size: 16px;">chevron_right</span>
            </div>
        `).join('');
    }

    if (alerts.length > 0) {
        block.style.background = 'linear-gradient(135deg, rgba(255, 241, 242, 0.8), rgba(255, 255, 255, 0.9))';
        block.style.border = '1px solid rgba(251, 113, 133, 0.15)';
        block.style.boxShadow = '0 10px 25px -5px rgba(251, 113, 133, 0.08), 0 8px 10px -6px rgba(251, 113, 133, 0.04)';
    } else {
        block.style.background = 'white';
        block.style.border = '1px solid #f1f5f9';
        block.style.boxShadow = '0 4px 15px rgba(0,0,0,0.03)';
    }

    block.style.display = 'flex';
}

export function renderInternalDashboard(hubs, clusters) {
    const hubContainer = document.getElementById('hp-internal-hubs-buttons');
    const clusterContainer = document.getElementById('hp-internal-clusters-grid');
    if (!hubContainer || !clusterContainer) return;

    if (hubs.length === 0 && clusters.length === 0) {
        clusterContainer.innerHTML = `<div style="padding: 1rem; color: #94a3b8; font-size: 0.8rem; font-family: 'Outfit', sans-serif; font-style: italic;">In attesa di Hub e Cluster...</div>`;
        return;
    }

    // --- CLUSTERS ABOVE ---
    if (clusters.length === 0) {
        clusterContainer.innerHTML = `<div style="grid-column: 1 / -1; padding: 2rem; text-align: center; color: #94a3b8; font-size: 0.75rem; font-family: 'Outfit', sans-serif;">Nessun cluster trovato.</div>`;
    } else {
        clusterContainer.innerHTML = clusters.map((c, i) => {
            const color = c.color || c.areaInfo?.color || '#cbd5e1';
            return `
                <div draggable="true" 
                    data-id="${c.id}"
                    data-index="${i}"
                    onclick="window.location.hash='#pm/space/${c.id}'" 
                    class="hp-cluster-card"
                    style="
                        display: flex; flex-direction: column; align-items: center; gap: 6px; 
                        cursor: grab; transition: all 0.2s; padding: 8px; border-radius: 16px;
                    " onmouseover="this.querySelector('.cluster-icon-box').style.transform='scale(1.1)';" onmouseout="this.querySelector('.cluster-icon-box').style.transform='none';">
                    <div class="cluster-icon-box" style="
                        width: 48px; height: 48px; border-radius: 14px; background: white; 
                        display: flex; align-items: center; justify-content: center; 
                        box-shadow: 0 4px 12px ${color}12; border: 1px solid rgba(0,0,0,0.03);
                        transition: all 0.2s; pointer-events: none; position: relative;
                    ">
                        <span class="material-icons-round" style="font-size: 24px; color: ${color};">${c.clusterIcon}</span>
                        <!-- Area Badge Inside Icon Box -->
                        ${c.areaInfo ? `
                            <div style="
                                position: absolute; bottom: -4px; right: -4px; 
                                width: 22px; height: 22px; border-radius: 8px; 
                                background: white; border: 2px solid white;
                                box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                                display: flex; align-items: center; justify-content: center;
                            ">
                                <span class="material-icons-round" style="font-size: 12px; color: ${color};">${c.areaInfo.icon}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div style="text-align: center; pointer-events: none;">
                        <div style="font-family: 'Outfit', sans-serif; font-size: 0.78rem; font-weight: 600; color: #1e293b; line-height: 1.1; max-width: 100px; word-wrap: break-word;">${c.name}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Attach Sortable Logic
        initClusterSortable(clusterContainer, clusters);
    }

    // --- HUBS ON TOP (Slim Expandable Pills) ---
    const respHubs = hubs.filter(h => h.isResponsible);
    
    if (respHubs.length === 0) {
        hubContainer.parentElement.style.display = 'none';
        hubContainer.innerHTML = '';
    } else {
        hubContainer.parentElement.style.display = 'block';
        const areaLabel = `<span style="font-family: 'Outfit', sans-serif; font-size: 0.65rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-right: 8px; display: flex; align-items: center; white-space: nowrap;">AREE:</span>`;
        hubContainer.innerHTML = areaLabel + respHubs.map(h => `
            <button onclick="window.location.hash='#pm/interni?area=${h.id}'" 
                class="hp-hub-pill"
                style="
                    padding: 4px; border-radius: 100px; border: none; 
                    background: transparent; color: #1e293b; font-size: 0.72rem; font-weight: 600;
                    font-family: 'Outfit', sans-serif; text-transform: uppercase; letter-spacing: 0.05em;
                    display: flex; align-items: center; gap: 0; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    flex-shrink: 0; overflow: hidden; max-width: 32px; min-width: 32px; height: 32px;
                    justify-content: flex-start;
                " onmouseover="this.style.maxWidth='220px'; this.style.gap='10px'; this.style.padding='4px 14px 4px 4px'; this.style.background='${h.color}10'; this.style.transform='translateY(-1px)';" onmouseout="this.style.maxWidth='32px'; this.style.gap='0'; this.style.padding='4px'; this.style.background='transparent'; this.style.transform='none';">
                <div style="width: 24px; height: 24px; border-radius: 50%; background: ${h.color}15; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <span class="material-icons-round" style="font-size: 15px; color: ${h.color};">${h.icon || 'hub'}</span>
                </div>
                <span class="hp-hub-label" style="opacity: 0; transition: opacity 0.2s 0.1s; display: inline-block;">${h.label}</span>
            </button>
        `).join('');

        // Targeted script for the label span
        hubContainer.querySelectorAll('.hp-hub-pill').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                const label = btn.querySelector('.hp-hub-label');
                if (label) label.style.opacity = '1';
            });
            btn.addEventListener('mouseleave', () => {
                const label = btn.querySelector('.hp-hub-label');
                if (label) label.style.opacity = '0';
            });
        });
    }
}

export function initClusterSortable(container, clusters) {
    let draggedItem = null;

    container.querySelectorAll('.hp-cluster-card').forEach(card => {
        card.addEventListener('dragstart', (e) => {
            draggedItem = card;
            card.style.opacity = '0.4';
            e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragend', () => {
            draggedItem = card;
            card.style.opacity = '1';
            
            // Save new order
            const newOrder = Array.from(container.querySelectorAll('.hp-cluster-card')).map(el => el.dataset.id);
            const userId = state.profile?.id || state.profile?.collaborator_id;
            localStorage.setItem(`hp_cluster_order_${userId}`, JSON.stringify(newOrder));
        });

        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const target = e.target.closest('.hp-cluster-card');
            if (target && target !== draggedItem) {
                const rect = target.getBoundingClientRect();
                const next = (e.clientX - rect.left) > (rect.width / 2);
                container.insertBefore(draggedItem, next ? target.nextSibling : target);
            }
        });
    });
}

// --- ROLE-BASED MAIN CONTENT DISPATCHER ---
export async function renderMainContent(container, role, data) {
    try {
        // 1. Common Side-Panel Actions for ALL Roles (Feed, etc.)
        await setupHomepageFeed(data);

        // 2. Dispatch to specific role view
        switch(role) {
            case 'partner':         return await renderMainContent_Partner(container, data);
            case 'amministrazione': return await renderMainContent_Amministrazione(container, data);
            case 'account':         return await renderMainContent_Account(container, data);
            case 'pm':              return await renderMainContent_PM(container, data);
            default:                return await renderMainContent_Collaboratore(container, data);
        }
    } catch (err) {
        console.error("Critical error in renderMainContent:", err);
        const area = document.querySelector('.hp-main-columns-container');
        if (area) area.innerHTML = `<div style="padding: 3rem; text-align: center; color: #94a3b8;">Si è verificato un errore nel caricamento della Dashboard. Per favore ricarica la pagina.</div>`;
    }
}

export async function setupHomepageFeed(data) {
    const { myId, targetUserId, normalizedTags } = data;
    const isPartner = normalizedTags.includes('partner') || normalizedTags.includes('amministrazione') || normalizedTags.includes('account');
    
    const feedTabs = document.getElementById('hp-feed-tabs-container');
    if (feedTabs) {
        feedTabs.innerHTML = `
            <button id="hp-feed-tab-mine" onclick="window.setHpFeedTab('mine')" class="hp-filter-pill active" style="padding: 4px 10px; border-radius: 7px; border: none; font-size: 0.65rem; font-weight: 700; cursor: pointer; transition: all 0.2s; background: white; color: #1e293b; box-shadow: 0 2px 6px rgba(0,0,0,0.06);">PER ME</button>
            ${isPartner ? `<button id="hp-feed-tab-all" onclick="window.setHpFeedTab('all')" class="hp-filter-pill" style="padding: 4px 10px; border-radius: 7px; border: none; font-size: 0.65rem; font-weight: 700; cursor: pointer; transition: all 0.2s; background: transparent; color: #94a3b8;">TUTTE</button>` : ''}
        `;
    }

    window.setHpFeedTab = async (tab) => {
        const mineBtn = document.getElementById('hp-feed-tab-mine');
        const allBtn = document.getElementById('hp-feed-tab-all');
        const content = document.getElementById('hp-feed-content');
        if (!content) return;

        // Visual Toggle
        if (mineBtn) {
            mineBtn.style.background = tab === 'mine' ? 'white' : 'transparent';
            mineBtn.style.color = tab === 'mine' ? '#1e293b' : '#94a3b8';
            mineBtn.style.boxShadow = tab === 'mine' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none';
        }
        if (allBtn) {
            allBtn.style.background = tab === 'all' ? 'white' : 'transparent';
            allBtn.style.color = tab === 'all' ? '#1e293b' : '#94a3b8';
            allBtn.style.boxShadow = tab === 'all' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none';
        }

        content.innerHTML = '<span class="loader small"></span>';

        if (tab === 'mine') {
            const activities = await fetchSmartPersonalFeed(20, targetUserId, myId);
            renderActivityFeed(content, activities);
        } else {
            const activities = await fetchPMActivityLogs({ limit: 50, isAccountLevel: true });
            renderActivityFeed(content, activities);
        }
    };

    // Initial load
    window.setHpFeedTab('mine');
}

// --- PARTNER VIEW (Original full homepage logic) ---
export async function renderMainContent_Partner(container, data) {
    const { myTasks, events, activeTimers, myCollab, myId, normalizedTags } = data;
    const isPrivileged = normalizedTags.includes('partner') || normalizedTags.includes('amministrazione') || normalizedTags.includes('account') || normalizedTags.includes('project manager') || normalizedTags.includes('pm');

    const bottomTitle = document.getElementById('hp-bottom-title');
    const projectsLabel = document.getElementById('hp-bottom-projects-label');
    if (bottomTitle) bottomTitle.textContent = isPrivileged ? 'Commesse in corso' : 'Incarichi in corso';
    if (projectsLabel) projectsLabel.textContent = isPrivileged ? 'Commesse' : 'Incarichi';

    const targetUserId = data.targetUserId;
    const myActualCollabId = data.myId;

    // Un utente con partner/amministrazione è sempre admin, anche se ha anche account/pm.
    // Vedi directives/role_hierarchy.md
    const isAdmin = normalizedTags.includes('partner') ||
        normalizedTags.includes('amministrazione') ||
        normalizedTags.includes('socio') ||
        state.profile?.role === 'admin';
    
    // Hide block by default for non-admins (e.g. Accounts/PMs)
    if (isAdmin) {
        const alerts = await fetchAdminOperationalAlerts();
        renderAdminAlerts(alerts);
        const alertBlock = document.getElementById('hp-accounting-alerts-block');
        if (alertBlock) alertBlock.style.display = 'flex';
        renderAlertsWidget();
        renderMorningBriefing();
    } else {
        const alertBlock = document.getElementById('hp-accounting-alerts-block');
        if (alertBlock) alertBlock.style.display = 'none';
    }

    const projects = await fetchRecentProjects(myActualCollabId, targetUserId);
    const internalProjects = await fetchInternalProjects(myActualCollabId, targetUserId, isAdmin);
    
    // Fetch Hubs/Clusters
    // isPrivileged: True for Partner/Admin/Account/PM (for Hub visibility)
    // isAdmin (isPartnerStrict): ONLY for real Admins/Partners (for full Cluster visibility)
    const { hubs, clusters } = await fetchInternalHubsAndClusters(myActualCollabId, targetUserId, isPrivileged, isAdmin);
    renderInternalDashboard(hubs, clusters);

    // Tab switching logic
    window.setHpBottomTab = (tab) => {
        const projectsBtn = document.getElementById('hp-bottom-tab-projects');
        const internalBtn = document.getElementById('hp-bottom-tab-internal');
        const content = document.getElementById('hp-pm-spaces-main-list');
        if (!content) return;

        if (tab === 'projects') {
            projectsBtn?.classList.add('active');
            internalBtn?.classList.remove('active');
            renderProjects(content, projects);
        } else {
            internalBtn?.classList.add('active');
            projectsBtn?.classList.remove('active');
            renderProjects(content, internalProjects);
        }
    };

    // Initial render: show internal if no projects, else show projects
    if (!projects || projects.length === 0) {
        window.setHpBottomTab('internal');
    } else {
        window.setHpBottomTab('projects');
    }

    // --- HIERARCHICAL SORTING ---
    // Helper to put children under parents
    const sortHierarchical = (items) => {
        const result = []; // No need to redeclare results here
        const roots = items.filter(t => !t.parent_id || !items.find(p => p.id === t.parent_id));

        // Sort roots by date
        roots.sort((a, b) => {
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return new Date(a.due_date) - new Date(b.due_date);
        });

        const addChild = (parent) => {
            result.push(parent);
            const children = items.filter(t => t.parent_id === parent.id);
            children.sort((a, b) => {
                if (!a.due_date) return 1;
                if (!b.due_date) return -1;
                return new Date(a.due_date) - new Date(b.due_date);
            });
            children.forEach(c => addChild(c));
        };

        roots.forEach(root => addChild(root));
        return result;
    };

    // --- ACTIVITIES WIDGET LOGIC ---
    // Include BOTH Activities and Tasks in the right box
    const allFiltered = myTasks;
    const allActivities = sortHierarchical(allFiltered);

    const taskProjects = allActivities.filter(t => t.space_type.includes('commessa') || t.space_type.includes('order'));
    const taskInternal = allActivities.filter(t => t.space_type.includes('interno') || t.space_type.includes('cluster') || t.space_type.includes('space') || t.space_type === '');

    window.setHpActivityTab = (tab) => {
        const pBtn = document.getElementById('hp-act-tab-projects');
        const iBtn = document.getElementById('hp-act-tab-internal');
        const content = document.getElementById('hp-activities-bottom-content');
        if (!content) return;

        if (tab === 'projects') {
            pBtn?.classList.add('active');
            iBtn?.classList.remove('active');
            renderBottomTasks(content, taskProjects);
        } else {
            iBtn?.classList.add('active');
            pBtn?.classList.remove('active');
            renderBottomTasks(content, taskInternal);
        }
    };

    // Glow Effect Handler for Premium Cards
    const handleGlow = (e) => {
        for (const card of document.getElementsByClassName("project-card")) {
            const rect = card.getBoundingClientRect(),
                x = e.clientX - rect.left,
                y = e.clientY - rect.top;

            card.style.setProperty("--mouse-x", `${x}px`);
            card.style.setProperty("--mouse-y", `${y}px`);
        }
    };
    container.addEventListener("mousemove", handleGlow);

    // Initial render for activities
    window.setHpActivityTab('projects');

    // Feed is now handled by the shared dispatcher setupHomepageFeed

    // Note: Delegated tasks widget was removed in favor of Activity Feed per user request? 
    // Actually the user said "una card", so I replaced one. 
    // I could also add more rows to the grid if they want both.
    // For now, replacing the less used 'Delegated' is a safe bet for a clean UI.

    // Initial render for delegated (removed)
    // window.setHpDelegatedTab('projects');

    window.openMobileAgenda = () => {
        const el = document.getElementById('hp-mobile-agenda-popup');
        if (el) {
            el.style.display = 'flex';
            window.syncHomepageActivities();
        }
    };

    // Helper for Quick Add from Banner
    window.toggleHpQuickEntry = (btn) => {
        // Show a mini-menu or just default to adding task for now
        // If we have openGlobalQuickAdd or similar, use it.
        if (window.openQuickAddTask) {
            window.openQuickAddTask();
        } else {
            // Fallback: search for existing add buttons
            const addBtn = document.querySelector('[onclick*="openAddTask"]');
            if (addBtn) addBtn.click();
        }
    };
}

// --- STUB VIEWS (Enhanced with correct IDs and initialization) ---
export async function renderMainContent_Amministrazione(container, data) {
    const isAdmin = data.normalizedTags.includes('amministrazione') || state.profile?.role === 'admin' || data.normalizedTags.includes('socio') || data.normalizedTags.includes('partner');
    const alertBlock = document.getElementById('hp-accounting-alerts-block');
    if (isAdmin) {
        const alerts = await fetchAdminOperationalAlerts();
        renderAdminAlerts(alerts);
        if (alertBlock) alertBlock.style.display = 'flex';
    } else {
        if (alertBlock) alertBlock.style.display = 'none';
    }
    const content = document.getElementById('hp-pm-spaces-main-list');
    if (!content) return;
    const targetUserId = data.targetUserId;
    const myActualCollabId = data.myId;
    const projects = await fetchRecentProjects(myActualCollabId, targetUserId);
    
    // Fetch Hubs/Clusters (Pass true for global access)
    const { hubs, clusters } = await fetchInternalHubsAndClusters(myActualCollabId, targetUserId, true);
    renderInternalDashboard(hubs, clusters);
    
    renderProjects(content, projects);
}
export async function renderMainContent_Account(container, data) {
    const alertBlock = document.getElementById('hp-accounting-alerts-block');
    if (alertBlock) alertBlock.style.display = 'none';
    const content = document.getElementById('hp-pm-spaces-main-list');
    if (!content) return;
    const targetUserId = data.targetUserId;
    const myActualCollabId = data.myId;
    const projects = await fetchRecentProjects(myActualCollabId, targetUserId);
    
    // Account Level: Privileged for Hubs, but NOT PartnerStrict for Clusters
    const { hubs, clusters } = await fetchInternalHubsAndClusters(myActualCollabId, targetUserId, true, false);
    renderInternalDashboard(hubs, clusters);
    
    renderProjects(content, projects);
}
export async function renderMainContent_PM(container, data) {
    const alertBlock = document.getElementById('hp-accounting-alerts-block');
    if (alertBlock) alertBlock.style.display = 'none';
    const content = document.getElementById('hp-pm-spaces-main-list');
    if (!content) return;
    const targetUserId = data.targetUserId;
    const myActualCollabId = data.myId;
    const projects = await fetchRecentProjects(myActualCollabId, targetUserId);
    
    // PM Level: Privileged for Hubs, but NOT PartnerStrict for Clusters
    const { hubs, clusters } = await fetchInternalHubsAndClusters(myActualCollabId, targetUserId, true, false);
    renderInternalDashboard(hubs, clusters);
    
    renderProjects(content, projects);
}
export async function renderMainContent_Collaboratore(container, data) {
    const alertBlock = document.getElementById('hp-accounting-alerts-block');
    if (alertBlock) alertBlock.style.display = 'none';
    const content = document.getElementById('hp-pm-spaces-main-list');
    if (!content) return;
    const myActualCollabId = data.myId;
    const targetUserId = data.targetUserId;

    // Fetch Assignments instead of Projects for Collaborator
    const assignments = await fetchCollaboratorAssignments(myActualCollabId);
    
    // Fetch Hubs/Clusters (False for collaborator - assigned only)
    const { hubs, clusters } = await fetchInternalHubsAndClusters(myActualCollabId, targetUserId, false);
    renderInternalDashboard(hubs, clusters);
    
    // Fetch Appointments for Collaborator (Using relative path)
    const { fetchCollaboratorAppointments } = await import('../../modules/pm_api.js?v=8000');
    const events = await fetchCollaboratorAppointments(myActualCollabId) || [];
    
    if (assignments && assignments.length > 0) {
        renderAssignments(content, assignments, clusters, events);
    } else {
        // Fallback or show empty state
        renderProjects(content, []);
    }
}

// --- ASSIGNMENTS RENDERING ---
export function renderAssignments(pmList, assignments, clusters = [], events = []) {
    if (!pmList || !assignments) return;
    
    // Reset Stats Bar for Assignments
    const statsBar = document.getElementById('hp-projects-stats-bar');
    if (statsBar) {
        // Calculate unique orders (Commesse)
        const uniqueOrders = new Set(assignments.map(a => a.order_number).filter(Boolean));
        
        statsBar.innerHTML = `
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                <span style="font-size: 0.58rem; font-weight: 700; color: #3b82f6; letter-spacing: 0.05em; opacity: 0.8;">COMMESSE</span>
                <span class="stat-loading" style="font-size: 1.25rem; font-weight: 800; color: #3b82f6; line-height: 1;">...</span>
            </div>
            <div style="width: 1px; height: 24px; background: rgba(0,0,0,0.06);"></div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                <span style="font-size: 0.58rem; font-weight: 700; color: #475569; letter-spacing: 0.05em; opacity: 0.8;">ATTIVITÀ</span>
                <span class="stat-loading" style="font-size: 1.25rem; font-weight: 800; color: #1e293b; line-height: 1;">...</span>
            </div>
            <div style="width: 1px; height: 24px; background: rgba(0,0,0,0.06);"></div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                <span style="font-size: 0.58rem; font-weight: 700; color: #475569; letter-spacing: 0.05em; opacity: 0.8;">TASK</span>
                <span class="stat-loading" style="font-size: 1.25rem; font-weight: 800; color: #1e293b; line-height: 1;">...</span>
            </div>
            <div style="width: 1px; height: 24px; background: rgba(0,0,0,0.06);"></div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                <span style="font-size: 0.58rem; font-weight: 700; color: #10b981; letter-spacing: 0.05em; opacity: 0.8;">APPUNTAMENTI</span>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span class="stat-loading" style="font-size: 1.25rem; font-weight: 800; color: #10b981; line-height: 1;">...</span>
                </div>
            </div>
        `;
    }

    pmList.innerHTML = assignments.map(a => `
        <div class="project-card" onclick="window.location.hash='${a.link}'" style="
            background: white;
            border-radius: 14px;
            padding: 0.75rem 0.85rem;
            border: 1px solid #f1f5f9;
            display: flex;
            align-items: center;
            gap: 1rem;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 4px 10px rgba(0,0,0,0.02);
            position: relative;
            overflow: hidden;
            margin-bottom: 4px;
        ">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(139, 92, 246, 0.06); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                 <span class="material-icons-round" style="color: #8b5cf6; font-size: 18px;">assignment</span>
            </div>
            <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                     <span style="font-size: 0.6rem; font-weight: 800; color: #8b5cf6; text-transform: uppercase;">${a.legacy_id || 'INC'}</span>
                </div>
                <h4 style="font-size: 0.95rem; font-weight: 700; color: #1e293b; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;">
                    ${a.title}
                </h4>
                <div style="font-size: 0.72rem; color: #64748b; font-weight: 500;">${a.client}</div>
            </div>
        </div>
    `).join('');
}

// --- SHARED PROJECTS RENDERING ENGINE ---
export function renderProjects(pmList, pmProjects) {
    if (!pmList || !pmProjects) return;
    
    // Ensure the block is visible
    const pmBlock = document.getElementById('hp-pm-spaces-main-block');
    if (pmBlock) pmBlock.style.display = 'flex';

    const _internalRender = () => {
        const showAccount = window.hpActiveFilters?.account !== false;
        const showPm = window.hpActiveFilters?.pm !== false;

        // Ensure the stats bar is populated with its internal HTML structure if empty
        const statsBar = document.getElementById('hp-projects-stats-bar');
        if (statsBar && !statsBar.querySelector('#stat-count-projects')) {
            statsBar.innerHTML = `
                <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                    <span style="font-size: 0.55rem; font-weight: 700; color: #3b82f6; letter-spacing: 0.05em; opacity: 0.8; text-transform: uppercase;">COMMESSE</span>
                    <span id="stat-count-projects" class="stat-loading" style="font-size: 1.25rem; font-weight: 800; color: #3b82f6; line-height: 1;">...</span>
                </div>
                <div style="width: 1px; height: 24px; background: rgba(0,0,0,0.06);"></div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                    <span style="font-size: 0.55rem; font-weight: 700; color: #475569; letter-spacing: 0.05em; opacity: 0.8; text-transform: uppercase;">ATTIVITÀ</span>
                    <span id="stat-count-activities" class="stat-loading" style="font-size: 1.25rem; font-weight: 800; color: #1e293b; line-height: 1;">...</span>
                </div>
                <div style="width: 1px; height: 24px; background: rgba(0,0,0,0.06);"></div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                    <span style="font-size: 0.55rem; font-weight: 700; color: #475569; letter-spacing: 0.05em; opacity: 0.8; text-transform: uppercase;">TASK</span>
                    <span id="stat-count-tasks" class="stat-loading" style="font-size: 1.25rem; font-weight: 800; color: #1e293b; line-height: 1;">...</span>
                </div>
                <div style="width: 1px; height: 24px; background: rgba(0,0,0,0.06);"></div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                    <span style="font-size: 0.55rem; font-weight: 700; color: #10b981; letter-spacing: 0.05em; opacity: 0.8; text-transform: uppercase;">APPUNTAMENTI</span>
                    <span id="stat-count-events" class="stat-loading" style="font-size: 1.25rem; font-weight: 800; color: #10b981; line-height: 1;">...</span>
                </div>
            `;
        }
        
        const filtered = pmProjects.filter(p => {
            if (showAccount && p.isAccount) return true;
            if (showPm && p.isPM) return true;
            return false;
        });

        // Update stats in the bar
        const statProjects = document.getElementById('stat-count-projects');
        const statActivities = document.getElementById('stat-count-activities');
        const statTasks = document.getElementById('stat-count-tasks');
        const statEvents = document.getElementById('stat-count-events');
        
        // Sum up pre-calculated stats from individual projects
        let totalAct = 0;
        let totalTask = 0;
        let totalEvt = 0;
        
        filtered.forEach(p => {
            const s = p.stats || {};
            totalAct += (s.activities || 0);
            totalTask += (s.tasks || 0);
            totalEvt += (s.appointments || 0);
        });
        
        if (statProjects) statProjects.textContent = filtered.length;
        if (statActivities) statActivities.textContent = totalAct;
        if (statTasks) statTasks.textContent = totalTask;
        if (statEvents) statEvents.textContent = totalEvt;

        pmList.innerHTML = filtered.map((p, idx) => {
            const isMaintenance = p.status && p.status.toLowerCase().includes('manutenzione');
            const isPaused = p.status && (p.status.toLowerCase().includes('pausa') || p.status.toLowerCase().includes('hold'));
            
            return `
                <div onclick="window.location.hash = '#pm/commessa/${p.id}'" style="
                    background: rgba(255, 255, 255, 0.92); 
                    backdrop-filter: blur(28px) saturate(190%); 
                    -webkit-backdrop-filter: blur(28px) saturate(190%);
                    border: 1px solid rgba(255, 255, 255, 0.8); 
                    padding: 8px 12px; 
                    border-radius: 14px; 
                    cursor: pointer; 
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); 
                    position: relative;
                    margin-bottom: 2px;
                " onmouseover="this.style.background='#ffffff'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.06)'; this.style.borderColor='#ffffff'" onmouseout="this.style.background='rgba(255, 255, 255, 0.92)'; this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 10px rgba(0,0,0,0.02)'; this.style.borderColor='rgba(255, 255, 255, 0.8)'">
                    <div style="display: flex; flex-direction: column; gap: 1px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <div style="display: flex; align-items: center; gap: 4px; min-width: 0;">
                                <span style="font-size: 0.62rem; color: #94a3b8; font-weight: 400; letter-spacing: -0.01em; flex-shrink: 0;">#${p.order_number || '---'}</span>
                                <div style="height: 8px; width: 1px; background: rgba(0,0,0,0.06); flex-shrink: 0;"></div>
                                <span style="font-size: 0.68rem; color: #64748b; font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; letter-spacing: -0.01em;">${p.client || 'Gleeye'}</span>
                            </div>
                            <div style="display: flex; gap: 4px; flex-shrink: 0; margin-left: 8px; align-items: center;">
                                ${isMaintenance ? `<span class="material-icons-round" style="font-size: 0.7rem; color: #94a3b8;" title="Manutenzione">settings</span>` : 
                                  (isPaused ? `<span class="material-icons-round" style="font-size: 0.7rem; color: #94a3b8;" title="In Pausa">pause_circle</span>` : 
                                   `<span class="material-icons-round" style="font-size: 0.7rem; color: #94a3b8;" title="In Svolgimento">play_circle</span>`)}
                                
                                <div style="width: 2px;"></div>
                                
                                ${p.isAccount ? `<div title="Account" style="width: 13px; height: 13px; background: transparent; color: #3b82f6; border: 1.25px solid #3b82f630; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.5rem; font-weight: 900;">A</div>` : ''}
                                ${p.isPM ? `<div title="Project Manager" style="width: 13px; height: 13px; background: transparent; color: #8b5cf6; border: 1.25px solid #8b5cf630; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.5rem; font-weight: 900;">P</div>` : ''}
                            </div>
                        </div>
                        <div style="font-weight: 600; font-size: 0.78rem; color: #1e293b; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; letter-spacing: -0.01em; margin-bottom: 1px;">${p.title}</div>
                    </div>
                </div>
            `;
        }).join('');
    };

    _internalRender();
    
    // External hook for filter update
    window._hpCurrentProjectsRenderer = _internalRender; 
}

window.togglePmFilter = (type) => {
    if (!window.hpActiveFilters) window.hpActiveFilters = { account: true, pm: true };
    window.hpActiveFilters[type] = !window.hpActiveFilters[type];
    
    const btnAccount = document.getElementById('hp-filter-account');
    const btnPm = document.getElementById('hp-filter-pm');
    
    // Update visual states
    if (btnAccount) {
        btnAccount.style.background = window.hpActiveFilters.account ? '#fff' : 'transparent';
        btnAccount.style.boxShadow = window.hpActiveFilters.account ? '0 2px 6px rgba(0,0,0,0.06)' : 'none';
        btnAccount.style.color = window.hpActiveFilters.account ? '#1e293b' : '#94a3b8';
    }
    if (btnPm) {
        btnPm.style.background = window.hpActiveFilters.pm ? '#fff' : 'transparent';
        btnPm.style.boxShadow = window.hpActiveFilters.pm ? '0 2px 6px rgba(0,0,0,0.06)' : 'none';
        btnPm.style.color = window.hpActiveFilters.pm ? '#1e293b' : '#94a3b8';
    }

    if (window._hpCurrentProjectsRenderer) window._hpCurrentProjectsRenderer();
};
