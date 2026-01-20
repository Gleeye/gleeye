import { state } from '../modules/state.js?v=148';
import { supabase } from '../modules/config.js?v=148';
import { fetchCollaborators } from '../modules/api.js?v=148';

export function initLayout() {
    // Sidebar Toggle Logic
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            const icon = toggleBtn;
            if (sidebar.classList.contains('collapsed')) {
                icon.textContent = 'chevron_right';
                // Exit drill-down when collapsing
                exitDrillDown();
            } else {
                icon.textContent = 'chevron_left';
            }
        });
    }

    // Initialize Drill-Down Navigation
    initDrillDownNavigation();
}

function initDrillDownNavigation() {
    const navMenu = document.querySelector('.nav-menu');
    const hasSubmenuItems = Array.from(document.querySelectorAll('.has-submenu'));

    // Mark items for drill-down mode
    hasSubmenuItems.forEach(item => {
        item.classList.add('drill-mode');

        // Remove old submenu toggle behavior by cloning
        const newItem = item.cloneNode(true);
        item.parentNode.replaceChild(newItem, item);

        // Add drill-down click handler
        newItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Don't drill-down if sidebar is collapsed
            if (document.getElementById('sidebar').classList.contains('collapsed')) {
                return;
            }

            const submenuId = newItem.id.replace('-toggle', '-submenu');
            const submenu = document.getElementById(submenuId);

            if (submenu) {
                activateDrillDown(newItem, submenu);
            } else {
                console.warn('Submenu not found for:', submenuId);
            }
        });
    });

    // FORCE FIX: Ensure normal links work
    const normalLinks = document.querySelectorAll('.nav-item[href^="#"]:not(.has-submenu)');
    normalLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const target = link.getAttribute('href');
            console.log("Force clicking link:", target);
            if (target) {
                // Manually set hash to ensure navigation
                window.location.hash = target;
            }
        });
    });
}

function activateDrillDown(categoryItem, submenu) {
    const navMenu = document.querySelector('.nav-menu');
    const sidebar = document.getElementById('sidebar');

    // Get category name
    const categoryName = categoryItem.querySelector('span:not(.material-icons-round)').textContent;

    // Create secondary layer if it doesn't exist
    let secondaryLayer = navMenu.querySelector('.nav-layer.secondary');
    if (!secondaryLayer) {
        // Wrap existing nav items in primary layer
        const primaryLayer = document.createElement('div');
        primaryLayer.className = 'nav-layer primary';

        // Move all direct children of nav-menu to primary layer
        while (navMenu.firstChild) {
            primaryLayer.appendChild(navMenu.firstChild);
        }
        navMenu.appendChild(primaryLayer);

        // Create secondary layer
        secondaryLayer = document.createElement('div');
        secondaryLayer.className = 'nav-layer secondary';
        navMenu.appendChild(secondaryLayer);
    }

    // Build secondary menu content
    secondaryLayer.innerHTML = `
        <div class="nav-back">
            <span class="material-icons-round">arrow_back</span>
            <span>Indietro</span>
        </div>
        <div class="nav-category-title">${categoryName}</div>
    `;

    // Clone submenu items into secondary layer
    const submenuClone = submenu.cloneNode(true);
    submenuClone.classList.remove('hidden');
    secondaryLayer.appendChild(submenuClone);

    // Activate drill-down
    navMenu.classList.add('drilled-down');

    // Add back button handler
    const backBtn = secondaryLayer.querySelector('.nav-back');
    backBtn.addEventListener('click', () => {
        exitDrillDown();
    });

    // Re-attach click handlers to cloned nav items to ensure they work
    const clonedNavItems = submenuClone.querySelectorAll('.nav-item[data-target]');
    clonedNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Keep the drill-down open when navigating between sub-items
            // The router will handle the view change via hashchange
            console.log(`[DrillDown] Navigating to: ${item.getAttribute('href')}`);

            // Add a slight delay for visual feedback if needed, but don't exit
            setTimeout(() => {
                // Update active state manually in the drill-down view
                submenuClone.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            }, 50);
        });
    });
}

