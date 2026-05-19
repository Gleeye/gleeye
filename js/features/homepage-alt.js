import { state } from '/js/modules/state.js?v=8000';
import { supabase } from '../modules/config.js?v=8000';
import { formatAmount, renderAvatar } from '../modules/utils.js?v=8000';

import { fetchAvailabilityRules, fetchAvailabilityOverrides, fetchCollaborators, fetchAssignments, upsertAssignment, fetchGoogleCalendarBusy } from '../modules/api.js?v=8000';
import { fetchAppointment, updatePMItem, fetchSmartPersonalFeed, fetchPMActivityLogs } from '../modules/pm_api.js?v=8000';
import { humanizeActivity } from '../modules/pm_activity_helper.js?v=8000';
import { openHubDrawer } from './pm/components/hub_drawer.js?v=8016';
import { openAppointmentDrawer } from './pm/components/hub_appointment_drawer.js?v=8000';

// Activity-feed widgets (extracted to a sibling module). Importing this also
// installs `window.quickCompleteTask` for the inline HTML onclick handlers.
import {
    timeAgo,
    renderActivityRow,
    renderMyActivities,
    renderBottomActivities,
    renderBottomTasks,
    renderDelegatedTasks,
    renderActivityFeed,
} from './homepage/activity_feed.js?v=8000';

// Async data fetchers (extracted). `fetchInternalProjects` is re-exported below
// to preserve the public surface of this file (homepage.js legacy still imports it).
import {
    fetchDateEvents,
    fetchRecentProjects,
    fetchAdminOperationalAlerts,
    fetchInternalProjects,
    fetchCollaboratorAssignments,
    fetchCollaboratorPayments,
    fetchInternalHubsAndClusters,
} from './homepage/data_fetchers.js?v=8000';
export { fetchInternalProjects };

// Role dispatchers + shared rendering helpers (extracted). `renderHomepageAlt`
// (still in this file) calls into these to drive the per-role main content.
import {
    renderAdminAlerts,
    renderInternalDashboard,
    renderMainContent,
    renderProjects,
} from './homepage/role_dispatchers.js?v=8000';

// Timeline renderers (extracted): vertical day view + horizontal weekly view.
import {
    renderVerticalTimeline,
    renderWeeklyTimeline,
} from './homepage/timeline.js?v=8000';

// Small homepage helpers (extracted).
import {
    getFirstName,
    renderCollaboratorPayments,
    detectUserRole,
} from './homepage/helpers.js?v=8000';

// Global window.* handlers used by HTML inline onclick (side-effect only import).
import './homepage/global_handlers.js?v=8000';

// Event detail modal (unified). Used directly by renderHomepageAlt; the same
// import also drives the alias `window.openHomepageEventDetails` set inside
// the global_handlers module above.
import { openEventDetails } from './agenda_utils.js?v=8000';

// --- VERTICAL TIMELINE HELPERS ---



// --- MAIN RENDER LOGIC ---
// Actually fetchMyBookings stores in `eventsCache` (not exported) or `window`?
// Let's create a dedicated fetch or use the general one if accessible.
// Since `personal_agenda.js` doesn't export the cache cleanly, we'll fetch explicitly here.

// fetchDateEvents + fetchRecentProjects + fetchAdminOperationalAlerts + fetchInternalProjects
// extracted to ./homepage/data_fetchers.js (Fase split-monstro step 2)

// getFirstName extracted to ./homepage/helpers.js (Fase split-monstro step 5)

/**
 * Renders the operational Admin alert list on the homepage.
 * Shows actionable items requiring attention, not financial KPIs.
 */
// renderAdminAlerts extracted to ./homepage/role_dispatchers.js (Fase split-monstro step 3)

// --- ROLE DETECTION HELPER ---
// --- COLLABORATOR SPECIFIC FETCHERS ---
// fetchCollaboratorAssignments + fetchCollaboratorPayments extracted to ./homepage/data_fetchers.js
// renderCollaboratorPayments extracted to ./homepage/helpers.js

// detectUserRole extracted to ./homepage/helpers.js

