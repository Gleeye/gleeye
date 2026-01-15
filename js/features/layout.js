import { state } from '../modules/state.js?v=123';
import { supabase } from '../modules/config.js?v=123';
import { fetchCollaborators } from '../modules/api.js?v=123';

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
    const sidebar = document.getElementById('sidebar');
    const activeRole = state.impersonatedRole || state.profile?.role || 'collaborator';
    if (!sidebar) return;
    const managementNav = sidebar.querySelector('#nav-management');
    const managementLabel = managementNav?.querySelector('.submenu-label');

    console.log(`[Sidebar] Updating visibility for role: ${activeRole}`);

    if (managementNav) {
        // Always ensure the container is visible first, we'll manage children visibility
        managementNav.classList.remove('hidden');

        if (activeRole === 'admin') {
            // Admin sees everything - ensure all items are visible
            const allItems = managementNav.querySelectorAll('.nav-item, .nav-group');
            allItems.forEach(el => el.classList.remove('hidden'));
            if (managementLabel) managementLabel.classList.remove('hidden');
            console.log(`[Sidebar] Admin mode: showing all ${allItems.length} items`);
        } else {
            // Non-Admins (Collaborators, Accounts, Project Managers)

            // 1. Hide everything in management first
            const mgmtItems = managementNav.querySelectorAll('.nav-item, .nav-group');
            mgmtItems.forEach(el => el.classList.add('hidden'));
            // Also hide the label initially
            if (managementLabel) managementLabel.classList.add('hidden');

            // 2. Explicitly show allowed items
            // "Prenotazioni" is allowed for everyone
            const bookingLink = managementNav.querySelector('[data-target="booking"]');
            if (bookingLink) {
                bookingLink.classList.remove('hidden');
                // Also show the label since we have at least one visible item
                if (managementLabel) managementLabel.classList.remove('hidden');
                console.log(`[Sidebar] Non-admin mode: showing Prenotazioni link`);
            }

            // "Test Modulo" (if present)
            const testLink = managementNav.querySelector('[data-target="booking-test"]');
            if (testLink) testLink.classList.remove('hidden');
        }
    }

    // Personal Section is always visible by default structure

}
