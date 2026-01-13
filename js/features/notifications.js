/**
 * Notification System for Gleeye ERP
 * Handles real-time notifications via Supabase Realtime
 */

import { supabase } from '../modules/config.js?v=116';
import { state } from '../modules/state.js?v=116';

// State
let notifications = [];
let unreadCount = 0;
let subscription = null;
let isDropdownOpen = false;

/**
 * Initialize the notification system
 */
export async function initNotifications() {
    // Only init if user is logged in
    if (!state.user) {
        console.log('Notifications: No user, skipping init');
        return;
    }

    await fetchNotifications();
    subscribeToRealtime();
    renderNotificationBell();
    setupEventListeners();
}

/**
 * Fetch existing notifications for current user
 */
async function fetchNotifications() {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        notifications = data || [];
        unreadCount = notifications.filter(n => !n.is_read).length;
        updateBadge();
    } catch (err) {
        console.error('Error fetching notifications:', err);
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
        .channel('notifications-channel')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications'
            },
            (payload) => {
                console.log('New notification received:', payload.new);
                handleNewNotification(payload.new);
            }
        )
        .subscribe((status) => {
            console.log('Notification subscription status:', status);
        });
}

/**
 * Handle incoming real-time notification
 */
function handleNewNotification(notification) {
    // Add to beginning of array
    notifications.unshift(notification);
    unreadCount++;

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
                <div class="notification-empty">Nessuna notifica</div>
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
 * Render the notification list
 */
function renderNotificationList() {
    const list = document.getElementById('notification-list');
    if (!list) return;

    if (notifications.length === 0) {
        list.innerHTML = '<div class="notification-empty">Nessuna notifica</div>';
        return;
    }

    list.innerHTML = notifications.map(n => `
        <div class="notification-item ${n.is_read ? 'read' : 'unread'}" data-id="${n.id}">
            <div class="notification-icon ${getIconClass(n.type)}">
                <span class="material-icons-round">${getIcon(n.type)}</span>
            </div>
            <div class="notification-content">
                <div class="notification-title">${escapeHtml(n.title)}</div>
                <div class="notification-message">${escapeHtml(n.message || '')}</div>
                <div class="notification-time">${formatTime(n.created_at)}</div>
            </div>
            ${!n.is_read ? '<div class="notification-unread-dot"></div>' : ''}
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
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;

    try {
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
    } catch (err) {
        console.error('Error marking all as read:', err);
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
