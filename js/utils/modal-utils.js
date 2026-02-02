/**
 * Custom Modal Utilities
 * Replaces native browser alert() and confirm() with styled modals
 */

// Export to global scope
window.showAlert = showAlert;
window.showConfirm = showConfirm;

// OVERRIDE NATIVE ALERT
// This ensures that any third-party library or legacy code using alert() 
// uses our custom modal instead, preventing native popups that might lose focus.
const nativeAlert = window.alert;
window.alert = function (message) {
    console.log("[ModalUtils] Intercepted native alert:", message);
    showAlert(message); // Fire and forget (async)
};


let systemModalContainer = null;

function initSystemModals() {
    console.log("[ModalUtils] initSystemModals called. Existing container in var:", !!systemModalContainer);

    // Always check the actual DOM
    let existingOnDom = document.getElementById('system-modal-container');

    if (existingOnDom) {
        systemModalContainer = existingOnDom;
        console.log("[ModalUtils] Container found on DOM");
    } else {
        systemModalContainer = document.createElement('div');
        systemModalContainer.id = 'system-modal-container';
        document.body.appendChild(systemModalContainer);
        console.log("[ModalUtils] system-modal-container created");
    }

    // Always move to the end of body to ensure it's top-most and avoids stacking context issues
    if (document.body.lastElementChild !== systemModalContainer) {
        document.body.appendChild(systemModalContainer);
        console.log("[ModalUtils] Container moved to end of body");
    }
}

/**
 * Show a custom alert modal
 * @param {string} message - The message to display
 * @param {string} type - Type of alert: 'error', 'success', 'warning', 'info'
 * @returns {Promise} Resolves when modal is closed
 */
function showAlert(message, type = 'info') {
    console.log("[ModalUtils] showAlert called:", { message, type });
    initSystemModals();

    return new Promise((resolve) => {
        const iconMap = {
            error: { icon: 'error', color: 'var(--error-color)' },
            success: { icon: 'check_circle', color: 'var(--success-color)' },
            warning: { icon: 'warning', color: 'var(--warning-color)' },
            info: { icon: 'info', color: 'var(--brand-blue)' }
        };

        const config = iconMap[type] || iconMap.info;

        const modalHTML = `
            <div class="system-modal active" id="system-alert-modal">
                <div class="system-modal-content">
                    <div class="system-modal-icon" style="color: ${config.color}">
                        <span class="material-icons-round">${config.icon}</span>
                    </div>
                    <div class="system-modal-message">${message}</div>
                    <div class="system-modal-actions">
                        <button class="primary-btn" id="alert-ok-btn">OK</button>
                    </div>
                </div>
            </div>
        `;

        systemModalContainer.innerHTML = modalHTML;
        systemModalContainer.classList.add('active');
        const modal = document.getElementById('system-alert-modal');
        const okBtn = document.getElementById('alert-ok-btn');

        const closeModal = () => {
            systemModalContainer.classList.remove('active');
            modal.classList.remove('active');
            setTimeout(() => {
                systemModalContainer.innerHTML = '';
                resolve();
            }, 300);
        };

        okBtn.addEventListener('click', closeModal);

        // Close on backdrop click
        systemModalContainer.addEventListener('click', (e) => {
            if (e.target === systemModalContainer) {
                closeModal();
            }
        });

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Focus OK button
        setTimeout(() => okBtn.focus(), 100);
    });
}

/**
 * Show a custom confirm modal
 * @param {string} message - The message to display
 * @param {Object} options - Configuration options
 * @param {string} options.confirmText - Text for confirm button (default: 'Conferma')
 * @param {string} options.cancelText - Text for cancel button (default: 'Annulla')
 * @param {string} options.type - Type: 'danger', 'warning', 'info' (default: 'info')
 * @returns {Promise<boolean>} Resolves to true if confirmed, false if cancelled
 */