function exitDrillDown() {
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
        navMenu.classList.remove('drilled-down');
    }
}

export function renderSidebarProfile() {
    const profile = state.profile;
    const session = state.session;

    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    const avatarEl = document.getElementById('user-avatar');

    // Only require profile, session is optional (use profile.email as fallback)
    if (!profile) {
        console.warn('[Layout] renderSidebarProfile: No profile available yet');
        return;
    }

    let displayName = profile.full_name || session?.user?.email?.split('@')[0] || profile.email?.split('@')[0] || 'Utente';
    let displayRole = (profile.role || 'Guest');
    let displayAvatar = profile.avatar_url;

    // Check Impersonation
    if (state.impersonatedCollaboratorId) {
        const impersonatedUser = state.collaborators?.find(c => c.id === state.impersonatedCollaboratorId);
        if (impersonatedUser) {
            displayName = impersonatedUser.full_name;
            displayRole = 'Vedi come: ' + (impersonatedUser.role || 'Collaborator');
            displayAvatar = impersonatedUser.avatar_url;
        }
    }

    if (nameEl) nameEl.textContent = displayName;
    if (roleEl) roleEl.textContent = displayRole.charAt(0).toUpperCase() + displayRole.slice(1);

    if (avatarEl) {
        if (displayAvatar) {
            avatarEl.innerHTML = `<img src="${displayAvatar}" alt="Avatar">`;
        } else {
            const initial = displayName[0].toUpperCase();
            avatarEl.textContent = initial;
            avatarEl.style.background = 'var(--brand-gradient)';
            avatarEl.style.color = 'white';
        }
    }

    // Inject Exit Button if Impersonating
    const existingExitBtn = document.getElementById('exit-impersonation-btn');
    if (existingExitBtn) existingExitBtn.remove(); // clear old if exists

    if (state.impersonatedCollaboratorId) {
        const sidebar = document.getElementById('sidebar');
        // Insert a sticky button at bottom or distinct place
        const exitBtn = document.createElement('button');
        exitBtn.id = 'exit-impersonation-btn';
        exitBtn.className = 'secondary-btn full-width';
        exitBtn.style.cssText = `
            margin: 1rem; 
            background: #FFF3E0; 
            color: #E65100; 
            border: 1px solid #FFCC80;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 0.9rem;
        `;
        exitBtn.innerHTML = '<span class="material-icons-round">visibility_off</span> Esci dalla vista';

        exitBtn.onclick = () => {
            exitImpersonation();
        };

        // Append before profile section
        const profileSection = sidebar.querySelector('.user-profile');
        if (profileSection) {
            profileSection.parentNode.insertBefore(exitBtn, profileSection);
        }
    }

    // Attach click listener for User Panel (My Collaborator Profile)
    const userProfileEl = document.querySelector('.user-profile .user-info');
    const userAvatarEl = document.querySelector('.user-profile .avatar');

    const handleProfileClick = async () => {
        // Just navigate to profile, logic inside renderUserProfile handles who to show
        window.location.hash = 'profile';
    };

    if (userProfileEl) {
        userProfileEl.onclick = handleProfileClick;
        userProfileEl.style.cursor = 'pointer';
    }

    if (userAvatarEl) {
        userAvatarEl.onclick = handleProfileClick;
        userAvatarEl.style.cursor = 'pointer';
    }

    // Update Sidebar Appearance based on Role
    updateSidebarVisibility();
}

export function exitImpersonation() {
    state.impersonatedRole = null;
    state.impersonatedCollaboratorId = null;
    console.log("[Impersonation] Exited impersonation mode.");

    updateSidebarVisibility();
    renderSidebarProfile();

    // Remove the button
    const btn = document.getElementById('exit-impersonation-btn');
    if (btn) btn.remove();

    window.showAlert('Tornato alla vista Admin', 'success');
}

