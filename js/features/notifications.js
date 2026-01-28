/**
 * Notification System for Gleeye ERP
 * Handles real-time notifications via Supabase Realtime
 */

import { supabase } from '../modules/config.js?v=149';
import { state } from '../modules/state.js?v=149';

// State
let notifications = [];
let unreadCount = 0;
let subscription = null;
let isDropdownOpen = false;

/**
 * Initialize the notification system
 */
export async function initNotifications() {
    console.log('Notifications: Initializing...');

    // Only init if user is logged in
    if (!state.session) {
        console.warn('Notifications: No session found during init, waiting 1s...');
        setTimeout(initNotifications, 1000);
        return;
    }

    console.log(`Notifications: User ${state.session.user.email} verified. Fetching history...`);
    await fetchNotifications();
    subscribeToRealtime();
    renderNotificationBell();
}

/**
 * Fetch existing notifications for current user
 */
async function fetchNotifications() {
    try {
        // 1. Fetch latest 100 notifications (increased for center)
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        notifications = data || [];

        // 2. Fetch EXACT unread count from DB (more robust than filtering the limit)
        const { count, error: countError } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('is_read', false);

        if (countError) throw countError;
        unreadCount = count || 0;

        console.log(`Notifications: Fetched ${notifications.length} items, Unread count: ${unreadCount}`);
        updateBadge();
    } catch (err) {
        console.error('Notifications: Error fetching:', err);
    }
}

/**
 * Subscribe to real-time notifications
 */
function subscribeToRealtime() {
    // Clean up existing subscription
    if (subscription) {
        subscription.unsubscribe();
    }

    subscription = supabase
        .channel(`notifications-${state.session.user.id}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${state.session.user.id}`
            },
            (payload) => {
                console.log('Notifications: New realtime notification:', payload.new);
                handleNewNotification(payload.new);
            }
        )
        .subscribe((status) => {
            console.log(`Notifications: Subscription status for ${state.session.user.id}:`, status);
        });
}

/**
 * Handle incoming real-time notification
 */
function handleNewNotification(notification) {
    // Double check it's for us (though filter should handle it)
    if (notification.user_id !== state.session.user.id) {
        console.warn('Notifications: Received notification for different user:', notification.user_id);
        return;
    }

    // Check if already in list (avoid duplicates)
    if (notifications.some(n => n.id === notification.id)) return;

    console.log('Notifications: Handling new valid notification');
    // Add to beginning of array
    notifications.unshift(notification);

    // Recalculate unread count to be safe
    unreadCount = notifications.filter(n => !n.is_read).length;

    updateBadge();

    // If dropdown is open, re-render
    if (isDropdownOpen) {
        renderNotificationList();
    }

    // Show toast notification
    showToast(notification);
}

/**
 * Render the notification bell icon in header
 */
function renderNotificationBell() {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) {
        console.warn('Header actions not found for notification bell, retrying in 500ms...');
        setTimeout(renderNotificationBell, 500);
        return;
    }

    // Always ensure the container exists
    let bellContainer = document.getElementById('notification-container-wrapper');
    if (!bellContainer) {
        bellContainer = document.createElement('div');
        bellContainer.id = 'notification-container-wrapper';
        bellContainer.className = 'notification-container';

        // Prepended so it's the first icon in the list
        headerActions.prepend(bellContainer);
    }

    bellContainer.innerHTML = `
        <button id="notification-bell" class="notification-bell icon-btn" title="Notifiche">
            <span class="material-icons-round">notifications</span>
            <span id="notification-badge" class="notification-badge hidden">0</span>
        </button>
        <div id="notification-dropdown" class="notification-dropdown hidden">
            <div class="notification-header">
                <h4>Notifiche</h4>
                <button id="mark-all-read" class="notification-mark-all" title="Segna tutte come lette">
                    <span class="material-icons-round">done_all</span>
                </button>
            </div>
            <div id="notification-list" class="notification-list">
                <div class="notification-empty">Nessuna notifica non letta</div>
            </div>
            <div class="notification-footer">
                <a href="#notifications" class="view-all-btn">Vedi tutte</a>
            </div>
        </div>
    `;

    updateBadge();
    setupEventListeners(); // Re-bind after innerHTML replace
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Bell click - toggle dropdown
    const bell = document.getElementById('notification-bell');
    if (bell) {
        bell.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown();
        });
    }

    // Mark all as read
    const markAllBtn = document.getElementById('mark-all-read');
    if (markAllBtn) {
        markAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            markAllAsRead();
        });
    }

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        const container = document.querySelector('.notification-container');
        if (container && !container.contains(e.target)) {
            closeDropdown();
        }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDropdown();
        }
    });
}

