/**
 * Notification System for Gleeye ERP
 * Handles real-time notifications via Supabase Realtime
 */

import { supabase } from '../modules/config.js?v=8000';
import { state } from '../modules/state.js?v=8000';

// State
let notifications = [];
let unreadCount = 0;
let subscription = null;
let isDropdownOpen = false;
const VAPID_PUBLIC_KEY = 'BNEWfpEPRK2FKhpvKk--ZUzvbDZt9tLVwpq4bAuK0FjAnW-NXh3fZcTDYDYcLwLOaxrj00EZwhdhpiQVS18w1d8';

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

    console.log(`Notifications: User ${state.session.user.id} verified. Fetching history...`);
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
export function renderNotificationBell() {
    const bellBtn = document.getElementById('notifications-btn');
    if (!bellBtn) {
        console.warn('Notifications button not found, retrying in 500ms...');
        setTimeout(renderNotificationBell, 500);
        return;
    }

    // Ensure we don't double render more than needed, but we need the dropdown
    let dropdown = document.getElementById('notification-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'notification-dropdown';
        dropdown.className = 'notification-dropdown hidden';
        // Append near the button's parent (header-actions)
        bellBtn.parentElement.appendChild(dropdown);
    }

    dropdown.innerHTML = `
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
    `;

    updateBadge();

    // Ensure listeners are only attached once to the static button
    if (!bellBtn._hasListener) {
        setupEventListeners();
        bellBtn._hasListener = true;
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Bell click - toggle dropdown
    const bell = document.getElementById('notifications-btn');
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
        const bell = document.getElementById('notifications-btn');
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown && !dropdown.contains(e.target) && bell && !bell.contains(e.target)) {
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
    } else if (notification.type === 'payment_received') {
        // Porta il collab alla vista personale incarichi dove vede il pagamento ricevuto.
        window.location.hash = '#my-assignments';
    } else if (notification.type === 'offer_accepted' && notification.data?.order_id) {
        // Porta direttamente al dettaglio della commessa appena accettata.
        window.location.hash = `#order-detail/${notification.data.order_id}`;
    } else if (notification.type === 'assignment_assigned' && notification.data?.assignment_id) {
        // Porta al dettaglio dell'incarico appena assegnato.
        window.location.hash = `#assignment-detail/${notification.data.assignment_id}`;
    } else if (notification.type === 'pm_item_blocked' && notification.data?.item_id) {
        // Apri il PM hub drawer sul task bloccato (route #pm/task/{id} apre il drawer sopra il PM dashboard).
        window.location.hash = `#pm/task/${notification.data.item_id}`;
    } else if (notification.type === 'client_payment_received' && notification.data?.order_id) {
        // Cassa in entrata: porta alla commessa per vedere lo stato pagamenti.
        window.location.hash = `#order-detail/${notification.data.order_id}`;
    } else if (notification.type === 'order_completed' && notification.data?.order_id) {
        // Commessa chiusa: porta alla scheda per innescare la fatturazione finale.
        window.location.hash = `#order-detail/${notification.data.order_id}`;
    } else if (notification.type === 'invoice_paid') {
        // Fattura attiva saldata: porta alla lista fatture attive (filtro saldate).
        window.location.hash = '#invoices';
    } else if (notification.type === 'pm_comment_added' && notification.data?.item_id) {
        // Nuovo commento su task: apri il drawer del task per leggerlo.
        window.location.hash = `#pm/task/${notification.data.item_id}`;
    }
    // Wave 2 navigation
    else if (notification.type === 'new_client' && notification.data?.client_id) {
        window.location.hash = `#client-detail/${notification.data.client_id}`;
    } else if (notification.type === 'new_collaborator' && notification.data?.collaborator_id) {
        window.location.hash = `#collaborator-detail/${notification.data.collaborator_id}`;
    } else if (notification.type === 'collaborator_deactivated' && notification.data?.collaborator_id) {
        window.location.hash = `#collaborator-detail/${notification.data.collaborator_id}`;
    } else if (notification.type === 'new_white_label_partner' && notification.data?.collaborator_id) {
        window.location.hash = `#white-label-partner-detail/${notification.data.collaborator_id}`;
    } else if (notification.type === 'iban_changed' && notification.data?.collaborator_id) {
        // IBAN cambiato: porta direttamente alla scheda per verificare anti-frode.
        window.location.hash = `#collaborator-detail/${notification.data.collaborator_id}`;
    } else if (notification.type === 'new_lead' && notification.data?.lead_id) {
        window.location.hash = `#lead-detail/${notification.data.lead_id}`;
    } else if (notification.type === 'lead_won' && notification.data?.lead_id) {
        window.location.hash = `#lead-detail/${notification.data.lead_id}`;
    } else if (notification.type === 'lead_lost' && notification.data?.lead_id) {
        window.location.hash = `#lead-detail/${notification.data.lead_id}`;
    } else if (notification.type === 'new_order' && notification.data?.order_id) {
        window.location.hash = `#order-detail/${notification.data.order_id}`;
    } else if (notification.type === 'contact_form_submission') {
        // Submission dal form pubblico: porta al gestionale form per vedere risposte.
        window.location.hash = '#contact-forms';
    } else if (notification.type === 'invoice_emitted') {
        window.location.hash = '#invoices';
    } else if (notification.type === 'passive_invoice_recorded' && notification.data?.collaborator_id) {
        // Per il collab: porta a my-assignments dove vedrà la fattura registrata.
        // Per i partner: porta alla lista fatture collab.
        window.location.hash = '#my-assignments';
    } else if (notification.type === 'assignment_completed' && notification.data?.assignment_id) {
        window.location.hash = `#assignment-detail/${notification.data.assignment_id}`;
    } else if (notification.type === 'task_assignee_added' && notification.data?.item_id) {
        window.location.hash = `#pm/task/${notification.data.item_id}`;
    } else if (notification.type === 'task_review_requested' && notification.data?.item_id) {
        window.location.hash = `#pm/task/${notification.data.item_id}`;
    } else if (notification.type === 'new_booking') {
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
    const bellBtn = document.getElementById('notifications-btn');
    if (!bellBtn) return;

    let badge = bellBtn.querySelector('.notification-badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'notification-badge hidden';
        bellBtn.appendChild(badge);
    }

    if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

/**
 * Show toast notification + (se disponibili) notifica nativa OS + ping sonoro.
 * Tutti i canali sono "best effort": se uno fallisce, gli altri continuano.
 */
function showToast(notification) {
    // 1) Toast in-app (sempre)
    const toast = document.createElement('div');
    toast.className = 'notification-toast notification-toast-clickable';
    toast.style.cursor = 'pointer';
    toast.innerHTML = `
        <div class="toast-icon ${getIconClass(notification.type)}">
            <span class="material-icons-round">${getIcon(notification.type)}</span>
        </div>
        <div class="toast-content">
            <div class="toast-title">${escapeHtml(notification.title)}</div>
            <div class="toast-message">${escapeHtml(notification.message || '')}</div>
        </div>
        <button class="toast-close" title="Chiudi">
            <span class="material-icons-round">close</span>
        </button>
    `;

    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    // Close button (non propagare il click al toast)
    toast.querySelector('.toast-close').addEventListener('click', (e) => {
        e.stopPropagation();
        removeToast(toast);
    });

    // Click sul toast → naviga (riusa la stessa logica del click in dropdown)
    toast.addEventListener('click', () => {
        handleNotificationClick(notification.id);
        removeToast(toast);
    });

    // Auto remove dopo 6s
    setTimeout(() => removeToast(toast), 6000);

    // 2) Ping sonoro (best effort — alcuni browser bloccano audio senza interazione utente)
    try {
        playNotificationPing();
    } catch (err) {
        // Audio bloccato dal browser, ok.
    }

    // 3) Notifica nativa OS via Notification API (funziona su desktop quando app aperta).
    // Diversa dalla push web del Service Worker: questa scatta SOLO se l'app è viva nel
    // browser. È utile sul desktop perché alza visibilità rispetto al solo toast in-app.
    try {
        if ('Notification' in window && Notification.permission === 'granted') {
            const n = new Notification(notification.title || 'Gleeye', {
                body: notification.message || '',
                icon: '/logo_gleeye_new.png',
                tag: `gleeye-${notification.id}`,  // evita duplicati se realtime ripete
                requireInteraction: false
            });
            n.onclick = () => {
                window.focus();
                handleNotificationClick(notification.id);
                n.close();
            };
        } else if ('Notification' in window && Notification.permission === 'default') {
            // Richiedi permesso silenziosamente UNA volta. Se l'utente nega, non insistiamo.
            Notification.requestPermission().catch(() => {});
        }
    } catch (err) {
        console.warn('[Notifications] Native OS notification failed:', err);
    }
}

/**
 * Breve ping sonoro non invasivo all'arrivo di una nuova notifica.
 * Usiamo Web Audio API per generare un tono breve, così evitiamo di dover
 * servire un file audio statico. Volume basso.
 */
let _audioCtx = null;
function playNotificationPing() {
    if (!_audioCtx && (window.AudioContext || window.webkitAudioContext)) {
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (!_audioCtx) return;
    const now = _audioCtx.currentTime;
    const osc = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.connect(gain);
    gain.connect(_audioCtx.destination);
    osc.type = 'sine';
    // Due toni brevi a salire (ping classico)
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.setValueAtTime(880, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.start(now);
    osc.stop(now + 0.2);
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
        'offer_accepted': 'celebration',
        'assignment_assigned': 'assignment_ind',
        'pm_item_blocked': 'block',
        'client_payment_received': 'savings',
        'order_completed': 'task_alt',
        'invoice_paid': 'request_quote',
        'pm_comment_added': 'forum',
        // Wave 2 (12/5/26)
        'new_client': 'business',
        'new_collaborator': 'group_add',
        'collaborator_deactivated': 'person_off',
        'new_white_label_partner': 'corporate_fare',
        'iban_changed': 'security',
        'new_lead': 'eco',
        'lead_won': 'emoji_events',
        'lead_lost': 'trending_down',
        'new_order': 'shopping_cart_checkout',
        'contact_form_submission': 'mark_email_unread',
        'invoice_emitted': 'receipt_long',
        'passive_invoice_recorded': 'inbox',
        'assignment_completed': 'task_alt',
        'task_assignee_added': 'group',
        'task_review_requested': 'preview',
        'new_booking': 'event_available',

        // PM Module
        'pm_space_created': 'folder_special',
        'pm_space_assigned': 'assignment_ind',
        'pm_item_created': 'add_task',
        'pm_item_status': 'published_with_changes',
        'pm_comment_added': 'forum',
        'pm_item_assigned': 'person_add',
        'pm_document_created': 'note_add',
        'pm_document_updated': 'edit_document',
        'pm_appointment_invited': 'event_available',

        // CRM Module
        'crm_new_lead': 'person_add_alt_1',
        'crm_lead_status': 'swap_horiz',
        'crm_contact_form': 'contact_mail',

        // Accounting Module
        'accounting_invoice_created': 'receipt',
        'accounting_invoice_overdue': 'event_busy',
        'accounting_payment_received': 'price_check',
        'accounting_bank_transaction': 'account_balance',

        // Admin Module
        'admin_new_user': 'manage_accounts',
        'admin_system_alert': 'warning',
        'admin_new_order': 'shopping_cart_checkout',

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
        'offer_accepted': 'type-success',
        'assignment_assigned': 'type-primary',
        'pm_item_blocked': 'type-cancel',
        'client_payment_received': 'type-success',
        'order_completed': 'type-success',
        'invoice_paid': 'type-success',
        'pm_comment_added': 'type-primary',
        // Wave 2
        'new_client': 'type-success',
        'new_collaborator': 'type-success',
        'collaborator_deactivated': 'type-cancel',
        'new_white_label_partner': 'type-success',
        'iban_changed': 'type-cancel',
        'new_lead': 'type-primary',
        'lead_won': 'type-success',
        'lead_lost': 'type-cancel',
        'new_order': 'type-success',
        'contact_form_submission': 'type-primary',
        'invoice_emitted': 'type-success',
        'passive_invoice_recorded': 'type-primary',
        'assignment_completed': 'type-success',
        'task_assignee_added': 'type-primary',
        'task_review_requested': 'type-payment',
        'new_booking': 'type-booking',

        // PM Module
        'pm_space_created': 'type-info',
        'pm_space_assigned': 'type-info',
        'pm_item_created': 'type-success',
        'pm_item_status': 'type-warning',
        'pm_comment_added': 'type-info',
        'pm_item_assigned': 'type-booking',
        'pm_document_created': 'type-primary',
        'pm_document_updated': 'type-info',
        'pm_appointment_invited': 'type-warning',

        // CRM Module
        'crm_new_lead': 'type-success',
        'crm_lead_status': 'type-info',
        'crm_contact_form': 'type-primary',

        // Accounting Module
        'accounting_invoice_created': 'type-info',
        'accounting_invoice_overdue': 'type-cancel',
        'accounting_payment_received': 'type-success',
        'accounting_bank_transaction': 'type-primary',

        // Admin Module
        'admin_new_user': 'type-info',
        'admin_system_alert': 'type-cancel',
        'admin_new_order': 'type-success',

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
                    <div style="display: flex; gap: 0.8rem;">
                        <button id="enable-push-btn" class="secondary-btn small" title="Ricevi notifiche push (cellulare e desktop)">
                            <span class="material-icons-round">notifications_active</span>
                            <span>Caricamento...</span>
                        </button>
                        <button id="center-mark-all" class="secondary-btn small">
                            <span class="material-icons-round">done_all</span>
                            Segna tutte come lette
                        </button>
                    </div>
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

    // Push Notification Logic
    const pushBtn = container.querySelector('#enable-push-btn');
    if (pushBtn) {
        updatePushBtnStatus(pushBtn);

        pushBtn.addEventListener('click', async () => {
            const isSubscribed = pushBtn.classList.contains('active');
            pushBtn.disabled = true;

            if (isSubscribed) {
                await unsubscribeFromPush();
            } else {
                await subscribeToPush();
            }

            updatePushBtnStatus(pushBtn);
            pushBtn.disabled = false;
        });
    }
}

/**
 * Update the push button text and class based on current subscription.
 * Se il browser non supporta push (es. iPhone Safari < 16.4 o tab non-PWA),
 * NON nascondiamo il bottone: lo lasciamo visibile in stato disabilitato con
 * un messaggio diagnostico. Così l'utente capisce DOVE attivare le push e
 * perché eventualmente non può.
 */
async function updatePushBtnStatus(btn) {
    const hasSW = 'serviceWorker' in navigator;
    const hasPush = 'PushManager' in window;

    if (!hasSW || !hasPush) {
        btn.disabled = true;
        btn.classList.remove('secondary-btn', 'success-btn', 'active');
        btn.classList.add('secondary-btn');
        btn.style.opacity = '0.55';
        btn.style.cursor = 'not-allowed';
        const labelEl = btn.querySelector('span:last-child');
        const iconEl = btn.querySelector('.material-icons-round');
        if (iconEl) iconEl.textContent = 'notifications_off';
        if (labelEl) {
            // Diagnostica chiara: iPhone su Safari standard NON ha PushManager.
            // Su iOS è necessario iOS 16.4+ e aprire l'app dalla schermata Home (PWA).
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            if (isIOS) {
                labelEl.textContent = 'iPhone: iOS 16.4+ e app aperta dalla home';
            } else if (!hasSW) {
                labelEl.textContent = 'Push non disponibili (Service Worker mancante)';
            } else {
                labelEl.textContent = 'Push non supportate in questo browser';
            }
        }
        btn.title = `Push non disponibili (serviceWorker=${hasSW}, PushManager=${hasPush})`;
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            btn.classList.add('active', 'success-btn');
            btn.classList.remove('secondary-btn');
            btn.querySelector('span:last-child').textContent = 'Notifiche Push Attive';
            btn.querySelector('.material-icons-round').textContent = 'notifications_active';
        } else {
            btn.classList.remove('active', 'success-btn');
            btn.classList.add('secondary-btn');
            btn.querySelector('span:last-child').textContent = 'Attiva Notifiche Push';
            btn.querySelector('.material-icons-round').textContent = 'notifications_none';
        }
    } catch (err) {
        console.error('[Push] Failed to check subscription status:', err);
        btn.disabled = true;
        btn.querySelector('span:last-child').textContent = 'Errore controllo push';
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
                        <input type="checkbox" id="push-toggle">
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
                    <label class="checkbox-container" style="display: flex; align-items: center; gap: 0.8rem; cursor: pointer; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed var(--glass-border);">
                        <input type="checkbox" checked>
                        <span class="checkmark"></span>
                        <span style="color: var(--text-primary);"><b>[PM]</b> Nuovi Progetti / Commesse</span>
                    </label>
                    <label class="checkbox-container" style="display: flex; align-items: center; gap: 0.8rem; cursor: pointer;">
                        <input type="checkbox" checked>
                        <span class="checkmark"></span>
                        <span style="color: var(--text-primary);"><b>[PM]</b> Assegnazione Task e Modifiche Stato</span>
                    </label>
                    <label class="checkbox-container" style="display: flex; align-items: center; gap: 0.8rem; cursor: pointer;">
                        <input type="checkbox" checked>
                        <span class="checkmark"></span>
                        <span style="color: var(--text-primary);"><b>[PM]</b> Nuovi Commenti sui Task</span>
                    </label>
                    <label class="checkbox-container" style="display: flex; align-items: center; gap: 0.8rem; cursor: pointer;">
                        <input type="checkbox" checked>
                        <span class="checkmark"></span>
                        <span style="color: var(--text-primary);"><b>[PM]</b> Nuovi Documenti e Appuntamenti</span>
                    </label>
                </div>
            </div>
            
            <div style="margin-top: 2rem; text-align: right;">
                <button class="primary-btn">Salva Modifiche</button>
            </div>
        </div>
    `;

    // Handle Toggles
    const pushToggle = container.querySelector('input[type="checkbox"][id="push-toggle"]');
    if (pushToggle) {
        // Initial state
        if ('Notification' in window) {
            pushToggle.checked = Notification.permission === 'granted';
        }

        pushToggle.addEventListener('change', async () => {
            if (pushToggle.checked) {
                const success = await subscribeToPush();
                if (!success) pushToggle.checked = false;
            } else {
                await unsubscribeFromPush();
            }
        });
    }
}

/**
 * Subscribe to Web Push Notifications
 */
export async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push Notifications not supported by this browser');
        return false;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            alert('Permesso per le notifiche negato.');
            return false;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        console.log('Push: Subscribed successfully:', subscription);

        // Store in DB
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id: state.session.user.id,
                endpoint: subscription.endpoint,
                p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))),
                auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth')))),
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, endpoint' });

        if (error) throw error;
        return true;
    } catch (err) {
        console.error('Push: Error subscribing:', err);
        return false;
    }
}

/**
 * Unsubscribe from Web Push
 */
export async function unsubscribeFromPush() {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();

            // Remove from DB
            await supabase
                .from('push_subscriptions')
                .delete()
                .eq('user_id', state.session.user.id)
                .eq('endpoint', subscription.endpoint);
        }
    } catch (err) {
        console.error('Push: Error unsubscribing:', err);
    }
}

/**
 * Helper: Convert Base64 URL to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
