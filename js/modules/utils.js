/* --- UTILITY --- */
export const formatAmount = (amount) => {
    // Force manual formatting to ensure thousands separator even for 4 digits (e.g. 7.000,00)
    // which some browser implementations of Intl might simplify.
    const num = Number(amount) || 0;
    const parts = num.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return parts.join(',');
};

export const debounce = (fn, delay) => {
    let timeoutId;
    return (...args) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            fn(...args);
        }, delay);
    };
};

export function getInitials(name) {
    if (!name) return '';
    const parts = name.split(' ');
    const initials = parts.map(n => n[0]).join('').substring(0, 2).toUpperCase();
    return initials;
}

export function joinNames(...parts) {
    return parts.flat().filter(v => v && v !== 'null' && v !== 'undefined' && v !== 'Utente').map(v => v.trim()).filter(Boolean).join(' ').trim() || '';
}

export function formatDate(date, full = false) {
    if (!date) return '';
    const d = new Date(date);
    if (full) {
        const s = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

export function getAvatarColor(name) {
    if (!name) return '#3b82f6';
    const colors = [
        '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444',
        '#f97316', '#ea580c', '#d97706', '#eab308', '#a16207', '#85920e', '#4d7c0f', '#276e27',
        '#047857', '#0f766e', '#0891b2', '#06b6d4', '#155e75', '#1e3a8a', '#4f46e5', '#7c3aed'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

export function renderAvatar(person, options = {}) {
    if (!person) return '';
    const { size = 28, borderRadius = '8px', fontSize = '0.7rem', border = true } = options;
    const name = person.full_name && person.full_name !== 'null' ? person.full_name : joinNames(person.first_name, person.last_name) || person.name || 'U';
    const avatarUrl = person.avatar_url;

    if (avatarUrl) {
        return `<img src="${avatarUrl}" style="width: ${size}px; height: ${size}px; border-radius: ${borderRadius}; object-fit: cover; ${border ? 'border: 1px solid var(--glass-border);' : ''} flex-shrink: 0;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div style="display: none; width: ${size}px; height: ${size}px; border-radius: ${borderRadius}; background: ${getAvatarColor(name)}; color: white; align-items: center; justify-content: center; font-size: ${fontSize}; font-weight: 700; flex-shrink: 0;">${getInitials(name)}</div>`;
    }

    return `<div style="width: ${size}px; height: ${size}px; border-radius: ${borderRadius}; background: ${getAvatarColor(name)}; color: white; display: flex; align-items: center; justify-content: center; font-size: ${fontSize}; font-weight: 700; flex-shrink: 0;">${getInitials(name)}</div>`;
}

// --- FISCAL CALCULATOR ---
export const FiscalCalculator = {
    calculate: (taxable, type, hasRivalsa, hasBollo, hasIvaAttiva) => {
        taxable = parseFloat(taxable) || 0;
        let rivalsInps = 0;
        let vat = 0;
        let ritenuta = 0;
        let stampDuty = 0;

        // 1. Rivalsa INPS (4%) - Applied to taxable base if requested
        if (hasRivalsa) {
            rivalsInps = taxable * 0.04;
        }

        const baseForTax = taxable + rivalsInps;

        // 2. Evolution Logic for Collaboration Types
        if (type === "Ritenuta d'acconto") {
            // Prestazione Occasionale: 20% withholding on base, no VAT
            ritenuta = baseForTax * 0.20;
            vat = 0;
            if (hasBollo && baseForTax > 77.47) stampDuty = 2.00;
        } else if (type === "Fattura") {
            // Can be "Ordinario" or "Forfettario" based on checkboxes
            // User requested "sostituisci e implementa" for Collaboration Type
            // Let's assume Fattura is the standard and we use Iva Attiva to decide
            if (hasIvaAttiva) {
                vat = baseForTax * 0.22;
                ritenuta = 0;
                stampDuty = 0;
            } else {
                // Forfettario-like: No VAT, yes Bollo
                vat = 0;
                ritenuta = 0;
                if (hasBollo && baseForTax > 77.47) stampDuty = 2.00;
            }
        } else if (type === "Nota di Credito") {
            // Simplified: Negative values
            return { taxable: -taxable, vat: 0, rivalsInps: 0, ritenuta: 0, stampDuty: 0, total: -taxable, netToPay: -taxable };
        }

        const total = baseForTax + vat + stampDuty;
        const netToPay = total - ritenuta;
        return {
            taxable,
            rivalsInps: parseFloat(rivalsInps.toFixed(2)),
            vat: parseFloat(vat.toFixed(2)),
            ritenuta: parseFloat(ritenuta.toFixed(2)),
            stampDuty: parseFloat(stampDuty.toFixed(2)),
            total: parseFloat(total.toFixed(2)),
            netToPay: parseFloat(netToPay.toFixed(2))
        };
    }
};



// --- MODAL UTILS ---
export function renderModal(modalId, content) {
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div class="modal-content animate-scale-in">
            ${content}
        </div>
    `;

    // Attach close handlers locally
    modal.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => closeModal(modalId));
    });

    // Force reflow
    void modal.offsetWidth;
    modal.classList.add('active');
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            if (!modal.classList.contains('active')) modal.remove();
        }, 300); // Match CSS transition
    }
}

export const showGlobalAlert = (message, type = 'success') => {
    const alert = document.createElement('div');
    alert.className = `global-alert ${type} animate-fade-in`;
    alert.innerText = message;
    alert.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--card-bg);
        color: var(--text-primary);
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: var(--card-shadow);
        border: 1px solid var(--glass-border);
        z-index: 10000;
        font-weight: 500;
    `;
    document.body.appendChild(alert);
    setTimeout(() => {
        alert.style.opacity = '0';
        setTimeout(() => alert.remove(), 500);
    }, 3000);
};

export const showConfirm = (message, title = 'Conferma') => {
    return new Promise((resolve) => {
        const modalId = `confirm-modal-${Date.now()}`;
        const content = `
            <div style="padding: 0.5rem;">
                <h3 style="margin: 0 0 1rem 0; font-family: var(--font-titles);">${title}</h3>
                <p style="margin: 0 0 2rem 0; color: var(--text-secondary); line-height: 1.5;">${message}</p>
                <div style="display: flex; justify-content: flex-end; gap: 1rem;">
                    <button class="primary-btn secondary small" id="confirm-cancel-${modalId}" style="min-width: 100px;">Annulla</button>
                    <button class="primary-btn small" id="confirm-ok-${modalId}" style="min-width: 100px; background: linear-gradient(135deg, #8b5cf6, #6366f1);">Conferma</button>
                </div>
            </div>
        `;

        renderModal(modalId, content);

        const cleanup = (result) => {
            closeModal(modalId);
            resolve(result);
        };

        document.getElementById(`confirm-cancel-${modalId}`).onclick = () => cleanup(false);
        document.getElementById(`confirm-ok-${modalId}`).onclick = () => cleanup(true);
    });
};

window.showGlobalAlert = showGlobalAlert;
window.showConfirm = showConfirm;

// --- RECURRENCE HELPERS ---

export function isWorkday(date) {
    const day = date.getDay();
    return day !== 0 && day !== 6; // Sunday = 0, Saturday = 6
}

export function addWorkdays(date, days) {
    let result = new Date(date);
    let added = 0;
    while (added < days) {
        result.setDate(result.getDate() + 1);
        if (isWorkday(result)) added++;
    }
    return result;
}

export function shiftToMonday(date) {
    const day = date.getDay();
    if (day === 0) { // Sunday
        date.setDate(date.getDate() + 1);
    } else if (day === 6) { // Saturday
        date.setDate(date.getDate() + 2);
    }
    return date;
}

export function generateRecurrences(startDate, recurrenceRule) {
    if (!recurrenceRule || !recurrenceRule.freq) return [];

    const instances = [];
    const freq = recurrenceRule.freq.toUpperCase(); // DAILY, WEEKLY, MONTHLY, YEARLY
    const interval = parseInt(recurrenceRule.interval) || 1;
    const unit = recurrenceRule.unit || 'day'; // day, workday, week, month, year
    const count = parseInt(recurrenceRule.count) || 0;
    const until = recurrenceRule.until ? new Date(recurrenceRule.until) : null;
    const weekendBehavior = recurrenceRule.weekend_behavior || 'none';

    let current = new Date(startDate);
    let occurrencesCreated = 0;

    const maxCycles = count > 0 ? count : 365; // Max 1 year if no count
    let cycle = 0;

    // The first one is already created, so we start generating from the next one
    while (cycle < 1000) { // Safety break
        cycle++;

        let next = new Date(current);
        if (freq === 'DAILY') {
            if (unit === 'workday') {
                next = addWorkdays(next, interval);
            } else {
                next.setDate(next.getDate() + interval);
            }
        } else if (freq === 'WEEKLY') {
            next.setDate(next.getDate() + (interval * 7));
        } else if (freq === 'MONTHLY') {
            next.setMonth(next.getMonth() + interval);
            if (weekendBehavior === 'shift_monday') shiftToMonday(next);
        } else if (freq === 'YEARLY') {
            next.setFullYear(next.getFullYear() + interval);
            if (weekendBehavior === 'shift_monday') shiftToMonday(next);
        }

        current = next;

        // Check termination conditions
        if (until && current > until) break;
        if (count > 0 && occurrencesCreated >= (count - 1)) break;

        // Success - add instance
        instances.push({
            date: current.toISOString(),
            label: current.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
        });
        occurrencesCreated++;

        // If we reached a reasonable limit for "creation in advance" or generic safety
        if (instances.length >= 100) break;
    }

    return instances;
}