/**
 * Toggle dropdown visibility
 */
function toggleDropdown() {
    const dropdown = document.getElementById('notification-dropdown');
    if (!dropdown) return;

    isDropdownOpen = !isDropdownOpen;
    dropdown.classList.toggle('hidden', !isDropdownOpen);

    if (isDropdownOpen) {
        renderNotificationList();
    }
}

/**
 * Close dropdown
 */
function closeDropdown() {
    const dropdown = document.getElementById('notification-dropdown');
    if (dropdown) {
        dropdown.classList.add('hidden');
        isDropdownOpen = false;
    }
}

/**
 * Render the notification list in dropdown
 */
function renderNotificationList() {
    const list = document.getElementById('notification-list');
    if (!list) return;

    // Priority: show unread first, then recent read ones
    const unreadNotifs = notifications.filter(n => !n.is_read);
    const readNotifs = notifications.filter(n => n.is_read);

    // Dropdown shows: all unread (up to 5) + recent read to fill 5 slots
    let itemsToShow = [...unreadNotifs.slice(0, 5)];
    if (itemsToShow.length < 5) {
        itemsToShow = [...itemsToShow, ...readNotifs.slice(0, 5 - itemsToShow.length)];
    }

    if (itemsToShow.length === 0) {
        list.innerHTML = `
            <div class="notification-empty">
                <span class="material-icons-round">notifications_none</span>
                <p>Nessuna notifica</p>
            </div>
        `;
        return;
    }

    list.innerHTML = itemsToShow.map(n => `
        <div class="notification-item ${n.is_read ? 'read' : 'unread'}" data-id="${n.id}">
            <div class="notification-icon ${getIconClass(n.type)}">
                <span class="material-icons-round">${getIcon(n.type)}</span>
            </div>
            <div class="notification-content">
                <div class="notification-title">${escapeHtml(n.title)}</div>
                <div class="notification-message">${escapeHtml(n.message || '')}</div>
                <div class="notification-time">${formatTime(n.created_at)}</div>
            </div>
            ${!n.is_read ? '<div class="notification-unread-indicator"></div>' : ''}
        </div>
    `).join('');

    // Add click listeners
    list.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', () => handleNotificationClick(item.dataset.id));
    });
}

/**
 * Handle notification click
 */
async function handleNotificationClick(id) {
    const notification = notifications.find(n => n.id === id);
    if (!notification) return;

    // Mark as read
    if (!notification.is_read) {
        await markAsRead(id);
    }

    // Navigate based on type
    if (notification.type === 'booking_new' && notification.data?.booking_id) {
        window.location.hash = '#booking';
    }

    closeDropdown();
}

/**
 * Mark a single notification as read
 */
async function markAsRead(id) {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);

        if (error) throw error;

        // Update local state
        const notification = notifications.find(n => n.id === id);
        if (notification && !notification.is_read) {
            notification.is_read = true;
            unreadCount = Math.max(0, unreadCount - 1);
            updateBadge();
            renderNotificationList();
        }
    } catch (err) {
        console.error('Error marking notification as read:', err);
    }
}

/**
 * Mark all notifications as read
 */
async function markAllAsRead() {
    try {
        // Get IDs of all unread notifications in our local state
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);

        if (unreadIds.length === 0) {
            console.log('Notifications: No unread notifications to mark');
            return;
        }

        // Update by explicit IDs - this is more robust than filtering by user_id
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .in('id', unreadIds);

        if (error) throw error;

        // Update local state
        notifications.forEach(n => n.is_read = true);
        unreadCount = 0;
        updateBadge();
        renderNotificationList();
        console.log(`Notifications: Marked ${unreadIds.length} as read`);
    } catch (err) {
        console.error('Notifications: Error marking all as read:', err);
    }
}

/**
 * Update the badge count
 */
function updateBadge() {
    const badge = document.getElementById('notification-badge');
    if (!badge) return;

    if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

/**
 * Show toast notification
 */
function showToast(notification) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.innerHTML = `
        <div class="toast-icon ${getIconClass(notification.type)}">
            <span class="material-icons-round">${getIcon(notification.type)}</span>
        </div>
        <div class="toast-content">
            <div class="toast-title">${escapeHtml(notification.title)}</div>
            <div class="toast-message">${escapeHtml(notification.message || '')}</div>
        </div>
        <button class="toast-close">
            <span class="material-icons-round">close</span>
        </button>
    `;

    // Add to DOM
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    container.appendChild(toast);

    // Animation in
    requestAnimationFrame(() => toast.classList.add('show'));

    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));

    // Auto remove after 5s
    setTimeout(() => removeToast(toast), 5000);
}

