import { state } from '../modules/state.js?v=156';
import { supabase } from '../modules/config.js?v=156';
import { fetchCollaborators } from '../modules/api.js?v=156';

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
            const targetHash = item.getAttribute('href');
            console.log(`[DrillDown] Navigating to: ${targetHash}`);

            if (targetHash) {
                window.location.hash = targetHash;
            }

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

// Helper to format names properly (Title Case)
const formatName = (str) => {
    if (!str) return 'Utente';
    // Handle emails or dot/underscore separators
    const clean = str.split('@')[0].replace(/[._]/g, ' ');
    return clean.split(' ')
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

// Role Priority Configuration
const ROLE_PRIORITY = {
    'Partner': 100,
    'Amministrazione': 90,
    'Account': 80,
    'Project Manager': 70,
    'Collaborator': 10
};

const getRoleConfig = (roleTag) => {
    // Normalize string to match keys
    const tag = Object.keys(ROLE_PRIORITY).find(k => k.toLowerCase() === roleTag?.toLowerCase()) || roleTag;

    switch (tag) {
        case 'Partner':
            return { label: 'PARTNER', icon: 'stars', style: 'color: #7C3AED; background: #F5F3FF; border: 1px solid #DDD6FE;', priority: 100 };
        case 'Amministrazione':
            return { label: 'AMMINISTRAZIONE', icon: 'analytics', style: 'color: #059669; background: #ECFDF5; border: 1px solid #A7F3D0;', priority: 90 };
        case 'Account':
            return { label: 'ACCOUNT', icon: 'manage_accounts', style: 'color: #EA580C; background: #FFF7ED; border: 1px solid #FFEDD5;', priority: 80 };
        case 'Project Manager':
            return { label: 'PROJECT MANAGER', icon: 'work', style: 'color: #475569; background: #F8FAFC; border: 1px solid #E2E8F0;', priority: 70 };
        case 'Collaborator':
        case 'Collaboratore':
            return { label: 'COLLABORATORE', icon: 'person', style: 'color: #64748b; background: #f1f5f9; border: 1px solid #e2e8f0;', priority: 10 };
        default:
            // Generic fallback for unknown tags
            return { label: tag.toUpperCase(), icon: 'label', style: 'color: #64748b; background: #f1f5f9; border: 1px solid #e2e8f0;', priority: 0 };
    }
};

export function renderSidebarProfile() {
    const profile = state.profile;
    const session = state.session;

    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    const avatarEl = document.getElementById('user-avatar');

    if (!profile) return;

    // --- 1. Display Name ---
    let displayName = formatName(profile.full_name || session?.user?.email);

    // --- 2. Data Extraction (Impersonation aware) ---
    // Is this user a Technical Admin? (System Level)
    let isTechAdmin = profile.role === 'admin';
    let userTags = [];
    let displayAvatar = profile.avatar_url;

    // Handle Impersonation
    if (state.impersonatedCollaboratorId) {
        const impersonatedUser = state.collaborators?.find(c => c.id === state.impersonatedCollaboratorId);
        if (impersonatedUser) {
            displayName = formatName(impersonatedUser.full_name);
            // In impersonation, we show the imp's tech role (usually none) and tags
            isTechAdmin = impersonatedUser.role === 'admin';
            displayAvatar = impersonatedUser.avatar_url;

            // Extract tags
            let iTags = impersonatedUser.tags || [];
            if (typeof iTags === 'string') {
                try { iTags = JSON.parse(iTags); } catch (e) { iTags = iTags.split(','); }
            }
            userTags = Array.isArray(iTags) ? iTags : [];
        }
    } else {
        // Normal profile tokens
        let rawTags = profile.tags || [];
        if (typeof rawTags === 'string') {
            try { rawTags = JSON.parse(rawTags); } catch (e) { rawTags = rawTags.split(','); }
        }
        userTags = Array.isArray(rawTags) ? rawTags : [];
    }

    // --- 3. Role Sorting & Logic ---
    // If user has no tags but is just a basic user, assume 'Collaborator' unless they are Tech Admin
    if (userTags.length === 0 && !isTechAdmin) {
        userTags.push('Collaborator');
    }

    // Map tags to configs
    const roleObjects = userTags.map(tag => getRoleConfig(tag.trim()));

    // Sort by priority DESC
    roleObjects.sort((a, b) => b.priority - a.priority);

    // --- 4. Render Name & Tech Admin Badge ---
    if (nameEl) {
        // Tech Admin Badge (Shield) next to name if applicable
        const adminBadge = isTechAdmin
            ? `<span title="Technical Admin" style="display: inline-flex; vertical-align: middle; margin-left: 6px; color: #2563EB; background: #EFF6FF; border-radius: 4px; padding: 2px;"><span class="material-icons-round" style="font-size: 14px;">verified_user</span></span>`
            : '';

        nameEl.innerHTML = `${displayName}${adminBadge}`;
    }

    // --- 5. Render Roles (Multi-badge) ---
    if (roleEl) {
        if (roleObjects.length > 0) {
            // Container with flex-row, align center
            const badgesHtml = roleObjects.map((role, index) => {
                const isPrimary = index === 0;

                if (isPrimary) {
                    // Primary: Badge with Text + Icon
                    return `
                        <span style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.03em; white-space: nowrap; ${role.style}">
                            <span class="material-icons-round" style="font-size: 14px;">${role.icon}</span>
                            ${role.label}
                        </span>`;
                } else {
                    // Secondary: Icon ONLY, circular/square based on style
                    return `
                        <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 6px; ${role.style} padding: 0;" title="${role.label}">
                             <span class="material-icons-round" style="font-size: 14px;">${role.icon}</span>
                        </span>`;
                }
            }).join('');

            // Flex container, single row (wrap only if needed)
            roleEl.innerHTML = `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 4px;">${badgesHtml}</div>`;
        } else {
            // Should rarely happen due to fallback
            roleEl.innerHTML = `<span style="font-size: 0.75rem; color: var(--text-tertiary);">---</span>`;
        }
    }

    // --- 6. Avatar ---
    if (avatarEl) {
        if (displayAvatar) {
            avatarEl.innerHTML = `<img src="${displayAvatar}" alt="Avatar">`;
        } else {
            const initial = displayName ? displayName[0].toUpperCase() : 'U';
            avatarEl.textContent = initial;
            avatarEl.style.background = 'var(--brand-gradient)';
            avatarEl.style.color = 'white';
        }
    }

    // Inject Exit Button if Impersonating
    const existingExitBtn = document.getElementById('exit-impersonation-btn');
    if (existingExitBtn) existingExitBtn.remove();

    if (state.impersonatedCollaboratorId) {
        const sidebar = document.getElementById('sidebar');
        const exitBtn = document.createElement('button');
        exitBtn.id = 'exit-impersonation-btn';
        exitBtn.className = 'secondary-btn full-width';
        exitBtn.style.cssText = `
            margin: 1rem; background: #FFF3E0; color: #E65100; border: 1px solid #FFCC80;
            display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.9rem;
        `;
        exitBtn.innerHTML = '<span class="material-icons-round">visibility_off</span> Esci dalla vista';
        exitBtn.onclick = () => exitImpersonation();

        const profileSection = sidebar.querySelector('.user-profile');
        if (profileSection) profileSection.parentNode.insertBefore(exitBtn, profileSection);
    }

    // Attach click listener
    const userProfileEl = document.querySelector('.user-profile .user-info');
    const userAvatarEl = document.querySelector('.user-profile .avatar');
    const handleProfileClick = async () => { window.location.hash = 'profile'; };

    if (userProfileEl) { userProfileEl.onclick = handleProfileClick; userProfileEl.style.cursor = 'pointer'; }
    if (userAvatarEl) { userAvatarEl.onclick = handleProfileClick; userAvatarEl.style.cursor = 'pointer'; }

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
    const isProjectManager = userTags.some(t => t.toLowerCase() === 'project manager' || t.toLowerCase() === 'pm');

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const adminBtn = document.getElementById('admin-settings-btn');
    const managementNav = sidebar.querySelector('#nav-management');
    const navPm = sidebar.querySelector('#nav-pm');
    const managementLabel = managementNav?.querySelector('.submenu-label');

    // Section containers (subgroups) inside management
    const accountingSection = document.querySelector('#accounting-toggle')?.closest('.nav-group');
    const anagraficheSection = document.querySelector('#anagrafiche-menu-toggle')?.closest('.nav-group');
    const tariffarioSection = document.querySelector('#tariffario-toggle')?.closest('.nav-group');

    // Generic items inside managementNav (e.g. Booking, Ordini)
    // We strictly control what is visible by default
    const genericItems = managementNav ? managementNav.querySelectorAll('a[data-target="dashboard"], a[data-target="assignments"], a[data-target="booking"]') : [];

    console.log(`[Sidebar] Updating visibility. Role: ${activeRole}, Privileged: ${isPrivilegedCollaborator}, PM: ${isProjectManager}`);

    // Project Management Section
    if (navPm) {
        if (activeRole === 'admin' || isProjectManager) {
            navPm.classList.remove('hidden');
        } else {
            navPm.classList.add('hidden');
        }
    }

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

            // HIDE Booking for standard users (unless Project Manager or specialized roll which is handled above or elsewhere)
            const bookingLink = managementNav.querySelector('a[data-target="booking"]');
            if (bookingLink) bookingLink.classList.add('hidden');

            // Manage label visibility
            if (managementLabel) {
                managementLabel.classList.add('hidden');
            }
        }
    }

    // Handle Admin Section Visibility (if distinct)
    const adminNav = sidebar.querySelector('#nav-admin');
    if (adminNav) {
        activeRole === 'admin' ? adminNav.classList.remove('hidden') : adminNav.classList.add('hidden');
    }
}