function showConfirm(message, options = {}) {
    console.log("[ModalUtils] showConfirm called:", { message, options });
    initSystemModals();

    const {
        confirmText = 'Conferma',
        cancelText = 'Annulla',
        type = 'info'
    } = options;

    return new Promise((resolve) => {
        const iconMap = {
            danger: { icon: 'warning', color: 'var(--error-color)' },
            warning: { icon: 'warning', color: 'var(--warning-color)' },
            info: { icon: 'help_outline', color: 'var(--brand-blue)' }
        };

        const config = iconMap[type] || iconMap.info;
        const confirmBtnClass = type === 'danger' ? 'primary-btn danger' : 'primary-btn';

        const modalHTML = `
            <div class="system-modal active" id="system-confirm-modal">
                <div class="system-modal-content">
                    <div class="system-modal-icon" style="color: ${config.color}">
                        <span class="material-icons-round">${config.icon}</span>
                    </div>
                    <div class="system-modal-message">${message}</div>
                    <div class="system-modal-actions">
                        <button class="primary-btn secondary" id="confirm-cancel-btn">${cancelText}</button>
                        <button class="${confirmBtnClass}" id="confirm-ok-btn">${confirmText}</button>
                    </div>
                </div>
            </div>
        `;

        systemModalContainer.innerHTML = modalHTML;
        systemModalContainer.classList.add('active');
        const modal = document.getElementById('system-confirm-modal');
        const okBtn = document.getElementById('confirm-ok-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');

        if (!modal || !okBtn || !cancelBtn) {
            console.error("[ModalUtils] Failed to render confirm modal elements");
            systemModalContainer.classList.remove('active');
            resolve(false);
            return;
        }

        const closeModal = (result) => {
            systemModalContainer.classList.remove('active');
            modal.classList.remove('active');
            setTimeout(() => {
                systemModalContainer.innerHTML = '';
                resolve(result);
            }, 300);
        };

        okBtn.addEventListener('click', () => closeModal(true));
        cancelBtn.addEventListener('click', () => closeModal(false));

        // Close on backdrop click (counts as cancel)
        systemModalContainer.addEventListener('click', (e) => {
            if (e.target === systemModalContainer) {
                closeModal(false);
            }
        });

        // Close on Escape key (counts as cancel)
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal(false);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Focus confirm button
        setTimeout(() => okBtn.focus(), 100);
    });
}

/**
 * Show a custom prompt modal
 * @param {string} message - The message to display
 * @param {string} defaultValue - Initial value for the input
 * @param {Object} options - Configuration options
 * @returns {Promise<string|null>} Resolves to the value entered or null if cancelled
 */
function showPrompt(message, defaultValue = '', options = {}) {
    console.log("[ModalUtils] showPrompt called:", { message, defaultValue });
    initSystemModals();

    const {
        confirmText = 'Conferma',
        cancelText = 'Annulla',
        placeholder = 'Scrivi qui...'
    } = options;

    return new Promise((resolve) => {
        const modalHTML = `
            <div class="system-modal active" id="system-prompt-modal">
                <div class="system-modal-content" style="max-width: 500px !important;">
                    <div class="system-modal-icon" style="color: var(--brand-blue)">
                        <span class="material-icons-round">edit</span>
                    </div>
                    <div class="system-modal-message" style="margin-bottom: 0.5rem;">${message}</div>
                    <div style="width: 100%;">
                        <input type="text" id="prompt-input" value="${defaultValue}" placeholder="${placeholder}" 
                               style="width: 100%; padding: 0.75rem 1rem; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--bg-secondary); color: var(--text-primary); font-size: 1rem; outline: none; transition: border-color 0.2s;">
                    </div>
                    <div class="system-modal-actions">
                        <button class="primary-btn secondary" id="prompt-cancel-btn">${cancelText}</button>
                        <button class="primary-btn" id="prompt-ok-btn">${confirmText}</button>
                    </div>
                </div>
            </div>
        `;

        systemModalContainer.innerHTML = modalHTML;
        systemModalContainer.classList.add('active');
        const modal = document.getElementById('system-prompt-modal');
        const okBtn = document.getElementById('prompt-ok-btn');
        const cancelBtn = document.getElementById('prompt-cancel-btn');
        const input = document.getElementById('prompt-input');

        const closeModal = (result) => {
            systemModalContainer.classList.remove('active');
            modal.classList.remove('active');
            setTimeout(() => {
                systemModalContainer.innerHTML = '';
                resolve(result);
            }, 300);
        };

        const handleConfirm = () => closeModal(input.value);

        okBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', () => closeModal(null));

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
            }
        });

        // Close on backdrop click (counts as cancel)
        systemModalContainer.addEventListener('click', (e) => {
            if (e.target === systemModalContainer) {
                closeModal(null);
            }
        });

        // Close on Escape key (counts as cancel)
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal(null);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Focus & select input
        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);
    });
}

// Export to global scope
window.showAlert = showAlert;
window.showConfirm = showConfirm;
window.showPrompt = showPrompt;