/**
 * Remove toast with animation
 */
function removeToast(toast) {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
}

// Utility functions
function getIcon(type) {
    const icons = {
        'booking_new': 'event_available',
        'booking_update': 'event_note',
        'booking_cancel': 'event_busy',
        'payment_due': 'payments',
        'payment_received': 'paid',
        'default': 'notifications'
    };
    return icons[type] || icons.default;
}

function getIconClass(type) {
    const classes = {
        'booking_new': 'type-booking',
        'booking_update': 'type-booking',
        'booking_cancel': 'type-cancel',
        'payment_due': 'type-payment',
        'payment_received': 'type-success',
        'default': 'type-default'
    };
    return classes[type] || classes.default;
}

function formatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ora';
    if (diffMins < 60) return `${diffMins} min fa`;
    if (diffHours < 24) return `${diffHours}h fa`;
    if (diffDays < 7) return `${diffDays}g fa`;

    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Render Notification Center Page
 */
export function renderNotificationCenter(container) {
    if (!container) return;

    // Filter states
    let filter = 'all'; // 'all', 'unread'

    container.innerHTML = `
        <div class="notification-center-container">
            <div class="notification-center-header">
                <h2>Notifiche</h2>
                <div class="notification-controls">
                    <div class="filter-tabs">
                        <button class="filter-tab active" data-filter="all">Tutte</button>
                        <button class="filter-tab" data-filter="unread">Da leggere</button>
                    </div>
                    <button id="center-mark-all" class="secondary-btn small">
                        <span class="material-icons-round">done_all</span>
                        Segna tutte come lette
                    </button>
                </div>
            </div>
            
            <div id="notification-center-list" class="notification-center-list">
                <!-- Items injected here -->
            </div>
        </div>
    `;

    const listContainer = container.querySelector('#notification-center-list');
    const tabs = container.querySelectorAll('.filter-tab');

    // Helper to group notifications by date
    const groupByDate = (items) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const groups = {
            today: [],
            yesterday: [],
            earlier: []
        };

        items.forEach(n => {
            const nDate = new Date(n.created_at);
            nDate.setHours(0, 0, 0, 0);

            if (nDate.getTime() === today.getTime()) {
                groups.today.push(n);
            } else if (nDate.getTime() === yesterday.getTime()) {
                groups.yesterday.push(n);
            } else {
                groups.earlier.push(n);
            }
        });

        return groups;
    };

    // Render a single notification item
    const renderItem = (n) => `
        <div class="nc-item ${n.is_read ? 'read' : 'unread'}" data-id="${n.id}">
            <div class="nc-item-icon ${getIconClass(n.type)}">
                <span class="material-icons-round">${getIcon(n.type)}</span>
            </div>
            <div class="nc-item-content">
                <div class="nc-header">
                    <span class="nc-title">${escapeHtml(n.title)}</span>
                    <span class="nc-time">${formatTime(n.created_at)}</span>
                </div>
                <div class="nc-message">${escapeHtml(n.message || '')}</div>
                ${n.data && n.type === 'booking_new' ? `
                    <div class="nc-actions">
                        <button class="text-btn small" onclick="window.location.hash='#booking'">Vedi Prenotazione</button>
                    </div>
                ` : ''}
            </div>
            ${!n.is_read ? `
                <button class="icon-btn small nc-read-btn" title="Segna come letta">
                    <span class="material-icons-round">check_circle_outline</span>
                </button>
            ` : ''}
        </div>
    `;

    // Render function for the list
    const renderList = () => {
        let items = notifications;
        if (filter === 'unread') {
            items = notifications.filter(n => !n.is_read);
        }

        if (items.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons-round">notifications_none</span>
                    <h3>${filter === 'unread' ? 'Tutto letto!' : 'Nessuna notifica'}</h3>
                    <p>${filter === 'unread' ? 'Non hai notifiche da leggere.' : 'Le tue notifiche appariranno qui.'}</p>
                </div>
            `;
            return;
        }

        const groups = groupByDate(items);
        let html = '';

        if (groups.today.length > 0) {
            html += `
                <div class="nc-date-section">
                    <div class="nc-date-header">Oggi</div>
                    ${groups.today.map(renderItem).join('')}
                </div>
            `;
        }

        if (groups.yesterday.length > 0) {
            html += `
                <div class="nc-date-section">
                    <div class="nc-date-header">Ieri</div>
                    ${groups.yesterday.map(renderItem).join('')}
                </div>
            `;
        }

        if (groups.earlier.length > 0) {
            html += `
                <div class="nc-date-section">
                    <div class="nc-date-header">Precedenti</div>
                    ${groups.earlier.map(renderItem).join('')}
                </div>
            `;
        }

        listContainer.innerHTML = html;

        // Attach events
        listContainer.querySelectorAll('.nc-item').forEach(item => {
            const readBtn = item.querySelector('.nc-read-btn');
            if (readBtn) {
                readBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    markAsRead(item.dataset.id).then(() => renderList());
                });
            }

            // Clicking the item itself also marks as read
            item.addEventListener('click', (e) => {
                if (e.target.closest('.nc-read-btn') || e.target.closest('.text-btn')) return;
                const id = item.dataset.id;
                const notif = notifications.find(n => n.id === id);
                if (notif && !notif.is_read) {
                    markAsRead(id).then(() => renderList());
                }
            });
        });
    };

    // Initial Render
    renderList();

    // Tab Logic
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            filter = tab.dataset.filter;
            renderList();
        });
    });

    // Mark All Logic
    const markAllBtn = container.querySelector('#center-mark-all');
    if (markAllBtn) {
        markAllBtn.addEventListener('click', async () => {
            await markAllAsRead();
            renderList();
        });
    }
}

/**
 * Cleanup on logout
 */
export function cleanupNotifications() {
    if (subscription) {
        subscription.unsubscribe();
        subscription = null;
    }
    notifications = [];
    unreadCount = 0;
    isDropdownOpen = false;

    const container = document.querySelector('.notification-container');
    if (container) container.remove();

    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) toastContainer.remove();
}

/**
 * Render Admin Notification Settings
 */
export function renderAdminNotifications(container) {
    if (!container) return;

    container.innerHTML = `
        <div class="admin-notifications-settings">
            <h3 style="margin-bottom: 1.5rem; color: var(--text-primary);">Configurazione Notifiche</h3>
            
            <div class="settings-card glass-card" style="padding: 1.5rem; margin-bottom: 2rem;">
                <h4 style="margin-bottom: 1rem; color: var(--text-primary);">Canali di Notifica</h4>
                
                <div class="setting-row" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-bottom: 1px solid var(--glass-border);">
                    <div>
                        <div style="font-weight: 500;">Email</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Ricevi notifiche importanti via email</div>
                    </div>
                    <label class="switch">
                        <input type="checkbox" checked>
                        <span class="slider round"></span>
                    </label>
                </div>

                <div class="setting-row" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-bottom: 1px solid var(--glass-border);">
                    <div>
                        <div style="font-weight: 500;">Push Browser</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Notifiche desktop quando l'app è aperta</div>
                    </div>
                    <label class="switch">
                        <input type="checkbox" checked>
                        <span class="slider round"></span>
                    </label>
                </div>

                <div class="setting-row" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 0;">
                    <div>
                        <div style="font-weight: 500;">Suoni</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Riproduci un suono all'arrivo di una notifica</div>
                    </div>
                    <label class="switch">
                        <input type="checkbox">
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>

            <div class="settings-card glass-card" style="padding: 1.5rem;">
                <h4 style="margin-bottom: 1rem; color: var(--text-primary);">Eventi Notificati</h4>
                
                <div class="checkbox-group" style="display: flex; flex-direction: column; gap: 0.8rem;">
                    <label class="checkbox-container" style="display: flex; align-items: center; gap: 0.8rem; cursor: pointer;">
                        <input type="checkbox" checked>
                        <span class="checkmark"></span>
                        <span style="color: var(--text-primary);">Nuove Prenotazioni</span>
                    </label>
                    <label class="checkbox-container" style="display: flex; align-items: center; gap: 0.8rem; cursor: pointer;">
                        <input type="checkbox" checked>
                        <span class="checkmark"></span>
                        <span style="color: var(--text-primary);">Scadenza Pagamenti</span>
                    </label>
                    <label class="checkbox-container" style="display: flex; align-items: center; gap: 0.8rem; cursor: pointer;">
                        <input type="checkbox" checked>
                        <span class="checkmark"></span>
                        <span style="color: var(--text-primary);">Nuovi Messaggi Chat</span>
                    </label>
                    <label class="checkbox-container" style="display: flex; align-items: center; gap: 0.8rem; cursor: pointer;">
                        <input type="checkbox" checked>
                        <span class="checkmark"></span>
                        <span style="color: var(--text-primary);">Assegnazione Incarichi</span>
                    </label>
                </div>
            </div>
            
            <div style="margin-top: 2rem; text-align: right;">
                <button class="primary-btn">Salva Modifiche</button>
            </div>
        </div>
    `;
}
