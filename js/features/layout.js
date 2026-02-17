import { state } from '/js/modules/state.js';
import { supabase } from '../modules/config.js';
import { fetchCollaborators } from '../modules/api.js';

const navStack = [];

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
                exitDrillDown(true); // Force full exit
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
    if (!navMenu) return;

    // Attach listeners to primary layer items
    attachDrillDownListeners(navMenu);

    // FORCE FIX: Ensure normal links work
    delegateLinkClicks(navMenu);
}

function attachDrillDownListeners(container) {
    const hasSubmenuItems = container.querySelectorAll('.has-submenu');

    hasSubmenuItems.forEach(item => {
        // Remove existing listener to avoid duplicates if re-init
        const newItem = item.cloneNode(true);
        item.parentNode.replaceChild(newItem, item);

        newItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (document.getElementById('sidebar').classList.contains('collapsed')) {
                return;
            }

            // FIND SUBMENU RELATIVELY (Next sibling or within container)
            let submenu = newItem.nextElementSibling;
            if (submenu && !submenu.classList.contains('submenu')) {
                // Try to find it if there's a wrapper
                submenu = newItem.parentElement.querySelector('.submenu');
            }

            if (submenu && submenu.classList.contains('submenu')) {
                activateDrillDown(newItem, submenu);
            }
        });
    });
}

function delegateLinkClicks(container) {
    const normalLinks = container.querySelectorAll('.nav-item[href^="#"]:not(.has-submenu)');
    normalLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const target = link.getAttribute('href');
            if (target) {
                window.location.hash = target;
            }
        });
    });
}

function activateDrillDown(categoryItem, submenu) {
    const navMenu = document.querySelector('.nav-menu');
    const categoryName = categoryItem.querySelector('span:not(.material-icons-round)')?.textContent || 'Indietro';

    // If already in a drill-down, save current state to stack
    const secondaryLayer = navMenu.querySelector('.nav-layer.secondary');
    if (navMenu.classList.contains('drilled-down') && secondaryLayer) {
        navStack.push(secondaryLayer.innerHTML);
    }

    // Prepare primary layer if it doesn't exist
    if (!navMenu.querySelector('.nav-layer.primary')) {
        const primaryLayer = document.createElement('div');
        primaryLayer.className = 'nav-layer primary';
        while (navMenu.firstChild) {
            primaryLayer.appendChild(navMenu.firstChild);
        }
        navMenu.appendChild(primaryLayer);
    }

    // Create or clear secondary layer
    let secLayer = navMenu.querySelector('.nav-layer.secondary');
    if (!secLayer) {
        secLayer = document.createElement('div');
        secLayer.className = 'nav-layer secondary';
        navMenu.appendChild(secLayer);
    }

    // Build content
    secLayer.innerHTML = `
        <div class="nav-back">
            <span class="material-icons-round">arrow_back</span>
            <span>Indietro</span>
        </div>
        <div class="nav-category-title">${categoryName}</div>
    `;

    const submenuClone = submenu.cloneNode(true);
    // Remove IDs from the clone to prevent ID collisions and accidental visibility updates
    submenuClone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    submenuClone.classList.remove('hidden');
    secLayer.appendChild(submenuClone);

    // Re-attach listeners to cloned content
    attachDrillDownListeners(secLayer);
    delegateLinkClicks(secLayer);

    // Activate transition
    navMenu.classList.add('drilled-down');

    // Back button
    const backBtn = secLayer.querySelector('.nav-back');
    backBtn.addEventListener('click', () => exitDrillDown());
}

function exitDrillDown(forceFull = false) {
    const navMenu = document.querySelector('.nav-menu');
    const secondaryLayer = navMenu?.querySelector('.nav-layer.secondary');

    if (forceFull || navStack.length === 0) {
        navMenu.classList.remove('drilled-down');
        navStack.length = 0; // Clear stack
        if (secondaryLayer) secondaryLayer.innerHTML = ''; // Clear stale content
    } else {
        // Pop from stack and restore
        const prevState = navStack.pop();
        if (secondaryLayer) {
            secondaryLayer.innerHTML = prevState;
            // Re-attach listeners to the restored HTML
            attachDrillDownListeners(secondaryLayer);
            delegateLinkClicks(secondaryLayer);
            // Re-attach back button listener specifically
            const backBtn = secondaryLayer.querySelector('.nav-back');
            backBtn?.addEventListener('click', () => exitDrillDown());
        }
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

    const currentPrimary = sidebar.querySelector('.nav-layer.primary') || sidebar;
    const adminBtn = document.getElementById('admin-settings-btn');

    // Target groups ONLY within the primary layer (the source of truth)
    const navManagement = currentPrimary.querySelector('#nav-management');
    const navAccounting = currentPrimary.querySelector('#nav-accounting');
    const navPm = currentPrimary.querySelector('#nav-pm');

    // Management Section
    if (navManagement) {
        const toggle = navManagement.querySelector('#main-admin-toggle');
        if (activeRole === 'admin' || isPrivilegedCollaborator) {
            navManagement.classList.remove('hidden');
            if (toggle) toggle.classList.remove('hidden');
        } else {
            navManagement.classList.add('hidden');
        }
    }

    // Accounting Section
    if (navAccounting) {
        const toggle = navAccounting.querySelector('#main-accounting-toggle');
        if (activeRole === 'admin' || isPrivilegedCollaborator) {
            navAccounting.classList.remove('hidden');
            if (toggle) toggle.classList.remove('hidden');
            if (adminBtn) activeRole === 'admin' ? adminBtn.classList.remove('hidden') : adminBtn.classList.add('hidden');

            // Access control for specific items inside accounting (still applies even in drill-down)
            const ordini = navAccounting.querySelector('a[data-target="dashboard"]');
            const incarichi = navAccounting.querySelector('a[data-target="assignments"]');
            const booking = navAccounting.querySelector('a[data-target="booking"]');

            if (activeRole !== 'admin') {
                if (ordini) ordini.classList.add('hidden');
                if (incarichi) incarichi.classList.add('hidden');
                if (booking) booking.classList.toggle('hidden', !isPrivilegedCollaborator);
            } else {
                [ordini, incarichi, booking].forEach(i => i?.classList.remove('hidden'));
            }
        } else {
            navAccounting.classList.add('hidden');
        }
    }

    // PM Section
    if (navPm) {
        const toggle = navPm.querySelector('#main-pm-toggle');
        if (activeRole === 'admin' || isProjectManager) {
            navPm.classList.remove('hidden');
            if (toggle) toggle.classList.remove('hidden');
        } else {
            navPm.classList.add('hidden');
        }
    }

    // Settings Profile link
    const adminNav = currentPrimary.querySelector('#nav-admin');
    if (adminNav) {
        activeRole === 'admin' ? adminNav.classList.remove('hidden') : adminNav.classList.add('hidden');
    }
}