export async function renderHomepageAlt(container) {
    console.log("Rendering Homepage...");
    
    // Inject alt CSS if not present
    if (!document.getElementById('homepage-alt-style')) {
        const link = document.createElement('link');
        link.id = 'homepage-alt-style';
        link.rel = 'stylesheet';
        link.href = 'css/components/homepage-alt.css?v=8000';
        document.head.appendChild(link);
    }

    const user = state.session?.user;
    if (!user) return;

    // Determine which collaborator to show (support impersonation)
    let myCollab;
    
    // 1. If impersonating, we MUST find that person
    if (state.impersonatedCollaboratorId) {
        myCollab = state.collaborators.find(c => c.id == state.impersonatedCollaboratorId);
        
        // If not found in list yet (race condition), try to guess from sidebar or synthesise
        if (!myCollab) {
            console.log("[Homepage] Impersonated collaborator not in state.collaborators yet. Checking sidebar...");
            const sidebarName = document.querySelector('.sidebar-profile h3')?.textContent;
            if (sidebarName && sidebarName !== (state.profile?.full_name || 'Utente')) {
                myCollab = { full_name: sidebarName, first_name: sidebarName.split(' ')[0] };
            }
        }
    }

    // 2. Normal lookup for self
    if (!myCollab) {
        myCollab = state.collaborators.find(c => c.email === user.email);
    }
    
    // 3. Fallback: search by user_id
    if (!myCollab && state.profile) {
        myCollab = state.collaborators.find(c => c.user_id === state.profile.id);
    }

    // 4. Final Fallback: use profile data
    if (!myCollab) {
        myCollab = {
            id: state.profile?.collaborator_id || null,   // ← numeric collaborator ID
            user_id: state.profile?.id || user.id,        // ← UUID auth (corretto per query UUID)
            first_name: state.profile?.first_name || user.user_metadata?.first_name || '',
            last_name: state.profile?.last_name || user.user_metadata?.last_name || '',
            full_name: state.profile?.full_name || 'Utente',
            email: user.email,
            tags: state.profile?.tags || []               // ← aggiungi anche i tags per il role detection
        };
    }

    const firstName = getFirstName(myCollab, state.profile);
    const myId = myCollab.id || state.profile?.collaborator_id || state.profile?.id;

    // --- ROLE DETECTION (Fixed for Impersonation) ---
    let userTagsRaw = [];
    if (myCollab?.tags && (Array.isArray(myCollab.tags) ? myCollab.tags.length > 0 : myCollab.tags)) {
        if (typeof myCollab.tags === 'string') {
            try { userTagsRaw = JSON.parse(myCollab.tags); } catch (e) { userTagsRaw = myCollab.tags.split(',').map(t => t.trim()); }
        } else { userTagsRaw = myCollab.tags || []; }
    } else {
        userTagsRaw = state.profile?.tags || [];
    }

    const normalizedTagsForHtml = Array.isArray(userTagsRaw) ? userTagsRaw.map(t => (t || '').toLowerCase()) : [];
    window.normalizedTagsForHtml = normalizedTagsForHtml; // needed by renderAdminAlerts
    let htmlRole = detectUserRole(normalizedTagsForHtml);
    
    // FORCE PARTNER VIEW FOR ADMINS/SOCI — skip when impersonating
    const isImpersonating = !!state.impersonatedCollaboratorId;
    if (!isImpersonating && (state.profile?.role === 'admin' || normalizedTagsForHtml.includes('socio') || normalizedTagsForHtml.includes('partner'))) {
        htmlRole = 'partner';
    }
    
    // Collaboratore, PM e Account usano il layout con payments box
    // Partner non ce l'ha (i soci non hanno incarichi personali)
    const isCollaborator = htmlRole === 'collaboratore' || htmlRole === 'pm' || htmlRole === 'account';
    const isAccountUser = normalizedTagsForHtml.includes('account');
    const isPmUser = normalizedTagsForHtml.includes('project manager') || normalizedTagsForHtml.includes('pm');
    const showAccountPmToggle = isAccountUser && isPmUser;

    // --- MANAGE TOP BAR GREETING ---
    const pageTitle = document.getElementById('page-title');
    const hours = new Date().getHours();
    let greeting = 'Buongiorno';
    if (hours >= 14 && hours < 19) greeting = 'Buon pomeriggio';
    else if (hours >= 19 || hours < 5) greeting = 'Buonasera';

    window.greetingText = greeting; // Store for inner content

    if (pageTitle) {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            pageTitle.textContent = "Gleeye";
        } else {
            pageTitle.textContent = `${greeting}, ${firstName}!`;
        }
        pageTitle.classList.add('solid-title');
    }

    // --- FETCH DATA FOR "MY ACTIVITIES" ---
    let myTasks = [], activeTimers = [], events = [];
    // Default filter state (User requested: Task, Appuntamenti, Attività)
    if (!window.hpActivityFilter) window.hpActivityFilter = 'task';

    // 1. Initial UI Flush (Skeleton) - This prevents the White Screen
    container.innerHTML = `
        <style>
            /* FORCE FLEX ON GLOBAL ERP AREA */
            #content-area { 
                display: flex !important; 
                flex-direction: row !important; 
                height: calc(100vh - 70px) !important; 
                width: 100% !important;
                overflow: hidden !important; 
                position: relative !important;
                max-width: 100vw !important;
                margin: 0 !important;
                padding: 0 !important;
                background: linear-gradient(135deg, #fdfdfd 0%, #f1f5f9 100%) !important;
            }

            .hp-alt-wrapper { display: flex; width: 100%; height: 100%; background: transparent; font-family: 'Outfit'; position: relative; overflow: hidden; flex: 1; }
            .hp-alt-sidebar-left { width: 320px; flex-shrink: 0; height: 100%; background: white; border-right: 1px solid #eef2f6; display: flex; flex-direction: column; position: relative; box-shadow: 10px 0 30px rgba(0,0,0,0.01); z-index: 10; overflow: hidden; }
            .hp-main-content-area { flex: 1; display: flex; flex-direction: column; gap: 2rem; padding: 1.5rem 2rem; overflow-y: auto; overflow-x: hidden; scrollbar-width: none; position: relative; width: 100%; box-sizing: border-box; background: transparent; }
            .hp-main-columns-container { display: flex; flex-direction: row; gap: 2rem; width: 100%; align-items: stretch; min-height: 0; }
            
            .hp-mobile-banner { display: none; }
            .hp-mobile-agenda-pop { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); z-index: 20000; align-items: center; justify-content: center; padding: 15px; }
            
            @media (max-width: 1150px) {
                /* FORCE GLOBAL UNLOCK FOR MOBILE SCROLL */
                body, #app, .main-content { height: auto !important; overflow: visible !important; min-height: 100vh !important; }
                #content-area { height: auto !important; overflow: visible !important; padding: 0 !important; }

                .hp-alt-wrapper { height: auto !important; overflow: visible !important; min-height: 100vh !important; display: block !important; }
                .hp-alt-sidebar-left { display: none !important; }
                .hp-main-content-area { padding: 0.5rem 1.25rem 2rem 1.25rem !important; overflow: visible !important; width: 100% !important; height: auto !important; box-sizing: border-box; }
                .hp-main-columns-container { flex-direction: column; gap: 1.5rem; width: 100%; border-radius: 0; }
                
                .hp-mobile-banner { 
                    display: flex; 
                    position: sticky;
                    top: env(safe-area-inset-top, 0px); 
                    padding-top: 12px;
                    z-index: 1000;
                    margin-bottom: 1rem;
                    background: rgba(255, 255, 255, 0.9); 
                    backdrop-filter: blur(25px) saturate(180%); 
                    -webkit-backdrop-filter: blur(25px) saturate(180%); 
                    border: 1px solid rgba(255, 255, 255, 0.6);
                    padding: 10px 18px;
                    border-radius: 20px;
                    z-index: 1000;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                    justify-content: space-between;
                    align-items: center;
                    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    cursor: pointer;
                }
                .hp-mobile-banner:active { transform: scale(0.97); }
                
                .hp-widget-panel { border-radius: 26px !important; width: 100% !important; box-sizing: border-box; background: white !important; border: 1px solid #f1f5f9 !important; box-shadow: 0 4px 15px rgba(0,0,0,0.03) !important; }
                #hp-internal-dashboard-block { min-width: 100% !important; padding: 0 !important; width: 100% !important; }
                #hp-internal-clusters-grid { grid-template-columns: repeat(3, 1fr) !important; width: 100% !important; gap: 8px !important; padding-top: 10px !important; }
                #hp-pm-spaces-main-block { min-width: 100% !important; width: 100% !important; }
            }
        </style>

            <!-- 1. LEFT SIDEBAR (Stacked: Tasks -> Agenda) - HIDDEN ON MOBILE -->
            <div class="hp-alt-sidebar-left">
                
                <!-- HEADER (Premium Style - Minimalist) -->
                <div style="padding: 1.75rem 1.75rem 1.25rem 1.75rem; border-bottom: 1px solid #f1f5f9; flex: 0 0 auto;">
                     <!-- Hidden Benvenuto, Visible Data -->
                     <h1 id="page-title" style="display: none;"></h1>
                     <h2 id="hp-date-description" style="font-size: 0.85rem; font-weight: 500; color: #64748b; margin: 0; margin-bottom: 1.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></h2>

                     <div class="hp-nav-controls" style="display: flex; flex-direction: row; gap: 8px; align-items: stretch; height: 38px;">
                         <div class="hp-pill-group" style="display: flex; flex: 1; border-radius: 12px; padding: 3px; background: #f8fafc; border: 1px solid #f1f5f9;">
                             <button onclick="setHomepageMode('today')" id="btn-mode-today" class="nav-pill active-pill" style="flex: 1; border-radius: 9px; font-size: 0.72rem; border: none;">Oggi</button>
                             <button onclick="setHomepageMode('tomorrow')" id="btn-mode-tomorrow" class="nav-pill" style="flex: 1; border-radius: 9px; font-size: 0.72rem; border: none;">Domani</button>
                             <button onclick="setHomepageMode('week')" id="btn-mode-week" class="nav-pill" style="flex: 1; border-radius: 9px; font-size: 0.72rem; border: none;">Settimana</button>
                         </div>

                         <button id="hp-date-picker-btn" onclick="toggleCustomDatePicker(this)" style="width: 38px; height: 38px; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; color: #64748b; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">
                            <span class="material-icons-round" style="font-size: 18px; color: #8b5cf6;">calendar_today</span> 
                         </button>

                         <button id="hp-top-add-btn" style="width: 38px; height: 38px; min-width: 38px; flex-shrink: 0; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; color: #111; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">
                            <span class="material-icons-round" style="font-size: 20px;">add</span>
                         </button>
                     </div>
                </div>

                <!-- 2. TASKS SECTION (Top Block - with faceted switcher) -->
                <div class="hp-sidebar-list-block" style="flex: 0 0 auto; min-height: 380px; max-height: 440px; display: flex; flex-direction: column; padding: 1.5rem 1.75rem; border-bottom: 2px solid #f8fafc; background: #fff; font-family: 'Outfit';">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                         
                         <!-- Segmented Control (Icons Only) -->
                         <div style="display: flex; align-items: center; gap: 2px; background: #f8fafc; padding: 4px; border-radius: 12px; border: 1px solid #f1f5f9;">
                            <div id="hp-filter-task" onclick="window.setHpAltFilter('task')" style="position: relative; cursor: pointer; width: 42px; height: 36px; border-radius: 9px; display: flex; align-items: center; justify-content: center; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); background: ${window.hpActivityFilter === 'task' ? '#fff' : 'transparent'}; color: ${window.hpActivityFilter === 'task' ? '#64748b' : '#64748b'}; border: ${window.hpActivityFilter === 'task' ? '1px solid #e2e8f0' : '1px solid transparent'}; box-shadow: ${window.hpActivityFilter === 'task' ? '0 4px 10px rgba(0,0,0,0.05)' : 'none'};">
                                <span class="material-icons-round" style="font-size: 20px;">check_circle</span>
                                <div id="hp-badge-task" style="display: none; position: absolute; top: -3px; right: -3px; background: #ef4444; color: white; font-size: 8px; font-weight: 800; min-width: 15px; height: 15px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1.5px solid #fff;">0</div>
                            </div>
                            <div id="hp-filter-event" onclick="window.setHpAltFilter('event')" style="position: relative; cursor: pointer; width: 42px; height: 36px; border-radius: 9px; display: flex; align-items: center; justify-content: center; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); background: ${window.hpActivityFilter === 'event' ? '#fff' : 'transparent'}; color: ${window.hpActivityFilter === 'event' ? '#64748b' : '#64748b'}; border: ${window.hpActivityFilter === 'event' ? '1px solid #e2e8f0' : '1px solid transparent'}; box-shadow: ${window.hpActivityFilter === 'event' ? '0 4px 10px rgba(0,0,0,0.05)' : 'none'};">
                                <span class="material-icons-round" style="font-size: 20px;">calendar_today</span>
                                <div id="hp-badge-event" style="display: none; position: absolute; top: -3px; right: -3px; background: #8b5cf6; color: white; font-size: 8px; font-weight: 800; min-width: 15px; height: 15px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1.5px solid #fff;">0</div>
                            </div>
                         </div>

                         <div style="display: flex; align-items: center; gap: 8px;">
                            <a id="hp-task-list-link" href="#tasks-summary" style="text-decoration: none; font-size: 0.7rem; font-weight: 700; color: #1e293b; background: #fff; padding: 7px 14px; border-radius: 10px; border: 1px solid #e2e8f0; transition: all 0.25s; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">Lista</a>
                            <div id="hp-overdue-toggle" onclick="window.toggleHpOverdue()" style="cursor: pointer; position: relative; width: 36px; height: 36px; border-radius: 10px; background: #fff; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                                <span class="material-icons-round" style="font-size: 19px; color: #ef4444;">history</span>
                                <div id="hp-overdue-badge" style="display: none; position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; font-size: 8px; font-weight: 800; min-width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; box-shadow: 0 2px 5px rgba(239, 68, 68, 0.2);">0</div>
                            </div>
                         </div>
                    </div>
                    
                    <div id="hp-activities-list" style="flex: 1; overflow-y: auto;">
                        <!-- Tasks live here -->
                    </div>
                </div>
                

                <!-- 3. AGENDA SECTION (Bottom Block - Vertical Timeline - No Header) -->
                <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #fff;">
                    <div id="hp-timeline-wrapper" style="flex: 1; overflow-y: auto; position: relative;">
                        <!-- Timeline lives here -->
                    </div>
                </div>
            </div>

            <!-- 2. MAIN CONTENT AREA (Projects + Activities) -->
            <div class="hp-main-content-area custom-scrollbar" style="padding-top: 1rem;">
                 
                 <!-- RESPONSIVE DASHBOARD STYLES -->
                 <style>
                     .hp-dash-collab-main {
                         display: flex;
                         gap: 2.5rem;
                         align-items: stretch;
                         width: 100%;
                     }
                     .hp-dash-collab-left {
                         flex: 2.4;
                         display: flex;
                         flex-direction: column;
                         gap: 2.5rem;
                         min-width: 0;
                     }
                     .hp-dash-collab-right {
                         flex: 1;
                         min-width: 260px;
                         display: flex;
                         flex-direction: column;
                         overflow: hidden;
                     }
                     .hp-dash-collab-top {
                         display: grid;
                         grid-template-columns: 0.9fr 1.15fr;
                         grid-template-rows: 1fr;
                         gap: 2.5rem;
                         align-items: stretch; height: 440px;
                         width: 100%;
                     }
                     .hp-dash-collab-fin {
                         display: grid;
                         grid-template-columns: 1fr 1fr;
                         grid-template-rows: 1fr;
                         gap: 2.5rem;
                         align-items: stretch; height: 440px;
                         width: 100%;
                         margin-bottom: 2.5rem;
                     }
                     .hp-dash-partner-main {
                         display: grid;
                         grid-template-columns: 1.15fr 1fr 0.85fr;
                         gap: 2.5rem;
                         align-items: flex-start;

                         width: 100%;
                         min-height: 0;
                     }
                     
                      .hp-dash-collab-top > div, .hp-dash-collab-fin > div, .hp-dash-partner-main > div {
                          display: flex;
                          flex-direction: column;
                          overflow: hidden;
                          min-height: 0;
                          height: 100%;
                      }

                     @media (max-width: 1100px) {
                         .hp-alt-sidebar-left { display: none !important; }
                         .hp-main-content-area { padding: 1rem !important; height: auto !important; overflow-y: visible !important; }
                         .hp-main-columns-container { flex-direction: column !important; height: auto !important; gap: 1.5rem; }
                         .hp-dash-collab-main, .hp-dash-collab-top, .hp-dash-collab-fin, .hp-dash-partner-main {
                             display: flex !important;
                             flex-direction: column !important;
                             grid-template-columns: none !important;
                             height: auto !important;
                             gap: 1.5rem !important;
                         }
                         .hp-dash-collab-top > div, .hp-dash-partner-main > div {
                             max-height: none !important;
                             height: auto !important;
                             width: 100% !important;
                             flex: none !important;
                         }
                         .hp-mobile-banner { display: flex !important; position: sticky; top: 0; z-index: 100; margin-bottom: 20px; }
                     }
                     
                     @media (min-width: 1101px) {
                         .hp-main-columns-container {
                             min-height: 900px;
                         }
                         .hp-dash-collab-top, .hp-dash-collab-fin {
                             height: 440px !important;
                         }
                         #hp-pm-spaces-main-block, #hp-internal-dashboard-block {
                             height: 440px !important;
                             max-height: 440px;
                         }
                         .hp-dash-collab-top > div {
                             height: 100%;
                             max-height: 440px;
                         }
                     }
                 </style>

                 <!-- MOBILE STICKY BANNER -->
                 <div class="hp-mobile-banner" onclick="window.openMobileAgenda()">
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <div style="display: flex; flex-direction: column; gap: 0;">
                            <span style="font-size: 0.62rem; font-weight: 800; color: #1e293b; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 2px;">JOURNAL'S VIEW</span>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="display: flex; align-items: center; gap: 4px;">
                                    <span class="material-icons-round" style="color: #8b5cf6; font-size: 13px;">task_alt</span>
                                    <span id="hp-banner-count-tasks" style="font-weight: 800; font-size: 0.9rem; color: #64748b;">0</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 4px;">
                                    <span class="material-icons-round" style="color: #10b981; font-size: 13px;">calendar_today</span>
                                    <span id="hp-banner-count-events" style="font-weight: 800; font-size: 0.9rem; color: #64748b;">0</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div onclick="event.stopPropagation(); window.toggleHpQuickEntry(this)" style="width: 36px; height: 36px; background: #1e293b; border: none; border-radius: 11px; color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 15px rgba(0,0,0,0.15); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        <span class="material-icons-round" style="font-size: 20px;">add</span>
                    </div>
                 </div>
                 
                 <div class="hp-main-columns-container">
                     ${isCollaborator ? `
                     <!-- ==================== COLLABORATOR ==================== -->
                     <div class="hp-dash-collab-main">
                         
                         <!-- LEFT SIDE: Tasks, Activities, Financials -->
                         <div class="hp-dash-collab-left">
                             <!-- ROW 1: TOP BLOCKS -->
                             <div class="hp-dash-collab-top">
                                 <!-- Left: Tasks (Collab) -->
                                 <div id="hp-pm-spaces-main-block" style="padding: 0;">
                                    <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 0.75rem; flex-shrink: 0;">
                                         <div style="display: flex; justify-content: space-between; align-items: center;">
                                             <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 600; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 10px; letter-spacing: -0.01em;">
                                                 <div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255, 255, 255, 0.6); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);">
                                                     <span class="material-icons-round" style="color: #64748b; font-size: 18px;">dashboard</span>
                                                 </div>
                                                 I miei incarichi
                                             </h3>
                                         </div>
                                    </div>
                                    <div id="hp-projects-stats-bar" style="display: flex; align-items: center; justify-content: space-between; padding: 0.25rem 0.5rem; margin-bottom: 0.25rem; flex-shrink: 0;"></div>
                                    <div id="hp-pm-spaces-main-list" class="custom-scrollbar" style="flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; overflow-x: hidden; padding: 0 8px 30px 0; min-height: 0;"></div>
                                 </div>

                                 <!-- Right: Internal Activities (Collab) -->
                                 <div id="hp-internal-dashboard-block" style="padding: 0;">
                                    <div style="margin-bottom: 1.25rem; display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                                        <div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255, 255, 255, 0.6); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);">
                                            <span class="material-icons-round" style="color: #64748b; font-size: 18px;">business_center</span>
                                        </div>
                                        <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 600; color: #1e293b; margin: 0; letter-spacing: -0.01em;">Attività interne</h3>
                                    </div>
                                    <div style="margin-bottom: 2rem; flex-shrink: 0;">
                                        <div id="hp-internal-hubs-buttons" style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 12px; scrollbar-width: none; -ms-overflow-style: none;"></div>
                                    </div>
                                    <div id="hp-internal-clusters-grid" class="custom-scrollbar" style="flex: 1; display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 1rem; overflow-y: auto; padding: 0 4px 2rem 4px; min-height: 0;"></div>
                                 </div>
                             </div>

                             <!-- ROW 2: FINANCIAL BLOCKS (Collab) -->
                             <div class="hp-dash-collab-fin">
                                 <div id="hp-collaborator-payments-box" class="hp-widget-panel" style="box-sizing: border-box; padding: 1.25rem 1.5rem; background: white; border: 1px solid rgba(0,0,0,0.04); border-radius: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.04);">
                                      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 0.85rem;">
                                          <span class="material-icons-round" style="color: #94a3b8; font-size: 16px;">payment</span>
                                          <h3 style="font-family: 'Outfit', sans-serif; font-size: 0.85rem; font-weight: 700; color: #64748b; margin: 0; letter-spacing: 0.04em; text-transform: uppercase;">Pagamenti</h3>
                                      </div>
                                      <div id="hp-collab-payments-list" class="custom-scrollbar" style="height: 354px; overflow-y: auto; padding-right: 4px;"><div style="padding: 1.5rem 0; text-align: center; color: #94a3b8;"><span class="loader small"></span></div></div>
                                 </div>
                                 <div id="hp-collaborator-invoices-box" class="hp-widget-panel" style="box-sizing: border-box; padding: 1.25rem 1.5rem; background: white; border: 1px solid rgba(0,0,0,0.04); border-radius: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.04);">
                                      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 0.85rem;">
                                          <span class="material-icons-round" style="color: #94a3b8; font-size: 16px;">receipt_long</span>
                                          <h3 style="font-family: 'Outfit', sans-serif; font-size: 0.85rem; font-weight: 700; color: #64748b; margin: 0; letter-spacing: 0.04em; text-transform: uppercase;">Fatture</h3>
                                      </div>
                                      <div id="hp-collab-invoices-list" class="custom-scrollbar" style="height: 354px; overflow-y: auto; padding-right: 4px;"><div style="padding: 1.5rem 0; text-align: center; color: #94a3b8;"><span class="loader small"></span></div></div>
                                 </div>
                             </div>
                         </div>
                         
                         <!-- RIGHT SIDE: FEED -->
                         <div class="hp-dash-collab-right">
                              <!-- FEED BLOCK -->
                              <div id="hp-activity-feed-block" style="flex: 1; display: flex; flex-direction: column; height: 100%; border-radius: 28px; padding: 1.5rem; min-height: 0; overflow: hidden; background: white; border: 1px solid rgba(0,0,0,0.03);">
                                 <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-shrink: 0;">
                                      <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 600; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 10px; letter-spacing: -0.02em;">
                                          <div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255, 255, 255, 0.4); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);"><span class="material-icons-round" style="color: #64748b; font-size: 18px;">rss_feed</span></div>Feed
                                      </h3>
                                      <div id="hp-feed-tabs-container" style="display: flex; gap: 4px; background: rgba(0,0,0,0.03); padding: 4px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.02);"></div>
                                 </div>
                                 <div id="hp-feed-content" class="custom-scrollbar" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding-right: 8px; min-height: 0;"></div>
                              </div>
                         </div>

                     </div>
                     ` : `
                      <!-- ==================== PARTNER / ADMIN ==================== -->
                      <!-- 3 COLUMNS FLEX GRID -->
                      <div class="hp-dash-partner-main" style="padding-bottom: 0;">
                          
                          <!-- Col 1: Commesse -->
                          <div id="hp-pm-spaces-main-block" style="display: flex; flex-direction: column; height: 100%; min-height: 0;">
                             <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 1.25rem; flex-shrink: 0;">
                                  <div style="display: flex; justify-content: space-between; align-items: center; padding-left: 8px;">
                                      <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 600; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 10px; letter-spacing: -0.01em;">
                                          <div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255, 255, 255, 0.6); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);"><span class="material-icons-round" style="color: #64748b; font-size: 18px;">dashboard</span></div>
                                          Le mie Commesse
                                      </h3>
                                      ${showAccountPmToggle ? `
                                      <div style="display: flex; gap: 6px; background: rgba(0,0,0,0.03); padding: 4px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.02); margin-right: 8px;">
                                        <button id="hp-filter-account" class="hp-filter-pill active" onclick="togglePmFilter('account')" style="font-family: 'Outfit', sans-serif; padding: 4px 10px; border-radius: 7px; border: none; font-size: 0.65rem; font-weight: 700; cursor: pointer; transition: all 0.2s; background: transparent; color: #64748b;">ACCOUNT</button>
                                        <button id="hp-filter-pm" class="hp-filter-pill active" onclick="togglePmFilter('pm')" style="font-family: 'Outfit', sans-serif; padding: 4px 10px; border-radius: 7px; border: none; font-size: 0.65rem; font-weight: 700; cursor: pointer; transition: all 0.2s; background: transparent; color: #64748b;">PM</button>
                                      </div>
                                      ` : ''}
                                  </div>
                                  <!-- STATS BAR RESTORED -->
                                  <div id="hp-projects-stats-bar" style="display: flex; align-items: center; justify-content: space-between; padding: 0.45rem 0.65rem; margin-bottom: 0.75rem; flex-shrink: 0; background: rgba(255,255,255,0.4); border-radius: 14px; border: 1px solid rgba(255,255,255,0.5);">
                                       <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                                           <span style="font-size: 0.55rem; font-weight: 700; color: #3b82f6; letter-spacing: 0.05em; opacity: 0.8; text-transform: uppercase;">COMMESSE</span>
                                           <span id="stat-count-projects" style="font-size: 1.25rem; font-weight: 800; color: #3b82f6; line-height: 1;">0</span>
                                       </div>
                                       <div style="width: 1px; height: 24px; background: rgba(0,0,0,0.06); margin: 0 8px;"></div>
                                       <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                                           <span style="font-size: 0.55rem; font-weight: 700; color: #475569; letter-spacing: 0.05em; opacity: 0.8; text-transform: uppercase;">ATTIVITÀ</span>
                                           <span id="stat-count-activities" style="font-size: 1.25rem; font-weight: 800; color: #1e293b; line-height: 1;">0</span>
                                       </div>
                                       <div style="width: 1px; height: 24px; background: rgba(0,0,0,0.06); margin: 0 8px;"></div>
                                       <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                                           <span style="font-size: 0.55rem; font-weight: 700; color: #475569; letter-spacing: 0.05em; opacity: 0.8; text-transform: uppercase;">TASK</span>
                                           <span id="stat-count-tasks" style="font-size: 1.25rem; font-weight: 800; color: #1e293b; line-height: 1;">0</span>
                                       </div>
                                       <div style="width: 1px; height: 24px; background: rgba(0,0,0,0.06); margin: 0 8px;"></div>
                                       <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                                           <span style="font-size: 0.55rem; font-weight: 700; color: #10b981; letter-spacing: 0.05em; opacity: 0.8; text-transform: uppercase;">APPUNTAMENTI</span>
                                           <span id="stat-count-events" style="font-size: 1.25rem; font-weight: 800; color: #10b981; line-height: 1;">0</span>
                                       </div>
                                  </div>
                             </div>
                             <div id="hp-pm-spaces-main-list" class="custom-scrollbar" style="flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; overflow-x: hidden; padding: 4px 8px 60px 8px; min-height: 0;"></div>
                          </div>

                          <!-- Col 2: Attività Interne -->
                          <div id="hp-internal-dashboard-block" style="display: flex; flex-direction: column; height: 100%; min-height: 0;">
                               <div style="display: flex; justify-content: space-between; align-items: center; padding-left: 8px; margin-bottom: 1.25rem; flex-shrink: 0;">
                                  <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 600; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 10px; letter-spacing: -0.01em;">
                                      <div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255, 255, 255, 0.6); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);"><span class="material-icons-round" style="color: #64748b; font-size: 18px;">business_center</span></div>
                                      Attività interne
                                  </h3>
                               </div>
                               <div style="flex-shrink: 0;">
                                   <div id="hp-internal-hubs-buttons" style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 24px; scrollbar-width: none; -ms-overflow-style: none; padding-top: 4px; flex-shrink: 0;"></div>
                               </div>
                               <div id="hp-internal-clusters-grid" class="custom-scrollbar" style="flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; align-content: start; overflow-y: auto; padding-bottom: 2rem; min-height: 0;"></div>
                          </div>

                          <!-- Col 3: FEED & ALERTS -->
                          <div style="display: flex; flex-direction: column; gap: 1rem; height: 820px; min-height: 0;">
                              <!-- ALERT BLOCK -->
                              <div id="hp-accounting-alerts-block" style="display: none; flex-direction: column; background: white; border-radius: 28px; padding: 1.5rem; border: 1px solid rgba(0,0,0,0.03); flex-shrink: 0;">
                                  <div class="flex-start" style="gap: 12px; align-items: center; margin-bottom: 1rem;">
                                      <div style="width: 36px; height: 36px; border-radius: 12px; background: rgba(255, 255, 255, 0.4); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);"><span class="material-icons-round" style="color: #64748b; font-size: 20px;">notifications_active</span></div>
                                      <h4 style="font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 600; color: #1e293b; margin: 0; letter-spacing: -0.02em;">Alert Amministrazione</h4>
                                  </div>
                                  <div id="hp-admin-alert-list" style="display: flex; flex-direction: column; gap: 4px;"></div>
                              </div>

                              <!-- FEED BLOCK -->
                              <div id="hp-activity-feed-block" style="flex: 1; display: flex; flex-direction: column; border-radius: 28px; padding: 1.5rem; min-height: 0; background: white; border: 1px solid rgba(0,0,0,0.03); overflow: hidden;">
                                 <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-shrink: 0;">
                                      <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 600; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 10px; letter-spacing: -0.02em;">
                                          <div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255, 255, 255, 0.4); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);"><span class="material-icons-round" style="color: #64748b; font-size: 18px;">rss_feed</span></div>Feed
                                      </h3>
                                      <div id="hp-feed-tabs-container" style="display: flex; gap: 4px; background: rgba(0,0,0,0.03); padding: 4px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.02);"></div>
                                 </div>
                                 <div id="hp-feed-content" class="custom-scrollbar" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding-right: 8px; min-height: 0;"></div>
                              </div>
                          </div>
                      </div>
                      `}
                 </div> <!-- End hp-main-columns-container -->
                 
            </div> <!-- End main-content-area -->
              <!-- 3. MOBILE OVERLAY POPUP (Journal's View) -->
              <div id="hp-mobile-agenda-popup" class="hp-mobile-agenda-pop" onclick="window.closeMobileAgenda()">
                <div onclick="event.stopPropagation()" style="background: white; width: 95%; max-width: 450px; border-radius: 30px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: hpPopSlide 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); max-height: 85vh;">
                    <!-- Popup Header -->
                    <div style="padding: 24px 24px 16px 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em;">Journal's View</h3>
                        <button onclick="window.closeMobileAgenda()" style="background: #f1f5f9; border: none; width: 40px; height: 40px; border-radius: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                            <span class="material-icons-round" style="font-size: 24px; color: #64748b;">close</span>
                        </button>
                    </div>
                    <!-- Popup Body (Dynamically populated) -->
                    <div id="hp-mobile-agenda-list" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0;">
                        <!-- Top Controls, Scrollable List, and Fixed Footer injected by syncHomepageActivities -->
                    </div>
                </div>
              </div>

              <style>
                @keyframes hpPopSlide {
                    from { opacity: 0; transform: translateY(40px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
              </style>
    `;

    // ── FIX: attacca il listener al bottone + subito dopo il render del DOM,
    //    PRIMA di qualsiasi altra logica — così funziona anche se errori
    //    successivi impediscono di raggiungere window.toggleHpQuickEntry. ──
    (() => {
        const addBtn = document.getElementById('hp-top-add-btn');
        if (!addBtn) return;
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Se la funzione window è già definita (render successivi), usala
            if (typeof window.toggleHpQuickEntry === 'function') {
                window.toggleHpQuickEntry(addBtn);
            } else {
                // Fallback minimo: apri drawer con pick contestuale
                openHubDrawer(null, null, null, 'task');
            }
        });
    })();

    // --- Interaction Logic ---
    // Store current date for timeline navigation
    window.homepageCurrentDate = new Date();
    window.homepageCollaboratorId = myCollab.id;
    window.hpView = 'daily'; // 'daily' | 'weekly'
    window.hpActivityFilter = 'task'; // Default to tasks
    
    window.openMobileAgenda = () => {
        const pop = document.getElementById('hp-mobile-agenda-popup');
        if (pop) {
            pop.style.display = 'flex';
            document.body.style.overflow = 'hidden'; 
            window.syncHomepageActivities();
        }
    };
    window.closeMobileAgenda = () => {
        const pop = document.getElementById('hp-mobile-agenda-popup');
        if (pop) {
            pop.style.display = 'none';
            document.body.style.overflow = ''; 
        }
    };

    window.toggleOverdueFilter = () => {
        window.hpShowOverdue = !window.hpShowOverdue;
        const btn = document.getElementById('hp-mobile-overdue-filter');
        if (btn) btn.style.color = window.hpShowOverdue ? '#ef4444' : '#94a3b8';
        window.syncHomepageActivities();
    };

    window.syncHomepageActivities = () => {
        if (!window.hpData) return;

        const date = window.homepageCurrentDate || new Date();
        let start = new Date(date);
        let end = new Date(date);

        if (window.hpView === 'weekly') {
            const day = start.getDay();
            const diff = start.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff); start.setHours(0, 0, 0, 0);
            end = new Date(start);
            end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
        } else if (window.hpView === 'tomorrow') {
            // Se siamo in hpView 'tomorrow', forziamo la data di domani rispetto a OGGI, 
            // a meno che non siamo già spostati su un'altra data specifica col picker.
            const today = new Date();
            start = new Date(today);
            start.setDate(today.getDate() + 1); start.setHours(0, 0, 0, 0);
            end = new Date(start); end.setHours(23, 59, 59, 999);
        } else {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        }

        // Filter Tasks from the master list (window.hpData.tasks contains all pending)
        const parseLocal = (s) => {
            if (!s) return null;
            try {
                if (typeof s === 'string' && s.includes('-') && s.length === 10) {
                    const parts = s.split('-');
                    return new Date(parts[0], parts[1] - 1, parts[2]);
                }
                const d = new Date(s);
                if (isNaN(d.getTime())) return null;
                d.setHours(0, 0, 0, 0);
                return d;
            } catch (e) { return null; }
        };

        const allTasks = window.hpData.tasks || [];
        const pmActivities = allTasks.filter(item => {
            const type = (item.raw_type || '').toLowerCase();
            return type.includes('attivit') || type.includes('activity');
        });
        const realTasksOnly = allTasks.filter(item => {
            const type = (item.raw_type || '').toLowerCase();
            return !(type.includes('attivit') || type.includes('activity'));
        });

        const toYMD = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        const startStr = toYMD(start);
        const todayStr = toYMD(new Date());
        const isTodayView = (startStr === todayStr) && (window.hpView === 'daily');

        const filteredRealTasks = realTasksOnly.filter(t => {
            if (!t.due_date) return false;
            const d = parseLocal(t.due_date);
            if (isTodayView) {
                if (window.hpShowOverdue) return d <= end;
                return d >= start && d <= end;
            }
            return d >= start && d <= end;
        });

        const filteredPmActivities = pmActivities.filter(t => {
            if (!t.due_date) return true; // Show undated activities in the list
            const d = parseLocal(t.due_date);
            return d >= start && d <= end;
        });

        // Davide wants ONLY tasks, no activities in the main list.
        // Sort tasks by due date (chronological)
        const combinedTasks = filteredRealTasks.sort((a, b) => {
            const dateA = a.due_date ? new Date(a.due_date) : new Date(0);
            const dateB = b.due_date ? new Date(b.due_date) : new Date(0);
            return dateA - dateB;
        });
        window.hpData.filteredTasks = combinedTasks;

        const actContainer = document.getElementById('hp-activities-list');
        if (actContainer) {
            renderMyActivities(actContainer, window.hpData.timers, combinedTasks, window.hpData.events, window.hpActivityFilter);
        }

        const overdueBadge = document.getElementById('hp-overdue-badge');
        const nowAtStartOfDay = new Date(); nowAtStartOfDay.setHours(0,0,0,0);
        const overdueCount = allTasks.filter(t => t.due_date && new Date(t.due_date) < nowAtStartOfDay && t.status !== 'done').length;

        const taskBadge = document.getElementById('hp-badge-task');
        const eventBadge = document.getElementById('hp-badge-event');
        const realTasksCount = filteredRealTasks.length; 

        // Calculate counts for the Current View Range (to prevent flickering)
        const filteredEventsList = (window.hpData?.events || []).filter(e => {
            if (!e.start) return false;
            const d = new Date(e.start);
            return d >= start && d <= end;
        });
        const countEvent = filteredEventsList.length;

        if (taskBadge) { 
            taskBadge.textContent = realTasksCount; 
            taskBadge.style.display = realTasksCount > 0 ? 'flex' : 'none'; 
        }
        if (eventBadge) { 
            eventBadge.textContent = countEvent; 
            eventBadge.style.display = countEvent > 0 ? 'flex' : 'none'; 
            eventBadge.style.background = '#8b5cf6';
        }

        // Update Overdue UI (Desktop)
        if (overdueBadge) {
            overdueBadge.textContent = overdueCount;
            overdueBadge.style.display = overdueCount > 0 ? 'flex' : 'none';
        }

        // --- MOBILE COUNTS FIX ---
        // These badges should reflect the SELECTED period (start to end), not always today.
        const bTasks = document.getElementById('hp-banner-count-tasks');
        const bEvents = document.getElementById('hp-banner-count-events');
        
        // Count tasks and events for the current range (start/end)
        const rangeTasksCount = combinedTasks.length;
        const rangeEventsCount = countEvent;

        if (bTasks) bTasks.textContent = rangeTasksCount;
        if (bEvents) bEvents.textContent = rangeEventsCount;

        // --- NEW POPUP STATS ---
        const popT = document.getElementById('hp-mobile-stat-tasks');
        const popE = document.getElementById('hp-mobile-stat-events');
        const popO = document.getElementById('hp-mobile-stat-overdue');
        const popOBox = document.getElementById('hp-mobile-stat-overdue-box');
        
        if (popT) popT.textContent = rangeTasksCount;
        if (popE) popE.textContent = rangeEventsCount;
        if (popO) {
            popO.textContent = overdueCount;
            if (popOBox) popOBox.style.display = overdueCount > 0 ? 'flex' : 'none';
        }

        const pContent = document.getElementById('hp-mobile-agenda-list');
        const pPopup = document.getElementById('hp-mobile-agenda-popup');
        
        if (pContent && pPopup && pPopup.style.display === 'flex') {
            const isTaskMode = (window.hpActivityFilter === 'task');
            const dayDesc = window.hpView === 'weekly' ? 'Prossimi Giorni' : (window.hpView === 'tomorrow' ? 'Domani' : 'Oggi');

            pContent.innerHTML = `
                <!-- 1. TOP CONTROLS (Sticky) -->
                <div style="padding: 20px 20px 10px 20px; flex-shrink: 0; border-bottom: 1px solid rgba(0,0,0,0.02);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                        <div style="flex: 1; background: #f8fafc; padding: 4px; border-radius: 12px; display: flex; gap: 4px; border: 1px solid #f1f5f9;">
                            <button onclick="window.setTimelineMode('today', true)" style="flex: 1; padding: 9px 4px; font-size: 0.7rem; font-weight: 700; border-radius: 9px; border: none; cursor: pointer; transition: all 0.2s; background: ${window.hpView === 'daily' ? 'white' : 'transparent'}; color: ${window.hpView === 'daily' ? '#1e293b' : '#64748b'}; box-shadow: ${window.hpView === 'daily' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none'}; border: ${window.hpView === 'daily' ? '1px solid #e2e8f0' : '1px solid transparent'};">OGGI</button>
                            <button onclick="window.setTimelineMode('tomorrow', true)" style="flex: 1; padding: 9px 4px; font-size: 0.7rem; font-weight: 700; border-radius: 9px; border: none; cursor: pointer; transition: all 0.2s; background: ${window.hpView === 'tomorrow' ? 'white' : 'transparent'}; color: ${window.hpView === 'tomorrow' ? '#1e293b' : '#64748b'}; box-shadow: ${window.hpView === 'tomorrow' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none'}; border: ${window.hpView === 'tomorrow' ? '1px solid #e2e8f0' : '1px solid transparent'};">DOMANI</button>
                            <button onclick="window.setTimelineMode('week', true)" style="flex: 1; padding: 9px 4px; font-size: 0.7rem; font-weight: 700; border-radius: 9px; border: none; cursor: pointer; transition: all 0.2s; background: ${window.hpView === 'weekly' ? 'white' : 'transparent'}; color: ${window.hpView === 'weekly' ? '#1e293b' : '#64748b'}; box-shadow: ${window.hpView === 'weekly' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none'}; border: ${window.hpView === 'weekly' ? '1px solid #e2e8f0' : '1px solid transparent'};">SETTIMANA</button>
                        </div>
                        <div style="position: relative; width: 42px; height: 42px; background: #f1f5f9; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 1px solid #e2e8f0;" onclick="event.stopPropagation()">
                             <span class="material-icons-round" style="color: #64748b; font-size: 20px;">event</span>
                             <input type="date" onchange="window.setHpAlternativeDate(this.value)" onclick="event.stopPropagation()" style="position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer;">
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                        <div style="display: flex; background: #f8fafc; padding: 4px; border-radius: 12px; gap: 4px; border: 1px solid #f1f5f9;">
                             <button onclick="window.setHpAltFilter('task')" style="position: relative; background: ${isTaskMode ? 'white' : 'transparent'}; color: ${isTaskMode ? '#3b82f6' : '#94a3b8'}; border: none; padding: 7px 10px; border-radius: 10px; display: flex; align-items: center; cursor: pointer; border: 1px solid ${isTaskMode ? '#e2e8f0' : 'transparent'}; box-shadow: ${isTaskMode ? '0 2px 5px rgba(0,0,0,0.05)' : 'none'};">
                                 <span class="material-icons-round" style="font-size: 20px;">check_circle</span>
                                 <span id="hp-mobile-pop-stat-tasks" style="position: absolute; top: -4px; right: -4px; background: #3b82f6; color: white; font-size: 0.6rem; font-weight: 800; padding: 1px 5px; border-radius: 10px; border: 2px solid white;">${rangeTasksCount}</span>
                             </button>
                             <button onclick="window.setHpAltFilter('event')" style="position: relative; background: ${!isTaskMode ? 'white' : 'transparent'}; color: ${!isTaskMode ? '#8b5cf6' : '#94a3b8'}; border: none; padding: 7px 10px; border-radius: 10px; display: flex; align-items: center; cursor: pointer; border: 1px solid ${!isTaskMode ? '#e2e8f0' : 'transparent'}; box-shadow: ${!isTaskMode ? '0 2px 5px rgba(0,0,0,0.05)' : 'none'};">
                                 <span class="material-icons-round" style="font-size: 20px;">calendar_today</span>
                                 <span id="hp-mobile-pop-stat-events" style="position: absolute; top: -4px; right: -4px; background: #8b5cf6; color: white; font-size: 0.6rem; font-weight: 800; padding: 1px 5px; border-radius: 10px; border: 2px solid white;">${rangeEventsCount}</span>
                             </button>
                        </div>
                        <div style="display: flex; gap: 16px; align-items: center;">
                            <div style="position: relative; cursor: pointer;" onclick="window.toggleOverdueFilter()">
                                <span id="hp-mobile-overdue-filter" class="material-icons-round" style="font-size: 24px; color: ${window.hpShowOverdue ? '#ef4444' : '#94a3b8'};">history</span>
                                <span id="hp-mobile-pop-stat-overdue" style="display: ${overdueCount > 0 ? 'block' : 'none'}; position: absolute; top: -4px; right: -6px; background: #ef4444; color: white; font-size: 0.6rem; font-weight: 800; padding: 1px 5px; border-radius: 10px; border: 2px solid white;">${overdueCount}</span>
                            </div>
                            <span class="material-icons-round" onclick="window.openPmItemDetails('NEW')" style="font-size: 26px; color: #3b82f6; cursor: pointer;">add_circle</span>
                        </div>
                    </div>
                </div>

                <!-- 2. SCROLLABLE CONTENT AREA -->
                <div style="flex: 1; overflow-y: auto; overflow-x: hidden; padding: 20px; min-height: 0;">
                    <div style="font-size: 0.72rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.08em;">
                        ${dayDesc}
                    </div>
                    <div id="hp-mobile-rows-container"></div>
                </div>

                <!-- 3. FIXED FOOTER (Sticky) -->
                <div style="padding: 16px 20px 24px 20px; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; background: white;">
                    <a href="#tasks-summary" onclick="window.closeMobileAgenda()" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #f8fafc; border-radius: 12px; text-decoration: none; color: #1e293b; font-size: 0.85rem; font-weight: 700; border: 1px solid #f1f5f9;">
                         <div style="display: flex; align-items: center; gap: 10px;">
                             <span class="material-icons-round" style="color: #3b82f6; font-size: 18px;">assignment</span>
                             Vai a tutte le mie Task
                         </div>
                         <span class="material-icons-round" style="font-size: 18px; color: #94a3b8;">chevron_right</span>
                    </a>
                    <a href="#agenda" onclick="window.closeMobileAgenda()" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #f8fafc; border-radius: 12px; text-decoration: none; color: #1e293b; font-size: 0.85rem; font-weight: 700; border: 1px solid #f1f5f9;">
                         <div style="display: flex; align-items: center; gap: 10px;">
                             <span class="material-icons-round" style="color: #8b5cf6; font-size: 18px;">calendar_month</span>
                             Vai all'Agenda completa
                         </div>
                         <span class="material-icons-round" style="font-size: 18px; color: #94a3b8;">chevron_right</span>
                    </a>
                </div>
            `;
            
            const rowsContainer = document.getElementById('hp-mobile-rows-container');
            if (rowsContainer) rowsContainer.style.overflowX = 'hidden'; 

            if (isTaskMode) {
                if (combinedTasks.length === 0) {
                    rowsContainer.innerHTML = `<div style="padding: 3rem 1rem; text-align: center; color: #94a3b8; font-size: 0.85rem; font-weight: 500;">
                        Nessuna task ${window.hpView === 'weekly' ? 'per questa settimana' : (window.hpView === 'tomorrow' ? 'per domani' : 'per oggi')}.
                    </div>`;
                } else {
                    rowsContainer.innerHTML = '';
                    combinedTasks.forEach(t => renderActivityRow(rowsContainer, t));
                }
            } else {
                const dayEvents = (window.hpData?.events || []).filter(e => {
                    if (!e.start) return false;
                    const d = new Date(e.start);
                    return d >= start && d <= end;
                }).sort((a, b) => new Date(a.start) - new Date(b.start));

                if (dayEvents.length === 0) {
                    rowsContainer.innerHTML = `<div style="padding: 3rem 1rem; text-align: center; color: #94a3b8; font-size: 0.85rem; font-weight: 500;">
                        Nessun appuntamento ${window.hpView === 'weekly' ? 'per questa settimana' : (window.hpView === 'tomorrow' ? 'domani' : 'oggi')}.
                    </div>`;
                } else {
                    rowsContainer.innerHTML = '';
                    dayEvents.forEach(e => renderActivityRow(rowsContainer, { ...e, isEvent: true, type: 'event' }));
                }
            }
        }
    };

    window.setHpAlternativeDate = (val) => {
        if (!val) return;
        const d = new Date(val);
        window.homepageCurrentDate = d;
        window.hpView = 'daily';
        
        // Use updateHomepageTimeline to refetch events for the specific date
        window.updateHomepageTimeline(window.homepageCurrentDate);
    };

    window.setTimelineMode = (mode, isMobile = false) => {
        if (mode === 'today') {
            window.hpView = 'daily';
            window.homepageCurrentDate = new Date();
        } else if (mode === 'tomorrow') {
            window.hpView = 'tomorrow';
            const d = new Date();
            d.setDate(d.getDate() + 1);
            window.homepageCurrentDate = d;
        } else if (mode === 'week') {
            window.hpView = 'weekly';
            // Current date remains as is, the view logic handles week range
        }
        
        // Refresh everything
        window.updateHomepageTimeline(window.homepageCurrentDate);
    };

    window.setHpAltFilter = (filter) => {
        window.hpActivityFilter = filter;
        window.syncHomepageActivities();
    };

    window.toggleHomepageView = (view) => {
        window.hpView = view;

        // UI Update
        const dailyBtn = document.getElementById('view-daily-btn');
        const weeklyBtn = document.getElementById('view-weekly-btn');
        if (view === 'daily') {
            if (dailyBtn) { dailyBtn.classList.add('active-pill'); dailyBtn.style.background = 'white'; dailyBtn.style.color = '#111'; }
            if (weeklyBtn) { weeklyBtn.classList.remove('active-pill'); weeklyBtn.style.background = 'transparent'; weeklyBtn.style.color = '#6b7280'; }
        } else {
            if (weeklyBtn) { weeklyBtn.classList.add('active-pill'); weeklyBtn.style.background = 'white'; weeklyBtn.style.color = '#111'; }
            if (dailyBtn) { dailyBtn.classList.remove('active-pill'); dailyBtn.style.background = 'transparent'; dailyBtn.style.color = '#6b7280'; }
        }

        window.updateHomepageTimeline(window.homepageCurrentDate);
        window.syncHomepageActivities(); // Added to ensure both sections stay in sync
    };

    // Function to update timeline and header date
    window.updateHomepageTimeline = async (date) => {
        const timelineWrapper = document.getElementById('hp-timeline-wrapper');
        const headerTitle = document.getElementById('page-title');
        const headerDate = document.getElementById('hp-date-description');

        // Determine Start/End based on View
        let start = new Date(date);
        let end = new Date(date);
        let dateText = '';

        if (window.hpView === 'weekly') {
            const day = start.getDay(); // 0 (Sun) - 6 (Sat)
            const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
            start.setDate(diff); start.setHours(0, 0, 0, 0);

            end = new Date(start);
            end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);

            const startStr = start.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
            const endStr = end.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
            dateText = `Settimana dal ${startStr} al ${endStr}.`;
        } else {
            // Daily
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            dateText = `Ecco cosa c'è in programma per ${date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}.`;
        }

        // Update header date (with null check)
        if (headerDate) headerDate.innerHTML = dateText;

        // Keep Greeting in sync (especially if time passed or name changed)
        let myCollab;
        if (state.impersonatedCollaboratorId) {
            myCollab = state.collaborators.find(c => c.id == state.impersonatedCollaboratorId);
        }
        
        const currentFirstName = getFirstName(myCollab, state.profile);
        const hours = new Date().getHours();
        let greeting = 'Buongiorno';
        if (hours >= 14 && hours < 19) greeting = 'Buon pomeriggio';
        else if (hours >= 19 || hours < 5) greeting = 'Buonasera';
        if (headerTitle) headerTitle.textContent = window.innerWidth <= 768 ? 'Gleeye' : `${greeting}, ${currentFirstName}!`;
        
        if (!timelineWrapper) {
            console.log("[Homepage] timelineWrapper not found, aborting update.");
            return;
        }

        timelineWrapper.innerHTML = `<div style="padding: 2rem; width: 100%; text-align: center; color: var(--text-tertiary);"><span class="loader small"></span> Caricamento...</div>`;

        try {
            // Parallel Fetch: Events + Availability + Google + Overrides
            // Now passing (id, start, end)
            const [events, rules, googleBusy, overrides] = await Promise.all([
                fetchDateEvents(window.homepageCollaboratorId, start, end),
                fetchAvailabilityRules(window.homepageCollaboratorId),
                fetchGoogleCalendarBusy(window.homepageCollaboratorId, start, end),
                fetchAvailabilityOverrides(window.homepageCollaboratorId) // from api.js
            ]);

            // Rules filtering needs to be smarter for weekly (pass all rules? or filter inside render?)
            // For now pass all rules, render logic handles day matching

            if (window.hpView === 'weekly') {
                renderWeeklyTimeline(timelineWrapper, events, start, rules, googleBusy, overrides);
            } else {
                // Determine day ID for Daily View
                const dayId = date.getDay();
                const dayRules = rules.filter(r => r.day_of_week === dayId);

                // FORCE VERTICAL TIMELINE
                renderVerticalTimeline(timelineWrapper, events, date, rules);

                // Auto-scroll to now if today
                if (new Date().toDateString() === date.toDateString()) {
                    const now = new Date();
                    const nowM = (now.getHours() * 60) + now.getMinutes();
                    const top = nowM * (80 / 60); // pxPerHour = 80
                    setTimeout(() => {
                        timelineWrapper.scrollTo({ top: top - 100, behavior: 'smooth' });
                    }, 500);
                }
            }

            // Sync My Activities Side Panel (Events Tab AND Tasks) with the new date/range
            if (window.hpData) {
                window.hpData.events = events;
                window.syncHomepageActivities();
            }

        } catch (e) {
            console.error(e);
            timelineWrapper.innerHTML = `<div style="color:red; text-align:center;">Errore caricamento</div>`;
        }
    };

    window.changeHomepageDate = (offset) => {
        window.homepageCurrentDate.setDate(window.homepageCurrentDate.getDate() + offset);
        window.updateHomepageTimeline(window.homepageCurrentDate);
    };

    window.resetHomepageDate = () => {
        window.homepageCurrentDate = new Date();
        window.updateHomepageTimeline(window.homepageCurrentDate);
    };

    // --- MODE SWITCHER LOGIC ---
    window.setHomepageMode = (mode) => {
        // 1. Visual Update
        const modes = ['today', 'tomorrow', 'week'];
        modes.forEach(m => {
            const btn = document.getElementById('btn-mode-' + m);
            if (btn) {
                if (m === mode) {
                    btn.classList.add('active-pill');
                    btn.style.background = 'white';
                    btn.style.color = '#111';
                    btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                } else {
                    btn.classList.remove('active-pill');
                    btn.style.background = 'transparent';
                    btn.style.color = '#6b7280';
                    btn.style.boxShadow = 'none';
                }
            }
        });

        // 2. Logic Update
        if (mode === 'today') {
            window.hpView = 'daily';
            window.homepageCurrentDate = new Date();
        } else if (mode === 'tomorrow') {
            window.hpView = 'tomorrow';
            const d = new Date();
            d.setDate(d.getDate() + 1);
            window.homepageCurrentDate = d;
        } else if (mode === 'week') {
            window.hpView = 'weekly';
        }
        
        window.updateHomepageTimeline(window.homepageCurrentDate);
    };

    window.toggleHpOverdue = () => {
        window.hpShowOverdue = !window.hpShowOverdue;
        
        // Update ONLY the task list, not the whole agenda
        if (window.syncHomepageActivities) {
            window.syncHomepageActivities();
        }
    };

    window.setHpAltFilter = (filter) => {
        window.hpActivityFilter = filter;
        
        // Update UI
        const taskBtn = document.getElementById('hp-filter-task');
        const eventBtn = document.getElementById('hp-filter-event');
        const taskLink = document.getElementById('hp-task-list-link');
        const overdueToggle = document.getElementById('hp-overdue-toggle');

        if (taskBtn && eventBtn) {
            if (filter === 'task') {
                taskBtn.style.background = '#fff'; taskBtn.style.color = '#8b5cf6'; taskBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'; taskBtn.style.borderColor = '#e2e8f0';
                eventBtn.style.background = 'transparent'; eventBtn.style.color = '#64748b'; eventBtn.style.boxShadow = 'none'; eventBtn.style.borderColor = 'transparent';
                if (taskLink) {
                    taskLink.textContent = 'Lista task';
                    taskLink.href = '#tasks-summary';
                }
                if (overdueToggle) overdueToggle.style.display = 'flex';
            } else {
                eventBtn.style.background = '#fff'; eventBtn.style.color = '#8b5cf6'; eventBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'; eventBtn.style.borderColor = '#e2e8f0';
                taskBtn.style.background = 'transparent'; taskBtn.style.color = '#64748b'; taskBtn.style.boxShadow = 'none'; taskBtn.style.borderColor = 'transparent';
                if (taskLink) {
                    taskLink.textContent = 'Vedi Agenda';
                    taskLink.href = '#agenda';
                }
                if (overdueToggle) overdueToggle.style.display = 'none';
            }
        }
        
        if (window.syncHomepageActivities) {
            window.syncHomepageActivities();
        }
    };

    // --- CUSTOM DATE PICKER ---
    window.hpPickerDate = new Date(); // Use window for global access

    window.toggleCustomDatePicker = (btn) => {
        const existing = document.getElementById('custom-datepicker-popover');
        if (existing) {
            existing.remove();
            return;
        }

        window.hpPickerDate = new Date(window.homepageCurrentDate);

        const rect = btn.getBoundingClientRect();
        const popoverWidth = 300;
        const popover = document.createElement('div');
        popover.id = 'custom-datepicker-popover';
        popover.className = 'glass-card';
        popover.style.cssText = `
            position: fixed;
            top: ${rect.bottom + 8}px;
            left: ${rect.right - popoverWidth}px;
            background: white;
            color: #1f2937;
            padding: 16px;
            border-radius: 12px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
            z-index: 9999;
            width: ${popoverWidth}px;
            border: 1px solid #e5e7eb;
            font-family: inherit;
        `;

        window.renderHpPickerCalendar(popover);
        document.body.appendChild(popover);

        setTimeout(() => {
            const closeHandler = (e) => {
                if (!popover.contains(e.target) && !btn.contains(e.target)) {
                    popover.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 0);
    };

    window.renderHpPickerCalendar = (container) => {
        const year = window.hpPickerDate.getFullYear();
        const month = window.hpPickerDate.getMonth();
        const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <button onclick="window.changeHpPickerMonth(-1)" style="background:transparent; border:none; color:#374151; cursor:pointer; padding:4px; border-radius:4px;">
                    <span class="material-icons-round">chevron_left</span>
                </button>
                <div style="font-weight: 700; font-size: 0.95rem; color:#111;">${monthNames[month]} ${year}</div>
                <button onclick="window.changeHpPickerMonth(1)" style="background:transparent; border:none; color:#374151; cursor:pointer; padding:4px; border-radius:4px;">
                    <span class="material-icons-round">chevron_right</span>
                </button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 8px;">
        `;

        const days = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
        days.forEach(d => {
            html += `<div style="text-align: center; font-size: 0.75rem; color: #9ca3af; font-weight: 600;">${d}</div>`;
        });
        html += `</div><div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">`;

        const firstDay = new Date(year, month, 1).getDay();
        const adjustedFirstDay = (firstDay === 0 ? 6 : firstDay - 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const currentSelected = window.homepageCurrentDate;

        for (let i = 0; i < adjustedFirstDay; i++) { html += `<div></div>`; }

        for (let i = 1; i <= daysInMonth; i++) {
            let bg = 'transparent';
            let color = '#374151';
            let weight = '500';
            if (i === currentSelected.getDate() && month === currentSelected.getMonth() && year === currentSelected.getFullYear()) {
                bg = '#8b5cf6'; color = 'white'; weight = '700';
            } else if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                bg = '#eff6ff'; color = '#3b82f6'; weight = '700';
            }

            html += `
                <button onclick="window.selectHpPickerDate(${i})" style="
                    width: 100%; aspect-ratio: 1; border: none; background: ${bg}; color: ${color};
                    border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: ${weight};
                    display: flex; align-items: center; justify-content: center;
                ">
                    ${i}
                </button>
            `;
        }
        html += `</div>`;
        container.innerHTML = html;
    };

    window.changeHpPickerMonth = (offset) => {
        window.hpPickerDate.setMonth(window.hpPickerDate.getMonth() + offset);
        const popover = document.getElementById('custom-datepicker-popover');
        if (popover) window.renderHpPickerCalendar(popover);
    };

    window.selectHpPickerDate = (day) => {
        const newDate = new Date(window.hpPickerDate.getFullYear(), window.hpPickerDate.getMonth(), day);
        const offset = newDate.getTimezoneOffset();
        const localDate = new Date(newDate.getTime() - (offset * 60 * 1000));
        const dateStr = localDate.toISOString().split('T')[0];
        window.updateHomepageDateFromInput(dateStr);
        const popover = document.getElementById('custom-datepicker-popover');
        if (popover) popover.remove();
    };

    // --- QUICK ENTRY MENU ---
    window.toggleHpQuickEntry = (btn) => {
        const existing = document.getElementById('hp-quick-entry-popover');
        if (existing) { existing.remove(); return; }

        const rect = btn.getBoundingClientRect();
        const popoverWidth = 260;
        const popover = document.createElement('div');
        popover.id = 'hp-quick-entry-popover';
        popover.className = 'glass-card';
        // Position: below the button, right-aligned
        const left = Math.max(8, rect.right - popoverWidth);
        popover.style.cssText = `
            position: fixed; top: ${rect.bottom + 8}px; left: ${left}px;
            background: white; color: #1f2937; padding: 8px; border-radius: 14px;
            box-shadow: 0 12px 32px rgba(0,0,0,0.12); z-index: 99999;
            width: ${popoverWidth}px; border: 1px solid #e5e7eb;
            display: flex; flex-direction: column; gap: 2px;
            font-family: 'Outfit', var(--font-base, sans-serif);
        `;

        // Helper: build a menu row
        const makeRow = (icon, color, title, subtitle, onClick, hasArrow = false) => {
            const row = document.createElement('div');
            row.style.cssText = `display: flex; align-items: center; gap: 10px; padding: 9px 10px; cursor: pointer; border-radius: 9px; transition: background 0.15s;`;
            row.onmouseover = () => { row.style.background = '#f5f7fa'; };
            row.onmouseout  = () => { row.style.background = 'transparent'; };
            row.onclick = onClick;
            row.innerHTML = `
                <div style="width: 30px; height: 30px; flex-shrink: 0; border-radius: 8px; background: ${color}18; color: ${color}; display: flex; align-items: center; justify-content: center;">
                    <span class="material-icons-round" style="font-size: 17px;">${icon}</span>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 700; font-size: 0.83rem; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</div>
                    <div style="font-size: 0.72rem; color: #9ca3af;">${subtitle}</div>
                </div>
                ${hasArrow ? '<span class="material-icons-round" style="font-size: 16px; color: #d1d5db;">chevron_right</span>' : ''}
            `;
            return row;
        };

        // Separator
        const sep = () => {
            const d = document.createElement('div');
            d.style.cssText = 'height: 1px; background: #f1f5f9; margin: 3px 0;';
            return d;
        };

        // --- Section label helper ---
        const label = (text) => {
            const d = document.createElement('div');
            d.style.cssText = 'font-size: 0.68rem; font-weight: 800; color: #9ca3af; letter-spacing: 0.06em; text-transform: uppercase; padding: 6px 10px 2px;';
            d.textContent = text;
            return d;
        };

        // ── TASK SECTION ─────────────────────────────────────────────────
        // Build list of recent/active spaces to pick from
        const spaces = (state.pm_spaces || [])
            .filter(s => s.status !== 'archived')
            .slice(0, 6); // max 6 spaces

        if (spaces.length > 0) {
            // "Nuova Task" header row — clicking shows sub-spaces inline
            let taskExpanded = false;
            let spacesContainer = null;

            const taskRow = makeRow('check_circle', '#3b82f6', 'Nuova Task', 'Scegli commessa o progetto', (e) => {
                e.stopPropagation();
                if (!taskExpanded) {
                    taskExpanded = true;
                    spacesContainer.style.display = 'flex';
                    taskRow.querySelector('.material-icons-round:last-child').textContent = 'expand_less';
                } else {
                    taskExpanded = false;
                    spacesContainer.style.display = 'none';
                    taskRow.querySelector('.material-icons-round:last-child').textContent = 'chevron_right';
                }
            }, true);
            popover.appendChild(taskRow);

            // Sub-list of spaces
            spacesContainer = document.createElement('div');
            spacesContainer.style.cssText = 'display: none; flex-direction: column; gap: 1px; padding: 0 4px;';
            spaces.forEach(space => {
                const isCommessa = space.type === 'commessa';
                const order = isCommessa ? (state.orders || []).find(o => o.id === space.ref_ordine) : null;
                const spaceName = order ? `#${order.order_number} ${order.title || space.name}` : (space.name || 'Progetto');
                const sub = makeRow(
                    isCommessa ? 'style' : 'folder_special',
                    isCommessa ? '#0ea5e9' : '#8b5cf6',
                    spaceName,
                    isCommessa ? 'Commessa' : 'Progetto interno',
                    () => { popover.remove(); openHubDrawer(null, space.id, null, 'task'); }
                );
                sub.style.paddingLeft = '14px';
                spacesContainer.appendChild(sub);
            });
            popover.appendChild(spacesContainer);

        } else {
            // No spaces yet — open drawer directly (user will pick inline)
            popover.appendChild(makeRow('check_circle', '#3b82f6', 'Nuova Task', 'Crea attività operativa', () => {
                popover.remove(); openHubDrawer(null, null, null, 'task');
            }));
        }

        popover.appendChild(sep());

        // ── APPOINTMENT ───────────────────────────────────────────────────
        popover.appendChild(makeRow('event', '#a855f7', 'Nuovo Appuntamento', 'Segna incontro o evento', () => {
            popover.remove(); openAppointmentDrawer();
        }));

        document.body.appendChild(popover);
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!popover.contains(e.target) && !btn.contains(e.target)) {
                    popover.remove(); document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 0);
    };

    // --- Background Data Fetch & Initial Load ---
    (async () => {
        console.log('[Homepage] htmlRole:', htmlRole, '| isCollaborator:', isCollaborator, '| tags:', normalizedTagsForHtml, '| impersonating:', !!state.impersonatedCollaboratorId);

        // Se collaboratorId non è disponibile, aspetta data:loaded e riprova
        const targetUserId = myCollab.user_id || state.session?.user?.id;
        const collaboratorId = myCollab.id;

        if (!collaboratorId && !targetUserId) {
            console.warn("[Homepage] No collaborator/user ID available yet. Waiting for data:loaded...");
            window.addEventListener('data:loaded', () => renderHomepageAlt(container), { once: true });
            return;
        }

        try {
            // Re-fetch data in background to populate and sync
            const { data: pmTasks, error: pmError } = await supabase
                .from('pm_items')
                .select(`
                    id, title, status, due_date, item_type,
                    parent_ref,
                    parent_task:parent_ref(id, title, item_type),
                    pm_spaces (
                        id, name, type, area, is_cluster, parent_ref,
                        orders (
                            order_number, 
                            title,
                            clients (id, business_name, client_code)
                        ),
                        cluster:parent_ref(id, name)
                    ),
                    pm_item_assignees!inner(user_ref, role),
                    all_assignees:pm_item_assignees(user_ref, role)
                `)
                .eq('pm_item_assignees.user_ref', targetUserId)
                .neq('status', 'done');

            if (pmError) console.error("PM Tasks fetch error:", pmError);

            const fetchedTasks = (pmTasks || []).map(t => {
                const myAssignment = t.pm_item_assignees.find(a => a.user_ref === targetUserId);
                const myRole = myAssignment ? myAssignment.role : 'viewer';
                const space = Array.isArray(t.pm_spaces) ? t.pm_spaces[0] : t.pm_spaces;
                const clients = space?.orders?.clients;
                let clientCode = '';
                if (clients) {
                    if (Array.isArray(clients)) { clientCode = clients[0]?.client_code || ''; } 
                    else { clientCode = clients.client_code || ''; }
                }
                let ord = space?.orders?.order_number || '';
                
                let breadcrumb = '';
                if (space) {
                    const path = [];
                    const cluster = Array.isArray(space.cluster) ? space.cluster[0] : space.cluster;
                    if (cluster && cluster.name) path.push(cluster.name);
                    if (space && space.name && (!cluster || space.name !== cluster.name)) path.push(space.name);
                    const pTask = Array.isArray(t.parent_task) ? t.parent_task[0] : t.parent_task;
                    if (pTask && pTask.title) path.push(pTask.title);
                    breadcrumb = path.join(' › ');
                }
                const rawType = (t.item_type || 'task').toLowerCase();
                return {
                    id: t.id, title: t.title, status: t.status, due_date: t.due_date,
                    parent_id: t.parent_ref, orders: space?.orders, breadcrumb: breadcrumb,
                    area: space?.area || '', space_type: (space?.type || '').toLowerCase(),
                    raw_type: rawType, type: 'pm_task', role: myRole, all_assignees: t.all_assignees || []
                };
            });

            const rangeEnd = new Date();
            rangeEnd.setDate(rangeEnd.getDate() + 30);

            // Fetch Payments & Invoices for Collaborator
            if (isCollaborator) {
                fetchCollaboratorPayments(myCollab.id).then(payData => {
                    renderCollaboratorPayments(payData);
                });
            }

            // Sync Timeline Initially
            rangeEnd.setDate(rangeEnd.getDate() + 14);
            const fetchedEvents = await fetchDateEvents(myId, new Date(), rangeEnd);

            // 1. Store data for filtering reference
            window.hpData = {
                timers: [],
                tasks: fetchedTasks,
                events: fetchedEvents,
                filteredTasks: fetchedTasks
            };

            // 2. Initial sync for activities
            window.syncHomepageActivities();

            // 3. Timeline (Default Today)
            window.updateHomepageTimeline(window.homepageCurrentDate);

            // 4. Role-Based Dispatch
            // We already parsed this above into 'normalizedTagsForHtml' and 'htmlRole'. We reuse it.
            const normalizedTags = normalizedTagsForHtml;
            const detectedRole = htmlRole;
            const actualTargetUserId = myCollab.user_id || state.session?.user?.id;
            
            await renderMainContent(container, detectedRole, {
                myTasks: fetchedTasks, events: fetchedEvents, activeTimers: [], myCollab, myId,
                normalizedTags, targetUserId: actualTargetUserId
            });

        } catch (e) {
            console.error("Home Data Load Error:", e);
        }
    })();

    // --- GLOBAL REFRESHER FOR DASHBOARD ---
    const setupRefresher = () => {
        const reload = () => {
            // Verify if the element is still in the DOM and visible
            if (!document.getElementById('hp-pm-spaces-main-block')) {
                document.removeEventListener('pm-item-changed', window._hpAltReloadHandler);
                document.removeEventListener('appointment-changed', window._hpAltReloadHandler);
                window._hpAltReloadHandler = null;
                return;
            }
            console.log("[Homepage] Refreshing dashboard data...");
            renderHomepageAlt(container);
        };

        // Prevent double registration
        if (window._hpAltReloadHandler) {
            document.removeEventListener('pm-item-changed', window._hpAltReloadHandler);
            document.removeEventListener('appointment-changed', window._hpAltReloadHandler);
        }
        window._hpAltReloadHandler = reload;
        document.addEventListener('pm-item-changed', reload);
        document.addEventListener('appointment-changed', reload);
    };
    setupRefresher();
}

// --- INTERNAL HUB/CLUSTER ENGINES ---
// fetchInternalHubsAndClusters extracted to ./homepage/data_fetchers.js
// renderInternalDashboard + initClusterSortable + renderMainContent (+ 5 dispatchers)
// + setupHomepageFeed + renderAssignments + renderProjects
// extracted to ./homepage/role_dispatchers.js (Fase split-monstro step 3)

// --- WEEKLY RENDER LOGIC ---

// renderWeeklyTimeline extracted to ./homepage/timeline.js (Fase split-monstro step 4)

// --- MAIN RENDER LOGIC ---

// renderMobileAgenda removed: dead code (defined but never called).

// renderTimeline removed: dead code (defined but never called in this file).
// Versions in homepage.js and personal_agenda.js are separate local functions.
// Window-bound global handlers extracted to ./homepage/global_handlers.js
// (imported at the top of this file for the side-effect assignments to window.*)