export function updateSidebarVisibility() {
    const activeRole = state.impersonatedRole || state.profile?.role;
    let userTags = state.profile?.tags || [];

    // If impersonating, use the tags of the impersonated collaborator
    if (state.impersonatedRole === 'collaborator' && state.impersonatedCollaboratorId) {
        const c = state.collaborators?.find(x => x.id == state.impersonatedCollaboratorId);
        if (c) {
            let tags = c.tags;
            if (typeof tags === 'string') {
                try { tags = JSON.parse(tags); } catch (e) { tags = tags.split(',').map(t => t.trim()); }
            }
            userTags = Array.isArray(tags) ? tags : [];
        } else {
            userTags = [];
        }
    }

    const isPrivilegedCollaborator = userTags.includes('Partner') || userTags.includes('Amministrazione');

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const adminBtn = document.getElementById('admin-settings-btn');
    const managementNav = sidebar.querySelector('#nav-management');
    const managementLabel = managementNav?.querySelector('.submenu-label');

    // Section containers (subgroups) inside management
    const accountingSection = document.querySelector('#accounting-toggle')?.closest('.nav-group');
    const anagraficheSection = document.querySelector('#anagrafiche-menu-toggle')?.closest('.nav-group');
    const tariffarioSection = document.querySelector('#tariffario-toggle')?.closest('.nav-group');

    // Generic items inside managementNav (e.g. Booking, Ordini)
    // We strictly control what is visible by default
    const genericItems = managementNav ? managementNav.querySelectorAll('a[data-target="dashboard"], a[data-target="assignments"], a[data-target="booking"]') : [];

    console.log(`[Sidebar] Updating visibility. Role: ${activeRole}, Privileged: ${isPrivilegedCollaborator}`);

    if (managementNav) {
        managementNav.classList.remove('hidden');

        if (activeRole === 'admin') {
            // Full access
            if (adminBtn) adminBtn.classList.remove('hidden');
            [accountingSection, anagraficheSection, tariffarioSection].forEach(s => s?.classList.remove('hidden'));
            genericItems.forEach(i => i.classList.remove('hidden'));
            if (managementLabel) managementLabel.classList.remove('hidden');
        } else if (isPrivilegedCollaborator) {
            // Partner / Amministrazione access
            if (adminBtn) adminBtn.classList.add('hidden');
            [accountingSection, anagraficheSection, tariffarioSection].forEach(s => s?.classList.remove('hidden'));

            // Explicitly HIDE Ordini and Incarichi for now as requested
            managementNav.querySelectorAll('a[data-target="dashboard"], a[data-target="assignments"]').forEach(i => i.classList.add('hidden'));

            // SHOW Booking
            const bookingLink = managementNav.querySelector('a[data-target="booking"]');
            if (bookingLink) bookingLink.classList.remove('hidden');

            if (managementLabel) managementLabel.classList.remove('hidden');
        } else {
            // Standard Collaborator
            if (adminBtn) adminBtn.classList.add('hidden');

            // Hide sensitive sections
            [accountingSection, anagraficheSection, tariffarioSection].forEach(s => s?.classList.add('hidden'));

            // Hide Ordini and Assignments global links for standard collaborators if desired, 
            // OR keep them if they are allowed. 
            // Based on previous user request, standard collabs usually only see Booking, Profile, Agenda.
            // Let's hide Ordini/Incarichi from sidebar to keep it clean, as they use "I miei Incarichi"
            managementNav.querySelectorAll('a[data-target="dashboard"], a[data-target="assignments"]').forEach(i => i.classList.add('hidden'));

            // ENABLE Booking
            const bookingLink = managementNav.querySelector('a[data-target="booking"]');
            if (bookingLink) bookingLink.classList.remove('hidden');

            // Manage label visibility
            if (managementLabel) {
                // Show label only if booking is visible
                bookingLink ? managementLabel.classList.remove('hidden') : managementLabel.classList.add('hidden');
            }
        }
    }

    // Handle Admin Section Visibility (if distinct)
    const adminNav = sidebar.querySelector('#nav-admin');
    if (adminNav) {
        activeRole === 'admin' ? adminNav.classList.remove('hidden') : adminNav.classList.add('hidden');
    }
}
